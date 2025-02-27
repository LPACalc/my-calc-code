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

// You can now access this anywhere in calc.js
const sessionId = getOrCreateSessionId();
console.log("Session ID:", sessionId);

/*******************************************************
 * [NEW] FETCH CLIENT IP & LOG EVENTS
 *******************************************************/

// A variable to store the user’s IP address (optional)
let clientIP = null;

// Fetches IP from your Glitch server
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

/**
 * Log an event to your Glitch server’s /logEvent endpoint.
 * Include sessionId + clientIP so you can track usage.
 */
function logSessionEvent(eventName, payload = {}) {
  const eventData = {
    sessionId,
    clientIP,
    eventName,
    timestamp: Date.now(),
    ...payload
  };

  fetch("https://young-cute-neptune.glitch.me/logEvent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
    // keepalive helps in some browsers when user navigates away quickly
    keepalive: true
  }).catch(err => console.error("Failed to log event:", err));
}

let sessionStartTime = Date.now();

window.addEventListener('beforeunload', () => {
  const sessionEndTime = Date.now();
  const sessionDurationMs = sessionEndTime - sessionStartTime;

  // Log an event with the duration
  logSessionEvent("session_end", { durationMs: sessionDurationMs });
});


/*******************************************************
 * A) GLOBAL VARIABLES & DATA
 *******************************************************/
let loyaltyPrograms = {};
let realWorldUseCases = [];
let chosenPrograms = []; 

// Prevent double-click transitions
let isTransitioning = false;

// Track if user has already sent a report
let hasSentReport = false;

// Static pill data for your #points-showcase
const pointsData = {
  "10000": {
    image: "https://www.point.me/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fbertrand-bouchez-Xjd9vc3vwik-unsplash.c121795b.jpg&w=640&q=75",
    title: "Zak's Caribbean getaway",
    description: "Zak had only earned a handful of points so far and wasn't sure how he could use them! He found round-trip economy flights to the Bahamas for just 10,000 points per person."
  },
  "40000": {
    image: "https://www.point.me/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Ftomas-malik-VF8P5iTbKQg-unsplash.1c5d3ce2.jpg&w=640&q=75",
    title: "Marisa's Moroccan adventure",
    description: "Marisa planned the perfect girl's trip to Morocco, starting with easy economy flights for 40,000 points round-trip."
  },
  "80000": {
    image: "https://www.point.me/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Ffarsai-chaikulngamdee-oZSDI44GwKU-unsplash.0eef42b6.jpg&w=640&q=75",
    title: "Tara's European honeymoon",
    description: "Tara earned points for eligible wedding purchases. By utilizing a bonus, she flew to Paris and returned from Rome in flat-bed business class seats for just 80,000 points each."
  },
  "140000": {
    image: "https://www.point.me/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhu-chen-0LwfbRtQ-ac-unsplash.b4375fe0.jpg&w=640&q=75",
    title: "Daniel's luxury safari",
    description: "Daniel wanted to indulge in caviar and champagne in first class. A well-timed points transfer got him a Cathay Pacific first class seat for 140,000 points."
  }
};

// Stage graphic images
const stageImages = {
  default:   "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/af0bbfc5-9892-4487-a87d-5fd185a47819/unnamed+%284%29.png",
  input:     "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/5474cde0-06cb-4afb-9c99-2cdf9d136a17/unnamed+%281%29.png",
  calc:      "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/6f6b427d-c6c7-4284-b86e-06132fb5dd51/unnamed.gif",
  output:    "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/ab18a97d-fe5e-4d0c-9c27-67d36e13a11e/unnamed+%281%29+copy.png",
  usecase:   "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/0f4cf2b3-b35f-41b4-a0a7-6f240604617f/unnamed+%281%29.gif",
  sendReport:"https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/6f6b427d-c6c7-4284-b86e-06132fb5dd51/unnamed.gif"
};

/*******************************************************
 * Basic Helper Functions
 *******************************************************/
function updateStageGraphic(stageKey) {
  $(".stage-graphic").attr("src", stageImages[stageKey]);
}

function hideAllStates() {
  $("#default-hero, #input-state, #calculator-state, #output-state, #usecase-state, #send-report-state, #submission-takeover").hide();
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/*******************************************************
 * B) FETCH & DATA-RELATED UTILITIES
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
 * C) INITIALIZE APP => loads data
 *******************************************************/
async function initializeApp() {
  console.log("=== initializeApp() CALLED ===");

  // 1) Fetch Points Calculator Data
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
    return; // stop if fails
  }

  // 2) Fetch Real-World Use Cases
  try {
    const useCasesData = await fetchAirtableTable("Real-World Use Cases", 3, 2000);
    realWorldUseCases = useCasesData.reduce((acc, record) => {
      acc[record.id] = { id: record.id, ...record.fields };
      return acc;
    }, {});
    console.log("Real-World Use Cases =>", realWorldUseCases);

  } catch (err) {
    console.error("Error fetching Real-World Use Cases:", err);
  }

  // 3) Build the 'Popular Programs' grid
  buildTopProgramsSection();
  console.log("=== All Data loaded, app is ready. ===");
}

/*******************************************************
 * D) BUILD TOP PROGRAMS SECTION
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
 * E) FILTER / PREVIEW
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
    const alreadyInCalc = $(
      `#program-container .program-row[data-record-id='${id}']`
    ).length > 0;

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
 * F) ADD PROGRAM ROW
 *******************************************************/
function addProgramRow(recordId) {
  const prog = loyaltyPrograms[recordId];
  if (!prog) return;

  // Hide hero, show calc state
  $("#default-hero").hide();
  $("#calculator-state").fadeIn();

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
 * G) UPDATE CHOSEN PROGRAMS DISPLAY
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
 * H) TOGGLE SEARCH & POPULAR
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
 * I) NEXT CTA VISIBILITY
 *******************************************************/
function updateNextCTAVisibility() {
  if (chosenPrograms.length > 0) {
    $("#input-next-btn").show();
  } else {
    $("#input-next-btn").hide();
  }
}

/*******************************************************
 * J) CLEAR ALL
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
 * K) INPUT => CALCULATOR
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
  // purely optional
  let totalPoints = 0;
  $(".program-row").each(function() {
    const pStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
    totalPoints += parseInt(pStr, 10) || 0;
  });
}

/*******************************************************
 * N) GATHER PROGRAM DATA
 *******************************************************/
function gatherProgramData() {
  const data = [];
  $(".program-row").each(function() {
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
 * Q) NAVY SHOWCASE => INIT STATIC PILLS
 *******************************************************/
function initNavyShowcase() {
  const pills = document.querySelectorAll("#static-pills .point-option");
  const img   = document.getElementById("useCaseImage");
  const ttl   = document.getElementById("useCaseTitle");
  const body  = document.getElementById("useCaseBody");

  function updateStaticView(k) {
    const pd = pointsData[k];
    if (!pd) return;
    img.src         = pd.image;
    ttl.textContent = pd.title;
    body.textContent= pd.description;
  }

  pills.forEach(p => {
    p.addEventListener("click", function() {
      pills.forEach(pp => pp.classList.remove("active"));
      this.classList.add("active");
      updateStaticView(this.getAttribute("data-points"));
    });
  });

  // default
  updateStaticView("10000");
  if (pills[0]) pills[0].classList.add("active");
}

/*******************************************************
 * R) SEND REPORT
 *******************************************************/
async function sendReport(email) {
  if (!email) return;
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  // gather minimal data: {programName, points}
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
 * R2) SEND REPORT FROM MODAL
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

    // fade out after 0.7s
    setTimeout(() => {
      hideReportModal();
      sentMsgEl.hide();

      // Swap button colors
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
 * transformUnlockButtonToResend
 *******************************************************/
function transformUnlockButtonToResend() {
  const unlockBtn    = $("#unlock-report-btn");
  const conciergeBtn = $("#explore-concierge-lower");

  unlockBtn.removeClass("default-colors").addClass("swapped-colors");
  conciergeBtn.removeClass("default-colors").addClass("swapped-colors");

  unlockBtn.text("Resend Report");
  conciergeBtn.show();
}

/*******************************************************
 * T) BUILD USE CASE ACCORDION => Per-Program
 *******************************************************/
function buildUseCaseAccordionContent(recordId, userPoints) {
  const program = loyaltyPrograms[recordId];
  if (!program) {
    return `<div style="padding:1rem;">No data found.</div>`;
  }

  let matchingUseCases = Object.values(realWorldUseCases).filter(uc => {
    if (!uc.Recommended) return false;
    if (!uc["Points Required"]) return false;
    if (!uc["Use Case Title"]) return false;
    if (!uc["Use Case Body"])  return false;
    const linked = uc["Program Name"] || [];
    const userHasEnoughPoints = (uc["Points Required"] <= userPoints);
    return linked.includes(recordId) && userHasEnoughPoints;
  });

  matchingUseCases.sort((a, b) => {
    const aP = a["Points Required"] || 0;
    const bP = b["Points Required"] || 0;
    return aP - bP;
  });
  matchingUseCases = matchingUseCases.slice(0, 4);

  if (!matchingUseCases.length) {
    return `<div style="padding:1rem;">No recommended use cases found for your points.</div>`;
  }

  let pillsHTML = "";
  matchingUseCases.forEach((uc, i) => {
    const ptsReq = uc["Points Required"] || 0;
    const activeClass = (i === 0) ? "active" : "";
    pillsHTML += `
      <div class="mini-pill ${activeClass}" data-usecase-id="${uc.id}">
        ${ptsReq.toLocaleString()} pts
      </div>
    `;
  });

  const first = matchingUseCases[0];
  const imageURL = first["Use Case URL"]  || "";
  const title    = first["Use Case Title"] || "Untitled";
  const body     = first["Use Case Body"]  || "No description";

  return `
    <div class="usecases-panel" style="display:flex; flex-direction:column; gap:1rem;">
      <div
        class="pills-container"
        style="display:flex; flex-wrap:wrap; justify-content:center; gap:1rem;"
      >
        ${pillsHTML}
      </div>
      <div class="usecase-details" style="display:flex; gap:1rem; flex-wrap:nowrap;">
        <div class="image-wrap" style="max-width:180px;">
          <img
            src="${imageURL}"
            alt="Use Case"
            style="width:100%; height:auto; border-radius:4px;"
          />
        </div>
        <div class="text-wrap" style="flex:1;">
          <h4 
            class="uc-title"
            style="font-size:16px; margin:0 0 0.5rem; color:#1a2732;"
          >
            ${title}
          </h4>
          <p
            class="uc-body"
            style="font-size:14px; line-height:1.4; color:#555; margin:0;"
          >
            ${body}
          </p>
        </div>
      </div>
    </div>
  `;
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
 * hideReportModal / showReportModal
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
 * DOCUMENT READY
 *******************************************************/
$(document).ready(async function() {

  // [NEW] Fetch IP before initialization (optional)
  await fetchClientIP();

  /*******************************************************
   * 1) INITIALIZE
   *******************************************************/
  initNavyShowcase();
  await initializeApp().catch(err => console.error("initializeApp error =>", err));

  hideAllStates();
  $("#default-hero").show();
  updateStageGraphic("default");
  showCTAsForState("default");

  /*******************************************************
   * 2) TRANSITIONS: BACK & NEXT
   *******************************************************/
  // (A) “Get Started” => Input
  $("#get-started-btn").on("click", function() {
    // [NEW] log event
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

  // (B) “Input -> Back” => show default hero
  $("#input-back-btn").on("click", function() {
    // [NEW] log event
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

  // (C) “Input -> Next” => Calculator
  $("#input-next-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("input_next_clicked");

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
    chosenPrograms.forEach(recordId => addProgramRow(recordId));
  });

  // (D) “Calculator -> Back” => Input
  $("#calc-back-btn").on("click", function() {
    // [NEW] log event
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

  // (E) “Calculator -> Next” => Output
  $("#to-output-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("calculator_next_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");

    // Default to Travel
    $(".toggle-btn").removeClass("active");
    $(".toggle-btn[data-view='travel']").addClass("active");
    buildOutputRows("travel");
  });

  // (F) “Output -> Back” => Calculator
  $("#output-back-btn").on("click", function() {
    // [NEW] log event
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

  // (G) “Unlock” => open modal
  $("#unlock-report-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("unlock_report_clicked");

    showReportModal();
  });

  // (H) “Usecase -> Back” => Output
  $("#usecase-back-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("usecase_back_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");
  });

  // (I) “Usecase -> Next” => Send-Report
  $("#usecase-next-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("usecase_next_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#send-report-state").fadeIn(() => {
      showCTAsForState("sendReport");
      isTransitioning = false;
    });
    updateStageGraphic("sendReport");
  });

  // (J) “Send-Report -> Back” => Usecase
  $("#send-report-back-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("send_report_back_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#usecase-state").fadeIn(() => {
      showCTAsForState("usecase");
      isTransitioning = false;
    });
    updateStageGraphic("usecase");
  });

  // (K) “Send-Report -> Next” => Submission
  $("#send-report-next-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("send_report_next_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#submission-takeover").fadeIn(() => {
      isTransitioning = false;
    });
  });

  // (L) “Go Back” in Submission => Output
  $("#go-back-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("submission_back_clicked");

    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");
  });

  // (M) Explore Concierge => external link
  $("#explore-concierge-btn, #explore-concierge-lower").on("click", function() {
    // [NEW] log event
    logSessionEvent("explore_concierge_clicked");

    window.open("https://www.legacypointsadvisors.com/pricing", "_blank");
  });

  // (N) Modal close (X)
  $("#modal-close-btn").on("click", function() {
    // [NEW] log event
    logSessionEvent("modal_close_clicked");

    hideReportModal();
  });

  // (O) Modal send
  $("#modal-send-btn").on("click", async function() {
    // [NEW] log event
    logSessionEvent("modal_send_clicked");

    await sendReportFromModal();
  });

  /*******************************************************
   * 3) OTHER LISTENERS (Search, Program Toggling, Pills)
   *******************************************************/
  // Program search => filter
  $("#program-search").on("input", filterPrograms);

  // If user presses Enter & only one => auto-add
  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      logSessionEvent("program_search_enter"); // [NEW] optional
      $(".preview-item").click();
    }
  });

  // Preview item => toggle
  $(document).on("click", ".preview-item", function() {
    logSessionEvent("program_preview_item_clicked", {

       // Look up the program data from your front-end dictionary
  const prog = loyaltyPrograms[rid];
  const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";

  // Now log the programName instead of recordId
  logSessionEvent("top_program_box_clicked", {
    programName: programName 
  });
    });
    toggleSearchItemSelection($(this));
    $("#program-preview").hide().empty();
  });

  // Top Program Box => toggle
  $(document).on("click", ".top-program-box", function() {
    logSessionEvent("top_program_box_clicked", {

       // Look up the program data from your front-end dictionary
  const prog = loyaltyPrograms[rid];
  const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";

  // Now log the programName instead of recordId
  logSessionEvent("top_program_box_clicked", {
    programName: programName 
  });
    });
    toggleProgramSelection($(this));
  });

  // Remove row => recalc
  $(document).on("click", ".remove-btn", function() {
    logSessionEvent("program_remove_clicked", {
      recordId: $(this).closest(".program-row").data("record-id")
    });
    $(this).closest(".program-row").remove();
    calculateTotal();
  });

  // Toggle Travel vs Cash
  $(document).on("click", ".toggle-btn", function() {
    logSessionEvent("toggle_view_clicked", {
      newView: $(this).data("view")
    });
    $(".toggle-btn").removeClass("active");
    $(this).addClass("active");
    const viewType = $(this).data("view");
    buildOutputRows(viewType);
  });

  // Clicking output-row => expand/collapse usecase (travel only)
  $(document).on("click", ".output-row", function() {
    logSessionEvent("output_row_clicked", {
      recordId: $(this).data("record-id")

       // Look up the program data from your front-end dictionary
  const prog = loyaltyPrograms[rid];
  const programName = prog ? (prog["Program Name"] || "Unknown") : "N/A";

  // Now log the programName instead of recordId
  logSessionEvent("top_program_box_clicked", {
    programName: programName 
  });
    });

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

  // (NEW) mini-pill => load that use case
  $(document).on("click", ".mini-pill", function() {
    logSessionEvent("mini_pill_clicked", {
      useCaseId: $(this).data("usecaseId")
    });

    $(this).siblings(".mini-pill").removeClass("active");
    $(this).addClass("active");

    const useCaseId = $(this).data("usecaseId");
    if (!useCaseId) return;

    const uc = realWorldUseCases[useCaseId];
    if (!uc) return;

    const container = $(this).closest(".usecases-panel");
    container.find(".uc-title").text(uc["Use Case Title"] || "Untitled");
    container.find(".uc-body").text(uc["Use Case Body"] || "");
    container.find("img").attr("src", uc["Use Case URL"] || "");
  });
});

$(document).on("click", "#clear-all-btn", function() {
  // [NEW] log event
  logSessionEvent("clear_all_clicked");

  clearAllPrograms();
});


/*******************************************************
 * U) buildOutputRows => Show "Total Value"
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
