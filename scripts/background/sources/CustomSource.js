// Custom Source Handler handles custom colored background creation

export class CustomSourceHandler {
  constructor(manager) {
    this.manager = manager;

    // Custom background related elements
    this.customElements = {
      customBackgroundModal: document.getElementById("customBackgroundModal"),
      customBackBtn: document.getElementById("custom-back-btn"),
      customNextBtn: document.getElementById("custom-next-btn"),
      customWidthInput: document.getElementById("custom-width"),
      customHeightInput: document.getElementById("custom-height"),
      customColorSelect: document.getElementById("custom-colour"),
      customPreviewWrapper: document.getElementById("custom-style-container"),
      customPreviewCanvas: document.getElementById("custom-preview-canvas"),
    };

    this.previewCanvas = null;
    this.customBackgroundRect = null;
    this.resizeObserver = null;
  }

  // Setup event listeners for custom background creation
  setupCustomHandlers() {
    if (this.customElements.customBackBtn) {
      this.customElements.customBackBtn.addEventListener("click", () => this.handleCustomBack());
    }

    if (this.customElements.customNextBtn) {
      this.customElements.customNextBtn.addEventListener("click", () => this.handleCustomNext());
    }

    if (this.customElements.customWidthInput) {
      this.customElements.customWidthInput.addEventListener("input", () => this.updateCustomPreview());
    }

    if (this.customElements.customHeightInput) {
      this.customElements.customHeightInput.addEventListener("input", () => this.updateCustomPreview());
    }

    if (this.customElements.customColorSelect) {
      this.customElements.customColorSelect.addEventListener("change", () => this.updateCustomPreview());
    }

    if (this.customElements.customBackgroundModal) {
      this.customElements.customBackgroundModal.addEventListener("hidden.bs.modal", () => {
        this.cleanupCustomPreview();
        this.manager.normalizeBackdrops();
      });
      this.customElements.customBackgroundModal.addEventListener("shown.bs.modal", () => {
        this.initializeCustomPreview();
      });
    }

    // Handle window resize for preview canvas
    window.addEventListener("resize", () => {
      if (this.previewCanvas && this.customElements.customBackgroundModal?.classList.contains("show")) {
        clearTimeout(window.customCanvasResizeTimeout);
        window.customCanvasResizeTimeout = setTimeout(() => this.resizeCustomCanvas(), 100);
      }
    });
  }

  // Show custom background modal and initialize preview
  showCustomModal() {
    this.manager.normalizeBackdrops();
    this.manager.showModal(this.customElements.customBackgroundModal);

    this.initializeCustomPreview();
    this.manager.updateStepIndicators(1);
  }

  // Initialize custom preview canvas with container dimensions
  initializeCustomPreview() {
    this.cleanupCustomPreview();

    if (!this.customElements.customPreviewWrapper || !this.customElements.customPreviewCanvas) return;

    setTimeout(() => {
      const containerRect = this.customElements.customPreviewWrapper.getBoundingClientRect();
      const containerWidth = containerRect.width || 600;
      const containerHeight = containerRect.height || 400;
      const canvasWidth = Math.max(containerWidth - 20, 300);
      const canvasHeight = Math.max(containerHeight - 20, 200);

      this.customElements.customPreviewCanvas.width = canvasWidth;
      this.customElements.customPreviewCanvas.height = canvasHeight;
      this.customElements.customPreviewCanvas.style.width = canvasWidth + "px";
      this.customElements.customPreviewCanvas.style.height = canvasHeight + "px";

      this.previewCanvas = new fabric.Canvas("custom-preview-canvas", {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: "#f5f5f5",
      });

      this.setupResizeObserver();
      this.updateCustomPreview();
    }, 100);
  }

  // Resize custom preview canvas to match container
  resizeCustomCanvas() {
    if (!this.previewCanvas || !this.customElements.customPreviewWrapper) return;

    const containerRect = this.customElements.customPreviewWrapper.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const canvasWidth = Math.max(containerRect.width - 20, 300);
    const canvasHeight = Math.max(containerRect.height - 20, 200);

    this.customElements.customPreviewCanvas.width = canvasWidth;
    this.customElements.customPreviewCanvas.height = canvasHeight;
    this.customElements.customPreviewCanvas.style.width = canvasWidth + "px";
    this.customElements.customPreviewCanvas.style.height = canvasHeight + "px";

    this.previewCanvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    this.updateCustomPreview();
  }

  // Update custom preview rectangle based on inputs
  updateCustomPreview() {
    const { customWidthInput, customHeightInput, customColorSelect } = this.customElements;

    if (!this.previewCanvas || !customWidthInput || !customHeightInput || !customColorSelect) {
      return;
    }

    const width = parseInt(this.customElements.customWidthInput.value) || 800;
    const height = parseInt(this.customElements.customHeightInput.value) || 600;
    const color = this.customElements.customColorSelect.value;

    const canvasWidth = this.previewCanvas.getWidth();
    const canvasHeight = this.previewCanvas.getHeight();
    const scale = Math.min(canvasWidth / width, canvasHeight / height, 1);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const left = (canvasWidth - scaledWidth) / 2;
    const top = (canvasHeight - scaledHeight) / 2;

    if (this.customBackgroundRect) {
      this.previewCanvas.remove(this.customBackgroundRect);
    }

    this.customBackgroundRect = new fabric.Rect({
      left,
      top,
      width,
      height,
      scaleX: scale,
      scaleY: scale,
      fill: color,
      selectable: false,
      evented: false,
      hoverCursor: "default",
    });

    this.previewCanvas.add(this.customBackgroundRect);
    this.previewCanvas.sendToBack(this.customBackgroundRect);
    this.previewCanvas.requestRenderAll();
  }

  // Setup resize observer for custom preview container
  setupResizeObserver() {
    if (!this.customElements.customPreviewWrapper || this.resizeObserver) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === this.customElements.customPreviewWrapper && this.previewCanvas) {
          clearTimeout(window.customCanvasResizeTimeout);
          window.customCanvasResizeTimeout = setTimeout(() => this.resizeCustomCanvas(), 100);
        }
      }
    });
    this.resizeObserver.observe(this.customElements.customPreviewWrapper);
  }

  // Handle back button and return to main selection
  handleCustomBack() {
    bootstrap.Modal.getInstance(this.customElements.customBackgroundModal)?.hide();
    this.cleanupCustomPreview();

    this.manager.normalizeBackdrops();
    this.manager.showModal(document.getElementById("customModal"));
    this.manager.updateStepIndicators(1);
  }

  // Handle next button and generate custom background image
  handleCustomNext() {
    const width = parseInt(this.customElements.customWidthInput.value) || 800;
    const height = parseInt(this.customElements.customHeightInput.value) || 600;
    const color = this.customElements.customColorSelect.value;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/png");

    bootstrap.Modal.getInstance(this.customElements.customBackgroundModal)?.hide();
    this.manager.selectSource("custom");
    this.manager.cropper.startCropping(dataUrl);
    this.manager.updateStepIndicators(2);
  }

  // Cleanup custom preview resources
  cleanupCustomPreview() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.previewCanvas) {
      this.previewCanvas.clear();
      this.previewCanvas.dispose();
      this.previewCanvas = null;
    }

    this.customBackgroundRect = null;

    if (window.customCanvasResizeTimeout) {
      clearTimeout(window.customCanvasResizeTimeout);
      window.customCanvasResizeTimeout = null;
    }
  }
}
