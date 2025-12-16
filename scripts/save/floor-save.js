// floor-save.js - Floor serialization and save/load operations
import { NotificationSystem, delay } from "./utils-save.js";

// Global settings configuration - single source of truth
const GLOBAL_SETTINGS_CONFIG = {
  defaults: {
    globalIconTextVisible: true,
    globalDeviceColor: "#f8794b",
    globalTextColor: "#FFFFFF",
    globalFont: "Poppins, sans-serif",
    globalTextBackground: true,
    globalBoldText: false,
    globalCompleteDeviceIndicator: true,
    defaultDeviceIconSize: 30,
  },
  booleanKeys: new Set([
    "globalIconTextVisible",
    "globalTextBackground",
    "globalBoldText",
    "globalCompleteDeviceIndicator",
  ]),
};

export class FloorSerializer {
  constructor(fabricCanvas, saveSystem, floorManager) {
    this.fabricCanvas = fabricCanvas;
    this.saveSystem = saveSystem;
    this.floorManager = floorManager;
  }

  // Gets all the current global settings from window
  getCurrentGlobalSettings() {
    const { defaults, booleanKeys } = GLOBAL_SETTINGS_CONFIG;
    return Object.keys(defaults).reduce((settings, key) => {
      if (window[key] !== undefined) {
        settings[key] = booleanKeys.has(key) ? !!window[key] : window[key];
      } else {
        settings[key] = defaults[key];
      }
      return settings;
    }, {});
  }

  // Pulls out only the global settings from saved data
  extractGlobalSettings(settings = {}) {
    const { defaults, booleanKeys } = GLOBAL_SETTINGS_CONFIG;
    return Object.keys(defaults).reduce((extracted, key) => {
      if (settings[key] !== undefined) {
        extracted[key] = booleanKeys.has(key) ? !!settings[key] : settings[key];
      }
      return extracted;
    }, {});
  }

  // Saves the project with all floor data
  saveProjectWithFloors() {
    try {
      this.floorManager.ensureFloor1Exists();
      this.floorManager.saveCurrentFloorState();
      const projectData = {
        version: "4.0",
        timestamp: new Date().toISOString(),
        floors: {
          floors: Object.fromEntries(this.floorManager.floors),
          currentFloor: this.floorManager.currentFloor,
          floorCount: this.floorManager.floors.size,
        },
        clientDetails: this.saveSystem.serializeClientDetails(),
        screenshots: this.saveSystem.serializeScreenshots(),
      };
      this.saveSystem.downloadFile(projectData, `project_floors_${new Date().toISOString().split("T")[0]}.json`);
      NotificationSystem.show("Project with floors saved successfully!", true);
      return true;
    } catch (error) {
      console.error("Error saving project:", error);
      NotificationSystem.show(`Error saving project: ${error.message}`, false);
      return false;
    }
  }

  // Loads a project file and handles both single and multi-floor projects
  loadProjectWithFloors(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          window.isLoadingProject = true;
          const projectData = JSON.parse(e.target.result);
          if (window.undoSystem) window.undoSystem.reinitialize();

          if (projectData.floors?.floors) {
            await this.loadMultiFloorProject(projectData);
          } else {
            await this.loadSingleFloorProject(file);
          }

          this.floorManager.updateFloorUI();
          this.finalizeProjectLoad();
          resolve(true);
        } catch (error) {
          console.error("Error loading project:", error);
          NotificationSystem.show(`Error loading project: ${error.message}`, false);
          window.isLoadingProject = false;
          reject(error);
        }
      };
      reader.onerror = () => {
        NotificationSystem.show("Error reading file", false);
        reject(new Error("Error reading file"));
      };
      reader.readAsText(file);
    });
  }

  // Finishes loading a project and shows success message
  finalizeProjectLoad() {
    if (window.undoSystem) window.undoSystem.enableTracking();
    if (window.canvasSnapping?.clearSnapLines) window.canvasSnapping.clearSnapLines();
    NotificationSystem.show("Project loaded successfully!", true);
    window.isLoadingProject = false;
  }

  // Loads a project that has multiple floors
  async loadMultiFloorProject(projectData) {
    this.floorManager.floors.clear();
    this.floorManager.isLoading = true;
    this.floorManager.clearCanvas();

    Object.entries(projectData.floors.floors).forEach(([floorNumber, floorData]) => {
      this.floorManager.floors.set(parseInt(floorNumber), floorData);
    });

    const targetFloor = projectData.floors.currentFloor || 1;
    this.floorManager.currentFloor = targetFloor;
    this.floorManager.isLoading = false;

    const targetFloorData = this.floorManager.floors.get(targetFloor);
    if (targetFloorData) await this.floorManager.loadFloorState(targetFloorData);

    if (projectData.clientDetails) await this.saveSystem.loadClientDetailsToSidebar(projectData.clientDetails);
    if (projectData.screenshots) await this.saveSystem.loadScreenshotsToSidebar(projectData.screenshots);
  }

  // Loads an old project that only has one floor
  async loadSingleFloorProject(file) {
    this.floorManager.clearCanvas();
    await this.saveSystem.loadProject(file);
    this.floorManager.floors.clear();
    this.floorManager.currentFloor = 1;
    this.floorManager.saveCurrentFloorState();
  }

  // Gets all the current project data from the canvas
  getCurrentProjectState() {
    const coverageStates = this.prepareCoverageForSerialization();
    const cameraData = this.saveSystem.cameraSerializer.serializeCameraDevices();
    const drawingData = this.saveSystem.drawingSerializer.serializeDrawingObjects();
    const backgroundData = this.serializeBackgroundObjects();
    this.restoreCoverageAfterSerialization(coverageStates);

    // Get topology map positions from the builder API
    let topologyMapPositions = {};
    if (window.topologyBuilderAPI?.getTopologyPositions) {
      try {
        topologyMapPositions = window.topologyBuilderAPI.getTopologyPositions() || {};
      } catch (e) {
        console.warn("Failed to get topology map positions:", e);
      }
    }

    return {
      cameras: cameraData,
      drawing: drawingData,
      background: backgroundData,
      settings: {
        pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
        zoom: this.fabricCanvas.getZoom(),
        viewportTransform: [...this.fabricCanvas.viewportTransform],
        defaultDeviceIconSize: window.defaultDeviceIconSize || 30,
        ...this.getCurrentGlobalSettings(),
      },
      counters: { cameraCounter: window.cameraCounter || 1, deviceCounter: window.deviceCounter || 1 },
      globalState: { zones: window.zones || [], rooms: window.rooms || [] },
      topologyMapPositions: topologyMapPositions,
    };
  }

  // Saves background images to the floor data
  serializeBackgroundObjects() {
    const backgroundObjects = this.fabricCanvas.getObjects().filter((obj) => obj.isBackground || (obj.type === "image" && !obj.selectable && !obj.evented));
    return backgroundObjects.length > 0 ? this.fabricCanvas.toJSON(["isBackground", "pixelsPerMeter"]) : null;
  }

  // Hides camera coverage areas before saving
  prepareCoverageForSerialization() {
    const coverageStates = new Map();
    this.fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType && obj.coverageConfig) {
        const state = {
          coverageVisible: obj.coverageArea?.visible || false,
          leftIconVisible: obj.leftResizeIcon?.visible || false,
          rightIconVisible: obj.rightResizeIcon?.visible || false,
          rotateIconVisible: obj.rotateResizeIcon?.visible || false,
        };
        coverageStates.set(obj, state);
        [obj.coverageArea, obj.leftResizeIcon, obj.rightResizeIcon, obj.rotateResizeIcon].filter(Boolean).forEach((item) => this.fabricCanvas.remove(item));
      }
    });
    return coverageStates;
  }

  // Shows camera coverage areas after loading
  restoreCoverageAfterSerialization(coverageStates) {
    coverageStates.forEach((state, obj) => {
      if (obj.coverageArea) {
        this.fabricCanvas.add(obj.coverageArea);
        obj.coverageArea.set({ visible: state.coverageVisible });
        try {
          const deviceIndex = this.fabricCanvas.getObjects().indexOf(obj);
          if (deviceIndex !== -1) {
            this.fabricCanvas.remove(obj.coverageArea);
            this.fabricCanvas.insertAt(obj.coverageArea, deviceIndex);
          } else if (state.coverageVisible) {
            obj.coverageArea.sendToBack();
          }
        } catch (err) {
          console.warn("Failed to position restored coverage area:", err);
          if (state.coverageVisible) obj.coverageArea.sendToBack();
        }
      }
      ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp, index) => {
        const visibleKey = ["leftIconVisible", "rightIconVisible", "rotateIconVisible"][index];
        if (obj[iconProp]) {
          this.fabricCanvas.add(obj[iconProp]);
          obj[iconProp].set({ visible: state[visibleKey] });
          if (state[visibleKey]) obj[iconProp].bringToFront();
        }
      });
    });
    this.fabricCanvas.renderAll();
  }
}

