// Get value from an input element by ID
export const getValue = (id) => {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value || "";
};

// Set value for an input element by ID
export const setValue = (id, value) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!value;
  } else {
    el.value = value || "";
  }
};

// Get value from a group of radio buttons by name
export const getRadioValue = (name) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.checked) return radio.value;
  }
  return "";
};

// Set value for a group of radio buttons by name
export const setRadioValue = (name, value) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.value === value) {
      radio.checked = true;
      break;
    }
  }
};

// Options for intruder premises use dropdowns
const PREMISES_USE_OPTIONS = {
  domestic: [
    { value: "house", label: "House" },
    { value: "flat", label: "Flat" },
    { value: "bungalow", label: "Bungalow" },
    { value: "other", label: "Other" },
  ],
  commercial: [
    { value: "office", label: "Office" },
    { value: "shop", label: "Shop" },
    { value: "warehouse", label: "Warehouse" },
    { value: "other", label: "Other" },
  ],
  industrial: [
    { value: "factory", label: "Factory" },
    { value: "chemical-petrochem", label: "Chemical/PetroChem" },
    { value: "warehouse", label: "Warehouse" },
    { value: "other", label: "Other" },
  ],
  military: [
    { value: "army", label: "Army" },
    { value: "navy", label: "Navy" },
    { value: "raf", label: "RAF" },
    { value: "other", label: "Other" },
  ],
  government: [
    { value: "public-authority", label: "Public Authority" },
    { value: "schools", label: "Schools" },
    { value: "hospital", label: "Hospital" },
    { value: "legal", label: "Legal" },
    { value: "central-government", label: "Central Government" },
  ],
  other: [{ value: "other", label: "Other" }],
};

// Update the second premises use dropdown based on the first selection
const updateIntruderPremisesUse2 = () => {
  const dropdown1 = document.getElementById("risk-premises-use-1");
  const dropdown2 = document.getElementById("risk-premises-use-2");
  if (!dropdown1 || !dropdown2) return;

  const selectedValue = dropdown1.value;
  const currentValue = dropdown2.value;
  dropdown2.innerHTML = '<option value="">Select...</option>';
  const options = PREMISES_USE_OPTIONS[selectedValue] || [];
  options.forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    dropdown2.appendChild(optionEl);
  });
  if (currentValue && options.some((opt) => opt.value === currentValue)) {
    dropdown2.value = currentValue;
  } else {
    dropdown2.value = "";
  }
};

// Initialize intruder risk assessment modal and events
const initIntruderRisk = () => {
  const dropdown1 = document.getElementById("risk-premises-use-1");
  if (dropdown1) dropdown1.addEventListener("change", updateIntruderPremisesUse2);

  const modalEl = document.getElementById("intruder-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateIntruderPremisesUse2();
      updateIntruderRiskTable();
      updateConditionAssessmentTable("risk-condition-assessment-tbody", "intruder");
    });
  }
};

// Populate the condition assessment table with access points
const updateConditionAssessmentTable = (tbodyId = "risk-condition-assessment-tbody", riskType = null) => {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = "";

  const canvas = window.fabricCanvas;
  let accessPoints = canvas ? canvas.getObjects().filter((o) => o.accessPointName) : [];

  // Filter access points by the specific risk type
  if (riskType) {
    accessPoints = accessPoints.filter((ap) => {
      if (riskType === "intruder") return !!ap.showInIntruder;
      if (riskType === "cctv") return !!ap.showInCctv;
      if (riskType === "access") return !!ap.showInAccess;
      if (riskType === "fire") return !!ap.showInFire;
      return true;
    });
  }

  if (accessPoints.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="3" class="text-center text-muted">No access points found for this assessment.</td>';
    tbody.appendChild(row);
    return;
  }

  accessPoints.forEach((ap) => {
    const row = document.createElement("tr");

    // Set access point name or label
    const nameCell = document.createElement("td");
    nameCell.textContent = ap.accessPointName || ap.accessPointLabel || "AP";
    row.appendChild(nameCell);

    // Create condition selection dropdown
    const conditionCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "form-select form-select-sm w-100";
    select.innerHTML = `
      <option value="">Select...</option>
      <option value="good">Good</option>
      <option value="defective">Defective</option>
      <option value="not-suitable">Not Suitable</option>
      <option value="other">Other</option>
      <option value="na">N/A</option>
    `;
    select.value = ap.accessPointCondition || "";
    select.addEventListener("change", (e) => {
      ap.accessPointCondition = e.target.value;
    });
    conditionCell.appendChild(select);
    row.appendChild(conditionCell);

    // Create notes input field
    const notesCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control form-control-sm w-100";
    input.value = ap.accessPointNotes || "";
    input.addEventListener("input", (e) => {
      ap.accessPointNotes = e.target.value;
    });
    notesCell.appendChild(input);
    row.appendChild(notesCell);

    tbody.appendChild(row);
  });
};

// Populate a risk table based on a filter function
const updateRiskTable = (tbodyId, filterFn) => {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = "";
  const risks = window.risks || [];
  const filteredRisks = risks.filter(filterFn);

  if (filteredRisks.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="3" class="text-center text-muted">No risk zones found for this assessment.</td>`;
    tbody.appendChild(row);
    return;
  }

  filteredRisks.forEach((risk, index) => {
    const row = document.createElement("tr");

    // Set risk name or default label
    const nameCell = document.createElement("td");
    nameCell.textContent = risk.riskName || `Risk ${index + 1}`;
    row.appendChild(nameCell);

    // Create ease of access selection dropdown
    const easeCell = document.createElement("td");
    const easeSelect = document.createElement("select");
    easeSelect.className = "form-select form-select-sm w-100";
    easeSelect.innerHTML = `
      <option value="">Select...</option>
      <option value="easy">Easy</option>
      <option value="controlled">Controlled</option>
      <option value="restricted">Restricted</option>
      <option value="na">N/A</option>
    `;
    easeSelect.value = risk.riskEase || "";
    easeSelect.addEventListener("change", (e) => {
      risk.riskEase = e.target.value;
      if (risk.polygon) risk.polygon.riskEase = e.target.value;
    });
    easeCell.appendChild(easeSelect);
    row.appendChild(easeCell);

    // Create risk notes input field
    const notesCell = document.createElement("td");
    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.className = "form-control form-control-sm w-100";
    notesInput.value = risk.riskNotes || "";
    notesInput.addEventListener("input", (e) => {
      risk.riskNotes = e.target.value;
      if (risk.polygon) risk.polygon.riskNotes = e.target.value;
    });
    notesCell.appendChild(notesInput);
    row.appendChild(notesCell);

    tbody.appendChild(row);
  });
};

// Update intruder risk table
const updateIntruderRiskTable = () => {
  updateRiskTable("risk-access-tbody", (r) => !!r.showInIntruder);
};

// Update CCTV risk table
const updateCctvRiskTable = () => {
  updateRiskTable("cctv-risk-access-tbody", (r) => !!r.showInCctv);
};

// Update access control risk table
const updateAccessControlRiskTable = () => {
  updateRiskTable("access-control-risk-access-tbody", (r) => !!r.showInAccess);
};

// Update fire risk table
const updateFireRiskTable = () => {
  updateRiskTable("fire-risk-access-tbody", (r) => !!r.showInFire);
};

// List of access points for access control assessment
let accessControlAccessPoints = [];
window.accessControlAccessPoints = accessControlAccessPoints;

// Add a new access point to the access control assessment
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

  const row = document.createElement("tr");
  const rowId = `access-point-${Date.now()}`;
  row.id = rowId;

  const classificationLabels = {
    "class-i": "Class I",
    "class-ii": "Class II",
    "class-iii": "Class III",
    "class-iv": "Class IV",
  };

  const optionLabels = {
    a: "Option A",
    b: "Option B",
    na: "N/A",
  };

  row.innerHTML = `
    <td>${name}</td>
    <td>${classificationLabels[classification] || classification}</td>
    <td>${optionLabels[option] || option.toUpperCase()}</td>
    <td>
      <button type="button" 
              class="btn btn-sm text-white btn-remove-ap" 
              onclick="removeAccessControlAccessPoint('${rowId}')">X</button>
    </td>
  `;

  const accessPoint = { id: rowId, name, classification, option };
  accessControlAccessPoints.push(accessPoint);
  window.accessControlAccessPoints = accessControlAccessPoints;

  tbody.appendChild(row);

  nameInput.value = "";
  classificationSelect.value = "";
  const naRadio = document.getElementById("access-control-risk-new-option-na");
  if (naRadio) naRadio.checked = true;
};

// Remove an access point from the access control assessment
window.removeAccessControlAccessPoint = (rowId) => {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  accessControlAccessPoints = accessControlAccessPoints.filter((ap) => ap.id !== rowId);
  window.accessControlAccessPoints = accessControlAccessPoints;
};

// Reset the access control assessment form
const resetAccessControlForm = () => {
  const modal = document.getElementById("access-control-risk-assessment-modal");
  if (!modal) return;
  const inputs = modal.querySelectorAll("input, select, textarea");
  inputs.forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") {
      el.checked = false;
    } else {
      el.value = "";
    }
  });
  accessControlAccessPoints = [];
  window.accessControlAccessPoints = accessControlAccessPoints;
  const tbody = document.getElementById("access-control-risk-access-points-tbody");
  if (tbody) tbody.innerHTML = "";
  const defaultRadio = document.getElementById("access-control-risk-new-option-na");
  if (defaultRadio) defaultRadio.checked = true;
};

// Initialize access control risk assessment modal and events
const initAccessControlRisk = () => {
  const addBtn = document.getElementById("access-control-risk-add-access-point-btn");
  if (addBtn) addBtn.addEventListener("click", addAccessControlAccessPoint);

  const modalEl = document.getElementById("access-control-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      resetAccessControlForm();
      updateAccessControlRiskTable();
      updateConditionAssessmentTable("access-control-risk-condition-assessment-tbody", "access");
    });
  }
};

// Initialize fire risk assessment modal and events
const initFireRisk = () => {
  const modalEl = document.getElementById("fire-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateFireRiskTable();
      updateConditionAssessmentTable("fire-risk-condition-assessment-tbody", "fire");
    });
  }
};

// Initialize CCTV risk assessment modal and events
const initCctvRisk = () => {
  const modalEl = document.getElementById("cctv-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateCctvRiskTable();
      updateConditionAssessmentTable("cctv-risk-condition-assessment-tbody", "cctv");
    });
  }
};

// Track if risk assessments have been initialized
let risksInitialized = false;

// Initialize all risk assessment modules
const initAllRisks = () => {
  if (risksInitialized) return;

  // Stop if risk assessment modals are not present in the DOM
  if (!document.getElementById("intruder-risk-assessment-modal")) return;

  initIntruderRisk();
  initFireRisk();
  initCctvRisk();
  initAccessControlRisk();

  risksInitialized = true;
};

document.addEventListener("DOMContentLoaded", initAllRisks);
document.addEventListener("htmlIncludesLoaded", initAllRisks);
