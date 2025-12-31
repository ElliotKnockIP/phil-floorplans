// Device label utility functions

const OFFSET_MARGIN = 10;
const CUSTOM_OFFSET_THRESHOLD = 1;

// Calculate the default position offset for a device label
export function getDefaultLabelOffset(group) {
  if (!group) {
    return { x: 0, y: OFFSET_MARGIN + 20 };
  }
  // Use group scale factor or default to 1
  const scaleFactor = typeof group.scaleFactor === "number" && !Number.isNaN(group.scaleFactor) ? group.scaleFactor : 1;
  return { x: 0, y: 20 * scaleFactor + OFFSET_MARGIN };
}

// Configure whether a text label can be dragged by the user
export function setLabelDragState(text, enabled) {
  if (!text) return;

  text.selectable = enabled;
  text.evented = enabled;
  text.lockMovementX = !enabled;
  text.lockMovementY = !enabled;
  text.lockScalingX = true;
  text.lockScalingY = true;
  text.lockRotation = true;
  text.hasControls = false;
  text.hasBorders = false;
  text.hoverCursor = enabled ? "move" : "default";
  text.moveCursor = enabled ? "move" : "default";

  // Deselect the label if it was active when disabling drag
  if (!enabled && text.canvas && typeof text.canvas.getActiveObject === "function") {
    const active = text.canvas.getActiveObject();
    if (active === text && typeof text.canvas.discardActiveObject === "function") {
      text.canvas.discardActiveObject();
    }
  }
}

// Position the label relative to its parent device group
export function applyLabelPosition(group) {
  if (!group || !group.textObject) return;
  const text = group.textObject;
  const canvas = group.canvas || text.canvas;
  // Get center point of the group or use its top/left
  const center = typeof group.getCenterPoint === "function" ? group.getCenterPoint() : { x: group.left || 0, y: group.top || 0 };
  const defaultOffset = getDefaultLabelOffset(group);

  // Initialize or maintain label offset
  if (!group.labelOffset) {
    group.labelOffset = { ...defaultOffset };
    group.hasCustomLabelOffset = false;
  } else if (!group.hasCustomLabelOffset) {
    group.labelOffset = { x: 0, y: defaultOffset.y };
  }

  const offset = group.labelOffset || defaultOffset;
  const left = center.x + (offset.x || 0);
  const top = center.y + (typeof offset.y === "number" ? offset.y : defaultOffset.y);

  text.set({ left, top });
  if (typeof text.setCoords === "function") text.setCoords();

  // Ensure label stays on top of other objects
  if (!text._isHidden && canvas && typeof text.bringToFront === "function") {
    text.bringToFront();
  }
}

// Link a label to a device group and set up event listeners
export function attachLabelBehavior(group, text, fabricCanvas = null) {
  if (!group || !text) return;
  const canvas = fabricCanvas || group.canvas || text.canvas;

  group.textObject = text;
  text._parentGroup = group;

  applyLabelPosition(group);
  setLabelDragState(text, !!window.globalLabelDragEnabled);

  // Update label position when the device group is moved
  const updatePosition = () => {
    applyLabelPosition(group);
    if (typeof group.bringToFront === "function") group.bringToFront();
    if (!text._isHidden && typeof text.bringToFront === "function") text.bringToFront();
    if (canvas && typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  };

  if (group._labelMoveHandler) {
    group.off("moving", group._labelMoveHandler);
  }
  group._labelMoveHandler = updatePosition;
  group.on("moving", group._labelMoveHandler);

  // Reset to default offset if text content changes and no custom offset exists
  if (text._labelChangedHandler) {
    text.off("changed", text._labelChangedHandler);
  }
  text._labelChangedHandler = () => {
    if (!group.hasCustomLabelOffset) {
      const defaultOffset = getDefaultLabelOffset(group);
      group.labelOffset = { x: 0, y: defaultOffset.y };
    }
    applyLabelPosition(group);
    if (canvas && typeof canvas.renderAll === "function") canvas.renderAll();
  };
  text.on("changed", text._labelChangedHandler);

  // Track custom label positioning when the label is dragged
  if (text._labelMovingHandler) {
    text.off("moving", text._labelMovingHandler);
  }
  text._labelMovingHandler = () => {
    if (!window.globalLabelDragEnabled) {
      applyLabelPosition(group);
      if (canvas && typeof canvas.renderAll === "function") canvas.renderAll();
      return;
    }

    const center = typeof group.getCenterPoint === "function" ? group.getCenterPoint() : { x: group.left || 0, y: group.top || 0 };

    group.labelOffset = {
      x: (text.left || 0) - center.x,
      y: (text.top || 0) - center.y,
    };

    // Check if the new position is far enough from default to be considered custom
    const defaultOffset = getDefaultLabelOffset(group);
    const diffX = Math.abs(group.labelOffset.x || 0);
    const diffY = Math.abs((group.labelOffset.y || 0) - defaultOffset.y);

    group.hasCustomLabelOffset = diffX > CUSTOM_OFFSET_THRESHOLD || diffY > CUSTOM_OFFSET_THRESHOLD;

    if (typeof text.setCoords === "function") text.setCoords();
    if (canvas && typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  };
  text.on("moving", text._labelMovingHandler);

  // Refresh canvas when label drag ends
  if (typeof text.on === "function" && !text._labelMouseUpHandler) {
    text._labelMouseUpHandler = () => {
      if (canvas && typeof canvas.renderAll === "function") canvas.renderAll();
    };
    text.on("mouseup", text._labelMouseUpHandler);
  }

  // Expose position update method on the group
  if (!group.updateLabelPosition) {
    group.updateLabelPosition = () => applyLabelPosition(group);
  }

  updatePosition();
}

// Enable or disable dragging for a specific group's label
export function setGroupLabelDragState(group, enabled) {
  if (!group || !group.textObject) return;
  setLabelDragState(group.textObject, enabled);
}

// Find the next sequential number for a new device label
export function getNextAvailableDeviceNumber(fabricCanvas, isCamera) {
  const prefix = isCamera ? "Camera " : "Device ";
  const usedNumbers = new Set();

  // Scan all objects on canvas to find existing device numbers
  fabricCanvas.getObjects().forEach((obj) => {
    let text = "";
    if (obj.textObject && obj.textObject.text) {
      text = obj.textObject.text;
    } else if (obj.type === "text" || obj.type === "i-text") {
      text = obj.text;
    }

    if (text && text.startsWith(prefix)) {
      const numStr = text.substring(prefix.length);
      if (numStr.length > 0 && !isNaN(numStr)) {
        const num = parseInt(numStr, 10);
        usedNumbers.add(num);
      }
    }
  });

  // Find the first gap in the sequence
  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }
  return next;
}
