import { layers } from "../canvas/canvas-layers.js";

// Updated to preserve opacity when updating coverage without slider present
export function createOrUpdateCoverageArea(fabricCanvas, cameraIcon) {
  // Flags for resizing and rotating states
  let isResizingLeft = false;
  let isResizingRight = false;
  let isRotating = false;

  // Reference to resize and rotate icons
  let leftResizeIcon = cameraIcon.leftResizeIcon || null;
  let rightResizeIcon = cameraIcon.rightResizeIcon || null;
  let rotateResizeIcon = cameraIcon.rotateResizeIcon || null;
  let coverageArea = cameraIcon.coverageArea || null;

  // Initial angles for rotation
  let initialMouseAngle = 0;
  let initialStartAngle = 0;
  let initialEndAngle = 0;

  // Common properties for coverage area
  const commonProps = {
    stroke: "black",
    strokeWidth: 1,
    originX: "left",
    originY: "top",
    hasControls: false,
    hasBorders: false,
    selectable: false,
    evented: false,
    hoverCursor: "default",
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
  };

  // Update slider and input values
  function updateSlider(id, inputId, value, min, max) {
    const slider = document.getElementById(id);
    const input = document.getElementById(inputId);
    if (slider) {
      slider.value = value;
      const percentage = ((value - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--orange-ip2) ${percentage}%, var(--white-ip2) ${percentage}%)`;
    }
    if (input) input.value = typeof value === "number" ? value.toFixed(value >= 10 ? 1 : 2) : value;
  }

  // Ensure proper z-order of elements
  function ensureZOrder() {
    const isSelectedCamera = fabricCanvas.getActiveObject() === cameraIcon;

    // Fix z-order if coverage is above camera
    if (coverageArea && cameraIcon) {
      const coverageIndex = fabricCanvas.getObjects().indexOf(coverageArea);
      const cameraIndex = fabricCanvas.getObjects().indexOf(cameraIcon);

      if (coverageIndex > cameraIndex) {
        fabricCanvas.remove(coverageArea);
        fabricCanvas.insertAt(coverageArea, cameraIndex);
      }
    }
  }

  // Update the coverage area
  function updateCoverage() {
    if (!cameraIcon.createCoveragePoints) return;

    const camCenter = cameraIcon.getCenterPoint();
    const angleSpan = cameraIcon.angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle);
    const isFullCircle = angleSpan >= 359.9;

    // Always use createCoveragePoints to respect wall intersections
    const newPoints = cameraIcon.createCoveragePoints(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle, camCenter.x, camCenter.y);

    if (coverageArea) fabricCanvas.remove(coverageArea);

    // Use saved opacity from coverageConfig, fall back to slider if present, then default to 0.3
    const opacitySlider = document.getElementById("camera-opacity-slider");
    let cameraOpacity = cameraIcon.coverageConfig.opacity !== undefined ? cameraIcon.coverageConfig.opacity : opacitySlider ? parseFloat(opacitySlider.value) : 0.3;

    if (isNaN(cameraOpacity) || cameraOpacity < 0) cameraOpacity = 0.3;

    const finalOpacity = cameraOpacity * layers.devices.opacity;
    let fillColor = cameraIcon.coverageConfig.fillColor || "rgba(165, 155, 155, 0.3)";
    const rgbMatch = fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      fillColor = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
    } else {
      fillColor = `rgba(165, 155, 155, ${finalOpacity})`;
    }
    cameraIcon.coverageConfig.fillColor = fillColor;
    cameraIcon.coverageConfig.opacity = cameraOpacity;

    const baseProps = {
      ...commonProps,
      strokeWidth: 2,
      visible: cameraIcon.coverageConfig.visible && layers.devices.visible,
      fill: fillColor,
      isCoverage: true,
      evented: false,
      selectable: false,
    };

    // Always create as polygon to respect wall intersections, even for full circles
    coverageArea = new fabric.Polygon(newPoints, baseProps);

    // Insert coverage area at a specific position to ensure proper layering
    const camIndex = fabricCanvas.getObjects().indexOf(cameraIcon);
    if (camIndex !== -1) {
      // Insert coverage BEFORE the camera, not after
      fabricCanvas.insertAt(coverageArea, camIndex);
    } else {
      fabricCanvas.add(coverageArea);
      // Move coverage behind camera
      coverageArea.sendToBack();
      cameraIcon.bringToFront();
    }

    cameraIcon.coverageArea = coverageArea;

    // Update resize icons positions
    const isSmallAngle = angleSpan <= 5;
    const leftRad = fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle - 5 + 360) % 360 : cameraIcon.coverageConfig.startAngle);
    const rightRad = fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle + 5) % 360 : cameraIcon.coverageConfig.endAngle);
    const midRad = fabric.util.degreesToRadians((cameraIcon.coverageConfig.startAngle + angleSpan / 2) % 360);

    const isSelected = fabricCanvas.getActiveObject() === cameraIcon;
    const shouldShowIcons = isSelected && cameraIcon.coverageConfig.visible && layers.devices.visible;
    const iconScale = 0.03;

    if (leftResizeIcon) {
      leftResizeIcon
        .set({
          left: camCenter.x + cameraIcon.coverageConfig.radius * Math.cos(leftRad),
          top: camCenter.y + cameraIcon.coverageConfig.radius * Math.sin(leftRad),
          angle: cameraIcon.coverageConfig.startAngle + 90,
          scaleX: iconScale,
          scaleY: iconScale,
          opacity: layers.devices.opacity,
          visible: shouldShowIcons,
          evented: true,
          selectable: false,
        })
        .setCoords();

      // Always bring resize icons to front
      if (shouldShowIcons) {
        leftResizeIcon.bringToFront();
      }
    }

    if (rightResizeIcon) {
      rightResizeIcon
        .set({
          left: camCenter.x + cameraIcon.coverageConfig.radius * Math.cos(rightRad),
          top: camCenter.y + cameraIcon.coverageConfig.radius * Math.sin(rightRad),
          angle: isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle + 5 + 90) % 360 : cameraIcon.coverageConfig.endAngle + 90,
          scaleX: iconScale,
          scaleY: iconScale,
          opacity: layers.devices.opacity,
          visible: shouldShowIcons,
          evented: true,
          selectable: false,
        })
        .setCoords();

      // Always bring resize icons to front
      if (shouldShowIcons) {
        rightResizeIcon.bringToFront();
      }
    }

    if (rotateResizeIcon) {
      rotateResizeIcon
        .set({
          left: camCenter.x + cameraIcon.coverageConfig.radius * Math.cos(midRad),
          top: camCenter.y + cameraIcon.coverageConfig.radius * Math.sin(midRad),
          angle: ((cameraIcon.coverageConfig.startAngle + angleSpan / 2) % 360) + 90,
          scaleX: iconScale * 2,
          scaleY: iconScale * 2,
          opacity: layers.devices.opacity,
          visible: shouldShowIcons,
          evented: true,
          selectable: false,
        })
        .setCoords();

      // Always bring resize icons to front
      if (shouldShowIcons) {
        rotateResizeIcon.bringToFront();
      }
    }

    coverageArea.setCoords();

    ensureProperZOrder();
    fabricCanvas.requestRenderAll();
  }

  function ensureProperZOrder() {
    // Bring camera to front
    cameraIcon.bringToFront();

    // Bring text label to front if visible
    if (cameraIcon.textObject && !cameraIcon.textObject._isHidden && cameraIcon.textObject.visible) {
      cameraIcon.textObject.bringToFront();
    }

    // Bring all resize icons to the front
    [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
      if (icon && icon.visible) {
        icon.bringToFront();
      }
    });
  }
  cameraIcon.createOrUpdateCoverageArea = updateCoverage;

  // Event handlers for coverage updates
  const handlers = {
    added: (opt) => opt.target?.type === "line" && opt.target.stroke === "red" && updateCoverage(),
    modified: (opt) => opt.target?.type === "line" && opt.target.stroke === "red" && updateCoverage(),
    moving: (opt) => opt.target?.type === "circle" && updateCoverage(),
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    cameraIcon[`${event}Handler`] = handler;
    fabricCanvas.on(`object:${event}`, handler);
  });

  // Handle camera selection
  cameraIcon.on("selected", () => {
    const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    const currentAngleSpan = Math.round(cameraIcon.angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle));
    const currentOpacity = cameraIcon.coverageConfig.opacity || 0.3;
    const currentDistance = cameraIcon.coverageConfig.radius / pixelsPerMeter;

    updateSlider("camera-angle-slider", "camera-angle-input", currentAngleSpan, 1, 360);
    updateSlider("camera-opacity-slider", "camera-opacity-input", currentOpacity, 0, 1);
    updateSlider("camera-distance-slider", "camera-distance-input", currentDistance, 1, 500);

    const coverageToggle = document.getElementById("camera-coverage-toggle");
    if (coverageToggle) {
      // Set toggle to match the actual visibility state
      coverageToggle.checked = cameraIcon.coverageConfig.visible !== false;
    }

    const devicesLayerVisible = layers.devices.visible;
    const shouldShowResizeIcons = cameraIcon.coverageConfig.visible && devicesLayerVisible;
    [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
      if (icon) icon.set({ visible: shouldShowResizeIcons }).bringToFront();
    });

    ensureZOrder();
    fabricCanvas.renderAll();
  });

  // Handle camera deselection
  cameraIcon.on("deselected", () => {
    if (!isResizingLeft && !isResizingRight && !isRotating) {
      [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
        if (icon) icon.set({ visible: false });
      });
      fabricCanvas.renderAll();
    }
  });

  // Handle camera movement
  cameraIcon.on("moving", () => {
    updateCoverage();
    // Ensure text stays on top during movement
    if (cameraIcon.textObject) {
      cameraIcon.textObject.bringToFront();
    }
  });

  // Handle camera removal
  cameraIcon.on("removed", () => {
    Object.keys(handlers).forEach((event) => {
      if (cameraIcon[`${event}Handler`]) fabricCanvas.off(`object:${event}`, cameraIcon[`${event}Handler`]);
    });
    [coverageArea, leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((item) => {
      if (item) fabricCanvas.remove(item);
    });
  });

  // Load resize and rotate icons if not present
  if (!leftResizeIcon || !rightResizeIcon || !rotateResizeIcon) {
    const iconConfig = {
      scaleX: 0.05,
      scaleY: 0.05,
      originX: "center",
      originY: "center",
      hasControls: false,
      hasBorders: false,
      selectable: false,
      evented: true,
      visible: false,
      opacity: layers.devices.opacity,
      isResizeIcon: true,
      perPixelTargetFind: false,
      hoverCursor: "pointer",
    };

    const iconUrls = [
      { url: "./images/icons/left-resize.png", cursor: "col-resize", prop: "leftResizeIcon" },
      { url: "./images/icons/right-resize.png", cursor: "col-resize", prop: "rightResizeIcon" },
      { url: "./images/icons/four-arrows.png", cursor: "pointer", prop: "rotateResizeIcon" },
    ];

    let loadedCount = 0;
    iconUrls.forEach(({ url, cursor, prop }) => {
      fabric.Image.fromURL(url, (icon) => {
        if (!icon) return;
        icon.set({ ...iconConfig, hoverCursor: cursor });
        cameraIcon[prop] = icon;
        if (prop === "leftResizeIcon") leftResizeIcon = icon;
        else if (prop === "rightResizeIcon") rightResizeIcon = icon;
        else rotateResizeIcon = icon;

        fabricCanvas.add(icon);

        // Enhanced mouse down handler that prevents event bubbling
        icon.on("mousedown", (opt) => {
          // IMMEDIATELY stop event propagation
          opt.e.preventDefault();
          opt.e.stopPropagation();
          opt.e.stopImmediatePropagation();

          // Disable wall selection temporarily
          const wallObjects = fabricCanvas.getObjects().filter((obj) => (obj.type === "line" && !obj.deviceType && !obj.isResizeIcon) || (obj.type === "circle" && obj.isWallCircle));

          wallObjects.forEach((wall) => {
            wall._originalEvented = wall.evented;
            wall._originalSelectable = wall.selectable;
            wall.set({ evented: false, selectable: false });
          });

          // Temporarily disable other drawing objects during resize
          const drawingObjects = fabricCanvas.getObjects().filter(
            (obj) => (obj.type === "i-text" && !obj.isDeviceLabel) || (obj.type === "group" && obj._objects && obj._objects.some((subObj) => subObj.type === "line" || subObj.type === "triangle")) || (obj.type === "group" && obj._objects && obj._objects.length === 2) // measurement groups
          );

          drawingObjects.forEach((obj) => {
            obj._originalEvented = obj.evented;
            obj._originalSelectable = obj.selectable;
            obj.set({ evented: false, selectable: false });
          });

          if (prop === "leftResizeIcon") isResizingLeft = true;
          else if (prop === "rightResizeIcon") isResizingRight = true;
          else {
            isRotating = true;
            const pointer = fabricCanvas.getPointer(opt.e);
            const camCenter = cameraIcon.getCenterPoint();
            const dx = pointer.x - camCenter.x;
            const dy = pointer.y - camCenter.y;
            initialMouseAngle = Math.round(fabric.util.radiansToDegrees(Math.atan2(dy, dx)));
            if (initialMouseAngle < 0) initialMouseAngle += 360;
            initialStartAngle = cameraIcon.coverageConfig.startAngle;
            initialEndAngle = cameraIcon.coverageConfig.endAngle;
          }

          fabricCanvas.setActiveObject(cameraIcon);
          fabricCanvas.selection = false;

          // Stop resizing function
          const enhancedStopResizing = (e) => {
            // Prevent any mouse up event from bubbling
            if (e && e.e) {
              e.e.preventDefault();
              e.e.stopPropagation();
              e.e.stopImmediatePropagation();
            }

            isResizingLeft = isResizingRight = isRotating = false;
            fabricCanvas.selection = true;

            // Re-enable wall interactions AFTER a delay
            setTimeout(() => {
              wallObjects.forEach((wall) => {
                wall.set({
                  evented: wall._originalEvented !== undefined ? wall._originalEvented : true,
                  selectable: wall._originalSelectable !== undefined ? wall._originalSelectable : true,
                });
                delete wall._originalEvented;
                delete wall._originalSelectable;
              });

              // Re-enable drawing objects
              drawingObjects.forEach((obj) => {
                obj.set({
                  evented: obj._originalEvented !== undefined ? obj._originalEvented : true,
                  selectable: obj._originalSelectable !== undefined ? obj._originalSelectable : true,
                });
                delete obj._originalEvented;
                delete obj._originalSelectable;
              });
            }, 150); // Increased delay to ensure no immediate re-selection

            const active = fabricCanvas.getActiveObject() === cameraIcon;
            const devicesLayerVisible = layers.devices.visible;
            const shouldShowResizeIcons = active && cameraIcon.coverageConfig.visible && devicesLayerVisible;

            [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
              if (icon) {
                icon.set({ visible: shouldShowResizeIcons });
                if (shouldShowResizeIcons) icon.bringToFront();
              }
            });

            // Ensure text stays on top after resizing
            if (cameraIcon.textObject) {
              cameraIcon.textObject.bringToFront();
            }

            fabricCanvas.renderAll();

            // Remove the enhanced event listeners
            document.removeEventListener("mouseup", enhancedStopResizing);
            fabricCanvas.off("mouse:up", enhancedStopResizing);
          };

          // Use both document and canvas mouse up events for reliability
          document.addEventListener("mouseup", enhancedStopResizing, { once: true });
          fabricCanvas.on("mouse:up", enhancedStopResizing);

          return false; // Prevent any further event handling
        });

        // Add mouseover/mouseout handlers to ensure icon stays on top
        icon.on("mouseover", () => {
          icon.bringToFront();
          fabricCanvas.renderAll();
        });

        loadedCount++;
        if (loadedCount === 3) {
          // Mouse movement handler with better event handling
          fabricCanvas.on("mouse:move", (opt) => {
            if (!isResizingLeft && !isResizingRight && !isRotating) return;

            // Prevent event bubbling during resize operations
            if (opt.e) {
              opt.e.preventDefault();
              opt.e.stopPropagation();
            }

            const pointer = fabricCanvas.getPointer(opt.e);
            const camCenter = cameraIcon.getCenterPoint();
            const dx = pointer.x - camCenter.x;
            const dy = pointer.y - camCenter.y;
            let currentAngle = Math.round(fabric.util.radiansToDegrees(Math.atan2(dy, dx)));
            if (currentAngle < 0) currentAngle += 360;

            const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
            const dist = Math.hypot(dx, dy);
            const maxRadius = 500 * pixelsPerMeter;

            if (isResizingLeft || isResizingRight) {
              const previousSpan = cameraIcon.angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle);
              const isLeft = isResizingLeft;
              const otherAngle = isLeft ? cameraIcon.coverageConfig.endAngle : cameraIcon.coverageConfig.startAngle;
              const tentativeSpan = cameraIcon.angleDiff(isLeft ? currentAngle : otherAngle, isLeft ? otherAngle : currentAngle);

              if (tentativeSpan < 1) {
                const offset = 5;
                if (previousSpan > 180) {
                  cameraIcon.coverageConfig.startAngle = (Math.round(currentAngle + (isLeft ? offset : -offset)) + 360) % 360;
                  cameraIcon.coverageConfig.endAngle = cameraIcon.coverageConfig.startAngle;
                } else {
                  const newAngle = (otherAngle + (isLeft ? -1 : 1) + 360) % 360;
                  if (isLeft) cameraIcon.coverageConfig.startAngle = newAngle;
                  else cameraIcon.coverageConfig.endAngle = newAngle;
                }
              } else {
                if (isLeft) cameraIcon.coverageConfig.startAngle = Math.round(currentAngle);
                else cameraIcon.coverageConfig.endAngle = Math.round(currentAngle);
              }
            } else if (isRotating) {
              const delta = (currentAngle - initialMouseAngle + 360) % 360;
              cameraIcon.coverageConfig.startAngle = Math.round((initialStartAngle + delta) % 360);
              cameraIcon.coverageConfig.endAngle = Math.round((initialEndAngle + delta) % 360);
              cameraIcon.coverageConfig.radius = Math.max(pixelsPerMeter, Math.min(dist, maxRadius));

              const currentDistance = cameraIcon.coverageConfig.radius / pixelsPerMeter;
              updateSlider("camera-distance-slider", "camera-distance-input", currentDistance, 1, 500);
            }

            cameraIcon.coverageConfig.isInitialized = true;
            const currentAngleSpan = Math.round(cameraIcon.angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle));
            updateSlider("camera-angle-slider", "camera-angle-input", currentAngleSpan, 1, 360);

            updateCoverage();

            // Ensure resize icons stay on top during dragging
            if (rotateResizeIcon && isRotating) rotateResizeIcon.bringToFront();
            if (leftResizeIcon && isResizingLeft) leftResizeIcon.bringToFront();
            if (rightResizeIcon && isResizingRight) rightResizeIcon.bringToFront();
            if (cameraIcon.textObject) cameraIcon.textObject.bringToFront();
          });

          fabricCanvas.on("mouse:up", (opt) => {
            if (isResizingLeft || isResizingRight || isRotating) {
              // Prevent event bubbling on mouse up
              if (opt.e) {
                opt.e.preventDefault();
                opt.e.stopPropagation();
                opt.e.stopImmediatePropagation();
              }

              // The stopResizing will be handled by the enhanced handler attached in mousedown
            }
          });

          updateCoverage();
          fabricCanvas.setActiveObject(cameraIcon);
          const shouldShowResizeIcons = cameraIcon.coverageConfig.visible && layers.devices.visible;
          [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
            if (icon) icon.set({ visible: shouldShowResizeIcons }).bringToFront();
          });
          fabricCanvas.renderAll();
        }
      });
    });
  }
}
