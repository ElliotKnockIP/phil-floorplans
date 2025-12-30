import { createPopoverBase } from "./popover-utils.js";
import { setupColorControls, getHexFromFill, preventEventPropagation } from "./sidebar-utils.js";

const DEFAULT_COLOR = "#fff200";
const DEFAULT_STROKE = "#000000";
const DEFAULT_STROKE_WIDTH = 4;

function getCircle(group) {
  return group?._objects?.find((o) => o.type === "circle") || null;
}

function getText(group) {
  return group?._objects?.find((o) => o.type === "i-text" || o.type === "text") || null;
}

function ensureDefaults(group) {
  if (!group) return;
  if (!group.accessPointLabel) group.accessPointLabel = "1";
  if (!group.accessPointName) group.accessPointName = `Access Point ${group.accessPointLabel}`;
  if (group.accessPointCondition === undefined) group.accessPointCondition = "";
  if (group.accessPointNotes === undefined) group.accessPointNotes = "";

  const circle = getCircle(group);
  const text = getText(group);

  // Force consistent stroke appearance even after legacy loads/resizes
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

function updateFillColor(group, color) {
  const circle = getCircle(group);
  if (circle) circle.set({ fill: color });
  group.accessPointColor = color;
  group.dirty = true;
  group.canvas?.requestRenderAll();
}

function updateStrokeColor(group, color) {
  const circle = getCircle(group);
  if (circle) circle.set({ stroke: color });
  group.accessPointStroke = color;
  group.dirty = true;
  group.canvas?.requestRenderAll();
}

function updateNumber(group, number) {
  const text = getText(group);
  if (text) {
    text.set({ text: number });
    group.accessPointLabel = number;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }
}

function bindInputs(basePopover) {
  const nameInput = document.getElementById("access-point-name-input");
  // Number input removed from UI
  const conditionSelect = document.getElementById("access-point-condition-select");
  const notesInput = document.getElementById("access-point-notes-input");

  if (nameInput) {
    preventEventPropagation(nameInput);
    nameInput.addEventListener("input", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      const newName = nameInput.value.trim();
      target.accessPointName = newName;

      // Extract number from name if present
      const numberMatch = newName.match(/\d+/);
      if (numberMatch) {
        updateNumber(target, numberMatch[0]);
      }
    });
  }

  // Setup Fill Color Controls
  const fillPicker = document.getElementById("access-point-fill-color-picker");
  if (fillPicker) preventEventPropagation(fillPicker);
  const fillIcons = document.querySelectorAll(".access-point-fill-colour .colour-icon");
  setupColorControls(fillPicker, fillIcons, (color) => {
    const target = basePopover.currentTarget;
    if (!target) return;
    updateFillColor(target, color);
  });

  // Setup Stroke Color Controls
  const strokePicker = document.getElementById("access-point-stroke-color-picker");
  if (strokePicker) preventEventPropagation(strokePicker);
  const strokeIcons = document.querySelectorAll(".access-point-stroke-colour .colour-icon");
  setupColorControls(strokePicker, strokeIcons, (color) => {
    const target = basePopover.currentTarget;
    if (!target) return;
    updateStrokeColor(target, color);
  });

  if (conditionSelect) {
    preventEventPropagation(conditionSelect);
    conditionSelect.addEventListener("change", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      target.accessPointCondition = conditionSelect.value;
    });
  }

  if (notesInput) {
    preventEventPropagation(notesInput);
    notesInput.addEventListener("input", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      target.accessPointNotes = notesInput.value;
    });
  }

  return { nameInput, conditionSelect, notesInput };
}

function populateForm(inputs, group) {
  if (!inputs || !group) return;
  const { nameInput, conditionSelect, notesInput } = inputs;

  if (nameInput) nameInput.value = group.accessPointName || "";
  if (conditionSelect) conditionSelect.value = group.accessPointCondition || "";
  if (notesInput) notesInput.value = group.accessPointNotes || "";

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

(function initAccessPointPopover() {
  const popover = document.getElementById("access-point-popover");
  if (!popover) return;

  const basePopover = createPopoverBase("access-point-popover", {
    onClose: () => {
      basePopover.currentTarget = null;
    },
  });

  if (!basePopover) return;

  const inputs = bindInputs(basePopover);

  function openPopover(group) {
    if (!group || basePopover.isDragging) return;
    ensureDefaults(group);
    populateForm(inputs, group);

    // Apply current colors to ensure visual matches stored value
    if (group.accessPointColor) {
      updateFillColor(group, group.accessPointColor);
    }
    if (group.accessPointStroke) {
      updateStrokeColor(group, group.accessPointStroke);
    }

    basePopover.openPopover(group);
  }

  window.showAccessPointPopover = openPopover;
  window.hideAccessPointPopover = () => basePopover.closePopover();
})();
