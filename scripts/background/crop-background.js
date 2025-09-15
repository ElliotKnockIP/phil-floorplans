export function initCropBackground(fabricCanvas, mainModal, updateStepIndicators, getIsFileUpload, setIsFileUpload, getBackgroundSource) {
  const cropModal = document.getElementById("cropModal");
  const cropBackBtn = document.getElementById("crop-back-btn");
  const cropNextBtn = document.getElementById("crop-next-btn");
  const croppableImage = document.getElementById("croppable-image");

  let cropper;
  let scaleHandler;

  let savedState = {
    imageUrl: null,
    cropperData: null,
    isInitialized: false,
  };

  // Set scale handler
  function setScaleHandler(handler) {
    scaleHandler = handler;
  }

  // Initialize cropper on image
  function initCropper(image) {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    setTimeout(() => {
      cropper = new Cropper(image, {
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
        ready() {
          cropper.resize();
          if (savedState.cropperData && savedState.isInitialized) {
            cropper.setData(savedState.cropperData);
          }
          savedState.isInitialized = true;
        },
      });
    }, 300);
  }

  // Reset cropper state
  function resetCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    if (croppableImage) {
      croppableImage.src = "";
      croppableImage.removeAttribute("src");
      croppableImage.onload = null;
    }
    savedState = {
      imageUrl: null,
      cropperData: null,
      isInitialized: false,
    };
  }

  // Handle image cropping
  function handleCrop(imageUrl) {
    savedState.imageUrl = imageUrl;
    savedState.isInitialized = false;

    (bootstrap.Modal.getInstance(cropModal) || new bootstrap.Modal(cropModal)).show();

    if (croppableImage) {
      croppableImage.onload = () => {
        initCropper(croppableImage);
        croppableImage.onload = null;
      };
      croppableImage.src = imageUrl;
    }

    updateStepIndicators(2);
  }

  // Restore crop modal state
  function restoreCropModal() {
    if (!savedState.imageUrl) return;

    (bootstrap.Modal.getInstance(cropModal) || new bootstrap.Modal(cropModal)).show();

    if (croppableImage) {
      if (croppableImage.src !== savedState.imageUrl) {
        croppableImage.onload = () => {
          initCropper(croppableImage);
          croppableImage.onload = null;
        };
        croppableImage.src = savedState.imageUrl;
      } else {
        initCropper(croppableImage);
      }
    }

    updateStepIndicators(2);
  }

  // Handle back navigation
  function handleCropBack() {
    bootstrap.Modal.getInstance(cropModal)?.hide();
    resetCropper();

    const source = getBackgroundSource();

    if (source === "file" || source === "pdf") {
      (bootstrap.Modal.getInstance(mainModal) || new bootstrap.Modal(mainModal)).show();
    } else if (source === "custom") {
      const customBackgroundModal = document.getElementById("customBackgroundModal");
      (bootstrap.Modal.getInstance(customBackgroundModal) || new bootstrap.Modal(customBackgroundModal)).show();
    } else if (source === "map" || source === "maps") {
      const mapModal = document.getElementById("mapModal");
      (bootstrap.Modal.getInstance(mapModal) || new bootstrap.Modal(mapModal)).show();
    }

    updateStepIndicators(1);
  }

  // Handle next step after cropping
  function handleCropNext() {
    if (!cropper || !scaleHandler) return;

    savedState.cropperData = cropper.getData();

    const croppedCanvas = cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    if (!croppedCanvas) {
      alert("Error processing crop. Please try again.");
      return;
    }

    bootstrap.Modal.getInstance(cropModal)?.hide();
    scaleHandler.handleCropNext(croppedCanvas);
  }

  // Get cropped canvas
  function getCroppedCanvas() {
    if (!cropper) return null;
    return cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
  }

  cropBackBtn?.addEventListener("click", handleCropBack);
  cropNextBtn?.addEventListener("click", handleCropNext);

  cropModal?.addEventListener("shown.bs.modal", () => {
    if (cropper) {
      setTimeout(() => cropper.resize(), 100);
    }
  });

  return { handleCrop, getCroppedCanvas, resetCropper, setScaleHandler, restoreCropModal };
}
