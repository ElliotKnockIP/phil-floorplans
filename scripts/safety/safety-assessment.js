// Safety Assessment helpers and shared utilities
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

// Safety assessment data stored per safety zone
let safetyAssessmentData = [];
window.safetyAssessmentData = safetyAssessmentData;

// Update the hotspots table in the safety assessment modal
const updateHotspotsTable = () => {
  const tbody = document.getElementById("hotspots-assessment-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const canvas = window.fabricCanvas;
  if (!canvas) return;

  const hotspots = canvas.getObjects().filter((o) => o.isHotspot && o.hotspotName);

  if (hotspots.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="3" class="text-center text-muted">No hotspots found on canvas.</td>';
    tbody.appendChild(row);
    return;
  }

  hotspots.forEach((hotspot) => {
    const row = document.createElement("tr");

    // Hotspot Name
    const nameCell = document.createElement("td");
    nameCell.textContent = hotspot.hotspotName || hotspot.hotspotLabel || "Hotspot";
    nameCell.style.fontWeight = "500";
    row.appendChild(nameCell);

    // Severity
    const severityCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "form-select form-select-sm w-100";
    select.innerHTML = '<option value="">Select...</option>' + '<option value="low">Low</option>' + '<option value="medium">Medium</option>' + '<option value="high">High</option>' + '<option value="critical">Critical</option>' + '<option value="na">N/A</option>';
    select.value = hotspot.hotspotSeverity || "";
    select.addEventListener("change", (e) => {
      hotspot.hotspotSeverity = e.target.value;
    });
    severityCell.appendChild(select);
    row.appendChild(severityCell);

    // Notes
    const notesCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control form-control-sm w-100";
    input.value = hotspot.hotspotNotes || "";
    input.addEventListener("input", (e) => {
      hotspot.hotspotNotes = e.target.value;
    });
    notesCell.appendChild(input);
    row.appendChild(notesCell);

    tbody.appendChild(row);
  });
};

// Update the safety assessment table in the modal with editable containment and notes
const updateSafetyAssessmentTable = () => {
  const tbody = document.getElementById("safety-assessment-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const safetyZones = window.safetyZones || [];

  if (safetyZones.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="text-center text-muted">No safety zones found on canvas.</td>`;
    tbody.appendChild(row);
    return;
  }

  safetyZones.forEach((safety, safetyIndex) => {
    const subDetails = safety.safetySubDetails || [];

    if (subDetails.length === 0) {
      // Show row with safety name but no sub-details
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 500; vertical-align: middle;">${safety.safetyName || `Safety ${safetyIndex + 1}`}</td>
        <td class="text-muted">No risk assessments defined</td>
        <td class="text-muted">-</td>
        <td class="text-muted">-</td>
      `;
      tbody.appendChild(row);
    } else {
      // Create a row for each sub-detail
      subDetails.forEach((detail, detailIndex) => {
        const row = document.createElement("tr");

        // Safety Area Name (only show on first row, span remaining rows)
        if (detailIndex === 0) {
          const nameCell = document.createElement("td");
          nameCell.textContent = safety.safetyName || `Safety ${safetyIndex + 1}`;
          nameCell.style.fontWeight = "500";
          nameCell.style.verticalAlign = "middle";
          if (subDetails.length > 1) {
            nameCell.rowSpan = subDetails.length;
          }
          row.appendChild(nameCell);
        }

        // Risk Assessment name (read-only display)
        const assessmentCell = document.createElement("td");
        assessmentCell.innerHTML = `<span class="text-muted" style="font-size: 0.85em;">${safetyIndex + 1}.${detailIndex + 1}</span> ${detail.name || "Unnamed"}`;
        row.appendChild(assessmentCell);

        // Containment (editable)
        const containmentCell = document.createElement("td");
        const containmentInput = document.createElement("input");
        containmentInput.type = "text";
        containmentInput.className = "form-control form-control-sm";
        containmentInput.placeholder = "Enter control measures...";
        containmentInput.value = detail.containment || "";
        containmentInput.addEventListener("input", (e) => {
          detail.containment = e.target.value;
        });
        containmentCell.appendChild(containmentInput);
        row.appendChild(containmentCell);

        // Notes (editable)
        const notesCell = document.createElement("td");
        const notesInput = document.createElement("input");
        notesInput.type = "text";
        notesInput.className = "form-control form-control-sm";
        notesInput.placeholder = "Enter notes...";
        notesInput.value = detail.notes || "";
        notesInput.addEventListener("input", (e) => {
          detail.notes = e.target.value;
        });
        notesCell.appendChild(notesInput);
        row.appendChild(notesCell);

        tbody.appendChild(row);
      });
    }
  });
};

// Initialize safety assessment modal
const initSafetyAssessment = () => {
  const modalEl = document.getElementById("safety-assessment-modal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      updateHotspotsTable();
      updateSafetyAssessmentTable();
    });
  }
};

// Export for external use
window.updateSafetyAssessmentTable = updateSafetyAssessmentTable;
window.updateHotspotsTable = updateHotspotsTable;

// ----- Init wiring -----
document.addEventListener("DOMContentLoaded", () => {
  initSafetyAssessment();
});
