import { layers, initCanvasLayers } from "../canvas/canvas-layers.js";

export function initScaleBackground(fabricCanvas, getCroppedCanvas, updateStepIndicators, closeAllPopups) {
  const scaleModal = document.getElementById("scaleModal");
  const scaleBackBtn = document.getElementById("scale-back-btn");
  const finishScaleBtn = document.getElementById("finish-scale-btn");
  const scaleWrapper = document.getElementById("scale-result-container");
  const scaleDistanceInput = document.getElementById("scale-distance-input");
  const scaleIconSizeInput = document.getElementById("scale-icon-size-input");

  let scaleCanvas;
  let line, startCircle, endCircle, distanceText;
  let backgroundImage;
  let croppedCanvasData = null;
  let previewDevice;
  let deviceCircle;
  let deviceText;

  // Update step indicators in modal
  function updateStepIndicators(activeStep) {
    const steps = scaleModal?.querySelectorAll(".modal-header-center .step");
    steps?.forEach((step, index) => {
      step.classList.remove("active", "finish");
      if (index + 1 === activeStep) {
        step.classList.add("active");
      } else if (index + 1 < activeStep) {
        step.classList.add("finish");
      }
    });
  }

  // Set up input event listeners
  function setupInputListeners() {
    if (scaleDistanceInput && !scaleDistanceInput.hasAttribute("data-listener-attached")) {
      scaleDistanceInput.addEventListener("input", handleDistanceChange);
      scaleDistanceInput.setAttribute("data-listener-attached", "true");
    }

    if (scaleIconSizeInput && !scaleIconSizeInput.hasAttribute("data-listener-attached")) {
      scaleIconSizeInput.addEventListener("input", handleIconSizeChange);
      scaleIconSizeInput.setAttribute("data-listener-attached", "true");
    }
  }

  // Handle distance input changes
  function handleDistanceChange() {
    if (distanceText && scaleCanvas) {
      const value = parseFloat(scaleDistanceInput.value);
      if (!isNaN(value) && value > 0) {
        distanceText.set({ text: value + " m" });
        scaleCanvas.requestRenderAll();
      }
    }
  }

  // Handle icon size input changes
  function handleIconSizeChange() {
    let iconSize = Math.max(1, Math.min(100, parseInt(scaleIconSizeInput.value) || 1));

    if (scaleIconSizeInput.value != iconSize) {
      scaleIconSizeInput.value = iconSize;
    }

    updatePreviewDeviceSize(iconSize);
    scaleCanvas?.requestRenderAll();
  }

  // Update preview device sizes
  function updatePreviewDeviceSize(iconSize) {
    if (!scaleCanvas || !backgroundImage) return;

    const scaleFactor = iconSize / 30;
    const baseIconSize = 30;
    const baseCircleRadius = 20;

    if (deviceCircle && previewDevice) {
      const circleRadius = baseCircleRadius * scaleFactor;
      deviceCircle.set({ radius: circleRadius, scaleX: 1, scaleY: 1 });
      previewDevice.set({
        scaleX: scaleFactor * (baseIconSize / previewDevice.width),
        scaleY: scaleFactor * (baseIconSize / previewDevice.height),
      });

      if (deviceText) {
        const deviceCenter = deviceCircle.getCenterPoint();
        deviceText.set({
          top: deviceCenter.y + circleRadius + 10,
          fontSize: 12 * scaleFactor,
        });
      }
    }
  }

  // Create preview device on canvas (centered at top)
  function createPreviewDevice(canvasWidth, canvasHeight) {
    if (!backgroundImage) return;

    const imgLeft = backgroundImage.left;
    const imgTop = backgroundImage.top;
    const imgWidth = backgroundImage.width * backgroundImage.scaleX;
    const imgHeight = backgroundImage.height * backgroundImage.scaleY;

    // Center the device horizontally at the top of the image
    const deviceX = imgLeft + imgWidth * 0.5;
    const deviceY = imgTop + imgHeight * 0.2;

    const initialIconSize = parseInt(scaleIconSizeInput?.value) || 30;
    const scaleFactor = initialIconSize / 30;
    const baseCircleRadius = 20;
    const circleRadius = baseCircleRadius * scaleFactor;

    deviceCircle = new fabric.Circle({
      left: deviceX,
      top: deviceY,
      radius: circleRadius,
      fill: "#f8794b",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    fabric.Image.fromURL(
      "./images/devices/access-system.png",
      (img) => {
        previewDevice = img;
        img.set({
          left: deviceX,
          top: deviceY,
          scaleX: scaleFactor * (30 / img.width),
          scaleY: scaleFactor * (30 / img.height),
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        scaleCanvas.add(img);
        scaleCanvas.bringToFront(img);
      },
      { crossOrigin: "anonymous" }
    );

    deviceText = new fabric.Text("Device 1", {
      left: deviceX,
      top: deviceY + circleRadius + 10,
      fontFamily: "Poppins, sans-serif",
      fontSize: 12 * scaleFactor,
      fill: "#FFFFFF",
      backgroundColor: "rgba(20, 18, 18, 0.8)",
      originX: "center",
      originY: "top",
      selectable: false,
      evented: false,
    });

    scaleCanvas.add(deviceCircle, deviceText);
    scaleCanvas.bringToFront(deviceCircle);
    scaleCanvas.bringToFront(deviceText);
  }

  // Initialize scale canvas
  function initScaleCanvas(croppedCanvas) {
    croppedCanvasData = croppedCanvas.toDataURL("image/png");

    if (scaleCanvas) {
      scaleCanvas.clear();
      scaleCanvas.dispose();
      scaleCanvas = null;
    }

    previewDevice = null;
    deviceCircle = null;
    deviceText = null;

    scaleWrapper.innerHTML = '<canvas id="scaleCanvas"></canvas>';
    const scaleCanvasElement = document.getElementById("scaleCanvas");

    fabric.Image.fromURL(
      croppedCanvasData,
      (img) => {
        const containerRect = scaleWrapper.getBoundingClientRect();
        const maxWidth = containerRect.width - 20;
        const maxHeight = containerRect.height - 20;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;

        scaleCanvasElement.width = canvasWidth;
        scaleCanvasElement.height = canvasHeight;
        scaleCanvasElement.style.width = canvasWidth + "px";
        scaleCanvasElement.style.height = canvasHeight + "px";

        scaleCanvas = new fabric.Canvas("scaleCanvas", {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: "#ffffff",
          selection: false,
        });

        img.set({
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          hoverCursor: "default",
        });

        scaleCanvas.add(img);
        scaleCanvas.sendToBack(img);
        backgroundImage = img;

        if (scaleDistanceInput) scaleDistanceInput.value = 50;
        if (scaleIconSizeInput) {
          scaleIconSizeInput.value = 30;
          scaleIconSizeInput.min = 1;
          scaleIconSizeInput.max = 100;
        }

        const lineLength = img.width * scale;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        startCircle = new fabric.Circle({
          left: centerX - lineLength / 2,
          top: centerY,
          radius: 5,
          fill: "#000000",
          originX: "center",
          originY: "center",
          selectable: true,
          evented: true,
          hoverCursor: "move",
          borderColor: "#f8794b",
          borderScaleFactor: 2,
          padding: 5,
          hasControls: false,
        });

        endCircle = new fabric.Circle({
          left: centerX + lineLength / 2,
          top: centerY,
          radius: 5,
          fill: "#000000",
          originX: "center",
          originY: "center",
          selectable: true,
          evented: true,
          hoverCursor: "move",
          borderColor: "#f8794b",
          borderScaleFactor: 2,
          padding: 5,
          hasControls: false,
        });

        line = new fabric.Line([startCircle.left, startCircle.top, endCircle.left, endCircle.top], {
          stroke: "red",
          strokeWidth: 3,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        });

        distanceText = new fabric.IText("50 m", {
          left: centerX,
          top: centerY - 30,
          fontFamily: "Poppins, sans-serif",
          fontSize: 20,
          fill: "#000000",
          selectable: false,
          editable: false,
          originX: "center",
          originY: "center",
        });

        function updateLine() {
          const startCenter = startCircle.getCenterPoint();
          const endCenter = endCircle.getCenterPoint();
          line.set({
            x1: startCenter.x,
            y1: startCenter.y,
            x2: endCenter.x,
            y2: endCenter.y,
          });
          line.setCoords();

          const midX = (startCenter.x + endCenter.x) / 2;
          const midY = (startCenter.y + endCenter.y) / 2;
          distanceText.set({
            left: midX,
            top: midY - 30,
          });
          distanceText.setCoords();
          scaleCanvas.requestRenderAll();
        }

        function restrictToImageBounds(circle) {
          if (!backgroundImage) return;

          const imgLeft = backgroundImage.left;
          const imgTop = backgroundImage.top;
          const imgRight = imgLeft + backgroundImage.width * backgroundImage.scaleX;
          const imgBottom = imgTop + backgroundImage.height * backgroundImage.scaleY;

          const circleCenter = circle.getCenterPoint();
          const radius = circle.radius * Math.max(circle.scaleX || 1, circle.scaleY || 1);

          const newLeft = Math.max(imgLeft + radius, Math.min(imgRight - radius, circleCenter.x));
          const newTop = Math.max(imgTop + radius, Math.min(imgBottom - radius, circleCenter.y));

          circle.set({ left: newLeft, top: newTop });
          circle.setCoords();
        }

        startCircle.on("moving", () => {
          restrictToImageBounds(startCircle);
          updateLine();
        });

        endCircle.on("moving", () => {
          restrictToImageBounds(endCircle);
          updateLine();
        });

        distanceText.on("mousedblclick", () => {
          scaleCanvas.setActiveObject(distanceText);
          distanceText.enterEditing();
          distanceText.selectAll();
          scaleCanvas.requestRenderAll();
        });

        distanceText.on("editing:exited", () => {
          let textValue = distanceText.text.trim();
          if (!textValue.endsWith(" m")) {
            textValue = textValue.replace(/[^0-9.]/g, "") + " m";
          }
          distanceText.set({ text: textValue });

          if (scaleDistanceInput) {
            const numericValue = parseFloat(textValue.replace(" m", ""));
            if (!isNaN(numericValue)) {
              scaleDistanceInput.value = numericValue;
            }
          }
          scaleCanvas.requestRenderAll();
        });

        scaleCanvas.add(line, startCircle, endCircle, distanceText);
        scaleCanvas.bringToFront(startCircle);
        scaleCanvas.bringToFront(endCircle);
        scaleCanvas.bringToFront(distanceText);

        createPreviewDevice(canvasWidth, canvasHeight);
        scaleCanvas.requestRenderAll();
        setupInputListeners();
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Clean up resources
  function cleanup() {
    if (scaleCanvas) {
      scaleCanvas.clear();
      scaleCanvas.dispose();
      scaleCanvas = null;
    }
    backgroundImage = null;
    line = startCircle = endCircle = distanceText = null;
    previewDevice = null;
    deviceCircle = null;
    deviceText = null;
    croppedCanvasData = null;

    scaleDistanceInput?.removeAttribute("data-listener-attached");
    scaleIconSizeInput?.removeAttribute("data-listener-attached");
  }

  // Handle back navigation
  function handleScaleBack() {
    bootstrap.Modal.getInstance(scaleModal)?.hide();
    cleanup();

    setTimeout(() => {
      const cropHandler = window.cropHandlerInstance;
      if (cropHandler?.restoreCropModal) {
        cropHandler.restoreCropModal();
      } else {
        const cropModal = document.getElementById("cropModal");
        (bootstrap.Modal.getInstance(cropModal) || new bootstrap.Modal(cropModal)).show();
        updateStepIndicators(2);
      }
    }, 200);
  }

  // Finalize scaling and apply to main canvas
  function handleFinish() {
    if (!scaleCanvas || !backgroundImage) return;

    const distanceTextValue = parseFloat(distanceText.text.replace(" m", ""));
    if (isNaN(distanceTextValue) || distanceTextValue <= 0) {
      alert("Please enter a valid distance in meters.");
      return;
    }

    const iconSize = Math.max(1, Math.min(100, parseInt(scaleIconSizeInput?.value) || 30));

    const startCenter = startCircle.getCenterPoint();
    const endCenter = endCircle.getCenterPoint();
    const pixelDistance = Math.sqrt(Math.pow(endCenter.x - startCenter.x, 2) + Math.pow(endCenter.y - startCenter.y, 2));

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    const imgWidth = backgroundImage.width;
    const imgHeight = backgroundImage.height;

    const baseScale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight) * 0.8;
    const left = (canvasWidth - imgWidth * baseScale) / 2;
    const top = (canvasHeight - imgHeight * baseScale) / 2;
    const scaledPixelWidth = imgWidth * baseScale;

    const imageWidthInPixels = backgroundImage.width * backgroundImage.scaleX;
    const scaleLineFraction = pixelDistance / imageWidthInPixels;
    const pixelsPerMeter = scaledPixelWidth / (distanceTextValue / scaleLineFraction);

    fabricCanvas.pixelsPerMeter = pixelsPerMeter;
    window.defaultDeviceIconSize = iconSize;

    fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        if (obj.textObject) fabricCanvas.remove(obj.textObject);
        if (obj.coverageArea) fabricCanvas.remove(obj.coverageArea);
        if (obj.leftResizeIcon) fabricCanvas.remove(obj.leftResizeIcon);
        if (obj.rightResizeIcon) fabricCanvas.remove(obj.rightResizeIcon);
        if (obj.rotateResizeIcon) fabricCanvas.remove(obj.rotateResizeIcon);
      }
      if (obj.type === "polygon" && obj.class === "zone-polygon" && obj.associatedText) {
        fabricCanvas.remove(obj.associatedText);
      }
      fabricCanvas.remove(obj);
    });
    fabricCanvas.clear();

    layers.zones = { objects: [], visible: true, opacity: 1 };
    layers.drawings = { objects: [], visible: true, opacity: 1 };
    layers.devices = { objects: [], visible: true, opacity: 1 };
    layers.background = { objects: [], visible: true, opacity: 1 };

    window.deviceCounter = 1;
    window.zones = [];

    fabric.Image.fromURL(
      backgroundImage._element.src,
      (img) => {
        img.set({
          scaleX: baseScale,
          scaleY: baseScale,
          left: left,
          top: top,
          selectable: false,
          evented: false,
          hoverCursor: "default",
          isBackground: true,
        });

        fabricCanvas.add(img);
        fabricCanvas.sendToBack(img);
        layers.background.objects.push(img);

        initCanvasLayers(fabricCanvas);

        fabricCanvas.setZoom(1);
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        fabricCanvas.requestRenderAll();

        bootstrap.Modal.getInstance(scaleModal)?.hide();
        cleanup();
        closeAllPopups();

        window.resetCanvasState?.();
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Handle next step after cropping
  function handleCropNext(croppedCanvas) {
    if (!croppedCanvas) return;

    (bootstrap.Modal.getInstance(scaleModal) || new bootstrap.Modal(scaleModal)).show();
    initScaleCanvas(croppedCanvas);
    updateStepIndicators(3);
  }

  scaleBackBtn?.addEventListener("click", handleScaleBack);
  finishScaleBtn?.addEventListener("click", handleFinish);
  scaleModal?.addEventListener("hidden.bs.modal", cleanup);

  return { initScaleCanvas, handleCropNext };
}
