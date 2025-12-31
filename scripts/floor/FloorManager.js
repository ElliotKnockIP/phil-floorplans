// FloorManager.js - Multi-Floor System
import { FloorSerializer } from "../save/floor-save.js";
import { FloorUI } from "./FloorUI.js";
import { delay } from "../save/utils-save.js";

export class FloorManager {
  // Initialize floor manager with canvas and save system
  constructor(fabricCanvas, enhancedSaveSystem) {
    this.fabricCanvas = fabricCanvas;
    this.enhancedSaveSystem = enhancedSaveSystem;
    this.floors = new Map();
    this.currentFloor = 1;
    this.maxFloors = 24;
    this.isLoading = false;

    // Create serializer and UI handler
    this.serializer = new FloorSerializer(fabricCanvas, enhancedSaveSystem, this);
    this.ui = new FloorUI(this);

    this.initializeFloorSystem();
    this.ui.setupFloorControls();
    this.integrateSaveSystem();
  }

  // Sets up the floor system when starting
  initializeFloorSystem() {
    this.ensureFloor1Exists();
  }

  // Connects the floor system with the save system
  integrateSaveSystem() {
    this.originalLoadProject = this.enhancedSaveSystem.loadProject.bind(this.enhancedSaveSystem);
    this.enhancedSaveSystem.saveProject = () => this.serializer.saveProjectWithFloors();
    this.enhancedSaveSystem.loadProject = (file) => this.serializer.loadProjectWithFloors(file);
  }

  // Saves the current floor's state to memory
  saveCurrentFloorState() {
    if (this.isLoading || !this.floors.has(this.currentFloor)) return false;
    try {
      const projectState = this.serializer.getCurrentProjectState();
      const existingFloorData = this.floors.get(this.currentFloor);
      const floorName = existingFloorData?.name || `Floor ${this.currentFloor}`;
      this.floors.set(this.currentFloor, {
        ...projectState,
        floorNumber: this.currentFloor,
        lastModified: Date.now(),
        name: floorName,
      });
      this.updateFloorUI();
      return true;
    } catch (error) {
      console.error("Error saving floor state:", error);
      return false;
    }
  }

  // Makes sure floor 1 always exists
  ensureFloor1Exists() {
    if (!this.floors.has(1)) {
      this.currentFloor = 1;
      this.createNewFloor(1);
      this.updateFloorUI();
    }
  }

  // Switches to a different floor
  async switchToFloor(floorNumber) {
    if (floorNumber === this.currentFloor) return true;
    if (!this.floors.has(floorNumber)) {
      this.ui.showNotification(`Floor ${floorNumber} does not exist`, false);
      return false;
    }
    try {
      if (!this.isLoading) this.saveCurrentFloorState();
      if (window.undoSystem) window.undoSystem.reinitialize();
      this.clearCanvas();
      this.currentFloor = floorNumber;
      const targetFloorData = this.floors.get(floorNumber);

      // Apply current global settings to ALL floors and update the target floor
      const currentGlobalSettings = this.serializer.getCurrentGlobalSettings();
      this.applyGlobalSettingsToAllFloors(currentGlobalSettings);

      await this.loadFloorState(targetFloorData);
      this.updateFloorUI();
      this.finalizeFloorSwitch();
      return true;
    } catch (error) {
      this.ui.handleError(`Error switching to Floor ${floorNumber}`, error);
      return false;
    }
  }

  // Finishes switching floors and updates the UI
  finalizeFloorSwitch() {
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.renderAll();
    if (window.hideDeviceProperties) window.hideDeviceProperties();
    if (window.undoSystem) window.undoSystem.enableTracking();
    this.ui.showNotification(`Switched to Floor ${this.currentFloor}`, true);
  }

  // Updates global settings on all floors to keep them the same
  applyGlobalSettingsToAllFloors(globalSettings) {
    this.floors.forEach((floorData, floorNumber) => {
      if (floorData.settings) {
        floorData.settings = { ...floorData.settings, ...globalSettings };
      }
    });
  }

  // Called when global settings change to update all floors
  onGlobalSettingsChanged() {
    const currentGlobalSettings = this.serializer.getCurrentGlobalSettings();
    this.applyGlobalSettingsToAllFloors(currentGlobalSettings);
  }

  // Alias for onGlobalSettingsChanged (used by external API)
  syncGlobalSettingsToAllFloors() {
    this.onGlobalSettingsChanged();
  }

  // Creates a new empty floor
  createNewFloor(floorNumber) {
    const emptyFloorState = {
      cameras: {
        cameraDevices: [],
        counters: { cameraCounter: 1, deviceCounter: 1 },
        canvasSettings: { pixelsPerMeter: 17.5, zoom: 1, viewportTransform: [1, 0, 0, 1, 0, 0] },
      },
      drawing: {
        drawingObjects: [],
        zones: [],
        rooms: [],
        walls: { circles: [], lines: [] },
        titleblocks: [],
        canvasSettings: { pixelsPerMeter: 17.5, zoom: 1, viewportTransform: [1, 0, 0, 1, 0, 0] },
        globalState: { zonesArray: [], roomsArray: [] },
      },
      background: null,
      settings: {
        pixelsPerMeter: 17.5,
        zoom: 1,
        viewportTransform: [1, 0, 0, 1, 0, 0],
        defaultDeviceIconSize: 30,
        ...this.serializer.getCurrentGlobalSettings(),
      },
      counters: { cameraCounter: 1, deviceCounter: 1 },
      globalState: { zones: [], rooms: [] },
      floorNumber: floorNumber,
      lastModified: Date.now(),
      name: `Floor ${floorNumber}`,
    };
    this.floors.set(floorNumber, emptyFloorState);
  }

  // Clears everything from the canvas
  clearCanvas() {
    if (window.topologyManager?.clearAllConnections) {
      try {
        window.topologyManager.clearAllConnections();
      } catch (_) {}
    }
    // Clean up device event handlers and coverage properties before clearing canvas
    this.fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType && obj.coverageConfig) {
        ["added", "modified", "moving", "selected", "deselected"].forEach((event) => {
          const handler = obj[`${event}Handler`];
          if (handler) this.fabricCanvas.off(`object:${event}`, handler);
        });
        obj.coverageConfig = null;
        obj.coverageArea = null;
        obj.leftResizeIcon = null;
        obj.rightResizeIcon = null;
        obj.rotateResizeIcon = null;
      }
    });
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.clear();
    // Reset global counters and state
    Object.assign(window, { cameraCounter: 1, deviceCounter: 1, zones: [], rooms: [] });
    if (window.layers)
      Object.keys(window.layers).forEach((layerName) => {
        window.layers[layerName].objects = [];
      });
    this.fabricCanvas.requestRenderAll();
  }

  // Loads all the data for a specific floor
  async loadFloorState(floorData) {
    try {
      this.applyFloorSettings(floorData.settings);
      this.restoreCountersAndGlobalState(floorData);
      await this.loadBackground(floorData.background);
      await delay(100);
      if (floorData.drawing) {
        await this.enhancedSaveSystem.drawingSerializer.loadDrawingObjects(floorData.drawing);
      }
      await delay(200);
      await this.loadDevicesWithCoverage(floorData.cameras);
      await this.loadTopologyConnections(floorData);
      if (window.initCanvasLayers) window.initCanvasLayers(this.fabricCanvas);
      this.scheduleFinalCleanup(floorData);
    } catch (error) {
      console.error("Error loading floor state:", error);
      throw error;
    }
  }

  // Applies saved settings to the canvas
  applyFloorSettings(settings) {
    if (!settings) return;
    const { pixelsPerMeter, zoom, viewportTransform, defaultDeviceIconSize } = settings;
    this.fabricCanvas.pixelsPerMeter = pixelsPerMeter || 17.5;
    window.defaultDeviceIconSize = defaultDeviceIconSize || 30;

    // Apply ALL global settings from the floor data
    const globalSettings = this.serializer.extractGlobalSettings(settings);
    if (Object.keys(globalSettings).length > 0) {
      // Apply ALL global settings to window
      Object.assign(window, globalSettings);

      // Create settings payload for UI updates with ALL settings
      window.pendingGlobalSettings = {
        defaultDeviceIconSize: window.defaultDeviceIconSize,
        ...globalSettings,
      };

      // Apply settings to UI
      if (window.globalSettingsAPI?.applySettingsFromSave) {
        window.globalSettingsAPI.applySettingsFromSave(window.pendingGlobalSettings);
        setTimeout(() => {
          if (window.globalSettingsAPI?.applySettingsFromSave) {
            window.globalSettingsAPI.applySettingsFromSave(window.pendingGlobalSettings);
            window.pendingGlobalSettings = null;
          }
        }, 50);
      }
    }

    if (typeof zoom === "number") this.fabricCanvas.setZoom(zoom);
    if (Array.isArray(viewportTransform)) this.fabricCanvas.setViewportTransform(viewportTransform);
  }

  // Restores counters and global state from saved data
  restoreCountersAndGlobalState(floorData) {
    if (floorData.counters) Object.assign(window, floorData.counters);
    if (floorData.globalState) {
      window.zones = floorData.globalState.zones || [];
      window.rooms = floorData.globalState.rooms || [];
    }
  }

  // Loads background images for the floor
  async loadBackground(backgroundData) {
    if (!backgroundData?.objects) return;
    const backgroundObjects = backgroundData.objects.filter((obj) => {
      const isImage = obj.type === "image";
      const isBg = obj.isBackground;
      const isStatic = !obj.selectable && !obj.evented;
      return isImage && (isBg || isStatic);
    });
    if (backgroundObjects.length === 0) return;
    return new Promise((resolve) => {
      this.fabricCanvas.loadFromJSON({ version: backgroundData.version, objects: backgroundObjects }, () => {
        this.fabricCanvas.getObjects().forEach((obj) => {
          if (obj.isBackground) {
            obj.set({ selectable: false, evented: false, hoverCursor: "default" });
            this.fabricCanvas.sendToBack(obj);
          }
        });
        this.fabricCanvas.requestRenderAll();
        resolve();
      });
    });
  }

  // Loads camera devices and their coverage areas
  async loadDevicesWithCoverage(camerasData) {
    if (!camerasData?.cameraDevices?.length) return;
    window.isLoadingFloor = true;
    // Temporarily disable coverage auto-generation during bulk load
    const originalAddCoverage = window.addCameraCoverage;
    window.addCameraCoverage = () => {};
    for (let i = 0; i < camerasData.cameraDevices.length; i++) {
      try {
        await this.enhancedSaveSystem.cameraSerializer.loadCameraDevice(camerasData.cameraDevices[i], true);
        if (i < camerasData.cameraDevices.length - 1) await delay(50);
      } catch (error) {
        console.error(`Failed to load device ${i + 1}:`, error);
      }
    }
    await delay(100);
    window.isLoadingFloor = false;
    // Restore coverage generation and manually trigger for all loaded devices
    window.addCameraCoverage = originalAddCoverage;
    const cameraDevices = this.fabricCanvas.getObjects().filter((obj) => {
      return obj.type === "group" && obj.deviceType && obj.coverageConfig;
    });
    for (const device of cameraDevices) {
      if (device.coverageConfig && originalAddCoverage) {
        // Remove any existing coverage artifacts before re-adding
        const artifacts = [device.coverageArea, device.leftResizeIcon, device.rightResizeIcon, device.rotateResizeIcon].filter(Boolean);

        artifacts.forEach((item) => this.fabricCanvas.remove(item));
        originalAddCoverage(this.fabricCanvas, device);
        await delay(10);
        // Ensure resize icons are hidden by default after loading
        ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
          if (device[iconProp]) {
            device[iconProp].set({ visible: false });
            device[iconProp].visible = false;
            device[iconProp].evented = true;
          }
        });
        if (device.coverageArea) {
          const shouldBeVisible = device.coverageConfig.visible !== false;
          device.coverageArea.set({ visible: shouldBeVisible });
        }
      }
    }
    this.fabricCanvas.discardActiveObject();
  }

  // Loads network connections between devices
  async loadTopologyConnections(floorData) {
    try {
      const topologyData = floorData.drawing?.topology || floorData.topology;
      if (topologyData && window.topologyManager && Array.isArray(topologyData)) {
        await delay(50);
        window.topologyManager.loadConnectionsData(topologyData);
      }

      // Restore topology map positions
      const mapPositions = floorData.topologyMapPositions;
      if (mapPositions && Object.keys(mapPositions).length > 0 && window.topologyBuilderAPI?.setTopologyPositions) {
        try {
          window.topologyBuilderAPI.setTopologyPositions(mapPositions);
        } catch (e) {
          console.warn("Failed to restore topology map positions:", e);
        }
      }
    } catch (e) {
      console.warn("Failed to load floor topology", e);
    }
  }

  // Runs cleanup tasks after loading a floor
  scheduleFinalCleanup(floorData) {
    setTimeout(() => {
      this.cleanupOrphanedResizeIcons();
      this.forceHideAllResizeIcons();
      this.setupDeferredEventHandlers();
      this.fabricCanvas.discardActiveObject();
      if (window.hideDeviceProperties) window.hideDeviceProperties();
      if (typeof window.updateZoomDisplay === "function") window.updateZoomDisplay();

      const settings = window.pendingGlobalSettings;
      const api = window.globalSettingsAPI;
      if (settings && api?.applySettingsFromSave) {
        api.applySettingsFromSave(settings);
      }

      this.fabricCanvas.requestRenderAll();
    }, 300);
  }

  // Hides all resize icons on devices
  forceHideAllResizeIcons() {
    const cameraDevices = this.fabricCanvas.getObjects().filter((obj) => {
      return obj.type === "group" && obj.deviceType && obj.coverageConfig;
    });
    cameraDevices.forEach((device) => {
      ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
        if (device[iconProp]) {
          device[iconProp].set({ visible: false });
          device[iconProp].visible = false;
          device[iconProp].evented = true;
        }
      });
    });
    const standaloneResizeIcons = this.fabricCanvas.getObjects().filter((obj) => obj.isResizeIcon === true);
    standaloneResizeIcons.forEach((icon) => {
      icon.set({ visible: false });
      icon.visible = false;
    });
  }

  // Sets up event handlers for devices after loading
  setupDeferredEventHandlers() {
    const devicesWithDeferredHandlers = this.fabricCanvas.getObjects().filter((obj) => {
      return obj.type === "group" && obj.deviceType && obj._deferEventHandlers;
    });
    devicesWithDeferredHandlers.forEach((device) => {
      const serializer = this.enhancedSaveSystem.cameraSerializer;
      if (serializer.addDeviceEventHandlers) {
        serializer.addDeviceEventHandlers(device);
      }
      delete device._deferEventHandlers;
      ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
        if (device[iconProp]) device[iconProp].evented = true;
      });
    });
  }

  // Removes resize icons that don't belong to any device
  cleanupOrphanedResizeIcons() {
    const allObjects = this.fabricCanvas.getObjects();
    const deviceGroups = allObjects.filter((obj) => obj.type === "group" && obj.deviceType);
    const resizeIcons = allObjects.filter((obj) => obj.isResizeIcon === true);
    resizeIcons.forEach((icon) => {
      const belongsToDevice = deviceGroups.some((device) => {
        const icons = [device.leftResizeIcon, device.rightResizeIcon, device.rotateResizeIcon];
        return icons.includes(icon);
      });
      if (!belongsToDevice) this.fabricCanvas.remove(icon);
    });
    const coverageAreas = allObjects.filter((obj) => {
      const isCoverage = obj.isCoverage;
      const isLegacyCoverage = obj.type === "polygon" && obj.fill?.includes("165, 155, 155");
      return isCoverage || isLegacyCoverage;
    });
    coverageAreas.forEach((area) => {
      const belongsToDevice = deviceGroups.some((device) => device.coverageArea === area);
      if (!belongsToDevice) this.fabricCanvas.remove(area);
    });
  }

  // Delegate to UI - Updates the floor display and button states
  updateFloorUI() {
    this.ui.updateFloorUI();
  }

  // Get the current active floor number
  getCurrentFloor() {
    return this.currentFloor;
  }

  // Get the total number of floors created
  getFloorCount() {
    return this.floors.size;
  }

  // Get a sorted list of all floor numbers
  getFloorList() {
    return Array.from(this.floors.keys()).sort((a, b) => a - b);
  }

  // Check if a specific floor number exists
  hasFloor(floorNumber) {
    return this.floors.has(floorNumber);
  }
}

// Creates and initializes the floor manager
export function initFloorManager(fabricCanvas, enhancedSaveSystem) {
  const floorManager = new FloorManager(fabricCanvas, enhancedSaveSystem);
  window.floorManager = floorManager;
  // Make global settings sync method available globally
  window.syncGlobalSettingsToAllFloors = () => floorManager.syncGlobalSettingsToAllFloors();
  return floorManager;
}
