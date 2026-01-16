// Scale Calculator handles scale measurement and application
import { calculateArea } from "../sidebar/sidebar-utils.js";

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
  }

  // Initialize scale calculator and listeners
  initialize() {
    this.setupEventListeners();
  }

  // Setup event listeners for buttons and modal
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

  // Start scaling process and show modal
  startScaling(canvas) {
    this.manager.normalizeBackdrops();
    this.manager.showModal(this.elements.scaleModal);
    this.initializeScaleCanvas(canvas);
    this.manager.updateStepIndicators(3);
  }

  // Initialize scale canvas with background image
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
        let maxWidth = containerRect.width - 40;
        let maxHeight = containerRect.height - 40;

        // Fallback for missing dimensions if modal is still opening
        if (maxWidth <= 0 || maxHeight <= 0) {
          maxWidth = Math.min(800, window.innerWidth * 0.8);
          maxHeight = Math.min(600, window.innerHeight * 0.6);
        }
        
        // Calculate scale to fit screen, but keep original resolution for canvas
        const fitScale = Math.min(maxWidth / img.width, maxHeight / img.height);

        // Store UI scale factor to keep controls visible on large images
        this.uiScale = Math.max(1, 1 / (fitScale || 1));

        const cssWidth = Math.floor(img.width * fitScale);
        const cssHeight = Math.floor(img.height * fitScale);

        // Set canvas to full resolution
        scaleCanvasElement.width = img.width;
        scaleCanvasElement.height = img.height;
        
        // Create fabric canvas at full resolution
        this.scaleCanvas = new fabric.Canvas("scaleCanvas", {
          width: img.width,
          height: img.height,
          backgroundColor: "#ffffff",
          selection: false,
        });

        //Apply the visual CSS scale to the fabric wrapper
        this.scaleCanvas.setDimensions({
          width: cssWidth + "px",
          height: cssHeight + "px"
        }, { cssOnly: true });

        // Add background image at 1:1 scale
        img.set({
          left: 0,
          top: 0,
          scaleX: 1, 
          scaleY: 1,
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

  // Create distance text object on canvas
  createDistanceText() {
    const canvasWidth = this.scaleCanvas.getWidth();
    const canvasHeight = this.scaleCanvas.getHeight();

    // Get current input value or default to 50
    let currentValue = 50;
    if (this.elements.scaleDistanceInput) {
      currentValue = parseFloat(this.elements.scaleDistanceInput.value) || 50;
    }

    this.distanceText = new fabric.IText(currentValue + " m", {
      left: canvasWidth / 2,
      top: canvasHeight / 2 - (30 * this.uiScale),
      fontFamily: "Poppins, sans-serif",
      fontSize: 20 * this.uiScale,
      fill: "#000000",
      selectable: false,
      editable: false,
      originX: "center",
      originY: "center",
    });

    this.scaleCanvas.add(this.distanceText);
    this.scaleCanvas.bringToFront(this.distanceText);
  }

  // Create instruction text on canvas
  createInstructionText() {
    const canvasWidth = this.scaleCanvas.getWidth();

    this.instructionText = new fabric.Text("Click twice or click-and-drag to set the scale", {
      left: canvasWidth / 2,
      top: 20 * this.uiScale,
      fontFamily: "Poppins, sans-serif",
      fontSize: 14 * this.uiScale,
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

  // Create reset button on canvas
  createResetButton() {
    const canvasWidth = this.scaleCanvas.getWidth();
    const btnWidth = 110 * this.uiScale;
    const btnHeight = 26 * this.uiScale;
    const btnMargin = 10 * this.uiScale;
    const btnLeft = canvasWidth - btnMargin - btnWidth;
    const btnTop = 16 * this.uiScale;

    // Button background
    const btnBg = new fabric.Rect({
      left: btnLeft,
      top: btnTop,
      width: btnWidth,
      height: btnHeight,
      rx: 6 * this.uiScale,
      ry: 6 * this.uiScale,
      fill: "rgba(255,255,255,0.9)",
      stroke: "#f8794b",
      strokeWidth: 1 * this.uiScale,
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
      fontSize: 13 * this.uiScale,
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
    const { x: x1, y: y1 } = this.scaleStartPoint;
    const { x: x2, y: y2 } = this.scaleEndPoint;

    this.line = this.createMeasurementLine(x1, y1, x2, y2);
    this.scaleCanvas.add(this.line);

    // Update distance text position
    this.positionDistanceText(x1, y1, x2, y2);

    // Bring UI elements to front
    this.bringUIElementsToFront();
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

  // Bring UI elements to front and render
  bringUIElementsToFront() {
    this.scaleCanvas.bringToFront(this.distanceText);
    this.scaleCanvas.bringToFront(this.instructionText);
    this.scaleCanvas.bringToFront(this.resetButton);
    this.scaleCanvas.requestRenderAll();
  }

  // Create a measurement line
  createMeasurementLine(startX, startY, endX, endY) {
    return new fabric.Line([startX, startY, endX, endY], {
      stroke: "red",
      strokeWidth: 3 * this.uiScale,
      strokeLineCap: "round",
      selectable: false,
      evented: false,
    });
  }

  // Calculate pixel distance between two points
  calculatePixelDistance(startPoint, endPoint) {
    if (startPoint && endPoint) {
      return Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    }
    return null;
  }

  // Position distance text at the center of a line
  positionDistanceText(startX, startY, endX, endY) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    this.distanceText.set({ left: midX, top: midY - (30 * this.uiScale) });
    this.distanceText.setCoords();
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

  // Handle mouse down on canvas to start measurement
  handleMouseDown(event) {
    const pointer = this.scaleCanvas.getPointer(event.e || event);
    const point = this.clampPointToImageBounds(pointer);

    // Start new measurement if none exists or both points are set
    if (!this.scaleStartPoint || (this.scaleStartPoint && this.scaleEndPoint)) {
      this.clearExistingLines();
      this.scaleStartPoint = point;
      this.scaleEndPoint = null;
      this.isDragging = true;
      this.hasMoved = false;
    } else {
      // Complete measurement
      this.finalizeLine(point);
    }
  }

  // Handle mouse move on canvas for preview
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

  // Handle mouse up on canvas to finish dragging
  handleMouseUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.hasMoved && this.scaleStartPoint && !this.scaleEndPoint) {
      const pointer = this.scaleCanvas.getPointer(event.e || event);
      this.finalizeLine(pointer);
    }
  }

  // Clear existing measurement lines from canvas
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

    const points = [this.scaleStartPoint.x, this.scaleStartPoint.y, clampedPointer.x, clampedPointer.y];
    this.tempLine = new fabric.Line(points, {
      stroke: "red",
      strokeWidth: 3 * this.uiScale,
      strokeDashArray: [6 * this.uiScale, 6 * this.uiScale],
      evented: false,
    });

    this.scaleCanvas.add(this.tempLine);

    // Update distance text position
    this.positionDistanceText(this.scaleStartPoint.x, this.scaleStartPoint.y, clampedPointer.x, clampedPointer.y);

    // Bring UI elements to front
    this.bringUIElementsToFront();
  }

  // Finalize measurement line
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
    this.line = this.createMeasurementLine(this.scaleStartPoint.x, this.scaleStartPoint.y, clampedEnd.x, clampedEnd.y);
    this.scaleCanvas.add(this.line);

    // Update distance text position
    this.positionDistanceText(this.scaleStartPoint.x, this.scaleStartPoint.y, clampedEnd.x, clampedEnd.y);

    // Bring UI elements to front
    this.bringUIElementsToFront();
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

  // Handle back button and return to crop modal
  handleBack() {
    bootstrap.Modal.getInstance(this.elements.scaleModal)?.hide();
    this.cleanup();

    // Try to restore crop modal
    const restored = this.manager.cropper.restoreCropModal();
    if (!restored) {
      const cropModal = document.getElementById("cropModal");
      this.manager.normalizeBackdrops();
      this.manager.showModal(cropModal);
      this.manager.updateStepIndicators(2);
    }
  }

  // Handle finish button and apply scale to background
  handleFinish() {
    if (!this.scaleCanvas || !this.backgroundImage) return;

    // Get distance value
    const distanceTextValue = parseFloat(this.distanceText.text.replace(" m", ""));
    if (isNaN(distanceTextValue) || distanceTextValue <= 0) {
      alert("Please enter a valid distance in meters.");
      return;
    }

    // Calculate pixels per meter
    let pixelDistance = this.calculatePixelDistance(this.scaleStartPoint, this.scaleEndPoint);
    if (!pixelDistance && this.line) {
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
      const mainBg = this.fabricCanvas.getObjects().find((o) => {
        const isImage = o.type === "image";
        const isBg = o.isBackground || (!o.selectable && !o.evented);
        return isImage && isBg;
      });
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
    }
  }

  // Update existing measurements when scale changes
  updateExistingMeasurements() {
    const objects = this.fabricCanvas.getObjects();

    // Update measurement lines
    const measurementGroups = objects.filter((obj) => {
      if (obj.type !== "group" || obj._objects?.length !== 2) return false;
      const hasLine = obj._objects.some((x) => x.type === "line");
      const hasText = obj._objects.some((x) => x.type === "i-text");
      return hasLine && hasText;
    });

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
    const cameras = objects.filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig);

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
    if (window.topologyManager && typeof window.topologyManager.updateConnectionLabelsForScaleChange === "function") {
      window.topologyManager.updateConnectionLabelsForScaleChange(this.pixelsPerMeter);
    }

    this.fabricCanvas.requestRenderAll();
  }

  // Update polygon area and volume labels
  updatePolygonLabels(objects) {
    try {
      const polygons = objects.filter((obj) => {
        const isPolygon = obj.type === "polygon";
        const isZoneOrRoom = obj.class === "zone-polygon" || obj.class === "room-polygon";
        return isPolygon && isZoneOrRoom;
      });

      polygons.forEach((polygon) => {
        const pairedText = polygon.associatedText;
        if (!pairedText || typeof pairedText.text !== "string") return;

        const areaVal = calculateArea(polygon.points || [], this.fabricCanvas);
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

  // Cleanup resources and references
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
