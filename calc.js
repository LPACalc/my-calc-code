
"use strict";

/*******************************************************
 * A) GLOBAL VARIABLES & DATA
 *******************************************************/

let loyaltyPrograms = {};
let realWorldUseCases = [];
let chosenPrograms = []; // array of recordIds that user has selected

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
 * G) UPDATE CHOSEN PROGRAMS
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
  $("#input-state").hide();
  $("#cards-container").fadeIn();
  $("#calculator-state").fadeIn();

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

    const pointsStr = $(this).find(".points-input").val().replace(/,/g, "") || "0";
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
 * R) SEND REPORT
 *******************************************************/
async function sendReport() {
  const emailEl = document.getElementById("email-input");
  const errorEl = document.getElementById("email-error");
  const sendBtn = document.getElementById("send-results-btn");

  if (!emailEl || !sendBtn) return; // sanity check
  const email = emailEl.value.trim();

  // 1) Validate
  if (!isValidEmail(email)) {
    errorEl.textContent = "Invalid email address.";
    errorEl.style.display = "block";
    emailEl.classList.add("input-error");
    return;
  } else {
    errorEl.textContent = "";
    errorEl.style.display = "none";
    emailEl.classList.remove("input-error");
  }

  // 2) Gather data
  const programs = gatherProgramData();
  let totalTravel = 0;
  let totalCash = 0;
  programs.forEach(item => {
    totalTravel += item.travelValue;
    totalCash += item.cashValue;
  });

  // 3) Update button => "Sending..."
  sendBtn.disabled = true;
  const originalBtnText = "Send Report"; // ensure we store the original text
  sendBtn.textContent = "Sending...";
  const slowTimeout = setTimeout(() => {
    sendBtn.textContent = "Still working...";
  }, 7000);

  try {
    // 4) Post to your endpoint
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
    clearTimeout(slowTimeout);

    const result = await response.json();
    if (!response.ok) {
      alert("Error: " + (result.error || "Unknown error"));
      sendBtn.disabled = false;
      sendBtn.textContent = originalBtnText;
      return;
    }

    // 5) On success => show "Report Sent", not full takeover
    sendBtn.textContent = "Report Sent";

  } catch (err) {
    alert("Failed to submit => " + err.message);
    sendBtn.disabled = false;
    sendBtn.textContent = originalBtnText;
    clearTimeout(slowTimeout);
  }
}



/*******************************************************
 * T) BUILD USE CASE ACCORDION => Per-Program
 *   - Only recommended
 *   - Up to 4
 *   - Sort by ascending Points Required
 *   - First is default "active"
 *******************************************************/
function buildUseCaseAccordionContent(recordId) {
  const program = loyaltyPrograms[recordId];
  if (!program) {
    return `<div style="padding:1rem;">No data found.</div>`;
  }

  // Filter recommended = true
  let matchingUseCases = Object.values(realWorldUseCases).filter(uc => {
    if (!uc.Recommended) return false;
    const linked = uc["Program Name"] || [];
    return linked.includes(recordId);
  });

  // Sort ascending
  matchingUseCases.sort((a, b) => {
    const aPoints = a["Points Required"] || 0;
    const bPoints = b["Points Required"] || 0;
    return aPoints - bPoints;
  });

  // Limit to 4
  matchingUseCases = matchingUseCases.slice(0, 4);

  if (!matchingUseCases.length) {
    return `<div style="padding:1rem;">No recommended use cases found.</div>`;
  }

  // Build pills
  let pillsHTML = "";
  matchingUseCases.forEach((uc, i) => {
    const pointsReq = uc["Points Required"] || 0;
    const activeClass = (i === 0) ? "active" : "";
    pillsHTML += `
      <div class="mini-pill ${activeClass}" data-usecase-id="${uc.id}">
        ${pointsReq.toLocaleString()} pts
      </div>
    `;
  });

  const first = matchingUseCases[0];
  const imageURL = first["Use Case URL"] || "";
  const title    = first["Use Case Title"] || "Untitled";
  const body     = first["Use Case Body"]  || "No description";

  return `
    <div class="usecases-panel" style="display:flex; flex-direction:column; gap:1rem;">
      <!-- Pills row -->
      <div class="pills-container" style="display:flex; flex-wrap:wrap;">
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
          <h4 class="uc-title" style="font-size:16px; margin:0 0 0.5rem; color:#1a2732;">${title}</h4>
          <p class="uc-body" style="font-size:14px; line-height:1.4; color:#555; margin:0;">${body}</p>
        </div>
      </div>
    </div>
  `;
}

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
    const formattedRowVal = `$${rowValue.toFixed(2)}`;

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
          ${buildUseCaseAccordionContent(item.recordId)}
        </div>
      `;
      rowHtml += accordionHtml;
    }

    $("#output-programs-list").append(rowHtml);
  });

  const label = (viewType === "travel") ? "Travel Value" : "Cash Value";
  const formattedTotal = `$${totalValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const totalRowHtml = `
    <div class="total-value-row" style="text-align:center; margin-top:1rem; font-weight:600;">
      ${label}: ${formattedTotal}
    </div>
  `;
  $("#output-programs-list").append(totalRowHtml);
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

/*======================================================
  SECTION V: DOCUMENT READY
======================================================*/
$(document).ready(async function() {
  // 1) Initialize static pills in #usecase-state (if used)
  initNavyShowcase();

  // 2) Fetch data & build top programs
  await initializeApp().catch(err => console.error("initApp error =>", err));

  // ========== A) HIDE ALL STATES EXCEPT DEFAULT HERO ==========
  hideAllStates();
  $("#default-hero").show();
  updateStageGraphic("default");

  // ========== B) “GET STARTED” => GO TO INPUT STATE ==========
  $("#get-started-btn").show(); // ensure it's visible on load
  $("#get-started-btn").on("click", function() {
    // Hide default hero, hide "Get Started"
    $("#default-hero").hide();
    $(this).hide();  // “this” is the get-started-btn
    
    // Show input state
    $("#input-state").show();
    updateStageGraphic("input");

    // *No next button visible yet, until we add a program*
    $("#input-next-btn").hide();
  });

  // ========== C) WATCH PROGRAM ADDITIONS (to show Next) ==========
  // Whenever we add a program, we call updateChosenProgramsDisplay(),
  // but we also want to check if chosenPrograms.length > 0 => show #input-next-btn.

  // Already in your code, we have a function "updateNextCTAVisibility()" 
  // that runs after toggling programs. Let’s tweak it:

  function updateNextCTAVisibility() {
    // Only show "input-next-btn" if at least 1 program chosen 
    // AND we're currently in the input-state
    if (chosenPrograms.length > 0 && $("#input-state").is(":visible")) {
      $("#input-next-btn").show();
    } else {
      $("#input-next-btn").hide();
    }
  }

  // (Replace your existing updateNextCTAVisibility function with the above version.)

  // ========== D) “Clear All” & “Top Program Box” listeners remain the same ==========
  // (No changes needed, they already call updateNextCTAVisibility.)

  // ========== E) "Input -> Next" => Calculator State ==========
  // The #input-next-btn click handler is mostly fine, 
  // just ensure it hides input-state & shows calculator-state. 
  // (You already have that in your code.)

  $("#input-next-btn").on("click", function() {
    hideAllStates();
    $("#calculator-state").fadeIn();
    updateStageGraphic("calc");

    // Build program rows now that we have chosenPrograms
    $("#program-container").empty();
    chosenPrograms.forEach(recordId => addProgramRow(recordId));
  });

  // ====== F) CALCULATOR => Back => Input
  $("#calc-back-btn").on("click", function() {
    hideAllStates();
    $("#input-state").fadeIn();
    updateStageGraphic("input");

    // Possibly re-run updateNextCTAVisibility to show/hide next based on chosenPrograms
    updateNextCTAVisibility();
  });

  // ====== G) CALCULATOR => Next => Output
  $("#to-output-btn").on("click", function() {
    hideAllStates();
    $("#output-state").show();
    updateStageGraphic("output");

    // Default view is "Travel"
    $(".toggle-btn").removeClass("active");
    $(".toggle-btn[data-view='travel']").addClass("active");
    buildOutputRows("travel");
  });

  // ====== H) OUTPUT => Back => Calculator
  $("#output-back-btn").on("click", function() {
    hideAllStates();
    $("#calculator-state").show();
    updateStageGraphic("calc");
  });

  // (and so on for your usecase -> next -> send-report, etc.)

  // ========== I) The Rest of Your Document Ready Logic ==========

  // 3) Listen for user typing in program-search => filter the programs
  $("#program-search").on("input", filterPrograms);

  // 4) If user presses Enter and only one preview item => auto-select it
  $(document).on("keypress", "#program-search", function(e) {
    if (e.key === "Enter" && $(".preview-item").length === 1) {
      $(".preview-item").click();
    }
  });

  // 5) Preview item => toggle selection
  $(document).on("click", ".preview-item", function() {
    toggleSearchItemSelection($(this));
    $("#program-preview").hide().empty();
  });

  // 6) Remove row => recalc
  $(document).on("click", ".remove-btn", function() {
    $(this).closest(".program-row").remove();
    calculateTotal();
  });

  // 7) Toggle between “Travel” vs “Cash” in output => Re-build rows
  $(document).on("click", ".toggle-btn", function() {
    $(".toggle-btn").removeClass("active");
    $(this).addClass("active");
    const viewType = $(this).data("view"); // "travel" or "cash"
    buildOutputRows(viewType);
  });

  // 8) Clicking an .output-row => expand/collapse the use-case accordion
  $(document).on("click", ".output-row", function() {
    if ($(".toggle-btn[data-view='cash']").hasClass("active")) {
      return; // do nothing if Cash is active
    }
    $(".usecase-accordion:visible").slideUp();
    const panel = $(this).next(".usecase-accordion");
    if (panel.is(":visible")) {
      panel.slideUp();
    } else {
      panel.slideDown();
    }
  });

  // 9) “Clear All”
  $("#clear-all-btn").on("click", function() {
    clearAllPrograms();
  });

  // 10) Clicking a popular program => toggle
  $(document).on("click", ".top-program-box", function() {
    toggleProgramSelection($(this));
  });

  // 11) “Go Back” in submission takeover => returns to output
  $("#go-back-btn").on("click", function() {
    hideAllStates();
    $("#output-state").fadeIn();
  });

  // 12) “Explore Concierge” => opens link in new tab
  $("#explore-concierge-btn").on("click", function() {
    window.open("https://www.legacypointsadvisors.com/pricing", "_blank");
  });

  // 13) Attach sendReport() to “Send Report” button
  const sendBtn = document.getElementById("send-results-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", sendReport);
  }

  // 14) If user re-types an email after sending => revert the button text
  document.getElementById("email-input").addEventListener("input", function() {
    const sendBtn = document.getElementById("send-results-btn");
    if (sendBtn.textContent === "Report Sent") {
      sendBtn.textContent = "Send Report";
      sendBtn.disabled = false;
    }
  });

  // 15) “mini-pill” => switch use case details inside expanded panel
  $(document).on("click", ".mini-pill", function(e) {
    e.stopPropagation();
    $(this).siblings().removeClass("active");
    $(this).addClass("active");

    const usecaseId = $(this).data("usecase-id");
    const useCaseObj = realWorldUseCases[usecaseId];
    if (!useCaseObj) return;

    const panel  = $(this).closest(".usecases-panel");
    const imageEl= panel.find(".image-wrap img");
    const titleEl= panel.find(".uc-title");
    const bodyEl = panel.find(".uc-body");

    imageEl.attr("src", useCaseObj["Use Case URL"] || "");
    titleEl.text(useCaseObj["Use Case Title"] || "Untitled");
    bodyEl.text(useCaseObj["Use Case Body"] || "No description");
  });
});




