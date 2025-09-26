import { layers } from "../canvas/canvas-layers.js";

// Updated to preserve opacity when updating coverage without slider present
export function createOrUpdateCoverageArea(fabricCanvas, cameraIcon) {
  // If already initialized, just update coverage using existing polygon & handlers
  if (cameraIcon._coverageInitialized && cameraIcon.coverageArea && cameraIcon.createCoveragePoints && cameraIcon.angleDiff) {
    // Lightweight update: recompute points & fill without recreating polygon or handlers
    const camCenter = cameraIcon.getCenterPoint();
    const angleSpan = cameraIcon.angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle);
    const isFullCircle = angleSpan >= 359.9;
    const newPoints = cameraIcon.createCoveragePoints(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle, camCenter.x, camCenter.y);

    const opacitySlider = document.getElementById("camera-opacity-slider");
    let cameraOpacity = cameraIcon.coverageConfig.opacity !== undefined ? cameraIcon.coverageConfig.opacity : opacitySlider ? parseFloat(opacitySlider.value) : 0.3;
    if (isNaN(cameraOpacity) || cameraOpacity < 0) cameraOpacity = 0.3;
    cameraIcon.coverageConfig.opacity = cameraOpacity;
    const baseColor = cameraIcon.coverageConfig.baseColor || "rgb(165, 155, 155)";
    const finalOpacity = cameraOpacity * layers.devices.opacity;
    const fillColor = baseColor.replace(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i, (m, r, g, b) => `rgba(${r}, ${g}, ${b}, ${finalOpacity})`);
    cameraIcon.coverageConfig.fillColor = fillColor;

    // Update polygon in-place
    if (cameraIcon.coverageArea.type === "polygon") {
      // Determine stroke dash array based on edge style
      let strokeDashArray = null;
      const edgeStyle = cameraIcon.coverageConfig.edgeStyle || "solid";
      if (edgeStyle === "dashed") {
        strokeDashArray = [10, 5];
      } else if (edgeStyle === "dotted") {
        strokeDashArray = [2, 2];
      }

      cameraIcon.coverageArea.set({
        points: newPoints,
        fill: fillColor,
        strokeDashArray: strokeDashArray,
        visible: cameraIcon.coverageConfig.visible && layers.devices.visible,
      });
      cameraIcon.coverageArea.dirty = true;
      cameraIcon.coverageArea.setCoords();
    }

    // Update resize icon positions (avoid duplication)
    const cam = camCenter;
    const leftIcon = cameraIcon.leftResizeIcon;
    const rightIcon = cameraIcon.rightResizeIcon;
    const rotateIcon = cameraIcon.rotateResizeIcon;
    const isSmallAngle = angleSpan <= 5;
    const leftRad = fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle - 5 + 360) % 360 : cameraIcon.coverageConfig.startAngle);
    const rightRad = fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle + 5) % 360 : cameraIcon.coverageConfig.endAngle);
    const midRad = fabric.util.degreesToRadians((cameraIcon.coverageConfig.startAngle + angleSpan / 2) % 360);
    const shouldShowIcons = fabricCanvas.getActiveObject() === cameraIcon && cameraIcon.coverageConfig.visible && layers.devices.visible;
    const iconScale = 0.03;
    if (leftIcon) leftIcon.set({ left: cam.x + cameraIcon.coverageConfig.radius * Math.cos(leftRad), top: cam.y + cameraIcon.coverageConfig.radius * Math.sin(leftRad), angle: cameraIcon.coverageConfig.startAngle + 90, scaleX: iconScale, scaleY: iconScale, opacity: layers.devices.opacity, visible: shouldShowIcons }).setCoords();
    if (rightIcon) rightIcon.set({ left: cam.x + cameraIcon.coverageConfig.radius * Math.cos(rightRad), top: cam.y + cameraIcon.coverageConfig.radius * Math.sin(rightRad), angle: isFullCircle || isSmallAngle ? (cameraIcon.coverageConfig.startAngle + 5 + 90) % 360 : cameraIcon.coverageConfig.endAngle + 90, scaleX: iconScale, scaleY: iconScale, opacity: layers.devices.opacity, visible: shouldShowIcons }).setCoords();
    if (rotateIcon) rotateIcon.set({ left: cam.x + cameraIcon.coverageConfig.radius * Math.cos(midRad), top: cam.y + cameraIcon.coverageConfig.radius * Math.sin(midRad), angle: ((cameraIcon.coverageConfig.startAngle + angleSpan / 2) % 360) + 90, scaleX: iconScale * 2, scaleY: iconScale * 2, opacity: layers.devices.opacity, visible: shouldShowIcons }).setCoords();

    if (cameraIcon.textObject && cameraIcon.textObject.visible) cameraIcon.textObject.bringToFront();
    [leftIcon, rightIcon, rotateIcon].forEach((i) => i && i.visible && i.bringToFront());
    cameraIcon.bringToFront();
    fabricCanvas.requestRenderAll();
    return; // Skip full reinitialization path
  }
  // Flags for resizing and rotating states
  let isResizingLeft = false;
  let isResizingRight = false;
  let isRotating = false;

  // Reference to resize and rotate icons
  // Clean up any previous coverage/icons on this camera to avoid duplicates
  try {
    ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
      const existing = cameraIcon[prop];
      if (existing && fabricCanvas.getObjects().includes(existing)) {
        fabricCanvas.remove(existing);
      }
      // clear the reference on the camera so new ones are created
      try {
        cameraIcon[prop] = null;
      } catch (e) {}
    });
  } catch (e) {
    // ignore cleanup errors
  }

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

    // Use saved opacity from coverageConfig (logical opacity 0..1), don't compound alpha each redraw
    const opacitySlider = document.getElementById("camera-opacity-slider");
    let cameraOpacity = cameraIcon.coverageConfig.opacity !== undefined ? cameraIcon.coverageConfig.opacity : opacitySlider ? parseFloat(opacitySlider.value) : 0.3;
    if (isNaN(cameraOpacity) || cameraOpacity < 0) cameraOpacity = 0.3;
    // Persist logical opacity only (independent of layer opacity)
    cameraIcon.coverageConfig.opacity = cameraOpacity;

    // Always compute final fill from a stable baseColor so alpha doesn't stack after undo/redo
    const baseColor = cameraIcon.coverageConfig.baseColor || "rgb(165, 155, 155)";
    const finalOpacity = cameraOpacity * layers.devices.opacity;
    const fillColor = baseColor.replace(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i, (m, r, g, b) => `rgba(${r}, ${g}, ${b}, ${finalOpacity})`);
    cameraIcon.coverageConfig.fillColor = fillColor;

    // Determine stroke dash array based on edge style
    let strokeDashArray = null;
    const edgeStyle = cameraIcon.coverageConfig.edgeStyle || "solid";
    if (edgeStyle === "dashed") {
      strokeDashArray = [10, 5];
    } else if (edgeStyle === "dotted") {
      strokeDashArray = [2, 2];
    }

    const baseProps = {
      ...commonProps,
      strokeWidth: 2,
      strokeDashArray: strokeDashArray,
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

  // Remove any previously attached handlers to avoid duplicates
  Object.keys(handlers).forEach((event) => {
    const existing = cameraIcon[`${event}Handler`];
    if (existing) {
      try {
        fabricCanvas.off(`object:${event}`, existing);
      } catch (e) {}
      try {
        delete cameraIcon[`${event}Handler`];
      } catch (e) {}
    }
  });

  Object.entries(handlers).forEach(([event, handler]) => {
    cameraIcon[`${event}Handler`] = handler;
    fabricCanvas.on(`object:${event}`, handler);
  });

  // Handle camera selection
  // Remove previously bound handlers to prevent duplicates (fabric lacks direct off by anonymous fn)
  if (cameraIcon._onCoverageSelected) cameraIcon.off("selected", cameraIcon._onCoverageSelected);
  if (cameraIcon._onCoverageDeselected) cameraIcon.off("deselected", cameraIcon._onCoverageDeselected);
  if (cameraIcon._onCoverageMoving) cameraIcon.off("moving", cameraIcon._onCoverageMoving);
  if (cameraIcon._onCoverageRemoved) cameraIcon.off("removed", cameraIcon._onCoverageRemoved);

  cameraIcon._onCoverageSelected = () => {
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
  };
  cameraIcon.on("selected", cameraIcon._onCoverageSelected);

  // Handle camera deselection
  cameraIcon._onCoverageDeselected = () => {
    if (!isResizingLeft && !isResizingRight && !isRotating) {
      [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
        if (icon) icon.set({ visible: false });
      });
      fabricCanvas.renderAll();
    }
  };
  cameraIcon.on("deselected", cameraIcon._onCoverageDeselected);

  // Handle camera movement
  cameraIcon._onCoverageMoving = () => {
    updateCoverage();
    // Ensure text stays on top during movement
    if (cameraIcon.textObject) {
      cameraIcon.textObject.bringToFront();
    }
  };
  cameraIcon.on("moving", cameraIcon._onCoverageMoving);

  // Handle camera removal
  cameraIcon._onCoverageRemoved = () => {
    Object.keys(handlers).forEach((event) => {
      if (cameraIcon[`${event}Handler`]) fabricCanvas.off(`object:${event}`, cameraIcon[`${event}Handler`]);
    });
    [coverageArea, leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((item) => {
      if (item) fabricCanvas.remove(item);
    });
  };
  cameraIcon.on("removed", cameraIcon._onCoverageRemoved);

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

          // Hide properties popover while interacting with resize/rotate icons
          window.suppressDeviceProperties = true;
          if (typeof window.hideDeviceProperties === "function") {
            try {
              window.hideDeviceProperties();
            } catch (e) {}
          }
          // Extra safety: forcibly hide device popover element if still visible (race condition after load)
          try {
            const pop = document.getElementById("device-popover");
            if (pop && pop.style.display === "block") pop.style.display = "none";
          } catch (_) {}

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

            // Re-enable properties popover after interaction ends
            window.suppressDeviceProperties = false;
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj === cameraIcon && typeof window.showDeviceProperties === "function") {
              try {
                window.showDeviceProperties(cameraIcon.deviceType, cameraIcon.textObject, cameraIcon);
              } catch (e) {}
            }
            // If suppression was lifted but user immediately started another resize, keep it hidden
            if (window.suppressDeviceProperties) {
              try {
                const pop2 = document.getElementById("device-popover");
                if (pop2) pop2.style.display = "none";
              } catch (_) {}
            }

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
          // Remove previous mouse handlers if present
          if (cameraIcon._coverageMouseMoveHandler) {
            try {
              fabricCanvas.off("mouse:move", cameraIcon._coverageMouseMoveHandler);
            } catch (e) {}
            delete cameraIcon._coverageMouseMoveHandler;
          }
          if (cameraIcon._coverageMouseUpHandler) {
            try {
              fabricCanvas.off("mouse:up", cameraIcon._coverageMouseUpHandler);
            } catch (e) {}
            delete cameraIcon._coverageMouseUpHandler;
          }

          // Mouse movement handler with better event handling
          const mouseMoveHandler = (opt) => {
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
          };

          cameraIcon._coverageMouseMoveHandler = mouseMoveHandler;
          fabricCanvas.on("mouse:move", mouseMoveHandler);

          const mouseUpHandler = (opt) => {
            if (isResizingLeft || isResizingRight || isRotating) {
              // Prevent event bubbling on mouse up
              if (opt.e) {
                opt.e.preventDefault();
                opt.e.stopPropagation();
                opt.e.stopImmediatePropagation();
              }

              // The stopResizing will be handled by the enhanced handler attached in mousedown
            }
          };

          cameraIcon._coverageMouseUpHandler = mouseUpHandler;
          fabricCanvas.on("mouse:up", mouseUpHandler);

          updateCoverage();
          fabricCanvas.setActiveObject(cameraIcon);
          const shouldShowResizeIcons = cameraIcon.coverageConfig.visible && layers.devices.visible;
          [leftResizeIcon, rightResizeIcon, rotateResizeIcon].forEach((icon) => {
            if (icon) icon.set({ visible: shouldShowResizeIcons }).bringToFront();
          });
          fabricCanvas.renderAll();
          cameraIcon._coverageInitialized = true;
        }
      });
    });
  }
}
