export function initCanvasCrop(fabricCanvas, subSidebar) {
  const cropModal = document.getElementById("cropScreenshotModal");
  const cropPreviewImage = document.getElementById("crop-screenshot-preview");
  const cropConfirmBtn = document.getElementById("crop-confirm-screenshot-btn");

  let cropperInstance = null;
  let currentCanvasDataURL = null;
  let cropModalInstance = null;
  const screenshots = []; // Store screenshots for print inclusion

  // Initialize Bootstrap Modal instance
  if (cropModal && typeof bootstrap !== "undefined") {
    cropModalInstance = new bootstrap.Modal(cropModal);
  }

  // Initializes Cropper.js on the preview image element
  function initializeCropper() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    // Wait for modal animation to complete before initializing cropper
    setTimeout(() => {
      cropperInstance = new Cropper(cropPreviewImage, {
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
        ready() {
          cropperInstance.resize();
        },
      });
    }, 300);
  }

  // Resets the cropper and image element state
  function resetCropper() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    if (cropPreviewImage) {
      cropPreviewImage.src = "";
      cropPreviewImage.removeAttribute("src");
      cropPreviewImage.onload = null;
    }
  }

  // Shows the crop modal and initializes cropper
  function showCropModal() {
    // Hide sidebar
    if (subSidebar) subSidebar.classList.add("hidden");

    resetCropper();

    // Set up image loading
    if (cropPreviewImage) {
      cropPreviewImage.onload = () => {
        initializeCropper();
        cropPreviewImage.onload = null;
      };

      cropPreviewImage.onerror = () => {
        alert("Failed to load screenshot. Please try again.");
        cropPreviewImage.onload = null;
      };

      cropPreviewImage.src = currentCanvasDataURL;
    }

    // Show the Bootstrap modal
    if (cropModalInstance) {
      cropModalInstance.show();
    }
  }

  // Closes the cropping modal and resets state
  function closeCropModal() {
    if (cropModalInstance) {
      cropModalInstance.hide();
    }
    resetCropper();
    if (subSidebar) subSidebar.classList.remove("hidden");
  }

  // Retrieves the cropped image as a canvas element
  function getCroppedCanvas() {
    if (!cropperInstance) {
      console.error("Cropper not initialized");
      return null;
    }
    return cropperInstance.getCroppedCanvas({
      width: 1200,
      height: "auto",
      minWidth: 800,
      maxWidth: 2400,
      fillColor: "#ffffff",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  }

  // Get template and create screenshot preview
  function createScreenshotPreview(screenshot) {
    const screenshotPreviews = document.getElementById("screenshot-previews");
    if (!screenshotPreviews) {
      console.error("Screenshot previews container not found");
      return;
    }

    const template = document.getElementById("screenshot-preview-template");
    if (!template) {
      console.error("Screenshot preview template not found - using manual creation");
      createScreenshotPreviewManually(screenshot, screenshotPreviews);
      return;
    }

    if (!template.content) {
      console.error("Template content is null - browser may not support template element");
      // Fallback: create elements manually
      createScreenshotPreviewManually(screenshot, screenshotPreviews);
      return;
    }

    try {
      // Clone the template
      const previewContainer = template.content.cloneNode(true);

      // Get the root element of the cloned template
      const previewItem = previewContainer.querySelector(".screenshot-preview-item");
      if (!previewItem) {
        console.error("Preview item not found in template - using manual creation");
        createScreenshotPreviewManually(screenshot, screenshotPreviews);
        return;
      }

      // Update the cloned elements
      const img = previewItem.querySelector(".screenshot-image");
      if (img) {
        img.src = screenshot.dataURL;
        img.alt = `Screenshot ${screenshots.length}`;
      }

      const checkbox = previewItem.querySelector(".screenshot-checkbox");
      if (checkbox) {
        checkbox.id = `screenshot-${screenshot.id}`;
      }

      const label = previewItem.querySelector(".screenshot-checkbox-label");
      if (label && checkbox) {
        label.setAttribute("for", checkbox.id);
      }

      // Add event listeners
      if (checkbox) {
        checkbox.addEventListener("change", () => {
          screenshot.includeInPrint = checkbox.checked;
        });
      }

      const deleteBtn = previewItem.querySelector(".screenshot-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          const index = screenshots.indexOf(screenshot);
          if (index > -1) {
            screenshots.splice(index, 1);
            previewItem.remove();
          }

          // Update screenshot status after deletion
          if (window.updateScreenshotStatus) {
            window.updateScreenshotStatus();
          }
        });
      }

      // Append the preview item to the container
      screenshotPreviews.appendChild(previewContainer);

      // Force update screenshot status
      setTimeout(() => {
        if (window.updateScreenshotStatus) {
          window.updateScreenshotStatus();
        }
      }, 100);
    } catch (error) {
      console.error("Error creating screenshot preview from template:", error);
      // Fallback to manual creation
      createScreenshotPreviewManually(screenshot, screenshotPreviews);
    }
  }

  // Fallback function to create screenshot preview manually
  function createScreenshotPreviewManually(screenshot, container) {
    try {
      // Create the preview item manually with exact same structure as template
      const previewItem = document.createElement("div");
      previewItem.className = "screenshot-preview-item";

      // Create image
      const img = document.createElement("img");
      img.className = "screenshot-image";
      img.src = screenshot.dataURL;
      img.alt = `Screenshot ${screenshots.length}`;
      img.style.cssText = "width: 100%; height: auto; margin-bottom: 10px;"; // Ensure proper styling

      // Create controls container
      const controls = document.createElement("div");
      controls.className = "screenshot-controls";
      controls.style.cssText = "display: flex; flex-direction: column; gap: 5px;"; // Ensure proper layout

      // Create checkbox label
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

      // Create title textarea
      const titleTextarea = document.createElement("textarea");
      titleTextarea.className = "screenshot-title";
      titleTextarea.placeholder = "Title or Description";
      titleTextarea.maxLength = 74;
      titleTextarea.style.cssText = "width: 100%; min-height: 40px; resize: vertical;";

      // Create delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "screenshot-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.style.cssText = "padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;";

      // Assemble the elements
      controls.appendChild(checkboxLabel);
      controls.appendChild(titleTextarea);
      controls.appendChild(deleteBtn);

      previewItem.appendChild(img);
      previewItem.appendChild(controls);

      // Add event listeners
      checkbox.addEventListener("change", () => {
        screenshot.includeInPrint = checkbox.checked;
      });

      deleteBtn.addEventListener("click", () => {
        const index = screenshots.indexOf(screenshot);
        if (index > -1) {
          screenshots.splice(index, 1);
          previewItem.remove();
        }

        // Update screenshot status
        if (window.updateScreenshotStatus) {
          window.updateScreenshotStatus();
        }
      });

      // Append to container
      container.appendChild(previewItem);

      // Force update screenshot status
      setTimeout(() => {
        if (window.updateScreenshotStatus) {
          window.updateScreenshotStatus();
        }
      }, 100);
    } catch (error) {
      console.error("Error creating screenshot preview manually:", error);
    }
  }

  // Add explicit close button event listener
  const closeButton = cropModal?.querySelector(".btn-close");
  if (closeButton) {
    closeButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeCropModal();
    });
  }

  // Modal event listeners
  if (cropModal) {
    // Clean up when modal is hidden (this handles both close button and ESC key)
    cropModal.addEventListener("hidden.bs.modal", () => {
      resetCropper();
      if (subSidebar) subSidebar.classList.remove("hidden");
    });

    // Handle modal shown event
    cropModal.addEventListener("shown.bs.modal", () => {
      // Resize cropper if it exists
      if (cropperInstance) {
        setTimeout(() => {
          cropperInstance.resize();
        }, 100);
      }
    });

    // Add click event to modal backdrop for closing
    cropModal.addEventListener("click", (e) => {
      if (e.target === cropModal) {
        closeCropModal();
      }
    });
  }

  return {
    startCropForDownload: () => {
      const selectPopup = document.getElementById("select-background-popup");
      if (selectPopup) selectPopup.style.display = "none";

      fabricCanvas.renderAll();
      currentCanvasDataURL = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 3,
        quality: 1.0,
      });

      showCropModal();

      // Set up confirm button handler for download
      if (cropConfirmBtn) {
        cropConfirmBtn.onclick = () => {
          const croppedCanvas = getCroppedCanvas();
          if (!croppedCanvas) return;

          const croppedDataURL = croppedCanvas.toDataURL("image/png", 1.0);
          const imageName = "floorplan";
          const a = document.createElement("a");
          a.href = croppedDataURL;
          a.download = imageName.endsWith(".png") ? imageName : `${imageName}.png`;
          a.click();
          closeCropModal();
        };
      }
    },

    startCropForScreenshot: () => {
      const selectPopup = document.getElementById("select-background-popup");
      if (selectPopup) selectPopup.style.display = "none";

      fabricCanvas.renderAll();
      currentCanvasDataURL = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 3,
        quality: 1.0,
      });

      showCropModal();

      // Set up confirm button handler for screenshot
      if (cropConfirmBtn) {
        cropConfirmBtn.onclick = () => {
          const croppedCanvas = getCroppedCanvas();
          if (!croppedCanvas) return;

          const croppedDataURL = croppedCanvas.toDataURL("image/png", 1.0);

          // Create screenshot object with unique ID
          const screenshot = {
            dataURL: croppedDataURL,
            includeInPrint: false,
            id: Date.now() + Math.random(), // Unique identifier
          };

          screenshots.push(screenshot);

          // Create screenshot preview using the enhanced function
          createScreenshotPreview(screenshot);

          closeCropModal();
        };
      }
    },

    cancelCrop: closeCropModal,

    resetCrop: () => {
      if (cropperInstance) {
        cropperInstance.reset();
      }
    },

    getScreenshots: () => screenshots,

    clearScreenshots: () => {
      screenshots.length = 0;
      const screenshotPreviews = document.getElementById("screenshot-previews");
      if (screenshotPreviews) {
        screenshotPreviews.innerHTML = "";
      }
    },
  };
}
