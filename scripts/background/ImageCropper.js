// Image Cropper handles image cropping functionality

export class ImageCropper {
  constructor(manager) {
    this.manager = manager;
    this.cropper = null;
    this.currentImageUrl = null;
    this.savedCropData = null;
    this.isReady = false;
    this.originalNextBtnHTML = "Next";

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
  }

  // Initialize cropper modal and listeners
  initialize() {
    if (this.elements.cropNextBtn) {
      this.originalNextBtnHTML = this.elements.cropNextBtn.innerHTML || "Next";
    }
    this.setupEventListeners();
  }

  // Setup event listeners for buttons and modal
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
    this.isReady = false;

    // Disable next button until cropper is ready
    if (this.elements.cropNextBtn) {
      this.elements.cropNextBtn.disabled = true;
      this.elements.cropNextBtn.innerHTML = "Loading...";
    }

    this.manager.normalizeBackdrops();
    this.manager.showModal(this.elements.cropModal);

    // Ensure only one backdrop remains after show
    setTimeout(() => this.manager.normalizeBackdrops(), 0);

    this.loadImageForCropping(imageUrl);
    this.manager.updateStepIndicators(2);
  }

  // Load image into cropper element
  loadImageForCropping(imageUrl) {
    if (this.elements.croppableImage) {
      this.elements.croppableImage.onload = () => {
        this.initializeCropper();
        this.elements.croppableImage.onload = null;
      };
      this.elements.croppableImage.src = imageUrl;
    }
  }

  // Initialize Cropper.js instance
  initializeCropper() {
    if (this.timers.cropperTimeout) clearTimeout(this.timers.cropperTimeout);
    this.destroyCropper();
    this.isReady = false;

    const isMapSource = this.manager.currentSource === "map" || this.manager.currentSource === "maps" || this.manager.currentSource === "osm";
    const initCropperInstance = () => {
      this.cropper = new Cropper(this.elements.croppableImage, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 0.9,
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
          this.isReady = true;
          if (this.elements.cropNextBtn) {
            this.elements.cropNextBtn.disabled = false;
            this.elements.cropNextBtn.innerHTML = this.originalNextBtnHTML;
          }
        },
      });
    };

    // Delay initialization for data URLs
    const needsDelay = this.currentImageUrl.startsWith("data:");
    if (needsDelay) {
      this.timers.cropperTimeout = setTimeout(initCropperInstance, 300);
    } else {
      initCropperInstance();
    }
  }

  // Refresh cropper layout when modal is shown or resized
  refreshCropperLayout(maxRetries = 10, delay = 100) {
    if (this.timers.refreshRetryTimeout) clearTimeout(this.timers.refreshRetryTimeout);
    if (!this.cropper || !this.elements.croppableImage) return;

    const isVisible = this.elements.croppableImage.isConnected && this.elements.croppableImage.offsetParent !== null;
    const hasSize = this.elements.croppableImage.clientWidth > 0 && this.elements.croppableImage.clientHeight > 0;

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

  // Handle back button and return to source selection
  handleBack() {
    this.cleanupTimers();
    this.destroyCropper();

    // Hide crop modal
    bootstrap.Modal.getInstance(this.elements.cropModal)?.hide();

    // Determine which modal to return to
    const sourceModalMap = {
      file: "customModal",
      pdf: "customModal",
      custom: "customBackgroundModal",
      map: "mapModal",
      maps: "mapModal",
      osm: "osmModal",
    };

    const targetModalId = sourceModalMap[this.manager.currentSource];
    if (targetModalId) {
      const targetModal = document.getElementById(targetModalId);
      if (targetModal) {
        this.manager.normalizeBackdrops();
        this.manager.showModal(targetModal);
        setTimeout(() => this.manager.normalizeBackdrops(), 0);
      }
    }

    this.manager.updateStepIndicators(1);
  }

  // Handle next button and process cropped image
  handleNext() {
    if (!this.isReady || !this.cropper) return;

    // Save crop data
    this.savedCropData = this.cropper.getData();

    // Get cropped canvas
    const croppedCanvas = this.cropper.getCroppedCanvas({
      imageSmoothingEnabled: false,
    });

    if (!croppedCanvas) {
      alert("Error processing crop. Please try again.");
      return;
    }

    // Hide crop modal
    bootstrap.Modal.getInstance(this.elements.cropModal)?.hide();

    // Cleanup
    this.cleanupTimers();
    this.destroyCropper();
    this.clearImage();

    // Pass to manager for scaling
    this.manager.onCropComplete(croppedCanvas);
  }

  // Restore crop modal with saved state
  restoreCropModal() {
    if (!this.currentImageUrl) return false;

    this.manager.showModal(this.elements.cropModal);

    // Disable next button until cropper is ready
    if (this.elements.cropNextBtn) {
      this.elements.cropNextBtn.disabled = true;
      this.elements.cropNextBtn.innerHTML = "Loading...";
    }

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

  // Cleanup all active timers
  cleanupTimers() {
    Object.values(this.timers).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
  }

  // Destroy cropper instance safely
  destroyCropper() {
    if (this.cropper) {
      try {
        this.cropper.destroy();
      } catch (error) {
        // Ignore destroy errors
      }
      this.cropper = null;
    }
  }

  // Clear image element
  clearImage() {
    if (this.elements.croppableImage) {
      this.elements.croppableImage.src = "";
      this.elements.croppableImage.removeAttribute("src");
      this.elements.croppableImage.onload = null;
    }
  }

  // Reset cropper state and cleanup
  resetState(preserveSavedData = false) {
    this.cleanupTimers();
    this.destroyCropper();
    this.clearImage();
    this.isReady = false;

    if (!preserveSavedData) {
      this.currentImageUrl = null;
      this.savedCropData = null;
    }
  }
}
