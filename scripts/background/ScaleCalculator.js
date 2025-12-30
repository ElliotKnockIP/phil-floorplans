// Scale Calculator - Handles scale measurement and application
// Allows users to measure distances on background images to set scale

export class ScaleCalculator {
  constructor(fabricCanvas, manager) {
    this.fabricCanvas = fabricCanvas;
    this.manager = manager;

    // DOM elements
    this.elements = {
      scaleModal: document.getElementById("scaleModal"),
      scaleBackBtn: document.getElementById("scale-back-btn"),
      finishScaleBtn: document.getElementById("finish-scale-btn"),
      scaleWrapper: document.getElementById("scale-result-container"),
      scaleDistanceInput: document.getElementById("scale-distance-input"),
    };

    // Canvas and drawing state
    this.scaleCanvas = null;
    this.backgroundImage = null;
    this.line = null;
    this.tempLine = null;
    this.distanceText = null;
    this.instructionText = null;
    this.resetButton = null;

    // Measurement state
    this.scaleStartPoint = null;
    this.scaleEndPoint = null;
    this.isDragging = false;
    this.hasMoved = false;
    this.pixelsPerMeter = null;

    // Input handling
    this.distanceInputListener = null;

    // Helper to prevent stacked backdrops when switching modals
    this.normalizeBackdrops = function () {
      const backdrops = Array.from(document.querySelectorAll(".modal-backdrop"));
      if (backdrops.length > 1) backdrops.slice(0, -1).forEach((bd) => bd.remove());
      if (backdrops.length > 0) document.body.classList.add("modal-open");
    };
  }

  // Initialize the scale calculator
  initialize() {
    this.setupEventListeners();
  }

  // Setup event listeners
  setupEventListeners() {
    if (this.elements.scaleBackBtn) {
      this.elements.scaleBackBtn.addEventListener("click", () => this.handleBack());
    }

    if (this.elements.finishScaleBtn) {
      this.elements.finishScaleBtn.addEventListener("click", () => this.handleFinish());
    }

    if (this.elements.scaleModal) {
      this.elements.scaleModal.addEventListener("hidden.bs.modal", () => this.cleanup());
    }
  }

  // Start scaling process with a canvas
  startScaling(canvas) {
    this.normalizeBackdrops();
    this.manager.showModal(this.elements.scaleModal);

    this.initializeScaleCanvas(canvas);
    this.manager.updateStepIndicators(3);
  }

  // Initialize the scale canvas with background image
  initializeScaleCanvas(sourceCanvas) {
    // Clean up previous canvas
    if (this.scaleCanvas) {
      this.scaleCanvas.clear();
      this.scaleCanvas.dispose();
      this.scaleCanvas = null;
    }

    // Create new canvas element
    this.elements.scaleWrapper.innerHTML = '<canvas id="scaleCanvas"></canvas>';
    const scaleCanvasElement = document.getElementById("scaleCanvas");

    // Convert source canvas to data URL
    const imageDataUrl = sourceCanvas.toDataURL("image/png");

    fabric.Image.fromURL(
      imageDataUrl,
      (img) => {
        // Calculate canvas dimensions to fit container
        const containerRect = this.elements.scaleWrapper.getBoundingClientRect();
        const maxWidth = containerRect.width - 20;
        const maxHeight = containerRect.height - 20;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;

        scaleCanvasElement.width = canvasWidth;
        scaleCanvasElement.height = canvasHeight;
        scaleCanvasElement.style.width = canvasWidth + "px";
        scaleCanvasElement.style.height = canvasHeight + "px";

        // Create fabric canvas
        this.scaleCanvas = new fabric.Canvas("scaleCanvas", {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: "#ffffff",
          selection: false,
        });

        // Add background image
        img.set({
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          hoverCursor: "default",
        });
        this.scaleCanvas.add(img);
        this.scaleCanvas.sendToBack(img);
        this.backgroundImage = img;

        // Set default distance
        if (this.elements.scaleDistanceInput) {
          this.elements.scaleDistanceInput.value = 50;
        }

        // Create UI elements
        this.createDistanceText();
        this.createInstructionText();
        this.createResetButton();

        // Setup interaction handlers
        this.setupCanvasInteractions();

        // Setup distance input listener
        this.setupDistanceInput();

        this.scaleCanvas.requestRenderAll();
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Create distance text object
  createDistanceText() {
    const canvasWidth = this.scaleCanvas.getWidth();
    const canvasHeight = this.scaleCanvas.getHeight();

    // Get current input value or default to 50
    const currentValue = this.elements.scaleDistanceInput
      ? parseFloat(this.elements.scaleDistanceInput.value) || 50
      : 50;

    this.distanceText = new fabric.IText(currentValue + " m", {
      left: canvasWidth / 2,
      top: canvasHeight / 2 - 30,
      fontFamily: "Poppins, sans-serif",
      fontSize: 20,
      fill: "#000000",
      selectable: false,
      editable: false,
      originX: "center",
      originY: "center",
    });

    this.scaleCanvas.add(this.distanceText);
    this.scaleCanvas.bringToFront(this.distanceText);
  }

  // Create instruction text
  createInstructionText() {
    const canvasWidth = this.scaleCanvas.getWidth();

    this.instructionText = new fabric.Text("Click twice or click-and-drag to set the scale", {
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

    this.scaleCanvas.add(this.instructionText);
    this.scaleCanvas.bringToFront(this.instructionText);
  }

  // Create reset button
  createResetButton() {
    const canvasWidth = this.scaleCanvas.getWidth();
    const btnWidth = 110;
    const btnHeight = 26;
    const btnMargin = 10;
    const btnLeft = canvasWidth - btnMargin - btnWidth;
    const btnTop = 16;

    // Button background
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

    // Button text
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

    // Create button group
    this.resetButton = new fabric.Group([btnBg, btnText], {
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
    });

    this.resetButton.on("mousedown", () => this.resetToFullWidth());
    this.scaleCanvas.add(this.resetButton);
    this.scaleCanvas.bringToFront(this.resetButton);

    // Initialize scale line to full width
    this.resetToFullWidth();
  }

  // Reset measurement line to full image width
  resetToFullWidth() {
    // Remove existing lines
    if (this.tempLine) {
      this.scaleCanvas.remove(this.tempLine);
      this.tempLine = null;
    }
    if (this.line) {
      this.scaleCanvas.remove(this.line);
      this.line = null;
    }

    // Calculate image bounds
    const imgLeft = this.backgroundImage.left;
    const imgTop = this.backgroundImage.top;
    const imgRight = imgLeft + this.backgroundImage.width * this.backgroundImage.scaleX;
    const imgBottom = imgTop + this.backgroundImage.height * this.backgroundImage.scaleY;
    const midY = imgTop + (imgBottom - imgTop) / 2;

    // Set scale points
    this.scaleStartPoint = { x: imgLeft, y: midY };
    this.scaleEndPoint = { x: imgRight, y: midY };

    // Create new line
    this.line = new fabric.Line(
      [this.scaleStartPoint.x, this.scaleStartPoint.y, this.scaleEndPoint.x, this.scaleEndPoint.y],
      {
        stroke: "red",
        strokeWidth: 3,
        strokeLineCap: "round",
        selectable: false,
        evented: false,
      }
    );

    this.scaleCanvas.add(this.line);

    // Update distance text position
    this.distanceText.set({
      left: (this.scaleStartPoint.x + this.scaleEndPoint.x) / 2,
      top: midY - 30,
    });
    this.distanceText.setCoords();

    // Bring UI elements to front
    this.scaleCanvas.bringToFront(this.distanceText);
    this.scaleCanvas.bringToFront(this.instructionText);
    this.scaleCanvas.bringToFront(this.resetButton);
    this.scaleCanvas.requestRenderAll();
  }

  // Setup canvas interaction handlers
  setupCanvasInteractions() {
    this.scaleCanvas.on("mouse:down", (e) => this.handleMouseDown(e));
    this.scaleCanvas.on("mouse:move", (e) => this.handleMouseMove(e));
    this.scaleCanvas.on("mouse:up", (e) => this.handleMouseUp(e));
  }

  // Setup distance input listener
  setupDistanceInput() {
    if (this.elements.scaleDistanceInput && !this.distanceInputListener) {
      this.distanceInputListener = (event) => this.handleDistanceChange(event);
      this.elements.scaleDistanceInput.addEventListener("input", this.distanceInputListener);
    }
  }

  // Handle distance input change
  handleDistanceChange(event) {
    if (this.distanceText) {
      const value = parseFloat(event.target.value);
      if (!isNaN(value) && value > 0) {
        this.distanceText.set({ text: value + " m" });
        this.scaleCanvas.requestRenderAll();
      }
    }
  }

  // Handle mouse down on canvas
  handleMouseDown(event) {
    const pointer = this.scaleCanvas.getPointer(event.e || event);
    const point = this.clampPointToImageBounds(pointer);

    // If no start point or both points exist, start new measurement
    if (!this.scaleStartPoint || (this.scaleStartPoint && this.scaleEndPoint)) {
      this.clearExistingLines();
      this.scaleStartPoint = point;
      this.scaleEndPoint = null;
      this.isDragging = true;
      this.hasMoved = false;
    } else {
      // Complete the measurement
      this.finalizeLine(point);
    }
  }

  // Handle mouse move on canvas
  handleMouseMove(event) {
    if (!this.scaleStartPoint || this.scaleEndPoint) return;

    const pointer = this.scaleCanvas.getPointer(event.e || event);

    if (this.isDragging) {
      const p = this.clampPointToImageBounds(pointer);
      const dx = p.x - this.scaleStartPoint.x;
      const dy = p.y - this.scaleStartPoint.y;
      if (!this.hasMoved && Math.hypot(dx, dy) > 2) {
        this.hasMoved = true;
      }
    }

    this.updatePreviewLine(pointer);
  }

  // Handle mouse up on canvas
  handleMouseUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.hasMoved && this.scaleStartPoint && !this.scaleEndPoint) {
      const pointer = this.scaleCanvas.getPointer(event.e || event);
      this.finalizeLine(pointer);
    }
  }

  // Clear existing measurement lines
  clearExistingLines() {
    if (this.line) {
      this.scaleCanvas.remove(this.line);
      this.line = null;
    }
    if (this.tempLine) {
      this.scaleCanvas.remove(this.tempLine);
      this.tempLine = null;
    }
  }

  // Update preview line during dragging
  updatePreviewLine(pointer) {
    const clampedPointer = this.clampPointToImageBounds(pointer);

    if (this.tempLine) {
      this.scaleCanvas.remove(this.tempLine);
    }

    this.tempLine = new fabric.Line(
      [this.scaleStartPoint.x, this.scaleStartPoint.y, clampedPointer.x, clampedPointer.y],
      {
        stroke: "red",
        strokeWidth: 3,
        strokeDashArray: [6, 6],
        evented: false,
      }
    );

    this.scaleCanvas.add(this.tempLine);

    // Update distance text position
    const midX = (this.scaleStartPoint.x + clampedPointer.x) / 2;
    const midY = (this.scaleStartPoint.y + clampedPointer.y) / 2;
    this.distanceText.set({ left: midX, top: midY - 30 });
    this.distanceText.setCoords();

    // Bring UI elements to front
    this.scaleCanvas.bringToFront(this.distanceText);
    this.scaleCanvas.bringToFront(this.instructionText);
    this.scaleCanvas.bringToFront(this.resetButton);
    this.scaleCanvas.requestRenderAll();
  }

  // Finalize the measurement line
  finalizeLine(endPoint) {
    const clampedEnd = this.clampPointToImageBounds(endPoint);

    this.scaleEndPoint = clampedEnd;

    // Remove temporary line
    if (this.tempLine) {
      this.scaleCanvas.remove(this.tempLine);
      this.tempLine = null;
    }

    // Remove existing line
    if (this.line) {
      this.scaleCanvas.remove(this.line);
    }

    // Create final line
    this.line = new fabric.Line(
      [this.scaleStartPoint.x, this.scaleStartPoint.y, clampedEnd.x, clampedEnd.y],
      {
        stroke: "red",
        strokeWidth: 3,
        strokeLineCap: "round",
        selectable: false,
        evented: false,
      }
    );

    this.scaleCanvas.add(this.line);

    // Update distance text position
    const midX = (this.scaleStartPoint.x + clampedEnd.x) / 2;
    const midY = (this.scaleStartPoint.y + clampedEnd.y) / 2;
    this.distanceText.set({ left: midX, top: midY - 30 });
    this.distanceText.setCoords();

    // Bring UI elements to front
    this.scaleCanvas.bringToFront(this.distanceText);
    this.scaleCanvas.bringToFront(this.instructionText);
    this.scaleCanvas.bringToFront(this.resetButton);
    this.scaleCanvas.requestRenderAll();
  }

  // Clamp point to image bounds
  clampPointToImageBounds(point) {
    if (!this.backgroundImage) return point;

    const imgLeft = this.backgroundImage.left;
    const imgTop = this.backgroundImage.top;
    const imgRight = imgLeft + this.backgroundImage.width * this.backgroundImage.scaleX;
    const imgBottom = imgTop + this.backgroundImage.height * this.backgroundImage.scaleY;

    return {
      x: Math.max(imgLeft, Math.min(imgRight, point.x)),
      y: Math.max(imgTop, Math.min(imgBottom, point.y)),
    };
  }

  // Handle back button
  handleBack() {
    bootstrap.Modal.getInstance(this.elements.scaleModal)?.hide();
    this.cleanup();

    setTimeout(() => {
      // Try to restore crop modal
      const restored = this.manager.cropper.restoreCropModal();
      if (!restored) {
        const cropModal = document.getElementById("cropModal");
        this.normalizeBackdrops();
        this.manager.showModal(cropModal);
        this.manager.updateStepIndicators(2);
      }
    }, 200);
  }

  // Handle finish button - apply scale and create background
  handleFinish() {
    if (!this.scaleCanvas || !this.backgroundImage) return;

    // Get distance value
    const distanceTextValue = parseFloat(this.distanceText.text.replace(" m", ""));
    if (isNaN(distanceTextValue) || distanceTextValue <= 0) {
      alert("Please enter a valid distance in meters.");
      return;
    }

    // Calculate pixels per meter
    let pixelDistance = null;
    if (this.scaleStartPoint && this.scaleEndPoint) {
      pixelDistance = Math.hypot(
        this.scaleEndPoint.x - this.scaleStartPoint.x,
        this.scaleEndPoint.y - this.scaleEndPoint.y
      );
    } else if (this.line) {
      pixelDistance = Math.hypot(this.line.x2 - this.line.x1, this.line.y2 - this.line.y1);
    }

    if (!pixelDistance || pixelDistance <= 0) {
      alert("Please draw the scale distance on the image.");
      return;
    }

    // Calculate scale
    const canvasWidth = this.fabricCanvas.getWidth();
    const canvasHeight = this.fabricCanvas.getHeight();
    const imgWidth = this.backgroundImage.width;
    const imgHeight = this.backgroundImage.height;
    const baseScale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight) * 0.8;
    const scaledPixelWidth = imgWidth * baseScale;
    const imageWidthInPixels = this.backgroundImage.width * this.backgroundImage.scaleX;
    const scaleLineFraction = pixelDistance / imageWidthInPixels;

    let effectiveScaledPixelWidth = scaledPixelWidth;

    if (this.manager.changeScaleMode) {
      const mainBg = this.fabricCanvas
        .getObjects()
        .find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
      if (mainBg) {
        effectiveScaledPixelWidth = (mainBg.width || 0) * (mainBg.scaleX || 1);
      }
    }

    this.pixelsPerMeter = effectiveScaledPixelWidth / (distanceTextValue / scaleLineFraction);

    // Apply scale to canvas
    this.applyScaleToCanvas();

    // Create background image data
    const imageData = {
      url: this.backgroundImage._element.src,
      width: this.backgroundImage.width,
      height: this.backgroundImage.height,
      pixelsPerMeter: this.pixelsPerMeter,
    };

    // Hide modal and cleanup
    bootstrap.Modal.getInstance(this.elements.scaleModal)?.hide();
    this.cleanup();

    // Notify manager
    this.manager.onScaleComplete(imageData);
  }

  // Apply calculated scale to fabric canvas
  applyScaleToCanvas() {
    const isChangeScaleMode = this.manager.changeScaleMode;

    // Set pixels per meter on canvas
    this.fabricCanvas.pixelsPerMeter = this.pixelsPerMeter;
    window.defaultDeviceIconSize = window.globalIconSize || 30;

    if (isChangeScaleMode) {
      this.updateExistingMeasurements();
      // Manager will clear changeScaleMode after it processes the new scale
    }
  }

  // Update existing measurements when scale changes
  updateExistingMeasurements() {
    const objects = this.fabricCanvas.getObjects();

    // Update measurement lines
    const measurementGroups = objects.filter(
      (obj) =>
        obj.type === "group" &&
        obj._objects?.length === 2 &&
        obj._objects.some((x) => x.type === "line") &&
        obj._objects.some((x) => x.type === "i-text")
    );

    measurementGroups.forEach((group) => {
      try {
        const lineObj = group._objects.find((x) => x.type === "line");
        const textObj = group._objects.find((x) => x.type === "i-text");
        if (!lineObj || !textObj) return;

        const dx = lineObj.x2 - lineObj.x1;
        const dy = lineObj.y2 - lineObj.y1;
        const distPx = Math.hypot(dx, dy);
        const metersVal = (distPx / this.pixelsPerMeter).toFixed(2);
        const isApex = (textObj.text || "").trim().toLowerCase().startsWith("apex:");
        textObj.set({
          text: isApex ? `Apex: ${metersVal} m` : `${metersVal} m`,
        });
        textObj.setCoords();
        group.setCoords();
      } catch (error) {
        console.warn("Error updating measurement:", error);
      }
    });

    // Update camera coverage areas
    const cameras = objects.filter(
      (obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig
    );

    cameras.forEach((camera) => {
      try {
        if (typeof camera.createOrUpdateCoverageArea === "function") {
          camera.createOrUpdateCoverageArea();
        }
      } catch (error) {
        console.warn("Error updating camera coverage:", error);
      }
    });

    // Update polygon area/volume labels
    this.updatePolygonLabels(objects);

    // Update connection distance labels
    if (
      window.topologyManager &&
      typeof window.topologyManager.updateConnectionLabelsForScaleChange === "function"
    ) {
      window.topologyManager.updateConnectionLabelsForScaleChange(this.pixelsPerMeter);
    }

    this.fabricCanvas.requestRenderAll();
  }

  // Update polygon area and volume labels
  updatePolygonLabels(objects) {
    try {
      const polygons = objects.filter(
        (obj) =>
          obj.type === "polygon" && (obj.class === "zone-polygon" || obj.class === "room-polygon")
      );

      const calculateArea = (points, ppm) => {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
          const j = (i + 1) % points.length;
          area += points[i].x * points[j].y - points[j].x * points[i].y;
        }
        return Math.abs(area) / (2 * ppm * ppm);
      };

      polygons.forEach((polygon) => {
        const pairedText = polygon.associatedText;
        if (!pairedText || typeof pairedText.text !== "string") return;

        const areaVal = calculateArea(polygon.points || [], this.pixelsPerMeter);
        const heightVal = pairedText.displayHeight || polygon.height || 2.4;
        const volumeVal = areaVal * heightVal;

        const lines = pairedText.text.split("\n");
        const newLines = lines.map((line) => {
          if (/^\s*Area:/i.test(line)) return `Area: ${areaVal.toFixed(2)} m²`;
          if (/^\s*Volume:/i.test(line)) return `Volume: ${volumeVal.toFixed(2)} m³`;
          return line;
        });

        pairedText.set({ text: newLines.join("\n") });
        polygon.area = areaVal;
        polygon.volume = volumeVal;
        pairedText.setCoords();
      });
    } catch (error) {
      console.warn("Error updating polygon labels:", error);
    }
  }

  // Cleanup resources
  cleanup() {
    if (this.scaleCanvas) {
      this.scaleCanvas.clear();
      this.scaleCanvas.dispose();
      this.scaleCanvas = null;
    }

    // Clear references
    this.backgroundImage = null;
    this.line = null;
    this.tempLine = null;
    this.distanceText = null;
    this.instructionText = null;
    this.resetButton = null;
    this.scaleStartPoint = null;
    this.scaleEndPoint = null;

    // Remove input listener
    if (this.elements.scaleDistanceInput && this.distanceInputListener) {
      this.elements.scaleDistanceInput.removeEventListener("input", this.distanceInputListener);
      this.distanceInputListener = null;
    }
  }
}
