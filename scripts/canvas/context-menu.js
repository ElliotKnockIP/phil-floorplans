import { addCameraCoverage } from "../devices/camera-coverage.js";
import { handleObjectDeletion } from "../drawing/drawing-utils.js";

export function initContextMenu(fabricCanvas) {
  const canvasEl = fabricCanvas.getElement();
  const container = canvasEl.parentElement || document.body;

  // Create tooltip
  const tooltip = document.createElement("div");
  tooltip.id = "fabric-tooltip";
  Object.assign(tooltip.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    padding: "6px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "Poppins, sans-serif",
    display: "none",
    zIndex: 2000,
    maxWidth: "300px",
  });
  document.body.appendChild(tooltip);

  // Create context menu
  const menu = document.createElement("div");
  menu.id = "fabric-context-menu";
  Object.assign(menu.style, {
    position: "fixed",
    background: "#222",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "6px",
    padding: "6px",
    display: "none",
    zIndex: 3000,
    boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
  });

  const btnStyle = "display:block;padding:6px 10px;cursor:pointer;border-radius:4px;margin:2px 0;text-align:left;background:transparent;color:inherit;font-size:13px;border:none;";

  const copyBtn = document.createElement("button");
  copyBtn.innerText = "Copy";
  copyBtn.setAttribute("style", btnStyle);

  const deleteBtn = document.createElement("button");
  deleteBtn.innerText = "Delete";
  deleteBtn.setAttribute("style", btnStyle + "color:#ff6b6b;");

  menu.appendChild(copyBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  let currentTarget = null;

  // Prevent default browser context menu on the canvas container and show our own
  const canvasContainer = container;
  canvasContainer.addEventListener("contextmenu", (e) => {
    // Only prevent and show our menu if the contextmenu happened inside the canvas bounds
    const rect = canvasEl.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      e.preventDefault();
      e.stopPropagation();

      // Try to find fabric target at pointer
      let target = null;
      try {
        // fabric.Canvas has method 'findTarget' that accepts an event
        if (typeof fabricCanvas.findTarget === "function") {
          target = fabricCanvas.findTarget(e);
        }
      } catch (err) {
        // ignore
      }

      // fallback: use last pointer target if available
      if (!target && fabricCanvas._hoveredTarget) target = fabricCanvas._hoveredTarget;

      if (target) {
        currentTarget = target;
        // Show copy button only for device groups (excluding title blocks)
        if (target.type === "group" && target.deviceType && target.deviceType !== "title-block") {
          copyBtn.style.display = "block";
        } else {
          copyBtn.style.display = "none";
        }

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.display = "block";
      } else {
        hideMenu();
      }
    }
  });

  // Hide helpers
  function hideMenu() {
    menu.style.display = "none";
    currentTarget = null;
  }
  function hideTooltip() {
    tooltip.style.display = "none";
  }

  // Delete object helper
  function deleteObject(target) {
    if (!target) return;

    // Prefer centralized deletion handler when available so special cases
    // (walls, zones, rooms, device coverages) get proper cleanup like when
    // the user presses the Delete key.
    if (typeof handleObjectDeletion === "function") {
      try {
        const handled = handleObjectDeletion(fabricCanvas, target);
        if (handled) return;
      } catch (e) {
        // fall back to built-in behaviour
      }
    }

    // If it's a device group (group with deviceType)
    if (target.type === "group" && target.deviceType) {
      if (target.textObject) fabricCanvas.remove(target.textObject);
      if (target.coverageArea) fabricCanvas.remove(target.coverageArea);
      fabricCanvas.remove(target);
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      return;
    }

    // Zone or room polygons
    if (target.type === "polygon" && (target.class === "zone-polygon" || target.class === "room-polygon")) {
      // Try to use existing window helpers if present
      if (target.class === "zone-polygon" && window.deleteZone) {
        window.deleteZone(target);
        return;
      }
      if (target.class === "room-polygon" && window.deleteRoom) {
        window.deleteRoom(target);
        return;
      }
      // Fallback: remove polygon and associated text
      if (target.associatedText) fabricCanvas.remove(target.associatedText);
      fabricCanvas.remove(target);
      // Remove from globals if possible
      try {
        if (target.class === "zone-polygon" && Array.isArray(window.zones)) {
          window.zones = window.zones.filter((z) => z.polygon !== target);
        }
        if (target.class === "room-polygon" && Array.isArray(window.rooms)) {
          window.rooms = window.rooms.filter((r) => r.polygon !== target);
        }
        document.dispatchEvent(new Event("layers:items-changed"));
      } catch (e) {}
      fabricCanvas.requestRenderAll();
      return;
    }

    // IText (zone/room text)
    if (target.type === "i-text" && (target.class === "zone-text" || target.class === "room-text")) {
      // Prefer global delete helpers to ensure proper cleanup and UI refresh
      if (target.class === "zone-text" && window.deleteZone) {
        window.deleteZone(target);
        return;
      }
      if (target.class === "room-text" && window.deleteRoom) {
        window.deleteRoom(target);
        return;
      }
      // Fallback: remove both text and polygon if possible
      if (target.associatedPolygon) fabricCanvas.remove(target.associatedPolygon);
      fabricCanvas.remove(target);
      try {
        if (target.class === "zone-text" && Array.isArray(window.zones)) {
          window.zones = window.zones.filter((z) => z.text !== target && z.polygon !== target.associatedPolygon);
        }
        if (target.class === "room-text" && Array.isArray(window.rooms)) {
          window.rooms = window.rooms.filter((r) => r.text !== target && r.polygon !== target.associatedPolygon);
        }
        document.dispatchEvent(new Event("layers:items-changed"));
      } catch (e) {}
      fabricCanvas.requestRenderAll();
      return;
    }

    // Lines and circles (walls)
    if (target.type === "line" || target.type === "circle") {
      fabricCanvas.remove(target);
      fabricCanvas.requestRenderAll();
      return;
    }

    // Generic fallback
    fabricCanvas.remove(target);
    fabricCanvas.requestRenderAll();
  }

  // Copy object helper
  function copyObject(target, pointerEvent) {
    if (!target) return;
    // Only device groups are copyable now; other types shouldn't be copied from context menu
    if (target.type === "group" && target.deviceType) {
      try {
        target.clone((cloned) => {
          // Preserve original selectable/evented flags but disable resize controls; show selection border
          const selectable = typeof target.selectable !== "undefined" ? target.selectable : true;
          const evented = typeof target.evented !== "undefined" ? target.evented : true;

          // Devices should show a selection outline but not be resizeable via controls
          cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20, selectable, hasControls: false, hasBorders: true, evented });

          cloned.deviceType = target.deviceType;
          cloned.coverageConfig = target.coverageConfig ? JSON.parse(JSON.stringify(target.coverageConfig)) : null;
          // Preserve label hidden state
          if (target.labelHidden !== undefined) cloned.labelHidden = target.labelHidden;
          if (cloned.coverageConfig) {
            // Normalize so cloned config always has baseColor & opacity separate from fill
            if (!cloned.coverageConfig.baseColor && cloned.coverageConfig.fillColor) {
              const m = cloned.coverageConfig.fillColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
              if (m) {
                const [, r, g, b] = m;
                cloned.coverageConfig.baseColor = `rgb(${r}, ${g}, ${b})`;
              }
            }
            if (typeof cloned.coverageConfig.opacity !== "number") {
              // Infer logical opacity from fill alpha and layer opacity if possible
              let logical = 0.3;
              const alphaMatch = (cloned.coverageConfig.fillColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/i);
              if (alphaMatch) {
                const alpha = parseFloat(alphaMatch[1]);
                const layerOpacity = (window.layers && window.layers.devices && window.layers.devices.opacity) || 1;
                if (layerOpacity > 0) logical = Math.min(1, Math.max(0, alpha / layerOpacity));
              }
              cloned.coverageConfig.opacity = logical;
            }
          }
          // Preserve initial label text for undo/redo recreation
          if (target.textObject) {
            cloned.initialLabelText = target.textObject.text;
          }
          // Preserve visual border properties so selection/rendering remains consistent
          cloned.borderColor = target.borderColor || "#000000";
          cloned.borderScaleFactor = target.borderScaleFactor || 2;
          cloned.fittingPositions = target.fittingPositions || "";
          cloned.partNumber = target.partNumber || "";
          cloned.stockNumber = target.stockNumber || "";
          cloned.scaleFactor = target.scaleFactor || 1;

          if (target.hoverCursor) cloned.hoverCursor = target.hoverCursor;

          fabricCanvas.add(cloned);

          // Update coordinates before activating; keep controls disabled to prevent resizing
          try {
            cloned.setCoords();
          } catch (e) {
            /* ignore */
          }

          // Recreate non-selectable label and handlers (same as before)
          let textClone = null;
          if (target.textObject) {
            const orig = target.textObject;
            try {
              if (typeof orig.clone === "function") {
                orig.clone((tc) => {
                  textClone = tc;
                  // Preserve device-label metadata expected by serializer
                  textClone.set({ selectable: false, evented: false });
                  textClone.isDeviceLabel = orig.isDeviceLabel !== undefined ? orig.isDeviceLabel : true;
                  // If group had hidden label flag, enforce it; else carry over original flag
                  const hidden = cloned.labelHidden !== undefined ? cloned.labelHidden : orig._isHidden !== undefined ? orig._isHidden : false;
                  textClone._isHidden = hidden;
                  // Ensure visibility matches _isHidden
                  textClone.visible = !hidden;
                  if (hidden) {
                    // Remove from canvas if hidden so it doesn't appear visually
                    try {
                      fabricCanvas.remove(textClone);
                    } catch (e) {}
                  }
                  fabricCanvas.add(textClone);
                  const groupCenter = cloned.getCenterPoint();
                  const currentScaleFactor = cloned.scaleFactor || 1;
                  textClone.set({ left: groupCenter.x, top: groupCenter.y + 20 * currentScaleFactor + 10 });
                  textClone.setCoords();
                  cloned.textObject = textClone;
                  // Attach initialLabelText if absent
                  if (!cloned.initialLabelText) cloned.initialLabelText = textClone.text;
                  // Link label to existing undo command if last command is its AddCommand
                  if (window.undoSystem) {
                    const stack = window.undoSystem.undoStack;
                    const last = stack[stack.length - 1];
                    if (last && last.object === cloned && !last.relatedObjects.includes(textClone)) {
                      last.relatedObjects.push(textClone);
                    }
                  }
                });
              }
            } catch (e) {
              const label = orig.text || "";
              textClone = new fabric.Text(label, { left: cloned.left + 20, top: cloned.top + 40, fontFamily: orig.fontFamily || "Poppins, sans-serif", fontSize: orig.fontSize || 12, fill: orig.fill || "#FFFFFF", selectable: false, evented: false, backgroundColor: orig.backgroundColor || "rgba(20,18,18,0.8)", originX: "center", originY: "top" });
              textClone.isDeviceLabel = orig.isDeviceLabel !== undefined ? orig.isDeviceLabel : true;
              const hidden = cloned.labelHidden !== undefined ? cloned.labelHidden : orig._isHidden !== undefined ? orig._isHidden : false;
              textClone._isHidden = hidden;
              textClone.visible = !hidden;
              if (hidden) {
                try {
                  fabricCanvas.remove(textClone);
                } catch (e) {}
              }
              fabricCanvas.add(textClone);
              cloned.textObject = textClone;
              if (!cloned.initialLabelText) cloned.initialLabelText = textClone.text;
              if (window.undoSystem) {
                const stack = window.undoSystem.undoStack;
                const last = stack[stack.length - 1];
                if (last && last.object === cloned && !last.relatedObjects.includes(textClone)) {
                  last.relatedObjects.push(textClone);
                }
              }
            }
          }

          // Preserve device-level metadata expected by the save system
          // Only copy explicit location field; do NOT fall back to the visible label text
          cloned.location = target.location || cloned.location || "";

          cloned.on("moving", () => {
            if (cloned.textObject && fabricCanvas.getObjects().includes(cloned.textObject)) {
              const groupCenter = cloned.getCenterPoint();
              const currentScaleFactor = cloned.scaleFactor || 1;
              cloned.textObject.set({ left: groupCenter.x, top: groupCenter.y + 20 * currentScaleFactor + 10 });
              cloned.textObject.setCoords();
            }
            cloned.bringToFront();
            if (cloned.textObject && cloned.textObject.visible !== false) cloned.textObject.bringToFront();
            fabricCanvas.requestRenderAll();
          });

          cloned.on("selected", () => {
            window.showDeviceProperties && window.showDeviceProperties(cloned.deviceType, cloned.textObject, cloned);
            cloned.bringToFront();
            if (cloned.textObject && cloned.textObject.visible !== false) cloned.textObject.bringToFront();
            fabricCanvas.requestRenderAll();
          });

          cloned.on("deselected", () => {
            window.hideDeviceProperties && window.hideDeviceProperties();
          });

          cloned.on("removed", () => {
            if (cloned.textObject) fabricCanvas.remove(cloned.textObject);
            if (cloned.coverageArea) fabricCanvas.remove(cloned.coverageArea);
            fabricCanvas.renderAll();
          });

          if (cloned.coverageConfig && cloned.deviceType && cloned.deviceType.includes("camera")) {
            setTimeout(() => {
              try {
                addCameraCoverage(fabricCanvas, cloned);
              } catch (err) {
                console.warn("Failed to add camera coverage for cloned camera", err);
              }
            }, 50);
          }

          fabricCanvas.setActiveObject(cloned);
          fabricCanvas.requestRenderAll();
        });
      } catch (err) {
        console.warn("Failed to clone device group", err);
      }
    }
  }

  // Show tooltip content for various object types
  function makeTooltipContent(target) {
    if (!target) return "";

    // Device group: only include non-empty fields
    if (target.type === "group" && target.deviceType) {
      const parts = [];
      // Only show Location when an explicit `location` property exists (sidebar value)
      const location = typeof target.location === "string" && String(target.location).trim() ? String(target.location).trim() : "";
      const part = target.partNumber ? String(target.partNumber).trim() : "";
      const stock = target.stockNumber ? String(target.stockNumber).trim() : "";
      const fit = target.fittingPositions ? String(target.fittingPositions).trim() : "";

      if (fit) parts.push(`Fitting Positions: ${fit}`);
      if (location) parts.push(`Location: ${location}`);
      if (part) parts.push(`Part Number: ${part}`);
      if (stock) parts.push(`Stock Number: ${stock}`);

      return parts.length ? parts.join("\n") : "";
    }

    // Zone or room polygon: only include available numeric fields
    if (target.type === "polygon" && (target.class === "zone-polygon" || target.class === "room-polygon")) {
      const parts = [];
      if (typeof target.area === "number" && !Number.isNaN(target.area) && target.area > 0) parts.push(`Area: ${target.area.toFixed(2)} m²`);

      // Determine height: prefer associated text displayHeight, then polygon.displayHeight, then try to convert polygon.height (pixels) to meters using canvas.pixelsPerMeter.
      let heightVal = null;
      if (target.associatedText && typeof target.associatedText.displayHeight === "number") {
        heightVal = target.associatedText.displayHeight;
      } else if (typeof target.displayHeight === "number") {
        heightVal = target.displayHeight;
      } else if (typeof target.height === "number") {
        // If height looks like a large pixel value, convert to meters if pixelsPerMeter is available on the canvas
        if (fabricCanvas && typeof fabricCanvas.pixelsPerMeter === "number" && fabricCanvas.pixelsPerMeter > 0 && target.height > 10) {
          heightVal = target.height / fabricCanvas.pixelsPerMeter;
        } else {
          heightVal = target.height;
        }
      }

      if (typeof heightVal === "number" && !Number.isNaN(heightVal) && heightVal > 0) parts.push(`Height: ${heightVal.toFixed(2)} m`);
      // Prefer freshly computed volume (area * height) when possible so tooltip reflects recent height edits
      let volumeVal = null;
      if (typeof target.area === "number" && !Number.isNaN(target.area) && typeof heightVal === "number" && !Number.isNaN(heightVal)) {
        const computed = target.area * heightVal;
        if (!Number.isNaN(computed) && computed > 0) {
          volumeVal = computed;
        }
      }
      // Fallback to stored volume if no computed value is available
      if ((volumeVal === null || volumeVal <= 0) && typeof target.volume === "number" && !Number.isNaN(target.volume) && target.volume > 0) {
        volumeVal = target.volume;
      }
      if (typeof volumeVal === "number" && !Number.isNaN(volumeVal) && volumeVal > 0) parts.push(`Volume: ${volumeVal.toFixed(2)} m³`);

      return parts.length ? parts.join("\n") : "";
    }

    // i-text for zones/rooms
    if (target.type === "i-text" && (target.class === "zone-text" || target.class === "room-text")) {
      const associated = target.associatedPolygon;
      if (associated) return makeTooltipContent(associated);
    }

    return "";
  }

  // Convert newline to <br> and show
  function showTooltipAt(x, y, text) {
    if (!text) return hideTooltip();
    tooltip.innerHTML = text.replace(/\n/g, "<br>");
    tooltip.style.left = `${x + 12}px`;
    tooltip.style.top = `${y + 12}px`;
    tooltip.style.display = "block";
  }

  // Canvas-level mouse events
  fabricCanvas.on("mouse:over", (opt) => {
    const target = opt.target;
    if (!target) return;
    const txt = makeTooltipContent(target);
    if (txt) {
      const e = opt.e;
      showTooltipAt(e.clientX, e.clientY, txt);
    }
  });

  fabricCanvas.on("mouse:out", (opt) => {
    hideTooltip();
  });

  // Right-click context on objects
  fabricCanvas.on("mouse:down", (opt) => {
    const e = opt.e;
    if (!e) return;
    // Right click
    if (e.button === 2 && opt.target) {
      currentTarget = opt.target;
      const clientX = e.clientX;
      const clientY = e.clientY;
      // Show or hide copy button depending on target type (exclude title blocks)
      if (opt.target.type === "group" && opt.target.deviceType && opt.target.deviceType !== "title-block") {
        copyBtn.style.display = "block";
      } else {
        copyBtn.style.display = "none";
      }

      menu.style.left = `${clientX}px`;
      menu.style.top = `${clientY}px`;
      menu.style.display = "block";
      e.preventDefault();
      e.stopPropagation();
    } else {
      // hide menu when left-clicking elsewhere
      hideMenu();
    }
  });

  // Hide menu on global click
  document.addEventListener("mousedown", (ev) => {
    if (!menu.contains(ev.target)) hideMenu();
  });

  copyBtn.addEventListener("click", () => {
    if (!currentTarget) return;
    // Do not allow copying title blocks
    if (currentTarget.type === "group" && currentTarget.deviceType === "title-block") return;
    if (typeof copyObject === "function") {
      copyObject(currentTarget);
    }
    hideMenu();
  });

  deleteBtn.addEventListener("click", () => {
    if (!currentTarget) return;
    deleteObject(currentTarget);
    hideMenu();
  });

  // Also support keyboard Delete when object is active (existing handlers exist) but keep menu in sync
  fabricCanvas.on("selection:cleared", () => hideMenu());

  // Expose small helpers for other modules if needed
  window._fabricContextMenu = {
    showMenu: (t, x, y) => {
      currentTarget = t;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.display = "block";
    },
    hideMenu,
  };
}

export default initContextMenu;
