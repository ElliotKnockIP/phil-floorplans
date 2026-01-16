// Factory class for creating and managing device objects on the canvas
import { attachLabelBehavior, getNextAvailableDeviceNumber } from "./device-label-utils.js";
import { isCameraType } from "./categories/device-types.js";
export class DeviceFactory {
  // Create a new device group with an icon and label
  static createDevice(fabricCanvas, imgSrc, canvasX, canvasY, options = {}) {
    // Determine if the device is a camera based on options or image path
    const isCamera = options.isCamera === true || isCameraType(imgSrc);
    // Generate the next sequential label for the device
    const nextNum = this.getNextAvailableDeviceNumber(fabricCanvas, isCamera);
    const labelText = isCamera ? `Camera ${nextNum}` : `Device ${nextNum}`;

    // Load the device icon image
    fabric.Image.fromURL(
      imgSrc,
      (img) => {
        // Calculate icon scaling based on global settings
        const defaultIconSize = Math.max(1, Math.min(100, window.defaultDeviceIconSize || 30));
        const scaleFactor = defaultIconSize / 30;

        // Configure image properties and camera coverage if applicable
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

        // Create the background circle for the device icon
        const circleRadius = 20 * scaleFactor;
        const circle = new fabric.Circle({
          radius: circleRadius,
          fill: window.globalDeviceColor || "#f8794b",
          originX: "center",
          originY: "center",
        });

        // Group the circle and image together
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

        // Assign a unique ID to the device
        if (!group.id) {
          group.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        // Store device metadata on the group object
        group.initialLabelText = labelText;
        group.deviceType = img.deviceType;
        group.coverageConfig = img.coverageConfig;

        // Initialize empty property fields for the device
        const deviceProperties = ["location", "mountedPosition", "partNumber", "stockNumber", "ipAddress", "subnetMask", "gatewayAddress", "macAddress", "focalLength", "sensorSize", "resolution"];
        deviceProperties.forEach((prop) => (group[prop] = ""));

        // Create the text label for the device
        const fontSize = 12 * scaleFactor;
        const text = new fabric.Text(labelText, {
          left: canvasX,
          top: canvasY + circleRadius + 10,
          fontFamily: window.globalFont || "Poppins, sans-serif",
          fontSize,
          fontWeight: window.globalBoldText ? "bold" : "normal",
          fill: window.globalTextColor || "#FFFFFF",
          selectable: false,
          backgroundColor: window.globalTextBackground !== false ? "rgba(20, 18, 18, 0.8)" : "transparent",
          originX: "center",
          originY: "top",
          isDeviceLabel: true,
          visible: window.globalIconTextVisible !== false,
        });

        // Link the label to the group and set up positioning logic
        group.textObject = text;
        this.attachLabelBehavior(group, text, fabricCanvas);

        // Flag to skip property panel on the very first click after drop
        group.isFirstSelectionAfterDrop = true;

        // Show property panel and bring to front when selected
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

        // Hide property panel when deselected
        group.on("deselected", () => {
          if (typeof window.hideDeviceProperties === "function") {
            window.hideDeviceProperties();
          }
        });

        // Clean up associated objects when the device is removed
        group.on("removed", () => {
          if (text) fabricCanvas.remove(text);
          if (group.coverageArea) fabricCanvas.remove(group.coverageArea);
          if (group.leftResizeIcon) fabricCanvas.remove(group.leftResizeIcon);
          if (group.rightResizeIcon) fabricCanvas.remove(group.rightResizeIcon);
          if (group.rotateResizeIcon) fabricCanvas.remove(group.rotateResizeIcon);
          fabricCanvas.renderAll();
        });

        // Add the device and its label to the canvas
        fabricCanvas.add(group);
        fabricCanvas.add(text);
        group.bringToFront();
        if (text.visible !== false) text.bringToFront();

        // Initialize camera coverage visualization if needed
        if (isCamera) {
          this.addCameraCoverage(fabricCanvas, group);
        }

        // Set the new device as the active object
        fabricCanvas.setActiveObject(group);

        // Trigger coverage selection handler to show UI controls immediately
        if (isCamera && typeof group.onCovselected === "function") {
          group.onCovselected();
        }

        // Update the UI indicator for device completion status
        setTimeout(() => {
          if (typeof window.updateDeviceCompleteIndicator === "function") {
            window.updateDeviceCompleteIndicator(group);
          }
        }, 100);

        fabricCanvas.renderAll();

        // Execute completion callback if provided
        if (options.onComplete) {
          options.onComplete(group);
        }
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Find the next available number for a device label to avoid duplicates
  static getNextAvailableDeviceNumber(fabricCanvas, isCamera) {
    const prefix = isCamera ? "Camera " : "Device ";
    const usedNumbers = new Set();

    // Scan canvas objects for existing labels with the same prefix
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

    // Return the first positive integer not currently in use
    let next = 1;
    while (usedNumbers.has(next)) {
      next++;
    }
    return next;
  }

  // Set up label positioning and drag behavior for a device
  static attachLabelBehavior(group, text, fabricCanvas) {
    if (!group || !text) return;

    group.textObject = text;
    text._parentGroup = group;

    this.applyLabelPosition(group);
    this.setLabelDragState(text, !!window.globalLabelDragEnabled);

    // Update label position when the device group moves
    const updatePosition = () => {
      this.applyLabelPosition(group);
      if (typeof group.bringToFront === "function") group.bringToFront();
      if (!text._isHidden && typeof text.bringToFront === "function") text.bringToFront();
      if (fabricCanvas && typeof fabricCanvas.requestRenderAll === "function") fabricCanvas.requestRenderAll();
    };

    // Clean up old handlers before adding new ones
    if (group._labelMoveHandler) {
      group.off("moving", group._labelMoveHandler);
    }
    group._labelMoveHandler = updatePosition;
    group.on("moving", group._labelMoveHandler);

    // Reset label to default position if text changes and no custom offset is set
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

    // Track custom label offset when the label is dragged manually
    if (text._labelMovingHandler) {
      text.off("moving", text._labelMovingHandler);
    }
    text._labelMovingHandler = () => {
      if (!window.globalLabelDragEnabled) {
        this.applyLabelPosition(group);
        if (fabricCanvas && typeof fabricCanvas.renderAll === "function") fabricCanvas.renderAll();
        return;
      }

      const center = typeof group.getCenterPoint === "function" ? group.getCenterPoint() : { x: group.left || 0, y: group.top || 0 };

      group.labelOffset = {
        x: (text.left || 0) - center.x,
        y: (text.top || 0) - center.y,
      };

      // Determine if the label has been moved far enough to be considered custom
      const defaultOffset = this.getDefaultLabelOffset(group);
      const diffX = Math.abs(group.labelOffset.x || 0);
      const diffY = Math.abs((group.labelOffset.y || 0) - defaultOffset.y);
      group.hasCustomLabelOffset = diffX > 1 || diffY > 1;

      if (typeof text.setCoords === "function") text.setCoords();
      if (fabricCanvas && typeof fabricCanvas.requestRenderAll === "function") fabricCanvas.requestRenderAll();
    };
    text.on("moving", text._labelMovingHandler);

    // Refresh canvas on mouse up to ensure clean rendering
    if (typeof text.on === "function" && !text._labelMouseUpHandler) {
      text._labelMouseUpHandler = () => {
        if (fabricCanvas && typeof fabricCanvas.renderAll === "function") fabricCanvas.renderAll();
      };
      text.on("mouseup", text._labelMouseUpHandler);
    }

    // Expose the update function on the group object
    if (!group.updateLabelPosition) {
      group.updateLabelPosition = () => this.applyLabelPosition(group);
    }

    updatePosition();
  }

  // Calculate the default vertical offset for a label based on group scale
  static getDefaultLabelOffset(group) {
    if (!group) {
      return { x: 0, y: 30 };
    }
    const scale = typeof group.scaleFactor === "number" && !Number.isNaN(group.scaleFactor) ? group.scaleFactor : 1;
    return { x: 0, y: 20 * scale + 10 };
  }

  // Position the label relative to the device group's current center
  static applyLabelPosition(group) {
    if (!group || !group.textObject) return;
    const text = group.textObject;
    const canvas = group.canvas || text.canvas;
    const center = typeof group.getCenterPoint === "function" ? group.getCenterPoint() : { x: group.left || 0, y: group.top || 0 };
    const defaultOffset = this.getDefaultLabelOffset(group);

    // Initialize or maintain the label offset
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

    // Keep label visible on top of other elements
    if (!text._isHidden && canvas && typeof text.bringToFront === "function") {
      text.bringToFront();
    }
  }

  // Enable or disable interactivity for a text label
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

    // Deselect the label if it was active when disabling drag
    if (!enabled && text.canvas && typeof text.canvas.getActiveObject === "function") {
      const active = text.canvas.getActiveObject();
      if (active === text && typeof text.canvas.discardActiveObject === "function") {
        text.canvas.discardActiveObject();
      }
    }
  }

  // Toggle drag state for a specific group's label
  static setGroupLabelDragState(group, enabled) {
    if (!group || !group.textObject) return;
    this.setLabelDragState(group.textObject, enabled);
  }

  // Initialize camera coverage visualization (delegates to global handler)
  static addCameraCoverage(fabricCanvas, camera) {
    if (window.addCameraCoverage) {
      return window.addCameraCoverage(fabricCanvas, camera);
    }
  }
}
