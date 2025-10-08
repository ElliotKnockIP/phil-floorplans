import { layers } from "../canvas/canvas-layers.js";

export function initCropBackground(fabricCanvas, mainModal, updateStepIndicators, getIsFileUpload, setIsFileUpload, getBackgroundSource, closeAllPopups) {
  const cropModal = document.getElementById("cropModal");
  const cropBackBtn = document.getElementById("crop-back-btn");
  const cropNextBtn = document.getElementById("crop-next-btn");
  const croppableImage = document.getElementById("croppable-image");

  let cropper, scaleHandler, cropperTimeout, modalShownTimeout, refreshRetryTimeout;
  let savedState = { imageUrl: null, cropperData: null, isInitialized: false };

  function setScaleHandler(handler) {
    scaleHandler = handler;
  }
  function getScaleHandler() {
    return scaleHandler;
  }

  function refreshCropperLayout(maxRetries = 10, delay = 100) {
    if (refreshRetryTimeout) clearTimeout(refreshRetryTimeout);
    if (!cropper || !croppableImage) return;
    const visible = croppableImage.isConnected && croppableImage.offsetParent !== null;
    const hasSize = croppableImage.clientWidth > 0 && croppableImage.clientHeight > 0;
    if (!visible || !hasSize) {
      if (maxRetries > 0) refreshRetryTimeout = setTimeout(() => refreshCropperLayout(maxRetries - 1, delay), delay);
      return;
    }
    try {
      const data = savedState.cropperData || cropper.getData();
      cropper.reset();
      if (data) cropper.setData(data);
    } catch {
      try {
        cropper.render?.();
      } catch {}
    }
  }

  function initCropper(image) {
    if (cropperTimeout) clearTimeout(cropperTimeout);
    if (cropper) cropper.destroy();
    cropper = null;
    const needsDelay = image.src.startsWith("data:");
    const init = () => {
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
          if (cropper) {
            refreshCropperLayout();
            if (savedState.cropperData && savedState.isInitialized) cropper.setData(savedState.cropperData);
            savedState.isInitialized = true;
          }
        },
      });
    };
    if (needsDelay) cropperTimeout = setTimeout(init, 300);
    else init();
  }

  function resetCropper() {
    [cropperTimeout, modalShownTimeout, refreshRetryTimeout].forEach((t) => t && clearTimeout(t));
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    if (croppableImage) {
      croppableImage.src = "";
      croppableImage.removeAttribute("src");
      croppableImage.onload = null;
    }
    savedState = { imageUrl: null, cropperData: null, isInitialized: false };
  }

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
      } else initCropper(croppableImage);
    }
    updateStepIndicators(2);
  }

  function handleCropBack() {
    bootstrap.Modal.getInstance(cropModal)?.hide();
    resetCropper();
    const source = getBackgroundSource();
    const modalMap = { file: mainModal, pdf: mainModal, custom: "customBackgroundModal", map: "mapModal", maps: "mapModal" };
    const targetModal = modalMap[source];
    if (targetModal) (bootstrap.Modal.getInstance(document.getElementById(targetModal)) || new bootstrap.Modal(document.getElementById(targetModal))).show();
    updateStepIndicators(1);
  }

  function handleCropNext() {
    if (!cropper) return;
    savedState.cropperData = cropper.getData();
    const croppedCanvas = cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
    if (!croppedCanvas) {
      alert("Error processing crop. Please try again.");
      return;
    }
    bootstrap.Modal.getInstance(cropModal)?.hide();
    resetCropper();
    if (window.__replaceBackgroundMode) {
      // Replace background logic
      const objectsNow = fabricCanvas.getObjects();
      let existingBg = null;
      try {
        const layerBgs = Array.isArray(layers?.background?.objects) ? layers.background.objects : [];
        for (let i = layerBgs.length - 1; i >= 0; i--) {
          const obj = layerBgs[i];
          if (obj && obj.type === "image" && objectsNow.includes(obj)) {
            existingBg = obj;
            break;
          }
        }
      } catch {}
      if (!existingBg) existingBg = objectsNow.find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
      if (existingBg) {
        const existingDisplayedWidth = existingBg.width * existingBg.scaleX;
        const existingDisplayedHeight = existingBg.height * existingBg.scaleY;
        const targetScaleX = existingDisplayedWidth / croppedCanvas.width;
        const targetScaleY = existingDisplayedHeight / croppedCanvas.height;
        const targetLeft = existingBg.left;
        const targetTop = existingBg.top;
        fabricCanvas.remove(existingBg);
        layers.background.objects = layers.background.objects.filter((obj) => obj !== existingBg);
        fabric.Image.fromURL(
          croppedCanvas.toDataURL("image/png"),
          (img) => {
            img.set({ scaleX: targetScaleX, scaleY: targetScaleY, left: targetLeft, top: targetTop, selectable: false, evented: false, hoverCursor: "default", isBackground: true });
            fabricCanvas.add(img);
            fabricCanvas.sendToBack(img);
            layers.background.objects.push(img);
            fabricCanvas.requestRenderAll();
            window.__replaceBackgroundMode = false;
            closeAllPopups();
          },
          { crossOrigin: "anonymous" }
        );
      } else {
        window.__replaceBackgroundMode = false;
        closeAllPopups();
      }
    } else {
      if (!scaleHandler) return;
      scaleHandler.handleCropNext(croppedCanvas);
    }
  }

  function getCroppedCanvas() {
    if (!cropper) return null;
    return cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
  }

  cropBackBtn?.addEventListener("click", handleCropBack);
  cropNextBtn?.addEventListener("click", handleCropNext);

  cropModal?.addEventListener("shown.bs.modal", () => {
    if (modalShownTimeout) clearTimeout(modalShownTimeout);
    modalShownTimeout = setTimeout(() => {
      if (!cropper) return;
      refreshCropperLayout();
    }, 100);
  });

  return { handleCrop, getCroppedCanvas, resetCropper, setScaleHandler, getScaleHandler, restoreCropModal };
}
