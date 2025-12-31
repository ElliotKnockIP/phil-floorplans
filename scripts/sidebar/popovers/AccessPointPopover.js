import { PopoverBase } from "./PopoverBase.js";
import { setupColorControls, getHexFromFill, preventEventPropagation } from "../sidebar-utils.js";

const DEFAULT_COLOR = "#fff200";
const DEFAULT_STROKE = "#000000";
const DEFAULT_STROKE_WIDTH = 4;

// Manages the Access Point properties popover
export class AccessPointPopover extends PopoverBase {
  // Initialize popover and bind inputs
  constructor() {
    super("access-point-popover", {
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
    window.showAccessPointPopover = (group) => this.open(group);
    window.hideAccessPointPopover = () => this.closePopover();
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
    if (!group.accessPointLabel) group.accessPointLabel = "1";
    if (!group.accessPointName) group.accessPointName = `Access Point ${group.accessPointLabel}`;
    if (group.accessPointCondition === undefined) group.accessPointCondition = "";
    if (group.accessPointNotes === undefined) group.accessPointNotes = "";

    // Risk assessment visibility flags
    if (group.showInIntruder === undefined) group.showInIntruder = false;
    if (group.showInCctv === undefined) group.showInCctv = false;
    if (group.showInAccess === undefined) group.showInAccess = false;
    if (group.showInFire === undefined) group.showInFire = false;

    const circle = this.getCircle(group);
    if (circle) {
      circle.set({ strokeUniform: true, strokeWidth: DEFAULT_STROKE_WIDTH });
    }

    if (!group.accessPointColor) {
      group.accessPointColor = (circle && circle.fill) || DEFAULT_COLOR;
    }
    if (!group.accessPointStroke) {
      group.accessPointStroke = (circle && circle.stroke) || DEFAULT_STROKE;
    }
  }

  // Updates the fill color of the access point
  updateFillColor(group, color) {
    const circle = this.getCircle(group);
    if (circle) circle.set({ fill: color });
    group.accessPointColor = color;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }

  // Updates the stroke color of the access point
  updateStrokeColor(group, color) {
    const circle = this.getCircle(group);
    if (circle) circle.set({ stroke: color });
    group.accessPointStroke = color;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }

  // Updates the label number
  updateNumber(group, number) {
    const text = this.getText(group);
    if (text) {
      text.set({ text: number });
      group.accessPointLabel = number;
      group.dirty = true;
      group.canvas?.requestRenderAll();
    }
  }

  // Binds UI inputs to logic
  bindInputs() {
    const nameInput = document.getElementById("access-point-name-input");
    const conditionSelect = document.getElementById("access-point-condition-select");
    const notesInput = document.getElementById("access-point-notes-input");

    if (nameInput) {
      preventEventPropagation(nameInput);
      nameInput.addEventListener("input", () => {
        if (!this.currentTarget) return;
        const newName = nameInput.value.trim();
        this.currentTarget.accessPointName = newName;

        const numberMatch = newName.match(/\d+/);
        if (numberMatch) {
          this.updateNumber(this.currentTarget, numberMatch[0]);
        }
      });
    }

    // Fill Color Controls
    const fillPicker = document.getElementById("access-point-fill-color-picker");
    if (fillPicker) preventEventPropagation(fillPicker);
    const fillIcons = document.querySelectorAll(".access-point-fill-colour .colour-icon");
    setupColorControls(fillPicker, fillIcons, (color) => {
      if (this.currentTarget) this.updateFillColor(this.currentTarget, color);
    });

    // Stroke Color Controls
    const strokePicker = document.getElementById("access-point-stroke-color-picker");
    if (strokePicker) preventEventPropagation(strokePicker);
    const strokeIcons = document.querySelectorAll(".access-point-stroke-colour .colour-icon");
    setupColorControls(strokePicker, strokeIcons, (color) => {
      if (this.currentTarget) this.updateStrokeColor(this.currentTarget, color);
    });

    if (conditionSelect) {
      preventEventPropagation(conditionSelect);
      conditionSelect.addEventListener("change", () => {
        if (this.currentTarget) this.currentTarget.accessPointCondition = conditionSelect.value;
      });
    }

    if (notesInput) {
      preventEventPropagation(notesInput);
      notesInput.addEventListener("input", () => {
        if (this.currentTarget) this.currentTarget.accessPointNotes = notesInput.value;
      });
    }

    // Risk Assessment Checkboxes
    const riskCheckboxes = {
      intruder: document.getElementById("access-point-show-intruder"),
      cctv: document.getElementById("access-point-show-cctv"),
      access: document.getElementById("access-point-show-access"),
      fire: document.getElementById("access-point-show-fire"),
    };

    Object.entries(riskCheckboxes).forEach(([key, cb]) => {
      if (!cb) return;
      preventEventPropagation(cb);
      cb.addEventListener("change", () => {
        if (this.currentTarget) {
          const prop = `showIn${key.charAt(0).toUpperCase() + key.slice(1)}`;
          this.currentTarget[prop] = cb.checked;
        }
      });
    });

    return { nameInput, conditionSelect, notesInput, ...riskCheckboxes };
  }

  // Populates the form with group data
  populateForm(group) {
    if (!this.inputs || !group) return;

    if (this.inputs.nameInput) this.inputs.nameInput.value = group.accessPointName || "";
    if (this.inputs.conditionSelect) this.inputs.conditionSelect.value = group.accessPointCondition || "";
    if (this.inputs.notesInput) this.inputs.notesInput.value = group.accessPointNotes || "";

    if (this.inputs.intruder) this.inputs.intruder.checked = !!group.showInIntruder;
    if (this.inputs.cctv) this.inputs.cctv.checked = !!group.showInCctv;
    if (this.inputs.access) this.inputs.access.checked = !!group.showInAccess;
    if (this.inputs.fire) this.inputs.fire.checked = !!group.showInFire;

    // Sync color pickers
    const fillPicker = document.getElementById("access-point-fill-color-picker");
    if (fillPicker) {
      fillPicker.value = group.accessPointColor ? getHexFromFill(group.accessPointColor) : DEFAULT_COLOR;
    }

    const strokePicker = document.getElementById("access-point-stroke-color-picker");
    if (strokePicker) {
      strokePicker.value = group.accessPointStroke ? getHexFromFill(group.accessPointStroke) : DEFAULT_STROKE;
    }
  }

  // Opens the popover for a specific group
  open(group) {
    if (!group || this.isDragging) return;
    this.ensureDefaults(group);
    this.populateForm(group);

    // Apply current colors to ensure visual matches stored value
    if (group.accessPointColor) {
      this.updateFillColor(group, group.accessPointColor);
    }
    if (group.accessPointStroke) {
      this.updateStrokeColor(group, group.accessPointStroke);
    }

    this.openPopover(group);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("access-point-popover")) {
    new AccessPointPopover();
  } else {
    document.addEventListener("htmlIncludesLoaded", () => new AccessPointPopover());
  }
});
