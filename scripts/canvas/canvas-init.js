import { initCanvasOperations } from "./canvas-operations.js";
import { initDragDropDevices } from "../devices/drag-drop-devices.js";
import { initSelectBackground } from "../background/select-background.js";
import { initCanvasLayers } from "./canvas-layers.js";
import { initCanvasPrint } from "./canvas-print.js";
import { initCanvasCrop } from "./canvas-crop.js";
import { initCanvasSnapping } from "./canvas-snapping.js";

import { setupTextTools } from "../drawing/text-tools.js";
import { setupShapeTools } from "../drawing/shapes.js";
import { setupMeasurementTools } from "../drawing/measurements.js";
import { setupWallTool } from "../drawing/walls.js";
import { setupZoneTool } from "../drawing/zones.js";
import { setupRoomTool } from "../drawing/rooms.js";
import { setupNorthArrowTool } from "../drawing/north-arrow.js";
import { setupTitleBlockTool } from "../drawing/titleblock.js";
import { setupLineTools } from "../drawing/lines.js";
import { setupBuildingFrontTool } from "../drawing/building-front.js";
import { setupImageUploadTool } from "../drawing/upload-image.js";

import { initTakeoffFeature } from "../devices/device-takeoff.js";

// Import the enhanced save system for camera integration
import { EnhancedSaveSystem } from "../save/enhanced-save-system.js";
import { addCameraCoverage } from "../devices/camera-coverage.js";

// Import the floor manager
import { initFloorManager } from "../floor/floor-manager.js";

// Import the undo system
import { CanvasUndoSystem } from "./canvas-undo.js";

// Patch CanvasRenderingContext2D.textBaseline setter to fix "alphabetical" typo
(function () {
  const ctxProto = CanvasRenderingContext2D.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(ctxProto, "textBaseline");

  if (descriptor && descriptor.set) {
    const originalSetter = descriptor.set;
    Object.defineProperty(ctxProto, "textBaseline", {
      set: function (value) {
        if (value === "alphabetical") {
          value = "alphabetic";
        }
        originalSetter.call(this, value);
      },
    });
  }
})();

// Fix for Canvas2D willReadFrequently warning
(function () {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType, contextAttributes) {
    if (contextType === "2d" || contextType === "webgl" || contextType === "webgl2") {
      contextAttributes = contextAttributes || {};
      if (contextType === "2d") {
        contextAttributes.willReadFrequently = true;
      }
    }
    return originalGetContext.call(this, contextType, contextAttributes);
  };
})();

// Fix for bootstrap console error
document.addEventListener("hide.bs.modal", function (event) {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
});

window.onload = function () {
  const container = document.querySelector(".canvas-container");
  const fabricCanvas = new fabric.Canvas("canvas-layout", {
    width: container.clientWidth,
    height: container.clientHeight,
  });

  // Initialize basic canvas features
  initCanvasOperations(fabricCanvas);
  initDragDropDevices(fabricCanvas);
  initSelectBackground(fabricCanvas);
  initCanvasLayers(fabricCanvas);

  // Add a small delay to ensure DOM elements are ready
  setTimeout(() => {
    // Double-check layers initialization
    if (window.refreshLayers) {
      window.refreshLayers();
    }
  }, 100);

  initCanvasPrint(fabricCanvas);
  initCanvasCrop(fabricCanvas);
  initCanvasSnapping(fabricCanvas);

  // Initialize drawing tools
  setupTextTools(fabricCanvas);
  setupShapeTools(fabricCanvas);
  setupMeasurementTools(fabricCanvas);
  setupWallTool(fabricCanvas);
  setupZoneTool(fabricCanvas);
  setupRoomTool(fabricCanvas);
  setupNorthArrowTool(fabricCanvas);
  setupTitleBlockTool(fabricCanvas);
  setupLineTools(fabricCanvas);
  setupBuildingFrontTool(fabricCanvas);
  setupImageUploadTool(fabricCanvas);

  // Initialize camera coverage functionality
  window.addCameraCoverage = addCameraCoverage; // Make globally available

  // Initialize enhanced save system
  const enhancedSaveSystem = new EnhancedSaveSystem(fabricCanvas);

  // Initialize floor management system (this handles save/load integration internally)
  const floorManager = initFloorManager(fabricCanvas, enhancedSaveSystem);

  // Setup button integration for save system
  enhancedSaveSystem.setupButtonIntegration();

  // Make available globally for external use
  window.enhancedSaveSystem = enhancedSaveSystem;
  window.cameraSerializer = enhancedSaveSystem.getCameraSerializer();
  window.floorManager = floorManager;

  // Initialize undo system
  const undoSystem = new CanvasUndoSystem(fabricCanvas);
  window.undoSystem = undoSystem;

  // Expose command classes for external use
  window.UndoCommands = {
    AddCommand: CanvasUndoSystem.AddCommand,
    RemoveCommand: CanvasUndoSystem.RemoveCommand,
    MultipleCommand: CanvasUndoSystem.MultipleCommand,
  };

  // Initialize takeoff feature
  const takeoffGenerator = initTakeoffFeature(fabricCanvas);
  window.takeoffGenerator = takeoffGenerator;

  // Handle window resize
  window.addEventListener("resize", () => {
    fabricCanvas.setDimensions({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();
    vpt[4] = (container.clientWidth - fabricCanvas.getWidth() * zoom) / 2;
    vpt[5] = (container.clientHeight - fabricCanvas.getHeight() * zoom) / 2;
    fabricCanvas.setViewportTransform(vpt);

    fabricCanvas.requestRenderAll();
  });

  // Final layers check after everything is loaded
  setTimeout(() => {
    if (window.getLayersState) {
      const layersState = window.getLayersState();

      // If layers aren't working properly, force a refresh
      if (!layersState.isInitialized) {
        console.warn("Layers not properly initialized, forcing refresh...");
        if (window.initCanvasLayers) {
          window.initCanvasLayers(fabricCanvas);
        }
      }
    }
  }, 500);
};
