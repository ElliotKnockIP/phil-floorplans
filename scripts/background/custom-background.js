export function initCustomBackground(fabricCanvas, mainModal, updateStepIndicators, handleCrop, setBackgroundSource) {
  const customBackgroundModal = document.getElementById("customBackgroundModal");
  const customBackBtn = document.getElementById("custom-back-btn");
  const customNextBtn = document.getElementById("custom-next-btn");
  const customWidthInput = document.getElementById("custom-width");
  const customHeightInput = document.getElementById("custom-height");
  const customColorSelect = document.getElementById("custom-colour");
  const customPreviewWrapper = document.getElementById("custom-style-container");
  const customPreviewCanvas = document.getElementById("custom-preview-canvas");

  let previewCanvas;
  let customBackgroundRect;
  let resizeObserver;

  // Clean up resources
  function cleanup() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (previewCanvas) {
      previewCanvas.clear();
      previewCanvas.dispose();
      previewCanvas = null;
    }

    customBackgroundRect = null;

    if (window.customCanvasResizeTimeout) {
      clearTimeout(window.customCanvasResizeTimeout);
      window.customCanvasResizeTimeout = null;
    }
  }

  // Initialize preview canvas
  function initPreviewCanvas() {
    cleanup();

    if (!customPreviewWrapper || !customPreviewCanvas) return;

    setTimeout(() => {
      const containerRect = customPreviewWrapper.getBoundingClientRect();
      const containerWidth = containerRect.width || 600;
      const containerHeight = containerRect.height || 400;

      const canvasWidth = Math.max(containerWidth - 20, 300);
      const canvasHeight = Math.max(containerHeight - 20, 200);

      customPreviewCanvas.width = canvasWidth;
      customPreviewCanvas.height = canvasHeight;
      customPreviewCanvas.style.width = canvasWidth + "px";
      customPreviewCanvas.style.height = canvasHeight + "px";

      previewCanvas = new fabric.Canvas("custom-preview-canvas", {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: "#f5f5f5",
      });

      setupResizeObserver();
      updatePreviewCanvas();
    }, 100);
  }

  // Resize canvas to fit container
  function resizeCanvas() {
    if (!previewCanvas || !customPreviewWrapper) return;

    const containerRect = customPreviewWrapper.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const canvasWidth = Math.max(containerRect.width - 20, 300);
    const canvasHeight = Math.max(containerRect.height - 20, 200);

    customPreviewCanvas.width = canvasWidth;
    customPreviewCanvas.height = canvasHeight;
    customPreviewCanvas.style.width = canvasWidth + "px";
    customPreviewCanvas.style.height = canvasHeight + "px";

    previewCanvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    updatePreviewCanvas();
  }

  // Update preview canvas with custom settings
  function updatePreviewCanvas() {
    if (!previewCanvas || !customWidthInput || !customHeightInput || !customColorSelect) return;

    const width = parseInt(customWidthInput.value) || 800;
    const height = parseInt(customHeightInput.value) || 600;
    const color = customColorSelect.value;

    const canvasWidth = previewCanvas.getWidth();
    const canvasHeight = previewCanvas.getHeight();
    const scale = Math.min(canvasWidth / width, canvasHeight / height, 1);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const left = (canvasWidth - scaledWidth) / 2;
    const top = (canvasHeight - scaledHeight) / 2;

    if (customBackgroundRect) {
      previewCanvas.remove(customBackgroundRect);
    }

    customBackgroundRect = new fabric.Rect({
      left: left,
      top: top,
      width: width,
      height: height,
      scaleX: scale,
      scaleY: scale,
      fill: color,
      selectable: false,
      evented: false,
      hoverCursor: "default",
    });

    previewCanvas.add(customBackgroundRect);
    previewCanvas.sendToBack(customBackgroundRect);
    previewCanvas.requestRenderAll();
  }

  // Set up resize observer for preview canvas
  function setupResizeObserver() {
    if (!customPreviewWrapper || resizeObserver) return;

    resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === customPreviewWrapper && previewCanvas) {
          clearTimeout(window.customCanvasResizeTimeout);
          window.customCanvasResizeTimeout = setTimeout(resizeCanvas, 100);
        }
      }
    });

    resizeObserver.observe(customPreviewWrapper);
  }

  // Handle custom background selection
  function handleCustomBackgroundSelection() {
    bootstrap.Modal.getInstance(mainModal)?.hide();

    setTimeout(() => {
      (bootstrap.Modal.getInstance(customBackgroundModal) || new bootstrap.Modal(customBackgroundModal)).show();
      setTimeout(() => {
        initPreviewCanvas();
        updateStepIndicators(1);
      }, 100);
    }, 200);
  }

  // Handle back navigation
  function handleCustomBack() {
    bootstrap.Modal.getInstance(customBackgroundModal)?.hide();
    cleanup();
    (bootstrap.Modal.getInstance(mainModal) || new bootstrap.Modal(mainModal)).show();
    updateStepIndicators(1);
  }

  // Handle next step with custom background
  function handleCustomNext() {
    const width = parseInt(customWidthInput.value) || 800;
    const height = parseInt(customHeightInput.value) || 600;
    const color = customColorSelect.value;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    const dataUrl = tempCanvas.toDataURL("image/png");

    bootstrap.Modal.getInstance(customBackgroundModal)?.hide();
    setBackgroundSource("custom");
    handleCrop(dataUrl);
    updateStepIndicators(2);
  }

  customWidthInput?.addEventListener("input", updatePreviewCanvas);
  customHeightInput?.addEventListener("input", updatePreviewCanvas);
  customColorSelect?.addEventListener("change", updatePreviewCanvas);

  customBackBtn?.addEventListener("click", handleCustomBack);
  customNextBtn?.addEventListener("click", handleCustomNext);

  customBackgroundModal?.addEventListener("hidden.bs.modal", cleanup);
  customBackgroundModal?.addEventListener("shown.bs.modal", () => {
    setTimeout(initPreviewCanvas, 100);
  });

  window.addEventListener("resize", () => {
    if (previewCanvas && customBackgroundModal?.classList.contains("show")) {
      clearTimeout(window.customCanvasResizeTimeout);
      window.customCanvasResizeTimeout = setTimeout(resizeCanvas, 100);
    }
  });

  return { initPreviewCanvas, handleCustomBackgroundSelection };
}
