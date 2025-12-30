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

  init() {
    // Set up Bootstrap modal
    if (this.elements.modal && typeof bootstrap !== "undefined") {
      this.cropModalInstance = new bootstrap.Modal(this.elements.modal);
    }

    // Set up event listeners
    this.elements.modal?.querySelector(".btn-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeModal();
    });

    if (this.elements.modal) {
      this.elements.modal.addEventListener("hidden.bs.modal", () => {
        this.resetCropper();
        if (this.subSidebar) this.subSidebar.classList.remove("hidden");
      });
      this.elements.modal.addEventListener("shown.bs.modal", () => {
        if (this.cropperInstance) setTimeout(() => this.cropperInstance.resize(), 100);
      });
      this.elements.modal.addEventListener("click", (e) => {
        if (e.target === this.elements.modal) this.closeModal();
      });
    }
  }

  // Creates the Cropper.js instance
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

  // Cleans up cropper and preview
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

  // Shows the crop modal
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

  // Hides the crop modal
  closeModal() {
    if (this.cropModalInstance) this.cropModalInstance.hide();
    this.resetCropper();
    if (this.subSidebar) this.subSidebar.classList.remove("hidden");
  }

  // Creates a preview item for a screenshot
  createPreview(screenshot) {
    if (!this.elements.previews) return;

    let previewItem;

    // Try template first
    if (this.elements.template?.content) {
      try {
        const container = this.elements.template.content.cloneNode(true);
        previewItem = container.querySelector(".screenshot-preview-item");
        if (previewItem) {
          const img = previewItem.querySelector(".screenshot-image");
          const checkbox = previewItem.querySelector(".screenshot-checkbox");
          const label = previewItem.querySelector(".screenshot-checkbox-label");

          if (img) {
            img.src = screenshot.dataURL;
            img.alt = `Screenshot ${this.screenshots.length}`;
          }
          if (checkbox) checkbox.id = `screenshot-${screenshot.id}`;
          if (label && checkbox) label.setAttribute("for", checkbox.id);
          this.elements.previews.appendChild(container);
        }
      } catch (e) {
        previewItem = this.createManualPreview(screenshot);
      }
    } else {
      previewItem = this.createManualPreview(screenshot);
    }

    // Add event listeners
    if (previewItem) {
      const checkbox = previewItem.querySelector(".screenshot-checkbox");
      const deleteBtn = previewItem.querySelector(".screenshot-delete-btn");

      if (checkbox)
        checkbox.addEventListener("change", () => (screenshot.includeInPrint = checkbox.checked));
      if (deleteBtn)
        deleteBtn.addEventListener("click", () => {
          const index = this.screenshots.indexOf(screenshot);
          if (index > -1) {
            this.screenshots.splice(index, 1);
            previewItem.remove();
            setTimeout(() => window.updateScreenshotStatus?.(), 100);
          }
        });
      setTimeout(() => window.updateScreenshotStatus?.(), 100);
    }
  }

  // Creates preview manually when no template exists
  createManualPreview(screenshot) {
    const previewItem = document.createElement("div");
    previewItem.className = "screenshot-preview-item";

    // Create image
    const img = document.createElement("img");
    img.className = "screenshot-image";
    img.src = screenshot.dataURL;
    img.alt = `Screenshot ${this.screenshots.length}`;
    img.style.cssText = "width: 100%; height: auto; margin-bottom: 10px;";

    // Create controls
    const controls = document.createElement("div");
    controls.className = "screenshot-controls";
    controls.style.cssText = "display: flex; flex-direction: column; gap: 5px;";

    // Checkbox with label
    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "screenshot-checkbox-label";
    checkboxLabel.style.cssText = "display: flex; align-items: center; gap: 5px;";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "screenshot-checkbox";
    checkbox.id = `screenshot-${screenshot.id}`;

    const checkboxText = document.createElement("span");
    checkboxText.textContent = "Include in print";

    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxText);

    // Title textarea
    const titleTextarea = document.createElement("textarea");
    titleTextarea.className = "screenshot-title";
    titleTextarea.placeholder = "Title or Description";
    titleTextarea.maxLength = 74;
    titleTextarea.style.cssText = "width: 100%; min-height: 40px; resize: vertical;";

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "screenshot-delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.style.cssText =
      "padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;";

    // Assemble
    controls.appendChild(checkboxLabel);
    controls.appendChild(titleTextarea);
    controls.appendChild(deleteBtn);
    previewItem.appendChild(img);
    previewItem.appendChild(controls);
    this.elements.previews.appendChild(previewItem);

    return previewItem;
  }

  // Handles the crop action
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
      // Download the cropped image
      const link = document.createElement("a");
      link.href = croppedDataURL;
      link.download = "floorplan.png";
      link.click();
    } else {
      // Save as screenshot preview - use JPEG for smaller JSON size
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

  // Public API methods
  startCropForDownload() {
    document.getElementById("select-background-popup")?.style.setProperty("display", "none");
    this.fabricCanvas.renderAll();
    this.currentCanvasDataURL = this.fabricCanvas.toDataURL({
      format: "png",
      multiplier: 3,
      quality: 1.0,
    });
    this.showModal();
    if (this.elements.confirmBtn)
      this.elements.confirmBtn.onclick = () => this.handleCrop("download");
  }

  startCropForScreenshot() {
    document.getElementById("select-background-popup")?.style.setProperty("display", "none");
    this.fabricCanvas.renderAll();
    this.currentCanvasDataURL = this.fabricCanvas.toDataURL({
      format: "png",
      multiplier: 3,
      quality: 1.0,
    });
    this.showModal();
    if (this.elements.confirmBtn)
      this.elements.confirmBtn.onclick = () => this.handleCrop("screenshot");
  }

  cancelCrop() {
    this.closeModal();
  }

  resetCrop() {
    this.cropperInstance?.reset();
  }

  getScreenshots() {
    return this.screenshots;
  }

  clearScreenshots() {
    this.screenshots.length = 0;
    this.elements.previews && (this.elements.previews.innerHTML = "");
  }
}

// Wrapper function for backward compatibility
export function initCanvasCrop(fabricCanvas, subSidebar) {
  return new ScreenshotCropper(fabricCanvas, subSidebar);
}
