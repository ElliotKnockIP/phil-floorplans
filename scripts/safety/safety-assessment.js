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

// Global storage for safety assessment data
let safetyAssessmentData = [];
window.safetyAssessmentData = safetyAssessmentData;

// Populate the hotspots table in the safety assessment modal
const updateHotspotsTable = () => {
  const tbody = document.getElementById("hotspots-assessment-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const canvas = window.fabricCanvas;
  if (!canvas) return;

  // Get all hotspot objects from the canvas
  const hotspots = canvas.getObjects().filter((o) => o.isHotspot && o.hotspotName);

  if (hotspots.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5" class="text-center text-muted">No hotspots found on canvas.</td>';
    tbody.appendChild(row);
    return;
  }

  hotspots.forEach((hotspot) => {
    const row = document.createElement("tr");

    // Set hotspot name or label
    const nameCell = document.createElement("td");
    nameCell.textContent = hotspot.hotspotName || hotspot.hotspotLabel || "Hotspot";
    nameCell.style.fontWeight = "500";
    row.appendChild(nameCell);

    // Create risk assessment textarea
    const assessmentCell = document.createElement("td");
    const assessmentInput = document.createElement("textarea");
    assessmentInput.className = "form-control form-control-sm w-100";
    assessmentInput.rows = 2;
    assessmentInput.value = hotspot.hotspotRiskAssessment || "";
    assessmentInput.placeholder = "Describe the risk for this hotspot";
    assessmentInput.addEventListener("input", (e) => {
      hotspot.hotspotRiskAssessment = e.target.value;
    });
    assessmentCell.appendChild(assessmentInput);
    row.appendChild(assessmentCell);

    // Create likelihood selection dropdown
    const likelihoodCell = document.createElement("td");
    const likelihoodSelect = document.createElement("select");
    likelihoodSelect.className = "form-select form-select-sm w-100";
    likelihoodSelect.innerHTML = `
      <option value="">Select...</option>
      <option value="very-low">Very Low</option>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="very-high">Very High</option>
      <option value="na">N/A</option>
    `;
    likelihoodSelect.value = hotspot.hotspotLikelihood || "";
    likelihoodSelect.addEventListener("change", (e) => {
      hotspot.hotspotLikelihood = e.target.value;
    });
    likelihoodCell.appendChild(likelihoodSelect);
    row.appendChild(likelihoodCell);

    // Create severity selection dropdown
    const severityCell = document.createElement("td");
    const severitySelect = document.createElement("select");
    severitySelect.className = "form-select form-select-sm w-100";
    severitySelect.innerHTML = `
      <option value="">Select...</option>
      <option value="very-low">Very Low</option>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="very-high">Very High</option>
      <option value="na">N/A</option>
    `;
    severitySelect.value = hotspot.hotspotSeverity || "";
    severitySelect.addEventListener("change", (e) => {
      hotspot.hotspotSeverity = e.target.value;
    });
    severityCell.appendChild(severitySelect);
    row.appendChild(severityCell);

    // Create control measures textarea
    const controlCell = document.createElement("td");
    const controlInput = document.createElement("textarea");
    controlInput.className = "form-control form-control-sm w-100";
    controlInput.rows = 2;
    controlInput.value = hotspot.hotspotControlMeasures || "";
    controlInput.placeholder = "Enter control measures";
    controlInput.addEventListener("input", (e) => {
      hotspot.hotspotControlMeasures = e.target.value;
    });
    controlCell.appendChild(controlInput);
    row.appendChild(controlCell);

    tbody.appendChild(row);
  });
};

// Populate the safety assessment table with zones and sub-details
const updateSafetyAssessmentTable = () => {
  const tbody = document.getElementById("safety-assessment-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const safetyZones = window.safetyZones || [];

  if (safetyZones.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5" class="text-center text-muted">No safety zones found on canvas.</td>`;
    tbody.appendChild(row);
    return;
  }

  safetyZones.forEach((safety, safetyIndex) => {
    const subDetails = safety.safetySubDetails || [];

    if (subDetails.length === 0) {
      // Create a row for safety zones without sub-details
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      const areaNameInput = document.createElement("input");
      areaNameInput.type = "text";
      areaNameInput.className = "form-control form-control-sm fw-bold";
      areaNameInput.value = safety.safetyName || `Safety ${safetyIndex + 1}`;
      areaNameInput.addEventListener("input", (e) => {
        const newName = e.target.value.trim();
        safety.safetyName = newName;
        if (safety.polygon) safety.polygon.safetyName = newName;

        const sidebarLabelInput = document.getElementById("safety-label-input");
        if (sidebarLabelInput && window.currentSafety === safety) {
          sidebarLabelInput.value = newName;
        }

        if (window.updateSafetyText) window.updateSafetyText();
      });
      nameCell.appendChild(areaNameInput);
      row.appendChild(nameCell);

      const emptyCell1 = document.createElement("td");
      emptyCell1.className = "text-muted";
      emptyCell1.textContent = "No risk assessments defined";
      row.appendChild(emptyCell1);

      for (let i = 0; i < 3; i++) {
        const emptyCell = document.createElement("td");
        emptyCell.className = "text-muted";
        emptyCell.textContent = "-";
        emptyCell.style.textAlign = "center";
        row.appendChild(emptyCell);
      }

      tbody.appendChild(row);
    } else {
      // Create a row for each sub-detail within a safety zone
      subDetails.forEach((detail, detailIndex) => {
        const row = document.createElement("tr");

        // Set safety area name and handle row spanning for multiple sub-details
        if (detailIndex === 0) {
          const nameCell = document.createElement("td");
          const areaNameInput = document.createElement("input");
          areaNameInput.type = "text";
          areaNameInput.className = "form-control form-control-sm fw-bold";
          areaNameInput.value = safety.safetyName || `Safety ${safetyIndex + 1}`;
          areaNameInput.addEventListener("input", (e) => {
            const newName = e.target.value.trim();
            safety.safetyName = newName;
            if (safety.polygon) safety.polygon.safetyName = newName;

            const sidebarLabelInput = document.getElementById("safety-label-input");
            if (sidebarLabelInput && window.currentSafety === safety) {
              sidebarLabelInput.value = newName;
            }

            if (window.updateSafetyText) window.updateSafetyText();
          });
          nameCell.style.verticalAlign = "middle";
          if (subDetails.length > 1) {
            nameCell.rowSpan = subDetails.length;
          }
          nameCell.appendChild(areaNameInput);
          row.appendChild(nameCell);
        }

        // Create editable risk assessment name input
        const assessmentCell = document.createElement("td");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "form-control form-control-sm";
        nameInput.value = detail.name || "";
        nameInput.placeholder = "Risk name...";
        nameInput.addEventListener("input", (e) => {
          detail.name = e.target.value;
          if (window.renderSafetySubDetailsList) window.renderSafetySubDetailsList();
        });
        assessmentCell.appendChild(nameInput);
        row.appendChild(assessmentCell);

        // Create editable likelihood selection dropdown
        const likelihoodCell = document.createElement("td");
        const likelihoodSelect = document.createElement("select");
        likelihoodSelect.className = "form-select form-select-sm";
        likelihoodSelect.innerHTML = `
          <option value="">Select...</option>
          <option value="very-low">Very Low</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="very-high">Very High</option>
        `;
        likelihoodSelect.value = detail.likelihood || "";
        likelihoodSelect.addEventListener("change", (e) => {
          detail.likelihood = e.target.value;
          if (window.renderSafetySubDetailsList) window.renderSafetySubDetailsList();
        });
        likelihoodCell.appendChild(likelihoodSelect);
        row.appendChild(likelihoodCell);

        // Create editable severity selection dropdown
        const severityCell = document.createElement("td");
        const severitySelect = document.createElement("select");
        severitySelect.className = "form-select form-select-sm";
        severitySelect.innerHTML = `
          <option value="">Select...</option>
          <option value="very-low">Very Low</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="very-high">Very High</option>
        `;
        severitySelect.value = detail.severity || "";
        severitySelect.addEventListener("change", (e) => {
          detail.severity = e.target.value;
          if (window.renderSafetySubDetailsList) window.renderSafetySubDetailsList();
        });
        severityCell.appendChild(severitySelect);
        row.appendChild(severityCell);

        // Create editable control measures textarea
        const controlCell = document.createElement("td");
        const controlInput = document.createElement("textarea");
        controlInput.className = "form-control form-control-sm";
        controlInput.rows = 2;
        controlInput.placeholder = "Enter control measures...";
        controlInput.value = detail.controlMeasures || "";
        controlInput.addEventListener("input", (e) => {
          detail.controlMeasures = e.target.value;
          if (window.renderSafetySubDetailsList) window.renderSafetySubDetailsList();
        });
        controlCell.appendChild(controlInput);
        row.appendChild(controlCell);

        tbody.appendChild(row);
      });
    }
  });
};

// Initialize safety assessment modal and events
const initSafetyAssessment = () => {
  const modalEl = document.getElementById("safety-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateHotspotsTable();
      updateSafetyAssessmentTable();
    });
  }
};

// Export functions for external use
window.updateSafetyAssessmentTable = updateSafetyAssessmentTable;
window.updateHotspotsTable = updateHotspotsTable;

// Initialize safety assessment on page load
document.addEventListener("DOMContentLoaded", initSafetyAssessment);
document.addEventListener("htmlIncludesLoaded", initSafetyAssessment);
