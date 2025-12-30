// Main canvas initialization and module setup
import { CanvasOperations } from "./CanvasOperations.js";
import { BackgroundManager } from "../background/BackgroundManager.js";
import { LayerControls } from "./interactions/LayerControls.js";
import { PrintReporter } from "./export/PrintReport.js";
import { ScreenshotCropper } from "./export/Screenshot.js";
import { CanvasSnapping } from "./interactions/Snapping.js";
import { ContextMenu } from "./interactions/ContextMenu.js";
import { CanvasUndoSystem } from "./interactions/UndoRedo.js";

// Drawing tools
import { setupTextTools } from "../drawing/text-tools.js";
import { setupShapeTools } from "../drawing/shapes.js";
import { setupMeasurementTools } from "../drawing/measurements.js";
import { setupWallTool } from "../drawing/Wall.js";
import { setupZoneTool, setupRoomTool, setupRiskTool, setupSafetyTool } from "../drawing/polygon-drawer.js";
import { setupNorthArrowTool } from "../drawing/north-arrow.js";
import { setupTitleBlockTool } from "../drawing/titleblock.js";
import { setupLineTools } from "../drawing/Line.js";
import { setupBuildingFrontTool } from "../drawing/building-front.js";
import { setupImageUploadTool } from "../drawing/upload-image.js";
import { setupNetworkLinkTool } from "../drawing/NetworkLink.js";

// Device and system modules
import { initTakeoffFeature } from "../devices/DeviceTakeoff.js";
import { DeviceFactory } from "../devices/DeviceFactory.js";
import { DeviceSettings } from "../devices/DeviceSettings.js";
import { CameraCore } from "../devices/camera/CameraCore.js";
import { CustomIcons } from "../devices/categories/CustomIcons.js";
import { TextDevices } from "../devices/categories/TextDevices.js";
import { SaveSystem } from "../save/save-system.js";
import { initFloorManager } from "../floor/FloorManager.js";
import { NetworkManager } from "../network/NetworkManager.js";
import { initTopologyBuilder } from "../network/topology/TopologyBuilder.js";

// Fixes browser compatibility issues
(function () {
  // Fix textBaseline typo
  const ctxProto = CanvasRenderingContext2D.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(ctxProto, "textBaseline");
  if (descriptor?.set) {
    const originalSetter = descriptor.set;
    Object.defineProperty(ctxProto, "textBaseline", {
      set: function (value) {
        if (value === "alphabetical") value = "alphabetic";
        originalSetter.call(this, value);
      },
    });
  }

  // Fix canvas context warning
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType, contextAttributes) {
    if (["2d", "webgl", "webgl2"].includes(contextType)) {
      contextAttributes = contextAttributes || {};
      if (contextType === "2d") {
        contextAttributes.willReadFrequently = true;
      }
    }
    return originalGetContext.call(this, contextType, contextAttributes);
  };
})();

// Fix Bootstrap modal focus issues
document.addEventListener("hide.bs.modal", (event) => {
  if (document.activeElement?.blur) {
    document.activeElement.blur();
  }
});

// Flag to track if HTML includes are loaded
let htmlIncludesLoaded = false;
let domLoaded = false;

// Listen for HTML includes loaded event
document.addEventListener("htmlIncludesLoaded", () => {
  htmlIncludesLoaded = true;
  tryInitCanvas();
});

// Listen for window load
window.addEventListener("load", () => {
  domLoaded = true;
  tryInitCanvas();
});

// Try to initialize canvas when both conditions are met
function tryInitCanvas() {
  // If HTML includes exist in the page, wait for them to load
  const hasIncludes = document.querySelector("[data-include]") !== null;

  if (domLoaded && (htmlIncludesLoaded || !hasIncludes)) {
    initCanvas();
  }
}

// Sets up the main canvas and all modules
function initCanvas() {
  const container = document.querySelector(".canvas-container");
  const fabricCanvas = new fabric.Canvas("canvas-layout", {
    width: container.clientWidth,
    height: container.clientHeight,
    fireRightClick: true,
    stopContextMenu: true,
  });

  // Make canvas available globally
  window.fabricCanvas = fabricCanvas;

  const subSidebar = document.getElementById("sub-sidebar");

  // Initialize core canvas features
  const coreModules = [
    () => new CanvasOperations(fabricCanvas),
    () => {
      const bgManager = new BackgroundManager(fabricCanvas);
      bgManager.initialize();
      bgManager.setupReplaceBackground();
      bgManager.setupChangeScale();
      window.backgroundManager = bgManager;
    },
    () => {
      const layerControls = new LayerControls(fabricCanvas);
      window.layerControls = layerControls;
    },
    () => {
      const cropper = new ScreenshotCropper(fabricCanvas, subSidebar);
      window.canvasCrop = cropper;
    },
    () => new PrintReporter(fabricCanvas),
    () => new ContextMenu(fabricCanvas),
  ];

  coreModules.forEach((init) => init());

  // Initialize snapping and expose API
  const snappingInstance = new CanvasSnapping(fabricCanvas);
  window.canvasSnapping = {
    setSnapThreshold: (threshold) => snappingInstance.setSnapThreshold(threshold),
    getSnapThreshold: () => snappingInstance.getSnapThreshold(),
    setZoneSnapThreshold: (threshold) => snappingInstance.setZoneSnapThreshold(threshold),
    setRoomSnapThreshold: (threshold) => snappingInstance.setRoomSnapThreshold(threshold),
    setSafetySnapThreshold: (threshold) => snappingInstance.setSafetySnapThreshold(threshold),
    isDeviceSnappingEnabled: () => snappingInstance.isDeviceSnappingEnabled(),
    clearSnapLines: () => snappingInstance.clearSnapLines(),
    isSnapping: () => snappingInstance.isSnapping(),
    hasBackgroundImage: () => snappingInstance.hasBackgroundImage(),
  };

  // Initialize drawing tools
  const drawingTools = [
    () => setupTextTools(fabricCanvas),
    () => setupShapeTools(fabricCanvas),
    () => setupMeasurementTools(fabricCanvas),
    () => setupWallTool(fabricCanvas),
    () => setupZoneTool(fabricCanvas),
    () => setupRoomTool(fabricCanvas),
    () => setupRiskTool(fabricCanvas),
    () => setupSafetyTool(fabricCanvas),
    () => setupNorthArrowTool(fabricCanvas),
    () => setupTitleBlockTool(fabricCanvas),
    () => setupLineTools(fabricCanvas),
    () => setupBuildingFrontTool(fabricCanvas),
    () => setupImageUploadTool(fabricCanvas),
    () => setupNetworkLinkTool(fabricCanvas),
  ];

  drawingTools.forEach((setup) => setup());

  // Create save system
  const enhancedSaveSystem = new SaveSystem(fabricCanvas);
  enhancedSaveSystem.setupButtonIntegration();

  // Initialize floor manager
  const floorManager = initFloorManager(fabricCanvas, enhancedSaveSystem);

  // Initialize undo system
  const undoSystem = new CanvasUndoSystem(fabricCanvas);

  // Initialize takeoff feature
  const takeoffGenerator = initTakeoffFeature(fabricCanvas);

  // Initialize network topology
  const topologyManager = new NetworkManager(fabricCanvas);
  initTopologyBuilder(fabricCanvas, topologyManager);

  // Initialize global settings
  new DeviceSettings(fabricCanvas);

  // Initialize project library
  import("../save/project-library.js").then((module) => {
    const { ProjectManager } = module;
    const projectManager = new ProjectManager(fabricCanvas, enhancedSaveSystem);
    window.projectManager = projectManager;
  });

  // Expose global APIs
  const globalAPIs = {
    enhancedSaveSystem,
    cameraSerializer: enhancedSaveSystem.getCameraSerializer(),
    floorManager,
    undoSystem,
    takeoffGenerator,
    topologyManager,
    UndoCommands: {
      AddCommand: CanvasUndoSystem.AddCommand,
      RemoveCommand: CanvasUndoSystem.RemoveCommand,
      MultipleCommand: CanvasUndoSystem.MultipleCommand,
    },
  };

  Object.assign(window, globalAPIs);

  // Notify modules that canvas is ready
  document.dispatchEvent(
    new CustomEvent("canvas:initialized", {
      detail: { canvas: fabricCanvas },
    })
  );

  // Handle window resize
  const handleResize = () => {
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
  };

  window.addEventListener("resize", handleResize);

  // Check layers initialization
  setTimeout(() => {
    if (window.refreshLayers) {
      window.refreshLayers();
    }
  }, 100);

  setTimeout(() => {
    if (window.getLayersState) {
      const layersState = window.getLayersState();
      if (!layersState.isInitialized) {
        console.warn("Layers not properly initialized, forcing refresh...");
        if (window.initCanvasLayers) {
          window.initCanvasLayers(fabricCanvas);
        }
      }
    }
  }, 500);
}
