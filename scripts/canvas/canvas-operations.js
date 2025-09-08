import { initCanvasLayers } from "./canvas-layers.js";
import { initCanvasCrop } from "./canvas-crop.js";

export function initCanvasOperations(fabricCanvas) {
  let isPanning = false;
  let lastPosX = 0;
  let lastPosY = 0;

  fabricCanvas.defaultCursor = "move"; // default cursor

  // Mouse down: start panning if left-click on empty space
  fabricCanvas.on("mouse:down", function (opt) {
    fabricCanvas.selection = false;
    const evt = opt.e;
    if (evt.button === 0 && !opt.target) {
      isPanning = true;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      evt.preventDefault();
      evt.stopPropagation();
    }
  });

  // Mouse move: update canvas position when panning
  fabricCanvas.on("mouse:move", function (opt) {
    if (isPanning) {
      const evt = opt.e;
      const deltaX = evt.clientX - lastPosX;
      const deltaY = evt.clientY - lastPosY;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;

      const vpt = fabricCanvas.viewportTransform;
      vpt[4] += deltaX;
      vpt[5] += deltaY;
      fabricCanvas.setViewportTransform(vpt);
      fabricCanvas.requestRenderAll();

      evt.preventDefault();
      evt.stopPropagation();
    }
  });

  // Mouse up: stop panning
  fabricCanvas.on("mouse:up", function (opt) {
    if (isPanning) {
      isPanning = false;
      fabricCanvas.selection = true;
      opt.e.preventDefault();
      opt.e.stopPropagation();
    } else {
      fabricCanvas.selection = true;
    }
  });

  // Mouse wheel: zoom in/out at pointer
  fabricCanvas.on("mouse:wheel", function (opt) {
    opt.e.preventDefault();
    opt.e.stopPropagation();

    const delta = opt.e.deltaY;
    let zoom = fabricCanvas.getZoom();
    const zoomFactor = 0.1;
    const minZoom = 0.25;
    const maxZoom = 10;

    if (delta > 0) {
      zoom = Math.max(minZoom, zoom - zoomFactor);
    } else {
      zoom = Math.min(maxZoom, zoom + zoomFactor);
    }

    const pointer = fabricCanvas.getPointer(opt.e, true);
    const zoomPoint = new fabric.Point(pointer.x, pointer.y);

    fabricCanvas.zoomToPoint(zoomPoint, zoom);
    fabricCanvas.requestRenderAll();
  });

  // Clear canvas button elements
  const clearButton = document.getElementById("clear-canvas-btn");
  const clearWarningPopup = document.getElementById("clear-warning-popup");
  const cancelClearWarning = document.getElementById("cancel-clear-warning");
  const closeClearWarning = document.getElementById("close-clear-warning");
  const confirmClearWarning = document.getElementById("confirm-clear-warning");
  const subSidebar = document.getElementById("sub-sidebar");

  // Fully clear all objects and reset layers/state
  function clearCanvas() {
    subSidebar.classList.add("hidden");
    if (window.hideDeviceProperties) {
      window.hideDeviceProperties();
    }

    fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        if (obj.textObject) fabricCanvas.remove(obj.textObject);
        if (obj.coverageArea) fabricCanvas.remove(obj.coverageArea);
        if (obj.leftResizeIcon) fabricCanvas.remove(obj.leftResizeIcon);
        if (obj.rightResizeIcon) fabricCanvas.remove(obj.rightResizeIcon);
        if (obj.rotateResizeIcon) fabricCanvas.remove(obj.rotateResizeIcon);
      }
      if (obj.type === "polygon" && obj.class === "zone-polygon" && obj.associatedText) {
        fabricCanvas.remove(obj.associatedText);
      }
      fabricCanvas.remove(obj);
    });

    fabricCanvas.clear();

    const layers = {
      zones: { objects: [], visible: true, opacity: 1 },
      drawings: { objects: [], visible: true, opacity: 1 },
      devices: { objects: [], visible: true, opacity: 1 },
      background: { objects: [], visible: true, opacity: 1 },
    };

    window.cameraCounter = 1;
    window.deviceCounter = 1;
    window.zones = [];

    initCanvasLayers(fabricCanvas);

    if (window.resetCanvasState) {
      window.resetCanvasState();
    }

    fabricCanvas.pixelsPerMeter = 17.5;
    fabricCanvas.setZoom(1);
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.requestRenderAll();
  }

  // Show clear warning
  clearButton.addEventListener("click", function () {
    subSidebar.classList.add("hidden");
    clearWarningPopup.style.display = "flex";
  });

  // Cancel clear warning
  cancelClearWarning.addEventListener("click", function () {
    clearWarningPopup.style.display = "none";
  });

  // Close clear warning
  closeClearWarning.addEventListener("click", function () {
    clearWarningPopup.style.display = "none";
  });

  // Confirm and clear
  confirmClearWarning.addEventListener("click", function () {
    clearWarningPopup.style.display = "none";
    clearCanvas();
  });

  // Initialize cropping and download button
  const canvasCrop = initCanvasCrop(fabricCanvas, subSidebar, document.querySelector(".canvas-container"));
  const downloadButton = document.getElementById("download-background-btn");
  downloadButton.addEventListener("click", () => {
    canvasCrop.startCropForDownload();
  });

  return fabricCanvas;
}
