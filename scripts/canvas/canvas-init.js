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

// Fix browser compatibility issues
(function () {
  // Fix textBaseline typo in some browsers
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

  // Optimize canvas context for frequent reads
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

// Remove focus from active element when modal closes
document.addEventListener("hide.bs.modal", (event) => {
  if (document.activeElement?.blur) {
    document.activeElement.blur();
  }
});

// Track loading state of HTML includes and DOM
let htmlIncludesLoaded = false;
let domLoaded = false;

// Mark HTML includes as loaded
document.addEventListener("htmlIncludesLoaded", () => {
  htmlIncludesLoaded = true;
  tryInitCanvas();
});

// Mark DOM as loaded
window.addEventListener("load", () => {
  domLoaded = true;
  tryInitCanvas();
});

// Initialize canvas if both DOM and HTML includes are ready
function tryInitCanvas() {
  const hasIncludes = document.querySelector("[data-include]") !== null;

  if (domLoaded && (htmlIncludesLoaded || !hasIncludes)) {
    initCanvas();
  }
}

// Main initialization for Fabric.js canvas and all system modules
function initCanvas() {
  const container = document.querySelector(".canvas-container");
  const fabricCanvas = new fabric.Canvas("canvas-layout", {
    width: container.clientWidth,
    height: container.clientHeight,
    fireRightClick: true,
    stopContextMenu: true,
  });

  // Expose canvas globally for other modules
  window.fabricCanvas = fabricCanvas;

  const subSidebar = document.getElementById("sub-sidebar");

  // Initialize core canvas modules
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

  // Setup snapping system and expose its API
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

  // Initialize all drawing and annotation tools
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

  // Setup save system and UI integration
  const enhancedSaveSystem = new SaveSystem(fabricCanvas);
  enhancedSaveSystem.setupButtonIntegration();

  // Initialize floor and level management
  const floorManager = initFloorManager(fabricCanvas, enhancedSaveSystem);

  // Initialize undo/redo functionality
  const undoSystem = new CanvasUndoSystem(fabricCanvas);

  // Initialize device takeoff and reporting
  const takeoffGenerator = initTakeoffFeature(fabricCanvas);

  // Initialize network management and topology
  const topologyManager = new NetworkManager(fabricCanvas);
  initTopologyBuilder(fabricCanvas, topologyManager);

  // Initialize device-specific settings
  new DeviceSettings(fabricCanvas);

  // Load project library module dynamically
  import("../save/project-library.js").then((module) => {
    const { ProjectManager } = module;
    const projectManager = new ProjectManager(fabricCanvas, enhancedSaveSystem);
    window.projectManager = projectManager;
  });

  // Expose core systems to global window object
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

  // Signal that canvas is fully initialized
  document.dispatchEvent(
    new CustomEvent("canvas:initialized", {
      detail: { canvas: fabricCanvas },
    })
  );

  // Update canvas dimensions and center viewport on window resize
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

  // Refresh layers after a short delay to ensure UI is ready
  setTimeout(() => {
    if (window.refreshLayers) {
      window.refreshLayers();
    }
  }, 100);

  // Verify layer initialization and force refresh if needed
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
