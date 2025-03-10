"use strict";

/********************************************************  
 * CREATE/RETRIEVE SESSION ID
 *******************************************************/
function generateSessionId() {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
    return (Math.random() * 16 | 0).toString(16);
  });
}

function getOrCreateSessionId() {
  let stored = localStorage.getItem("pointsLensSessionId");
  if (!stored) {
    stored = generateSessionId();
    localStorage.setItem("pointsLensSessionId", stored);
  }
  return stored;
}

const sessionId = getOrCreateSessionId();
console.log("Session ID:", sessionId);

/*******************************************************
 * GLOBALS & LOGGING
 *******************************************************/
let clientIP = null;
let approximateLocation = null;
let userEmail = null;
let hasSentReport = false;
let loyaltyPrograms = {};
// We'll store realWorldUseCases in an object; it starts empty:
let realWorldUseCases = {};
let currentUseCaseCategory = null;
let chosenPrograms = [];
let isTransitioning = false;
let pointsMap = {};

let dataLoaded = false;
let userClickedGetStarted = false;

/** For the bar & donut charts: */
let barChartInstance = null;
let pieChartInstance = null;

/** For the use case slider: */
let useCaseSwiper = null;

/*******************************************************
 * FETCH IP & LOCATION
 *******************************************************/
async function fetchClientIP() {
  try {
    const resp = await fetch("https://young-cute-neptune.glitch.me/getClientIP");
    if (!resp.ok) {
      throw new Error(`Failed to fetch IP. status: ${resp.status}`);
    }
    const data = await resp.json();
    clientIP = data.ip;
    console.log("Client IP =>", clientIP);
  } catch (err) {
    console.error("Error fetching IP =>", err);
  }
}

async function fetchApproxLocationFromIP() {
  if (!clientIP) return;
  try {
    // If IP is IPv6, skip
    if (clientIP.includes(":")) {
      approximateLocation = null;
      return;
    }
    const url = `https://ip-api.com/json/${clientIP}?fields=status,country,regionName,city,lat,lon,query`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Location fetch error: ${resp.status}`);
    }
    const data = await resp.json();
    if (data.status === "success") {
      approximateLocation = {
        country: data.country,
        region: data.regionName,
        city: data.city,
        lat: data.lat,
        lon: data.lon
      };
    }
    console.log("Approx location =>", approximateLocation);
  } catch (err) {
    console.error("Error fetching location =>", err);
  }
}

/*******************************************************
 * LOG EVENT
 *******************************************************/
function logSessionEvent(eventName, payload = {}) {
  const eventData = {
    sessionId,
    clientIP,
    eventName,
    approximateLocation,
    timestamp: Date.now(),
    ...payload
  };
  if (userEmail) {
    eventData.email = userEmail;
  }
  fetch("https://young-cute-neptune.glitch.me/proxyLogEvent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventData),
    keepalive: true
  });
}

// Remove localStorage item at session_end
let sessionStartTime = Date.now();
window.addEventListener('beforeunload', () => {
  const sessionEndTime = Date.now();
  const durationMs = sessionEndTime - sessionStartTime;
  logSessionEvent("session_end", { durationMs });
  localStorage.removeItem("pointsLensSessionId");
});

/*******************************************************
 * HELPER => EMAIL
 *******************************************************/
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/*******************************************************
 * FETCH WITH TIMEOUT
 *******************************************************/
async function fetchWithTimeout(url, options = {}, timeout = 10000, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const { signal } = controller;
    const tid = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(tid);
      if (response.ok) {
        return response;
      }
      if (attempt > maxRetries) {
        throw new Error(`HTTP status: ${response.status}`);
      }
      // Retry if not OK
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      clearTimeout(tid);
      if (err.name === "AbortError") {
        if (attempt > maxRetries) {
          throw new Error("Request timed out multiple times.");
        }
        await new Promise((r) => setTimeout(r, 500));
      } else {
        if (attempt > maxRetries) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw new Error("Failed fetch after maxRetries");
}

/*******************************************************
 * FETCH AIRTABLE
 *******************************************************/
async function fetchAirtableTable(tableName) {
  const resp = await fetchWithTimeout(
    `https://young-cute-neptune.glitch.me/fetchAirtableData?table=${tableName}`,
    {},
    10000,
    2
  );
  if (!resp.ok) {
    throw new Error(`Non-OK status: ${resp.status}`);
  }
  return await resp.json();
}

/*******************************************************
 * loadUseCasesIfNeeded => BACKGROUND LOAD
 *******************************************************/
async function loadUseCasesIfNeeded() {
  // Already fetched? skip
  if (Object.keys(realWorldUseCases).length > 0) {
    return;
  }
  try {
    const useCasesData = await fetchAirtableTable("Real-World Use Cases");
    // Build the object
    realWorldUseCases = useCasesData.reduce((acc, record) => {
      acc[record.id] = { id: record.id, ...record.fields };
      return acc;
    }, {});
    console.log("Real-World Use Cases =>", realWorldUseCases);
  } catch (err) {
    console.error("Error fetching Real-World =>", err);
  }
}

/*******************************************************
 * INIT APP => fetch loyalty programs, background load use cases
 *******************************************************/
async function initializeApp() {
  console.log("=== initializeApp() ===");
  try {
    const resp = await fetchWithTimeout(
      "https://young-cute-neptune.glitch.me/fetchPointsCalcData",
      {},
      10000
    );
    if (!resp.ok) {
      throw new Error("Network not OK => " + resp.statusText);
    }
    const programsData = await resp.json();
    loyaltyPrograms = programsData.reduce((acc, record) => {
      const fields = { ...record.fields };
      if (record.logoAttachmentUrl) {
        fields["Brand Logo URL"] = record.logoAttachmentUrl;
      }
      acc[record.id] = fields;
      return acc;
    }, {});
    console.log("loyaltyPrograms =>", loyaltyPrograms);
  } catch (err) {
    console.error("Error fetching Points Calc =>", err);
  }

  // Build popular programs UI
  buildTopProgramsSection();

  // Mark that essential data is loaded
  dataLoaded = true;
  console.log("Data fully loaded => dataLoaded = true");

  // Start loading use cases in the background (not awaited)
  loadUseCasesIfNeeded();
}

/*******************************************************
 * BUILD POPULAR PROGRAMS
 *******************************************************/
function buildTopProgramsSection() {
  const container = document.getElementById("top-programs-grid");
  if (!container) return;
  const topRecords = Object.keys(loyaltyPrograms).filter((id) => {
    return !!loyaltyPrograms[id]["Top Programs"];
  });
  let html = "";
  topRecords.forEach((rid) => {
    const prog = loyaltyPrograms[rid];
    const name = prog["Program Name"] || "Unnamed Program";
    const logo = prog["Brand Logo URL"] || "";
    html += `
      <div class="top-program-box" data-record-id="${rid}">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <img 
            src="${logo}" 
            alt="${name} logo"
          />
          <span class="top-program-label">${name}</span>
        </div>
        <button class="add-btn">+</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

/*******************************************************
 * updateTopProgramSelection
 *******************************************************/
function updateTopProgramSelection(rid, isSelected) {
  const $box = $(`.top-program-box[data-record-id='${rid}']`);
  if ($box.length) {
    if (isSelected) {
      $box.addClass("selected-state");
      $box.find(".add-btn").text("✓");
    } else {
      $box.removeClass("selected-state");
      $box.find(".add-btn").text("+");
    }
  }
}

/*******************************************************
 * FILTER PROGRAMS => dropdown preview
 *******************************************************/
function filterPrograms() {
  console.log("Filtering for:", $("#program-search").val());

  if (!loyaltyPrograms || !Object.keys(loyaltyPrograms).length) {
    $("#program-preview")
      .html("<div style='padding:12px; color:#999;'>Still loading programs...</div>")
      .removeClass("hidden");
    return;
  }

  const val = $("#program-search").val().toLowerCase().trim();
  // If empty, hide the preview
  if (!val) {
    $("#program-preview").addClass("hidden").empty();
    return;
  }

  // Filter out programs already chosen or in the calc
  const results = Object.keys(loyaltyPrograms).filter((id) => {
    const prog = loyaltyPrograms[id];
    if (!prog["Program Name"]) return false;
    if (chosenPrograms.includes(id)) return false;
    const inCalc = $(`#program-container .program-row[data-record-id='${id}']`).length > 0;
    if (inCalc) return false;
    return prog["Program Name"].toLowerCase().includes(val);
  });

  const limited = results.slice(0, 5);
  if (!limited.length) {
    $("#program-preview").addClass("hidden").empty();
    return;
  }

  let previewHTML = "";
  limited.forEach((rid) => {
    const prog = loyaltyPrograms[rid];
    const name = prog["Program Name"] || "Unknown Program";
    const logo = prog["Brand Logo URL"] || "";

    let typeIconUrl = "";
    switch ((prog.Type || "").toLowerCase()) {
      case "airline":
        typeIconUrl = "http://cdn.mcauto-images-production.sendgrid.net/f5e5a6724646c174/8a6ca255-cbeb-4300-b58e-597b98a0ff3b/512x512.png";
        break;
      case "cruise":
        typeIconUrl = "http://cdn.mcauto-images-production.sendgrid.net/f5e5a6724646c174/4ebf46e8-34e5-49a9-b0a1-1f769f55bf1b/512x512.png";
        break;
      case "hotel":
        typeIconUrl = "http://cdn.mcauto-images-production.sendgrid.net/f5e5a6724646c174/7a52dcc3-6776-4317-bb73-6bc231a87e63/512x512.png";
        break;
      case "credit card":
        typeIconUrl = "http://cdn.mcauto-images-production.sendgrid.net/f5e5a6724646c174/02b7c79b-011f-47ab-8d26-a8df6cb4da55/512x512.png";
        break;
      default:
        typeIconUrl = "";
        break;
    }

    previewHTML += `
      <div class="preview-item" data-record-id="${rid}">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="program-name">${name}</span>
          ${
            typeIconUrl
              ? `<img src="${typeIconUrl}" alt="${prog.Type}" class="program-type-icon" />`
              : `<span class="unknown-type">${prog.Type || "Unknown"}</span>`
          }
        </div>
        ${
          logo
            ? `<img src="${logo}" alt="logo" style="height:35px;">`
            : ""
        }
      </div>
    `;
  });

  $("#program-preview").html(previewHTML).removeClass("hidden");
}

/*******************************************************
 * ADD PROGRAM ROW
 *******************************************************/
function addProgramRow(recordId) {
  const prog = loyaltyPrograms[recordId];
  if (!prog) return;

  const existingPoints = pointsMap[recordId] || 0;
  const formattedPoints = existingPoints ? existingPoints.toLocaleString() : "";
  const logoUrl = prog["Brand Logo URL"] || "";
  const programName = prog["Program Name"] || "Unnamed Program";

  const rowHTML = `
    <div class="program-row" data-record-id="${recordId}">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        ${
          logoUrl
            ? `<img src="${logoUrl}" alt="${programName} logo" style="width:50px; height:auto;">`
            : ""
        }
        <span class="program-name">${programName}</span>
      </div>
      <div style="display:flex; align-items:center; gap:1rem;">
        <div class="dollar-input-container">
          <input
            type="tel"
            inputmode="numeric"
            class="points-input"
            placeholder="Enter Total"
            value="${formattedPoints}"
          />
        </div>
        <button class="remove-btn">×</button>
      </div>
    </div>
  `;
  $("#program-container").append(rowHTML);
  calculateTotal(); // optional real-time sum
}

/*******************************************************
 * TOGGLE SEARCH ITEM
 *******************************************************/
function toggleSearchItemSelection(itemEl) {
  const rid = itemEl.data("record-id");
  if (!rid) return;
  chosenPrograms.push(rid);
  itemEl.remove();
  $("#program-search").val("");
  $("#program-preview").addClass("hidden").empty();
  filterPrograms();
  updateChosenProgramsDisplay();
  updateNextCTAVisibility();
  updateClearAllVisibility();
}

/*******************************************************
 * TOGGLE PROGRAM => popular
 *******************************************************/
function toggleProgramSelection(boxEl) {
  const rid = boxEl.data("record-id");
  const idx = chosenPrograms.indexOf(rid);
  if (idx === -1) {
    chosenPrograms.push(rid);
    boxEl.addClass("selected-state");
    boxEl.find(".add-btn").text("✓");
  } else {
    chosenPrograms.splice(idx, 1);
    boxEl.removeClass("selected-state");
    boxEl.find(".add-btn").text("+");
  }
  updateChosenProgramsDisplay();
  updateNextCTAVisibility();
  updateClearAllVisibility();
}

/*******************************************************
 * UPDATE CHOSEN PROGRAMS DISPLAY
 *******************************************************/
function updateChosenProgramsDisplay() {
  const container = $("#chosen-programs-row");
  container.empty();
  if (!chosenPrograms.length) {
    $("#selected-programs-label").addClass("hidden");
    return;
  }
  $("#selected-programs-label").removeClass("hidden");

  chosenPrograms.forEach((rid) => {
    const prog = loyaltyPrograms[rid];
    if (!prog) return;
    const logoUrl = prog["Brand Logo URL"] || "";
    container.append(`
      <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
        <img 
          src="${logoUrl}" 
          alt="${prog["Program Name"] || "N/A"}" 
          style="width:100%; height:auto;"
        />
      </div>
    `);
  });
}

/*******************************************************
 * NEXT CTA VISIBILITY
 *******************************************************/
function updateNextCTAVisibility() {
  const $nextBtn = $("#input-next-btn");
  if (chosenPrograms.length > 0) {
    $nextBtn.removeClass("disabled-btn").prop("disabled", false);
  } else {
    $nextBtn.addClass("disabled-btn").prop("disabled", true);
  }
}

/*******************************************************
 * CLEAR ALL
 *******************************************************/
function clearAllPrograms() {
  chosenPrograms = [];
  pointsMap = {};
  $("#program-container").empty();
  $(".top-program-box.selected-state").removeClass("selected-state").find(".add-btn").text("+");
  updateChosenProgramsDisplay();
  updateNextCTAVisibility();
  updateClearAllVisibility();
}

/*******************************************************
 * SHOW/HIDE CLEAR-ALL
 *******************************************************/
function updateClearAllVisibility() {
  if (chosenPrograms.length > 0) {
    $("#clear-all-btn").removeClass("hidden");
  } else {
    $("#clear-all-btn").addClass("hidden");
  }
}

/*******************************************************
 * FORMAT => auto commas
 *******************************************************/
$(document).on("input", ".points-input", function(){
  let raw = $(this).val().replace(/[^0-9]/g, "");
  if (!raw) {
    $(this).val("");
    return;
  }
  let num = parseInt(raw, 10);
  if (num > 10000000) num = 10000000;
  $(this).val(num.toLocaleString());
  // Also store in pointsMap
  const rowEl = $(this).closest(".program-row");
  const recordId = rowEl.data("record-id");
  pointsMap[recordId] = num;
});

/*******************************************************
 * CALCULATE TOTAL
 *******************************************************/
function calculateTotal() {
  // optional real-time sum if needed
}

/*******************************************************
 * GATHER PROGRAM DATA
 *******************************************************/
function gatherProgramData() {
  const data = [];
  $(".program-row").each(function () {
    const rid = $(this).data("record-id");
    const prog = loyaltyPrograms[rid];
    if (!prog) return;
    let valStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
    const points = parseFloat(valStr) || 0;
    data.push({
      recordId: rid,
      programName: prog["Program Name"] || "Unknown",
      points
    });
  });
  return data;
}

/*******************************************************
 * BUILD USE CASE SLIDES
 *******************************************************/
function buildUseCaseSlides(allUseCases) {
  let slideHTML = "";

  allUseCases.forEach((uc) => {
    const imageURL  = uc["Use Case URL"]   || "";
    const title     = uc["Use Case Title"] || "Untitled";
    const body      = uc["Use Case Body"]  || "No description";
    const pointsReq = uc["Points Required"] || 0;
    const category  = uc["Category"]        || "";

    let programLogo = "";
    if (Array.isArray(uc["Program Logo"]) && uc["Program Logo"].length > 0) {
      programLogo = uc["Program Logo"][0].url || "";
    }

    slideHTML += `
      <div class="swiper-slide">
        <div class="slide-image-wrapper">
          <img
            src="${imageURL}"
            alt="Use Case"
            class="usecase-slide-image"
          />
        </div>
        <div class="usecase-slide-content">
          <div class="slide-top-row">
            <h3 class="slide-title">${title}</h3>
            ${
              programLogo
                ? `<img src="${programLogo}" alt="program logo" class="slide-program-logo" />`
                : ""
            }
          </div>
          <div class="slide-middle-row">
            <div class="slide-points-left">Points Required: ${pointsReq.toLocaleString()}</div>
            <div class="slide-category-right">${category}</div>
          </div>
          <hr class="slide-divider" />
          <div class="slide-body-text">
            <p>${body}</p>
          </div>
        </div>
      </div>
    `;
  });

  // Insert all slides into the DOM.
  document.getElementById("useCaseSlides").innerHTML = slideHTML;
}

// Now call buildFilteredUseCaseSlides(category or null)
buildFilteredUseCaseSlides(currentUseCaseCategory);

/**
 * buildFilteredUseCaseSlides => filters realWorldUseCases by category
 * or shows all if category is null, then re-initializes Swiper
 */
function buildFilteredUseCaseSlides(category) {
  let allUseCasesArr = Object.values(realWorldUseCases);

  if (category) {
    // Filter only those with the matching Category
    allUseCasesArr = allUseCasesArr.filter(uc => uc["Category"] === category);
  }

  // Render slides
  buildUseCaseSlides(allUseCasesArr);

  // Re-init the Swiper
  if (useCaseSwiper) {
    useCaseSwiper.destroy(true, true);
    useCaseSwiper = null;
  }
  initUseCaseSwiper();
}


/*******************************************************
 * BAR CHART => Travel vs Cash
 *******************************************************/
function renderValueComparisonChart(travelValue, cashValue) {
  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }
  const barCanvas = document.getElementById("valueComparisonChart");
  if (!barCanvas) return;
  const ctx = barCanvas.getContext("2d");

  const data = {
    labels: ["Travel", "Cash"],
    datasets: [
      {
        label: "Value",
        data: [travelValue, cashValue],
        backgroundColor: ["#67829B", "#76F04F"],
        hoverBackgroundColor: ["#5A7389", "#69DB47"],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const config = {
    type: "bar",
    data,
    options: {
      devicePixelRatio: 2,
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      layout: {
        padding: { top: 20, right: 20, bottom: 40, left: 20 }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "$" + Number(value).toLocaleString();
            },
            maxTicksLimit: 4,
            font: { size: 14, weight: '600' }
          }
        },
        y: {
          categoryPercentage: 0.8,
          barPercentage: 0.8,
          ticks: {
            font: { size: 14, weight: '600' }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: "Your Current Value",
          font: {
            size: 20,
            weight: "bold"
          },
          padding: { bottom: 20 }
        },
        legend: { display: false },
        tooltip: {
          displayColors: false,
          bodyFont: { size: 16 },
          callbacks: {
            label: function(context) {
              const val = context.parsed.x || 0;
              return "$" + val.toLocaleString(undefined, { 
                minimumFractionDigits: 2 
              });
            }
          }
        }
      }
    }
  };

  barChartInstance = new Chart(ctx, config);
}

/*******************************************************
 * DONUT CHART => Program Share
 *******************************************************/
function renderPieChartProgramShare(gatheredData) {
  const dataArr   = gatheredData.map(item => item.points);
  const labelsArr = gatheredData.map(item => item.programName);
  const colorsArr = gatheredData.map(item => {
    return loyaltyPrograms[item.recordId]?.Color || '#cccccc';
  });

  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  const ctx = document.getElementById("myPieCanvas").getContext("2d");
  const config = {
    type: "doughnut",
    data: {
      labels: labelsArr,
      datasets: [
        {
          data: dataArr,
          backgroundColor: colorsArr,
          hoverOffset: 8,
          borderWidth: 1,
          borderColor: "#fff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "50%",
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          displayColors: false
        }
      }
    }
  };

  pieChartInstance = new Chart(ctx, config);
}

/*******************************************************
 * BUILD ALL PROGRAMS LIST (for 'Explore All' modal)
 *******************************************************/
function buildAllProgramsList() {
  const container = $("#all-programs-list");
  container.empty();

  const allIds = Object.keys(loyaltyPrograms);
  allIds.forEach((rid) => {
    const prog = loyaltyPrograms[rid];
    const name = prog["Program Name"] || "Unknown Program";
    const logo = prog["Brand Logo URL"] || "";
    const isSelected = chosenPrograms.includes(rid);
    const circleIcon = isSelected ? "✓" : "+";
    const rowClass = isSelected ? "all-program-row selected-state" : "all-program-row";

    const rowHtml = `
      <div class="${rowClass}" data-record-id="${rid}">
        <div class="row-left">
          <img src="${logo}" alt="${name} logo" />
          <span class="program-name">${name}</span>
        </div>
        <button class="circle-btn">${circleIcon}</button>
      </div>
    `;
    container.append(rowHtml);
  });
}

/*******************************************************
 * gatherAllRecommendedUseCases
 *******************************************************/
function gatherAllRecommendedUseCases() {
  const userProgramPoints = {};
  const data = gatherProgramData();
  data.forEach(item => {
    userProgramPoints[item.recordId] = item.points;
  });

  const results = [];
  const usedIds = new Set();

  chosenPrograms.forEach(programId => {
    const userPoints = userProgramPoints[programId] || 0;
    Object.values(realWorldUseCases).forEach(uc => {
      if (!uc.Recommended) return;
      if (!uc["Points Required"]) return;
      if (!uc["Program Name"]?.includes(programId)) return;
      if (uc["Points Required"] > userPoints) return;

      if (!usedIds.has(uc.id)) {
        usedIds.add(uc.id);
        results.push(uc);
      }
    });
  });

  // Shuffle them randomly
  results.sort(() => Math.random() - 0.5);
  return results;
}

/*******************************************************
 * initUseCaseSwiper
 *******************************************************/
function initUseCaseSwiper() {
  useCaseSwiper = new Swiper('#useCaseSwiper', {
    slidesPerView: 1,
    spaceBetween: 0,
    centeredSlides: false,
    loop: true,
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
      dynamicBullets: true,
      dynamicMainBullets: 5
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev'
    }
  });
}

/*******************************************************
 * buildOutputRows => ensure use cases are loaded if Travel
 *******************************************************/
async function buildOutputRows(viewType) {
  const data = gatherProgramData();
  $("#output-programs-list").empty();

  let scenarioTotal = 0;
  let totalTravelValue = 0;
  let totalCashValue = 0;
  const totalPoints = data.reduce((acc, item) => acc + item.points, 0);

  data.forEach((item) => {
    const prog = loyaltyPrograms[item.recordId];
    const logoUrl = prog?.["Brand Logo URL"] || "";
    const tVal = item.points * (prog?.["Travel Value"] || 0);
    const cVal = item.points * (prog?.["Cash Value"] || 0);

    totalTravelValue += tVal;
    totalCashValue += cVal;
    const rowVal = (viewType === "travel") ? tVal : cVal;
    scenarioTotal += rowVal;

    const formattedVal = `$${rowVal.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    let rowHtml = `
      <div class="output-row" data-record-id="${item.recordId}">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${logoUrl}" alt="logo" style="width:50px;">
          <span class="program-name">${item.programName}</span>
        </div>
        <div class="output-value">${formattedVal}</div>
      </div>
    `;

    if (viewType === "travel") {
      rowHtml += `
        <div class="usecase-accordion">
          ${buildUseCaseAccordionContent(item.recordId, item.points)}
        </div>
      `;
    }

    $("#output-programs-list").append(rowHtml);
  });

  const label = (viewType === "travel") ? "Travel Value" : "Cash Value";
  const totalStr = `$${scenarioTotal.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  $("#output-programs-list").append(`
    <div class="total-value-row" 
         style="text-align:center; margin-top:1rem; font-weight:600;">
      ${label}: ${totalStr}
    </div>
  `);

  // Update stat cards
  $("#total-points-card .card-value").text(totalPoints.toLocaleString());
  $("#travel-value-card .card-value").text(
    "$" + totalTravelValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
  );
  $("#cash-value-card .card-value").text(
    "$" + totalCashValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
  );

  // Rebuild the bar chart
  renderValueComparisonChart(totalTravelValue, totalCashValue);

  // Rebuild the donut chart
  renderPieChartProgramShare(data);

  // If Travel => ensure use cases are loaded, then build slider
  if (viewType === "travel") {
    await loadUseCasesIfNeeded();  // make sure they're loaded

    const allUseCases = gatherAllRecommendedUseCases();
    buildUseCaseSlides(allUseCases);

    if (useCaseSwiper) {
      useCaseSwiper.destroy(true, true);
      useCaseSwiper = null;
    }
    initUseCaseSwiper();
  } else {
    if (useCaseSwiper) {
      useCaseSwiper.destroy(true, true);
      useCaseSwiper = null;
    }
  }
}

/*******************************************************
 * buildUseCaseAccordionContent
 *******************************************************/
function buildUseCaseAccordionContent(recordId, userPoints) {
  const program = loyaltyPrograms[recordId];
  if (!program) {
    return `<div style="padding:1rem;">No data found.</div>`;
  }
  let matching = Object.values(realWorldUseCases).filter((uc) => {
    if (!uc.Recommended) return false;
    if (!uc["Points Required"]) return false;
    if (!uc["Use Case Title"]) return false;
    if (!uc["Use Case Body"]) return false;
    const linked = uc["Program Name"] || [];
    return linked.includes(recordId) && uc["Points Required"] <= userPoints;
  });

  // Sort by redemption value descending, then slice top 5
  matching.sort((a, b) => (b["Redemption Value"] || 0) - (a["Redemption Value"] || 0));
  matching = matching.slice(0, 5);
  // Then sort by points ascending so the smallest requirement is first
  matching.sort((a, b) => (a["Points Required"] || 0) - (b["Points Required"] || 0));

  if (!matching.length) {
    return `<div style="padding:1rem;">No recommended use cases found for your points.</div>`;
  }

  let pillsHTML = "";
  matching.forEach((uc, i) => {
    const pts = uc["Points Required"] || 0;
    pillsHTML += `
      <div 
        class="mini-pill ${i === 0 ? "active" : ""}"
        data-usecase-id="${uc.id}"
        style="
          display:inline-block;
          margin-right:8px; 
          margin-bottom:8px;
          padding:6px 12px;
          border-radius:9999px;
          background-color:${i === 0 ? "#1a2732" : "#f0f0f0"};
          color:${i === 0 ? "#fff" : "#333"};
          cursor:pointer;
        "
      >
        ${pts.toLocaleString()}
      </div>
    `;
  });

  const first = matching[0];
  const imageURL = first["Use Case URL"] || "";
  const title = first["Use Case Title"] || "Untitled";
  const body  = first["Use Case Body"]  || "No description";

  return `
    <div style="display:flex; flex-direction:column; gap:1rem; min-height:200px;">
      <div class="mini-pill-row">
        ${pillsHTML}
      </div>
      <div style="display:flex; gap:1rem; flex-wrap:nowrap; align-items:flex-start; overflow-x:auto;">
        <div style="max-width:180px; flex:0 0 auto;">
          <img src="${imageURL}" alt="Use Case" style="width:100%; border-radius:4px;" />
        </div>
        <div style="flex:1 1 auto;">
          <h4 style="font-size:16px; margin:0 0 0.5rem; color:#1a2732; font-weight:bold;">
            ${title}
          </h4>
          <p style="font-size:14px; line-height:1.4; color:#555; margin:0;">
            ${body}
          </p>
        </div>
      </div>
    </div>
  `;
}

/*******************************************************
 * SETUP EVENT HANDLERS
 *******************************************************/
$(document).ready(function() {
  // 1) Immediately fetch IP, location, and main loyalty programs
  (async () => {
    try {
      await fetchClientIP();
      await fetchApproxLocationFromIP();
      await initializeApp();
      dataLoaded = true;

      // If the user clicked "Get Started" before data was loaded, reveal input now
      if (userClickedGetStarted) {
        $("#default-hero").addClass("hidden");
        $("#loading-screen").addClass("hidden");
        $("#input-state").removeClass("hidden");
        $(".left-column").removeClass("hidden");
        updateNextCTAVisibility();
        updateClearAllVisibility();
      }
    } catch (err) {
      console.error("Error while loading data =>", err);
    }
  })();

  // 2) Log the session load
  logSessionEvent("session_load");

  // 3) Hide all states except hero at first
  $("#how-it-works-state, #input-state, #calculator-state, #output-state, #usecase-state, #send-report-state, #submission-takeover").addClass("hidden");
  $("#default-hero").removeClass("hidden");
  $("#program-preview").addClass("hidden").empty();
  $(".left-column").addClass("hidden");

  // 4) Apply lazy loading to all images except those in #default-hero or #input-state
  //    This helps avoid downloading images for deeper states until needed
  $("#default-hero img, #input-state img").attr("loading", "eager");
  $("img").not("#default-hero img, #input-state img").attr("loading", "lazy");

  // =============== HERO => GET STARTED =================
$(document).on("click", ".usecase-pill", function() {
  const $pill = $(this);
  const category = $pill.data("category");
  
  // Check if the clicked pill is already active
  const isAlreadyActive = $pill.hasClass("active-pill");
  
  // Remove active state from all pills first
  $(".usecase-pill").removeClass("active-pill").each(function() {
    // re-set icons to black
    const $this = $(this);
    const blackIcon = $this.data("iconBlack");
    $this.find(".pill-icon").attr("src", blackIcon);
  });

  if (isAlreadyActive) {
    // (1) It was active => user re-click => remove filter
    currentUseCaseCategory = null;
  } else {
    // (2) Make this pill active
    $pill.addClass("active-pill");
    currentUseCaseCategory = category;

    // swap icon to white
    const whiteIcon = $pill.data("iconWhite");
    $pill.find(".pill-icon").attr("src", whiteIcon);
  }

  // 3) Now rebuild your Swiper slides based on the new category
  buildFilteredUseCaseSlides(currentUseCaseCategory);
});



  
  
  $("#hero-get-started-btn").on("click", function() {
  if (isTransitioning) return;
  isTransitioning = true;
  logSessionEvent("hero_get_started_clicked");
  userClickedGetStarted = true;

  if (dataLoaded) {
    // Hide the hero
    $("#default-hero").addClass("hidden");
    $("#loading-screen").addClass("hidden");

    // Show the input state
    $("#input-state").removeClass("hidden");

    // Now conditionally show the left column if wide enough
    if (window.innerWidth >= 992) {
        $(".left-column").removeClass("hidden");
  document.querySelector(".left-column").style.display = "flex";
    }

    updateNextCTAVisibility();
    updateClearAllVisibility();
    isTransitioning = false;
  } else {
    // ...
  }
});


  // =============== HERO => HOW IT WORKS =================
  $("#hero-how-it-works-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("hero_how_it_works_clicked");
  
    // Now conditionally show the left column if wide enough
    if (window.innerWidth >= 992) {
        $(".left-column").removeClass("hidden");
  document.querySelector(".left-column").style.display = "flex !important";
    
    }
    $("#default-hero").addClass("hidden");
    $("#how-it-works-state").removeClass("hidden");
    showHowItWorksStep(1);
    isTransitioning = false;
  });

  function showHowItWorksStep(stepNum) {
    $(".hiw-step").hide().removeClass("hiw-step-first");
    $(`.hiw-step[data-step='${stepNum}']`).show();
    $(".hiw-line").removeClass("active-line");
    $(".hiw-line").each(function(idx) {
      if (idx < stepNum) {
        $(this).addClass("active-line");
      }
    });
  }

  $("#hiw-continue-1").on("click", () => showHowItWorksStep(2));
  $("#hiw-continue-2").on("click", () => showHowItWorksStep(3));
  $("#hiw-final-start-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("hiw_final_get_started");
    $("#how-it-works-state").addClass("hidden");
    userClickedGetStarted = true;
    if (dataLoaded) {
      $("#default-hero").addClass("hidden");
      $("#loading-screen").addClass("hidden");
      $("#input-state").removeClass("hidden");
      if ($(window).width() >= 992) {
        $(".left-column").removeClass("hidden");
      }
      updateNextCTAVisibility();
      updateClearAllVisibility();
      isTransitioning = false;
    } else {
      $("#loading-screen").removeClass("hidden");
      isTransitioning = false;
    }
  });

  // Input => BACK => hero
  $("#input-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("input_back_clicked");
    $("#input-state").addClass("hidden");
      document.querySelector(".left-column").style.display = "flex";
    $("#default-hero").removeClass("hidden");
    $("#hero-how-it-works-btn, #hero-get-started-btn, .hero-inner h1, .hero-inner h2, .hero-cta-container").removeClass("hidden");
    isTransitioning = false;
  });

  // Input => NEXT => Calc
  $("#input-next-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("input_next_clicked");
    $("#input-state").addClass("hidden");
    $("#calculator-state").removeClass("hidden");
    $("#program-container").empty();
    chosenPrograms.forEach((rid) => addProgramRow(rid));
    $("#to-output-btn").removeClass("hidden");
    isTransitioning = false;
  });

  // Calc => BACK => Input
  $("#calc-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("calc_back_clicked");
    $("#calculator-state").addClass("hidden");
    $("#input-state").removeClass("hidden");
    $("#to-output-btn").addClass("hidden");
    updateClearAllVisibility();
    isTransitioning = false;
  });

  // Calc => NEXT => Output
  $("#to-output-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("calc_next_clicked");
    $("#calculator-state").addClass("hidden");
    $("#output-state").removeClass("hidden");
    $("#unlock-report-btn, #explore-concierge-lower").removeClass("hidden");
    buildOutputRows("travel");
    $(".tc-switch-btn").removeClass("active-tc");
    $(".tc-switch-btn[data-view='travel']").addClass("active-tc");
    isTransitioning = false;
  });

  

  // Output => BACK => Calc
  $("#output-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("output_back_clicked");
    $("#output-state").addClass("hidden");
    $("#calculator-state").removeClass("hidden");
    isTransitioning = false;
  });

  // “Explore All” => open All Programs modal
  $("#explore-all-btn").on("click", function() {
    buildAllProgramsList();
    $("#all-programs-modal").removeClass("hidden");
  });
  $("#all-programs-close-btn").on("click", function() {
    $("#all-programs-modal").addClass("hidden");
  });
  $("#all-programs-modal").on("click", function(e) {
    if ($(e.target).attr("id") === "all-programs-modal") {
      $("#all-programs-modal").addClass("hidden");
    }
  });

  // Switch Travel/Cash
  $(".tc-switch-btn").on("click", function() {
    $(".tc-switch-btn").removeClass("active-tc");
    $(this).addClass("active-tc");
    const viewType = $(this).data("view");
    buildOutputRows(viewType);
  });

  // Program search
  $("#program-search").on("input", filterPrograms);
  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      logSessionEvent("program_search_enter");
      $(".preview-item").click();
    }
  });

  // Toggle program from search preview
  $(document).on("click", ".preview-item", function() {
    const rid = $(this).data("record-id");
    logSessionEvent("program_preview_item_clicked", { rid });
    toggleSearchItemSelection($(this));
  });

  // Toggle program from popular
  $(document).on("click", ".top-program-box", function() {
    const rid = $(this).data("record-id");
    logSessionEvent("top_program_box_clicked", { rid });
    toggleProgramSelection($(this));
  });

  // Output => row click => expand/collapse next .usecase-accordion
  $(document).on("click", ".output-row", function() {
    $(".usecase-accordion:visible").slideUp();
    const nextAcc = $(this).next(".usecase-accordion");
    if (nextAcc.is(":visible")) {
      nextAcc.slideUp();
    } else {
      nextAcc.slideDown();
    }
  });

  // Remove single row in calculator
  $(document).on("click", ".remove-btn", function() {
    const rowEl = $(this).closest(".program-row");
    const recordId = rowEl.data("record-id");
    rowEl.remove();
    delete pointsMap[recordId];
  });

  // All Programs => row click
  $(document).on("click", ".all-program-row", function() {
    const rowEl = $(this);
    const rid = rowEl.data("record-id");
    if (!rid) return;

    const index = chosenPrograms.indexOf(rid);
    const isSelected = (index !== -1);

    if (isSelected) {
      chosenPrograms.splice(index, 1);
      rowEl.removeClass("selected-state");
      rowEl.find(".circle-btn").text("+");
      updateTopProgramSelection(rid, false);
    } else {
      chosenPrograms.push(rid);
      rowEl.addClass("selected-state");
      rowEl.find(".circle-btn").text("✓");
      updateTopProgramSelection(rid, true);
    }
    updateChosenProgramsDisplay();
    updateNextCTAVisibility();
    updateClearAllVisibility();
  });

  // mini-pills => switch use case content
  $(document).on("click", ".mini-pill", function() {
    const useCaseId = $(this).data("usecaseId");
    logSessionEvent("mini_pill_clicked", { useCaseId });
    const container = $(this).closest("div[style*='flex-direction:column']");
    $(this).siblings(".mini-pill").css({ backgroundColor: "#f0f0f0", color: "#333" }).removeClass("active");
    $(this).css({ backgroundColor: "#1a2732", color: "#fff" }).addClass("active");

    const uc = Object.values(realWorldUseCases).find(x => x.id === useCaseId);
    if (!uc) return;
    const newImg = uc["Use Case URL"] || "";
    const newTitle = uc["Use Case Title"] || "Untitled";
    const newBody  = uc["Use Case Body"]  || "";

    container.find("img").attr("src", newImg);
    container.find("h4").text(newTitle);
    container.find("p").text(newBody);
  });

  // Unlock => show email modal
  $("#unlock-report-btn").on("click", function() {
    logSessionEvent("unlock_report_clicked");
    $("#report-modal").removeClass("hidden");
  });
  $("#modal-close-btn").on("click", function() {
    logSessionEvent("modal_close_clicked");
    $("#report-modal").addClass("hidden");
  });
  $("#report-modal").on("click", function(e) {
    if ($(e.target).attr("id") === "report-modal") {
      $("#report-modal").addClass("hidden");
    }
  });

  // Send from modal
  $("#modal-send-btn").on("click", async function() {
    const emailInput = $("#modal-email-input").val().trim();
    logSessionEvent("modal_send_clicked", { email: emailInput });
    await sendReportFromModal();
  });

  async function sendReportFromModal() {
    const emailInput = $("#modal-email-input").val().trim();
    const errorEl = $("#modal-email-error");
    const sentMsgEl = $("#email-sent-message");
    const sendBtn = $("#modal-send-btn");

    errorEl.addClass("hidden").text("");
    sentMsgEl.addClass("hidden");

    if (!isValidEmail(emailInput)) {
      errorEl.text("Invalid email address.").removeClass("hidden");
      return;
    }

    sendBtn.prop("disabled", true).text("Sending...");
    try {
      await sendReport(emailInput);
      sentMsgEl.removeClass("hidden");
      hasSentReport = true;
      userEmail = emailInput;
      logSessionEvent("email_submitted", { email: userEmail });

      setTimeout(() => {
        $("#report-modal").addClass("hidden");
        sentMsgEl.addClass("hidden");
        // Switch button styling after user has unlocked
        $("#unlock-report-btn").removeClass("cta-dark cta-light-border").addClass("cta-light-border");
        $("#explore-concierge-lower").removeClass("cta-dark cta-light-border").addClass("cta-dark");
      }, 700);
    } catch (err) {
      console.error("Failed to send =>", err);
      errorEl.text(err.message || "Error sending report").removeClass("hidden");
    } finally {
      sendBtn.prop("disabled", false).text("Send Report");
    }
  }

  // explore => open services modal
  $("#explore-concierge-lower, #explore-concierge-btn").on("click", function() {
    logSessionEvent("explore_concierge_clicked");
    $("#services-modal").removeClass("hidden");
  });
  $("#services-modal-close-btn").on("click", function() {
    $("#services-modal").addClass("hidden");
  });

  // usecase => back => output
  $("#usecase-back-btn").on("click", function() {
    $("#usecase-state").addClass("hidden");
    $("#output-state").removeClass("hidden");
  });

  // send-report => back => output
  $("#send-report-back-btn").on("click", function() {
    $("#send-report-state").addClass("hidden");
    $("#output-state").removeClass("hidden");
  });

  // submission => back => output
  $("#go-back-btn").on("click", function() {
    $("#submission-takeover").addClass("hidden");
    $("#output-state").removeClass("hidden");
  });

  // Clear All
  $("#clear-all-btn").on("click", function() {
    logSessionEvent("clear_all_clicked");
    clearAllPrograms();
  });
});

/*******************************************************
 * SEND REPORT
 *******************************************************/
async function sendReport(email) {
  if (!email) return;
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }
  const fullData = gatherProgramData();
  const programsToSend = fullData.map(x => ({
    programName: x.programName,
    points: x.points
  }));
  console.log("Sending =>", { email, programsToSend });

  const response = await fetch("https://young-cute-neptune.glitch.me/proxySubmitData", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, programs: programsToSend })
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return true;
}
