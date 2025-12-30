// DeviceFactory class handles creating device groups on the Fabric canvas
import { attachLabelBehavior, getNextAvailableDeviceNumber } from "./device-label-utils.js";
import { isCameraType } from "./categories/device-types.js";
export class DeviceFactory {
  // Create a device on the canvas
  static createDevice(fabricCanvas, imgSrc, canvasX, canvasY, options = {}) {
    // Check if this is a camera type
    const isCamera = options.isCamera === true || this.isCameraType(imgSrc);
    // Get the next available number for labeling
    const nextNum = this.getNextAvailableDeviceNumber(fabricCanvas, isCamera);
    const labelText = isCamera ? `Camera ${nextNum}` : `Device ${nextNum}`;

    // Load the image and create the device
    fabric.Image.fromURL(
      imgSrc,
      (img) => {
        // Calculate icon size
        const defaultIconSize = Math.max(1, Math.min(100, window.defaultDeviceIconSize || 30));
        const scaleFactor = defaultIconSize / 30;

        // Set up the image properties
        img.set({
          scaleX: defaultIconSize / img.width,
          scaleY: defaultIconSize / img.height,
          originX: "center",
          originY: "center",
          deviceType: options.deviceType || imgSrc.split("/").pop(),
          coverageConfig: isCamera
            ? {
                startAngle: 270,
                endAngle: 0,
                fillColor: "rgba(165, 155, 155, 0.3)",
                visible: true,
                radius: 175,
                isInitialized: true,
                opacity: 0.3,
              }
            : null,
        });

        // Create the background circle
        const circleRadius = 20 * scaleFactor;
        const circle = new fabric.Circle({
          radius: circleRadius,
          fill: window.globalDeviceColor || "#f8794b",
          originX: "center",
          originY: "center",
        });

        // Create the device group
        const group = new fabric.Group([circle, img], {
          left: canvasX,
          top: canvasY,
          originX: "center",
          originY: "center",
          selectable: true,
          hasControls: false,
          borderColor: "#000000",
          borderScaleFactor: 2,
          hoverCursor: isCamera ? "move" : "default",
          scaleFactor,
        });

        // Set unique ID if not present
        if (!group.id) {
          group.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        // Store initial label text
        group.initialLabelText = labelText;
        group.deviceType = img.deviceType;
        group.coverageConfig = img.coverageConfig;

        // Initialize device properties
        const deviceProperties = [
          "location",
          "mountedPosition",
          "partNumber",
          "stockNumber",
          "ipAddress",
          "subnetMask",
          "gatewayAddress",
          "macAddress",
          "focalLength",
          "sensorSize",
          "resolution",
        ];
        deviceProperties.forEach((prop) => (group[prop] = ""));

        // Create the label text
        const fontSize = 12 * scaleFactor;
        const text = new fabric.Text(labelText, {
          left: canvasX,
          top: canvasY + circleRadius + 10,
          fontFamily: window.globalFont || "Poppins, sans-serif",
          fontSize,
          fontWeight: window.globalBoldText ? "bold" : "normal",
          fill: window.globalTextColor || "#FFFFFF",
          selectable: false,
          backgroundColor:
            window.globalTextBackground !== false ? "rgba(20, 18, 18, 0.8)" : "transparent",
          originX: "center",
          originY: "top",
          isDeviceLabel: true,
          visible: window.globalIconTextVisible !== false,
        });

        // Attach label to group
        group.textObject = text;
        this.attachLabelBehavior(group, text, fabricCanvas);

        // Mark as first selection
        group.isFirstSelectionAfterDrop = true;

        // Handle device selection
        group.on("selected", () => {
          if (window.suppressDeviceProperties) return;
          if (group.isFirstSelectionAfterDrop) {
            group.isFirstSelectionAfterDrop = false;
            return;
          }
          if (window.showDeviceProperties) {
            window.showDeviceProperties(group.deviceType, group.textObject, group);
          }
          group.bringToFront();
          if (text.visible !== false) text.bringToFront();
          fabricCanvas.renderAll();
        });

        // Handle device deselection
        group.on("deselected", () => {
          if (typeof window.hideDeviceProperties === "function") {
            window.hideDeviceProperties();
          }
        });

        // Handle device removal
        group.on("removed", () => {
          if (text) fabricCanvas.remove(text);
          if (group.coverageArea) fabricCanvas.remove(group.coverageArea);
          if (group.leftResizeIcon) fabricCanvas.remove(group.leftResizeIcon);
          if (group.rightResizeIcon) fabricCanvas.remove(group.rightResizeIcon);
          if (group.rotateResizeIcon) fabricCanvas.remove(group.rotateResizeIcon);
          fabricCanvas.renderAll();
        });

        // Add to canvas
        fabricCanvas.add(group);
        fabricCanvas.add(text);
        group.bringToFront();
        if (text.visible !== false) text.bringToFront();

        // Add camera coverage before activating so selection handlers are in place
        if (isCamera) {
          this.addCameraCoverage(fabricCanvas, group);
        }

        // Activate after coverage handlers are registered so resize/rotate icons show immediately
        fabricCanvas.setActiveObject(group);

        // Force the camera selection handler once so resize/rotate icons appear right after drop
        if (isCamera && typeof group.onCovselected === "function") {
          group.onCovselected();
        }

        // Update device complete indicator
        setTimeout(() => {
          if (typeof window.updateDeviceCompleteIndicator === "function") {
            window.updateDeviceCompleteIndicator(group);
          }
        }, 100);

        fabricCanvas.renderAll();

        // Call completion callback if provided
        if (options.onComplete) {
          options.onComplete(group);
        }
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Check if device type is a camera
  static isCameraType(imgSrc) {
    if (!imgSrc) return false;
    const filename = imgSrc.split("/").pop()?.toLowerCase() || "";
    return filename.includes("camera");
  }

  // Get next available device number
  static getNextAvailableDeviceNumber(fabricCanvas, isCamera) {
    const prefix = isCamera ? "Camera " : "Device ";
    const usedNumbers = new Set();

    // Check existing device labels
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

    // Find next available number
    let next = 1;
    while (usedNumbers.has(next)) {
      next++;
    }
    return next;
  }

  // Attach label behavior to device group
  static attachLabelBehavior(group, text, fabricCanvas) {
    if (!group || !text) return;

    group.textObject = text;
    text._parentGroup = group;

    // Apply initial label position
    this.applyLabelPosition(group);
    this.setLabelDragState(text, !!window.globalLabelDragEnabled);

    // Handle group movement
    const updatePosition = () => {
      this.applyLabelPosition(group);
      if (typeof group.bringToFront === "function") group.bringToFront();
      if (!text._isHidden && typeof text.bringToFront === "function") text.bringToFront();
      if (fabricCanvas && typeof fabricCanvas.requestRenderAll === "function")
        fabricCanvas.requestRenderAll();
    };

    // Remove existing handlers
    if (group._labelMoveHandler) {
      group.off("moving", group._labelMoveHandler);
    }
    group._labelMoveHandler = updatePosition;
    group.on("moving", group._labelMoveHandler);

    // Handle text changes
    if (text._labelChangedHandler) {
      text.off("changed", text._labelChangedHandler);
    }
    text._labelChangedHandler = () => {
      if (!group.hasCustomLabelOffset) {
        const defaultOffset = this.getDefaultLabelOffset(group);
        group.labelOffset = { x: 0, y: defaultOffset.y };
      }
      this.applyLabelPosition(group);
      if (fabricCanvas && typeof fabricCanvas.renderAll === "function") canvas.renderAll();
    };
    text.on("changed", text._labelChangedHandler);

    // Handle text moving
    if (text._labelMovingHandler) {
      text.off("moving", text._labelMovingHandler);
    }
    text._labelMovingHandler = () => {
      if (!window.globalLabelDragEnabled) {
        this.applyLabelPosition(group);
        if (fabricCanvas && typeof fabricCanvas.renderAll === "function") fabricCanvas.renderAll();
        return;
      }

      const center =
        typeof group.getCenterPoint === "function"
          ? group.getCenterPoint()
          : { x: group.left || 0, y: group.top || 0 };
      group.labelOffset = {
        x: (text.left || 0) - center.x,
        y: (text.top || 0) - center.y,
      };

      const defaultOffset = this.getDefaultLabelOffset(group);
      group.hasCustomLabelOffset =
        Math.abs(group.labelOffset.x || 0) > 1 ||
        Math.abs((group.labelOffset.y || 0) - defaultOffset.y) > 1;

      if (typeof text.setCoords === "function") text.setCoords();
      if (fabricCanvas && typeof fabricCanvas.requestRenderAll === "function")
        fabricCanvas.requestRenderAll();
    };
    text.on("moving", text._labelMovingHandler);

    // Handle mouse up on text
    if (typeof text.on === "function" && !text._labelMouseUpHandler) {
      text._labelMouseUpHandler = () => {
        if (fabricCanvas && typeof fabricCanvas.renderAll === "function") fabricCanvas.renderAll();
      };
      text.on("mouseup", text._labelMouseUpHandler);
    }

    // Add update function to group
    if (!group.updateLabelPosition) {
      group.updateLabelPosition = () => this.applyLabelPosition(group);
    }

    updatePosition();
  }

  // Get default label offset
  static getDefaultLabelOffset(group) {
    if (!group) {
      return { x: 0, y: 30 };
    }
    const scaleFactor =
      typeof group.scaleFactor === "number" && !Number.isNaN(group.scaleFactor)
        ? group.scaleFactor
        : 1;
    return { x: 0, y: 20 * scaleFactor + 10 };
  }

  // Apply label position
  static applyLabelPosition(group) {
    if (!group || !group.textObject) return;
    const text = group.textObject;
    const canvas = group.canvas || text.canvas;
    const center =
      typeof group.getCenterPoint === "function"
        ? group.getCenterPoint()
        : { x: group.left || 0, y: group.top || 0 };
    const defaultOffset = this.getDefaultLabelOffset(group);

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

    if (!text._isHidden && canvas && typeof text.bringToFront === "function") {
      text.bringToFront();
    }
  }

  // Set label drag state
  static setLabelDragState(text, enabled) {
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

    if (!enabled && text.canvas && typeof text.canvas.getActiveObject === "function") {
      const active = text.canvas.getActiveObject();
      if (active === text && typeof text.canvas.discardActiveObject === "function") {
        text.canvas.discardActiveObject();
      }
    }
  }

  // Set group label drag state
  static setGroupLabelDragState(group, enabled) {
    if (!group || !group.textObject) return;
    this.setLabelDragState(group.textObject, enabled);
  }

  // Add camera coverage (placeholder - actual implementation in CameraCore)
  static addCameraCoverage(fabricCanvas, camera) {
    // This will be implemented in CameraCore
    if (window.addCameraCoverage) {
      return window.addCameraCoverage(fabricCanvas, camera);
    }
  }
}
