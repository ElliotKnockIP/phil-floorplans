import { PopoverBase } from "./PopoverBase.js";
import { setupColorControls, getHexFromFill, preventEventPropagation } from "../sidebar-utils.js";

const DEFAULT_COLOR = "#ff6b35"; // Orange/red color for safety hotspots
const DEFAULT_STROKE = "#8b0000"; // Dark red stroke
const DEFAULT_STROKE_WIDTH = 4;

// Manages the Safety Hotspot properties popover
export class HotspotPopover extends PopoverBase {
  // Initialize popover and bind inputs
  constructor() {
    super("hotspot-popover", {
      onClose: () => {
        this.currentTarget = null;
      },
    });

    if (!this.popover) return;

    this.inputs = this.bindInputs();
    this.initializeGlobalFunctions();
  }

  // Sets up global access for opening/hiding
  initializeGlobalFunctions() {
    window.showHotspotPopover = (group) => this.open(group);
    window.hideHotspotPopover = () => this.closePopover();
  }

  // Finds the circle object in the group
  getCircle(group) {
    return group?._objects?.find((o) => o.type === "circle") || null;
  }

  // Finds the text object in the group
  getText(group) {
    return group?._objects?.find((o) => o.type === "i-text" || o.type === "text") || null;
  }

  // Ensures all required properties exist on the group
  ensureDefaults(group) {
    if (!group) return;
    if (!group.hotspotLabel) group.hotspotLabel = "1";
    if (!group.hotspotName) group.hotspotName = `Hotspot ${group.hotspotLabel}`;
    if (group.hotspotSeverity === undefined) group.hotspotSeverity = "";
    if (group.hotspotLikelihood === undefined) group.hotspotLikelihood = "";
    if (group.hotspotRiskAssessment === undefined) group.hotspotRiskAssessment = "";
    if (group.hotspotControlMeasures === undefined) group.hotspotControlMeasures = "";

    const circle = this.getCircle(group);
    if (circle) {
      circle.set({ strokeUniform: true, strokeWidth: DEFAULT_STROKE_WIDTH });
    }

    if (!group.hotspotColor) {
      group.hotspotColor = (circle && circle.fill) || DEFAULT_COLOR;
    }
    if (!group.hotspotStroke) {
      group.hotspotStroke = (circle && circle.stroke) || DEFAULT_STROKE;
    }
  }

  // Updates the fill color of the hotspot
  updateFillColor(group, color) {
    const circle = this.getCircle(group);
    if (circle) circle.set({ fill: color });
    group.hotspotColor = color;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }

  // Updates the stroke color of the hotspot
  updateStrokeColor(group, color) {
    const circle = this.getCircle(group);
    if (circle) circle.set({ stroke: color });
    group.hotspotStroke = color;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }

  // Updates the label number
  updateNumber(group, number) {
    const text = this.getText(group);
    if (text) {
      text.set({ text: number });
      group.hotspotLabel = number;
      group.dirty = true;
      group.canvas?.requestRenderAll();
    }
  }

  // Binds UI inputs to logic
  bindInputs() {
    const nameInput = document.getElementById("hotspot-name-input");
    const severitySelect = document.getElementById("hotspot-severity-select");
    const likelihoodSelect = document.getElementById("hotspot-likelihood-select");
    const riskAssessmentInput = document.getElementById("hotspot-risk-assessment-input");
    const controlMeasuresInput = document.getElementById("hotspot-control-measures-input");

    if (nameInput) {
      preventEventPropagation(nameInput);
      nameInput.addEventListener("input", () => {
        if (!this.currentTarget) return;
        const newName = nameInput.value.trim();
        this.currentTarget.hotspotName = newName;

        const numberMatch = newName.match(/\d+/);
        if (numberMatch) {
          this.updateNumber(this.currentTarget, numberMatch[0]);
        }
      });
    }

    // Fill Color Controls
    const fillPicker = document.getElementById("hotspot-fill-color-picker");
    if (fillPicker) preventEventPropagation(fillPicker);
    const fillIcons = document.querySelectorAll(".hotspot-fill-colour .colour-icon");
    setupColorControls(fillPicker, fillIcons, (color) => {
      if (this.currentTarget) this.updateFillColor(this.currentTarget, color);
    });

    // Stroke Color Controls
    const strokePicker = document.getElementById("hotspot-stroke-color-picker");
    if (strokePicker) preventEventPropagation(strokePicker);
    const strokeIcons = document.querySelectorAll(".hotspot-stroke-colour .colour-icon");
    setupColorControls(strokePicker, strokeIcons, (color) => {
      if (this.currentTarget) this.updateStrokeColor(this.currentTarget, color);
    });

    if (severitySelect) {
      preventEventPropagation(severitySelect);
      severitySelect.addEventListener("change", () => {
        if (this.currentTarget) this.currentTarget.hotspotSeverity = severitySelect.value;
      });
    }

    if (likelihoodSelect) {
      preventEventPropagation(likelihoodSelect);
      likelihoodSelect.addEventListener("change", () => {
        if (this.currentTarget) this.currentTarget.hotspotLikelihood = likelihoodSelect.value;
      });
    }

    if (riskAssessmentInput) {
      preventEventPropagation(riskAssessmentInput);
      riskAssessmentInput.addEventListener("input", () => {
        if (this.currentTarget) this.currentTarget.hotspotRiskAssessment = riskAssessmentInput.value;
      });
    }

    if (controlMeasuresInput) {
      preventEventPropagation(controlMeasuresInput);
      controlMeasuresInput.addEventListener("input", () => {
        if (this.currentTarget) this.currentTarget.hotspotControlMeasures = controlMeasuresInput.value;
      });
    }

    return { nameInput, severitySelect, likelihoodSelect, riskAssessmentInput, controlMeasuresInput };
  }

  // Populates the form with group data
  populateForm(group) {
    if (!this.inputs || !group) return;

    if (this.inputs.nameInput) this.inputs.nameInput.value = group.hotspotName || "";
    if (this.inputs.severitySelect) this.inputs.severitySelect.value = group.hotspotSeverity || "";
    if (this.inputs.likelihoodSelect) this.inputs.likelihoodSelect.value = group.hotspotLikelihood || "";
    if (this.inputs.riskAssessmentInput) this.inputs.riskAssessmentInput.value = group.hotspotRiskAssessment || "";
    if (this.inputs.controlMeasuresInput) this.inputs.controlMeasuresInput.value = group.hotspotControlMeasures || "";

    // Sync color pickers
    const fillPicker = document.getElementById("hotspot-fill-color-picker");
    if (fillPicker) {
      fillPicker.value = group.hotspotColor ? getHexFromFill(group.hotspotColor) : DEFAULT_COLOR;
    }

    const strokePicker = document.getElementById("hotspot-stroke-color-picker");
    if (strokePicker) {
      strokePicker.value = group.hotspotStroke ? getHexFromFill(group.hotspotStroke) : DEFAULT_STROKE;
    }
  }

  // Opens the popover for a specific group
  open(group) {
    if (!group || this.isDragging) return;
    this.ensureDefaults(group);
    this.populateForm(group);

    // Apply current colors to ensure visual matches stored value
    if (group.hotspotColor) {
      this.updateFillColor(group, group.hotspotColor);
    }
    if (group.hotspotStroke) {
      this.updateStrokeColor(group, group.hotspotStroke);
    }

    this.openPopover(group);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("hotspot-popover")) {
    new HotspotPopover();
  } else {
    document.addEventListener("htmlIncludesLoaded", () => new HotspotPopover());
  }
});
