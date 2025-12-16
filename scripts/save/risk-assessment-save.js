// Risk Assessment Save/Load Functions
// Handles serialization and loading of all risk assessment forms

// Helper function to get element value
const getValue = (id) => {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value || "";
};

// Helper function to get radio button value by name
const getRadioValue = (name) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.checked) return radio.value;
  }
  return "";
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

// ========== Intruder Risk Assessment ==========

// Saves Intruder risk assessment data from form fields
export const serializeRiskAssessment = () => {
  return {
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
  };
};

// Loads Intruder risk assessment data into form fields
export const loadRiskAssessmentToSidebar = async (riskAssessment) => {
  try {
    if (!riskAssessment) return;

    // Premises
    setValue("risk-premises-type", riskAssessment.premisesType);
    setValue("risk-premises-use-1", riskAssessment.premisesUse1);
    setValue("risk-premises-use-2", riskAssessment.premisesUse2);
    setValue("risk-building-type", riskAssessment.buildingType);
    setValue("risk-construction", riskAssessment.construction);
    setValue("risk-roof", riskAssessment.roof);
    setValue("risk-occupation-times", riskAssessment.occupationTimes);

    // User Requirements
    setValue("risk-intruder-detection", riskAssessment.intruderDetection);

    // Condition Assessment
    setValue("risk-condition-external-doors", riskAssessment.externalDoors);
    setValue("risk-condition-external-doors-notes", riskAssessment.externalDoorsNotes);
    setValue("risk-condition-external-door-locks", riskAssessment.externalDoorLocks);
    setValue("risk-condition-external-door-locks-notes", riskAssessment.externalDoorLocksNotes);
    setValue("risk-condition-window-key-locks", riskAssessment.windowKeyLocks);
    setValue("risk-condition-window-key-locks-notes", riskAssessment.windowKeyLocksNotes);
    setValue("risk-condition-window-bars-grills", riskAssessment.windowBarsGrills);
    setValue("risk-condition-window-bars-grills-notes", riskAssessment.windowBarsGrillsNotes);
    setValue("risk-condition-window-shutters", riskAssessment.windowShutters);
    setValue("risk-condition-window-shutters-notes", riskAssessment.windowShuttersNotes);
    setValue("risk-condition-other-openings", riskAssessment.otherOpenings);
    setValue("risk-condition-other-openings-notes", riskAssessment.otherOpeningsNotes);

    // Access
    setValue("risk-access-front-ease", riskAssessment.accessFrontEase);
    setValue("risk-access-front-notes", riskAssessment.accessFrontNotes);
    setValue("risk-access-side1-ease", riskAssessment.accessSide1Ease);
    setValue("risk-access-side1-notes", riskAssessment.accessSide1Notes);
    setValue("risk-access-side2-ease", riskAssessment.accessSide2Ease);
    setValue("risk-access-side2-notes", riskAssessment.accessSide2Notes);
    setValue("risk-access-rear-ease", riskAssessment.accessRearEase);
    setValue("risk-access-rear-notes", riskAssessment.accessRearNotes);
    setValue("risk-access-roof-ease", riskAssessment.accessRoofEase);
    setValue("risk-access-roof-notes", riskAssessment.accessRoofNotes);
    setValue("risk-access-garage-ease", riskAssessment.accessGarageEase);
    setValue("risk-access-garage-notes", riskAssessment.accessGarageNotes);
    setValue("risk-access-shed-ease", riskAssessment.accessShedEase);
    setValue("risk-access-shed-notes", riskAssessment.accessShedNotes);
    setValue("risk-access-controlled-ease", riskAssessment.accessControlledEase);
    setValue("risk-access-controlled-notes", riskAssessment.accessControlledNotes);

    // Crime Risk Assessment
    setValue("risk-area-crime-rating", riskAssessment.areaCrimeRating);
    setValue("risk-insurance-grade", riskAssessment.insuranceGrade);
    setValue("risk-property-loss-value", riskAssessment.propertyLossValue);
    setValue("risk-property-notes", riskAssessment.propertyNotes);
    setValue("risk-stock-loss-value", riskAssessment.stockLossValue);
    setValue("risk-stock-notes", riskAssessment.stockNotes);
    setValue("risk-damage-loss-value", riskAssessment.damageLossValue);
    setValue("risk-damage-notes", riskAssessment.damageNotes);
    setValue("risk-no-disclose-crime-theft", riskAssessment.noDiscloseCrimeTheft);

    // Risk Assessment Outcome
    setValue("risk-environmental-grade", riskAssessment.environmentalGrade);
    setValue("risk-setting-unsetting-method", riskAssessment.settingUnsettingMethod);
    setValue("risk-signalling-option-1", riskAssessment.signallingOption1);
    setValue("risk-signalling-option-2", riskAssessment.signallingOption2);
    setValue("risk-method-of-unsetting", riskAssessment.methodOfUnsetting);
    setValue("risk-confirmation-sequential", riskAssessment.confirmationSequential);
    setValue("risk-confirmation-audio", riskAssessment.confirmationAudio);
    setValue("risk-confirmation-visual", riskAssessment.confirmationVisual);
    setValue("risk-confirmation-alarm-time", riskAssessment.confirmationAlarmTime);
    setValue("risk-assessed-grade", riskAssessment.assessedGrade);
    setValue("risk-monitoring", riskAssessment.monitoring);
    setValue("risk-arc-name", riskAssessment.arcName);
    setValue("risk-alarm-response", riskAssessment.alarmResponse);

    // Also update localStorage so the modal can load it independently
    try {
      const STORAGE_KEY = "riskAssessmentV1";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(riskAssessment));
    } catch (e) {
      console.warn("Failed to sync risk assessment to localStorage:", e);
    }
  } catch (error) {
    console.error("Error loading risk assessment to sidebar:", error);
  }
};

// ========== CCTV Risk Assessment ==========

// Saves CCTV risk assessment data from form fields
export const serializeCctvRiskAssessment = () => {
  return {
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
  };
};

// Loads CCTV risk assessment data into form fields
export const loadCctvRiskAssessmentToSidebar = async (cctvRiskAssessment) => {
  try {
    if (!cctvRiskAssessment) return;

    // Premises
    setValue("cctv-risk-premises-type", cctvRiskAssessment.premisesType);
    setValue("cctv-risk-opening-times", cctvRiskAssessment.openingTimes);

    // User Requirements
    setValue("cctv-risk-user-requirements", cctvRiskAssessment.userRequirements);

    // Access
    setValue("cctv-risk-access-front-ease", cctvRiskAssessment.accessFrontEase);
    setValue("cctv-risk-access-front-notes", cctvRiskAssessment.accessFrontNotes);
    setValue("cctv-risk-access-side1-ease", cctvRiskAssessment.accessSide1Ease);
    setValue("cctv-risk-access-side1-notes", cctvRiskAssessment.accessSide1Notes);
    setValue("cctv-risk-access-side2-ease", cctvRiskAssessment.accessSide2Ease);
    setValue("cctv-risk-access-side2-notes", cctvRiskAssessment.accessSide2Notes);
    setValue("cctv-risk-access-rear-ease", cctvRiskAssessment.accessRearEase);
    setValue("cctv-risk-access-rear-notes", cctvRiskAssessment.accessRearNotes);
    setValue("cctv-risk-access-roof-ease", cctvRiskAssessment.accessRoofEase);
    setValue("cctv-risk-access-roof-notes", cctvRiskAssessment.accessRoofNotes);
    setValue("cctv-risk-access-garage-ease", cctvRiskAssessment.accessGarageEase);
    setValue("cctv-risk-access-garage-notes", cctvRiskAssessment.accessGarageNotes);
    setValue("cctv-risk-access-shed-ease", cctvRiskAssessment.accessShedEase);
    setValue("cctv-risk-access-shed-notes", cctvRiskAssessment.accessShedNotes);
    setValue("cctv-risk-access-controlled-ease", cctvRiskAssessment.accessControlledEase);
    setValue("cctv-risk-access-controlled-notes", cctvRiskAssessment.accessControlledNotes);

    // Crime Risk Assessment
    setValue("cctv-risk-area-crime-rating", cctvRiskAssessment.areaCrimeRating);
    setValue("cctv-risk-property-loss-value", cctvRiskAssessment.propertyLossValue);
    setValue("cctv-risk-property-notes", cctvRiskAssessment.propertyNotes);
    setValue("cctv-risk-stock-loss-value", cctvRiskAssessment.stockLossValue);
    setValue("cctv-risk-stock-notes", cctvRiskAssessment.stockNotes);
    setValue("cctv-risk-damage-loss-value", cctvRiskAssessment.damageLossValue);
    setValue("cctv-risk-damage-notes", cctvRiskAssessment.damageNotes);
    setValue("cctv-risk-no-disclose-crime-theft", cctvRiskAssessment.noDiscloseCrimeTheft);

    // CCTV VSS System Requirements
    setValue("cctv-risk-system-recording-days", cctvRiskAssessment.systemRecordingDays);
    setValue("cctv-risk-recording-quality", cctvRiskAssessment.recordingQuality);
    setRadioValue("cctv-risk-monitoring-required", cctvRiskAssessment.monitoringRequired);
    setValue("cctv-risk-recording-equipment", cctvRiskAssessment.recordingEquipment);
    setValue("cctv-risk-approximate-storage", cctvRiskAssessment.approximateStorage);
    setRadioValue("cctv-risk-network-connection-installed", cctvRiskAssessment.networkConnectionInstalled);
    setValue("cctv-risk-network-connection-type", cctvRiskAssessment.networkConnectionType);
    setRadioValue("cctv-risk-network-router-installed", cctvRiskAssessment.networkRouterInstalled);
    setValue("cctv-risk-network-router-type", cctvRiskAssessment.networkRouterType);
    setValue("cctv-risk-additional-equipment-notes", cctvRiskAssessment.additionalEquipmentNotes);

    // Risk Assessment Outcome
    setValue("cctv-risk-vss-standard", cctvRiskAssessment.vssStandard);
    setValue("cctv-risk-monitoring", cctvRiskAssessment.monitoring);
    setValue("cctv-risk-arc-name", cctvRiskAssessment.arcName);
    setValue("cctv-risk-alarm-response", cctvRiskAssessment.alarmResponse);

    // Also update localStorage so the modal can load it independently
    try {
      const STORAGE_KEY = "cctvRiskAssessmentV1";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cctvRiskAssessment));
    } catch (e) {
      console.warn("Failed to sync CCTV risk assessment to localStorage:", e);
    }
  } catch (error) {
    console.error("Error loading CCTV risk assessment to sidebar:", error);
  }
};

// ========== Access Control Risk Assessment ==========

// Saves Access Control risk assessment data from form fields
export const serializeAccessControlRiskAssessment = () => {
  // Get access points from the global variable (preferred) or from the table
  let accessPoints = [];
  if (window.accessControlAccessPoints && Array.isArray(window.accessControlAccessPoints)) {
    accessPoints = window.accessControlAccessPoints;
  } else {
    // Fallback: read from the table
    const tbody = document.getElementById("access-control-risk-access-points-tbody");
    if (tbody) {
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 3) {
          const name = cells[0].textContent.trim();
          const classificationText = cells[1].textContent.trim();
          const optionText = cells[2].textContent.trim();
          
          // Convert display text back to values
          const classificationMap = {
            "Class I": "class-i",
            "Class II": "class-ii",
            "Class III": "class-iii",
            "Class IV": "class-iv"
          };
          const optionMap = {
            "Option A": "a",
            "Option B": "b",
            "N/A": "na"
          };
          
          accessPoints.push({
            id: row.id,
            name: name,
            classification: classificationMap[classificationText] || classificationText.toLowerCase().replace(/\s+/g, "-"),
            option: optionMap[optionText] || optionText.toLowerCase()
          });
        }
      });
    }
  }

  return {
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
    accessPoints: accessPoints,

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
  };
};

// Loads Access Control risk assessment data into form fields
export const loadAccessControlRiskAssessmentToSidebar = async (accessControlRiskAssessment) => {
  try {
    if (!accessControlRiskAssessment) return;

    // Premises
    setValue("access-control-risk-premises-type", accessControlRiskAssessment.premisesType);
    setValue("access-control-risk-opening-times", accessControlRiskAssessment.openingTimes);

    // User Requirements
    setValue("access-control-risk-user-requirements", accessControlRiskAssessment.userRequirements);

    // Access
    setValue("access-control-risk-access-front-ease", accessControlRiskAssessment.accessFrontEase);
    setValue("access-control-risk-access-front-notes", accessControlRiskAssessment.accessFrontNotes);
    setValue("access-control-risk-access-side1-ease", accessControlRiskAssessment.accessSide1Ease);
    setValue("access-control-risk-access-side1-notes", accessControlRiskAssessment.accessSide1Notes);
    setValue("access-control-risk-access-side2-ease", accessControlRiskAssessment.accessSide2Ease);
    setValue("access-control-risk-access-side2-notes", accessControlRiskAssessment.accessSide2Notes);
    setValue("access-control-risk-access-rear-ease", accessControlRiskAssessment.accessRearEase);
    setValue("access-control-risk-access-rear-notes", accessControlRiskAssessment.accessRearNotes);
    setValue("access-control-risk-access-roof-ease", accessControlRiskAssessment.accessRoofEase);
    setValue("access-control-risk-access-roof-notes", accessControlRiskAssessment.accessRoofNotes);
    setValue("access-control-risk-access-garage-ease", accessControlRiskAssessment.accessGarageEase);
    setValue("access-control-risk-access-garage-notes", accessControlRiskAssessment.accessGarageNotes);
    setValue("access-control-risk-access-shed-ease", accessControlRiskAssessment.accessShedEase);
    setValue("access-control-risk-access-shed-notes", accessControlRiskAssessment.accessShedNotes);
    setValue("access-control-risk-access-controlled-ease", accessControlRiskAssessment.accessControlledEase);
    setValue("access-control-risk-access-controlled-notes", accessControlRiskAssessment.accessControlledNotes);

    // Crime Risk Assessment
    setValue("access-control-risk-area-crime-rating", accessControlRiskAssessment.areaCrimeRating);
    setValue("access-control-risk-insurance-grade", accessControlRiskAssessment.insuranceGrade);
    setValue("access-control-risk-property-loss-value", accessControlRiskAssessment.propertyLossValue);
    setValue("access-control-risk-property-notes", accessControlRiskAssessment.propertyNotes);
    setValue("access-control-risk-stock-loss-value", accessControlRiskAssessment.stockLossValue);
    setValue("access-control-risk-stock-notes", accessControlRiskAssessment.stockNotes);
    setValue("access-control-risk-damage-loss-value", accessControlRiskAssessment.damageLossValue);
    setValue("access-control-risk-damage-notes", accessControlRiskAssessment.damageNotes);
    setValue("access-control-risk-no-disclose-crime-theft", accessControlRiskAssessment.noDiscloseCrimeTheft);

    // Reference Points
    setRadioValue("access-control-risk-drawing-supplied", accessControlRiskAssessment.drawingSupplied);
    setValue("access-control-risk-drawing-number", accessControlRiskAssessment.drawingNumber);
    setValue("access-control-risk-drawing-date", accessControlRiskAssessment.drawingDate);
    setValue("access-control-risk-drawing-revision", accessControlRiskAssessment.drawingRevision);
    setRadioValue("access-control-risk-note1-applicable", accessControlRiskAssessment.note1Applicable);
    setRadioValue("access-control-risk-note2-applicable", accessControlRiskAssessment.note2Applicable);
    setRadioValue("access-control-risk-note3-applicable", accessControlRiskAssessment.note3Applicable);
    setRadioValue("access-control-risk-note4-applicable", accessControlRiskAssessment.note4Applicable);

    // Access Points - restore from saved data
    if (accessControlRiskAssessment.accessPoints && Array.isArray(accessControlRiskAssessment.accessPoints)) {
      const tbody = document.getElementById("access-control-risk-access-points-tbody");
      if (tbody) {
        tbody.innerHTML = "";
        // Update global variable
        if (window.accessControlAccessPoints !== undefined) {
          window.accessControlAccessPoints = accessControlRiskAssessment.accessPoints;
        }
        accessControlRiskAssessment.accessPoints.forEach(ap => {
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
        });
      }
    }

    // Risk Assessment Outcome
    setValue("access-control-risk-environmental-grade", accessControlRiskAssessment.environmentalGrade);
    setValue("access-control-risk-setting-unsetting-method", accessControlRiskAssessment.settingUnsettingMethod);
    setValue("access-control-risk-signalling-option-1", accessControlRiskAssessment.signallingOption1);
    setValue("access-control-risk-signalling-option-2", accessControlRiskAssessment.signallingOption2);
    setValue("access-control-risk-method-of-unsetting", accessControlRiskAssessment.methodOfUnsetting);
    setValue("access-control-risk-confirmation-sequential", accessControlRiskAssessment.confirmationSequential);
    setValue("access-control-risk-confirmation-audio", accessControlRiskAssessment.confirmationAudio);
    setValue("access-control-risk-confirmation-visual", accessControlRiskAssessment.confirmationVisual);
    setValue("access-control-risk-confirmation-alarm-time", accessControlRiskAssessment.confirmationAlarmTime);
    setValue("access-control-risk-monitoring", accessControlRiskAssessment.monitoring);
    setValue("access-control-risk-arc-name", accessControlRiskAssessment.arcName);
    setValue("access-control-risk-alarm-response", accessControlRiskAssessment.alarmResponse);

    // Also update localStorage so the modal can load it independently
    try {
      const STORAGE_KEY = "accessControlRiskAssessmentV1";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accessControlRiskAssessment));
    } catch (e) {
      console.warn("Failed to sync Access Control risk assessment to localStorage:", e);
    }
  } catch (error) {
    console.error("Error loading Access Control risk assessment to sidebar:", error);
  }
};

