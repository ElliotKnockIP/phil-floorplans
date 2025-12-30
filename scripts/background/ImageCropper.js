// Image Cropper - Handles image cropping functionality
// Provides an interface to crop background images before scaling

export class ImageCropper {
  constructor(fabricCanvas, manager) {
    this.fabricCanvas = fabricCanvas;
    this.manager = manager;
    this.cropper = null;
    this.currentImageUrl = null;
    this.savedCropData = null;

    // DOM elements
    this.elements = {
      cropModal: document.getElementById("cropModal"),
      cropBackBtn: document.getElementById("crop-back-btn"),
      cropNextBtn: document.getElementById("crop-next-btn"),
      croppableImage: document.getElementById("croppable-image"),
    };

    // Timers for cleanup
    this.timers = {
      cropperTimeout: null,
      modalShownTimeout: null,
      refreshRetryTimeout: null,
    };

    // Helper to prevent stacked backdrops causing dark flicker
    this.normalizeBackdrops = function () {
      const backdrops = Array.from(document.querySelectorAll(".modal-backdrop"));
      if (backdrops.length > 1) backdrops.slice(0, -1).forEach((bd) => bd.remove());
      if (backdrops.length > 0) document.body.classList.add("modal-open");
    };
  }

  // Initialize the cropper modal
  initialize() {
    this.setupEventListeners();
  }

  // Setup event listeners
  setupEventListeners() {
    if (this.elements.cropBackBtn) {
      this.elements.cropBackBtn.addEventListener("click", () => this.handleBack());
    }

    if (this.elements.cropNextBtn) {
      this.elements.cropNextBtn.addEventListener("click", () => this.handleNext());
    }

    if (this.elements.cropModal) {
      this.elements.cropModal.addEventListener("shown.bs.modal", () => {
        if (this.timers.modalShownTimeout) clearTimeout(this.timers.modalShownTimeout);
        this.timers.modalShownTimeout = setTimeout(() => {
          if (this.cropper) this.refreshCropperLayout();
        }, 100);
      });
    }
  }

  // Start cropping process with an image URL
  startCropping(imageUrl) {
    this.currentImageUrl = imageUrl;
    this.savedCropData = null;

    this.normalizeBackdrops();
    this.manager.showModal(this.elements.cropModal);

    // Clean backdrops after show is queued to ensure only one remains
    setTimeout(() => this.normalizeBackdrops(), 0);

    this.loadImageForCropping(imageUrl);
    this.manager.updateStepIndicators(2);
  }

  // Load image into cropper
  loadImageForCropping(imageUrl) {
    if (this.elements.croppableImage) {
      this.elements.croppableImage.onload = () => {
        this.initializeCropper();
        this.elements.croppableImage.onload = null;
      };
      this.elements.croppableImage.src = imageUrl;
    }
  }

  // Initialize the Cropper.js instance
  initializeCropper() {
    if (this.timers.cropperTimeout) clearTimeout(this.timers.cropperTimeout);
    if (this.cropper) this.cropper.destroy();

    this.cropper = null;

    const isMapSource =
      this.manager.currentSource === "map" || this.manager.currentSource === "maps";
    const initCropperInstance = () => {
      this.cropper = new Cropper(this.elements.croppableImage, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: isMapSource ? 1 : 0.8,
        responsive: true,
        background: true,
        movable: true,
        zoomable: true,
        scalable: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        ready: () => {
          this.refreshCropperLayout();
          if (this.savedCropData && this.cropper) {
            this.cropper.setData(this.savedCropData);
          }
        },
      });
    };

    // Handle data URLs which may need delay
    const needsDelay = this.currentImageUrl.startsWith("data:");
    if (needsDelay) {
      this.timers.cropperTimeout = setTimeout(initCropperInstance, 300);
    } else {
      initCropperInstance();
    }
  }

  // Refresh cropper layout when modal is shown
  refreshCropperLayout(maxRetries = 10, delay = 100) {
    if (this.timers.refreshRetryTimeout) clearTimeout(this.timers.refreshRetryTimeout);
    if (!this.cropper || !this.elements.croppableImage) return;

    const isVisible =
      this.elements.croppableImage.isConnected &&
      this.elements.croppableImage.offsetParent !== null;
    const hasSize =
      this.elements.croppableImage.clientWidth > 0 && this.elements.croppableImage.clientHeight > 0;

    if (!isVisible || !hasSize) {
      if (maxRetries > 0) {
        this.timers.refreshRetryTimeout = setTimeout(() => {
          this.refreshCropperLayout(maxRetries - 1, delay);
        }, delay);
      }
      return;
    }

    try {
      const currentData = this.savedCropData || this.cropper.getData();
      this.cropper.reset();
      if (currentData) this.cropper.setData(currentData);
    } catch (error) {
      try {
        this.cropper.render?.();
      } catch (renderError) {
        // Ignore render errors
      }
    }
  }

  // Handle back button - return to source selection
  handleBack() {
    this.cleanupTimers();

    if (this.cropper) {
      try {
        this.cropper.destroy();
      } catch (error) {
        // Ignore destroy errors
      }
      this.cropper = null;
    }

    // Hide crop modal
    bootstrap.Modal.getInstance(this.elements.cropModal)?.hide();

    // Determine which modal to return to
    const sourceModalMap = {
      file: "customModal",
      pdf: "customModal",
      custom: "customBackgroundModal",
      map: "mapModal",
      maps: "mapModal",
    };

    const targetModalId = sourceModalMap[this.manager.currentSource];
    if (targetModalId) {
      const targetModal = document.getElementById(targetModalId);
      if (targetModal) {
        this.normalizeBackdrops();
        this.manager.showModal(targetModal);
        setTimeout(() => this.normalizeBackdrops(), 0);
      }
    }

    this.manager.updateStepIndicators(1);
  }

  // Handle next button - process cropped image
  handleNext() {
    if (!this.cropper) return;

    // Save crop data
    this.savedCropData = this.cropper.getData();

    // Get cropped canvas
    const croppedCanvas = this.cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    if (!croppedCanvas) {
      alert("Error processing crop. Please try again.");
      return;
    }

    // Hide crop modal
    bootstrap.Modal.getInstance(this.elements.cropModal)?.hide();

    // Cleanup
    this.cleanupTimers();
    if (this.cropper) {
      try {
        this.cropper.destroy();
      } catch (error) {
        // Ignore destroy errors
      }
      this.cropper = null;
    }

    // Clear image
    if (this.elements.croppableImage) {
      this.elements.croppableImage.src = "";
      this.elements.croppableImage.removeAttribute("src");
    }

    // Pass to manager for scaling
    this.manager.onCropComplete(croppedCanvas);
  }

  // Restore crop modal with saved state
  restoreCropModal() {
    if (!this.currentImageUrl) return false;

    this.manager.showModal(this.elements.cropModal);

    if (this.elements.croppableImage) {
      if (this.elements.croppableImage.src !== this.currentImageUrl) {
        this.elements.croppableImage.onload = () => {
          this.initializeCropper();
          this.elements.croppableImage.onload = null;
        };
        this.elements.croppableImage.src = this.currentImageUrl;
      } else {
        this.initializeCropper();
      }
    }

    this.manager.updateStepIndicators(2);
    return true;
  }

  // Get current cropped canvas
  getCroppedCanvas() {
    if (!this.cropper) return null;

    return this.cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  }

  // Cleanup timers
  cleanupTimers() {
    Object.values(this.timers).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
  }

  // Reset cropper state
  resetState(preserveSavedData = false) {
    this.cleanupTimers();

    if (this.cropper) {
      try {
        this.cropper.destroy();
      } catch (error) {
        // Ignore destroy errors
      }
      this.cropper = null;
    }

    if (this.elements.croppableImage) {
      this.elements.croppableImage.src = "";
      this.elements.croppableImage.removeAttribute("src");
      this.elements.croppableImage.onload = null;
    }

    if (!preserveSavedData) {
      this.currentImageUrl = null;
      this.savedCropData = null;
    }
  }
}
