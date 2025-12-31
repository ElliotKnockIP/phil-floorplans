// Sets up screenshot cropping with Cropper.js
export class ScreenshotCropper {
  constructor(fabricCanvas, subSidebar) {
    this.fabricCanvas = fabricCanvas;
    this.subSidebar = subSidebar;
    this.elements = {
      modal: document.getElementById("cropScreenshotModal"),
      preview: document.getElementById("crop-screenshot-preview"),
      confirmBtn: document.getElementById("crop-confirm-screenshot-btn"),
      previews: document.getElementById("screenshot-previews"),
      template: document.getElementById("screenshot-preview-template"),
    };
    this.cropperInstance = null;
    this.currentCanvasDataURL = null;
    this.cropModalInstance = null;
    this.screenshots = [];
    this.init();
  }

  // Initialize Bootstrap modal and event listeners
  init() {
    if (this.elements.modal && typeof bootstrap !== "undefined") {
      this.cropModalInstance = new bootstrap.Modal(this.elements.modal, { backdrop: "static" });
    }

    // Close modal on button click
    this.elements.modal?.querySelector(".btn-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeModal();
    });

    if (this.elements.modal) {
      // Reset cropper and show sidebar when modal is hidden
      this.elements.modal.addEventListener("hidden.bs.modal", () => {
        this.resetCropper();
        if (this.subSidebar) this.subSidebar.classList.remove("hidden");
      });
      // Resize cropper when modal is shown
      this.elements.modal.addEventListener("shown.bs.modal", () => {
        if (this.cropperInstance) setTimeout(() => this.cropperInstance.resize(), 100);
      });
    }
  }

  // Initialize Cropper.js on the preview image
  initCropper() {
    if (this.cropperInstance) this.cropperInstance.destroy();
    setTimeout(() => {
      this.cropperInstance = new Cropper(this.elements.preview, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 0.8,
        responsive: true,
        background: true,
        movable: true,
        zoomable: true,
        scalable: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        wheelZoomRatio: 0.1,
        checkOrientation: false,
        ready: () => this.cropperInstance.resize(),
      });
    }, 300);
  }

  // Destroy cropper instance and clear preview image
  resetCropper() {
    if (this.cropperInstance) {
      this.cropperInstance.destroy();
      this.cropperInstance = null;
    }
    if (this.elements.preview) {
      this.elements.preview.src = "";
      this.elements.preview.removeAttribute("src");
      this.elements.preview.onload = this.elements.preview.onerror = null;
    }
  }

  // Show the crop modal and load the canvas screenshot
  showModal() {
    if (this.subSidebar) this.subSidebar.classList.add("hidden");
    this.resetCropper();

    if (this.elements.preview) {
      this.elements.preview.onload = () => {
        this.elements.preview.onerror = null;
        this.initCropper();
        this.elements.preview.onload = null;
      };
      this.elements.preview.onerror = () => {
        if (!this.currentCanvasDataURL) console.warn("Screenshot load aborted");
        else alert("Failed to load screenshot. Please try again.");
        this.elements.preview.onload = this.elements.preview.onerror = null;
      };
      this.elements.preview.src = this.currentCanvasDataURL;
    }
    if (this.cropModalInstance) this.cropModalInstance.show();
  }

  // Hide the crop modal and restore sidebar
  closeModal() {
    if (this.cropModalInstance) this.cropModalInstance.hide();
    this.resetCropper();
    if (this.subSidebar) this.subSidebar.classList.remove("hidden");
  }

  // Create a preview item for the captured screenshot in the UI
  createPreview(screenshot) {
    if (!this.elements.previews || !this.elements.template?.content) return;

    const container = this.elements.template.content.cloneNode(true);
    const previewItem = container.querySelector(".screenshot-preview-item");
    if (!previewItem) return;

    const img = previewItem.querySelector(".screenshot-image");
    const checkbox = previewItem.querySelector(".screenshot-checkbox");
    const label = previewItem.querySelector(".screenshot-checkbox-label");
    const titleTextarea = previewItem.querySelector(".screenshot-title");
    const deleteBtn = previewItem.querySelector(".screenshot-delete-btn");

    if (img) {
      img.src = screenshot.dataURL;
      img.alt = `Screenshot ${this.screenshots.length}`;
    }

    if (checkbox) {
      checkbox.id = `screenshot-${screenshot.id}`;
      checkbox.checked = screenshot.includeInPrint || false;
      checkbox.addEventListener("change", () => (screenshot.includeInPrint = checkbox.checked));
    }

    if (label && checkbox) label.setAttribute("for", checkbox.id);
    if (titleTextarea && screenshot.title) titleTextarea.value = screenshot.title;

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const index = this.screenshots.indexOf(screenshot);
        if (index > -1) {
          this.screenshots.splice(index, 1);
          previewItem.remove();
          setTimeout(() => window.updateScreenshotStatus?.(), 100);
        }
      });
    }

    this.elements.previews.appendChild(container);
    setTimeout(() => window.updateScreenshotStatus?.(), 100);
  }

  // Process the cropped image for download or report inclusion
  handleCrop(type) {
    const croppedCanvas = this.cropperInstance?.getCroppedCanvas({
      width: 1200,
      height: "auto",
      minWidth: 800,
      maxWidth: 2400,
      fillColor: "#ffffff",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    if (!croppedCanvas) return;

    if (type === "download") {
      const croppedDataURL = croppedCanvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.href = croppedDataURL;
      link.download = "floorplan.png";
      link.click();
    } else {
      // Save as JPEG for report to keep file size manageable
      const croppedDataURL = croppedCanvas.toDataURL("image/jpeg", 0.7);
      this.screenshots.push({
        dataURL: croppedDataURL,
        includeInPrint: false,
        id: Date.now() + Math.random(),
      });
      this.createPreview(this.screenshots[this.screenshots.length - 1]);
    }
    this.closeModal();
  }

  // Capture canvas and start cropping for image download
  startCropForDownload() {
    document.getElementById("select-background-popup")?.style.setProperty("display", "none");
    this.fabricCanvas.renderAll();
    this.currentCanvasDataURL = this.fabricCanvas.toDataURL({
      format: "png",
      multiplier: 3,
      quality: 1.0,
    });
    this.showModal();
    if (this.elements.confirmBtn) this.elements.confirmBtn.onclick = () => this.handleCrop("download");
  }

  // Capture canvas and start cropping for report screenshot
  startCropForScreenshot() {
    document.getElementById("select-background-popup")?.style.setProperty("display", "none");
    this.fabricCanvas.renderAll();
    this.currentCanvasDataURL = this.fabricCanvas.toDataURL({
      format: "png",
      multiplier: 3,
      quality: 1.0,
    });
    this.showModal();
    if (this.elements.confirmBtn) this.elements.confirmBtn.onclick = () => this.handleCrop("screenshot");
  }

  // Cancel the current cropping operation
  cancelCrop() {
    this.closeModal();
  }

  // Reset cropper to initial state
  resetCrop() {
    this.cropperInstance?.reset();
  }

  // Return the list of captured screenshots
  getScreenshots() {
    return this.screenshots;
  }

  // Clear all captured screenshots from memory and UI
  clearScreenshots() {
    this.screenshots.length = 0;
    this.elements.previews && (this.elements.previews.innerHTML = "");
  }
}

// Initialize the screenshot cropper module
export function initCanvasCrop(fabricCanvas, subSidebar) {
  return new ScreenshotCropper(fabricCanvas, subSidebar);
}
