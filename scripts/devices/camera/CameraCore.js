import { layers } from "../../canvas/interactions/LayerControls.js";
import { angleDiff, createCoveragePoints } from "./camera-calculations.js";
import { updateCoverageDisplay, updateSlider } from "./camera-display.js";

// Handles camera coverage setup and management
export class CameraCore {
  constructor() {
    this.pixelsPerMeter = 17.5;
  }

  // Initialize camera configuration with default values
  initConfig(camera, pixelsPerMeter = this.pixelsPerMeter) {
    const config = camera.coverageConfig || {};
    config.radius = config.radius || 10 * pixelsPerMeter;
    config.fillColor = config.fillColor || "rgba(165, 155, 155, 0.3)";

    // Extract base color from fill color string
    if (!config.baseColor) {
      const match = config.fillColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      config.baseColor = match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : "rgb(165, 155, 155)";
    }

    config.startAngle = config.startAngle ?? 270;
    config.endAngle = config.endAngle ?? 0;
    config.visible = config.visible ?? true;
    config.edgeStyle = config.edgeStyle || "solid";
    config.cameraHeight = config.cameraHeight || 3;
    config.cameraTilt = config.cameraTilt ?? 25;
    config.cameraFov = config.cameraFov || 60;
    config.projectionMode = config.projectionMode || "circular";
    config.lockDistanceOnRotate = config.lockDistanceOnRotate ?? false;

    // Set max range based on radius or default to 50m
    if (config.maxRange === undefined) {
      config.maxRange = config.radius ? config.radius / pixelsPerMeter : 50;
    }

    // Enable DORI automatically if resolution is present
    if (camera.resolution && config.doriEnabled === undefined) {
      config.doriEnabled = true;
    }
    config.isInitialized = true;

    camera.coverageConfig = config;
  }

  // Normalize coverage configuration for all cameras on canvas
  normalizeAllCameraCoverage(fabricCanvas) {
    fabricCanvas
      .getObjects()
      .filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig)
      .forEach((camera) => {
        if (!camera.coverageConfig) return;

        // Extract base color from fill color
        const match = (camera.coverageConfig.fillColor || "").match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (match) camera.coverageConfig.baseColor = `rgb(${match[1]}, ${match[2]}, ${match[3]})`;

        // Set opacity from fill color if not already defined
        if (camera.coverageConfig.opacity === undefined) {
          const alphaMatch = (camera.coverageConfig.fillColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/i);
          camera.coverageConfig.opacity = alphaMatch ? Math.min(1, Math.max(0, parseFloat(alphaMatch[1]))) : 0.3;
        }

        if (camera.createOrUpdateCoverageArea) camera.createOrUpdateCoverageArea();
      });

    fabricCanvas.requestRenderAll();
  }

  // Add camera coverage area to a camera device icon
  addCameraCoverage(fabricCanvas, cameraIcon) {
    this.pixelsPerMeter = fabricCanvas.pixelsPerMeter || this.pixelsPerMeter;

    // Initialize the configuration
    this.initConfig(cameraIcon, this.pixelsPerMeter);

    // Attach utility functions to the camera icon object
    cameraIcon.angleDiff = angleDiff;
    cameraIcon.createCoveragePoints = (start, end, x, y, r) => {
      const walls = fabricCanvas.getObjects("line").filter((line) => {
        return line.isWallLine || line.startCircle || line.endCircle;
      });
      return createCoveragePoints(walls, cameraIcon, start, end, x, y, r);
    };

    // Define the update function for coverage display
    const updateCoverage = () => {
      updateCoverageDisplay(fabricCanvas, cameraIcon);
    };

    // Attach update function to the icon
    cameraIcon.createOrUpdateCoverageArea = updateCoverage;

    // Perform initial update
    updateCoverage();

    // Setup event listeners for the camera
    this.setupCameraEvents(fabricCanvas, cameraIcon, updateCoverage);

    return { coverageArea: cameraIcon.coverageArea };
  }

  // Setup event handlers for camera interactions
  setupCameraEvents(fabricCanvas, cameraIcon, updateCoverageCallback) {
    // Update coverage when walls are added or modified
    const isWallLine = (target) => target?.type === "line" && target.stroke === "red";

    const handlers = {
      added: (options) => {
        if (isWallLine(options.target)) {
          cameraIcon.lastCoverageState = null;
          updateCoverageCallback();
        }
      },
      modified: (options) => {
        if (isWallLine(options.target)) {
          cameraIcon.lastCoverageState = null;
          updateCoverageCallback();
        }
      },
      removed: (options) => {
        if (isWallLine(options.target)) {
          cameraIcon.lastCoverageState = null;
          updateCoverageCallback();
        }
      },
      moving: (options) => {
        if (options.target?.type === "circle") {
          cameraIcon.lastCoverageState = null;
          updateCoverageCallback();
        }
      },
    };

    // Register handlers and store them for cleanup
    Object.entries(handlers).forEach(([event, handler]) => {
      if (cameraIcon[`${event}H`]) fabricCanvas.off(`object:${event}`, cameraIcon[`${event}H`]);
      cameraIcon[`${event}H`] = handler;
      fabricCanvas.on(`object:${event}`, handler);
    });

    // Remove existing event listeners to prevent duplicates
    const cleanup = () => {
      ["selected", "deselected", "moving", "removed"].forEach((eventName) => {
        const handler = cameraIcon[`onCov${eventName}`];
        if (handler) cameraIcon.off(eventName, handler);
      });
    };
    cleanup();

    // Update UI sliders and show resize icons when camera is selected
    cameraIcon.onCovselected = () => {
      updateCoverageCallback();

      const pixelsPerMeter = fabricCanvas.pixelsPerMeter || this.pixelsPerMeter;
      const { startAngle, endAngle, radius, opacity } = cameraIcon.coverageConfig;

      const currentAngle = Math.round(angleDiff(startAngle, endAngle));
      updateSlider("camera-angle-slider", "camera-angle-input", currentAngle, 1, 360);
      updateSlider("camera-opacity-slider", "camera-opacity-input", opacity || 0.3, 0, 1);
      updateSlider("camera-distance-slider", "camera-distance-input", radius / pixelsPerMeter, 1, 500);

      const toggle = document.getElementById("camera-coverage-toggle");
      if (toggle) toggle.checked = cameraIcon.coverageConfig.visible !== false;

      const show = cameraIcon.coverageConfig.visible && layers.devices.visible;
      const resizeIcons = [cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.rotateResizeIcon];
      resizeIcons.forEach((icon) => {
        if (icon) {
          icon.set({ visible: show, evented: show }).bringToFront();
        }
      });
      fabricCanvas.renderAll();
    };

    // Hide resize icons when camera is deselected
    cameraIcon.onCovdeselected = () => {
      const isInteracting = cameraIcon.isResizingLeft || cameraIcon.isResizingRight || cameraIcon.isRotating;
      if (!isInteracting) {
        const resizeIcons = [cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.rotateResizeIcon];
        resizeIcons.forEach((icon) => {
          if (icon) {
            icon.set({ visible: false, evented: false });
          }
        });
        fabricCanvas.renderAll();
      }
    };

    // Update coverage and keep label on top during movement
    cameraIcon.onCovmoving = () => {
      const currentPos = cameraIcon.getCenterPoint();
      const lastPos = cameraIcon.lastPos;
      const hasMoved = !lastPos || Math.abs(currentPos.x - lastPos.x) > 1 || Math.abs(currentPos.y - lastPos.y) > 1;

      if (hasMoved) {
        updateCoverageCallback();
        cameraIcon.lastPos = currentPos;
      }
      cameraIcon.textObject?.bringToFront();
    };

    // Clean up all related objects when camera is removed
    cameraIcon.onCovremoved = () => {
      Object.keys(handlers).forEach((event) => {
        fabricCanvas.off(`object:${event}`, cameraIcon[`${event}H`]);
      });

      const itemsToRemove = [cameraIcon.coverageArea, cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.rotateResizeIcon];
      itemsToRemove.forEach((item) => item && fabricCanvas.remove(item));
    };

    // Attach the custom event handlers
    cameraIcon.on("selected", cameraIcon.onCovselected);
    cameraIcon.on("deselected", cameraIcon.onCovdeselected);
    cameraIcon.on("moving", cameraIcon.onCovmoving);
    cameraIcon.on("removed", cameraIcon.onCovremoved);

    // Initialize resize icons
    this.setupResizeIcons(cameraIcon, fabricCanvas, updateCoverageCallback);
  }

  // Setup interactive resize icons for the camera
  setupResizeIcons(cameraIcon, fabricCanvas, updateCoverage) {
    if (cameraIcon.leftResizeIcon) return;

    // Define icon properties and paths
    const icons = [
      { url: "./images/icons/left-resize.png", cursor: "col-resize", prop: "leftResizeIcon" },
      { url: "./images/icons/right-resize.png", cursor: "col-resize", prop: "rightResizeIcon" },
      { url: "./images/icons/four-arrows.png", cursor: "pointer", prop: "rotateResizeIcon" },
    ];

    let loaded = 0;
    icons.forEach(({ url, cursor, prop }) => {
      fabric.Image.fromURL(url, (image) => {
        if (!image) return;
        image.set({
          scaleX: 0.05,
          scaleY: 0.05,
          originX: "center",
          originY: "center",
          hasControls: false,
          hasBorders: false,
          selectable: false,
          evented: false,
          visible: false,
          opacity: layers.devices.opacity,
          isResizeIcon: true,
          hoverCursor: cursor,
        });

        cameraIcon[prop] = image;
        fabricCanvas.add(image);
        this.handleIconInteraction(image, cameraIcon, fabricCanvas, prop, updateCoverage);

        // Setup move handler once all icons are loaded
        if (++loaded === 3) {
          const moveHandler = (options) => {
            if (!cameraIcon.isResizingLeft && !cameraIcon.isResizingRight && !cameraIcon.isRotating) return;
            if (options.e) {
              options.e.preventDefault();
              options.e.stopPropagation();
            }

            const pointer = fabricCanvas.getPointer(options.e);
            const centerPoint = cameraIcon.getCenterPoint();
            const dx = pointer.x - centerPoint.x;
            const dy = pointer.y - centerPoint.y;
            const angleRad = Math.atan2(dy, dx);
            let curAngle = (Math.round(fabric.util.radiansToDegrees(angleRad)) + 360) % 360;

            const dist = Math.hypot(dx, dy);
            const pixelsPerMeter = fabricCanvas.pixelsPerMeter || this.pixelsPerMeter;

            if (cameraIcon.isRotating) {
              // Handle rotation and distance adjustment
              const delta = (curAngle - cameraIcon.initialMouseAngle + 360) % 360;
              cameraIcon.coverageConfig.startAngle = Math.round((cameraIcon.initialStart + delta) % 360);
              cameraIcon.coverageConfig.endAngle = Math.round((cameraIcon.initialEnd + delta) % 360);

              if (!cameraIcon.coverageConfig.lockDistanceOnRotate) {
                const maxRadius = 500 * pixelsPerMeter;
                cameraIcon.coverageConfig.radius = Math.max(pixelsPerMeter, Math.min(dist, maxRadius));
                cameraIcon.coverageConfig.maxRange = cameraIcon.coverageConfig.radius / pixelsPerMeter;

                const range = cameraIcon.coverageConfig.maxRange;
                updateSlider("camera-distance-slider", "camera-distance-input", range, 1, 500);
              }
            } else {
              // Handle resizing of the coverage angle
              const isLeft = cameraIcon.isResizingLeft;
              const other = isLeft ? cameraIcon.coverageConfig.endAngle : cameraIcon.coverageConfig.startAngle;
              const span = angleDiff(isLeft ? curAngle : other, isLeft ? other : curAngle);

              // Prevent angles from overlapping or flipping
              if (span < 1) {
                const currentSpan = angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle);
                if (currentSpan > 180) {
                  const offset = isLeft ? 5 : -5;
                  const newAngle = (Math.round(curAngle + offset) + 360) % 360;
                  cameraIcon.coverageConfig.startAngle = newAngle;
                  cameraIcon.coverageConfig.endAngle = newAngle;
                } else {
                  const newAngle = (other + (isLeft ? -1 : 1) + 360) % 360;
                  if (isLeft) cameraIcon.coverageConfig.startAngle = newAngle;
                  else cameraIcon.coverageConfig.endAngle = newAngle;
                }
              } else {
                if (isLeft) cameraIcon.coverageConfig.startAngle = Math.round(curAngle);
                else cameraIcon.coverageConfig.endAngle = Math.round(curAngle);
              }
            }

            cameraIcon.coverageConfig.isInitialized = true;
            const start = cameraIcon.coverageConfig.startAngle;
            const end = cameraIcon.coverageConfig.endAngle;
            const currentAngleDiff = Math.round(angleDiff(start, end));
            updateSlider("camera-angle-slider", "camera-angle-input", currentAngleDiff, 1, 360);
            updateCoverage();

            const objectsToFront = [cameraIcon.rotateResizeIcon, cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.textObject];
            objectsToFront.forEach((object) => object?.bringToFront());
          };

          if (cameraIcon.moveHandler) fabricCanvas.off("mouse:move", cameraIcon.moveHandler);
          cameraIcon.moveHandler = moveHandler;
          fabricCanvas.on("mouse:move", moveHandler);

          // Force update to position icons correctly
          cameraIcon.lastCoverageState = null;
          updateCoverage();
        }
      });
    });
  }

  // Handle mouse interactions with resize icons
  handleIconInteraction(icon, cameraIcon, fabricCanvas, propertyName, updateCoverage) {
    icon.on("mousedown", (options) => {
      options.e.preventDefault();
      options.e.stopPropagation();

      // Suppress property panels during interaction
      window.suppressDeviceProperties = true;
      window.hideDeviceProperties?.();

      // Disable wall interactions temporarily to improve performance
      const walls = fabricCanvas.getObjects().filter((object) => {
        const isWallLine = object.type === "line" && !object.deviceType && !object.isResizeIcon;
        const isWallCircle = object.type === "circle" && object.isWallCircle;
        return isWallLine || isWallCircle;
      });
      walls.forEach((wall) => {
        wall.origEvented = wall.evented;
        wall.origSelectable = wall.selectable;
        wall.set({ evented: false, selectable: false });
      });

      // Set interaction state based on which icon was clicked
      if (propertyName === "leftResizeIcon") cameraIcon.isResizingLeft = true;
      else if (propertyName === "rightResizeIcon") cameraIcon.isResizingRight = true;
      else {
        cameraIcon.isRotating = true;
        const pointer = fabricCanvas.getPointer(options.e);
        const centerPoint = cameraIcon.getCenterPoint();
        const dx = pointer.x - centerPoint.x;
        const dy = pointer.y - centerPoint.y;
        const angleRad = Math.atan2(dy, dx);
        cameraIcon.initialMouseAngle = (Math.round(fabric.util.radiansToDegrees(angleRad)) + 360) % 360;
        cameraIcon.initialStart = cameraIcon.coverageConfig.startAngle;
        cameraIcon.initialEnd = cameraIcon.coverageConfig.endAngle;
      }

      fabricCanvas.setActiveObject(cameraIcon);
      fabricCanvas.selection = false;

      // Cleanup interaction state on mouse up
      const stopResizing = (event) => {
        if (event?.e) {
          event.e.preventDefault();
          event.e.stopPropagation();
        }

        cameraIcon.isResizingLeft = cameraIcon.isResizingRight = cameraIcon.isRotating = false;
        fabricCanvas.selection = true;

        // Restore wall interactions
        setTimeout(
          () =>
            walls.forEach((wall) => {
              wall.set({
                evented: wall.origEvented ?? true,
                selectable: wall.origSelectable ?? true,
              });
              delete wall.origEvented;
              delete wall.origSelectable;
            }),
          150
        );

        // Show resize icons if camera is still selected
        const active = fabricCanvas.getActiveObject() === cameraIcon;
        const show = active && cameraIcon.coverageConfig.visible && layers.devices.visible;

        const resizeIcons = [cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.rotateResizeIcon];
        resizeIcons.forEach((resizeIcon) => {
          if (resizeIcon) {
            resizeIcon.set({ visible: show, evented: show }).bringToFront();
          }
        });
        if (cameraIcon.textObject) cameraIcon.textObject.bringToFront();

        window.suppressDeviceProperties = false;

        if (active) {
          window.showDeviceProperties?.(cameraIcon.deviceType, cameraIcon.textObject, cameraIcon);
        }

        document.removeEventListener("mouseup", stopResizing);
        fabricCanvas.off("mouse:up", stopResizing);
        fabricCanvas.renderAll();
      };

      document.addEventListener("mouseup", stopResizing, { once: true });
      fabricCanvas.on("mouse:up", stopResizing);
    });

    // Ensure icon stays on top when hovered
    icon.on("mouseover", () => {
      icon.bringToFront();
      fabricCanvas.renderAll();
    });
  }
}

// Initialize camera core when canvas is ready
document.addEventListener("canvas:initialized", (e) => {
  const fabricCanvas = e.detail.canvas;
  if (!fabricCanvas) return;

  const cameraCore = new CameraCore();
  window.addCameraCoverage = (fabricCanvas, camera) => cameraCore.addCameraCoverage(fabricCanvas, camera);
  window.normalizeAllCameraCoverage = () => cameraCore.normalizeAllCameraCoverage(fabricCanvas);
});
