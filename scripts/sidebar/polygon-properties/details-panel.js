import { preventEventPropagation, wrapGlobalFunction, createSliderInputSync, updateSliderTrack, updateWarningText } from "../sidebar-utils.js";
import { getHexFromFill } from "../sidebar-utils.js";
import { updateDevicesList } from "../sidebar-utils.js";
import { initAppearancePanel } from "./appearance-panel.js";

// Stores the currently selected zone, room, risk, or safety zone
let currentPolygon = null;
let currentTextObject = null;
let currentZone = null;
let currentRoom = null;
let currentRoomPolygon = null;
let currentRoomText = null;
let currentRisk = null;
let currentRiskPolygon = null;
let currentRiskText = null;
let currentSafety = null;
let currentSafetyPolygon = null;
let currentSafetyText = null;

// Sets up the details panel for zones, rooms, risks, and safety zones with name, notes, height, and device lists
export function initDetailsPanel() {
  // Zone controls
  const zoneNameInput = document.getElementById("zone-label-input");
  const zoneNotesInput = document.getElementById("zone-notes-input");
  const zoneNumberInput = document.getElementById("zone-number-input");
  const zoneResistanceInput = document.getElementById("zone-resistance-value-input");

  // Room controls
  const roomLabelInput = document.getElementById("room-label-input");
  const roomNotesInput = document.getElementById("room-notes-input");

  // Risk controls
  const riskLabelInput = document.getElementById("risk-label-input");
  const riskNotesInput = document.getElementById("risk-notes-input");
  const riskEaseSelect = document.getElementById("risk-ease-select");
  const riskShowIntruder = document.getElementById("risk-show-intruder");
  const riskShowCctv = document.getElementById("risk-show-cctv");
  const riskShowAccess = document.getElementById("risk-show-access");
  const riskShowFire = document.getElementById("risk-show-fire");

  // Safety controls
  const safetyLabelInput = document.getElementById("safety-label-input");
  const safetyNotesInput = document.getElementById("safety-notes-input");
  const safetyContainmentInput = document.getElementById("safety-containment-input");
  const safetySubDetailsList = document.getElementById("safety-sub-details-list");
  const safetyAddSubDetailBtn = document.getElementById("safety-add-sub-detail-btn");

  // Height sliders
  const zoneHeightInput = document.getElementById("zone-height-input");
  const zoneHeightSlider = document.getElementById("zone-height-slider");
  const zoneWarning = document.getElementById("zone-warning");
  const roomHeightInput = document.getElementById("room-height-input");
  const roomHeightSlider = document.getElementById("room-height-slider");
  const roomWarning = document.getElementById("room-warning");

  // Handles typing in zone name input
  if (zoneNameInput) {
    zoneNameInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        currentPolygon.zoneName = e.target.value;
        if (window.updateZoneText) window.updateZoneText();
      }
    });
    preventEventPropagation(zoneNameInput);
  }

  // Handles typing in zone notes input
  if (zoneNotesInput) {
    zoneNotesInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        currentPolygon.zoneNotes = e.target.value;
        if (window.updateZoneText) window.updateZoneText();
      }
    });
    preventEventPropagation(zoneNotesInput);
  }

  // Handles typing in zone number input
  if (zoneNumberInput) {
    zoneNumberInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        const v = (e.target.value || "").trim();
        currentPolygon.zoneNumber = v;
      }
    });
    preventEventPropagation(zoneNumberInput);
  }

  // Handles typing in zone resistance value input
  if (zoneResistanceInput) {
    zoneResistanceInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        const v = (e.target.value || "").trim();
        currentPolygon.zoneResistanceValue = v;
      }
    });
    preventEventPropagation(zoneResistanceInput);
  }

  // Handles typing in room name input
  if (roomLabelInput) {
    roomLabelInput.addEventListener("input", (e) => {
      if (currentRoom && currentRoomPolygon && currentRoomText && currentRoomPolygon.canvas) {
        const newName = e.target.value.trim() || `Room ${window.rooms.indexOf(currentRoom) + 1}`;
        currentRoom.roomName = newName;
        currentRoomPolygon.roomName = newName;
        if (window.updateRoomText) window.updateRoomText();
      }
    });
    preventEventPropagation(roomLabelInput);
  }

  // Handles typing in room notes input
  if (roomNotesInput) {
    roomNotesInput.addEventListener("input", (e) => {
      if (currentRoom && currentRoomPolygon && currentRoomText && currentRoomPolygon.canvas) {
        const newNotes = e.target.value.trim();
        currentRoom.roomNotes = newNotes;
        currentRoomPolygon.roomNotes = newNotes;
        if (window.updateRoomText) window.updateRoomText();
      }
    });
    preventEventPropagation(roomNotesInput);
  }

  // Handles typing in risk name input
  if (riskLabelInput) {
    riskLabelInput.addEventListener("input", (e) => {
      if (currentRisk && currentRiskPolygon && currentRiskText && currentRiskPolygon.canvas) {
        const newName = e.target.value.trim() || `Risk ${window.risks.indexOf(currentRisk) + 1}`;
        currentRisk.riskName = newName;
        currentRiskPolygon.riskName = newName;
        if (window.updateRiskText) window.updateRiskText();
      }
    });
    preventEventPropagation(riskLabelInput);
  }

  // Handles typing in risk notes input
  if (riskNotesInput) {
    riskNotesInput.addEventListener("input", (e) => {
      if (currentRisk && currentRiskPolygon && currentRiskText && currentRiskPolygon.canvas) {
        const newNotes = e.target.value.trim();
        currentRisk.riskNotes = newNotes;
        currentRiskPolygon.riskNotes = newNotes;
        if (window.updateRiskText) window.updateRiskText();
      }
    });
    preventEventPropagation(riskNotesInput);
  }

  // Handles changing risk ease of access
  if (riskEaseSelect) {
    riskEaseSelect.addEventListener("change", (e) => {
      if (currentRisk && currentRiskPolygon && currentRiskText && currentRiskPolygon.canvas) {
        const newEase = e.target.value;
        currentRisk.riskEase = newEase;
        currentRiskPolygon.riskEase = newEase;
      }
    });
    preventEventPropagation(riskEaseSelect);
  }

  // Handles changing risk show flags
  const setupRiskCheckbox = (checkbox, property) => {
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        if (currentRisk && currentRiskPolygon) {
          currentRisk[property] = e.target.checked;
          currentRiskPolygon[property] = e.target.checked;
        }
      });
    }
  };

  setupRiskCheckbox(riskShowIntruder, "showInIntruder");
  setupRiskCheckbox(riskShowCctv, "showInCctv");
  setupRiskCheckbox(riskShowAccess, "showInAccess");
  setupRiskCheckbox(riskShowFire, "showInFire");

  // Handles typing in safety name input
  if (safetyLabelInput) {
    safetyLabelInput.addEventListener("input", (e) => {
      if (currentSafety && currentSafetyPolygon && currentSafetyText && currentSafetyPolygon.canvas) {
        const newName = e.target.value.trim() || `Safety ${window.safetyZones.indexOf(currentSafety) + 1}`;
        currentSafety.safetyName = newName;
        currentSafetyPolygon.safetyName = newName;
        if (window.updateSafetyText) window.updateSafetyText();
      }
    });
    preventEventPropagation(safetyLabelInput);
  }

  // Handles typing in safety notes input
  if (safetyNotesInput) {
    safetyNotesInput.addEventListener("input", (e) => {
      if (currentSafety && currentSafetyPolygon && currentSafetyText && currentSafetyPolygon.canvas) {
        const newNotes = e.target.value.trim();
        currentSafety.safetyNotes = newNotes;
        currentSafetyPolygon.safetyNotes = newNotes;
        if (window.updateSafetyText) window.updateSafetyText();
      }
    });
    preventEventPropagation(safetyNotesInput);
  }

  // Handles typing in safety containment input
  if (safetyContainmentInput) {
    safetyContainmentInput.addEventListener("input", (e) => {
      if (currentSafety && currentSafetyPolygon && currentSafetyPolygon.canvas) {
        const newContainment = e.target.value.trim();
        currentSafety.safetyContainment = newContainment;
        currentSafetyPolygon.safetyContainment = newContainment;
      }
    });
    preventEventPropagation(safetyContainmentInput);
  }

  // Function to render sub-details list (simplified - just names)
  function renderSafetySubDetailsList() {
    if (!safetySubDetailsList || !currentSafety) return;
    safetySubDetailsList.innerHTML = "";

    const subDetails = currentSafety.safetySubDetails || [];
    const safetyIndex = window.safetyZones ? window.safetyZones.indexOf(currentSafety) + 1 : 1;

    subDetails.forEach((detail, index) => {
      const item = document.createElement("div");
      item.className = "sub-detail-item d-flex align-items-center gap-2 mb-2";
      item.innerHTML = `
        <span class="sub-detail-number text-muted" style="min-width: 35px; font-size: 0.9em;">${safetyIndex}.${index + 1}</span>
        <input type="text" class="form-control form-control-sm sub-detail-name" placeholder="Risk name" value="${detail.name || ""}" />
        <button type="button" class="btn btn-sm btn-outline-danger sub-detail-remove" style="padding: 0.15rem 0.4rem; font-size: 0.8rem;">×</button>
      `;

      // Name input handler
      const nameInput = item.querySelector(".sub-detail-name");
      nameInput.addEventListener("input", (e) => {
        detail.name = e.target.value;
      });
      preventEventPropagation(nameInput);

      // Remove button handler
      const removeBtn = item.querySelector(".sub-detail-remove");
      removeBtn.addEventListener("click", () => {
        subDetails.splice(index, 1);
        renderSafetySubDetailsList();
      });

      safetySubDetailsList.appendChild(item);
    });
  }

  // Add sub-detail button handler
  if (safetyAddSubDetailBtn) {
    safetyAddSubDetailBtn.addEventListener("click", () => {
      if (!currentSafety) return;
      if (!currentSafety.safetySubDetails) currentSafety.safetySubDetails = [];
      currentSafety.safetySubDetails.push({ name: "", containment: "", notes: "" });
      renderSafetySubDetailsList();
    });
  }

  // Make renderSafetySubDetailsList available for external calls
  window.renderSafetySubDetailsList = renderSafetySubDetailsList;

  // Sets up zone height slider
  if (zoneHeightSlider && zoneHeightInput) {
    createSliderInputSync(
      zoneHeightSlider,
      zoneHeightInput,
      (height) => {
        if (currentPolygon && currentTextObject && currentPolygon.canvas) {
          currentTextObject.displayHeight = height;
          if (zoneWarning) updateWarningText(zoneWarning, height);
          if (window.updateZoneText) window.updateZoneText();
        }
      },
      { min: 1, max: 10, step: 0.01, precision: 2, format: (value) => value.toFixed(2) + "m" }
    );
    preventEventPropagation(zoneHeightInput, ["click"]);
    preventEventPropagation(zoneHeightSlider, ["click"]);
  }

  // Sets up room height slider
  if (roomHeightSlider && roomHeightInput) {
    createSliderInputSync(
      roomHeightSlider,
      roomHeightInput,
      (height) => {
        if (currentRoom && currentRoomText && currentRoomPolygon && currentRoomPolygon.canvas) {
          currentRoomText.displayHeight = height;
          currentRoom.height = height;
          if (roomWarning) updateWarningText(roomWarning, height);
          if (window.updateRoomText) window.updateRoomText();
        }
      },
      { min: 1, max: 10, step: 0.01, precision: 2, format: (value) => value.toFixed(2) + "m" }
    );
    preventEventPropagation(roomHeightInput, ["click"]);
    preventEventPropagation(roomHeightSlider, ["click"]);
  }

  // Updates the list of devices inside a zone
  function updateZoneDevicesList(zone, fabricCanvas) {
    const zoneDevicesList = document.getElementById("zone-devices-list");
    if (zoneDevicesList && zone && zone.polygon && fabricCanvas) {
      updateDevicesList(zoneDevicesList, zone.polygon, fabricCanvas, true);
    }
  }

  // Updates the list of devices inside a room
  function updateRoomDevicesList(room, fabricCanvas) {
    const roomDevicesList = document.getElementById("room-devices-list");
    if (roomDevicesList && room && room.polygon && fabricCanvas) {
      updateDevicesList(roomDevicesList, room.polygon, fabricCanvas, false);
    }
  }

  // Updates the list of devices inside a risk area
  function updateRiskDevicesList(risk, fabricCanvas) {
    const riskDevicesList = document.getElementById("risk-devices-list");
    if (riskDevicesList && risk && risk.polygon && fabricCanvas) {
      updateDevicesList(riskDevicesList, risk.polygon, fabricCanvas, "risk");
    }
  }

  return {
    getCurrentZone: () => ({ currentPolygon, currentTextObject, currentZone }),
    getCurrentRoom: () => ({ currentRoom, currentRoomPolygon, currentRoomText }),
    getCurrentRisk: () => ({ currentRisk, currentRiskPolygon, currentRiskText }),
    getCurrentSafety: () => ({ currentSafety, currentSafetyPolygon, currentSafetyText }),
    setCurrentZone: (polygon, textObject, zone) => {
      currentPolygon = polygon;
      currentTextObject = textObject;
      currentZone = zone;
    },
    setCurrentRoom: (room, polygon, text) => {
      currentRoom = room;
      currentRoomPolygon = polygon;
      currentRoomText = text;
    },
    setCurrentRisk: (risk, polygon, text) => {
      currentRisk = risk;
      currentRiskPolygon = polygon;
      currentRiskText = text;
    },
    setCurrentSafety: (safety, polygon, text) => {
      currentSafety = safety;
      currentSafetyPolygon = polygon;
      currentSafetyText = text;
    },
    updateDetailsPanel: (deviceType, textObject, polygon, fourthParam) => {
      if (deviceType === "zone-polygon") {
        currentPolygon = polygon;
        currentTextObject = textObject;
        currentZone = window.zones ? window.zones.find((zone) => zone.polygon === polygon || zone.text === textObject) : null;

        if (zoneNameInput && textObject) {
          const zoneName = textObject.text.split("\n")[0] || polygon.zoneName;
          zoneNameInput.value = zoneName || "";
        }
        if (zoneNotesInput) {
          const notesLine = textObject?.text?.split("\n").find((line) => line.startsWith("Notes:"));
          const zoneNotes = notesLine ? notesLine.replace("Notes: ", "") : polygon.zoneNotes || "";
          zoneNotesInput.value = zoneNotes;
        }
        if (zoneNumberInput) {
          zoneNumberInput.value = polygon.zoneNumber !== undefined && polygon.zoneNumber !== null ? String(polygon.zoneNumber) : polygon.zoneNumber || "";
        }
        if (zoneResistanceInput) {
          zoneResistanceInput.value = polygon.zoneResistanceValue !== undefined && polygon.zoneResistanceValue !== null ? String(polygon.zoneResistanceValue) : polygon.zoneResistanceValue || "";
        }
        // Update height slider
        if (zoneHeightInput && zoneHeightSlider && textObject) {
          let heightValue = textObject?.displayHeight !== undefined ? textObject.displayHeight : polygon.height || 2.4;
          if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) heightValue = 2.4;
          zoneHeightInput.textContent = heightValue.toFixed(2) + "m";
          zoneHeightSlider.value = heightValue;
          if (textObject) textObject.displayHeight = heightValue;
          updateSliderTrack(zoneHeightSlider, heightValue, zoneHeightSlider.min || 1, zoneHeightSlider.max || 10);
          if (zoneWarning) updateWarningText(zoneWarning, heightValue);
        }
        if (currentZone && polygon && polygon.canvas) updateZoneDevicesList(currentZone, polygon.canvas);
      } else if (deviceType === "room-polygon") {
        currentRoomPolygon = polygon;
        currentRoomText = textObject;
        currentRoom = fourthParam; // room object

        if (roomLabelInput && currentRoom) roomLabelInput.value = currentRoom.roomName || "";
        if (roomNotesInput && currentRoom) roomNotesInput.value = currentRoom.roomNotes || "";
        // Update height slider
        if (roomHeightInput && roomHeightSlider && textObject) {
          let heightValue = textObject?.displayHeight !== undefined ? textObject.displayHeight : polygon.height || 2.4;
          if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) heightValue = 2.4;
          roomHeightInput.textContent = heightValue.toFixed(2) + "m";
          roomHeightSlider.value = heightValue;
          if (textObject) textObject.displayHeight = heightValue;
          updateSliderTrack(roomHeightSlider, heightValue, roomHeightSlider.min || 1, roomHeightSlider.max || 10);
          if (roomWarning) updateWarningText(roomWarning, heightValue);
        }
        if (currentRoom && polygon && polygon.canvas) updateRoomDevicesList(currentRoom, polygon.canvas);
      } else if (deviceType === "risk-polygon") {
        currentRiskPolygon = polygon;
        currentRiskText = textObject;
        currentRisk = fourthParam; // risk object

        if (riskLabelInput && currentRisk) riskLabelInput.value = currentRisk.riskName || "";
        if (riskNotesInput && currentRisk) riskNotesInput.value = currentRisk.riskNotes || "";
        if (riskEaseSelect && currentRisk) riskEaseSelect.value = currentRisk.riskEase || "";

        if (currentRisk) {
          if (riskShowIntruder) riskShowIntruder.checked = !!currentRisk.showInIntruder;
          if (riskShowCctv) riskShowCctv.checked = !!currentRisk.showInCctv;
          if (riskShowAccess) riskShowAccess.checked = !!currentRisk.showInAccess;
          if (riskShowFire) riskShowFire.checked = !!currentRisk.showInFire;
        }

        if (currentRisk && polygon && polygon.canvas) updateRiskDevicesList(currentRisk, polygon.canvas);
      } else if (deviceType === "safety-polygon") {
        currentSafetyPolygon = polygon;
        currentSafetyText = textObject;
        currentSafety = fourthParam; // safety object

        if (safetyLabelInput && currentSafety) safetyLabelInput.value = currentSafety.safetyName || "";
        if (safetyNotesInput && currentSafety) safetyNotesInput.value = currentSafety.safetyNotes || "";
        if (safetyContainmentInput && currentSafety) safetyContainmentInput.value = currentSafety.safetyContainment || "";
        renderSafetySubDetailsList();
      }
    },
    clearDetailsPanel: () => {
      currentPolygon = null;
      currentTextObject = null;
      currentZone = null;
      currentRoom = null;
      currentRoomPolygon = null;
      currentRoomText = null;
      currentRisk = null;
      currentRiskPolygon = null;
      currentRiskText = null;
      currentSafety = null;
      currentSafetyPolygon = null;
      currentSafetyText = null;
    },
  };
}

// Sets up all polygon panels and connects them together
const initPolygonPropertiesCoordinator = () => {
  const detailsPanelInstance = initDetailsPanel();
  const appearancePanelInstance = initAppearancePanel(detailsPanelInstance);

  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, polygon, fourthParam) => {
    if (deviceType === "zone-polygon" || deviceType === "room-polygon" || deviceType === "risk-polygon" || deviceType === "safety-polygon") {
      detailsPanelInstance.updateDetailsPanel(deviceType, textObject, polygon, fourthParam);

      if (deviceType === "zone-polygon") {
        const { currentPolygon, currentTextObject, currentZone } = detailsPanelInstance.getCurrentZone();
        appearancePanelInstance.updateAppearancePanel("zone", currentPolygon, currentTextObject, currentZone);
      } else if (deviceType === "room-polygon") {
        const { currentRoom, currentRoomPolygon, currentRoomText } = detailsPanelInstance.getCurrentRoom();
        appearancePanelInstance.updateAppearancePanel("room", currentRoomPolygon, currentRoomText, currentRoom);
      } else if (deviceType === "risk-polygon") {
        const { currentRisk, currentRiskPolygon, currentRiskText } = detailsPanelInstance.getCurrentRisk();
        appearancePanelInstance.updateAppearancePanel("risk", currentRiskPolygon, currentRiskText, currentRisk);
      } else if (deviceType === "safety-polygon") {
        const { currentSafety, currentSafetyPolygon, currentSafetyText } = detailsPanelInstance.getCurrentSafety();
        appearancePanelInstance.updateAppearancePanel("safety", currentSafetyPolygon, currentSafetyText, currentSafety);
      }
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    detailsPanelInstance.clearDetailsPanel();
    appearancePanelInstance.clearAppearancePanel();
  });

  // Helper function for showing room properties
  window.showRoomProperties = function (roomPolygon, roomText, room) {
    window.showDeviceProperties("room-polygon", roomText, roomPolygon, room);
  };

  // Helper function for showing risk properties
  window.showRiskProperties = function (riskPolygon, riskText, risk) {
    window.showDeviceProperties("risk-polygon", riskText, riskPolygon, risk);
  };

  // Helper function for showing safety properties
  window.showSafetyProperties = function (safetyPolygon, safetyText, safety) {
    window.showDeviceProperties("safety-polygon", safetyText, safetyPolygon, safety);
  };
};

// Waits for the page to load before setting up
if (!window.__polygonPropertiesSetupStarted) {
  window.__polygonPropertiesSetupStarted = true;

  const initialize = () => {
    const zoneLabelInput = document.getElementById("zone-label-input");
    const roomLabelInput = document.getElementById("room-label-input");
    const riskLabelInput = document.getElementById("risk-label-input");

    if (zoneLabelInput || roomLabelInput || riskLabelInput) {
      initPolygonPropertiesCoordinator();
      window.__polygonPropertiesInitialized = true;
      return true;
    }
    return false;
  };

  const kickOff = () => {
    if (!initialize()) {
      setTimeout(kickOff, 50);
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    kickOff();
  } else {
    document.addEventListener("DOMContentLoaded", kickOff);
  }

  document.addEventListener("htmlIncludesLoaded", kickOff);
}
