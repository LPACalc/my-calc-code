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
let realWorldUseCases = [];
let chosenPrograms = [];
let isTransitioning = false;
let pointsMap = {};

let dataLoaded = false;           
let userClickedGetStarted = false;

/** For the bar & pie charts: */
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
    // If IP is IPv6, skip location
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
 * INIT APP
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

  try {
    const useCasesData = await fetchAirtableTable("Real-World Use Cases");
    realWorldUseCases = useCasesData.reduce((acc, record) => {
      acc[record.id] = { id: record.id, ...record.fields };
      return acc;
    }, {});
    console.log("Real-World Use Cases =>", realWorldUseCases);
  } catch (err) {
    console.error("Error fetching Real-World =>", err);
  }

  buildTopProgramsSection();

  // Data is fully loaded
  dataLoaded = true;
  console.log("Data fully loaded => dataLoaded = true");
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
            style="object-fit:contain;"
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
 * MISSING FUNCTION => updateTopProgramSelection
 *******************************************************/
function updateTopProgramSelection(rid, isSelected) {
  const $box = $(`.top-program-box[data-record-id='${rid}']`);
  if ($box.length) {
    if (isSelected) {
      $box.addClass("selected-state");
      if (window.innerWidth >= 992) {
        $box.find(".add-btn").text("✓");
      }
    } else {
      $box.removeClass("selected-state");
      if (window.innerWidth >= 992) {
        $box.find(".add-btn").text("+");
      }
    }
  }
}

/*******************************************************
 * FILTER PROGRAMS
 *******************************************************/
function filterPrograms() {
  if (!loyaltyPrograms || !Object.keys(loyaltyPrograms).length) {
    $("#program-preview")
      .html("<div style='padding:12px; color:#999;'>Still loading programs...</div>")
      .show();
    return;
  }
  const val = $("#program-search").val().toLowerCase().trim();
  if (!val) {
    $("#program-preview").hide().empty();
    return;
  }
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
    $("#program-preview").hide().empty();
    return;
  }
  let previewHTML = "";
  limited.forEach((rid) => {
    const prog = loyaltyPrograms[rid];
    const name = prog["Program Name"];
    const logo = prog["Brand Logo URL"] || "";
    previewHTML += `
      <div class="preview-item" data-record-id="${rid}">
        <div>
          <span class="program-name">${name}</span>
          <span class="program-type">(${prog.Type || "Unknown"})</span>
        </div>
        ${logo ? `<img src="${logo}" alt="logo" style="height:35px;">` : ""}
      </div>
    `;
  });
  $("#program-preview").html(previewHTML).show();
}

/*******************************************************
 * GLOBAL “BOTTOM SHEET” MODAL => with Hammer.js for pull-down
 *******************************************************/
const modal = document.getElementById('all-programs-modal');
const sheetContent = document.getElementById('all-programs-modal-content');

// Create a Hammer manager for sheetContent
const hammerManager = new Hammer(sheetContent);
hammerManager.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });

let isModalOpen = false;
const PULL_DOWN_THRESHOLD = 100; // how many px to pull down before closing

function openAllProgramsModal() {
  document.documentElement.style.overscrollBehavior = 'none';
  buildAllProgramsList();
  modal.classList.add('show');

  setTimeout(() => {
    sheetContent.style.transition = 'transform 0.4s ease';
    sheetContent.style.transform = 'translateY(0)';
    isModalOpen = true;
  }, 10);
}

function closeAllProgramsModal() {
  sheetContent.style.transition = 'transform 0.4s ease';
  sheetContent.style.transform = 'translateY(100%)';

  setTimeout(() => {
    modal.classList.remove('show');
    isModalOpen = false;
    document.documentElement.style.overscrollBehavior = '';
  }, 400);
}

// Hammer => panstart => no transitions
hammerManager.on('panstart', () => {
  if (!isModalOpen) return;
  sheetContent.style.transition = 'none';
});

// Hammer => panmove => follow finger
hammerManager.on('panmove', (ev) => {
  if (!isModalOpen) return;
  const clampedY = Math.max(0, ev.deltaY);
  sheetContent.style.transform = `translateY(${clampedY}px)`;
});

// Hammer => panend => if pulled enough => close
hammerManager.on('panend', (ev) => {
  if (!isModalOpen) return;
  if (ev.deltaY > PULL_DOWN_THRESHOLD) {
    closeAllProgramsModal();
  } else {
    sheetContent.style.transition = 'transform 0.3s ease';
    sheetContent.style.transform = 'translateY(0)';
  }
});

// backdrop click => close
modal.addEventListener("click", (e) => {
  if (e.target.id === "all-programs-modal") {
    closeAllProgramsModal();
  }
});

// X button => close
document.getElementById("all-programs-close-btn").addEventListener("click", () => {
  closeAllProgramsModal();
});

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
            ? `<img 
                 src="${logoUrl}" 
                 alt="${programName} logo"
                 style="width:50px; height:auto;"
               />`
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
            oninput="formatNumberInput(this); calculateTotal()"
            value="${formattedPoints}"
          />
        </div>
        <button class="remove-btn">×</button>
      </div>
    </div>
  `;
  $("#program-container").append(rowHTML);
  calculateTotal();
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
  $("#program-preview").hide().empty();
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
    if (window.innerWidth >= 992) {
      boxEl.find(".add-btn").text("✓");
    }
  } else {
    chosenPrograms.splice(idx, 1);
    boxEl.removeClass("selected-state");
    if (window.innerWidth >= 992) {
      boxEl.find(".add-btn").text("+");
    }
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
    $("#selected-programs-label").hide();
    return;
  }
  $("#selected-programs-label").show();

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

  // If modal is open, refresh
  if ($("#all-programs-modal").hasClass("show")) {
    buildAllProgramsList();
  }
}

/*******************************************************
 * SHOW/HIDE CLEAR-ALL
 *******************************************************/
function updateClearAllVisibility() {
  const $btn = $("#clear-all-btn");
  $btn.toggle(chosenPrograms.length > 0);
}

/*******************************************************
 * FORMAT => auto commas
 *******************************************************/
function formatNumberInput(el) {
  let raw = el.value.replace(/[^0-9]/g, "");
  if (!raw) {
    el.value = "";
    return;
  }
  let num = parseInt(raw, 10);
  if (num > 10000000) num = 10000000;
  el.value = num.toLocaleString();
}

function calculateTotal() {
  // Optionally calculate a running total if you want
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
 * BUILD USE CASE SLIDER
 *******************************************************/
function buildUseCaseSlides(allUseCases) {
  let slideHTML = "";

  allUseCases.forEach(uc => {
    const imageURL = uc["Use Case URL"] || "";
    const title    = uc["Use Case Title"] || "Untitled";
    const body     = uc["Use Case Body"]  || "No description";
    const points   = uc["Points Required"] || 0;

    slideHTML += `
      <div class="swiper-slide">
        <img src="${imageURL}" alt="Use Case" class="usecase-slide-image" />
        <div class="usecase-slide-content">
          <h3 class="usecase-slide-title">${title}</h3>
          <p class="usecase-slide-body">${body}</p>
          <p class="usecase-slide-points">Points Required: ${points.toLocaleString()}</p>
        </div>
      </div>
    `;
  });

  const slidesEl = document.getElementById("useCaseSlides");
  slidesEl.innerHTML = slideHTML;
}

function initUseCaseSwiper() {
  useCaseSwiper = new Swiper('#useCaseSwiper', {
    slidesPerView: 1,
    direction: 'horizontal',
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
 * PIE CHART => Program Share
 *******************************************************/
function renderPieChartProgramShare(gatheredData) {
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }
  const pieCanvas = document.getElementById("programSharePieChart");
  if (!pieCanvas) return;
  const ctx = pieCanvas.getContext("2d");

  const totalPoints = gatheredData.reduce((acc, x) => acc + x.points, 0);
  if (totalPoints < 1) {
    ctx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
    return;
  }

  const labels = gatheredData.map(x => x.programName);
  const values = gatheredData.map(x => x.points);
  const backgroundColors = gatheredData.map(item => {
    const storedColor = loyaltyPrograms[item.recordId]?.Color;
    return storedColor || "#cccccc";
  });

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: backgroundColors,
        hoverOffset: 10
      }
    ]
  };

  const config = {
    type: "doughnut",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 20, right: 20, bottom: 40, left: 20 }
      },
      cutout: "63%",
      plugins: {
        title: {
          display: true,
          text: "Program Breakdown",
          font: {
            size: 20,
            weight: "bold"
          },
          padding: { bottom: 20 }
        },
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          bodyFont: { size: 16 },
          callbacks: {
            label: function(context) {
              const val = context.parsed || 0;
              const total = values.reduce((a, b) => a + b, 0);
              const pct = ((val / total) * 100).toFixed(1) + "%";
              return `${context.label}: ${val.toLocaleString()} pts (${pct})`;
            }
          }
        }
      }
    }
  };

  pieChartInstance = new Chart(ctx, config);

  // If you have a custom container for the legend:
  const legendContainer = document.getElementById("pieLegendContainer");
  if (legendContainer) {
    legendContainer.innerHTML = pieChartInstance.generateLegend();
  }
}

/*******************************************************
 * SINGLE CLICK HANDLER => .all-program-row
 *******************************************************/
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

/*******************************************************
 * USE CASE RECOMMENDATIONS
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

// Click => open 'Explore All' modal
$("#explore-all-btn").on("click", function() {
  openAllProgramsModal();
});

/*******************************************************
 * REPORT MODAL => show/hide
 *******************************************************/
function showReportModal() {
  $("#report-modal").addClass("show");
}
function hideReportModal() {
  $("#report-modal").removeClass("show");
}

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

async function sendReportFromModal() {
  const emailInput = $("#modal-email-input").val().trim();
  const errorEl = $("#modal-email-error");
  const sentMsgEl = $("#email-sent-message");
  const sendBtn = $("#modal-send-btn");

  errorEl.hide().text("");
  sentMsgEl.hide();

  if (!isValidEmail(emailInput)) {
    errorEl.text("Invalid email address.").show();
    return;
  }

  sendBtn.prop("disabled", true).text("Sending...");
  try {
    await sendReport(emailInput);
    sentMsgEl.show();
    hasSentReport = true;
    userEmail = emailInput;
    logSessionEvent("email_submitted", { email: userEmail });

    setTimeout(() => {
      hideReportModal();
      sentMsgEl.hide();
      // Switch button styling after user has unlocked
      $("#unlock-report-btn").removeClass("cta-dark cta-light-border").addClass("cta-light-border");
      $("#explore-concierge-lower").removeClass("cta-dark cta-light-border").addClass("cta-dark");
    }, 700);
  } catch (err) {
    console.error("Failed to send =>", err);
    errorEl.text(err.message || "Error sending report").show();
  } finally {
    sendBtn.prop("disabled", false).text("Send Report");
  }
}

/*******************************************************
 * SHOW HOW IT WORKS STEP
 *******************************************************/
function showHowItWorksStep(stepNum) {
  $(".hiw-step").hide();
  $(`.hiw-step[data-step='${stepNum}']`).show();
  $(".hiw-line").removeClass("active-line");
  $(".hiw-line").each(function(idx) {
    if (idx < stepNum) {
      $(this).addClass("active-line");
    }
  });
}

/*******************************************************
 * DOC READY => MAIN
 *******************************************************/
$(document).ready(function() {
  (async () => {
    try {
      await fetchClientIP();
      await fetchApproxLocationFromIP();
      await initializeApp();
      dataLoaded = true;
      console.log("Data fully loaded => dataLoaded = true (confirmed)");

      if (userClickedGetStarted) {
        hideLoadingScreenAndShowInput();
      }
    } catch (err) {
      console.error("Error while loading data =>", err);
    }
  })();

  logSessionEvent("session_load");

  // Hide all states except hero
  $("#how-it-works-state, #input-state, #calculator-state, #output-state, #usecase-state, #send-report-state, #submission-takeover").hide();
  $("#default-hero").show();
  $("#program-preview").hide().empty();
  $(".left-column").hide();

  // =============== HERO => GET STARTED =================
  $("#hero-get-started-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("hero_get_started_clicked");
    userClickedGetStarted = true;

    if (dataLoaded) {
      hideLoadingScreenAndShowInput();
    } else {
      // Hide hero content, show spinner
      $("#hero-how-it-works-btn").hide();
      $("#hero-get-started-btn").hide();
      $(".hero-inner h1, .hero-inner h2, .hero-cta-container").hide();
      $("#loading-screen").show();
      isTransitioning = false;
    }
  });

  function hideLoadingScreenAndShowInput() {
    if (window.innerWidth >= 992) {
      $(".left-column").show();
      $(".left-column").css({
        background: `url("https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/9d2f0865-2660-45d8-82d0-f6ac7d3b2248/Banner.jpeg") center/cover no-repeat`
      });
    }
    $("#default-hero").hide();
    $("#loading-screen").hide();
    $("#input-state").fadeIn(() => {
      isTransitioning = false;
      updateNextCTAVisibility();
      updateClearAllVisibility();
    });
  }

  // =============== HERO => HOW IT WORKS =================
  $("#hero-how-it-works-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("hero_how_it_works_clicked");

    if (window.innerWidth >= 992) {
      $(".left-column").show();
      $(".left-column").css({
        background: `url("https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/9d2f0865-2660-45d8-82d0-f6ac7d3b2248/Banner.jpeg") center/cover no-repeat`
      });
    }
    $("#default-hero").hide();
    $("#how-it-works-state").fadeIn(() => {
      isTransitioning = false;
      showHowItWorksStep(1);
    });
  });

  // Step transitions in HIW
  $("#hiw-continue-1").on("click", () => showHowItWorksStep(2));
  $("#hiw-continue-2").on("click", () => showHowItWorksStep(3));
  $("#hiw-final-start-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("hiw_final_get_started");
    $("#how-it-works-state").hide();
    userClickedGetStarted = true;
    if (dataLoaded) {
      hideLoadingScreenAndShowInput();
    } else {
      $("#loading-screen").show();
      isTransitioning = false;
    }
  });

  // =============== INPUT => BACK => HERO =================
  $("#input-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("input_back_clicked");
    $("#input-state").hide();
    $(".left-column").hide();
    $("#hero-how-it-works-btn, #hero-get-started-btn, .hero-inner h1, .hero-inner h2, .hero-cta-container").show();
    $("#default-hero").fadeIn(() => {
      isTransitioning = false;
    });
  });

  // =============== INPUT => NEXT => CALC =================
  $("#input-next-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("input_next_clicked");
    $("#input-state").hide();
    $("#calculator-state").fadeIn(() => {
      isTransitioning = false;
      $("#to-output-btn").show();
    });
    $("#program-container").empty();
    chosenPrograms.forEach((rid) => addProgramRow(rid));
    updateClearAllVisibility();
  });

  // =============== CALC => BACK => INPUT =================
  $("#calc-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("calc_back_clicked");
    $("#calculator-state").hide();
    $("#input-state").fadeIn(() => {
      isTransitioning = false;
      $("#to-output-btn").hide();
      updateClearAllVisibility();
    });
  });

  // =============== CALC => NEXT => OUTPUT =================
  $("#to-output-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("calc_next_clicked");
    $("#calculator-state").hide();
    $("#output-state").fadeIn(() => {
      isTransitioning = false;
      $("#unlock-report-btn, #explore-concierge-lower").show();
    });
    // Build TRAVEL view by default
    buildOutputRows("travel");
    $(".tc-switch-btn").removeClass("active-tc");
    $(".tc-switch-btn[data-view='travel']").addClass("active-tc");
  });

  // =============== OUTPUT => BACK => CALC =================
  $("#output-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;
    logSessionEvent("output_back_clicked");
    $("#output-state").hide();
    $("#calculator-state").fadeIn(() => {
      isTransitioning = false;
    });
  });

  // Switch between Travel / Cash
  $(".tc-switch-btn").on("click", function() {
    $(".tc-switch-btn").removeClass("active-tc");
    $(this).addClass("active-tc");
    buildOutputRows($(this).data("view"));
  });

  // Real-time filter
  $("#program-search").on("input", filterPrograms);

  // If Enter is pressed & only 1 result => auto-pick
  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      logSessionEvent("program_search_enter");
      $(".preview-item").click();
    }
  });

  // Toggle program from search
  $(document).on("click", ".preview-item", function() {
    const rid = $(this).data("record-id");
    logSessionEvent("program_preview_item_clicked", { rid });
    toggleSearchItemSelection($(this));
  });

  // Toggle program from “Popular Programs”
  $(document).on("click", ".top-program-box", function() {
    const rid = $(this).data("record-id");
    logSessionEvent("top_program_box_clicked", { rid });
    toggleProgramSelection($(this));
  });

  // Output => row click => expand/collapse use case
  $(document).on("click", ".output-row", function() {
    $(".usecase-accordion:visible").slideUp();
    const nextAcc = $(this).next(".usecase-accordion");
    if (nextAcc.is(":visible")) {
      nextAcc.slideUp();
    } else {
      nextAcc.slideDown();
    }
  });

  // Remove single program row
  $(document).on("click", ".remove-btn", function() {
    const rowEl = $(this).closest(".program-row");
    const recordId = rowEl.data("record-id");
    rowEl.remove();
    delete pointsMap[recordId];
  });

  // On typed input => update pointsMap
  $(document).on("input", ".points-input", function() {
    const rowEl = $(this).closest(".program-row");
    const recordId = rowEl.data("record-id");
    let raw = $(this).val().replace(/[^0-9]/g, "");
    if (!raw) {
      pointsMap[recordId] = 0;
      return;
    }
    let num = parseInt(raw, 10);
    pointsMap[recordId] = isNaN(num) ? 0 : num;
  });

  // Switch active use case mini-pill
  $(document).on("click", ".mini-pill", function() {
    const useCaseId = $(this).data("usecaseId");
    logSessionEvent("mini_pill_clicked", { useCaseId });
    const container = $(this).closest("div[style*='flex-direction:column']");
    $(this).siblings(".mini-pill").css({ backgroundColor: "#f0f0f0", color: "#333" }).removeClass("active");
    $(this).css({ backgroundColor: "#1a2732", color: "#fff" }).addClass("active");

    const uc = Object.values(realWorldUseCases).find(x => x.id === useCaseId);
    if (!uc) return;
    container.find("img").attr("src", uc["Use Case URL"] || "");
    container.find("h4").text(uc["Use Case Title"] || "Untitled");
    container.find("p").text(uc["Use Case Body"] || "");
  });

  // Unlock => show email modal
  $("#unlock-report-btn").on("click", function() {
    logSessionEvent("unlock_report_clicked");
    showReportModal();
  });
  $("#modal-close-btn").on("click", function() {
    logSessionEvent("modal_close_clicked");
    hideReportModal();
  });
  $("#report-modal").on("click", function(e) {
    if ($(e.target).attr("id") === "report-modal") {
      hideReportModal();
    }
  });
  $("#modal-send-btn").on("click", async function() {
    const emailInput = $("#modal-email-input").val().trim();
    logSessionEvent("modal_send_clicked", { email: emailInput });
    await sendReportFromModal();
  });

  // Explore => external link (services modal)
  $("#explore-concierge-lower, #explore-concierge-btn").on("click", function() {
    logSessionEvent("explore_concierge_clicked");
    $("#services-modal").addClass("show");
  });
  $("#services-modal-close-btn").on("click", function() {
    $("#services-modal").removeClass("show");
  });

  // Usecase => back => output
  $("#usecase-back-btn").on("click", function() {
    $("#usecase-state").hide();
    $("#output-state").fadeIn();
  });

  // Send report => back => output
  $("#send-report-back-btn").on("click", function() {
    $("#send-report-state").hide();
    $("#output-state").fadeIn();
  });

  // Sub takeover => back => output
  $("#go-back-btn").on("click", function() {
    $("#submission-takeover").hide();
    $("#output-state").fadeIn();
  });

  // Clear All
  $("#clear-all-btn").on("click", function() {
    logSessionEvent("clear_all_clicked");
    clearAllPrograms();
  });
});

/*******************************************************
 * BUILD OUTPUT => TRAVEL / CASH
 *******************************************************/
function buildOutputRows(viewType) {
  const data = gatherProgramData();
  $("#output-programs-list").empty();

  let scenarioTotal = 0;
  let totalTravelValue = 0;
  let totalCashValue = 0;

  // Sum user-entered points
  const totalPoints = data.reduce((acc, item) => acc + item.points, 0);

  data.forEach((item) => {
    const prog = loyaltyPrograms[item.recordId];
    const logoUrl = prog?.["Brand Logo URL"] || "";
    const tVal = item.points * (prog?.["Travel Value"] || 0);
    const cVal = item.points * (prog?.["Cash Value"] || 0);
    totalTravelValue += tVal;
    totalCashValue   += cVal;

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

    // If Travel view => show recommended use-cases
    if (viewType === "travel") {
      rowHtml += `
        <div class="usecase-accordion"
             style="
               display:none; 
               border:1px solid #dce3eb; 
               border-radius:6px; 
               margin-bottom:12px; 
               padding:1rem; 
               overflow-x:auto;
             ">
          ${buildUseCaseAccordionContent(item.recordId, item.points)}
        </div>
      `;
    }

    $("#output-programs-list").append(rowHtml);
  });

  // Show label & total
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
  $("#total-points-card .card-value").text(
    totalPoints.toLocaleString()
  );
  $("#travel-value-card .card-value").text(
    "$" + totalTravelValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
  );
  $("#cash-value-card .card-value").text(
    "$" + totalCashValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
  );

  // Rebuild charts
  renderValueComparisonChart(totalTravelValue, totalCashValue);
  renderPieChartProgramShare(data);

  // If Travel => build Use Case slider
  if (viewType === "travel") {
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
 * USE CASE => BUILD ACCORDION CONTENT
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

  // Sort by redemption value desc
  matching.sort((a, b) => (b["Redemption Value"] || 0) - (a["Redemption Value"] || 0));
  // Take top 5
  matching = matching.slice(0, 5);
  // Then sort by points ascending
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
  const body = first["Use Case Body"] || "No description";

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
