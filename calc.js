"use strict";

/*******************************************************
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
  const durationMs = sessionEndTime - sessionStartTime;
  logSessionEvent("session_end", { durationMs });
  localStorage.removeItem("pointsLensSessionId");
});

/*******************************************************
 * hideAllStates => used to switch screens
 *******************************************************/
function hideAllStates() {
  $("#default-hero, #how-it-works-state, #input-state, #calculator-state, #output-state, #usecase-state, #send-report-state, #submission-takeover").hide();
}

/*******************************************************
 * showLeftColumnBanner => reveals left column
 *******************************************************/
function showLeftColumnBanner() {
  $(".left-column").css({
    display: "flex",
    background: `url("https://images.squarespace-cdn.com/content/663411fe4c62894a561eeb66/9d2f0865-2660-45d8-82d0-f6ac7d3b2248/Banner.jpeg") center/cover no-repeat`
  });
}

/*******************************************************
 * isValidEmail => quick check
 *******************************************************/
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/*******************************************************
 * fetchWithTimeout => avoid hanging
 *******************************************************/
async function fetchWithTimeout(url, options={}, timeout=10000, maxRetries=2){
  let attempt=0;
  while(attempt<=maxRetries){
    attempt++;
    const controller=new AbortController();
    const { signal }=controller;
    const tid=setTimeout(()=>controller.abort(), timeout);

    try{
      const response=await fetch(url, {...options, signal});
      clearTimeout(tid);
      if(response.ok){
        return response;
      }
      if(attempt>maxRetries){
        throw new Error(`HTTP status: ${response.status}`);
      }
      await new Promise(r=>setTimeout(r,500));
    }catch(err){
      clearTimeout(tid);
      if(err.name==="AbortError"){
        if(attempt>maxRetries){
          throw new Error("Request timed out multiple times.");
        }
        await new Promise(r=>setTimeout(r,500));
      } else {
        if(attempt>maxRetries){
          throw err;
        }
        await new Promise(r=>setTimeout(r,500));
      }
    }
  }
  throw new Error("Failed fetch after maxRetries");
}

/*******************************************************
 * fetchAirtableTable => read Real-World Use Cases
 *******************************************************/
async function fetchAirtableTable(tableName){
  const resp=await fetchWithTimeout(
    `https://young-cute-neptune.glitch.me/fetchAirtableData?table=${tableName}`,
    {},
    10000,
    2
  );
  if(!resp.ok){
    throw new Error(`Non-OK status: ${resp.status}`);
  }
  return await resp.json();
}

/*******************************************************
 * initializeApp => load data
 *******************************************************/
async function initializeApp(){
  console.log("=== initializeApp() ===");
  try {
    // Fetch loyaltyPrograms
    const resp=await fetchWithTimeout(
      "https://young-cute-neptune.glitch.me/fetchPointsCalcData",
      {},
      10000
    );
    if(!resp.ok){
      throw new Error("Network not OK => " + resp.statusText);
    }
    const programsData=await resp.json();
    loyaltyPrograms=programsData.reduce((acc, record)=>{
      const fields={ ...record.fields };
      if(record.logoAttachmentUrl){
        fields["Brand Logo URL"]=record.logoAttachmentUrl;
      }
      acc[record.id]=fields;
      return acc;
    },{});
    console.log("loyaltyPrograms =>", loyaltyPrograms);
  }catch(err){
    console.error("Error fetching Points Calc =>",err);
  }

  try{
    // Fetch Real-World Use Cases
    const useCasesData=await fetchAirtableTable("Real-World Use Cases");
    realWorldUseCases=useCasesData.reduce((acc, record)=>{
      acc[record.id]={ id:record.id, ...record.fields };
      return acc;
    },{});
    console.log("Real-World Use Cases =>", realWorldUseCases);
  }catch(err){
    console.error("Error fetching Real-World =>",err);
  }

  buildTopProgramsSection();
}

/*******************************************************
 * buildTopProgramsSection => “Popular Programs”
 *******************************************************/
function buildTopProgramsSection(){
  const container=document.getElementById("top-programs-grid");
  if(!container)return;
  const topRecords=Object.keys(loyaltyPrograms).filter(id=>{
    return !!loyaltyPrograms[id]["Top Programs"];
  });
  let html="";
  topRecords.forEach(rid=>{
    const prog=loyaltyPrograms[rid];
    const name=prog["Program Name"]||"Unnamed Program";
    const logo=prog["Brand Logo URL"]||"";
    html+=`
      <div class="top-program-box" data-record-id="${rid}">
        <div style="display:flex; align-items:center;">
          <img src="${logo}" alt="${name} logo" class="top-program-logo"/>
          <span class="top-program-label">${name}</span>
        </div>
        <button class="add-btn">+</button>
      </div>
    `;
  });
  container.innerHTML=html;
}

/*******************************************************
 * filterPrograms => search
 *******************************************************/
function filterPrograms(){
  if(!loyaltyPrograms || !Object.keys(loyaltyPrograms).length){
    $("#program-preview")
      .html("<div style='padding:12px; color:#999;'>Still loading programs...</div>")
      .show();
    return;
  }
  const val=$("#program-search").val().toLowerCase().trim();
  if(!val){
    $("#program-preview").hide().empty();
    return;
  }
  const results=Object.keys(loyaltyPrograms).filter(id=>{
    const prog=loyaltyPrograms[id];
    if(!prog["Program Name"])return false;
    // exclude if already in calc
    const inCalc=$(`#program-container .program-row[data-record-id='${id}']`).length>0;
    return prog["Program Name"].toLowerCase().includes(val)&&!inCalc;
  });
  const limited=results.slice(0,5);
  if(!limited.length){
    $("#program-preview").hide().empty();
    return;
  }
  let previewHTML="";
  limited.forEach(rid=>{
    const prog=loyaltyPrograms[rid];
    const name=prog["Program Name"];
    const logo=prog["Brand Logo URL"]||"";
    const chosenClass=chosenPrograms.includes(rid)?"chosen-state":"";
    previewHTML+=`
      <div class="preview-item ${chosenClass}" data-record-id="${rid}">
        <div>
          <span class="program-name">${name}</span>
          <span class="program-type">(${prog.Type||"Unknown"})</span>
        </div>
        ${logo? `<img src="${logo}" alt="logo" style="height:35px;">`:""}
      </div>
    `;
  });
  $("#program-preview").html(previewHTML).show();
}

/*******************************************************
 * addProgramRow => for CALCULATOR
 *******************************************************/
function addProgramRow(recordId){
  const prog=loyaltyPrograms[recordId];
  if(!prog)return;
  const logo=prog["Brand Logo URL"]||"";
  const name=prog["Program Name"]||"Unnamed Program";
  const rowHTML=`
    <div class="program-row" data-record-id="${recordId}">
      <div class="program-left">
        ${logo? `<img src="${logo}" alt="${name} logo" class="program-logo">`:""}
        <span class="program-name">${name}</span>
      </div>
      <div class="program-right">
        <!-- Rounded container for the input field -->
        <div 
          class="dollar-input-container"
          style="
            display:inline-flex;
            align-items:center;
            border:1px solid #DFE5EB;
            border-radius:0.5rem;
            background-color:#fff;
            padding:0 1rem;
          "
        >
          <input
            type="text"
            class="points-input"
            placeholder="Enter Total"
            oninput="formatNumberInput(this); calculateTotal()"
            style="
              border:none;
              outline:none;
              font-size:1rem;
              width:5rem;
              background-color:transparent;
            "
          />
        </div>
        <button class="remove-btn">×</button>
      </div>
    </div>
  `;
  $("#program-container").append(rowHTML);
  calculateTotal();
  updateClearAllVisibility();
}

/*******************************************************
 * toggleSearchItemSelection / toggleProgramSelection
 *******************************************************/
function toggleSearchItemSelection(itemEl){
  const rid=itemEl.data("record-id");
  if(!rid)return;
  const idx=chosenPrograms.indexOf(rid);
  if(idx===-1){
    chosenPrograms.push(rid);
    itemEl.addClass("selected-state");
    const box=$(`.top-program-box[data-record-id='${rid}']`);
    if(box.length){
      box.addClass("selected-state");
      box.find(".add-btn").text("✓");
    }
    itemEl.remove();
  } else {
    chosenPrograms.splice(idx,1);
    itemEl.removeClass("selected-state");
    const box=$(`.top-program-box[data-record-id='${rid}']`);
    if(box.length){
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
function toggleProgramSelection(boxEl){
  const rid=boxEl.data("record-id");
  const idx=chosenPrograms.indexOf(rid);
  if(idx===-1){
    chosenPrograms.push(rid);
    boxEl.addClass("selected-state");
    boxEl.find(".add-btn").text("✓");
  } else {
    chosenPrograms.splice(idx,1);
    boxEl.removeClass("selected-state");
    boxEl.find(".add-btn").text("+");
  }
  $("#program-search").val("");
  $("#program-preview").hide().empty();
  filterPrograms();
  updateNextCTAVisibility();
  updateChosenProgramsDisplay();
  updateClearAllVisibility();
}

/*******************************************************
 * updateChosenProgramsDisplay => show logos
 *******************************************************/
function updateChosenProgramsDisplay(){
  const container=$("#chosen-programs-row");
  container.empty();
  if(!chosenPrograms.length){
    $("#selected-programs-label").hide();
    return;
  }
  $("#selected-programs-label").show();
  chosenPrograms.forEach(rid=>{
    const prog=loyaltyPrograms[rid];
    if(!prog)return;
    const logoUrl=prog["Brand Logo URL"]||"";
    const name=prog["Program Name"]||"Unknown";
    container.append(`
      <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
        <img src="${logoUrl}" alt="${name}" style="width:100%; height:auto; object-fit:contain;">
      </div>
    `);
  });
}

/*******************************************************
 * updateNextCTAVisibility => show/hide #input-next-btn
 *******************************************************/
function updateNextCTAVisibility(){
  if(chosenPrograms.length>0){
    $("#input-next-btn").show();
  } else {
    $("#input-next-btn").hide();
  }
}

/*******************************************************
 * updateClearAllVisibility => show Clear All if >=3
 *******************************************************/
function updateClearAllVisibility(){
  if($("#input-state").is(":visible")){
    if(chosenPrograms.length>=3) $("#clear-all-btn").fadeIn();
    else $("#clear-all-btn").fadeOut();
  }else if($("#calculator-state").is(":visible")){
    const rowCount=$("#program-container .program-row").length;
    if(rowCount>=3) $("#clear-all-btn").fadeIn();
    else $("#clear-all-btn").fadeOut();
  }else{
    $("#clear-all-btn").fadeOut();
  }
}
function clearAllPrograms(){
  chosenPrograms=[];
  $(".top-program-box.selected-state").removeClass("selected-state").find(".add-btn").text("+");
  $(".preview-item.selected-state").removeClass("selected-state");
  updateChosenProgramsDisplay();
  $("#clear-all-btn").hide();
  updateNextCTAVisibility();
}

/*******************************************************
 * formatNumberInput / calculateTotal
 *******************************************************/
function formatNumberInput(el){
  let raw=el.value.replace(/,/g,"").replace(/[^0-9]/g,"");
  if(!raw){el.value="";return;}
  let num=parseInt(raw,10);
  if(num>10000000) num=10000000;
  el.value=num.toLocaleString();
}
function calculateTotal(){
  // purely optional
}

/*******************************************************
 * gatherProgramData => used in buildOutputRows
 *******************************************************/
function gatherProgramData(){
  const data=[];
  $(".program-row").each(function(){
    const rid=$(this).data("record-id");
    const prog=loyaltyPrograms[rid];
    if(!prog)return;
    const pStr=$(this).find(".points-input").val().replace(/,/g,"")||"0";
    const points=parseFloat(pStr)||0;
    data.push({
      recordId: rid,
      programName: prog["Program Name"]||"Unknown",
      points
    });
  });
  return data;
}

/*******************************************************
 * buildUseCaseAccordionContent => for real-world use cases
 *******************************************************/
function buildUseCaseAccordionContent(recordId, userPoints){
  const program=loyaltyPrograms[recordId];
  if(!program){
    return `<div style="padding:1rem;">No data found for program.</div>`;
  }
  // Filter realWorldUseCases => recommended for this recordId
  let matching=Object.values(realWorldUseCases).filter(uc=>{
    if(!uc.Recommended) return false;
    if(!uc["Points Required"]) return false;
    if(!uc["Use Case Title"]) return false;
    if(!uc["Use Case Body"])  return false;
    const linked=uc["Program Name"]||[];
    const userHasEnough = uc["Points Required"] <= userPoints;
    return linked.includes(recordId) && userHasEnough;
  });
  matching.sort((a,b)=>(a["Points Required"]||0)-(b["Points Required"]||0));
  matching=matching.slice(0,3);

  if(!matching.length){
    return `<div style="padding:1rem;">No recommended use cases found for your points.</div>`;
  }

  // Build a small pill + content approach
  let pillsHTML="";
  matching.forEach((uc,i)=>{
    const pts=uc["Points Required"]||0;
    pillsHTML += `
      <div class="mini-pill ${i===0?"active":""}" data-usecase-id="${uc.id}">
        ${pts.toLocaleString()} pts
      </div>
    `;
  });

  const first=matching[0];
  const imageURL=first["Use Case URL"]||"";
  const title=first["Use Case Title"]||"Untitled";
  const body=first["Use Case Body"]||"No description";

  return `
    <div class="usecases-panel" style="display:flex; flex-direction:column; gap:1rem;">
      <div class="pills-container" style="display:flex; flex-wrap:wrap; justify-content:center; gap:1rem;">
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
          <h4 style="font-size:16px; margin:0 0 0.5rem; color:#1a2732;">
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
 * buildOutputRows => Travel vs Cash => usecases
 *******************************************************/
function buildOutputRows(viewType){
  const data=gatherProgramData();
  $("#output-programs-list").empty();
  let totalValue=0;

  data.forEach(item=>{
    const prog=loyaltyPrograms[item.recordId];
    const logoUrl=prog?.["Brand Logo URL"]||"";
    let rowVal=0;
    if(viewType==="travel"){
      rowVal=item.points*(prog?.["Travel Value"]||0);
    } else {
      rowVal=item.points*(prog?.["Cash Value"]||0);
    }
    totalValue+=rowVal;
    const formattedVal=`$${rowVal.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`;

    let rowHtml=`
      <div class="output-row" data-record-id="${item.recordId}">
        <div class="output-left" style="display:flex; align-items:center; gap:0.75rem;">
          <img 
            src="${logoUrl}" 
            alt="logo" 
            class="output-logo" 
            style="width:60px; height:auto;"
          />
          <span class="program-name">${item.programName}</span>
        </div>
        <div class="output-value" style="font-weight:600;">
          ${formattedVal}
        </div>
      </div>
    `;
    if(viewType==="travel"){
      // Real-world use cases => show an accordion
      const userPoints=item.points||0;
      rowHtml+=`
        <div class="usecase-accordion" style="display:none; border:1px solid #dce3eb; border-radius:6px; margin-bottom:12px; padding:1rem;">
          ${buildUseCaseAccordionContent(item.recordId, userPoints)}
        </div>
      `;
    }
    $("#output-programs-list").append(rowHtml);
  });

  const label=(viewType==="travel")?"Travel Value":"Cash Value";
  const totalStr=`$${totalValue.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`;
  $("#output-programs-list").append(`
    <div class="total-value-row" style="text-align:center; margin-top:1rem; font-weight:600;">
      ${label}: ${totalStr}
    </div>
  `);
}

/*******************************************************
 * showReportModal / hideReportModal
 *******************************************************/
function hideReportModal(){
  $("#report-modal").fadeOut(300);
}
function showReportModal(){
  $("#report-modal").fadeIn(200);
  $("#modal-email-error").hide().text("");
  $("#email-sent-message").hide();
}

/*******************************************************
 * sendReport / sendReportFromModal
 *******************************************************/
async function sendReport(email){
  if(!email)return;
  if(!isValidEmail(email))throw new Error("Invalid email format");
  const fullData=gatherProgramData();
  const programsToSend=fullData.map(x=>({
    programName:x.programName,
    points:x.points
  }));
  console.log("Sending report =>", { email, programs:programsToSend });

  const response=await fetch("https://young-cute-neptune.glitch.me/submitData",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ email, programs:programsToSend })
  });
  if(!response.ok){
    const result=await response.json();
    throw new Error(result.error||`HTTP ${response.status}`);
  }
  return true;
}
async function sendReportFromModal(){
  const emailInput=$("#modal-email-input").val().trim();
  const errorEl=$("#modal-email-error");
  const sentMsgEl=$("#email-sent-message");
  const sendBtn=$("#modal-send-btn");

  errorEl.hide().text("");
  sentMsgEl.hide();

  if(!isValidEmail(emailInput)){
    errorEl.text("Invalid email.").show();
    return;
  }

  sendBtn.prop("disabled",true).text("Sending...");
  try{
    await sendReport(emailInput);
    sentMsgEl.show();
    hasSentReport=true;
    userEmail=emailInput;
    logSessionEvent("email_submitted",{ email:userEmail });

    // After short delay => hide modal + “swap ctas”
    setTimeout(()=>{
      hideReportModal();
      sentMsgEl.hide();

      // Swap CTAs => “Unlock Full Report” => white, “Explore Services” => blue
      $("#unlock-report-btn")
        .removeClass("cta-dark").removeClass("cta-light-border")
        .addClass("cta-light-border");
      $("#explore-concierge-lower")
        .removeClass("cta-dark").removeClass("cta-light-border")
        .addClass("cta-dark");

    },700);
  }catch(err){
    console.error("Failed to send =>",err);
    errorEl.text(err.message||"Error sending report.").show();
  }finally{
    sendBtn.prop("disabled",false).text("Send Report");
  }
}

/*******************************************************
 * showHowItWorksStep => highlight lines
 *******************************************************/
function showHowItWorksStep(stepNum){
  $(".hiw-step").hide();
  $(`.hiw-step[data-step='${stepNum}']`).show();
  $(".hiw-line").removeClass("active-line");
  $(".hiw-line").each(function(idx){
    if(idx<stepNum){
      $(this).addClass("active-line");
    }
  });
}

/*******************************************************
 * DOC READY => main transitions
 *******************************************************/
$(document).ready(async function(){
  // Log session load
  logSessionEvent("session_load");

  // fetch IP, location, data
  await fetchClientIP();
  await fetchApproxLocationFromIP();
  await initializeApp();

  // Start => hero
  hideAllStates();
  $("#default-hero").show();
  $("#program-preview").hide().empty();

  /****************************************************
   * Hero => “Get Started”
   ****************************************************/
  $("#hero-get-started-btn").on("click",function(){
    logSessionEvent("hero_get_started_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    showLeftColumnBanner();

    hideAllStates();
    $("#input-state").fadeIn(()=>{
      isTransitioning=false;
      updateNextCTAVisibility();
      updateClearAllVisibility();
    });
  });

  /****************************************************
   * Hero => “How It Works”
   ****************************************************/
  $("#hero-how-it-works-btn").on("click",function(){
    logSessionEvent("hero_how_it_works_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    showLeftColumnBanner();

    hideAllStates();
    $("#how-it-works-state").fadeIn(()=>{
      isTransitioning=false;
      showHowItWorksStep(1);
    });
  });

  // Step transitions
  $("#hiw-continue-1").on("click",()=> showHowItWorksStep(2));
  $("#hiw-continue-2").on("click",()=> showHowItWorksStep(3));
  $("#hiw-final-start-btn").on("click",function(){
    logSessionEvent("hiw_final_get_started");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $("#input-state").fadeIn(()=>{
      isTransitioning=false;
      updateNextCTAVisibility();
      updateClearAllVisibility();
    });
  });

  /****************************************************
   * Input => Back => hero
   ****************************************************/
  $("#input-back-btn").on("click",function(){
    logSessionEvent("input_back_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $(".left-column").css("display","none"); // hide left col
    $("#default-hero").fadeIn(()=>{ isTransitioning=false; });
  });

  /****************************************************
   * Input => Next => calculator
   ****************************************************/
  $("#input-next-btn").on("click",function(){
    logSessionEvent("input_next_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $("#calculator-state").fadeIn(()=>{
      isTransitioning=false;
      $("#to-output-btn").show();
    });
    $("#program-container").empty();
    chosenPrograms.forEach(rid=>addProgramRow(rid));
  });

  /****************************************************
   * Calc => Back => Input
   ****************************************************/
  $("#calc-back-btn").on("click",function(){
    logSessionEvent("calc_back_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $("#input-state").fadeIn(()=>{ isTransitioning=false; });
  });

  /****************************************************
   * Calc => Next => Output
   ****************************************************/
  $("#to-output-btn").on("click",function(){
    logSessionEvent("calc_next_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $("#output-state").fadeIn(()=>{
      isTransitioning=false;
      // show the 2 ctas
      $("#unlock-report-btn").show();
      $("#explore-concierge-lower").show();
    });
    // Default => Travel
    $(".toggle-btn").removeClass("active");
    $(".toggle-btn[data-view='travel']").addClass("active");
    buildOutputRows("travel");
  });

  /****************************************************
   * Output => Back => Calc
   ****************************************************/
  $("#output-back-btn").on("click",function(){
    logSessionEvent("output_back_clicked");
    if(isTransitioning)return;
    isTransitioning=true;

    hideAllStates();
    $("#calculator-state").fadeIn(()=>{ isTransitioning=false; });
  });

  /****************************************************
   * Clear All, Search, Program Remove
   ****************************************************/
  $("#clear-all-btn").on("click",function(){
    logSessionEvent("clear_all_clicked");
    clearAllPrograms();
  });
  $("#program-search").on("input", filterPrograms);
  $(document).on("keypress","#program-search",function(e){
    if(e.key==="Enter" && $(".preview-item").length===1){
      logSessionEvent("program_search_enter");
      $(".preview-item").click();
    }
  });
  $(document).on("click",".preview-item",function(){
    const rid=$(this).data("record-id");
    logSessionEvent("program_preview_item_clicked",{ rid });
    toggleSearchItemSelection($(this));
    $("#program-preview").hide().empty();
  });
  $(document).on("click",".top-program-box",function(){
    const rid=$(this).data("record-id");
    logSessionEvent("top_program_box_clicked",{ rid });
    toggleProgramSelection($(this));
  });
  $(document).on("click",".remove-btn",function(){
    const rowEl=$(this).closest(".program-row");
    const rid=rowEl.data("record-id");
    logSessionEvent("program_remove_clicked",{ rid });
    rowEl.remove();
    calculateTotal();
  });

  /****************************************************
   * Toggle Travel / Cash => buildOutputRows
   ****************************************************/
  $(document).on("click",".toggle-btn",function(){
    logSessionEvent("toggle_view_clicked",{ newView:$(this).data("view")});
    $(".toggle-btn").removeClass("active");
    $(this).addClass("active");
    buildOutputRows($(this).data("view"));
  });

  // Expand/collapse usecase if Travel
  $(document).on("click",".output-row",function(){
    if($(".toggle-btn[data-view='cash']").hasClass("active")) return;
    $(".usecase-accordion:visible").slideUp();
    const panel=$(this).next(".usecase-accordion");
    if(panel.is(":visible")) panel.slideUp();
    else panel.slideDown();
  });

  /****************************************************
   * “Unlock Full Report” => show modal
   ****************************************************/
  $("#unlock-report-btn").on("click",function(){
    logSessionEvent("unlock_report_clicked");
    showReportModal();
  });
  $("#modal-close-btn").on("click",function(){
    logSessionEvent("modal_close_clicked");
    hideReportModal();
  });
  $("#modal-send-btn").on("click",async function(){
    const emailInput=$("#modal-email-input").val().trim();
    logSessionEvent("modal_send_clicked",{ email:emailInput });
    await sendReportFromModal();
  });

  /****************************************************
   * Explore Services => external link or “services” page
   ****************************************************/
  $("#explore-concierge-lower").on("click",function(){
    logSessionEvent("explore_concierge_clicked");
    // example: open link
    window.open("https://www.legacypointsadvisors.com/pricing","_blank");
  });

  /****************************************************
   * If you have further states => usecase-back => etc.
   ****************************************************/
  $("#usecase-back-btn").on("click",function(){
    hideAllStates();
    $("#output-state").fadeIn();
  });

  $("#send-report-back-btn").on("click",function(){
    hideAllStates();
    $("#output-state").fadeIn();
  });

  $("#go-back-btn").on("click",function(){
    hideAllStates();
    $("#output-state").fadeIn();
  });
  $("#explore-concierge-btn").on("click",function(){
    window.open("https://www.legacypointsadvisors.com/pricing","_blank");
  });
});
