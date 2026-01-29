import { preventEventPropagation, createSliderInputSync, setupColorControls, setMultipleObjectProperties, calculateArea, updatePolygonText, updatePolygonColor, updateWarningText } from "../sidebar-utils.js";
import { updateControlPointColors } from "../../drawing/polygon-editing.js";

// Manages all polygon property panels (Zones, Rooms, Risks, Safety)
export class PolygonPanels {
  // Initialize polygon state and setup controls
  constructor() {
    this.currentPolygon = null;
    this.currentTextObject = null;
    this.currentType = null;

    this.init();
  }

  // Initializes all input bindings
  init() {
    this.setupZoneInputs();
    this.setupRoomInputs();
    this.setupRiskInputs();
    this.setupSafetyInputs();
    this.setupAppearanceControls();
    this.setupSliders();

    // Global access for updates
    window.updatePolygonPanels = (type, polygon, textObj) => this.update(type, polygon, textObj);
  }

  // Binds Zone-specific inputs
  setupZoneInputs() {
    const inputs = {
      name: document.getElementById("zone-label-input"),
      notes: document.getElementById("zone-notes-input"),
      number: document.getElementById("zone-number-input"),
      resistance: document.getElementById("zone-resistance-value-input"),
    };

    if (inputs.name) {
      inputs.name.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.zoneName = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(inputs.name);
    }

    if (inputs.notes) {
      inputs.notes.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.zoneNotes = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(inputs.notes);
    }

    [inputs.number, inputs.resistance].forEach((el) => {
      if (el) {
        el.addEventListener("input", (e) => {
          if (this.currentPolygon) {
            const prop = el.id.includes("number") ? "zoneNumber" : "zoneResistanceValue";
            this.currentPolygon[prop] = e.target.value;
          }
        });
        preventEventPropagation(el);
      }
    });
  }

  // Binds Room-specific inputs
  setupRoomInputs() {
    const nameInput = document.getElementById("room-label-input");
    const notesInput = document.getElementById("room-notes-input");

    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.roomName = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(nameInput);
    }

    if (notesInput) {
      notesInput.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.roomNotes = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(notesInput);
    }
  }

  // Binds Risk-specific inputs
  setupRiskInputs() {
    const nameInput = document.getElementById("risk-label-input");
    const notesInput = document.getElementById("risk-notes-input");
    const easeSelect = document.getElementById("risk-ease-select");

    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.riskName = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(nameInput);
    }

    if (notesInput) {
      notesInput.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          this.currentPolygon.riskNotes = e.target.value;
          this.refreshText();
        }
      });
      preventEventPropagation(notesInput);
    }

    if (easeSelect) {
      easeSelect.addEventListener("change", (e) => {
        if (this.currentPolygon) this.currentPolygon.riskEase = e.target.value;
      });
      preventEventPropagation(easeSelect);
    }

    // Risk checkboxes
    ["intruder", "cctv", "access", "fire"].forEach((type) => {
      const checkbox = document.getElementById(`risk-show-${type}`);
      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          if (this.currentPolygon) {
            const prop = `showIn${type.charAt(0).toUpperCase() + type.slice(1)}`;
            this.currentPolygon[prop] = e.target.checked;
          }
        });
      }
    });
  }

  // Binds Safety-specific inputs
  setupSafetyInputs() {
    const nameInput = document.getElementById("safety-label-input");
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        if (this.currentPolygon) {
          const newName = e.target.value;
          this.currentPolygon.safetyName = newName;
          if (this.currentExtraData) this.currentExtraData.safetyName = newName;
          this.refreshText();
          if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
        }
      });
      preventEventPropagation(nameInput);
    }

    const addSubDetailBtn = document.getElementById("safety-add-sub-detail-btn");
    if (addSubDetailBtn) {
      addSubDetailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = this.currentExtraData || this.currentPolygon;
        if (target) {
          if (!target.safetySubDetails) {
            target.safetySubDetails = [];
          }
          target.safetySubDetails.push({
            name: "",
            likelihood: "",
            severity: "",
            controlMeasures: "",
          });
          this.renderSafetySubDetailsList();
          if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
        }
      });
      preventEventPropagation(addSubDetailBtn);
    }

    window.renderSafetySubDetailsList = () => this.renderSafetySubDetailsList();
  }

  // Binds slider inputs for height and text capabilities
  setupSliders() {
    // Height controls (Zones & Rooms)
    const heightConfigs = [
      { id: "zone-height-slider", inputId: "zone-height-input", warningId: "zone-warning" },
      { id: "room-height-slider", inputId: "room-height-input", warningId: "room-warning" },
    ];

    heightConfigs.forEach((config) => {
      const slider = document.getElementById(config.id);
      const displaySpan = document.getElementById(config.inputId);
      const warningEl = document.getElementById(config.warningId);

      if (slider) {
        preventEventPropagation(slider, ["mousedown", "click", "touchstart"]);
        createSliderInputSync(
          slider,
          displaySpan,
          (val) => {
            if (this.currentPolygon) {
              this.currentPolygon.ceilingHeight = val;
              if (this.currentTextObject) {
                this.currentTextObject.displayHeight = val;
              }
              if (warningEl) updateWarningText(warningEl, val);
              this.refreshText();
            }
          },
          { min: 1, max: 10, step: 0.1, suffix: "m" }
        );
      }
    });

    // Text Size controls (All types)
    const textSizeConfigs = [
      { id: "zone-text-size-slider", inputId: "zone-text-size-input" },
      { id: "room-text-size-slider", inputId: "room-text-size-input" },
      { id: "risk-text-size-slider", inputId: "risk-text-size-input" },
      { id: "safety-text-size-slider", inputId: "safety-text-size-input" },
    ];

    textSizeConfigs.forEach((config) => {
      const slider = document.getElementById(config.id);
      const displaySpan = document.getElementById(config.inputId);

      if (slider) {
        preventEventPropagation(slider, ["mousedown", "click", "touchstart"]);
        createSliderInputSync(
          slider,
          displaySpan,
          (val) => {
            if (this.currentTextObject) {
              this.currentTextObject.set({ fontSize: val });
              this.currentPolygon.canvas?.renderAll();
            }
          },
          { min: 1, max: 100, step: 1, suffix: "px" }
        );
      }
    });
  }

  // Renders the list of sub-details in the safety properties panel
  renderSafetySubDetailsList() {
    const listContainer = document.getElementById("safety-sub-details-list");
    const template = document.getElementById("safety-sub-detail-template");
    if (!listContainer || !template || !this.currentPolygon) return;

    listContainer.innerHTML = "";
    const target = this.currentExtraData || this.currentPolygon;
    const subDetails = target.safetySubDetails || [];

    subDetails.forEach((detail, index) => {
      const clone = template.content.cloneNode(true);
      const item = clone.querySelector("div");

      const safetyZones = window.safetyZones || [];
      const safetyIndex = safetyZones.indexOf(target) + 1 || safetyZones.findIndex((s) => s.polygon === this.currentPolygon) + 1 || 1;

      const indexEl = item.querySelector(".sub-detail-index");
      if (indexEl) indexEl.textContent = `${safetyIndex}.${index + 1}`;

      const nameInput = item.querySelector(".sub-detail-name");
      const likelihoodSelect = item.querySelector(".sub-detail-likelihood");
      const severitySelect = item.querySelector(".sub-detail-severity");
      const controlInput = item.querySelector(".sub-detail-control");
      const removeBtn = item.querySelector(".remove-sub-detail");

      if (nameInput) nameInput.value = detail.name || "";
      if (likelihoodSelect) likelihoodSelect.value = detail.likelihood || "";
      if (severitySelect) severitySelect.value = detail.severity || "";
      if (controlInput) controlInput.value = detail.controlMeasures || "";

      nameInput.addEventListener("input", (e) => {
        detail.name = e.target.value;
        if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
      });
      preventEventPropagation(nameInput);

      likelihoodSelect.addEventListener("change", (e) => {
        detail.likelihood = e.target.value;
        if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
      });
      preventEventPropagation(likelihoodSelect);

      severitySelect.addEventListener("change", (e) => {
        detail.severity = e.target.value;
        if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
      });
      preventEventPropagation(severitySelect);

      controlInput.addEventListener("input", (e) => {
        detail.controlMeasures = e.target.value;
        if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
      });
      preventEventPropagation(controlInput);

      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        target.safetySubDetails.splice(index, 1);
        this.renderSafetySubDetailsList();
        if (window.updateSafetyAssessmentTable) window.updateSafetyAssessmentTable();
      });

      listContainer.appendChild(item);
    });
  }

  // Binds appearance controls (colors, text size, toggles)
  setupAppearanceControls() {
    const types = ["zone", "room", "risk", "safety"];

    types.forEach((type) => {
      const colorPicker = document.getElementById(`${type}-color-picker`);
      const colorIcons = document.querySelectorAll(`.change-${type}-colour .colour-icon`);
      const textColorPicker = document.getElementById(`${type}-text-color-picker`);
      const textColorIcons = document.querySelectorAll(`.${type}-text-colour .colour-icon`);

      if (colorPicker) {
        setupColorControls(colorPicker, colorIcons, (color) => this.updateColor(color));
      }

      if (textColorPicker) {
        setupColorControls(textColorPicker, textColorIcons, (color) => this.updateTextColor(color));
      }

      // Toggles
      ["name", "area", "volume", "notes"].forEach((toggleType) => {
        const toggle = document.getElementById(`${type}-${toggleType}-toggle`);
        if (toggle) {
          toggle.addEventListener("change", () => this.refreshText());
        }
      });
    });
  }

  // Updates the panel with new polygon data
  update(type, polygon, textObj, extraData) {
    this.currentType = type;
    this.currentPolygon = polygon;
    this.currentTextObject = textObj;

    // If extraData is not provided, try to find it in the global arrays
    if (!extraData) {
      if (type === "safety") {
        extraData = (window.safetyZones || []).find((s) => s.polygon === polygon);
      } else if (type === "room") {
        extraData = (window.rooms || []).find((r) => r.polygon === polygon);
      } else if (type === "risk") {
        extraData = (window.risks || []).find((r) => r.polygon === polygon);
      }
    }

    this.currentExtraData = extraData; // Store safety/room/risk object

    // Set global reference for safety modal compatibility
    if (type === "safety") {
      window.currentSafety = extraData;
    } else {
      window.currentSafety = null;
    }

    this.syncInputs();
  }

  // Syncs UI inputs with current polygon data
  syncInputs() {
    if (!this.currentPolygon) return;

    const type = this.currentType;
    const nameInput = document.getElementById(`${type}-label-input`);
    const notesInput = document.getElementById(`${type}-notes-input`);

    if (nameInput) nameInput.value = this.currentPolygon[`${type}Name`] || "";
    if (notesInput) notesInput.value = this.currentPolygon[`${type}Notes`] || "";

    // Sync Risk-specific fields
    if (type === "risk") {
      const easeSelect = document.getElementById("risk-ease-select");
      if (easeSelect) easeSelect.value = this.currentPolygon.riskEase || "";

      ["intruder", "cctv", "access", "fire"].forEach((riskType) => {
        const checkbox = document.getElementById(`risk-show-${riskType}`);
        if (checkbox) {
          const prop = `showIn${riskType.charAt(0).toUpperCase() + riskType.slice(1)}`;
          checkbox.checked = !!this.currentPolygon[prop];
        }
      });
    }

    // Sync Safety-specific fields
    if (type === "safety") {
      // Ensure safetySubDetails exists on the extraData object if provided
      if (this.currentExtraData && !this.currentExtraData.safetySubDetails) {
        this.currentExtraData.safetySubDetails = [];
      }
      this.renderSafetySubDetailsList();
    }

    // Sync colors
    const colorPicker = document.getElementById(`${type}-color-picker`);
    if (colorPicker && this.currentPolygon.stroke) {
      colorPicker.value = this.currentPolygon.stroke;
    }

    // Initialize visibility flags based on existing text content
    if (this.currentTextObject && this.currentTextObject.text) {
      const existingText = this.currentTextObject.text;

      if (this.currentPolygon.areaVisible === undefined) {
        this.currentPolygon.areaVisible = existingText.includes("Area:");
      }
      if (this.currentPolygon.volumeVisible === undefined) {
        this.currentPolygon.volumeVisible = existingText.includes("Volume:");
      }
      if (this.currentPolygon.notesVisible === undefined) {
        this.currentPolygon.notesVisible = existingText.includes("Notes:");
      }

      if (this.currentPolygon.nameVisible === undefined) {
        this.currentPolygon.nameVisible = true;
      }
    }

    // Sync toggles
    ["name", "area", "volume", "notes"].forEach((toggleType) => {
      const toggle = document.getElementById(`${type}-${toggleType}-toggle`);
      if (toggle) {
        const prop = `${toggleType}Visible`;
        if (this.currentPolygon[prop] !== undefined) {
          toggle.checked = this.currentPolygon[prop];
        } else if (toggleType === "name") {
          toggle.checked = true; // Default to showing name if undefined
        } else {
          toggle.checked = false; // Default others to hidden
        }
      }
    });

    // Sync Sliders

    // Height
    const heightSlider = document.getElementById(`${type}-height-slider`);
    if (heightSlider) {
      heightSlider.value = this.currentPolygon.ceilingHeight || 2.4;
      heightSlider.dispatchEvent(new Event("input"));
    }

    // Text Size
    const textSizeSlider = document.getElementById(`${type}-text-size-slider`);
    if (textSizeSlider && this.currentTextObject) {
      textSizeSlider.value = this.currentTextObject.fontSize || 15;
      textSizeSlider.dispatchEvent(new Event("input"));
    }
  }

  // Refreshes the text display on the canvas
  refreshText() {
    if (!this.currentPolygon || !this.currentTextObject || !this.currentPolygon.canvas) return;

    const type = this.currentType;
    const toggles = {
      name: document.getElementById(`${type}-name-toggle`),
      area: document.getElementById(`${type}-area-toggle`),
      volume: document.getElementById(`${type}-volume-toggle`),
      notes: document.getElementById(`${type}-notes-toggle`),
    };

    const name = this.currentPolygon[`${type}Name`] || "Polygon";
    const notes = this.currentPolygon[`${type}Notes`] || "";
    const height = this.currentPolygon.ceilingHeight || 2.4;
    const isZone = type === "zone";

    updatePolygonText(this.currentPolygon, this.currentTextObject, this.currentPolygon.canvas, toggles, name, notes, height, isZone);

    // Save visibility state to polygon object 
    if (toggles.name) this.currentPolygon.nameVisible = toggles.name.checked;
    if (toggles.area) this.currentPolygon.areaVisible = toggles.area.checked;
    if (toggles.volume) this.currentPolygon.volumeVisible = toggles.volume.checked;
    if (toggles.notes) this.currentPolygon.notesVisible = toggles.notes.checked;
  }

  // Updates polygon fill and stroke colors
  updateColor(color) {
    if (!this.currentPolygon || !this.currentTextObject) return;
    updatePolygonColor(this.currentPolygon, this.currentTextObject, color, this.currentType);
    updateControlPointColors(this.currentPolygon);
  }

  // Updates polygon text color
  updateTextColor(color) {
    if (this.currentTextObject) {
      this.currentTextObject.set({ fill: color });
      this.currentPolygon.canvas?.renderAll();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector("[data-include]")) {
    document.addEventListener("htmlIncludesLoaded", () => new PolygonPanels());
  } else {
    new PolygonPanels();
  }
});
