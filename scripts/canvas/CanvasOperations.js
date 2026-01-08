// Handles canvas interactions, panning, zooming, and clearing
import { initCanvasCrop } from "./export/Screenshot.js";
import { DeviceFactory } from "../devices/DeviceFactory.js";

export class CanvasOperations {
  constructor(fabricCanvas) {
    this.canvas = fabricCanvas;
    this.isPanning = false;
    this.lastPosX = 0;
    this.lastPosY = 0;
    this.elements = {
      clearButton: document.getElementById("clear-canvas-btn"),
      clearWarningPopup: document.getElementById("clear-warning-popup"),
      cancelClearWarning: document.getElementById("cancel-clear-warning"),
      closeClearWarning: document.getElementById("close-clear-warning"),
      confirmClearWarning: document.getElementById("confirm-clear-warning"),
      subSidebar: document.getElementById("sub-sidebar"),
      downloadButton: document.getElementById("download-background-btn"),
    };
    this.canvas.defaultCursor = "move";
    this.init();
  }

  // Initialize event listeners and sub-modules
  init() {
    // Setup mouse interaction events
    this.canvas.on("mouse:down", this.handleMouseDown.bind(this));
    this.canvas.on("mouse:move", this.handleMouseMove.bind(this));
    this.canvas.on("mouse:up", this.handleMouseUp.bind(this));
    this.canvas.on("mouse:wheel", this.handleMouseWheel.bind(this));

    // Initialize confirmation modal for clearing canvas
    this.initModalWhenReady();

    // Handle clear canvas button click
    if (this.elements.clearButton) {
      this.elements.clearButton.addEventListener("click", () => {
        if (this.clearWarningModal) {
          this.elements.subSidebar.classList.add("hidden");
          this.clearWarningModal.show();
        } else {
          // Clear directly if modal is not available
          this.clearCanvas();
        }
      });
    }

    // Initialize screenshot cropping and background download
    const canvasContainer = document.querySelector(".canvas-container");
    this.canvasCrop = initCanvasCrop(this.canvas, this.elements.subSidebar, canvasContainer);
    this.elements.downloadButton.addEventListener("click", () => this.canvasCrop.startCropForDownload());

    // Setup device drag-and-drop and keyboard shortcuts
    this.setupDeviceDrop();
    this.setupKeyboardShortcuts();
  }

  // Wait for Bootstrap to be available before initializing the modal
  initModalWhenReady() {
    if (typeof bootstrap !== "undefined" && bootstrap.Modal && this.elements.clearWarningPopup) {
      try {
        this.clearWarningModal = bootstrap.Modal.getOrCreateInstance(this.elements.clearWarningPopup, {
          backdrop: "static",
          keyboard: false,
        });

        this.setupModalEvents();
      } catch (error) {
        console.error("Error initializing clear warning modal:", error);
        this.clearWarningModal = null;
      }
    } else {
      // Retry initialization after a short delay
      setTimeout(() => this.initModalWhenReady(), 100);
    }
  }

  // Setup event listeners for the clear warning modal buttons
  setupModalEvents() {
    if (!this.clearWarningModal) return;

    // Close modal on cancel or close button click
    [this.elements.cancelClearWarning, this.elements.closeClearWarning].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => this.clearWarningModal.hide());
      }
    });

    // Confirm clearing the canvas
    if (this.elements.confirmClearWarning) {
      this.elements.confirmClearWarning.addEventListener("click", () => {
        this.clearWarningModal.hide();
        this.clearCanvas();
      });
    }
  }

  // Start panning when clicking on empty canvas space
  handleMouseDown(options) {
    this.canvas.selection = false;
    const event = options.e;
    if (event.button === 0 && !options.target) {
      this.isPanning = true;
      this.lastPosX = event.clientX;
      this.lastPosY = event.clientY;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Update viewport position during panning
  handleMouseMove(options) {
    if (!this.isPanning) return;

    const event = options.e;
    const deltaX = event.clientX - this.lastPosX;
    const deltaY = event.clientY - this.lastPosY;
    this.lastPosX = event.clientX;
    this.lastPosY = event.clientY;

    const viewportTransform = this.canvas.viewportTransform;
    viewportTransform[4] += deltaX;
    viewportTransform[5] += deltaY;
    this.canvas.setViewportTransform(viewportTransform);
    this.canvas.requestRenderAll();

    event.preventDefault();
    event.stopPropagation();
  }

  // Stop panning and restore selection
  handleMouseUp(options) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.selection = true;
      options.e.preventDefault();
      options.e.stopPropagation();
    } else {
      this.canvas.selection = true;
    }
  }

  // Handle zooming with mouse wheel
  handleMouseWheel(options) {
    options.e.preventDefault();
    options.e.stopPropagation();

    const delta = options.e.deltaY;
    let zoom = this.canvas.getZoom();
    const zoomFactor = 0.1;
    const minZoom = 0.25;
    const maxZoom = 10;

    // Calculate new zoom level within bounds
    zoom = delta > 0 ? Math.max(minZoom, zoom - zoomFactor) : Math.min(maxZoom, zoom + zoomFactor);

    const pointer = this.canvas.getPointer(options.e, true);
    const zoomPoint = new fabric.Point(pointer.x, pointer.y);

    this.canvas.zoomToPoint(zoomPoint, zoom);
    this.canvas.requestRenderAll();
    if (window.updateZoomDisplay) window.updateZoomDisplay();
  }

  // Remove all objects and reset canvas state
  clearCanvas() {
    this.elements.subSidebar.classList.add("hidden");
    if (window.hideDeviceProperties) window.hideDeviceProperties();

    // Clean up all objects and their associated UI elements
    this.canvas.getObjects().forEach((object) => {
      if (object.type === "group" && object.deviceType) {
        ["textObject", "coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((property) => {
          if (object[property]) this.canvas.remove(object[property]);
        });
      }
      if (object.type === "polygon" && object.class === "zone-polygon" && object.associatedText) {
        this.canvas.remove(object.associatedText);
      }
      this.canvas.remove(object);
    });

    this.canvas.clear();

    // Reset counters and global state
    window.cameraCounter = 1;
    window.deviceCounter = 1;
    window.zones = [];

    if (window.resetCanvasState) window.resetCanvasState();

    // Reset canvas view properties
    this.canvas.pixelsPerMeter = 17.5;
    this.canvas.setZoom(1);
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.requestRenderAll();
    if (window.updateZoomDisplay) window.updateZoomDisplay();
  }

  // Setup drag and drop functionality for adding devices to the canvas
  setupDeviceDrop() {
    window.cameraCounter = window.cameraCounter || 1;
    window.deviceCounter = window.deviceCounter || 1;

    const canvasElement = this.canvas.getElement();
    const canvasContainer = canvasElement.parentElement;

    Object.assign(canvasContainer.style, {
      position: "relative",
      zIndex: "10",
    });

    canvasContainer.addEventListener("dragover", (event) => event.preventDefault());

    canvasContainer.addEventListener("drop", (event) => {
      event.preventDefault();

      // Get drop payload and calculate canvas coordinates
      const getPayload = window.__getCustomDropPayload;
      const customPayload = typeof getPayload === "function" ? getPayload(event.dataTransfer) : null;
      const imgSrc = customPayload?.dataUrl || event.dataTransfer.getData("text/plain");
      const boundingRect = canvasElement.getBoundingClientRect();

      const clientX = event.clientX - boundingRect.left;
      const clientY = event.clientY - boundingRect.top;
      const viewportTransform = this.canvas.viewportTransform;
      const zoom = this.canvas.getZoom();

      const canvasX = (clientX - viewportTransform[4]) / zoom;
      const canvasY = (clientY - viewportTransform[5]) / zoom;

      let deviceType;
      if (customPayload) {
        deviceType = customPayload.isCamera ? "custom-camera-icon.png" : "custom-device-icon.png";
      }

      const deviceOptions = {
        isCamera: customPayload?.isCamera,
        deviceType,
      };

      // Create the device at the dropped location
      DeviceFactory.createDevice(this.canvas, imgSrc, canvasX, canvasY, deviceOptions);
    });
  }

  // Setup keyboard shortcuts for canvas operations
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.tagName === "SELECT" || activeElement.isContentEditable);

      // Ignore shortcuts if an input field is focused
      if (isInputFocused) return;

      // Delete selected object on Delete or Backspace key
      if ((event.key === "Delete" || event.key === "Backspace") && this.canvas.getActiveObject()) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject.type === "group") {
          event.preventDefault();
          activeObject.fire("removed");
          this.canvas.remove(activeObject);
          this.canvas.discardActiveObject();
          if (typeof window.hideDeviceProperties === "function") {
            window.hideDeviceProperties();
          }
          this.canvas.renderAll();
        }
      }
    });
  }
}
