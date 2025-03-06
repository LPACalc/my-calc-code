/*******************************************************
 * BASE RESETS
 *******************************************************/
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  background-color: #F8FAFD;
  font-family: "Inter", Arial, sans-serif;
  line-height: 1.5;
  color: #1D3A5F;
  overflow-x: hidden; /* no horizontal scroll, vertical is normal */
}

button {
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

/*******************************************************
 * PAGE LAYOUT => left + right
 *******************************************************/
.page-wrap {
  display: flex;
  flex-direction: row;
  min-height: 100vh;
  width: 100%;
  position: relative;
}

/* LEFT => hidden on mobile => show on desktop only upon user click */
.left-column {
  position: relative;
  display: none;
  width: 25%;
  min-width: 250px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#left-col-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
}

.right-column {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/*******************************************************
 * “All Programs” Modal
 *******************************************************/
#all-programs-modal {
  position: fixed;
  top: 0; 
  left: 0;
  width: 100%; 
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: none; /* .show => display:block */
}

#all-programs-modal.show {
  display: block;
}

#all-programs-modal-content {
  position: absolute;
  top: 50%;  
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  width: 100%;
  max-width: 600px;
  height: auto;
  max-height: 90%;
  border-radius: 6px;
  padding: 1rem;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

/* Close button in top-right corner */
#all-programs-close-btn {
  float: right;
  font-size: 24px;
  cursor: pointer;
  background: none;
  border: none;
  color: #1a2732;
  margin-top: -8px; 
}

/* The scrollable list inside the modal */
.all-programs-list {
  margin-top: 1rem;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Each row => “all-program-row” */
.all-program-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem;
  border-bottom: 1px solid #dce3eb;
  cursor: pointer;
}

.all-program-row .row-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.all-program-row img {
  width: 40px;
  height: auto;
}

/* Circle button on the right => like “Add” or “Check” */
.all-program-row .circle-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #aaa;
  border-radius: 50%;
  background-color: transparent;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.all-program-row.selected-state .circle-btn {
  background-color: #1a2732;
  border-color: #1a2732;
  color: #fff;
}

/* Show “Explore All” button only on mobile */
@media (max-width: 576px) {
  .explore-all-btn {
    display: inline-block !important;
    background-color: #f0f0f0;
    color: #333;
    font-size: 0.9rem;
    padding: 0.75rem;
    margin-left: 0.5rem;
    border-radius: 6px;
  }

  #all-programs-modal-content {
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    max-width: 100% !important;
    transform: translateY(100%);
    border-radius: 12px 12px 0 0 !important;
    transition: transform 0.5s ease;
  }

  #all-programs-modal.show #all-programs-modal-content {
    transform: translateY(0);
  }
}

/*******************************************************
 * DESKTOP ONLY => min-width: 992px
 *******************************************************/
@media (min-width: 992px) {
  .program-row .program-name {
    font-size: 1.2rem !important;
  }
  .program-row img {
    width: 60px !important;
  }

  .sticky-next-btn {
    margin: 1rem auto !important;
    padding: 1rem 6rem;
    display: block !important;
  }

  .clear-all-btn {
    background-color: #dc3545 !important;
    color: #fff !important;
  }

  .points-info-box.input-points-info,
  .points-info-box.calc-points-info {
    padding: 20px 40px;
    border: 1px solid #DFE5EB;
    margin: 1rem 0;
    align-items: center;
    gap: 24px;
  }

  .infobox-desktop-text {
    font-size: 1rem;
    line-height: 1.4;
  }

  .points-input {
    border: none !important;
    outline: none !important;
    width: 120px !important;
  }

  /* Center #report-modal-content in the right column for desktop */
  #report-modal-content {
    left: 60% !important;
    transform: translate(-50%, -50%);
  }

  h2.popular-programs-heading {
    font-size: 1.25rem;
    font-weight: bold;
    text-align: left;
    margin-bottom: 1rem;
  }

  /* If user selects a “Popular Program” => circle is blue with white check */
  .top-program-box.selected-state .add-btn {
    background-color: #1a2732 !important;
    color: #fff !important;
    border-color: #1a2732 !important;
  }

  /* Desktop “mini-pill-row-desktop” overrides (if used) */
  .mini-pill-row-desktop {
    display: flex;
    flex-wrap: wrap;
    justify-content: center !important;
    gap: 1rem;
  }
  .mini-pill-row-desktop .mini-pill {
    display: inline-block;
    margin-right: 8px;
    margin-bottom: 8px;
    padding: 6px 30px !important;
    font-size: 1rem !important;
    border-radius: 9999px;
    background-color: #f0f0f0;
    color: #333;
    cursor: pointer;
  }
  .mini-pill-row-desktop .mini-pill.active {
    background-color: #1a2732;
    color: #fff;
  }
}

/*******************************************************
 * MOBILE => max-width: 576px
 *******************************************************/
@media (max-width: 576px) {

  .usecase-slider-section {
    margin: 2rem auto;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    padding: 1rem;
    max-width: 350px !important; /* narrower slider for mobile */
  }

  /* Stack the bar & pie chart vertically, override the desktop flex: */
  .chart-cards-row {
    display: block !important; 
  }
  .chart-cards-row .bar-chart-card,
  .chart-cards-row .pie-chart-card {
    width: 100% !important;
    max-width: 100% !important;
    margin-bottom: 1rem;
  }

  #output-programs-list {
    margin: 0 1rem;
  }

  .swiper-container {
    width: 100% !important;
    height: auto !important;
    overflow: hidden;
  }

  .swiper-slide {
    width: 100% !important;
    box-sizing: border-box; 
  }

  .usecase-slide-image {
    display: block;
    width: 100%;
    height: 200px;  
    max-height: 200px;
    object-fit: cover;
  }

  /* The “search-combo-field” or “search area” might need smaller margins: */
  .started-search-area {
    margin: 1rem 1rem !important;
  }

  .program-search-field:focus {
    outline: none !important;
    box-shadow: none !important;
    border-color: #dfe5eb !important;
  }

  .clear-all-btn {
    background-color: #dc3545 !important;
    color: #fff !important;
  }

  .point-option {
    font-size: 0.8rem !important;
    padding: 6px 12px !important;
  }

  #modal-email-input {
    width: 80% !important;
    border-radius:8px;
  }

  .popular-programs-heading {
    margin-left: 1rem !important;
    font-size: 1rem !important;
    font-weight: bold !important;
  }

  #selected-programs-label {
    margin-left: 1rem !important;
    font-size: 1rem !important;
    font-weight: bold !important;
    margin-bottom: 1rem;
    margin-top: 1rem;
  }

  #chosen-programs-row {
    margin: 0 1rem !important;
    display: flex;
    gap: 10px;
    min-height: 50px;
  }

  #top-programs-grid.top-programs-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    grid-template-rows: repeat(3, auto) !important;
    margin: 0 1rem !important;
    gap: 0.5rem !important;
  }

  .top-program-label {
    font-size: 0.75rem !important;
    line-height: 1rem !important;
  }

  .top-program-box .add-btn {
    display: none !important; /* hide the + circle on mobile if you prefer */
  }

  .top-program-box.selected-state {
    background-color: #1a2732 !important;
    border-color: #1a2732 !important;
  }

  .top-program-box.selected-state .top-program-label {
    color: #fff !important;
  }

  #calculator-state .state-header {
    margin-top: 2.5rem !important;
  }

  #calculator-state #program-container {
    margin: 0 1rem !important;
  }

  #calculator-state .program-row img {
    width: 3rem !important;
    height: auto !important;
  }

  .program-name {
    font-size: 0.75rem !important;
    line-height: 1rem !important;
  }

  .program-row,
  .output-row {
    padding: 0.5rem 0.5rem !important;
  }

  .points-input {
    width: 85px !important;
    font-size: 16px !important;
  }

  .tc-btn-row {
    margin: 2rem 1rem 0 1rem !important;
  }

  #output-programs-container {
    margin: 0 1rem !important;
  }

  .output-state-bg {
    background-color: #f5f5f5 !important; 
  }

  /* Center “Your Total Value” on #output-state despite the back btn */
  #output-state .state-header {
    position: relative !important;
    justify-content: center !important;
  }
  #output-state .state-header .back-btn {
    position: absolute !important;
    left: 1rem !important;
    margin-left: 0 !important;
  }
  #output-state .state-header .state-title {
    margin: 0 auto !important;
    text-align: center !important;
  }

  /* Use case mini-pill row => single line with horizontal scroll */
  .mini-pill-row {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    white-space: nowrap !important;
    -webkit-overflow-scrolling: touch !important;
    scroll-snap-type: x mandatory !important;
    gap: 0.3rem !important;
  }
  .mini-pill-row .mini-pill {
    flex: 0 0 auto !important;
    padding: 0.4rem 0.6rem !important;
    padding-top: 0.4rem !important;
    font-size: 0.8rem !important;
    scroll-snap-align: center !important;
    margin-right: 0 !important; 
  }
  .mini-pill-row .mini-pill.active {
    margin-right: 0.2rem !important; 
  }

  /* Bottom sheet for #report-modal on mobile */
  #report-modal-content {
    top: auto !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    border-radius: 12px 12px 0 0 !important;
    transform: translateY(100%);
    transition: transform 1.0s ease;
    max-width: 600px !important;
  }
  #report-modal.show #report-modal-content {
    transform: translateY(0);
  }

  .clear-all-btn {
    margin-right: 1rem !important;
  }
}

/*******************************************************
 * HERO & CTA
 *******************************************************/
.hero-section {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: url("https://cdn.mcauto-images-production.sendgrid.net/f5e5a6724646c174/b688c71d-4336-43a8-a54a-25d0c757a629/3000x2001.jpeg");
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 75vh;
  text-align: center;
  color: #fff;
  padding: 0 1rem;
}

.hero-cta-container {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.cta-btn {
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1.25rem;
  transition: all 0.2s ease;
}

.cta-dark {
  background-color: #1a2732;
  color: #fff;
}
.cta-dark:hover {
  background-color: #141d28;
}

.cta-no-border {
  background-color: #fff;
  color: #1a2732;
}
.cta-no-border:hover {
  background-color: #e0e0e0;
}

.cta-light-border {
  background-color: #fff;
  color: #1a2732;
  border: 2px solid #1a2732;
}
.cta-light-border:hover {
  background-color: #1a2732;
  color: #fff;
}

.cta-round {
  border-radius: 9999px;
}

/*******************************************************
 * HOW IT WORKS (HIW)
 *******************************************************/
.hiw-mobile-stack {
  padding: 50px 80px 40px;
  text-align: center;
}
@media (min-width: 992px) {
  .hiw-main-image {
    max-width: 60rem;
    margin: 0 auto;
    display: block;
  }
  .hiw-flex-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }
}
@media (max-width: 576px) {
  .hiw-flex-container {
    flex-direction: column;
  }
}
.hiw-main-image {
  width: 100%;
  border-radius: 8px;
}
.hiw-bottom-lines {
  display: flex;
  justify-content: center;
  margin-top: 4.5rem;
  gap: 8px;
}
.hiw-line {
  width: 60px;
  height: 4px;
  background-color: #ccc;
  border-radius: 2px;
  transition: background-color 0.3s;
}
.hiw-line.active-line {
  background-color: #1a2732;
}

/*******************************************************
 * STATE HEADERS => back + title
 *******************************************************/
.state-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4.5rem;
  padding: 1rem;
  background-color: #fff;
}
.state-header .state-title {
  margin: 0 auto;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
}

/*******************************************************
 * BACK BTN
 *******************************************************/
.back-btn {
  width: 24px;
  height: 24px;
  margin-right: 10px;
  background: none;
  cursor: pointer;
}
.back-btn::before {
  content: "";
  display: inline-block;
  width: 24px;
  height: 24px;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='%231a2732' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15.539 4.455c.377.364.391.979.03 1.356l-6.052 6.228 6.052 6.228c.361.377.347.992-.03 1.356-.376.362-.991.347-1.356-.03l-6.648-6.84c-.348-.358-.348-.922 0-1.28l6.648-6.84c.365-.376.98-.392 1.356-.03z'/%3E%3C/svg%3E")
    no-repeat center center;
  background-size: 24px 24px;
  transition: opacity 0.2s ease;
}
.back-btn:hover::before {
  opacity: 0.7;
}

/*******************************************************
 * STAT CARDS => “Total Points”, “Travel Value”, “Cash Value”
 *******************************************************/
.stat-cards-row {
  display: flex; /* side-by-side on desktop */
  gap: 1rem;
  margin: 1rem 0;
}

.stat-card {
  flex: 1;
  background-color: #fff;
  border: 1px solid #DFE5EB;
  border-radius: 6px;
  padding: 1rem;
  min-height: 80px;
}

.card-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1D3A5F;
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #1a2732;
}

/* If you want the icon next to the value: */
.value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-icon {
  width: 32px;
  height: auto;
  margin-left: 0.5rem;
}

@media (max-width: 576px) {
  .stat-cards-row {
    display: block; /* stack them on mobile */
  }
  .stat-card {
    margin-bottom: 1rem;
  }
}

/*******************************************************
 * POINTS INFO BOX
 *******************************************************/
.points-info-box {
  background-color: #f5f5f7;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 1rem 0;
}
.info-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  margin-top: auto;
  margin-bottom: auto;
}
.infobox-desktop-text {
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0;
}

/*******************************************************
 * SEARCH => “Combo Field” approach
 *******************************************************/
.started-search-area {
  position: relative;
  margin: 1rem 0;
}

/* Single “search bar” with input & Explore All button inside */
.search-combo-field {
  display: flex;
  align-items: center;
  border: 1px solid #DFE5EB;
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
  width: 100%;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  color: #333;
}

.search-input::placeholder {
  color: #999;
}

.explore-all-btn {
  background-color: #1a2732;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.75rem 1rem;
  border: none;
  cursor: pointer;
}
.explore-all-btn:hover {
  background-color: #141d28;
}

/* Program preview dropdown below the search bar */
#program-preview {
  display: none;
  position: absolute;
  width: 100%;
  left: 0;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-radius: 8px;
  z-index: 9999;
}
.preview-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.preview-item:hover {
  background: #f8fafd;
}

/*******************************************************
 * POPULAR PROGRAMS => top-programs-grid
 *******************************************************/
.top-programs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.top-program-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #dce3eb;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}
.top-program-box img {
  width: 40px;
  height: auto;
}
.top-program-box:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.top-program-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1a2732;
}
.add-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #aaa;
  border-radius: 50%;
  background-color: transparent;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

/*******************************************************
 * SELECTED PROGRAMS
 *******************************************************/
.selected-programs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.selected-programs-row h3 {
  /* additional styles if you want */
}
.clear-all-btn {
  display: none;
  background-color: #dc3545;
  color: #fff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
}

/*******************************************************
 * PROGRAM & OUTPUT ROWS
 *******************************************************/
.program-row,
.output-row {
  border: 1px solid #DFE5EB;
  border-radius: 6px;
  background-color: #fff;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1rem;
}
.program-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1D3A5F;
}
.remove-btn {
  background: none;
  color: #dc3545;
  font-size: 1.25rem;
}

/*******************************************************
 * DOLLAR INPUT => remove black border
 *******************************************************/
.dollar-input-container {
  border: 1px solid #DFE5EB;
  border-radius: 0.5rem;
  background-color: #fff;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
}
.points-input {
  border: none;
  outline: none;
  background-color: transparent;
  font-size: 1rem;
  padding: 0.5rem 0;
  width: 70px;
}

/*******************************************************
 * STICKY NEXT BTN
 *******************************************************/
.sticky-next-btn {
  display: block !important;
  position: static;
  margin: 2rem auto;
  padding: 0.9rem 6rem;
}

/* Default: disabled => gray */
#input-next-btn.disabled-btn,
#input-next-btn:disabled {
  background-color: #ccc !important;
  color: #fff !important;
  pointer-events: none !important;
  opacity: 0.7;
}

/* Enabled => blue background */
#input-next-btn {
  background-color: #1a2732;
  color: #fff;
  pointer-events: auto;
  opacity: 1;
}

/*******************************************************
 * TRAVEL/CASH => switch
 *******************************************************/
.tc-btn-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 1rem 0;
}
.tc-switch-btn {
  padding: 8px 16px;
  border-radius: 9999px;
  background-color: #f0f0f0;
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.tc-switch-btn:hover {
  background-color: #2e4461;
  color: #fff;
}
.tc-switch-btn.active-tc {
  background-color: #1a2732;
  color: #fff;
}

/*******************************************************
 * OUT-CTA
 *******************************************************/
.out-cta {
  font-size: 1rem;
}

/*******************************************************
 * USECASES => real-world use examples
 *******************************************************/
.points-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 40px;
}
.point-option {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  background-color: #f0f0f0;
  padding: 8px 16px;
  border-radius: 20px;
  margin: 10px 0;
  transition: background-color 0.2s;
  cursor: pointer;
}
.point-option.active,
.point-option:hover {
  background-color: #1a2732;
  color: #fff;
}
.points-view {
  display: flex;
  align-items: flex-start;
  gap: 30px;
  flex-wrap: wrap;
  justify-content: center;
}
.points-view-img {
  flex: 0 1 820px;
  max-width: 820px;
}
.image-wrapper img {
  width: 100%;
  height: auto;
  max-height: 300px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.points-view-content {
  flex: 1 1 300px;
  text-align: left;
}
.points-state-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 10px;
}
.points-state-description {
  font-size: 14px;
  line-height: 1.4;
  max-width: 400px;
}
.usecase-accordion,
.usecase-accordion .mini-pill {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/*******************************************************
 * TIP-TEXT => output
 *******************************************************/
.tip-text {
  margin: 1rem 0;
  text-align: left;
}

/*******************************************************
 * SUBMISSION TAKEOVER
 *******************************************************/
#submission-takeover {
  position: absolute;
  top: 50%; 
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255,255,255,0.95);
  z-index: 9999;
  text-align: center;
  padding: 20px;
  max-width: 50rem;
}

/*******************************************************
 * REPORT MODAL => #report-modal
 *******************************************************/
#report-modal {
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%; 
  background-color: rgba(0,0,0,0.6);
  z-index: 9999;
  display: none; /* .show => display: block */
}
#report-modal.show {
  display: block;
}
#report-modal-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  padding: 20px;
  max-width: 400px;
  width: 80%;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

#modal-close-btn {
  float: right;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

#modal-email-error {
  color: red;
  font-size: 14px;
  margin-bottom: 8px;
  text-align: center;
  display: none;
}

#email-sent-message {
  display: none;
  color: green;
  margin-top: 10px;
  font-weight: 600;
  text-align: center;
}

/*******************************************************
 * EMAIL FIELD => always has 1px border
 *******************************************************/
.email-field-container {
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 25px;
}
.email-field-container input {
  border: none;
  outline: none;
  background-color: transparent;
  width: 100%;
  font-size: 1rem;
  color: #333;
  box-sizing: border-box;
}
.email-field-container input::placeholder {
  color: #999;
}
.email-field-container:focus-within {
  border-color: #DFE5EB;
  box-shadow: 0 0 0 2px #dfe5eb;
}

/*******************************************************
 * SERVICES MODAL => #services-modal
 *******************************************************/
#services-modal {
  position: fixed;
  top: 0; 
  left: 0;
  width: 100%; 
  height: 100%;
  background-color: rgba(0,0,0,0.6);
  z-index: 9999;
  display: none; 
}
#services-modal.show {
  display: block;
}
#services-modal-content {
  position: absolute;
  top: 50%; 
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 80%;
  background: #fff;
  padding: 20px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}
#services-modal-close-btn {
  float: right;
  font-size: 24px;
  cursor: pointer;
  background: none;
  border: none;
  color: #1a2732;
  margin-top: -8px;
}
.services-iframe-container {
  width: 100%;
  height: calc(100% - 40px);
  margin-top: 20px;
}
.services-iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/*******************************************************
 * CHARTS => bar & pie side by side
 *******************************************************/
.chart-cards-row {
  display: flex;      /* side by side on desktop */
  flex-wrap: wrap;    /* can wrap on narrow screens */
  gap: 2%;
  margin-top: 1.5rem;
}

.bar-chart-card,
.pie-chart-card {
  position: relative; 
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-sizing: border-box;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Bar chart => ~60% width on desktop */
.bar-chart-card {
  flex: 0 0 60%;
  max-width: 55%;
  /* or remove these if you want it more fluid */
}

/* Pie chart => ~40% width on desktop */
.pie-chart-card {
  flex: 0 0 43%;
  max-width: 43%;
}

.bar-card-title,
.pie-card-title {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.25rem;
  color: #333;
  text-align: center;
}

/* Make the canvases scale nicely */
.bar-chart-card canvas,
.pie-chart-card canvas {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  margin: 0 auto;
}

@media (max-width: 576px) {
  .bar-chart-card,
  .pie-chart-card {
    flex: 0 0 100%;
    max-width: 100%;
    margin-bottom: 1rem;
  }
}


/*******************************************************
 * USE CASE SLIDER
 *******************************************************/
.usecase-slider-section {
  margin: 2rem auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  padding: 1rem;
  max-width: 600px;
}

/* Swiper container => full width up to 600px */
.swiper-container {
  position: relative;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  --swiper-navigation-size: 25px;
  overflow: hidden;
}

/* The top image in each slide */
.usecase-slide-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 1rem;
}

/* The text/content area below the image */
.usecase-slide-content {
  flex: 1;
  padding: 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.usecase-slide-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.usecase-slide-body {
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
}

.usecase-slide-points {
  font-size: 0.8rem;
  color: #555;
}

/* Swiper arrows => next/prev */
.swiper-button-next,
.swiper-button-prev {
  color: #333;
  top: 50%;
  transform: translateY(-50%);
}
.swiper-button-next {
  right: 10px;
  left: auto;
}
.swiper-button-prev {
  left: 10px;
  right: auto;
}
