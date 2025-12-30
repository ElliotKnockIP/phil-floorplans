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

  init() {
    // Add event listeners
    this.canvas.on("mouse:down", this.handleMouseDown.bind(this));
    this.canvas.on("mouse:move", this.handleMouseMove.bind(this));
    this.canvas.on("mouse:up", this.handleMouseUp.bind(this));
    this.canvas.on("mouse:wheel", this.handleMouseWheel.bind(this));

    // Initialize modal when Bootstrap is ready
    this.initModalWhenReady();

    // Set up clear button events - will work with or without modal
    if (this.elements.clearButton) {
      this.elements.clearButton.addEventListener("click", () => {
        if (this.clearWarningModal) {
          this.elements.subSidebar.classList.add("hidden");
          this.clearWarningModal.show();
        } else {
          // Fallback: clear canvas directly without confirmation
          this.clearCanvas();
        }
      });
    }

    // Initialize cropping and download
    this.canvasCrop = initCanvasCrop(this.canvas, this.elements.subSidebar, document.querySelector(".canvas-container"));
    this.elements.downloadButton.addEventListener("click", () => this.canvasCrop.startCropForDownload());

    // Initialize device interactions
    this.setupDeviceDrop();
    this.setupKeyboardShortcuts();
  }

  initModalWhenReady() {
    // Check if Bootstrap and modal element are available
    if (typeof bootstrap !== "undefined" && bootstrap.Modal && this.elements.clearWarningPopup) {
      try {
        this.clearWarningModal = bootstrap.Modal.getOrCreateInstance(this.elements.clearWarningPopup, {
          backdrop: "static",
          keyboard: false,
        });

        // Set up modal button events now that modal is available
        this.setupModalEvents();
      } catch (error) {
        console.error("Error initializing clear warning modal:", error);
        this.clearWarningModal = null;
      }
    } else {
      // Bootstrap not ready yet, try again later
      setTimeout(() => this.initModalWhenReady(), 100);
    }
  }

  setupModalEvents() {
    if (!this.clearWarningModal) return;

    // Set up modal button events
    [this.elements.cancelClearWarning, this.elements.closeClearWarning].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => this.clearWarningModal.hide());
      }
    });

    if (this.elements.confirmClearWarning) {
      this.elements.confirmClearWarning.addEventListener("click", () => {
        this.clearWarningModal.hide();
        this.clearCanvas();
      });
    }
  }

  // Handles mouse down events
  handleMouseDown(opt) {
    this.canvas.selection = false;
    const evt = opt.e;
    if (evt.button === 0 && !opt.target) {
      this.isPanning = true;
      this.lastPosX = evt.clientX;
      this.lastPosY = evt.clientY;
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  // Handles mouse move events
  handleMouseMove(opt) {
    if (!this.isPanning) return;

    const evt = opt.e;
    const deltaX = evt.clientX - this.lastPosX;
    const deltaY = evt.clientY - this.lastPosY;
    this.lastPosX = evt.clientX;
    this.lastPosY = evt.clientY;

    const vpt = this.canvas.viewportTransform;
    vpt[4] += deltaX;
    vpt[5] += deltaY;
    this.canvas.setViewportTransform(vpt);
    this.canvas.requestRenderAll();

    evt.preventDefault();
    evt.stopPropagation();
  }

  // Handles mouse up events
  handleMouseUp(opt) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.selection = true;
      opt.e.preventDefault();
      opt.e.stopPropagation();
    } else {
      this.canvas.selection = true;
    }
  }

  // Handles mouse wheel events for zooming
  handleMouseWheel(opt) {
    opt.e.preventDefault();
    opt.e.stopPropagation();

    const delta = opt.e.deltaY;
    let zoom = this.canvas.getZoom();
    const zoomFactor = 0.1;
    const minZoom = 0.25;
    const maxZoom = 10;

    zoom = delta > 0 ? Math.max(minZoom, zoom - zoomFactor) : Math.min(maxZoom, zoom + zoomFactor);

    const pointer = this.canvas.getPointer(opt.e, true);
    const zoomPoint = new fabric.Point(pointer.x, pointer.y);

    this.canvas.zoomToPoint(zoomPoint, zoom);
    this.canvas.requestRenderAll();
    if (window.updateZoomDisplay) window.updateZoomDisplay();
  }

  // Clears the entire canvas
  clearCanvas() {
    this.elements.subSidebar.classList.add("hidden");
    if (window.hideDeviceProperties) window.hideDeviceProperties();

    // Remove all objects and their related elements
    this.canvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        ["textObject", "coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
          if (obj[prop]) this.canvas.remove(obj[prop]);
        });
      }
      if (obj.type === "polygon" && obj.class === "zone-polygon" && obj.associatedText) {
        this.canvas.remove(obj.associatedText);
      }
      this.canvas.remove(obj);
    });

    this.canvas.clear();

    // Reset global state
    window.cameraCounter = 1;
    window.deviceCounter = 1;
    window.zones = [];

    if (window.resetCanvasState) window.resetCanvasState();

    // Reset canvas properties
    this.canvas.pixelsPerMeter = 17.5;
    this.canvas.setZoom(1);
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.requestRenderAll();
    if (window.updateZoomDisplay) window.updateZoomDisplay();
  }

  // Sets up drag and drop for devices on the canvas
  setupDeviceDrop() {
    window.cameraCounter = window.cameraCounter || 1;
    window.deviceCounter = window.deviceCounter || 1;

    const canvasElement = this.canvas.getElement();
    const canvasContainer = canvasElement.parentElement;

    Object.assign(canvasContainer.style, {
      position: "relative",
      zIndex: "10",
    });

    canvasContainer.addEventListener("dragover", (e) => e.preventDefault());

    canvasContainer.addEventListener("drop", (e) => {
      e.preventDefault();

      const customPayload = typeof window.__getCustomDropPayload === "function" ? window.__getCustomDropPayload(e.dataTransfer) : null;
      const imgSrc = customPayload?.dataUrl || e.dataTransfer.getData("text/plain");
      const rect = canvasElement.getBoundingClientRect();

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const vpt = this.canvas.viewportTransform;
      const zoom = this.canvas.getZoom();

      const canvasX = (clientX - vpt[4]) / zoom;
      const canvasY = (clientY - vpt[5]) / zoom;

      const deviceOptions = {
        isCamera: customPayload?.isCamera,
        deviceType: customPayload ? (customPayload.isCamera ? "custom-camera-icon.png" : "custom-device-icon.png") : undefined,
      };

      DeviceFactory.createDevice(this.canvas, imgSrc, canvasX, canvasY, deviceOptions);
    });
  }

  // Handles keyboard deletion of devices
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.tagName === "SELECT" || activeElement.isContentEditable);

      if (isInputFocused) return;

      if ((e.key === "Delete" || e.key === "Backspace") && this.canvas.getActiveObject()) {
        const activeObj = this.canvas.getActiveObject();
        if (activeObj.type === "group") {
          e.preventDefault();
          activeObj.fire("removed");
          this.canvas.remove(activeObj);
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
