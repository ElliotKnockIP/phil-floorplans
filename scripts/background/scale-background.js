import { layers, initCanvasLayers } from "../canvas/canvas-layers.js";

export function initScaleBackground(fabricCanvas, getCroppedCanvas, updateStepIndicators, closeAllPopups) {
  const scaleModal = document.getElementById("scaleModal");
  const scaleBackBtn = document.getElementById("scale-back-btn");
  const finishScaleBtn = document.getElementById("finish-scale-btn");
  const scaleWrapper = document.getElementById("scale-result-container");
  const scaleDistanceInput = document.getElementById("scale-distance-input");

  let scaleCanvas;
  let line, tempLine, distanceText, instructionText, resetButton;
  let scaleStartPoint = null;
  let scaleEndPoint = null;
  let isDragging = false;
  let hasMoved = false;
  let backgroundImage;
  let croppedCanvasData = null;
  // Global hook to allow other modules to trigger change-scale flow
  if (typeof window !== "undefined" && window.__changeScaleMode === undefined) {
    window.__changeScaleMode = false;
  }

  // Global hook for replace background mode
  if (typeof window !== "undefined" && window.__replaceBackgroundMode === undefined) {
    window.__replaceBackgroundMode = false;
  }

  // Update step indicators in modal
  function updateStepIndicators(activeStep) {
    const steps = scaleModal?.querySelectorAll(".modal-header-center .step");
    steps?.forEach((step, index) => {
      step.classList.remove("active", "finish");
      if (index + 1 === activeStep) step.classList.add("active");
      else if (index + 1 < activeStep) step.classList.add("finish");
    });
  }

  // Set up input event listeners
  function setupInputListeners() {
    if (scaleDistanceInput && !scaleDistanceInput.hasAttribute("data-listener-attached")) {
      scaleDistanceInput.addEventListener("input", handleDistanceChange);
      scaleDistanceInput.setAttribute("data-listener-attached", "true");
    }
  }

  // Handle distance input changes
  function handleDistanceChange() {
    if (distanceText && scaleCanvas) {
      const value = parseFloat(scaleDistanceInput.value);
      if (!isNaN(value) && value > 0) distanceText.set({ text: value + " m" });
      scaleCanvas.requestRenderAll();
    }
  }

  // Initialize scale canvas
  function initScaleCanvas(croppedCanvas) {
    croppedCanvasData = croppedCanvas.toDataURL("image/png");

    if (scaleCanvas) {
      scaleCanvas.clear();
      scaleCanvas.dispose();
      scaleCanvas = null;
    }

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

        if (!scaleCanvas) return;
        scaleCanvas.add(img);
        scaleCanvas.sendToBack(img);
        backgroundImage = img;

        if (scaleDistanceInput) scaleDistanceInput.value = 50;

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

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

        // Instruction overlay
        instructionText = new fabric.Text("Click twice or click-and-drag to set the scale", {
          left: canvasWidth / 2,
          top: 20,
          fontFamily: "Poppins, sans-serif",
          fontSize: 14,
          fill: "#111",
          backgroundColor: "rgba(255,255,255,0.75)",
          originX: "center",
          originY: "top",
          selectable: false,
          evented: false,
        });

        // Add distance text and instruction first
        scaleCanvas.add(distanceText);
        scaleCanvas.add(instructionText);
        scaleCanvas.bringToFront(distanceText);
        scaleCanvas.bringToFront(instructionText);

  // Create an initial line that spans the full width of the image at mid-height
        const imgLeftInit = backgroundImage.left;
        const imgTopInit = backgroundImage.top;
        const imgRightInit = imgLeftInit + backgroundImage.width * backgroundImage.scaleX;
        const imgBottomInit = imgTopInit + backgroundImage.height * backgroundImage.scaleY;
        const midYInit = imgTopInit + (imgBottomInit - imgTopInit) / 2;
        scaleStartPoint = { x: imgLeftInit, y: midYInit };
        scaleEndPoint = { x: imgRightInit, y: midYInit };
        line = new fabric.Line([scaleStartPoint.x, scaleStartPoint.y, scaleEndPoint.x, scaleEndPoint.y], {
          stroke: "red",
          strokeWidth: 3,
          strokeLineCap: "round",
          selectable: false,
          evented: false,
        });
        scaleCanvas.add(line);
        // Center the distance text on the initial line
        distanceText.set({ left: (scaleStartPoint.x + scaleEndPoint.x) / 2, top: midYInit - 30 });
        distanceText.setCoords();
        scaleCanvas.bringToFront(distanceText);

        // Reset helper: restore full-width line
        function resetToFullWidth() {
          const imgLeft = backgroundImage.left;
          const imgTop = backgroundImage.top;
          const imgRight = imgLeft + backgroundImage.width * backgroundImage.scaleX;
          const imgBottom = imgTop + backgroundImage.height * backgroundImage.scaleY;
          const midY = imgTop + (imgBottom - imgTop) / 2;
          scaleStartPoint = { x: imgLeft, y: midY };
          scaleEndPoint = { x: imgRight, y: midY };
          if (tempLine) { scaleCanvas.remove(tempLine); tempLine = null; }
          if (line) { scaleCanvas.remove(line); line = null; }
          line = new fabric.Line([scaleStartPoint.x, scaleStartPoint.y, scaleEndPoint.x, scaleEndPoint.y], {
            stroke: "red",
            strokeWidth: 3,
            strokeLineCap: "round",
            selectable: false,
            evented: false,
          });
          scaleCanvas.add(line);
          distanceText.set({ left: (scaleStartPoint.x + scaleEndPoint.x) / 2, top: midY - 30 });
          distanceText.setCoords();
          scaleCanvas.bringToFront(distanceText);
          if (instructionText) scaleCanvas.bringToFront(instructionText);
          if (resetButton) scaleCanvas.bringToFront(resetButton);
          scaleCanvas.requestRenderAll();
        }

        // Add a Reset line button overlay (top-right)
        const btnWidth = 110;
        const btnHeight = 26;
        const btnMargin = 10;
        const btnLeft = canvasWidth - btnMargin - btnWidth;
        const btnTop = 16;
        const btnBg = new fabric.Rect({
          left: btnLeft,
          top: btnTop,
          width: btnWidth,
          height: btnHeight,
          rx: 6,
          ry: 6,
          fill: "rgba(255,255,255,0.9)",
          stroke: "#f8794b",
          strokeWidth: 1,
          originX: "left",
          originY: "top",
          selectable: false,
          evented: false,
        });
        const btnText = new fabric.Text("Reset line", {
          left: btnLeft + btnWidth / 2,
          top: btnTop + btnHeight / 2,
          fontFamily: "Poppins, sans-serif",
          fontSize: 13,
          fill: "#111",
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        resetButton = new fabric.Group([btnBg, btnText], {
          selectable: false,
          evented: true,
          hoverCursor: "pointer",
        });
        resetButton.on("mousedown", resetToFullWidth);
        scaleCanvas.add(resetButton);
        scaleCanvas.bringToFront(resetButton);

        function clampPointToImageBounds(pt) {
          if (!backgroundImage) return pt;
          const imgLeft = backgroundImage.left;
          const imgTop = backgroundImage.top;
          const imgRight = imgLeft + backgroundImage.width * backgroundImage.scaleX;
          const imgBottom = imgTop + backgroundImage.height * backgroundImage.scaleY;
          return {
            x: Math.max(imgLeft, Math.min(imgRight, pt.x)),
            y: Math.max(imgTop, Math.min(imgBottom, pt.y)),
          };
        }

        function updatePreview(pointer) {
          const ptr = clampPointToImageBounds(pointer);
          if (!scaleStartPoint || scaleEndPoint) return;
          // update dashed temp line
          if (tempLine) scaleCanvas.remove(tempLine);
          tempLine = new fabric.Line([scaleStartPoint.x, scaleStartPoint.y, ptr.x, ptr.y], {
            stroke: "red",
            strokeWidth: 3,
            strokeDashArray: [6, 6],
            evented: false,
          });
          scaleCanvas.add(tempLine);
          // move distance text near midpoint while drawing
          const midX = (scaleStartPoint.x + ptr.x) / 2;
          const midY = (scaleStartPoint.y + ptr.y) / 2;
          distanceText.set({ left: midX, top: midY - 30 });
          distanceText.setCoords();
          if (instructionText) scaleCanvas.bringToFront(instructionText);
          if (resetButton) scaleCanvas.bringToFront(resetButton);
          scaleCanvas.requestRenderAll();
        }

        function finalizeLine(pointer) {
          const end = clampPointToImageBounds(pointer);
          scaleEndPoint = end;
          if (tempLine) {
            scaleCanvas.remove(tempLine);
            tempLine = null;
          }
          if (line) {
            scaleCanvas.remove(line);
            line = null;
          }
          line = new fabric.Line([scaleStartPoint.x, scaleStartPoint.y, end.x, end.y], {
            stroke: "red",
            strokeWidth: 3,
            strokeLineCap: "round",
            selectable: false,
            evented: false,
          });
          scaleCanvas.add(line);
          const midX = (scaleStartPoint.x + end.x) / 2;
          const midY = (scaleStartPoint.y + end.y) / 2;
          distanceText.set({ left: midX, top: midY - 30 });
          distanceText.setCoords();
          scaleCanvas.bringToFront(distanceText);
          if (instructionText) scaleCanvas.bringToFront(instructionText);
          if (resetButton) scaleCanvas.bringToFront(resetButton);
          scaleCanvas.requestRenderAll();
        }

        function handleMouseDown(e) {
          const pointer = scaleCanvas.getPointer(e.e || e);
          const pt = clampPointToImageBounds(pointer);
          if (!scaleStartPoint || (scaleStartPoint && scaleEndPoint)) {
            // Start a new line (reset any previous)
            if (line) {
              scaleCanvas.remove(line);
              line = null;
            }
            if (tempLine) {
              scaleCanvas.remove(tempLine);
              tempLine = null;
            }
            scaleStartPoint = pt;
            scaleEndPoint = null;
            isDragging = true;
            hasMoved = false;
          } else {
            finalizeLine(pt);
          }
        }

        function handleMouseMove(e) {
          if (!scaleStartPoint || scaleEndPoint) return;
          const pointer = scaleCanvas.getPointer(e.e || e);
          if (isDragging) {
            const p = clampPointToImageBounds(pointer);
            const dx = p.x - scaleStartPoint.x;
            const dy = p.y - scaleStartPoint.y;
            if (!hasMoved && Math.hypot(dx, dy) > 2) hasMoved = true;
          }
          updatePreview(pointer);
        }

        function handleMouseUp(e) {
          if (!isDragging) return;
          isDragging = false;
          if (hasMoved && scaleStartPoint && !scaleEndPoint) {
            const pointer = scaleCanvas.getPointer(e.e || e);
            finalizeLine(pointer);
          }
        }

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

    // Register drawing handlers
    scaleCanvas.on("mouse:down", handleMouseDown);
    scaleCanvas.on("mouse:move", handleMouseMove);
    scaleCanvas.on("mouse:up", handleMouseUp);

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
  line = tempLine = distanceText = null;
    scaleStartPoint = null;
    scaleEndPoint = null;
    croppedCanvasData = null;
    scaleDistanceInput?.removeAttribute("data-listener-attached");
  }

  // Handle back navigation
  function handleScaleBack() {
    bootstrap.Modal.getInstance(scaleModal)?.hide();
    cleanup();
    setTimeout(() => {
      const cropHandler = window.cropHandlerInstance;
      if (cropHandler?.restoreCropModal) cropHandler.restoreCropModal();
      else {
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
    const iconSize = window.globalIconSize || 30;
    // Measure distance between drawn endpoints
    let pixelDistance = null;
    if (scaleStartPoint && scaleEndPoint) {
      pixelDistance = Math.hypot(scaleEndPoint.x - scaleStartPoint.x, scaleEndPoint.y - scaleStartPoint.y);
    } else if (line) {
      pixelDistance = Math.hypot((line.x2 || 0) - (line.x1 || 0), (line.y2 || 0) - (line.y1 || 0));
    }
    if (!pixelDistance || pixelDistance <= 0) {
      alert("Please draw the scale distance on the image.");
      return;
    }
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
    let effectiveScaledPixelWidth = scaledPixelWidth;
    if (window.__changeScaleMode) {
      const mainBg = fabricCanvas.getObjects().find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
      if (mainBg) effectiveScaledPixelWidth = (mainBg.width || 0) * (mainBg.scaleX || 1);
    }
    const pixelsPerMeter = effectiveScaledPixelWidth / (distanceTextValue / scaleLineFraction);
    const oldPixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    fabricCanvas.pixelsPerMeter = pixelsPerMeter;
    window.defaultDeviceIconSize = iconSize;

    if (window.__changeScaleMode) {
      try {
        const objects = fabricCanvas.getObjects();
        const measurementGroups = objects.filter((o) => o.type === "group" && o._objects && o._objects.length === 2 && o._objects.some((x) => x.type === "line") && o._objects.some((x) => x.type === "i-text"));
        measurementGroups.forEach((grp) => {
          try {
            const lineObj = grp._objects.find((x) => x.type === "line");
            const textObj = grp._objects.find((x) => x.type === "i-text");
            if (!lineObj || !textObj) return;
            const dx = lineObj.x2 - lineObj.x1;
            const dy = lineObj.y2 - lineObj.y1;
            const distPx = Math.hypot(dx, dy);
            const metersVal = (distPx / pixelsPerMeter).toFixed(2);
            const isApex = (textObj.text || "").trim().toLowerCase().startsWith("apex:");
            textObj.set({ text: isApex ? `Apex: ${metersVal} m` : `${metersVal} m` });
            textObj.setCoords();
            grp.setCoords();
          } catch {}
        });
        const cameras = objects.filter((o) => o.type === "group" && o.deviceType && o.coverageConfig);
        cameras.forEach((cam) => {
          try {
            if (typeof cam.createOrUpdateCoverageArea === "function") cam.createOrUpdateCoverageArea();
          } catch {}
        });
        try {
          const polygons = objects.filter((o) => o.type === "polygon" && (o.class === "zone-polygon" || o.class === "room-polygon"));
          const calcArea = (points, ppm) => {
            let area = 0;
            for (let i = 0; i < points.length; i++) {
              const j = (i + 1) % points.length;
              area += points[i].x * points[j].y - points[j].x * points[i].y;
            }
            return Math.abs(area) / (2 * ppm * ppm);
          };
          polygons.forEach((poly) => {
            const pairedText = poly.associatedText;
            if (!pairedText || typeof pairedText.text !== "string") return;
            const areaVal = calcArea(poly.points || [], pixelsPerMeter);
            const heightVal = pairedText.displayHeight || poly.height || 2.4;
            const volumeVal = areaVal * heightVal;
            const lines = pairedText.text.split("\n");
            const newLines = lines.map((line) => {
              if (/^\s*Area:/i.test(line)) return `Area: ${areaVal.toFixed(2)} m²`;
              if (/^\s*Volume:/i.test(line)) return `Volume: ${volumeVal.toFixed(2)} m³`;
              return line;
            });
            pairedText.set({ text: newLines.join("\n") });
            poly.area = areaVal;
            poly.volume = volumeVal;
            pairedText.setCoords();
          });
        } catch {}
        fabricCanvas.requestRenderAll();
      } catch (err) {
        console.warn("Change Scale update encountered an issue:", err);
      }
      bootstrap.Modal.getInstance(scaleModal)?.hide();
      cleanup();
      window.__changeScaleMode = false;
      return;
    }

    const objectsNow = fabricCanvas.getObjects();
    let existingBg = null;
    try {
      const layerBgs = Array.isArray(layers?.background?.objects) ? layers.background.objects : [];
      for (let i = layerBgs.length - 1; i >= 0; i--) {
        const obj = layerBgs[i];
        if (obj && obj.type === "image" && objectsNow.includes(obj)) {
          existingBg = obj;
          break;
        }
      }
    } catch {}
    if (!existingBg) existingBg = objectsNow.find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
    const shouldReplace = !!window.__replaceBackgroundMode;

    if (shouldReplace) {
      let targetScaleX = baseScale;
      let targetScaleY = baseScale;
      let targetLeft = left;
      let targetTop = top;
      if (existingBg) {
        const existingDisplayedWidth = existingBg.width * existingBg.scaleX;
        const existingDisplayedHeight = existingBg.height * existingBg.scaleY;
        targetScaleX = existingDisplayedWidth / backgroundImage.width;
        targetScaleY = existingDisplayedHeight / backgroundImage.height;
        targetLeft = existingBg.left;
        targetTop = existingBg.top;
        fabricCanvas.remove(existingBg);
        layers.background.objects = layers.background.objects.filter((obj) => obj !== existingBg);
      }
      fabric.Image.fromURL(
        backgroundImage._element.src,
        (img) => {
          img.set({ scaleX: targetScaleX, scaleY: targetScaleY, left: targetLeft, top: targetTop, selectable: false, evented: false, hoverCursor: "default", isBackground: true });
          fabricCanvas.add(img);
          fabricCanvas.sendToBack(img);
          layers.background.objects.push(img);
          fabricCanvas.requestRenderAll();
          bootstrap.Modal.getInstance(scaleModal)?.hide();
          cleanup();
          window.__replaceBackgroundMode = false;
          closeAllPopups();
        },
        { crossOrigin: "anonymous" }
      );
      return;
    }

    fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        if (obj.textObject) fabricCanvas.remove(obj.textObject);
        if (obj.coverageArea) fabricCanvas.remove(obj.coverageArea);
        if (obj.leftResizeIcon) fabricCanvas.remove(obj.leftResizeIcon);
        if (obj.rightResizeIcon) fabricCanvas.remove(obj.rightResizeIcon);
        if (obj.rotateResizeIcon) fabricCanvas.remove(obj.rotateResizeIcon);
      }
      if (obj.type === "polygon" && obj.class === "zone-polygon" && obj.associatedText) fabricCanvas.remove(obj.associatedText);
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
        img.set({ scaleX: baseScale, scaleY: baseScale, left, top, selectable: false, evented: false, hoverCursor: "default", isBackground: true });
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

// Attach Change Scale button behavior (non-destructive) once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    const btn = document.getElementById("change-scale-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const fabricCanvas = window.fabricCanvas;
      if (!fabricCanvas) return;

      // Find current background image on the main canvas
      const bg = fabricCanvas.getObjects().find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
      if (!bg || !bg._element) {
        alert("No background found. Please add a background first.");
        return;
      }

      // Create an offscreen canvas snapshot of the visible background area for the modal preview
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      const scaleX = bg.scaleX || 1;
      const scaleY = bg.scaleY || 1;
      const drawW = Math.max(1, Math.floor(bg.width * scaleX));
      const drawH = Math.max(1, Math.floor(bg.height * scaleY));
      tempCanvas.width = drawW;
      tempCanvas.height = drawH;
      try {
        tempCtx.drawImage(bg._element, 0, 0, bg.width, bg.height, 0, 0, drawW, drawH);
      } catch (e) {
        console.warn("Failed to draw background snapshot for scale modal:", e);
      }

      // Open the scale modal using the captured snapshot
      // Use the crop handler's scale handler to show the scale modal with our temp canvas
      const scaleHandler = window.cropHandlerInstance?.getScaleHandler?.();
      if (!scaleHandler || typeof scaleHandler.initScaleCanvas !== "function") {
        alert("Scale tools not ready yet.");
        return;
      }

      window.__changeScaleMode = true;
      const scaleModal = document.getElementById("scaleModal");
      (bootstrap.Modal.getInstance(scaleModal) || new bootstrap.Modal(scaleModal)).show();
      setTimeout(() => scaleHandler.initScaleCanvas(tempCanvas), 50);
    });
  } catch (_) {}
});
