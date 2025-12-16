// Risk Assessment management system

const STORAGE_KEY = "riskAssessmentV1";
const CCTV_STORAGE_KEY = "cctvRiskAssessmentV1";
const ACCESS_CONTROL_STORAGE_KEY = "accessControlRiskAssessmentV1";

// Helper function to get element value
const getValue = (id) => {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value || "";
};

// Helper function to set element value
const setValue = (id, value) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!value;
  } else {
    el.value = value || "";
  }
};

// Helper function to get radio button value by name
const getRadioValue = (name) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.checked) return radio.value;
  }
  return "";
};

// Helper function to set radio button value by name
const setRadioValue = (name, value) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.value === value) {
      radio.checked = true;
      break;
    }
  }
};

// Options for the second dropdown based on the first dropdown selection
const PREMISES_USE_OPTIONS = {
  domestic: [
    { value: "house", label: "House" },
    { value: "flat", label: "Flat" },
    { value: "other", label: "Other" }
  ],
  commercial: [
    { value: "office", label: "Office" },
    { value: "shop", label: "Shop" },
    { value: "warehouse", label: "Warehouse" },
    { value: "other", label: "Other" }
  ],
  industrial: [
    { value: "factory", label: "Factory" },
    { value: "chemical-petrochem", label: "Chemical/PetroChem" },
    { value: "warehouse", label: "Warehouse" },
    { value: "other", label: "Other" }
  ],
  military: [
    { value: "army", label: "Army" },
    { value: "navy", label: "Navy" },
    { value: "raf", label: "RAF" },
    { value: "other", label: "Other" }
  ],
  government: [
    { value: "public-authority", label: "Public Authority" },
    { value: "schools", label: "Schools" },
    { value: "hospital", label: "Hospital" },
    { value: "legal", label: "Legal" },
    { value: "central-government", label: "Central Government" }
  ],
  other: [
    { value: "other", label: "Other" }
  ]
};

// Updates the second dropdown based on the first dropdown selection
const updatePremisesUse2Dropdown = () => {
  const dropdown1 = document.getElementById("risk-premises-use-1");
  const dropdown2 = document.getElementById("risk-premises-use-2");
  
  if (!dropdown1 || !dropdown2) return;
  
  const selectedValue = dropdown1.value;
  const currentValue = dropdown2.value; // Save current selection
  
  // Clear existing options except "Select..."
  dropdown2.innerHTML = '<option value="">Select...</option>';
  
  // Get options for the selected value
  const options = PREMISES_USE_OPTIONS[selectedValue] || [];
  
  // Add new options
  options.forEach(option => {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    dropdown2.appendChild(optionEl);
  });
  
  // Try to restore the previous selection if it still exists
  if (currentValue && options.some(opt => opt.value === currentValue)) {
    dropdown2.value = currentValue;
  } else {
    dropdown2.value = "";
  }
};

// Saves risk assessment data to local storage
const saveRiskAssessment = () => {
  try {
    const data = {
      // Premises
      premisesType: getValue("risk-premises-type"),
      premisesUse1: getValue("risk-premises-use-1"),
      premisesUse2: getValue("risk-premises-use-2"),
      buildingType: getValue("risk-building-type"),
      construction: getValue("risk-construction"),
      roof: getValue("risk-roof"),
      occupationTimes: getValue("risk-occupation-times"),

      // User Requirements
      intruderDetection: getValue("risk-intruder-detection"),

      // Condition Assessment
      externalDoors: getValue("risk-condition-external-doors"),
      externalDoorsNotes: getValue("risk-condition-external-doors-notes"),
      externalDoorLocks: getValue("risk-condition-external-door-locks"),
      externalDoorLocksNotes: getValue("risk-condition-external-door-locks-notes"),
      windowKeyLocks: getValue("risk-condition-window-key-locks"),
      windowKeyLocksNotes: getValue("risk-condition-window-key-locks-notes"),
      windowBarsGrills: getValue("risk-condition-window-bars-grills"),
      windowBarsGrillsNotes: getValue("risk-condition-window-bars-grills-notes"),
      windowShutters: getValue("risk-condition-window-shutters"),
      windowShuttersNotes: getValue("risk-condition-window-shutters-notes"),
      otherOpenings: getValue("risk-condition-other-openings"),
      otherOpeningsNotes: getValue("risk-condition-other-openings-notes"),

      // Access
      accessFrontEase: getValue("risk-access-front-ease"),
      accessFrontNotes: getValue("risk-access-front-notes"),
      accessSide1Ease: getValue("risk-access-side1-ease"),
      accessSide1Notes: getValue("risk-access-side1-notes"),
      accessSide2Ease: getValue("risk-access-side2-ease"),
      accessSide2Notes: getValue("risk-access-side2-notes"),
      accessRearEase: getValue("risk-access-rear-ease"),
      accessRearNotes: getValue("risk-access-rear-notes"),
      accessRoofEase: getValue("risk-access-roof-ease"),
      accessRoofNotes: getValue("risk-access-roof-notes"),
      accessGarageEase: getValue("risk-access-garage-ease"),
      accessGarageNotes: getValue("risk-access-garage-notes"),
      accessShedEase: getValue("risk-access-shed-ease"),
      accessShedNotes: getValue("risk-access-shed-notes"),
      accessControlledEase: getValue("risk-access-controlled-ease"),
      accessControlledNotes: getValue("risk-access-controlled-notes"),

      // Crime Risk Assessment
      areaCrimeRating: getValue("risk-area-crime-rating"),
      insuranceGrade: getValue("risk-insurance-grade"),
      propertyLossValue: getValue("risk-property-loss-value"),
      propertyNotes: getValue("risk-property-notes"),
      stockLossValue: getValue("risk-stock-loss-value"),
      stockNotes: getValue("risk-stock-notes"),
      damageLossValue: getValue("risk-damage-loss-value"),
      damageNotes: getValue("risk-damage-notes"),
      noDiscloseCrimeTheft: getValue("risk-no-disclose-crime-theft"),

      // Risk Assessment Outcome
      environmentalGrade: getValue("risk-environmental-grade"),
      settingUnsettingMethod: getValue("risk-setting-unsetting-method"),
      signallingOption1: getValue("risk-signalling-option-1"),
      signallingOption2: getValue("risk-signalling-option-2"),
      methodOfUnsetting: getValue("risk-method-of-unsetting"),
      confirmationSequential: getValue("risk-confirmation-sequential"),
      confirmationAudio: getValue("risk-confirmation-audio"),
      confirmationVisual: getValue("risk-confirmation-visual"),
      confirmationAlarmTime: getValue("risk-confirmation-alarm-time"),
      assessedGrade: getValue("risk-assessed-grade"),
      monitoring: getValue("risk-monitoring"),
      arcName: getValue("risk-arc-name"),
      alarmResponse: getValue("risk-alarm-response"),

      savedAt: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to save risk assessment:", e);
    return false;
  }
};

// Loads risk assessment data from local storage
const loadRiskAssessment = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Premises
    setValue("risk-premises-type", data.premisesType);
    setValue("risk-premises-use-1", data.premisesUse1);
    // Update dropdown 2 options before setting its value
    updatePremisesUse2Dropdown();
    setValue("risk-premises-use-2", data.premisesUse2);
    setValue("risk-building-type", data.buildingType);
    setValue("risk-construction", data.construction);
    setValue("risk-roof", data.roof);
    setValue("risk-occupation-times", data.occupationTimes);

    // User Requirements
    setValue("risk-intruder-detection", data.intruderDetection);

    // Condition Assessment
    setValue("risk-condition-external-doors", data.externalDoors);
    setValue("risk-condition-external-doors-notes", data.externalDoorsNotes);
    setValue("risk-condition-external-door-locks", data.externalDoorLocks);
    setValue("risk-condition-external-door-locks-notes", data.externalDoorLocksNotes);
    setValue("risk-condition-window-key-locks", data.windowKeyLocks);
    setValue("risk-condition-window-key-locks-notes", data.windowKeyLocksNotes);
    setValue("risk-condition-window-bars-grills", data.windowBarsGrills);
    setValue("risk-condition-window-bars-grills-notes", data.windowBarsGrillsNotes);
    setValue("risk-condition-window-shutters", data.windowShutters);
    setValue("risk-condition-window-shutters-notes", data.windowShuttersNotes);
    setValue("risk-condition-other-openings", data.otherOpenings);
    setValue("risk-condition-other-openings-notes", data.otherOpeningsNotes);

    // Access
    setValue("risk-access-front-ease", data.accessFrontEase);
    setValue("risk-access-front-notes", data.accessFrontNotes);
    setValue("risk-access-side1-ease", data.accessSide1Ease);
    setValue("risk-access-side1-notes", data.accessSide1Notes);
    setValue("risk-access-side2-ease", data.accessSide2Ease);
    setValue("risk-access-side2-notes", data.accessSide2Notes);
    setValue("risk-access-rear-ease", data.accessRearEase);
    setValue("risk-access-rear-notes", data.accessRearNotes);
    setValue("risk-access-roof-ease", data.accessRoofEase);
    setValue("risk-access-roof-notes", data.accessRoofNotes);
    setValue("risk-access-garage-ease", data.accessGarageEase);
    setValue("risk-access-garage-notes", data.accessGarageNotes);
    setValue("risk-access-shed-ease", data.accessShedEase);
    setValue("risk-access-shed-notes", data.accessShedNotes);
    setValue("risk-access-controlled-ease", data.accessControlledEase);
    setValue("risk-access-controlled-notes", data.accessControlledNotes);

    // Crime Risk Assessment
    setValue("risk-area-crime-rating", data.areaCrimeRating);
    setValue("risk-insurance-grade", data.insuranceGrade);
    setValue("risk-property-loss-value", data.propertyLossValue);
    setValue("risk-property-notes", data.propertyNotes);
    setValue("risk-stock-loss-value", data.stockLossValue);
    setValue("risk-stock-notes", data.stockNotes);
    setValue("risk-damage-loss-value", data.damageLossValue);
    setValue("risk-damage-notes", data.damageNotes);
    setValue("risk-no-disclose-crime-theft", data.noDiscloseCrimeTheft);

    // Risk Assessment Outcome
    setValue("risk-environmental-grade", data.environmentalGrade);
    setValue("risk-setting-unsetting-method", data.settingUnsettingMethod);
    setValue("risk-signalling-option-1", data.signallingOption1);
    setValue("risk-signalling-option-2", data.signallingOption2);
    setValue("risk-method-of-unsetting", data.methodOfUnsetting);
    setValue("risk-confirmation-sequential", data.confirmationSequential);
    setValue("risk-confirmation-audio", data.confirmationAudio);
    setValue("risk-confirmation-visual", data.confirmationVisual);
    setValue("risk-confirmation-alarm-time", data.confirmationAlarmTime);
    setValue("risk-assessed-grade", data.assessedGrade);
    setValue("risk-monitoring", data.monitoring);
    setValue("risk-arc-name", data.arcName);
    setValue("risk-alarm-response", data.alarmResponse);

    return true;
  } catch (e) {
    console.error("Failed to load risk assessment:", e);
    return false;
  }
};

// Sets up the save button
const setupSaveButton = () => {
  const saveBtn = document.getElementById("save-risk-assessment-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saveRiskAssessment()) {
        // Show success feedback
        const modalEl = document.getElementById("intruder-risk-assessment-modal");
        if (modalEl) {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.hide();
          
        }
      } else {
        alert("Failed to save risk assessment. Please try again.");
      }
    });
  }
};

// Initializes the risk assessment system
const init = () => {
  setupSaveButton();
  
  // Set up dynamic dropdown behavior
  const dropdown1 = document.getElementById("risk-premises-use-1");
  if (dropdown1) {
    dropdown1.addEventListener("change", updatePremisesUse2Dropdown);
  }
  
  // Load saved data when modal opens
  const modalEl = document.getElementById("intruder-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      loadRiskAssessment();
    });
  }

  // Listen for project load events to sync localStorage
  window.addEventListener("projectLoaded", () => {
    // When a project is loaded, update localStorage with current form values
    setTimeout(() => {
      saveRiskAssessment();
    }, 500);
  });
};

// ========== CCTV Risk Assessment Functions ==========

// Saves CCTV risk assessment data to local storage
const saveCctvRiskAssessment = () => {
  try {
    const data = {
      // Premises
      premisesType: getValue("cctv-risk-premises-type"),
      openingTimes: getValue("cctv-risk-opening-times"),

      // User Requirements
      userRequirements: getValue("cctv-risk-user-requirements"),

      // Access
      accessFrontEase: getValue("cctv-risk-access-front-ease"),
      accessFrontNotes: getValue("cctv-risk-access-front-notes"),
      accessSide1Ease: getValue("cctv-risk-access-side1-ease"),
      accessSide1Notes: getValue("cctv-risk-access-side1-notes"),
      accessSide2Ease: getValue("cctv-risk-access-side2-ease"),
      accessSide2Notes: getValue("cctv-risk-access-side2-notes"),
      accessRearEase: getValue("cctv-risk-access-rear-ease"),
      accessRearNotes: getValue("cctv-risk-access-rear-notes"),
      accessRoofEase: getValue("cctv-risk-access-roof-ease"),
      accessRoofNotes: getValue("cctv-risk-access-roof-notes"),
      accessGarageEase: getValue("cctv-risk-access-garage-ease"),
      accessGarageNotes: getValue("cctv-risk-access-garage-notes"),
      accessShedEase: getValue("cctv-risk-access-shed-ease"),
      accessShedNotes: getValue("cctv-risk-access-shed-notes"),
      accessControlledEase: getValue("cctv-risk-access-controlled-ease"),
      accessControlledNotes: getValue("cctv-risk-access-controlled-notes"),

      // Crime Risk Assessment
      areaCrimeRating: getValue("cctv-risk-area-crime-rating"),
      propertyLossValue: getValue("cctv-risk-property-loss-value"),
      propertyNotes: getValue("cctv-risk-property-notes"),
      stockLossValue: getValue("cctv-risk-stock-loss-value"),
      stockNotes: getValue("cctv-risk-stock-notes"),
      damageLossValue: getValue("cctv-risk-damage-loss-value"),
      damageNotes: getValue("cctv-risk-damage-notes"),
      noDiscloseCrimeTheft: getValue("cctv-risk-no-disclose-crime-theft"),

      // CCTV VSS System Requirements
      systemRecordingDays: getValue("cctv-risk-system-recording-days"),
      recordingQuality: getValue("cctv-risk-recording-quality"),
      monitoringRequired: getRadioValue("cctv-risk-monitoring-required"),
      recordingEquipment: getValue("cctv-risk-recording-equipment"),
      approximateStorage: getValue("cctv-risk-approximate-storage"),
      networkConnectionInstalled: getRadioValue("cctv-risk-network-connection-installed"),
      networkConnectionType: getValue("cctv-risk-network-connection-type"),
      networkRouterInstalled: getRadioValue("cctv-risk-network-router-installed"),
      networkRouterType: getValue("cctv-risk-network-router-type"),
      additionalEquipmentNotes: getValue("cctv-risk-additional-equipment-notes"),

      // Risk Assessment Outcome
      vssStandard: getValue("cctv-risk-vss-standard"),
      monitoring: getValue("cctv-risk-monitoring"),
      arcName: getValue("cctv-risk-arc-name"),
      alarmResponse: getValue("cctv-risk-alarm-response"),

      savedAt: Date.now(),
    };

    localStorage.setItem(CCTV_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to save CCTV risk assessment:", e);
    return false;
  }
};

// Loads CCTV risk assessment data from local storage
const loadCctvRiskAssessment = () => {
  try {
    const raw = localStorage.getItem(CCTV_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Premises
    setValue("cctv-risk-premises-type", data.premisesType);
    setValue("cctv-risk-opening-times", data.openingTimes);

    // User Requirements
    setValue("cctv-risk-user-requirements", data.userRequirements);

    // Access
    setValue("cctv-risk-access-front-ease", data.accessFrontEase);
    setValue("cctv-risk-access-front-notes", data.accessFrontNotes);
    setValue("cctv-risk-access-side1-ease", data.accessSide1Ease);
    setValue("cctv-risk-access-side1-notes", data.accessSide1Notes);
    setValue("cctv-risk-access-side2-ease", data.accessSide2Ease);
    setValue("cctv-risk-access-side2-notes", data.accessSide2Notes);
    setValue("cctv-risk-access-rear-ease", data.accessRearEase);
    setValue("cctv-risk-access-rear-notes", data.accessRearNotes);
    setValue("cctv-risk-access-roof-ease", data.accessRoofEase);
    setValue("cctv-risk-access-roof-notes", data.accessRoofNotes);
    setValue("cctv-risk-access-garage-ease", data.accessGarageEase);
    setValue("cctv-risk-access-garage-notes", data.accessGarageNotes);
    setValue("cctv-risk-access-shed-ease", data.accessShedEase);
    setValue("cctv-risk-access-shed-notes", data.accessShedNotes);
    setValue("cctv-risk-access-controlled-ease", data.accessControlledEase);
    setValue("cctv-risk-access-controlled-notes", data.accessControlledNotes);

    // Crime Risk Assessment
    setValue("cctv-risk-area-crime-rating", data.areaCrimeRating);
    setValue("cctv-risk-property-loss-value", data.propertyLossValue);
    setValue("cctv-risk-property-notes", data.propertyNotes);
    setValue("cctv-risk-stock-loss-value", data.stockLossValue);
    setValue("cctv-risk-stock-notes", data.stockNotes);
    setValue("cctv-risk-damage-loss-value", data.damageLossValue);
    setValue("cctv-risk-damage-notes", data.damageNotes);
    setValue("cctv-risk-no-disclose-crime-theft", data.noDiscloseCrimeTheft);

    // CCTV VSS System Requirements
    setValue("cctv-risk-system-recording-days", data.systemRecordingDays);
    setValue("cctv-risk-recording-quality", data.recordingQuality);
    setRadioValue("cctv-risk-monitoring-required", data.monitoringRequired);
    setValue("cctv-risk-recording-equipment", data.recordingEquipment);
    setValue("cctv-risk-approximate-storage", data.approximateStorage);
    setRadioValue("cctv-risk-network-connection-installed", data.networkConnectionInstalled);
    setValue("cctv-risk-network-connection-type", data.networkConnectionType);
    setRadioValue("cctv-risk-network-router-installed", data.networkRouterInstalled);
    setValue("cctv-risk-network-router-type", data.networkRouterType);
    setValue("cctv-risk-additional-equipment-notes", data.additionalEquipmentNotes);

    // Risk Assessment Outcome
    setValue("cctv-risk-vss-standard", data.vssStandard);
    setValue("cctv-risk-monitoring", data.monitoring);
    setValue("cctv-risk-arc-name", data.arcName);
    setValue("cctv-risk-alarm-response", data.alarmResponse);

    return true;
  } catch (e) {
    console.error("Failed to load CCTV risk assessment:", e);
    return false;
  }
};

// Sets up the CCTV save button
const setupCctvSaveButton = () => {
  const saveBtn = document.getElementById("save-cctv-risk-assessment-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saveCctvRiskAssessment()) {
        // Show success feedback
        const modalEl = document.getElementById("cctv-risk-assessment-modal");
        if (modalEl) {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.hide();
          
        }
      } else {
        alert("Failed to save CCTV risk assessment. Please try again.");
      }
    });
  }
};

// Initializes the CCTV risk assessment system
const initCctv = () => {
  setupCctvSaveButton();
  
  // Load saved data when modal opens
  const modalEl = document.getElementById("cctv-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      loadCctvRiskAssessment();
    });
  }

  // Listen for project load events to sync localStorage
  window.addEventListener("projectLoaded", () => {
    // When a project is loaded, update localStorage with current form values
    setTimeout(() => {
      saveCctvRiskAssessment();
    }, 500);
  });
};

// ========== Access Control Risk Assessment Functions ==========

// Access points array to store dynamically added access points
let accessControlAccessPoints = [];
// Make it globally accessible for serialization
window.accessControlAccessPoints = accessControlAccessPoints;

// Adds an access point to the table
const addAccessControlAccessPoint = () => {
  const nameInput = document.getElementById("access-control-risk-new-access-point");
  const classificationSelect = document.getElementById("access-control-risk-new-classification");
  const optionRadios = document.querySelectorAll('input[name="access-control-risk-new-option"]:checked');
  
  const name = nameInput?.value.trim();
  const classification = classificationSelect?.value;
  const option = optionRadios.length > 0 ? optionRadios[0].value : "";
  
  if (!name) {
    alert("Please enter an access point/door name.");
    return;
  }
  
  if (!classification) {
    alert("Please select a classification.");
    return;
  }
  
  const tbody = document.getElementById("access-control-risk-access-points-tbody");
  if (!tbody) return;
  
  // Create new row
  const row = document.createElement("tr");
  const rowId = `access-point-${Date.now()}`;
  row.id = rowId;
  
  // Format classification display
  const classificationLabels = {
    "class-i": "Class I",
    "class-ii": "Class II",
    "class-iii": "Class III",
    "class-iv": "Class IV"
  };
  
  const optionLabels = {
    "a": "Option A",
    "b": "Option B",
    "na": "N/A"
  };
  
  row.innerHTML = `
    <td>${name}</td>
    <td>${classificationLabels[classification] || classification}</td>
    <td>${optionLabels[option] || option.toUpperCase()}</td>
    <td>
      <button type="button" class="btn btn-sm text-white" style="background-color: #007bff; padding: 0.25rem 0.5rem;" onclick="removeAccessControlAccessPoint('${rowId}')">X</button>
    </td>
  `;
  
  // Store the data
  const accessPoint = {
    id: rowId,
    name: name,
    classification: classification,
    option: option
  };
  accessControlAccessPoints.push(accessPoint);
  window.accessControlAccessPoints = accessControlAccessPoints;
  
  tbody.appendChild(row);
  
  // Clear input fields
  nameInput.value = "";
  classificationSelect.value = "";
  // Reset radio buttons
  const naRadio = document.getElementById("access-control-risk-new-option-na");
  if (naRadio) naRadio.checked = true;
};

// Removes an access point from the table
window.removeAccessControlAccessPoint = (rowId) => {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    accessControlAccessPoints = accessControlAccessPoints.filter(ap => ap.id !== rowId);
    window.accessControlAccessPoints = accessControlAccessPoints;
  }
};

// Saves Access Control risk assessment data to local storage
const saveAccessControlRiskAssessment = () => {
  try {
    const data = {
      // Premises
      premisesType: getValue("access-control-risk-premises-type"),
      openingTimes: getValue("access-control-risk-opening-times"),

      // User Requirements
      userRequirements: getValue("access-control-risk-user-requirements"),

      // Access
      accessFrontEase: getValue("access-control-risk-access-front-ease"),
      accessFrontNotes: getValue("access-control-risk-access-front-notes"),
      accessSide1Ease: getValue("access-control-risk-access-side1-ease"),
      accessSide1Notes: getValue("access-control-risk-access-side1-notes"),
      accessSide2Ease: getValue("access-control-risk-access-side2-ease"),
      accessSide2Notes: getValue("access-control-risk-access-side2-notes"),
      accessRearEase: getValue("access-control-risk-access-rear-ease"),
      accessRearNotes: getValue("access-control-risk-access-rear-notes"),
      accessRoofEase: getValue("access-control-risk-access-roof-ease"),
      accessRoofNotes: getValue("access-control-risk-access-roof-notes"),
      accessGarageEase: getValue("access-control-risk-access-garage-ease"),
      accessGarageNotes: getValue("access-control-risk-access-garage-notes"),
      accessShedEase: getValue("access-control-risk-access-shed-ease"),
      accessShedNotes: getValue("access-control-risk-access-shed-notes"),
      accessControlledEase: getValue("access-control-risk-access-controlled-ease"),
      accessControlledNotes: getValue("access-control-risk-access-controlled-notes"),

      // Crime Risk Assessment
      areaCrimeRating: getValue("access-control-risk-area-crime-rating"),
      insuranceGrade: getValue("access-control-risk-insurance-grade"),
      propertyLossValue: getValue("access-control-risk-property-loss-value"),
      propertyNotes: getValue("access-control-risk-property-notes"),
      stockLossValue: getValue("access-control-risk-stock-loss-value"),
      stockNotes: getValue("access-control-risk-stock-notes"),
      damageLossValue: getValue("access-control-risk-damage-loss-value"),
      damageNotes: getValue("access-control-risk-damage-notes"),
      noDiscloseCrimeTheft: getValue("access-control-risk-no-disclose-crime-theft"),

      // Reference Points
      drawingSupplied: getRadioValue("access-control-risk-drawing-supplied"),
      drawingNumber: getValue("access-control-risk-drawing-number"),
      drawingDate: getValue("access-control-risk-drawing-date"),
      drawingRevision: getValue("access-control-risk-drawing-revision"),
      note1Applicable: getRadioValue("access-control-risk-note1-applicable"),
      note2Applicable: getRadioValue("access-control-risk-note2-applicable"),
      note3Applicable: getRadioValue("access-control-risk-note3-applicable"),
      note4Applicable: getRadioValue("access-control-risk-note4-applicable"),

      // Access Points
      accessPoints: accessControlAccessPoints,

      // Risk Assessment Outcome
      environmentalGrade: getValue("access-control-risk-environmental-grade"),
      settingUnsettingMethod: getValue("access-control-risk-setting-unsetting-method"),
      signallingOption1: getValue("access-control-risk-signalling-option-1"),
      signallingOption2: getValue("access-control-risk-signalling-option-2"),
      methodOfUnsetting: getValue("access-control-risk-method-of-unsetting"),
      confirmationSequential: getValue("access-control-risk-confirmation-sequential"),
      confirmationAudio: getValue("access-control-risk-confirmation-audio"),
      confirmationVisual: getValue("access-control-risk-confirmation-visual"),
      confirmationAlarmTime: getValue("access-control-risk-confirmation-alarm-time"),
      monitoring: getValue("access-control-risk-monitoring"),
      arcName: getValue("access-control-risk-arc-name"),
      alarmResponse: getValue("access-control-risk-alarm-response"),

      savedAt: Date.now(),
    };

    localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to save Access Control risk assessment:", e);
    return false;
  }
};

// Loads Access Control risk assessment data from local storage
const loadAccessControlRiskAssessment = () => {
  try {
    const raw = localStorage.getItem(ACCESS_CONTROL_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Premises
    setValue("access-control-risk-premises-type", data.premisesType);
    setValue("access-control-risk-opening-times", data.openingTimes);

    // User Requirements
    setValue("access-control-risk-user-requirements", data.userRequirements);

    // Access
    setValue("access-control-risk-access-front-ease", data.accessFrontEase);
    setValue("access-control-risk-access-front-notes", data.accessFrontNotes);
    setValue("access-control-risk-access-side1-ease", data.accessSide1Ease);
    setValue("access-control-risk-access-side1-notes", data.accessSide1Notes);
    setValue("access-control-risk-access-side2-ease", data.accessSide2Ease);
    setValue("access-control-risk-access-side2-notes", data.accessSide2Notes);
    setValue("access-control-risk-access-rear-ease", data.accessRearEase);
    setValue("access-control-risk-access-rear-notes", data.accessRearNotes);
    setValue("access-control-risk-access-roof-ease", data.accessRoofEase);
    setValue("access-control-risk-access-roof-notes", data.accessRoofNotes);
    setValue("access-control-risk-access-garage-ease", data.accessGarageEase);
    setValue("access-control-risk-access-garage-notes", data.accessGarageNotes);
    setValue("access-control-risk-access-shed-ease", data.accessShedEase);
    setValue("access-control-risk-access-shed-notes", data.accessShedNotes);
    setValue("access-control-risk-access-controlled-ease", data.accessControlledEase);
    setValue("access-control-risk-access-controlled-notes", data.accessControlledNotes);

    // Crime Risk Assessment
    setValue("access-control-risk-area-crime-rating", data.areaCrimeRating);
    setValue("access-control-risk-insurance-grade", data.insuranceGrade);
    setValue("access-control-risk-property-loss-value", data.propertyLossValue);
    setValue("access-control-risk-property-notes", data.propertyNotes);
    setValue("access-control-risk-stock-loss-value", data.stockLossValue);
    setValue("access-control-risk-stock-notes", data.stockNotes);
    setValue("access-control-risk-damage-loss-value", data.damageLossValue);
    setValue("access-control-risk-damage-notes", data.damageNotes);
    setValue("access-control-risk-no-disclose-crime-theft", data.noDiscloseCrimeTheft);

    // Reference Points
    setRadioValue("access-control-risk-drawing-supplied", data.drawingSupplied);
    setValue("access-control-risk-drawing-number", data.drawingNumber);
    setValue("access-control-risk-drawing-date", data.drawingDate);
    setValue("access-control-risk-drawing-revision", data.drawingRevision);
    setRadioValue("access-control-risk-note1-applicable", data.note1Applicable);
    setRadioValue("access-control-risk-note2-applicable", data.note2Applicable);
    setRadioValue("access-control-risk-note3-applicable", data.note3Applicable);
    setRadioValue("access-control-risk-note4-applicable", data.note4Applicable);

    // Access Points - restore from saved data
    if (data.accessPoints && Array.isArray(data.accessPoints)) {
      accessControlAccessPoints = [];
      window.accessControlAccessPoints = accessControlAccessPoints;
      const tbody = document.getElementById("access-control-risk-access-points-tbody");
      if (tbody) {
        tbody.innerHTML = "";
        data.accessPoints.forEach(ap => {
          const row = document.createElement("tr");
          row.id = ap.id;
          
          const classificationLabels = {
            "class-i": "Class I",
            "class-ii": "Class II",
            "class-iii": "Class III",
            "class-iv": "Class IV"
          };
          
          const optionLabels = {
            "a": "Option A",
            "b": "Option B",
            "na": "N/A"
          };
          
          row.innerHTML = `
            <td>${ap.name}</td>
            <td>${classificationLabels[ap.classification] || ap.classification}</td>
            <td>${optionLabels[ap.option] || ap.option.toUpperCase()}</td>
            <td>
              <button type="button" class="btn btn-sm text-white" style="background-color: #007bff; padding: 0.25rem 0.5rem;" onclick="removeAccessControlAccessPoint('${ap.id}')">X</button>
            </td>
          `;
          
          tbody.appendChild(row);
          accessControlAccessPoints.push(ap);
        });
        window.accessControlAccessPoints = accessControlAccessPoints;
      }
    }

    // Risk Assessment Outcome
    setValue("access-control-risk-environmental-grade", data.environmentalGrade);
    setValue("access-control-risk-setting-unsetting-method", data.settingUnsettingMethod);
    setValue("access-control-risk-signalling-option-1", data.signallingOption1);
    setValue("access-control-risk-signalling-option-2", data.signallingOption2);
    setValue("access-control-risk-method-of-unsetting", data.methodOfUnsetting);
    setValue("access-control-risk-confirmation-sequential", data.confirmationSequential);
    setValue("access-control-risk-confirmation-audio", data.confirmationAudio);
    setValue("access-control-risk-confirmation-visual", data.confirmationVisual);
    setValue("access-control-risk-confirmation-alarm-time", data.confirmationAlarmTime);
    setValue("access-control-risk-monitoring", data.monitoring);
    setValue("access-control-risk-arc-name", data.arcName);
    setValue("access-control-risk-alarm-response", data.alarmResponse);

    return true;
  } catch (e) {
    console.error("Failed to load Access Control risk assessment:", e);
    return false;
  }
};

// Sets up the Access Control save button
const setupAccessControlSaveButton = () => {
  const saveBtn = document.getElementById("save-access-control-risk-assessment-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saveAccessControlRiskAssessment()) {
        // Show success feedback
        const modalEl = document.getElementById("access-control-risk-assessment-modal");
        if (modalEl) {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.hide();
          
        }
      } else {
        alert("Failed to save Access Control risk assessment. Please try again.");
      }
    });
  }
};

// Initializes the Access Control risk assessment system
const initAccessControl = () => {
  setupAccessControlSaveButton();
  
  // Setup Add Access Point button
  const addBtn = document.getElementById("access-control-risk-add-access-point-btn");
  if (addBtn) {
    addBtn.addEventListener("click", addAccessControlAccessPoint);
  }
  
  // Load saved data when modal opens
  const modalEl = document.getElementById("access-control-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      loadAccessControlRiskAssessment();
    });
  }

  // Listen for project load events to sync localStorage
  window.addEventListener("projectLoaded", () => {
    // When a project is loaded, update localStorage with current form values
    setTimeout(() => {
      saveAccessControlRiskAssessment();
    }, 500);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  init();
  initCctv();
  initAccessControl();
});
