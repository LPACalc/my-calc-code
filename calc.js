"use strict";

// STEP 1: CREATE/RETRIEVE SESSION ID
function generateSessionId() {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
    return (Math.random() * 16 | 0).toString(16);
  });
}

function getOrCreateSessionId() {
  // Try localStorage first
  let stored = localStorage.getItem("pointsLensSessionId");
  if (!stored) {
    stored = generateSessionId();
    localStorage.setItem("pointsLensSessionId", stored);
  }
  return stored;
}

// Global sessionId
const sessionId = getOrCreateSessionId();
console.log("Session ID:", sessionId);

/*******************************************************
 * [NEW] FETCH CLIENT IP & LOG EVENTS
 *******************************************************/
let clientIP = null; // optional
let approximateLocation = null; 
let userEmail = null; // once user enters email
let hasSentReport = false; // track if user has already sent a report

async function fetchClientIP() {
  try {
    const resp = await fetch("https://young-cute-neptune.glitch.me/getClientIP");
    if (!resp.ok) {
      throw new Error(`Failed to fetch IP. HTTP status: ${resp.status}`);
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
    if (clientIP.includes(":")) {
      console.warn("IPv6 address. Skipping ip-api to avoid 403.");
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
        region:  data.regionName,
        city:    data.city,
        lat:     data.lat,
        lon:     data.lon
      };
    }
    console.log("Approx location =>", approximateLocation);
  } catch (err) {
    console.error("Error fetching location =>", err);
  }
}

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

  fetch("https://young-cute-neptune.glitch.me/logEvent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
    keepalive: true
  }).catch(err => console.error("Failed to log event:", err));
}

let sessionStartTime = Date.now();

window.addEventListener('beforeunload', () => {
  const sessionEndTime = Date.now();
  const sessionDurationMs = sessionEndTime - sessionStartTime;
  // Log an event
  logSessionEvent("session_end", { durationMs: sessionDurationMs });
  // Remove from localStorage
  localStorage.removeItem("pointsLensSessionId");
});

/*******************************************************
 * GLOBALS & DATA
 *******************************************************/
let loyaltyPrograms = {};
let realWorldUseCases = [];
let chosenPrograms = []; 
let isTransitioning = false; // prevent double transitions

// Pill data example
const pointsData = {
  "10000": {
    image: "...",
    title: "Example Title 1",
    description: "Example Desc 1"
  },
  // ...
};

// Stage images
const stageImages = {
  default:   "https://images.squarespace-cdn.com/content/...",
  input:     "https://images.squarespace-cdn.com/content/...",
  calc:      "https://images.squarespace-cdn.com/content/...",
  output:    "https://images.squarespace-cdn.com/content/...",
  usecase:   "https://images.squarespace-cdn.com/content/...",
  sendReport:"https://images.squarespace-cdn.com/content/..."
};

/*******************************************************
 * Basic Helper Functions
 *******************************************************/
function updateStageGraphic(stageKey) {
  $(".stage-graphic").attr("src", stageImages[stageKey]);
}

function hideAllStates() {
  $("#default-hero, #input-state, #calculator-state, #output-state, #usecase-state, #send-report-state, #submission-takeover, #how-it-works-state").hide();
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/*******************************************************
 * FETCH UTILS
 *******************************************************/
async function fetchWithTimeout(url, options = {}, timeout = 10000, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        return response;
      }
      if (attempt > maxRetries) {
        throw new Error(`Non-OK HTTP status: ${response.status}`);
      }
      console.log(`Retry #${attempt} after HTTP status: ${response.status} ...`);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        if (attempt > maxRetries) {
          throw new Error("Request timed out multiple times.");
        }
        console.log(`Timeout/AbortError. Retrying #${attempt}...`);
        await new Promise(r => setTimeout(r, 500));
      } else {
        if (attempt > maxRetries) {
          throw err;
        }
        console.log(`Network error: ${err.message}. Retrying #${attempt}...`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  throw new Error("Failed to fetch after maxRetries attempts.");
}

async function fetchAirtableTable(tableName) {
  const response = await fetchWithTimeout(
    `https://young-cute-neptune.glitch.me/fetchAirtableData?table=${tableName}`,
    {},
    10000,
    2
  );
  if (!response.ok) {
    throw new Error(`Non-OK status from Airtable proxy: ${response.status}`);
  }
  return await response.json();
}

/*******************************************************
 * INITIALIZE APP
 *******************************************************/
async function initializeApp() {
  console.log("=== initializeApp() CALLED ===");
  // 1) fetch points data
  try {
    const resp = await fetchWithTimeout(
      "https://young-cute-neptune.glitch.me/fetchPointsCalcData",
      {},
      10000
    );
    if (!resp.ok) {
      throw new Error("Network response not OK => " + resp.statusText);
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
    console.log("Loyalty Programs =>", loyaltyPrograms);
  } catch (err) {
    console.error("Error fetching Points Calc data:", err);
    return;
  }

  // 2) fetch Real-World Use Cases
  try {
    const useCasesData = await fetchAirtableTable("Real-World Use Cases");
    realWorldUseCases = useCasesData.reduce((acc, record) => {
      acc[record.id] = { id: record.id, ...record.fields };
      return acc;
    }, {});
    console.log("Real-World Use Cases =>", realWorldUseCases);
  } catch (err) {
    console.error("Error fetching Real-World Use Cases:", err);
  }

  // 3) Build 'Popular Programs'
  buildTopProgramsSection();
  console.log("=== All Data loaded, app is ready. ===");
}

/*******************************************************
 * BUILD TOP PROGRAMS
 *******************************************************/
function buildTopProgramsSection() {
  const container = document.getElementById("top-programs-grid");
  if (!container) return;

  const topRecords = Object.keys(loyaltyPrograms).filter(id => {
    return !!loyaltyPrograms[id]["Top Programs"];
  });

  let html = "";
  topRecords.forEach(rid => {
    const prog = loyaltyPrograms[rid];
    const name = prog["Program Name"] || "Unnamed Program";
    const logo = prog["Brand Logo URL"] || "";
    html += `
      <div class="top-program-box" data-record-id="${rid}">
        <div style="display: flex; align-items: center;">
          <img
            src="${logo}"
            alt="${name} Logo"
            class="top-program-logo"
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
 * FILTER PROGRAMS
 *******************************************************/
function filterPrograms() {
  if (!loyaltyPrograms || Object.keys(loyaltyPrograms).length === 0) {
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

  const results = Object.keys(loyaltyPrograms).filter(id => {
    const prog = loyaltyPrograms[id];
    if (!prog["Program Name"]) return false;
    const alreadyInCalc = $(`#program-container .program-row[data-record-id='${id}']`).length > 0;
    return prog["Program Name"].toLowerCase().includes(val) && !alreadyInCalc;
  });

  const limited = results.slice(0, 5);
  if (!limited.length) {
    $("#program-preview").hide().empty();
    return;
  }

  let previewHTML = "";
  limited.forEach(rid => {
    const prog = loyaltyPrograms[rid];
    const logo = prog["Brand Logo URL"] || "";
    const isChosen = chosenPrograms.includes(rid);
    const chosenClass = isChosen ? "chosen-state" : "";
    const logoHTML = logo
      ? `<img src="${logo}" alt="${prog["Program Name"]} logo" style="height:35px; object-fit:contain;">`
      : "";

    previewHTML += `
      <div class="preview-item ${chosenClass}" data-record-id="${rid}">
        <div>
          <span class="program-name">${prog["Program Name"]}</span>
          <span class="program-type">(${prog.Type || "Unknown"})</span>
        </div>
        ${logoHTML}
      </div>
    `;
  });
  $("#program-preview").html(previewHTML).show();
}

/*******************************************************
 * ADD PROGRAM ROW
 *******************************************************/
function addProgramRow(recordId) {
  const prog = loyaltyPrograms[recordId];
  if (!prog) return;

  const logo = prog["Brand Logo URL"] || "";
  const name = prog["Program Name"] || "Unnamed Program";

  const rowHTML = `
    <div class="program-row" data-record-id="${recordId}">
      <div class="program-left">
        ${logo ? `<img src="${logo}" alt="${name} logo" class="program-logo">` : ""}
        <span class="program-name">${name}</span>
      </div>
      <div class="program-right">
        <div class="dollar-input-container">
          <input
            type="text"
            class="points-input"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="Enter Total"
            oninput="formatNumberInput(this); calculateTotal()"
          />
        </div>
        <button class="remove-btn">×</button>
      </div>
    </div>
  `;
  $("#program-container").append(rowHTML);
  updateClearAllVisibility();
  calculateTotal();
}

/*******************************************************
 * UPDATE CHOSEN PROGRAMS DISPLAY
 *******************************************************/
function updateChosenProgramsDisplay() {
  const container = $("#chosen-programs-row");
  container.empty();
  if (chosenPrograms.length === 0) {
    $("#selected-programs-label").hide();
    return;
  }
  $("#selected-programs-label").show();

  chosenPrograms.forEach(rid => {
    const prog = loyaltyPrograms[rid];
    if (!prog) return;
    const logoUrl = prog["Brand Logo URL"] || "";
    const programName = prog["Program Name"] || "Unnamed Program";
    const logoHTML = `
      <div style="width:48px; height:48px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
        <img
          src="${logoUrl}"
          alt="${programName} logo"
          style="width:100%; height:auto; object-fit:contain;"
        />
      </div>
    `;
    container.append(logoHTML);
  });
}

/*******************************************************
 * TOGGLE SEARCH & POPULAR
 *******************************************************/
function toggleSearchItemSelection(itemEl) {
  const rid = itemEl.data("record-id");
  if (!rid) return;

  const idx = chosenPrograms.indexOf(rid);
  if (idx === -1) {
    chosenPrograms.push(rid);
    itemEl.addClass("selected-state");
    const box = $(`.top-program-box[data-record-id='${rid}']`);
    if (box.length) {
      box.addClass("selected-state");
      box.find(".add-btn").text("✓");
    }
    itemEl.remove();
  } else {
    chosenPrograms.splice(idx, 1);
    itemEl.removeClass("selected-state");
    const box = $(`.top-program-box[data-record-id='${rid}']`);
    if (box.length) {
      box.removeClass("selected-state");
      box.find(".add-btn").text("+");
    }
    itemEl.remove();
  }
  $("#program-search").val("");
  $("#program-preview").hide().empty();
  filterPrograms();
  updateNextCTAVisibility();
  updateChosenProgramsDisplay();
  updateClearAllVisibility();
}

function toggleProgramSelection(boxEl) {
  const rid = boxEl.data("record-id");
  if (!rid) return;

  const idx = chosenPrograms.indexOf(rid);
  if (idx === -1) {
    chosenPrograms.push(rid);
    boxEl.addClass("selected-state");
    boxEl.find(".add-btn").text("✓");
    const searchItem = $(`.preview-item[data-record-id='${rid}']`);
    if (searchItem.length) searchItem.remove();
  } else {
    chosenPrograms.splice(idx, 1);
    boxEl.removeClass("selected-state");
    boxEl.find(".add-btn").text("+");
    const searchItem = $(`.preview-item[data-record-id='${rid}']`);
    if (searchItem.length) searchItem.removeClass("selected-state");
  }
  $("#program-search").val("");
  $("#program-preview").hide().empty();
  filterPrograms();
  updateNextCTAVisibility();
  updateChosenProgramsDisplay();
  updateClearAllVisibility();
}

/*******************************************************
 * NEXT CTA VISIBILITY
 *******************************************************/
function updateNextCTAVisibility() {
  if (chosenPrograms.length > 0) {
    $("#input-next-btn").show();
  } else {
    $("#input-next-btn").hide();
  }
}

/*******************************************************
 * CLEAR ALL
 *******************************************************/
function updateClearAllVisibility() {
  if ($("#input-state").is(":visible")) {
    if (chosenPrograms.length >= 3) {
      $("#clear-all-btn").fadeIn();
    } else {
      $("#clear-all-btn").fadeOut();
    }
  }
  else if ($("#calculator-state").is(":visible")) {
    const rowCount = $("#program-container .program-row").length;
    if (rowCount >= 3) {
      $("#clear-all-btn").fadeIn();
    } else {
      $("#clear-all-btn").fadeOut();
    }
  } else {
    $("#clear-all-btn").fadeOut();
  }
}

function clearAllPrograms() {
  chosenPrograms = [];
  $(".top-program-box.selected-state").removeClass("selected-state").find(".add-btn").text("+");
  $(".preview-item.selected-state").removeClass("selected-state");
  updateChosenProgramsDisplay();
  $("#clear-all-btn").hide();
  updateNextCTAVisibility();
}

/*******************************************************
 * K) Transitions: Input => Calculator
 *******************************************************/
$("#input-next-btn").on("click", function() {
  if (isTransitioning) return;
  isTransitioning = true;
  hideAllStates();
  $("#calculator-state").fadeIn(() => {
    showCTAsForState("calculator");
    isTransitioning = false;
  });
  updateStageGraphic("calc");
  // Build rows from chosenPrograms
  $("#program-container").empty();
  chosenPrograms.forEach(rid => addProgramRow(rid));
});

/*******************************************************
 * L) FORMAT NUMBER
 *******************************************************/
function formatNumberInput(el) {
  let raw = el.value.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (!raw) {
    el.value = "";
    return;
  }
  let num = parseInt(raw, 10);
  if (num > 10000000) {
    num = 10000000;
  }
  el.value = num.toLocaleString();
}

/*******************************************************
 * M) CALCULATE TOTAL
 *******************************************************/
function calculateTotal() {
  let totalPoints = 0;
  $(".program-row").each(function() {
    const pStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
    totalPoints += parseInt(pStr, 10) || 0;
  });
}

/*******************************************************
 * GATHER PROGRAM DATA
 *******************************************************/
function gatherProgramData() {
  const data = [];
  $(".program-row").each(function() {
    const rid = $(this).data("record-id");
    const prog = loyaltyPrograms[rid];
    if (!prog) return;
    const pStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
    const points = parseFloat(pStr) || 0;
    data.push({
      recordId: rid,
      programName: prog["Program Name"] || "Unknown",
      points
    });
  });
  console.log("gatherProgramData =>", data);
  return data;
}

/*******************************************************
 * Show CTAs For State
 *******************************************************/
function showCTAsForState(state) {
  $("#get-started-btn, #input-next-btn, #to-output-btn, #unlock-report-btn, #usecase-next-btn, #send-report-next-btn, #explore-concierge-lower").hide();
  switch (state) {
    case "default":
      $("#get-started-btn").show();
      break;
    case "input":
      if (chosenPrograms.length > 0) {
        $("#input-next-btn").show();
      }
      break;
    case "calculator":
      $("#to-output-btn").show();
      break;
    case "output":
      $("#unlock-report-btn").show();
      $("#explore-concierge-lower").show();
      break;
    case "usecase":
      $("#usecase-next-btn").show();
      break;
    case "send-report":
      $("#send-report-next-btn").show();
      break;
  }
}

/*******************************************************
 * hide/showReportModal
 *******************************************************/
function hideReportModal() {
  $("#report-modal").fadeOut(300);
}
function showReportModal() {
  $("#report-modal").fadeIn(200);
  $("#modal-email-error").hide().text("");
  $("#email-sent-message").hide();
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
  const programsToSend = fullData.map(item => ({
    programName: item.programName,
    points: item.points
  }));
  console.log("Sending to server =>", { email, programs: programsToSend });

  const response = await fetch("https://young-cute-neptune.glitch.me/submitData", {
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

/*******************************************************
 * SEND REPORT FROM MODAL
 *******************************************************/
async function sendReportFromModal() {
  const emailInput = $("#modal-email-input").val().trim();
  const errorEl    = $("#modal-email-error");
  const sentMsgEl  = $("#email-sent-message");
  const sendBtn    = $("#modal-send-btn");

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
      $("#unlock-report-btn").removeClass("default-colors").addClass("swapped-colors");
      $("#explore-concierge-lower").removeClass("default-colors").addClass("swapped-colors");
    }, 700);
  } catch (err) {
    console.error("Failed to send report =>", err);
    errorEl.text(err.message || "Error sending report.").show();
  } finally {
    sendBtn.prop("disabled", false).text("Send Report");
  }
}

/*******************************************************
 * buildOutputRows => Show "Total Value"
 *******************************************************/
function buildOutputRows(viewType) {
  const data = gatherProgramData();
  $("#output-programs-list").empty();
  let totalValue = 0;

  data.forEach(item => {
    const prog = loyaltyPrograms[item.recordId];
    const logoUrl = prog?.["Brand Logo URL"] || "";
    const programName = item.programName;
    let rowValue = 0;
    if (viewType === "travel") {
      rowValue = item.points * (prog?.["Travel Value"] || 0);
    } else {
      rowValue = item.points * (prog?.["Cash Value"] || 0);
    }
    totalValue += rowValue;
    const formattedRowVal = `$${rowValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    let rowHtml = `
      <div class="output-row" data-record-id="${item.recordId}">
        <div class="output-left" style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${logoUrl}" alt="${programName} logo" class="output-logo" />
          <span class="program-name">${programName}</span>
        </div>
        <div class="output-value" style="font-weight:600;">
          ${formattedRowVal}
        </div>
      </div>
    `;
    if (viewType === "travel") {
      rowHtml += `
        <div class="usecase-accordion" style="display:none;">
          ${buildUseCaseAccordionContent(item.recordId, item.points)}
        </div>
      `;
    }
    $("#output-programs-list").append(rowHtml);
  });

  const formattedTotal = `$${totalValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  const label = (viewType === "travel") ? "Travel Value" : "Cash Value";

  $("#output-programs-list").append(`
    <div class="total-value-row" style="text-align:center; margin-top:1rem; font-weight:600;">
      ${label}: ${formattedTotal}
    </div>
  `);
}

/*******************************************************
 * buildUseCaseAccordionContent
 *******************************************************/
function buildUseCaseAccordionContent(recordId, userPoints) {
  // not changed => same as your existing logic
  return `<div style="padding:1rem;">No data found for now.</div>`;
}

/*******************************************************
 * transformUnlockButtonToResend
 *******************************************************/
function transformUnlockButtonToResend() {
  $("#unlock-report-btn").removeClass("default-colors").addClass("swapped-colors");
  $("#explore-concierge-lower").removeClass("default-colors").addClass("swapped-colors");
  $("#unlock-report-btn").text("Resend Report");
  $("#explore-concierge-lower").show();
}

/*******************************************************
 * DOC READY => attach listeners
 *******************************************************/
$(document).ready(async function() {
  logSessionEvent("session_load");
  await fetchClientIP();
  await fetchApproxLocationFromIP();
  await initializeApp();

  hideAllStates();
  $("#default-hero").show();
  updateStageGraphic("default");
  showCTAsForState("default");
  $("#program-preview").hide().empty(); // ensure hidden

  // “Get Started” in hero => same logic as the main #get-started-btn
  $("#get-started-btn-hero").on("click", function() {
    logSessionEvent("get_started_clicked_hero");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  // "How It Works" => show #how-it-works-state
  $("#how-it-works-btn").on("click", function() {
    logSessionEvent("how_it_works_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#how-it-works-state").fadeIn(() => {
      isTransitioning = false;
    });
  });

  // how it works => next/prev
  $("#hiw-next").on("click", function() {
    advanceHowItWorksStep(+1);
  });
  $("#hiw-prev").on("click", function() {
    advanceHowItWorksStep(-1);
  });

  // final "Get Started" in step #3 => route same place
  $("#hiw-final-cta").on("click", function() {
    logSessionEvent("hiw_finalcta_clicked");
    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  // older transitions & listeners:
  $("#get-started-btn").on("click", function() {
    // your existing default CTA in the footer
    logSessionEvent("get_started_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  $("#input-back-btn").on("click", function() {
    logSessionEvent("input_back_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#default-hero").fadeIn(() => {
      showCTAsForState("default");
      isTransitioning = false;
    });
    updateStageGraphic("default");
  });

  $("#calc-back-btn").on("click", function() {
    logSessionEvent("calculator_back_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  $("#to-output-btn").on("click", function() {
    logSessionEvent("calculator_next_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");
    // default to travel
    $(".toggle-btn").removeClass("active");
    $(".toggle-btn[data-view='travel']").addClass("active");
    buildOutputRows("travel");
  });

  $("#output-back-btn").on("click", function() {
    logSessionEvent("output_back_clicked");
    if (isTransitioning) return;
    isTransitioning = true;
    hideAllStates();
    $("#calculator-state").fadeIn(() => {
      showCTAsForState("calculator");
      isTransitioning = false;
    });
    updateStageGraphic("calc");
  });

  $("#unlock-report-btn").on("click", function() {
    logSessionEvent("unlock_report_clicked");
    showReportModal();
  });

  $("#modal-close-btn").on("click", function() {
    logSessionEvent("modal_close_clicked");
    hideReportModal();
  });

  $("#modal-send-btn").on("click", async function() {
    const emailInput = $("#modal-email-input").val().trim();
    logSessionEvent("modal_send_clicked", { email: emailInput });
    await sendReportFromModal();
  });

  // usecase => existing stuff
  $("#usecase-back-btn").on("click", function() {
    // ...
  });

  // “clear all” button
  $("#clear-all-btn").on("click", function() {
    logSessionEvent("clear_all_clicked");
    clearAllPrograms();
  });

  // program search => filter
  $("#program-search").on("input", filterPrograms);

  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      logSessionEvent("program_search_enter");
      $(".preview-item").click();
    }
  });

  // preview item => toggle
  $(document).on("click", ".preview-item", function() {
    const rid = $(this).data("record-id");
    const prog = loyaltyPrograms[rid];
    const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";
    logSessionEvent("program_preview_item_clicked", { recordId: rid, programName });
    toggleSearchItemSelection($(this));
    $("#program-preview").hide().empty();
  });

  // top program box => toggle
  $(document).on("click", ".top-program-box", function() {
    const rid = $(this).data("record-id");
    const prog = loyaltyPrograms[rid];
    const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";
    logSessionEvent("top_program_box_clicked", { recordId: rid, programName });
    toggleProgramSelection($(this));
  });

  // remove row => recalc
  $(document).on("click", ".remove-btn", function() {
    const rowEl = $(this).closest(".program-row");
    const rid = rowEl.data("record-id");
    logSessionEvent("program_remove_clicked", { recordId: rid });
    rowEl.remove();
    calculateTotal();
  });

  // toggle travel vs cash
  $(document).on("click", ".toggle-btn", function() {
    logSessionEvent("toggle_view_clicked", { newView: $(this).data("view") });
    $(".toggle-btn").removeClass("active");
    $(this).addClass("active");
    const viewType = $(this).data("view");
    buildOutputRows(viewType);
  });

  // clicking output-row => expand/collapse
  $(document).on("click", ".output-row", function() {
    const rid = $(this).data("record-id");
    const prog = loyaltyPrograms[rid];
    const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";
    logSessionEvent("output_row_clicked", { recordId: rid, programName });

    if ($(".toggle-btn[data-view='cash']").hasClass("active")) {
      return;
    }
    $(".usecase-accordion:visible").slideUp();
    const panel = $(this).next(".usecase-accordion");
    if (panel.is(":visible")) {
      panel.slideUp();
    } else {
      panel.slideDown();
    }
  });
});

/*******************************************************
 * ADVANCE HOW-IT-WORKS STEPS (3-step slideshow)
 *******************************************************/
function advanceHowItWorksStep(delta) {
  const steps = $(".hiw-step");
  // find which is visible
  let currentIndex = 0;
  steps.each(function(i) {
    if ($(this).is(":visible")) {
      currentIndex = i;
    }
  });
  const newIndex = currentIndex + delta;
  if (newIndex < 0 || newIndex >= steps.length) return; // out of range

  steps.hide();
  $(steps[newIndex]).show();
  // update bullet
  $(".hiw-bullet").removeClass("active");
  $(".hiw-bullet").eq(newIndex).addClass("active");
}
