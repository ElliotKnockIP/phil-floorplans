let currentTool = null;
let currentCanvas = null;
let keyHandler = null; // Store reference to the key handler
let toolCleanupFunction = null; // Store reference to tool-specific cleanup

// Show drawing mode popup
export function showDrawingPopup() {
  const popup = document.getElementById("drawing-mode-popup");
  if (popup) popup.style.display = "block";
}

// Hide drawing mode popup
export function hideDrawingPopup() {
  const popup = document.getElementById("drawing-mode-popup");
  if (popup) popup.style.display = "none";
}

// Set crosshair cursor for drawing
export function setCrosshairCursor(fabricCanvas) {
  fabricCanvas.defaultCursor = "crosshair";
  fabricCanvas.hoverCursor = "crosshair";
  fabricCanvas.selection = false;
  fabricCanvas.getObjects().forEach((obj) => {
    if (!obj.isBackground) obj.set({ selectable: false });
  });
  fabricCanvas.requestRenderAll();
}

// Set default cursor and restore selection
export function setDefaultCursor(fabricCanvas) {
  fabricCanvas.defaultCursor = "move";
  fabricCanvas.hoverCursor = "default";
  fabricCanvas.selection = true;
  fabricCanvas.getObjects().forEach((obj) => {
    if (!obj.isBackground && !obj.isWallCircle && !obj.isDeviceLabel) {
      obj.set({ selectable: true });
    }
  });
  fabricCanvas.requestRenderAll();
}

// Register a cleanup function for the current tool
export function registerToolCleanup(cleanupFn) {
  toolCleanupFunction = cleanupFn;
}

// Clear the tool cleanup function
export function clearToolCleanup() {
  toolCleanupFunction = null;
}

// Standard object styling for consistency
export function getStandardObjectStyle() {
  return {
    borderColor: "#f8794b",
    borderScaleFactor: 1,
    cornerSize: 8,
    cornerColor: "#f8794b",
    cornerStrokeColor: "#000000",
    cornerStyle: "circle",
    padding: 5,
    transparentCorners: false,
    hasControls: true,
    hasBorders: true,
    selectable: true,
    evented: true,
  };
}

// Apply standard styling to an object
export function applyStandardStyling(obj) {
  const standardStyle = getStandardObjectStyle();
  obj.set(standardStyle);
  return obj;
}

// Start a drawing tool
export function startTool(fabricCanvas, toolName, clickHandler, moveHandler = null, customKeyHandler = null, skipPopup = false) {
  stopCurrentTool();

  currentTool = { name: toolName, clickHandler, moveHandler, customKeyHandler };
  currentCanvas = fabricCanvas;

  // Only show popup if skipPopup is false
  if (!skipPopup) {
    showDrawingPopup();
  }

  setCrosshairCursor(fabricCanvas);

  fabricCanvas.on("mouse:down", clickHandler);
  if (moveHandler) fabricCanvas.on("mouse:move", moveHandler);

  // Set up key handler for this specific tool
  keyHandler = (e) => {
    // Handle ESC key
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();

      // Call tool-specific cleanup first
      if (toolCleanupFunction) {
        toolCleanupFunction();
      }

      // Then stop the tool
      stopCurrentTool();
      return false;
    }

    // COMPLETELY BLOCK Enter key during drawing mode - no exceptions
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  };

  // Add the key handler with capture=true for higher priority
  document.addEventListener("keydown", keyHandler, true);

  // Set up the popup buttons only if popup is shown
  if (!skipPopup) {
    setupPopupButtons();
  }
}

// Stop the current drawing tool
export function stopCurrentTool() {
  if (!currentCanvas || !currentTool) return;
  // If a toolbar button still has focus, blur it so pressing Enter doesn't
  // re-activate the tool. Then focus the canvas element to receive keyboard
  // events.
  try {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "BUTTON" || (activeEl.getAttribute && activeEl.getAttribute("role") === "button"))) {
      try {
        activeEl.blur();
      } catch (e) {}
    }
    const canvasEl = currentCanvas && (currentCanvas.upperCanvasEl || currentCanvas.lowerCanvasEl);
    if (canvasEl) {
      if (!canvasEl.hasAttribute || !canvasEl.hasAttribute("tabindex")) {
        canvasEl.setAttribute("tabindex", "-1");
      }
      // Prevent default focus outline from appearing
      try {
        canvasEl.style.outline = "none";
        canvasEl.style.boxShadow = "none";
      } catch (err) {}
      canvasEl.focus && canvasEl.focus();
    }
  } catch (err) {
    // swallow any focus-related exceptions
  }

  hideDrawingPopup();
  setDefaultCursor(currentCanvas);

  // Remove canvas event listeners
  currentCanvas.off("mouse:down", currentTool.clickHandler);
  if (currentTool.moveHandler) {
    currentCanvas.off("mouse:move", currentTool.moveHandler);
  }

  // Remove the tool-specific key handler
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }

  // Clean up popup button handlers
  cleanupPopupButtons();

  // Clear tool cleanup function
  clearToolCleanup();

  currentTool = null;
  currentCanvas = null;
}

// Set up popup button event handlers
function setupPopupButtons() {
  const escBtn = document.getElementById("drawing-esc-btn");

  if (escBtn) {
    escBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Call tool-specific cleanup first
      if (toolCleanupFunction) {
        toolCleanupFunction();
      }

      // Then stop the tool
      stopCurrentTool();
    };
  }
}

export function handleObjectDeletion(fabricCanvas, activeObject) {
  if (!activeObject) return false;

  // Don't delete if text is being edited
  if (activeObject.type === "i-text" && activeObject.isEditing) return false;
  if (fabricCanvas.getObjects().some((obj) => obj.type === "i-text" && obj.isEditing)) return false;

  // Don't delete device objects or their components
  if (activeObject.type === "group" && activeObject.deviceType) return false;
  if (activeObject.type === "text" && activeObject.isDeviceLabel) return false;
  if (activeObject.isCoverage === true) return false;
  if (activeObject.isResizeIcon === true) return false;
  if (activeObject.isBackground === true) return false;

  // Handle zone deletion (both polygon and text)
  if (activeObject.type === "polygon" && activeObject.class === "zone-polygon") {
    return deleteZone(fabricCanvas, activeObject);
  }
  if (activeObject.type === "i-text" && activeObject.class === "zone-text") {
    // Find the associated polygon and delete the entire zone
    const associatedPolygon = activeObject.associatedPolygon;
    if (associatedPolygon) {
      return deleteZone(fabricCanvas, associatedPolygon);
    }
    return false;
  }

  // Handle room deletion (both polygon and text)
  if (activeObject.type === "polygon" && activeObject.class === "room-polygon") {
    return deleteRoom(fabricCanvas, activeObject);
  }
  if (activeObject.type === "i-text" && activeObject.class === "room-text") {
    // Find the associated polygon and delete the entire room
    const associatedPolygon = activeObject.associatedPolygon;
    if (associatedPolygon) {
      return deleteRoom(fabricCanvas, associatedPolygon);
    }
    return false;
  }

  // Handle wall circle deletion (delete connected lines too)
  if (activeObject.type === "circle" && activeObject.isWallCircle) {
    return deleteWallCircle(fabricCanvas, activeObject);
  }

  // Handle wall line deletion (delete orphaned circles)
  if (activeObject.type === "line" && activeObject.stroke === "red") {
    return deleteWallLine(fabricCanvas, activeObject);
  }

  // Handle building front groups (triangles and text)

  if (activeObject.type === "group" && (activeObject.groupType === "buildingFront" || activeObject.isBuildingFront || (activeObject._objects && activeObject._objects.length === 2 && activeObject._objects.some((subObj) => subObj.type === "triangle") && activeObject._objects.some((subObj) => subObj.type === "text")))) {
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  // Handle building front groups (arrows, building fronts)
  if (activeObject.type === "group" && (activeObject.isArrow || activeObject.type === "arrow" || activeObject.groupType === "buildingFront")) {
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  // Handle north arrow images
  if (activeObject.type === "image" && activeObject.northArrowImage) {
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  // Handle uploaded images
  if (activeObject.type === "image" && activeObject.isUploadedImage) {
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  // Handle basic shapes (circles, rectangles, triangles)
  if (activeObject.type === "circle" || activeObject.type === "rect" || activeObject.type === "triangle") {
    // Double-check it's not a device component
    if (activeObject.type === "circle" && activeObject.fill === "#f8794b" && activeObject.radius < 30 && !activeObject.isWallCircle) {
      return false; // Don't delete small orange circles (resize handles)
    }
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  // Handle text objects (i-text, textbox)
  if (activeObject.type === "i-text" || activeObject.type === "textbox") {
    // Make sure it's not a device label or zone/room text
    if (!activeObject.class && !activeObject.isDeviceLabel && !activeObject.isHeader) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      return true;
    }
  }

  // Handle lines (excluding walls and device connections)
  if (activeObject.type === "line") {
    // Don't delete wall lines (red), device connection lines (grey/blue), or resize lines
    if (activeObject.stroke !== "red" && activeObject.stroke !== "grey" && activeObject.stroke !== "blue" && !activeObject.deviceType && !activeObject.isResizeIcon) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      return true;
    }
  }

  // Fallback - if nothing else matched but it's a drawing object, delete it
  if (window.drawingSerializer && window.drawingSerializer.isDrawingObject && window.drawingSerializer.isDrawingObject(activeObject)) {
    fabricCanvas.remove(activeObject);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return true;
  }

  return false;
}

// ENHANCED: Delete a zone (both polygon and text together) with proper cleanup
function deleteZone(fabricCanvas, zoneToDelete) {
  const zoneIndex = window.zones ? window.zones.findIndex((zone) => zone.polygon === zoneToDelete || zone.text === zoneToDelete) : -1;
  if (zoneIndex === -1) return false;

  const zone = window.zones[zoneIndex];

  // Remove event listeners first
  [zone.polygon, zone.text].forEach((obj) => {
    if (obj) {
      obj.off(); // Remove all event listeners
      fabricCanvas.remove(obj);
    }
  });

  // Remove from global array
  window.zones.splice(zoneIndex, 1);

  fabricCanvas.discardActiveObject();
  window.hideDeviceProperties?.();
  fabricCanvas.requestRenderAll();
  // Notify layers UI to refresh dynamic lists
  try {
    document.dispatchEvent(new Event("layers:items-changed"));
  } catch (e) {}
  return true;
}

// NEW: Delete a room (both polygon and text together) with proper cleanup
function deleteRoom(fabricCanvas, roomToDelete) {
  const roomIndex = window.rooms ? window.rooms.findIndex((room) => room.polygon === roomToDelete || room.text === roomToDelete) : -1;
  if (roomIndex === -1) return false;

  const room = window.rooms[roomIndex];

  // Remove event listeners first
  [room.polygon, room.text].forEach((obj) => {
    if (obj) {
      obj.off(); // Remove all event listeners
      fabricCanvas.remove(obj);
    }
  });

  // Remove from global array
  window.rooms.splice(roomIndex, 1);

  fabricCanvas.discardActiveObject();
  window.hideDeviceProperties?.();
  fabricCanvas.requestRenderAll();
  // Notify layers UI to refresh dynamic lists
  try {
    document.dispatchEvent(new Event("layers:items-changed"));
  } catch (e) {}
  return true;
}

// Expose helpers for context-menu and other modules to ensure consistent cleanup
try {
  if (!window.deleteZone) {
    window.deleteZone = (target) => {
      if (!target) return false;
      const canvas = target.canvas || (target.associatedPolygon && target.associatedPolygon.canvas) || null;
      if (!canvas) return false;
      return deleteZone(canvas, target);
    };
  }
  if (!window.deleteRoom) {
    window.deleteRoom = (target) => {
      if (!target) return false;
      const canvas = target.canvas || (target.associatedPolygon && target.associatedPolygon.canvas) || null;
      if (!canvas) return false;
      return deleteRoom(canvas, target);
    };
  }
} catch (e) {
  // Non-fatal if window is not available
}

// Delete wall circle and all connected lines
function deleteWallCircle(fabricCanvas, circle) {
  // Find all lines connected to this circle
  const connectedLines = fabricCanvas.getObjects().filter((obj) => obj.type === "line" && obj.stroke === "red" && (obj.startCircle === circle || obj.endCircle === circle));

  const allObjectsToDelete = [circle, ...connectedLines];
  const orphanedCircles = [];

  // Find circles that will become orphaned
  connectedLines.forEach((line) => {
    const otherCircle = line.startCircle === circle ? line.endCircle : line.startCircle;
    if (otherCircle && !orphanedCircles.includes(otherCircle)) {
      const remainingConnections = fabricCanvas.getObjects().filter((obj) => obj.type === "line" && obj.stroke === "red" && !connectedLines.includes(obj) && (obj.startCircle === otherCircle || obj.endCircle === otherCircle));
      if (remainingConnections.length === 0) {
        orphanedCircles.push(otherCircle);
      }
    }
  });

  allObjectsToDelete.push(...orphanedCircles);

  // Remove all objects
  allObjectsToDelete.forEach((obj) => fabricCanvas.remove(obj));
  fabricCanvas.discardActiveObject();

  // Update camera coverage
  fabricCanvas.getObjects("group").forEach((obj) => {
    if (obj.coverageConfig && obj.createOrUpdateCoverageArea) {
      obj.createOrUpdateCoverageArea();
    }
  });

  fabricCanvas.requestRenderAll();
  return true;
}

// Delete wall line and any orphaned circles
function deleteWallLine(fabricCanvas, line) {
  // Remove the line itself first
  try {
    fabricCanvas.remove(line);
  } catch (e) {}

  // Helper: get circle center point
  const getCenter = (circle) => {
    try {
      return circle.getCenterPoint();
    } catch (e) {
      return { x: circle.left || 0, y: circle.top || 0 };
    }
  };

  // Helper: compute absolute endpoints of a fabric.Line reliably
  const getLineEndpoints = (ln) => {
    try {
      const x1 = typeof ln.x1 === "number" ? ln.x1 : 0;
      const y1 = typeof ln.y1 === "number" ? ln.y1 : 0;
      const x2 = typeof ln.x2 === "number" ? ln.x2 : 0;
      const y2 = typeof ln.y2 === "number" ? ln.y2 : 0;
      const left = typeof ln.left === "number" ? ln.left : 0;
      const top = typeof ln.top === "number" ? ln.top : 0;
      return [
        { x: left + x1, y: top + y1 },
        { x: left + x2, y: top + y2 },
      ];
    } catch (e) {
      return [
        { x: ln.x1 || ln.left || 0, y: ln.y1 || ln.top || 0 },
        { x: ln.x2 || (ln.left || 0) + (ln.width || 0), y: ln.y2 || (ln.top || 0) + (ln.height || 0) },
      ];
    }
  };

  // Helper: check whether a line's endpoint is near a circle
  const isLineEndpointNearCircle = (ln, circle, tolerance = 12) => {
    try {
      const c = getCenter(circle);
      const [p1, p2] = getLineEndpoints(ln);
      const d1 = Math.hypot(c.x - p1.x, c.y - p1.y);
      const d2 = Math.hypot(c.x - p2.x, c.y - p2.y);
      return d1 <= tolerance || d2 <= tolerance;
    } catch (e) {
      return false;
    }
  };

  // Build candidate circles list from explicit references and by proximity to endpoints
  const candidateCircles = [];
  if (line.startCircle) candidateCircles.push(line.startCircle);
  if (line.endCircle) candidateCircles.push(line.endCircle);

  // Also try to find any nearby wall circles on canvas near the removed line endpoints
  try {
    const endpoints = getLineEndpoints(line);
    endpoints.forEach((pt) => {
      if (pt.x == null || pt.y == null) return;
      const nearby = fabricCanvas
        .getObjects()
        .filter((o) => o.type === "circle" && o.isWallCircle)
        .find((c) => {
          const cp = getCenter(c);
          return Math.hypot(cp.x - pt.x, cp.y - pt.y) <= 12;
        });
      if (nearby && !candidateCircles.includes(nearby)) candidateCircles.push(nearby);
    });
  } catch (e) {}

  // Deduplicate
  const uniqueCircles = candidateCircles.filter((c, i) => c && candidateCircles.indexOf(c) === i);

  uniqueCircles.forEach((circle) => {
    if (!circle) return;

    // Find other red wall lines connected to this circle (exclude the removed line)
    const otherLines = fabricCanvas.getObjects().filter((obj) => {
      if (obj.type !== "line" || obj === line || obj.stroke !== "red") return false;
      // direct reference match
      if (obj.startCircle === circle || obj.endCircle === circle) return true;
      // fallback: endpoint proximity match
      if (isLineEndpointNearCircle(obj, circle)) return true;
      return false;
    });

    // If no other lines are connected, remove the circle as it's now orphaned
    if (otherLines.length === 0) {
      try {
        fabricCanvas.remove(circle);
      } catch (e) {}
    }
  });

  fabricCanvas.discardActiveObject();

  // Update camera coverage for devices
  fabricCanvas.getObjects("group").forEach((obj) => {
    if (obj.coverageConfig && obj.createOrUpdateCoverageArea) {
      obj.createOrUpdateCoverageArea();
    }
  });

  fabricCanvas.requestRenderAll();
  return true;
}

// Clean up popup button handlers
function cleanupPopupButtons() {
  const escBtn = document.getElementById("drawing-esc-btn");

  if (escBtn) escBtn.onclick = null;
}

// Close sidebar and submenus
export function closeSidebar() {
  const sidebar = document.getElementById("sub-sidebar");
  if (sidebar) sidebar.classList.add("hidden");

  document.querySelectorAll(".submenu").forEach((menu) => {
    menu.classList.add("hidden");
    menu.classList.remove("show");
  });
}

export function setupDeletion(fabricCanvas, condition = () => true) {
  // Maintain a list of deletion-checking conditions instead of overwriting a single handler.
  // This prevents individual tool initializers from permanently replacing the global
  // deletion behaviour when they call setupDeletion() during setup.
  window._deletionConditions = window._deletionConditions || [];

  try {
    // Deduplicate by function source to avoid repeated identical entries
    const fnSource = condition.toString();
    const exists = window._deletionConditions.some((c) => c._fnSource === fnSource);
    if (!exists) window._deletionConditions.push({ fn: condition, _fnSource: fnSource });
  } catch (err) {
    // Fallback: if function cannot be stringified, add directly
    if (!window._deletionConditions.includes(condition)) window._deletionConditions.push({ fn: condition, _fnSource: null });
  }

  // Install a single global key handler once
  if (!window._deletionHandler) {
    window._deletionHandler = (e) => {
      // Don't handle deletion if we're in drawing mode
      if (currentTool) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        const active = fabricCanvas.getActiveObject();
        if (!active) return;

        // Allow deletion if any registered condition returns true for the active object
        const allowed = window._deletionConditions.some(({ fn }) => {
          try {
            return !!fn(active);
          } catch (err) {
            return false;
          }
        });

        if (allowed) {
          const wasDeleted = handleObjectDeletion(fabricCanvas, active);
          if (wasDeleted) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    document.addEventListener("keydown", window._deletionHandler);
  }
}

// Set up color picker for shapes, text, arrows, and building fronts
export function setupColorPicker(fabricCanvas) {
  const picker = document.getElementById("shapes-text-color-picker");
  if (!picker) return;

  fabricCanvas.on("selection:created", updateColorPicker);
  fabricCanvas.on("selection:updated", updateColorPicker);
  // Use 6-character hex format instead of 8-character
  fabricCanvas.on("selection:cleared", () => (picker.value = "#ffffff"));

  function updateColorPicker(e) {
    const obj = e.selected[0];
    if (!obj) return;

    let color = "#000000";

    // Handle arrows specifically (groups with type "arrow")
    if (obj.type === "arrow" || (obj.type === "group" && obj._objects?.some((subObj) => subObj.type === "line" || subObj.type === "triangle"))) {
      const lineOrTriangle = obj._objects.find((subObj) => subObj.type === "line" || subObj.type === "triangle");
      if (lineOrTriangle && (lineOrTriangle.fill || lineOrTriangle.stroke)) {
        color = lineOrTriangle.fill || lineOrTriangle.stroke;
      }
    } else if (obj.fill && typeof obj.fill === "string") {
      color = obj.fill;
    } else if (obj.stroke && typeof obj.stroke === "string") {
      color = obj.stroke;
    }

    // Convert color to 6-character hex format if needed
    color = normalizeColorForPicker(color);
    picker.value = color;
  }

  picker.addEventListener("input", () => {
    const active = fabricCanvas.getActiveObject();
    if (!active) return;

    const newColor = picker.value;

    if (active.type === "i-text") {
      active.set({ fill: newColor });
    } else if (active.type === "arrow" || (active.type === "group" && active._objects?.some((subObj) => subObj.type === "line" || subObj.type === "triangle"))) {
      // Update colors for arrows and building fronts
      active._objects.forEach((subObj) => {
        if (subObj.type === "line" || subObj.type === "triangle") {
          if (subObj.fill !== undefined) subObj.set({ fill: newColor });
          if (subObj.stroke !== undefined) subObj.set({ stroke: newColor });
        }
      });
      // Force the group to re-render
      active.dirty = true;
    } else {
      // Update both fill and stroke for shapes
      if (active.fill !== undefined) {
        // Preserve alpha channel for fill if present
        const currentFill = active.fill || "rgba(0, 0, 0, 1)";
        const alpha = currentFill.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/)?.[1] || 1;
        active.set({ fill: `rgba(${parseInt(newColor.slice(1, 3), 16)}, ${parseInt(newColor.slice(3, 5), 16)}, ${parseInt(newColor.slice(5, 7), 16)}, ${alpha})` });
      }
      if (active.stroke !== undefined) {
        active.set({ stroke: newColor });
      }
    }

    fabricCanvas.requestRenderAll();
  });
}

// Helper function to normalize colors for the color picker
function normalizeColorForPicker(color) {
  if (!color || typeof color !== "string") {
    return "#000000";
  }

  // If it's already a 6-character hex color, return as-is
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }

  // If it's an 8-character hex color (with alpha), remove the alpha
  if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
    return color.substring(0, 7);
  }

  // If it's an rgba/rgb color, convert to hex
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  // If it's a named color or other format, return default
  return "#000000";
}
