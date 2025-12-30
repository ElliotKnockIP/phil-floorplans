// Unified Risk Assessment helpers and shared utilities
export const getValue = (id) => {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value || "";
};

export const setValue = (id, value) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!value;
  } else {
    el.value = value || "";
  }
};

export const getRadioValue = (name) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.checked) return radio.value;
  }
  return "";
};

export const setRadioValue = (name, value) => {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) {
    if (radio.value === value) {
      radio.checked = true;
      break;
    }
  }
};

// ----- Intruder dropdown linkage -----
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

const initIntruderRisk = () => {
  const dropdown1 = document.getElementById("risk-premises-use-1");
  if (dropdown1) dropdown1.addEventListener("change", updateIntruderPremisesUse2);

  const modalEl = document.getElementById("intruder-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateIntruderPremisesUse2();
      updateAccessRiskTable();
      updateConditionAssessmentTable();
    });
  }
};

const updateConditionAssessmentTable = () => {
  const tbody = document.getElementById("risk-condition-assessment-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const canvas = window.fabricCanvas;
  if (!canvas) return;

  const accessPoints = canvas.getObjects().filter((o) => o.accessPointName);

  if (accessPoints.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="3" class="text-center text-muted">No access points found on canvas.</td>';
    tbody.appendChild(row);
    return;
  }

  accessPoints.forEach((ap) => {
    const row = document.createElement("tr");

    // Access Point (Number/Label)
    const nameCell = document.createElement("td");
    nameCell.textContent = ap.accessPointName || ap.accessPointLabel || "AP";
    row.appendChild(nameCell);

    // Condition
    const conditionCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "form-select form-select-sm w-100";
    select.innerHTML = '<option value="">Select...</option>' + '<option value="good">Good</option>' + '<option value="defective">Defective</option>' + '<option value="not-suitable">Not Suitable</option>' + '<option value="other">Other</option>' + '<option value="na">N/A</option>';
    select.value = ap.accessPointCondition || "";
    select.addEventListener("change", (e) => {
      ap.accessPointCondition = e.target.value;
    });
    conditionCell.appendChild(select);
    row.appendChild(conditionCell);

    // Notes
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

const updateAccessRiskTable = () => {
  const tbody = document.getElementById("risk-access-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const risks = window.risks || [];

  if (risks.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="3" class="text-center text-muted">No risk zones found on canvas.</td>`;
    tbody.appendChild(row);
    return;
  }

  risks.forEach((risk, index) => {
    const row = document.createElement("tr");

    // Access Elevation (Risk Name)
    const nameCell = document.createElement("td");
    nameCell.textContent = risk.riskName || `Risk ${index + 1}`;
    row.appendChild(nameCell);

    // Ease of Access
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

    // Notes
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

// ----- Access control helpers -----
let accessControlAccessPoints = [];
window.accessControlAccessPoints = accessControlAccessPoints;

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
      <button type="button" class="btn btn-sm text-white" style="background-color: #f8794b; padding: 0.25rem 0.5rem;" onclick="removeAccessControlAccessPoint('${rowId}')">X</button>
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

window.removeAccessControlAccessPoint = (rowId) => {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  accessControlAccessPoints = accessControlAccessPoints.filter((ap) => ap.id !== rowId);
  window.accessControlAccessPoints = accessControlAccessPoints;
};

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

const initAccessControlRisk = () => {
  const addBtn = document.getElementById("access-control-risk-add-access-point-btn");
  if (addBtn) addBtn.addEventListener("click", addAccessControlAccessPoint);

  const modalEl = document.getElementById("access-control-risk-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      resetAccessControlForm();
    });
  }
};

// ----- CCTV (placeholder) -----
const initCctvRisk = () => {
  // Template only; no runtime hooks required currently
};

// ----- Init wiring -----
document.addEventListener("DOMContentLoaded", () => {
  initIntruderRisk();
  initCctvRisk();
  initAccessControlRisk();
});
