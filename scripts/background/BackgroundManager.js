// Background Manager handles background selection, cropping, and scaling

import { ImageCropper } from "./ImageCropper.js";
import { BackgroundSelector } from "./BackgroundSelector.js";
import { ScaleCalculator } from "./ScaleCalculator.js";

export class BackgroundManager {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.currentSource = null;
    this.isFileUpload = false;
    this.modalOptions = { backdrop: "static", keyboard: false, focus: true };
    this.replaceMode = false; // For replacing existing background
    this.changeScaleMode = false; // For changing scale of existing background

    // Keep Bootstrap backdrops from stacking and over-darkening
    this.normalizeBackdrops = function () {
      const backdrops = Array.from(document.querySelectorAll(".modal-backdrop"));
      if (backdrops.length > 1) backdrops.slice(0, -1).forEach((bd) => bd.remove());
      if (backdrops.length > 0) document.body.classList.add("modal-open");
    };

    // Initialize components
    this.cropper = new ImageCropper(this);
    this.sources = new BackgroundSelector(fabricCanvas, this);
    this.scaler = new ScaleCalculator(fabricCanvas, this);

    this.configureBackgroundModals();

    this.setupEventListeners();
  }

  // Ensure all background modals use a static backdrop and ignore ESC
  configureBackgroundModals() {
    const modalIds = ["customModal", "mapModal", "osmModal", "cropModal", "customBackgroundModal", "scaleModal"];

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);
      this.configureModalElement(modal);
    });
  }

  // Configure modal element to use static backdrop and disable keyboard close
  configureModalElement(modal) {
    if (!modal) return;
    modal.setAttribute("data-bs-backdrop", "static");
    modal.setAttribute("data-bs-keyboard", "false");
  }

  // Ensure at least one backdrop exists and body stays locked
  ensureBackdrop() {
    const backdrops = Array.from(document.querySelectorAll(".modal-backdrop"));
    if (backdrops.length === 0) {
      const bd = document.createElement("div");
      bd.className = "modal-backdrop fade show";
      document.body.appendChild(bd);
    }
    document.body.classList.add("modal-open");
  }

  // Get default modal options
  getModalOptions() {
    return { ...this.modalOptions };
  }

  // Get or create a Bootstrap modal instance
  getModalInstance(modal) {
    if (!modal) return null;
    this.configureModalElement(modal);

    const existing = bootstrap.Modal.getInstance(modal);
    if (existing) {
      existing._config.backdrop = "static";
      existing._config.keyboard = false;
      return existing;
    }

    return new bootstrap.Modal(modal, this.getModalOptions());
  }

  // Show modal with consistent backdrop and keyboard handling
  showModal(modal) {
    const instance = this.getModalInstance(modal);
    instance?.show();
    // Ensure exactly one backdrop exists after Bootstrap updates
    setTimeout(() => {
      this.ensureBackdrop();
      this.normalizeBackdrops();
    }, 0);
    return instance;
  }

  // Initialize background components
  initialize() {
    this.sources.initialize();
    this.cropper.initialize();
    this.scaler.initialize();
  }

  // Handle background source selection
  selectSource(sourceType) {
    this.currentSource = sourceType;
    this.sources.handleSourceSelection(sourceType);
  }

  // Process uploaded file
  processFile(source, url) {
    this.isFileUpload = true;
    this.currentSource = source;
    this.cropper.startCropping(url);
  }

  // Handle cropping completion
  onCropComplete(croppedCanvas) {
    this.scaler.startScaling(croppedCanvas);
  }

  // Handle scaling completion
  onScaleComplete(scaledImageData) {
    this.applyBackground(scaledImageData);
  }

  // Apply final background to canvas
  applyBackground(imageData) {
    if (this.changeScaleMode) {
      this.updateBackgroundScale(imageData);
    } else if (this.replaceMode) {
      this.replaceExistingBackground(imageData);
    } else {
      this.addNewBackground(imageData);
    }

    this.closeAllModals();
  }

  // Update background scale
  updateBackgroundScale() {
    // Scale is applied in scale-calculator, just clear the mode
    this.changeScaleMode = false;
  }

  // Replace existing background
  replaceExistingBackground(imageData) {
    const existingBg = this.findExistingBackground();

    if (existingBg) {
      // Match scale and position of existing background
      const targetScaleX = (existingBg.width * existingBg.scaleX) / imageData.width;
      const targetScaleY = (existingBg.height * existingBg.scaleY) / imageData.height;

      this.fabricCanvas.remove(existingBg);

      // Remove from layers array
      if (window.layers && window.layers.background && window.layers.background.objects) {
        window.layers.background.objects = window.layers.background.objects.filter((obj) => obj !== existingBg);
      }

      fabric.Image.fromURL(
        imageData.url,
        (img) => {
          img.set({
            scaleX: targetScaleX,
            scaleY: targetScaleY,
            left: existingBg.left,
            top: existingBg.top,
            selectable: false,
            evented: false,
            hoverCursor: "default",
            isBackground: true,
          });

          this.fabricCanvas.add(img);
          this.fabricCanvas.sendToBack(img);
          this.updateLayers(img);
          this.fabricCanvas.requestRenderAll();
        },
        { crossOrigin: "anonymous" }
      );
    } else {
      // No existing background found, add as new
      this.addNewBackground(imageData);
    }
    this.replaceMode = false;
  }

  // Add new background
  addNewBackground(imageData) {
    // Clear objects and reset canvas
    this.clearCanvasForNewBackground();

    const canvasWidth = this.fabricCanvas.getWidth();
    const canvasHeight = this.fabricCanvas.getHeight();

    // Calculate scale to fit 80% of canvas
    const scale = Math.min(canvasWidth / imageData.width, canvasHeight / imageData.height) * 0.8;

    const left = (canvasWidth - imageData.width * scale) / 2;
    const top = (canvasHeight - imageData.height * scale) / 2;

    fabric.Image.fromURL(
      imageData.url,
      (img) => {
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: left,
          top: top,
          selectable: false,
          evented: false,
          hoverCursor: "default",
          isBackground: true,
        });

        this.fabricCanvas.add(img);
        this.fabricCanvas.sendToBack(img);
        this.updateLayers(img);
        this.fabricCanvas.requestRenderAll();

        // Reset canvas state
        this.resetCanvasState();
      },
      { crossOrigin: "anonymous" }
    );
  }

  // Clear canvas for new background
  clearCanvasForNewBackground() {
    // Remove all objects
    this.fabricCanvas.getObjects().forEach((obj) => {
      this.fabricCanvas.remove(obj);
    });

    // Reset layers
    if (window.layers) {
      window.layers.zones = { objects: [], visible: true, opacity: 1 };
      window.layers.drawings = { objects: [], visible: true, opacity: 1 };
      window.layers.devices = { objects: [], visible: true, opacity: 1 };
      window.layers.background = { objects: [], visible: true, opacity: 1 };
    }

    // Reset device counter
    if (window.deviceCounter !== undefined) {
      window.deviceCounter = 1;
    }

    // Reset zones
    if (window.zones) {
      window.zones = [];
    }

    // Reset zoom and viewport
    this.fabricCanvas.setZoom(1);
    this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  }

  // Reset canvas state
  resetCanvasState() {
    if (typeof window.resetCanvasState === "function") {
      window.resetCanvasState();
    }
  }

  // Find existing background image
  findExistingBackground() {
    return this.fabricCanvas.getObjects().find((obj) => {
      const isImage = obj.type === "image";
      const isBg = obj.isBackground || (!obj.selectable && !obj.evented);
      return isImage && isBg;
    });
  }

  // Update canvas layers
  updateLayers(backgroundImage) {
    if (window.layers && window.layers.background) {
      window.layers.background.objects.push(backgroundImage);
    }
  }

  // Close all background modals
  closeAllModals() {
    const modalIds = ["customModal", "mapModal", "osmModal", "cropModal", "customBackgroundModal", "scaleModal"];

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal?.classList.contains("show")) {
        bootstrap.Modal.getInstance(modal)?.hide();
      }
    });

    // Clean up stacked backdrops
    this.normalizeBackdrops();

    // Remove any remaining backdrops
    setTimeout(() => {
      document.querySelectorAll(".modal-backdrop").forEach((bd) => bd.remove());
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }, 300);

    // Reset UI state
    this.resetState();
  }

  // Reset internal state
  resetState() {
    this.currentSource = null;
    this.isFileUpload = false;
  }

  // Setup global event listeners
  setupEventListeners() {
    // Prevent escape key from closing modals during background process
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && this.isInBackgroundProcess()) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      },
      true
    );
  }

  // Check if in background creation process
  isInBackgroundProcess() {
    const modalIds = ["customModal", "mapModal", "osmModal", "cropModal", "customBackgroundModal", "scaleModal"];
    return modalIds.some((id) => document.getElementById(id)?.classList.contains("show"));
  }

  // Update step indicators in modals
  updateStepIndicators(activeStep) {
    const visibleModalId = this.getVisibleModal();
    if (!visibleModalId) return;

    const steps = document.getElementById(visibleModalId)?.querySelectorAll(".modal-header-center .step");
    steps?.forEach((step, index) => {
      step.classList.remove("active", "finish");
      if (index + 1 === activeStep) {
        step.classList.add("active");
      } else if (index + 1 < activeStep) {
        step.classList.add("finish");
      }
    });
  }

  // Get currently visible modal
  getVisibleModal() {
    const modalIds = ["customModal", "mapModal", "osmModal", "cropModal", "customBackgroundModal", "scaleModal"];
    return modalIds.find((id) => document.getElementById(id)?.classList.contains("show"));
  }

  // Handle replace background functionality
  setupReplaceBackground() {
    const replaceBtn = document.getElementById("replace-background-btn");
    if (replaceBtn) {
      replaceBtn.addEventListener("click", () => {
        const existingBg = this.findExistingBackground();
        if (!existingBg) {
          alert("No background found. Please add a background first.");
          return;
        }

        this.replaceMode = true;
        const mainModal = document.getElementById("customModal");
        this.showModal(mainModal);
      });
    }
  }

  // Handle change scale functionality
  setupChangeScale() {
    const changeScaleBtn = document.getElementById("change-scale-btn");
    if (changeScaleBtn) {
      changeScaleBtn.addEventListener("click", () => {
        const existingBg = this.findExistingBackground();
        if (!existingBg || !existingBg._element) {
          alert("No background found. Please add a background first.");
          return;
        }

        // Create snapshot of current background
        const snapshotCanvas = this.createBackgroundSnapshot(existingBg);

        this.changeScaleMode = true;
        const scaleModal = document.getElementById("scaleModal");
        this.showModal(scaleModal);

        setTimeout(() => {
          this.scaler.startScaling(snapshotCanvas);
        }, 50);
      });
    }
  }

  // Create snapshot of background for scaling
  createBackgroundSnapshot(backgroundImage) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const scaleX = backgroundImage.scaleX || 1;
    const scaleY = backgroundImage.scaleY || 1;
    const width = Math.max(1, Math.floor(backgroundImage.width * scaleX));
    const height = Math.max(1, Math.floor(backgroundImage.height * scaleY));

    canvas.width = width;
    canvas.height = height;

    try {
      ctx.drawImage(backgroundImage._element, 0, 0, backgroundImage.width, backgroundImage.height, 0, 0, width, height);
    } catch (error) {
      console.warn("Failed to create background snapshot:", error);
    }

    return canvas;
  }
}
