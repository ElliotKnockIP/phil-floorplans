import { createPopoverBase } from "./popover-utils.js";
import { setupColorControls, getHexFromFill, preventEventPropagation } from "./sidebar-utils.js";

const DEFAULT_COLOR = "#ff6b35"; // Orange/red color for safety hotspots
const DEFAULT_STROKE = "#8b0000"; // Dark red stroke
const DEFAULT_STROKE_WIDTH = 4;

function getCircle(group) {
  return group?._objects?.find((o) => o.type === "circle") || null;
}

function getText(group) {
  return group?._objects?.find((o) => o.type === "i-text" || o.type === "text") || null;
}

function ensureDefaults(group) {
  if (!group) return;
  if (!group.hotspotLabel) group.hotspotLabel = "1";
  if (!group.hotspotName) group.hotspotName = `Hotspot ${group.hotspotLabel}`;
  if (group.hotspotSeverity === undefined) group.hotspotSeverity = "";
  if (group.hotspotNotes === undefined) group.hotspotNotes = "";

  const circle = getCircle(group);

  // Force consistent stroke appearance even after legacy loads/resizes
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

function updateFillColor(group, color) {
  const circle = getCircle(group);
  if (circle) circle.set({ fill: color });
  group.hotspotColor = color;
  group.dirty = true;
  group.canvas?.requestRenderAll();
}

function updateStrokeColor(group, color) {
  const circle = getCircle(group);
  if (circle) circle.set({ stroke: color });
  group.hotspotStroke = color;
  group.dirty = true;
  group.canvas?.requestRenderAll();
}

function updateNumber(group, number) {
  const text = getText(group);
  if (text) {
    text.set({ text: number });
    group.hotspotLabel = number;
    group.dirty = true;
    group.canvas?.requestRenderAll();
  }
}

function bindInputs(basePopover) {
  const nameInput = document.getElementById("hotspot-name-input");
  const severitySelect = document.getElementById("hotspot-severity-select");
  const notesInput = document.getElementById("hotspot-notes-input");

  if (nameInput) {
    preventEventPropagation(nameInput);
    nameInput.addEventListener("input", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      const newName = nameInput.value.trim();
      target.hotspotName = newName;

      // Extract number from name if present
      const numberMatch = newName.match(/\d+/);
      if (numberMatch) {
        updateNumber(target, numberMatch[0]);
      }
    });
  }

  // Setup Fill Color Controls
  const fillPicker = document.getElementById("hotspot-fill-color-picker");
  if (fillPicker) preventEventPropagation(fillPicker);
  const fillIcons = document.querySelectorAll(".hotspot-fill-colour .colour-icon");
  setupColorControls(fillPicker, fillIcons, (color) => {
    const target = basePopover.currentTarget;
    if (!target) return;
    updateFillColor(target, color);
  });

  // Setup Stroke Color Controls
  const strokePicker = document.getElementById("hotspot-stroke-color-picker");
  if (strokePicker) preventEventPropagation(strokePicker);
  const strokeIcons = document.querySelectorAll(".hotspot-stroke-colour .colour-icon");
  setupColorControls(strokePicker, strokeIcons, (color) => {
    const target = basePopover.currentTarget;
    if (!target) return;
    updateStrokeColor(target, color);
  });

  if (severitySelect) {
    preventEventPropagation(severitySelect);
    severitySelect.addEventListener("change", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      target.hotspotSeverity = severitySelect.value;
    });
  }

  if (notesInput) {
    preventEventPropagation(notesInput);
    notesInput.addEventListener("input", () => {
      const target = basePopover.currentTarget;
      if (!target) return;
      target.hotspotNotes = notesInput.value;
    });
  }

  return { nameInput, severitySelect, notesInput };
}

function populateForm(inputs, group) {
  if (!inputs || !group) return;
  const { nameInput, severitySelect, notesInput } = inputs;

  if (nameInput) nameInput.value = group.hotspotName || "";
  if (severitySelect) severitySelect.value = group.hotspotSeverity || "";
  if (notesInput) notesInput.value = group.hotspotNotes || "";

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

(function initHotspotPopover() {
  function initialize() {
    const popover = document.getElementById("hotspot-popover");
    if (!popover) return;

    const basePopover = createPopoverBase("hotspot-popover", {
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
      if (group.hotspotColor) {
        updateFillColor(group, group.hotspotColor);
      }
      if (group.hotspotStroke) {
        updateStrokeColor(group, group.hotspotStroke);
      }

      basePopover.openPopover(group);
    }

    window.showHotspotPopover = openPopover;
    window.hideHotspotPopover = () => basePopover.closePopover();
  }

  // Check if HTML is already loaded
  if (document.getElementById("hotspot-popover")) {
    initialize();
  } else {
    // Wait for HTML includes to load
    document.addEventListener("htmlIncludesLoaded", initialize);
  }
})();
