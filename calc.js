"use strict";

/*******************************************************
 * A) GLOBAL VARIABLES & DATA
 *******************************************************/
let loyaltyPrograms = {};
let realWorldUseCases = [];
let chosenPrograms = []; // array of recordIds that user has selected

// Transition lock to prevent double-click issues
let isTransitioning = false;

// Static pill data for your #points-showcase (Use Case State)
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

// Stage graphic images for left column
const stageImages = {
  default: "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/af0bbfc5-9892-4487-a87d-5fd185a47819/unnamed+%284%29.png",
  input:   "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/5474cde0-06cb-4afb-9c99-2cdf9d136a17/unnamed+%281%29.png",
  calc:    "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/6f6b427d-c6c7-4284-b86e-06132fb5dd51/unnamed.gif",
  output:  "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/ab18a97d-fe5e-4d0c-9c27-67d36e13a11e/unnamed+%281%29+copy.png",
  usecase: "https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/0f4cf2b3-b35f-41b4-a0a7-6f240604617f/unnamed+%281%29.gif"
};

/*******************************************************
 * Basic Helper Functions
 *******************************************************/
function showSubmissionTakeover() {
  document.getElementById("submission-takeover").style.display = "flex";
}
function closeSubmissionTakeover() {
  document.getElementById("submission-takeover").style.display = "none";
}
function updateStageGraphic(stageKey) {
  $(".stage-graphic").attr("src", stageImages[stageKey]);
}

// NEW: Show and Hide the Report Modal
function showReportModal() {
  $("#report-modal").fadeIn(200);
}
function hideReportModal() {
  $("#report-modal").fadeOut(200);
}

/*******************************************************
 * B) FETCH & DATA-RELATED UTILITIES
 *******************************************************/

/**
 * fetchWithTimeout => basic fetch wrapper with timeouts and built-in retry logic.
 * @param {string} url           The endpoint or resource to fetch
 * @param {object} options       Fetch options (headers, method, etc.)
 * @param {number} timeout       Milliseconds before we abort this request
 * @param {number} maxRetries    Number of times to retry on timeout/HTTP error
 */
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

      // If we get an OK response, return it
      if (response.ok) {
        return response;
      }

      // Otherwise, try again or throw an error if out of retries
      if (attempt > maxRetries) {
        throw new Error(`Non-OK HTTP status: ${response.status}`);
      }
      console.log(`Retry #${attempt} after HTTP status: ${response.status} ...`);
      await new Promise(res => setTimeout(res, 500)); // small delay before retry

    } catch (err) {
      clearTimeout(timeoutId);

      // If we aborted due to timeout => err.name === "AbortError"
      if (err.name === "AbortError") {
        if (attempt > maxRetries) {
          throw new Error("Request timed out multiple times.");
        }
        console.log(`Timeout/AbortError. Retrying #${attempt}...`);
        await new Promise(res => setTimeout(res, 500)); // small delay
      } else {
        // Other network errors
        if (attempt > maxRetries) {
          throw err; // throw if out of retries
        }
        console.log(`Network error: ${err.message}. Retrying #${attempt}...`);
        await new Promise(res => setTimeout(res, 500)); // small delay
      }
    }
  }

  // If we exit the loop, we've exhausted retries
  throw new Error("Failed to fetch after maxRetries attempts.");
}

/**
 * fetchAirtableTable => fetch data from an Airtable proxy using our
 * fetchWithTimeout method. We rely on fetchWithTimeout’s retry logic,
 * so no extra loop is needed here.
 */
async function fetchAirtableTable(tableName) {
  // Adjust timeout or maxRetries if needed
  const response = await fetchWithTimeout(
    `https://young-cute-neptune.glitch.me/fetchAirtableData?table=${tableName}`,
    {},
    10000,   // e.g. 10s timeout
    2        // e.g. up to 2 retries
  );

  if (!response.ok) {
    throw new Error(`Non-OK status from Airtable proxy: ${response.status}`);
  }

  const data = await response.json();
  return data;
}


/*******************************************************
 * C) INITIALIZE APP => loads all data
 *******************************************************/
async function initializeApp() {
  console.log("=== initializeApp() CALLED ===");

  // 1) Fetch Points Calculator Data
  try {
    const response = await fetchWithTimeout(
      "https://young-cute-neptune.glitch.me/fetchPointsCalcData",
      {},
      10000
    );
    if (!response.ok) {
      throw new Error("Network response not OK => " + response.statusText);
    }

    const programsData = await response.json();
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
    console.error("Error fetching Points Calculator data:", err);
    return; // Stop if this fails
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

  // Filter top programs
  const topRecords = Object.keys(loyaltyPrograms).filter(recordId => {
    const prog = loyaltyPrograms[recordId];
    return !!prog["Top Programs"];
  });

  let html = "";
  topRecords.forEach(recordId => {
    const program = loyaltyPrograms[recordId];
    const programName = program["Program Name"] || "Unnamed Program";
    const logoUrl = program["Brand Logo URL"] || "";

    html += `
      <div class="top-program-box" data-record-id="${recordId}">
        <div style="display: flex; align-items: center;">
          <img
            src="${logoUrl}"
            alt="${programName} Logo"
            class="top-program-logo"
          />
          <span class="top-program-label">${programName}</span>
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

  const searchValue = $("#program-search").val().toLowerCase().trim();
  if (!searchValue) {
    $("#program-preview").hide().empty();
    return;
  }

  const filtered = Object.keys(loyaltyPrograms).filter(recordId => {
    const program = loyaltyPrograms[recordId];
    if (!program || !program["Program Name"]) return false;
    // If it’s already added:
    const alreadyAdded = $(
      `#program-container .program-row[data-record-id='${recordId}']`
    ).length > 0;

    return (
      program["Program Name"].toLowerCase().includes(searchValue) &&
      !alreadyAdded
    );
  });

  const limited = filtered.slice(0, 5);
  if (!limited.length) {
    $("#program-preview").hide().empty();
    return;
  }

  let previewHTML = "";
  limited.forEach(recordId => {
    const program = loyaltyPrograms[recordId];
    const logoURL = program["Brand Logo URL"] || "";
    const isChosen = chosenPrograms.includes(recordId);

    const chosenClass = isChosen ? "chosen-state" : "";
    const logoHTML = logoURL
      ? `<img src="${logoURL}" alt="${program["Program Name"]} logo" style="height:35px; object-fit:contain;">`
      : "";

    previewHTML += `
      <div class="preview-item ${chosenClass}" data-record-id="${recordId}">
        <div>
          <span class="program-name">${program["Program Name"]}</span>
          <span class="program-type">(${program.Type || "Unknown"})</span>
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
  console.log(`addProgramRow => recordId=${recordId}`);
  const program = loyaltyPrograms[recordId];
  if (!program) return;

  // Hide hero, show calc
  $("#default-hero").hide();
  $("#started-state").show();
  $("#started-empty-state").hide();
  $("#started-how-to").hide();
  $("#calculator-state").fadeIn();

  $("#program-search").val("");

  const logoHTML = program["Brand Logo URL"]
    ? `<img src="${program["Brand Logo URL"]}" alt="${program["Program Name"]} logo" class="program-logo">`
    : "";

  const rowHTML = `
    <div class="program-row" data-record-id="${recordId}">
      <div class="program-left">
        ${logoHTML}
        <span class="program-name">${program["Program Name"] || 'Unnamed Program'}</span>
      </div>
      <div class="program-right">
        <div class="dollar-input-container">
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="points-input"
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

  chosenPrograms.forEach(recordId => {
    const program = loyaltyPrograms[recordId];
    if (!program) return;

    const logoUrl = program["Brand Logo URL"] || "";
    const programName = program["Program Name"] || "Unnamed Program";

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
  const recordId = itemEl.data("record-id");
  if (!recordId) return;

  const index = chosenPrograms.indexOf(recordId);
  if (index === -1) {
    chosenPrograms.push(recordId);
    itemEl.addClass("selected-state");

    // Also sync top-program if present
    const matchingBox = $(`.top-program-box[data-record-id='${recordId}']`);
    if (matchingBox.length) {
      matchingBox.addClass("selected-state");
      matchingBox.find(".add-btn").text("✓");
    }
    itemEl.remove();
  } else {
    chosenPrograms.splice(index, 1);
    itemEl.removeClass("selected-state");

    const matchingBox = $(`.top-program-box[data-record-id='${recordId}']`);
    if (matchingBox.length) {
      matchingBox.removeClass("selected-state");
      matchingBox.find(".add-btn").text("+");
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
  const recordId = boxEl.data("record-id");
  if (!recordId) return;

  const index = chosenPrograms.indexOf(recordId);
  if (index === -1) {
    chosenPrograms.push(recordId);
    boxEl.addClass("selected-state");
    boxEl.find(".add-btn").text("✓");

    // Remove from search preview if present
    const matchingSearch = $(`.preview-item[data-record-id='${recordId}']`);
    if (matchingSearch.length) matchingSearch.remove();
  } else {
    chosenPrograms.splice(index, 1);
    boxEl.removeClass("selected-state");
    boxEl.find(".add-btn").text("+");

    const matchingSearch = $(`.preview-item[data-record-id='${recordId}']`);
    if (matchingSearch.length) matchingSearch.removeClass("selected-state");
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
  chosenPrograms.forEach(recordId => addProgramRow(recordId));
});

/*******************************************************
 * L) FORMAT NUMBER
 *******************************************************/
function formatNumberInput(el) {
  let rawValue = el.value.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (!rawValue) {
    el.value = "";
    return;
  }
  let numericValue = parseInt(rawValue, 10);
  if (numericValue > 10000000) {
    numericValue = 10000000;
  }
  el.value = numericValue.toLocaleString();
}

/*******************************************************
 * M) CALCULATE TOTAL
 *******************************************************/
function calculateTotal() {
  let totalTravel = 0;
  let totalCash = 0;
  let totalPoints = 0;

  const rows = $(".program-row");
  rows.each(function() {
    const recordId = $(this).data("record-id");
    const program = loyaltyPrograms[recordId];
    if (!program) return;

    const pointsStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
    const points = parseFloat(pointsStr) || 0;
    totalPoints += points;

    const travelRate = program["Travel Value"] || 0;
    const cashRate   = program["Cash Value"]   || 0;
    const rowTravel  = points * travelRate;
    const rowCash    = points * cashRate;

    totalTravel += rowTravel;
    totalCash   += rowCash;
  });
  // If no rows => revert to started-state (optional)
}

/*******************************************************
 * N) GATHER PROGRAM DATA
 *******************************************************/
function gatherProgramData() {
  const data = [];
  $(".program-row").each(function() {
    const recordId = $(this).data("record-id");
    const program = loyaltyPrograms[recordId];
    if (!program) return;

    const pointsStr = $(this)
      .find(".points-input")
      .val()
      .replace(/,/g, "") || "0";
    const points = parseFloat(pointsStr) || 0;

    const travelRate = program["Travel Value"] || 0;
    const cashRate   = program["Cash Value"]   || 0;
    const travelValue = points * travelRate;
    const cashValue   = points * cashRate;

    data.push({
      recordId,
      programName: program["Program Name"] || "Unknown",
      points,
      travelValue,
      cashValue
    });
  });
  return data;
}

/*******************************************************
 * O) BUILD USE CASE SHOWCASE (#usecase-state)
 *******************************************************/
// (Your existing logic)...

/*******************************************************
 * P) SHOW USE CASE DETAILS (#usecase-state)
 *******************************************************/
// (Your existing logic)...

/*******************************************************
 * Q) NAVY SHOWCASE => INIT STATIC PILLS
 *******************************************************/
function initNavyShowcase() {
  const staticPills = document.querySelectorAll("#static-pills .point-option");
  const pointsImage = document.getElementById("useCaseImage");
  const pointsTitle = document.getElementById("useCaseTitle");
  const pointsDesc  = document.getElementById("useCaseBody");

  function updateStaticView(pointsKey) {
    const data = pointsData[pointsKey];
    if (!data) return;
    pointsImage.src        = data.image;
    pointsTitle.textContent= data.title;
    pointsDesc.textContent = data.description;
  }

  staticPills.forEach(pill => {
    pill.addEventListener("click", function() {
      staticPills.forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      updateStaticView(this.getAttribute("data-points"));
    });
  });

  // Default => 10k
  updateStaticView("10000");
  if (staticPills[0]) staticPills[0].classList.add("active");
}

/*******************************************************
 * R) SEND REPORT (existing logic)
 *******************************************************/
/**
 * This is the old function you had. We can keep it if you want
 * for certain flows. But the new modal will use a custom function
 * that re-uses the same submission logic but pulls email from the
 * modal input. You could unify them if you like.
 */
async function sendReport(email) {
  // If no email was passed, bail
  if (!email) return;

  // Validate
  if (!isValidEmail(email)) {
    // We'll handle showing errors in the new function
    throw new Error("Invalid email format");
  }

  // Gather data
  const programs = gatherProgramData();
  let totalTravel = 0;
  let totalCash = 0;
  programs.forEach(item => {
    totalTravel += item.travelValue;
    totalCash += item.cashValue;
  });

  // Post data
  const response = await fetch("https://young-cute-neptune.glitch.me/submitData", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      totalTravelValue: totalTravel,
      totalCashValue: totalCash,
      programs
    })
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  // If OK => done
  return true;
}

// Helper: quick email validator
function isValidEmail(str) {
  // A basic approach
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/*******************************************************
 * R2) SEND REPORT FROM MODAL
 *   - Reuses your "sendReport" logic, but toggles UI
 *******************************************************/
async function sendReportFromModal() {
  const emailInput = $("#modal-email-input").val().trim();
  const errorEl    = $("#modal-email-error");
  const sentMsgEl  = $("#email-sent-message");
  const sendBtn    = $("#modal-send-btn");

  // Clear any old errors
  errorEl.hide().text("");
  sentMsgEl.hide();
  
  // Basic validation
  if (!isValidEmail(emailInput)) {
    errorEl.text("Invalid email address.").show();
    return;
  }

  // Lock the button
  sendBtn.prop("disabled", true).text("Sending...");

  try {
    await sendReport(emailInput);

    // If success, show "Email Sent" message
    sentMsgEl.show();

    // Mark that the user has sent at least one report
    hasSentReport = true;

    // After 1.5-2 seconds, close the modal
    setTimeout(() => {
      hideReportModal();
      sentMsgEl.hide();
      // Update the UI in the sticky footer
      transformUnlockButtonToResend();
    }, 2000);

  } catch (err) {
    console.error("Failed to send report =>", err);
    errorEl.text(err.message || "Error sending report.").show();

  } finally {
    // Re-enable button
    sendBtn.prop("disabled", false).text("Send Report");
  }
}

/**
 * transformUnlockButtonToResend => once we've sent the email,
 * we rename the Unlock button to "Resend Report" with no background
 * and display the "Explore Concierge Services" button.
 */
function transformUnlockButtonToResend() {
  const unlockBtn = $("#unlock-report-btn");
  const conciergeBtn = $("#explore-concierge-lower");

  // If it's the first time, hide the icon and remove background
  unlockBtn.html("Resend Report");
  // Make it appear more like a text link (no background)
  unlockBtn.css({
    background: "none",
    "background-color": "transparent",
    "border": "none",
    color: "#1a2732",
    "font-weight": "600"
  });

  // Show the new "Explore Concierge Services" button
  conciergeBtn.show();
}

/*******************************************************
 * T) BUILD USE CASE ACCORDION => Per-Program
 *   - Only recommended
 *   - Up to 4
 *   - Sort by ascending Points Required
 *   - First is default "active"
 *   - Show only if userPoints >= Points Required
 *   - Center pills
 *   - Skip any incomplete/no-content use case
 *******************************************************/
function buildUseCaseAccordionContent(recordId, userPoints) {
  const program = loyaltyPrograms[recordId];
  if (!program) {
    return `<div style="padding:1rem;">No data found.</div>`;
  }

  // 1) Filter: must be recommended, linked to this recordId,
  //    have required fields, and require <= userPoints
  let matchingUseCases = Object.values(realWorldUseCases).filter(uc => {
    if (!uc.Recommended) return false;
    if (!uc["Points Required"]) return false;           // skip if missing points
    if (!uc["Use Case Title"]) return false;            // skip if missing title
    if (!uc["Use Case Body"])  return false;            // skip if missing body
    const linked = uc["Program Name"] || [];
    const userHasEnoughPoints = (uc["Points Required"] <= userPoints);
    return linked.includes(recordId) && userHasEnoughPoints;
  });

  // 2) Sort ascending by Points Required
  matchingUseCases.sort((a, b) => {
    const aPoints = a["Points Required"] || 0;
    const bPoints = b["Points Required"] || 0;
    return aPoints - bPoints;
  });

  // 3) Show up to 4
  matchingUseCases = matchingUseCases.slice(0, 4);

  // If none left, display fallback message
  if (!matchingUseCases.length) {
    return `<div style="padding:1rem;">No recommended use cases found for your points.</div>`;
  }

  // Build pills (first pill is active by default)
  let pillsHTML = "";
  matchingUseCases.forEach((uc, index) => {
    const pointsReq   = uc["Points Required"] || 0;
    const activeClass = (index === 0) ? "active" : "";
    pillsHTML += `
      <div class="mini-pill ${activeClass}" data-usecase-id="${uc.id}">
        ${pointsReq.toLocaleString()} pts
      </div>
    `;
  });

  // Show the first use case's details by default
  const first = matchingUseCases[0];
  const imageURL = first["Use Case URL"]  || "";
  const title    = first["Use Case Title"] || "Untitled";
  const body     = first["Use Case Body"]  || "No description";

  return `
    <div class="usecases-panel" style="display:flex; flex-direction:column; gap:1rem;">
      <!-- Pills row => centered with even spacing -->
      <div
        class="pills-container"
        style="
          display:flex;
          flex-wrap:wrap;
          justify-content:center;  /* center horizontally */
          gap:1rem;               /* space between pills */
        "
      >
        ${pillsHTML}
      </div>

      <!-- Image left, text right -->
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
 * HIDE ALL STATES
 *******************************************************/
function hideAllStates() {
  $("#default-hero").hide();
  $("#input-state").hide();
  $("#calculator-state").hide();
  $("#output-state").hide();
  $("#usecase-state").hide();
  $("#send-report-state").hide();
  $("#submission-takeover").hide();
}


function showCTAsForState(state) {
  // Hide every CTA in the sticky footer
  $("#get-started-btn, #input-next-btn, #to-output-btn, #unlock-report-btn, #usecase-next-btn, #send-report-next-btn").hide();

  switch (state) {
    case "default":
      // Only "Get Started"
      $("#get-started-btn").show();
      break;

    case "input":
      // Possibly show "Next" if programs are chosen
      if (chosenPrograms.length > 0) {
        $("#input-next-btn").show();
      }
      break;

    case "calculator":
      // Show the “Next” to output
      $("#to-output-btn").show();
      break;

    case "output":
      // Show “Unlock Full Report” if that’s your default CTA in output
      $("#unlock-report-btn").show();
      break;

    case "usecase":
      // Show the "Next" that leads to send-report
      $("#usecase-next-btn").show();
      break;

    case "send-report":
      // Show the “Submit” that leads to submission
      $("#send-report-next-btn").show();
      break;
      
    default:
      // If needed, do nothing or revert to no buttons
      break;
  }
}

/*******************************************************
 * Show CTAs For State
 *******************************************************/
function showCTAsForState(state) {
  // Hide every CTA
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
      // We always show #unlock-report-btn, but text might be "Resend Report"
      $("#unlock-report-btn").show();
      // If user already sent a report, also show Concierge
      if (hasSentReport) {
        $("#explore-concierge-lower").show();
      }
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
 * Document Ready
 *******************************************************/
$(document).ready(async function() {
  // 1) Initialize
  initNavyShowcase();
  await initializeApp().catch(err => console.error("initApp error =>", err));

  // 2) Hide all, show default
  hideAllStates();
  $("#default-hero").show();
  updateStageGraphic("default");
  showCTAsForState("default");

  /*******************************************************
   * Transitions
   *******************************************************/
  // “Get Started” => Input
  $("#get-started-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  // “Clear All”
  $("#clear-all-btn").on("click", function() {
    clearAllPrograms();
  });

  // “Calculator -> Back” => Input
  $("#calc-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#input-state").fadeIn(() => {
      showCTAsForState("input");
      isTransitioning = false;
    });
    updateStageGraphic("input");
  });

  // “Calculator -> Next” => Output
  $("#to-output-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");

    // default to Travel
    $(".toggle-btn").removeClass("active");
    $(".toggle-btn[data-view='travel']").addClass("active");
    buildOutputRows("travel");
  });

  // “Output -> Back” => Calculator
  $("#output-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#calculator-state").fadeIn(() => {
      showCTAsForState("calculator");
      isTransitioning = false;
    });
    updateStageGraphic("calc");
  });

  // (NEW) “Unlock Full Report” => open modal
  $("#unlock-report-btn").on("click", function() {
    // If user has sent a report before => text is "Resend Report"
    // Either way, open the modal
    showReportModal();
  });

  // (NEW) “Explore Concierge Services” => go to link
  $("#explore-concierge-lower").on("click", function() {
    window.open("https://www.legacypointsadvisors.com/pricing", "_blank");
  });

  // “Usecase -> Back” => Output
  $("#usecase-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");
  });

  // “Usecase -> Next” => Send-Report
  $("#usecase-next-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#send-report-state").fadeIn(() => {
      showCTAsForState("send-report");
      isTransitioning = false;
    });
    updateStageGraphic("sendReport");
  });

  // “Send-Report -> Back” => Usecase
  $("#send-report-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#usecase-state").fadeIn(() => {
      showCTAsForState("usecase");
      isTransitioning = false;
    });
    updateStageGraphic("usecase");
  });

  // “Send-Report -> Next” => Submission
  $("#send-report-next-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#submission-takeover").fadeIn(() => {
      isTransitioning = false;
    });
  });

  // “Go Back” in submission => Output
  $("#go-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#output-state").fadeIn(() => {
      showCTAsForState("output");
      isTransitioning = false;
    });
    updateStageGraphic("output");
  });

  // Program search => filter
  $("#program-search").on("input", filterPrograms);

  // If user presses Enter & only one => auto-add
  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      $(".preview-item").click();
    }
  });

  // Preview item => toggle
  $(document).on("click", ".preview-item", function() {
    toggleSearchItemSelection($(this));
    $("#program-preview").hide().empty();
  });

  // Top Program Box => toggle
  $(document).on("click", ".top-program-box", function() {
    toggleProgramSelection($(this));
  });

  // Remove row => recalc
  $(document).on("click", ".remove-btn", function() {
    $(this).closest(".program-row").remove();
    calculateTotal();
  });

  // Toggle Travel vs Cash
  $(document).on("click", ".toggle-btn", function() {
    $(".toggle-btn").removeClass("active");
    $(this).addClass("active");
    const viewType = $(this).data("view");
    buildOutputRows(viewType);
  });

  // Clicking output-row => expand/collapse use-case
  $(document).on("click", ".output-row", function() {
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

  // “Input -> Back” => show default hero
  $("#input-back-btn").on("click", function() {
    if (isTransitioning) return;
    isTransitioning = true;

    hideAllStates();
    $("#default-hero").fadeIn(() => {
      showCTAsForState("default");
      isTransitioning = false;
    });
    updateStageGraphic("default");
  });

  // (NEW) Modal close
  $("#modal-close-btn").on("click", function() {
    hideReportModal();
  });

  // (NEW) Modal send
  $("#modal-send-btn").on("click", async function() {
    await sendReportFromModal();
  });

});

/*******************************************************
 * U) REPLACE buildOutputRows => Show "Total Value", row clickable
 *******************************************************/
function buildOutputRows(viewType) {
  const data = gatherProgramData();
  $("#output-programs-list").empty();
  let totalValue = 0;

  data.forEach(item => {
    const prog = loyaltyPrograms[item.recordId] || {};
    const logoUrl = prog["Brand Logo URL"] || "";
    const programName = prog["Program Name"] || "Unknown";

    // Decide which column to use
    let rowValue = (viewType === "travel")
      ? item.travelValue
      : item.cashValue;

    totalValue += rowValue;

    // Format with commas => $xx,xxx.xx
    const formattedRowVal = `$${rowValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    // Basic row 
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

    // If Travel => build the hidden accordion; if Cash => skip
    if (viewType === "travel") {
      const accordionHtml = `
        <div class="usecase-accordion" style="display:none;">
          ${buildUseCaseAccordionContent(item.recordId, item.points)}
        </div>
      `;
      rowHtml += accordionHtml;
    }

    $("#output-programs-list").append(rowHtml);
  });

  // Format the total similarly
  const formattedTotal = `$${totalValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const label = (viewType === "travel") ? "Travel Value" : "Cash Value";
  const totalRowHtml = `
    <div class="total-value-row" style="text-align:center; margin-top:1rem; font-weight:600;">
      ${label}: ${formattedTotal}
    </div>
  `;
  $("#output-programs-list").append(totalRowHtml);
}
