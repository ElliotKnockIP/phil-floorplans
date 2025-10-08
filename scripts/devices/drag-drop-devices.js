import { addCameraCoverage } from "./camera-coverage.js";

export function initDragDropDevices(fabricCanvas) {
  window.cameraCounter = window.cameraCounter || 1;
  window.deviceCounter = window.deviceCounter || 1;

  // Check if image is a camera icon
  function isCameraIcon(imgSrc, customPayload) {
    if (customPayload && customPayload.isCamera) return true;
    return imgSrc.includes("camera");
  }

  const canvasElement = fabricCanvas.getElement();
  const canvasContainer = canvasElement.parentElement;

  canvasContainer.style.position = "relative";
  canvasContainer.style.zIndex = "10";

  // Handle dragover event
  canvasContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  // Handle drop event
  canvasContainer.addEventListener("drop", (e) => {
    e.preventDefault();

    // Support custom payload
    const customPayload = typeof window.__getCustomDropPayload === "function" ? window.__getCustomDropPayload(e.dataTransfer) : null;
    const imgSrc = customPayload?.dataUrl || e.dataTransfer.getData("text/plain");
    const rect = canvasElement.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();

    const canvasX = (clientX - vpt[4]) / zoom;
    const canvasY = (clientY - vpt[5]) / zoom;

    // Determine label based on device type
    const isCamera = isCameraIcon(imgSrc, customPayload);
    const labelText = isCamera ? `Camera ${window.cameraCounter++}` : `Device ${window.deviceCounter++}`;

    fabric.Image.fromURL(
      imgSrc,
      (img) => {
        // Get the default icon size (set from scale background, clamped between 1-100px)
        const defaultIconSize = Math.max(1, Math.min(100, window.defaultDeviceIconSize || 30));
        const scaleFactor = defaultIconSize / 30; // Scale factor relative to original 30px base

        // Set initial image properties with dynamic scaling
        img.set({
          scaleX: defaultIconSize / img.width,
          scaleY: defaultIconSize / img.height,
          originX: "center",
          originY: "center",
          deviceType: customPayload ? (customPayload.isCamera ? "custom-camera-icon.png" : "custom-device-icon.png") : imgSrc.split("/").pop(),
          coverageConfig: isCamera
            ? {
                startAngle: 270,
                endAngle: 0,
                fillColor: "rgba(165, 155, 155, 0.3)", // Always use default opacity
                visible: true,
                radius: 175,
                isInitialized: true,
                opacity: 0.3, // Store the default opacity separately
              }
            : null,
        });

        // Create an orange circle around the icon with dynamic size
        const circleRadius = 20 * scaleFactor; // Scale circle radius with icon size
        const circle = new fabric.Circle({
          radius: circleRadius,
          fill: window.globalDeviceColor || "#f8794b",
          originX: "center",
          originY: "center",
        });

        // Create a group of the circle and image
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
          scaleFactor: scaleFactor, // Store scale factor
        });

        // Assign a stable unique id if none exists so topology can track by id
        if (!group.id) {
          group.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        // Store initial label text early so undo/redo can recreate it
        group.initialLabelText = labelText;

        // Store deviceType and coverageConfig on the group
        group.deviceType = img.deviceType;
        group.coverageConfig = img.coverageConfig;

        // Initialize individual device properties
        group.mountedPosition = "";
        group.partNumber = "";
        group.stockNumber = "";

        // Create text label with dynamic font size
        const fontSize = 12 * scaleFactor; // Scale font size with icon size
        const text = new fabric.Text(labelText, {
          left: canvasX,
          top: canvasY + circleRadius + 10, // Position below scaled circle
          fontFamily: window.globalFont || "Poppins, sans-serif",
          fontSize: fontSize,
          fontWeight: (window.globalBoldText ? "bold" : "normal"),
          fill: window.globalTextColor || "#FFFFFF",
          selectable: false,
          backgroundColor: (window.globalTextBackground !== false ? "rgba(20, 18, 18, 0.8)" : "transparent"),
          originX: "center",
          originY: "top",
          isDeviceLabel: true,
          visible: window.globalIconTextVisible !== false, // Respect global setting
        });

        // Store text object in group for easy access
        group.textObject = text;

        // Bind text to group movement, adjusting for wrapped text height
        group.on("moving", () => {
          const groupCenter = group.getCenterPoint();
          const currentScaleFactor = group.scaleFactor || 1;
          text.set({
            left: groupCenter.x,
            top: groupCenter.y + 20 * currentScaleFactor + 10, // Position below scaled circle
          });
          text.setCoords();
          group.bringToFront();

          // Only bring text to front if it's actually visible
          if (text.visible !== false) {
            text.bringToFront();
          }

          fabricCanvas.requestRenderAll();
        });

        // Update text position after text changes
        text.on("changed", () => {
          const groupCenter = group.getCenterPoint();
          const currentScaleFactor = group.scaleFactor || 1;
          text.set({
            left: groupCenter.x,
            top: groupCenter.y + 20 * currentScaleFactor + 10,
          });
          text.setCoords();
          fabricCanvas.renderAll();
        });

        // Only show properties when user clicks on an already-selected object
        // or when selecting for the first time (but not immediately after drop)
        group.isFirstSelectionAfterDrop = true;
        group.on("selected", () => {
          // Suppress properties popup if a resize/rotate operation is in progress (e.g., after load)
          if (window.suppressDeviceProperties) return;

          // Don't show popover on first selection after drop
          if (group.isFirstSelectionAfterDrop) {
            group.isFirstSelectionAfterDrop = false;
            return;
          }

          const deviceType = group.deviceType;
          if (window.showDeviceProperties) {
            window.showDeviceProperties(deviceType, group.textObject, group);
          }
          group.bringToFront();

          if (text.visible !== false) text.bringToFront();
          fabricCanvas.renderAll();
        });

        group.on("deselected", () => {
          window.hideDeviceProperties();
        });

        // Update removal to include text and group
        group.on("removed", () => {
          if (text) fabricCanvas.remove(text);
          if (group.coverageArea) fabricCanvas.remove(group.coverageArea);
          if (group.leftResizeIcon) fabricCanvas.remove(group.leftResizeIcon);
          if (group.rightResizeIcon) fabricCanvas.remove(group.rightResizeIcon);
          if (group.rotateResizeIcon) fabricCanvas.remove(group.rotateResizeIcon);
          fabricCanvas.renderAll();
        });

        // Add group and text to canvas
        fabricCanvas.add(group);
        fabricCanvas.add(text);
        group.bringToFront();

        // Only bring text to front if it's actually visible
        if (text.visible !== false) {
          text.bringToFront();
        }

        // Select the object but don't trigger properties popup on first selection
        fabricCanvas.setActiveObject(group);

        if (isCamera) {
          addCameraCoverage(fabricCanvas, group);
        }

        fabricCanvas.renderAll();
      },
      { crossOrigin: "anonymous" }
    );
  });

  // Handle keyboard deletion
  document.addEventListener("keydown", (e) => {
    const deviceLabelInput = document.getElementById("device-label-input");
    const fittingPositionsInput = document.getElementById("fitting-positions");
    const partNumberInput = document.getElementById("part-number-input");
    const stockNumberInput = document.getElementById("stock-number-input");

    // Only proceed with deletion if none of the inputs are focused
    const activeInputs = [deviceLabelInput, fittingPositionsInput, partNumberInput, stockNumberInput];
    const isInputFocused = activeInputs.some((input) => input && document.activeElement === input);

    if ((e.key === "Delete" || e.key === "Backspace") && fabricCanvas.getActiveObject() && !isInputFocused) {
      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj.type === "group") {
        activeObj.fire("removed");
        fabricCanvas.remove(activeObj);
        fabricCanvas.discardActiveObject();
        window.hideDeviceProperties();
        fabricCanvas.renderAll();
      }
    }
  });
}
