// floor-manager.js - Complete Version with Room Support
export class FloorManager {
  constructor(fabricCanvas, enhancedSaveSystem) {
    this.fabricCanvas = fabricCanvas;
    this.enhancedSaveSystem = enhancedSaveSystem;
    this.floors = new Map();
    this.currentFloor = 1;
    this.maxFloors = 24;
    this.isLoading = false;

    this.initializeFloorSystem();
    this.setupFloorControls();
    this.integrateSaveSystem();
  }

  initializeFloorSystem() {
    this.ensureFloor1Exists();
  }

  integrateSaveSystem() {
    // Store original methods
    this.originalSaveProject = this.enhancedSaveSystem.saveProject.bind(this.enhancedSaveSystem);
    this.originalLoadProject = this.enhancedSaveSystem.loadProject.bind(this.enhancedSaveSystem);

    // Override save/load methods
    this.enhancedSaveSystem.saveProject = () => this.saveProjectWithFloors();
    this.enhancedSaveSystem.loadProject = (file) => this.loadProjectWithFloors(file);
  }

  saveProjectWithFloors() {
    try {
      this.ensureFloor1Exists();
      this.saveCurrentFloorState();

      const projectData = {
        version: "4.0",
        timestamp: new Date().toISOString(),
        floors: {
          floors: Object.fromEntries(this.floors),
          currentFloor: this.currentFloor,
          floorCount: this.floors.size,
        },
        clientDetails: this.enhancedSaveSystem.serializeClientDetails(),
        screenshots: this.enhancedSaveSystem.serializeScreenshots(),
      };

      this.enhancedSaveSystem.downloadFile(projectData, `project_floors_${new Date().toISOString().split("T")[0]}.json`);
      this.showNotification("Project with floors saved successfully!", true);
      return true;
    } catch (error) {
      console.error("Error saving project with floors:", error);
      this.showNotification("Error saving project: " + error.message, false);
      return false;
    }
  }

  loadProjectWithFloors(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          window.isLoadingProject = true;
          const projectData = JSON.parse(e.target.result);

          // Reinitialize undo system
          // IMPORTANT: Reinitialize BEFORE loading so object additions during load aren't tracked.
          if (window.undoSystem) window.undoSystem.reinitialize();

          if (projectData.floors?.floors) {
            await this.loadMultiFloorProject(projectData);
          } else {
            await this.loadSingleFloorProject(file);
          }

          this.updateFloorUI();
          // Re-enable undo tracking after project load completes
          if (window.undoSystem) window.undoSystem.enableTracking();
          // Clear snap lines after load
          if (window.canvasSnapping && typeof window.canvasSnapping.clearSnapLines === "function") {
            window.canvasSnapping.clearSnapLines();
          }
          this.showNotification("Project loaded successfully!", true);
          window.isLoadingProject = false;
          resolve(true);
        } catch (error) {
          console.error("Error loading project:", error);
          this.showNotification("Error loading project: " + error.message, false);
          window.isLoadingProject = false;
          reject(error);
        }
      };
      reader.onerror = () => {
        this.showNotification("Error reading file", false);
        reject(new Error("Error reading file"));
      };
      reader.readAsText(file);
    });
  }

  async loadMultiFloorProject(projectData) {
    this.floors.clear();
    this.isLoading = true;
    this.clearCanvas();

    // Load floors directly
    Object.entries(projectData.floors.floors).forEach(([floorNumber, floorData]) => {
      this.floors.set(parseInt(floorNumber), floorData);
    });

    const targetFloor = projectData.floors.currentFloor || 1;
    this.currentFloor = targetFloor;
    this.isLoading = false;

    // Load target floor state
    const targetFloorData = this.floors.get(targetFloor);
    if (targetFloorData) {
      await this.loadFloorState(targetFloorData);
    }

    // Load client details and screenshots
    if (projectData.clientDetails) {
      await this.enhancedSaveSystem.loadClientDetailsToSidebar(projectData.clientDetails);
    }
    if (projectData.screenshots) {
      await this.enhancedSaveSystem.loadScreenshotsToSidebar(projectData.screenshots);
    }
  }

  async loadSingleFloorProject(file) {
    this.clearCanvas();
    await this.originalLoadProject.call(this.enhancedSaveSystem, file);
    this.floors.clear();
    this.currentFloor = 1;
    this.saveCurrentFloorState();
  }

  saveCurrentFloorState() {
    if (this.isLoading || !this.floors.has(this.currentFloor)) return false;

    try {
      const projectState = this.getCurrentProjectState();
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

  ensureFloor1Exists() {
    if (!this.floors.has(1)) {
      this.currentFloor = 1;
      this.createNewFloor(1);
      this.updateFloorUI();
    }
  }

  getCurrentProjectState() {
    // Temporarily remove coverage areas and icons for clean serialization
    const coverageStates = this.prepareCoverageForSerialization();

    const cameraData = this.enhancedSaveSystem.cameraSerializer.serializeCameraDevices();
    const drawingData = this.enhancedSaveSystem.drawingSerializer.serializeDrawingObjects();
    const backgroundObjects = this.fabricCanvas.getObjects().filter((obj) => obj.isBackground || (obj.type === "image" && !obj.selectable && !obj.evented));
    const backgroundData = backgroundObjects.length > 0 ? this.fabricCanvas.toJSON(["isBackground", "pixelsPerMeter"]) : null;

    // Restore coverage areas
    this.restoreCoverageAfterSerialization(coverageStates);

    return {
      cameras: cameraData,
      drawing: drawingData,
      background: backgroundData,
      settings: {
        pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
        zoom: this.fabricCanvas.getZoom(),
        viewportTransform: [...this.fabricCanvas.viewportTransform],
        defaultDeviceIconSize: window.defaultDeviceIconSize || 30,
      },
      counters: {
        cameraCounter: window.cameraCounter || 1,
        deviceCounter: window.deviceCounter || 1,
      },
      globalState: {
        zones: window.zones || [],
        rooms: window.rooms || [],
      },
    };
  }

  prepareCoverageForSerialization() {
    const coverageStates = new Map();
    const allObjects = this.fabricCanvas.getObjects();

    allObjects.forEach((obj) => {
      if (obj.type === "group" && obj.deviceType && obj.coverageConfig) {
        const state = {
          coverageVisible: obj.coverageArea?.visible || false,
          leftIconVisible: obj.leftResizeIcon?.visible || false,
          rightIconVisible: obj.rightResizeIcon?.visible || false,
          rotateIconVisible: obj.rotateResizeIcon?.visible || false,
        };

        coverageStates.set(obj, state);

        // Temporarily remove from canvas
        [obj.coverageArea, obj.leftResizeIcon, obj.rightResizeIcon, obj.rotateResizeIcon].filter(Boolean).forEach((item) => this.fabricCanvas.remove(item));
      }
    });

    return coverageStates;
  }

  restoreCoverageAfterSerialization(coverageStates) {
    coverageStates.forEach((state, obj) => {
      if (obj.coverageArea) {
        // Add coverage area and attempt to position it immediately before
        // its parent device so it remains beneath the device but above
        // the background image which should be at the very back.
        this.fabricCanvas.add(obj.coverageArea);
        obj.coverageArea.set({ visible: state.coverageVisible });

        try {
          const deviceIndex = this.fabricCanvas.getObjects().indexOf(obj);
          if (deviceIndex !== -1) {
            // Remove then insert at deviceIndex to ensure correct ordering
            if (this.fabricCanvas.getObjects().includes(obj.coverageArea)) {
              this.fabricCanvas.remove(obj.coverageArea);
            }
            this.fabricCanvas.insertAt(obj.coverageArea, deviceIndex);
          } else if (state.coverageVisible) {
            // Fallback behaviour: send to back if device not found
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

  async switchToFloor(floorNumber) {
    if (floorNumber === this.currentFloor) return true;
    if (!this.floors.has(floorNumber)) {
      this.showNotification(`Floor ${floorNumber} does not exist`, false);
      return false;
    }

    try {
      if (!this.isLoading) this.saveCurrentFloorState();
      const targetFloorData = this.floors.get(floorNumber);

      // Reinitialize undo system BEFORE clearing/loading so load operations are not tracked
      if (window.undoSystem) window.undoSystem.reinitialize();

      this.clearCanvas();
      this.currentFloor = floorNumber;
      await this.loadFloorState(targetFloorData);
      this.updateFloorUI();

      // Clear any active selection after floor switch
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();

      // Ensure sidebar is hidden after floor switch
      if (window.hideDeviceProperties) {
        window.hideDeviceProperties();
      }
      // Enable undo tracking for subsequent user actions on the new floor
      if (window.undoSystem) window.undoSystem.enableTracking();

      this.showNotification(`Switched to Floor ${floorNumber}`, true);
      return true;
    } catch (error) {
      console.error("Error switching floors:", error);
      this.showNotification(`Error switching to Floor ${floorNumber}`, false);
      return false;
    }
  }

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
      settings: { pixelsPerMeter: 17.5, zoom: 1, viewportTransform: [1, 0, 0, 1, 0, 0], defaultDeviceIconSize: 30 },
      counters: { cameraCounter: 1, deviceCounter: 1 },
      globalState: {
        zones: [],
        rooms: [],
      },
      floorNumber: floorNumber,
      lastModified: Date.now(),
      name: `Floor ${floorNumber}`,
    };

    this.floors.set(floorNumber, emptyFloorState);
  }

  clearCanvas() {
    // Clear topology connections if manager exists
    if (window.topologyManager && typeof window.topologyManager.clearAllConnections === 'function') {
      try { window.topologyManager.clearAllConnections(); } catch (_) {}
    }
    // Clean up device event handlers
    this.fabricCanvas.getObjects().forEach((obj) => {
      if (obj.type === "group" && obj.deviceType && obj.coverageConfig) {
        ["added", "modified", "moving", "selected", "deselected"].forEach((event) => {
          const handler = obj[`${event}Handler`];
          if (handler) this.fabricCanvas.off(`object:${event}`, handler);
        });

        // Clear references
        obj.coverageConfig = null;
        obj.coverageArea = null;
        obj.leftResizeIcon = null;
        obj.rightResizeIcon = null;
        obj.rotateResizeIcon = null;
      }
    });

    // Clear any active selection before clearing canvas
    this.fabricCanvas.discardActiveObject();

    this.fabricCanvas.clear();

    // Reset global state including rooms
    Object.assign(window, {
      cameraCounter: 1,
      deviceCounter: 1,
      zones: [],
      rooms: [],
    });

    if (window.layers) {
      Object.keys(window.layers).forEach((layerName) => {
        window.layers[layerName].objects = [];
      });
    }

    this.fabricCanvas.requestRenderAll();
  }

  async loadFloorState(floorData) {
    try {
      // Apply settings
      if (floorData.settings) {
        const { pixelsPerMeter, zoom, viewportTransform, defaultDeviceIconSize } = floorData.settings;
        this.fabricCanvas.pixelsPerMeter = pixelsPerMeter || 17.5;
        window.defaultDeviceIconSize = defaultDeviceIconSize || 30;
        if (zoom) this.fabricCanvas.setZoom(zoom);
        if (viewportTransform) this.fabricCanvas.setViewportTransform(viewportTransform);
      }

      // Restore counters and global state including rooms
      if (floorData.counters) {
        Object.assign(window, floorData.counters);
      }
      if (floorData.globalState) {
        window.zones = floorData.globalState.zones || [];
        window.rooms = floorData.globalState.rooms || [];
      }

      // Load background
      await this.loadBackground(floorData.background);
      await this.delay(100);

      // Load drawing objects (includes zones and rooms)
      if (floorData.drawing) {
        await this.enhancedSaveSystem.drawingSerializer.loadDrawingObjects(floorData.drawing);
      }
      await this.delay(200);

      // Load devices with coverage
      await this.loadDevicesWithCoverage(floorData.cameras);

      // Restore topology after devices are in place
      try {
        const topologyData = floorData.drawing?.topology || floorData.topology;
        if (topologyData && window.topologyManager && Array.isArray(topologyData)) {
          // Small delay to ensure device positions/labels are settled
          await this.delay(50);
          window.topologyManager.loadConnectionsData(topologyData);
        }
      } catch (e) {
        console.warn('Failed to load floor topology', e);
      }

      // Initialize layers
      if (window.initCanvasLayers) window.initCanvasLayers(this.fabricCanvas);

      // Final cleanup
      setTimeout(() => {
        this.cleanupOrphanedResizeIcons();

        // Force hide all camera resize icons after loading
        this.forceHideAllResizeIcons();

        // Set up event handlers for devices that were loaded without them
        this.setupDeferredEventHandlers();

        // Ensure no objects are selected after floor loading
        this.fabricCanvas.discardActiveObject();

        // Hide device properties sidebar if it's showing
        if (window.hideDeviceProperties) {
          window.hideDeviceProperties();
        }

        this.fabricCanvas.requestRenderAll();
      }, 300);
    } catch (error) {
      console.error("Error loading floor state:", error);
      throw error;
    }
  }

  async loadBackground(backgroundData) {
    if (!backgroundData?.objects) return;

    const backgroundObjects = backgroundData.objects.filter((obj) => obj.type === "image" && (obj.isBackground || (!obj.selectable && !obj.evented)));

    if (backgroundObjects.length === 0) return;

    return new Promise((resolve) => {
      this.fabricCanvas.loadFromJSON(
        {
          version: backgroundData.version,
          objects: backgroundObjects,
        },
        () => {
          this.fabricCanvas.getObjects().forEach((obj) => {
            if (obj.isBackground) {
              obj.set({
                selectable: false,
                evented: false,
                hoverCursor: "default",
              });
              this.fabricCanvas.sendToBack(obj);
            }
          });
          this.fabricCanvas.requestRenderAll();
          resolve();
        }
      );
    });
  }

  async loadDevicesWithCoverage(camerasData) {
    if (!camerasData?.cameraDevices?.length) return;

    // Set a global flag to prevent coverage creation during floor loading
    window.isLoadingFloor = true;

    // Temporarily disable coverage creation completely
    const originalAddCoverage = window.addCameraCoverage;
    window.addCameraCoverage = () => {};

    // Load all devices WITHOUT selecting them and WITHOUT coverage
    for (let i = 0; i < camerasData.cameraDevices.length; i++) {
      try {
        // Pass skipSelection = true to prevent automatic selection
        await this.enhancedSaveSystem.cameraSerializer.loadCameraDevice(camerasData.cameraDevices[i], true);
        if (i < camerasData.cameraDevices.length - 1) {
          await this.delay(50);
        }
      } catch (error) {
        console.error(`Failed to load device ${i + 1}:`, error);
      }
    }

    // Wait a moment for all devices to be fully loaded
    await this.delay(100);

    // Clear the loading flag BEFORE restoring coverage
    window.isLoadingFloor = false;

    // Restore coverage creation and apply to all camera devices
    window.addCameraCoverage = originalAddCoverage;

    const cameraDevices = this.fabricCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig);

    for (const device of cameraDevices) {
      if (device.coverageConfig && originalAddCoverage) {
        // Clean up any existing coverage
        [device.coverageArea, device.leftResizeIcon, device.rightResizeIcon, device.rotateResizeIcon].filter(Boolean).forEach((item) => this.fabricCanvas.remove(item));

        // Recreate coverage with loading awareness
        originalAddCoverage(this.fabricCanvas, device);

        // Immediately force hide resize icons after creation (but KEEP them evented so mousedown works)
        await this.delay(10);
        ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
          if (device[iconProp]) {
            // Only change visibility; do NOT disable events (was breaking popover hide during resize after load)
            device[iconProp].set({ visible: false });
            device[iconProp].visible = false;
            // Ensure event handling remains enabled
            device[iconProp].evented = true;
          }
        });

        if (device.coverageArea) {
          const shouldBeVisible = device.coverageConfig.visible !== false;
          device.coverageArea.set({ visible: shouldBeVisible });
        }
      }
    }

    // Ensure no devices are selected after loading
    this.fabricCanvas.discardActiveObject();
  }

  forceHideAllResizeIcons() {
    // Find all camera devices and force hide their resize icons
    const cameraDevices = this.fabricCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig);

    cameraDevices.forEach((device) => {
      ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
        if (device[iconProp]) {
          // Hide but keep interactive so resize logic (which toggles popover) still works post-load
          device[iconProp].set({ visible: false });
          device[iconProp].visible = false;
          device[iconProp].evented = true; // safeguard
        }
      });
    });

    // Also find any standalone resize icons and hide them
    const standaloneResizeIcons = this.fabricCanvas.getObjects().filter((obj) => obj.isResizeIcon === true);

    standaloneResizeIcons.forEach((icon) => {
      icon.set({ visible: false });
      icon.visible = false;
    });
  }

  setupDeferredEventHandlers() {
    // Find all devices that have deferred event handlers
    const devicesWithDeferredHandlers = this.fabricCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType && obj._deferEventHandlers);

    devicesWithDeferredHandlers.forEach((device) => {
      // Set up the event handlers now that loading is complete
      if (this.enhancedSaveSystem.cameraSerializer.addDeviceEventHandlers) {
        this.enhancedSaveSystem.cameraSerializer.addDeviceEventHandlers(device);
      }

      // Remove the flag
      delete device._deferEventHandlers;

      // Ensure any resize icons (if camera) are still evented so mousedown handlers fire
      ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconProp) => {
        if (device[iconProp]) device[iconProp].evented = true;
      });
    });
  }

  cleanupOrphanedResizeIcons() {
    const allObjects = this.fabricCanvas.getObjects();
    const deviceGroups = allObjects.filter((obj) => obj.type === "group" && obj.deviceType);

    // Remove orphaned resize icons
    const resizeIcons = allObjects.filter((obj) => obj.isResizeIcon === true);
    resizeIcons.forEach((icon) => {
      const belongsToDevice = deviceGroups.some((device) => [device.leftResizeIcon, device.rightResizeIcon, device.rotateResizeIcon].includes(icon));
      if (!belongsToDevice) this.fabricCanvas.remove(icon);
    });

    // Remove orphaned coverage areas
    const coverageAreas = allObjects.filter((obj) => obj.isCoverage || (obj.type === "polygon" && obj.fill?.includes("165, 155, 155")));
    coverageAreas.forEach((area) => {
      const belongsToDevice = deviceGroups.some((device) => device.coverageArea === area);
      if (!belongsToDevice) this.fabricCanvas.remove(area);
    });
  }

  setupFloorControls() {
    this.setupFloorEventListeners();
    this.updateFloorUI();
  }

  setupFloorEventListeners() {
    const handlers = {
      "floor-prev": () => this.navigateFloor(-1),
      "floor-next": () => this.navigateFloor(1),
      "floor-add": () => this.addNewFloor(),
      "floor-delete": () => this.deleteCurrentFloor(),
      "floor-rename": () => this.renameCurrentFloor(),
    };

    Object.entries(handlers).forEach(([id, handler]) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener("click", handler);
    });
  }

  navigateFloor(direction) {
    const existingFloors = Array.from(this.floors.keys()).sort((a, b) => a - b);
    const currentIndex = existingFloors.indexOf(this.currentFloor);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < existingFloors.length) {
      this.switchToFloor(existingFloors[newIndex]);
    }
  }

  updateFloorUI() {
    const floorDisplay = document.getElementById("floor-display");
    if (floorDisplay) {
      const currentFloorData = this.floors.get(this.currentFloor);
      const displayName = currentFloorData?.name || `Floor ${this.currentFloor}`;
      floorDisplay.textContent = displayName;
    }

    const existingFloors = Array.from(this.floors.keys()).sort((a, b) => a - b);
    const currentIndex = existingFloors.indexOf(this.currentFloor);

    // Update navigation buttons
    const prevBtn = document.getElementById("floor-prev");
    const nextBtn = document.getElementById("floor-next");
    const deleteBtn = document.getElementById("floor-delete");

    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= existingFloors.length - 1;
    if (deleteBtn) deleteBtn.disabled = this.floors.size <= 1;

    this.updateQuickJumpButtons();
  }

  updateQuickJumpButtons() {
    const quickJumpContainer = document.getElementById("floor-quick-jump");
    if (!quickJumpContainer) return;

    quickJumpContainer.innerHTML = "";

    // Get all existing floor numbers and determine the range
    const existingFloors = Array.from(this.floors.keys()).sort((a, b) => a - b);
    const maxFloor = Math.max(...existingFloors, 5); // Show at least up to floor 5
    const minFloor = 1;

    // Show buttons for floors 1 through the highest existing floor (minimum 5)
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const button = document.createElement("button");
      const isCurrent = floor === this.currentFloor;
      const hasData = this.floors.has(floor);

      button.textContent = floor.toString();
      button.className = "btn btn-sm";

      if (hasData && !isCurrent) {
        button.classList.add("floor-available");
        this.styleFloorButton(button, "available");
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.switchToFloor(floor);
        });
      } else if (hasData && isCurrent) {
        button.classList.add("current-floor");
        this.styleFloorButton(button, "current");
      } else {
        button.classList.add("floor-unavailable");
        this.styleFloorButton(button, "unavailable");
        button.disabled = true;
        button.title = `Floor ${floor} - Not created`;
      }

      quickJumpContainer.appendChild(button);
    }
  }

  styleFloorButton(button, type) {
    const baseStyle = "width: 35px; height: 30px; font-size: 0.8rem; border-radius: 0.25rem;";

    const styles = {
      available: `${baseStyle} background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; cursor: pointer;`,
      current: `${baseStyle} background: var(--orange-ip2); border: 1px solid var(--orange-ip2); color: white; cursor: default; opacity: 1;`,
      unavailable: `${baseStyle} background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.4); cursor: not-allowed; opacity: 0.5; pointer-events: none;`,
    };

    button.style.cssText = styles[type];
  }

  addNewFloor() {
    let newFloorNumber = 1;
    while (this.floors.has(newFloorNumber) && newFloorNumber <= this.maxFloors) {
      newFloorNumber++;
    }

    if (newFloorNumber > this.maxFloors) {
      this.showNotification(`Maximum ${this.maxFloors} floors allowed`, false);
      return;
    }

    this.createNewFloor(newFloorNumber);
    this.switchToFloor(newFloorNumber);
  }

  deleteCurrentFloor() {
    if (this.floors.size <= 1) {
      this.showNotification("Cannot delete the last floor", false);
      return;
    }

    const currentFloorData = this.floors.get(this.currentFloor);
    const floorName = currentFloorData?.name || `Floor ${this.currentFloor}`;

    if (!confirm(`Are you sure you want to delete ${floorName}? This action cannot be undone.`)) {
      return;
    }

    const floorToDelete = this.currentFloor;
    const availableFloors = Array.from(this.floors.keys()).sort((a, b) => a - b);

    // Find target floor (prefer lower floors, then higher)
    const lowerFloors = availableFloors.filter((f) => f < floorToDelete);
    const higherFloors = availableFloors.filter((f) => f > floorToDelete);
    const targetFloor = lowerFloors.length > 0 ? Math.max(...lowerFloors) : Math.min(...higherFloors);

    this.isLoading = true;
    this.switchToFloor(targetFloor).then(() => {
      this.floors.delete(floorToDelete);
      this.isLoading = false;
      setTimeout(() => this.updateFloorUI(), 100);
    });

    this.showNotification(`${floorName} deleted`, true);
  }

  renameCurrentFloor() {
    const currentFloorData = this.floors.get(this.currentFloor);
    const currentName = currentFloorData?.name || `Floor ${this.currentFloor}`;
    const newName = prompt("Enter new floor name:", currentName);

    if (newName && newName.trim() && newName.trim() !== currentName) {
      if (currentFloorData) {
        currentFloorData.name = newName.trim();
        this.updateFloorUI();
        this.showNotification(`Floor renamed to "${newName.trim()}"`, true);
      }
    }
  }

  showNotification(message, isSuccess = true) {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 12px 24px;
      background: ${isSuccess ? "#f8794b" : "#f8794b"}; color: white;
      border-radius: 4px; z-index: 10000; font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: opacity 0.3s ease;
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => document.body.contains(notification) && document.body.removeChild(notification), 300);
    }, 3000);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Public API methods
  getCurrentFloor() {
    return this.currentFloor;
  }
  getFloorCount() {
    return this.floors.size;
  }
  getFloorList() {
    return Array.from(this.floors.keys()).sort((a, b) => a - b);
  }
  hasFloor(floorNumber) {
    return this.floors.has(floorNumber);
  }
}

export function initFloorManager(fabricCanvas, enhancedSaveSystem) {
  const floorManager = new FloorManager(fabricCanvas, enhancedSaveSystem);
  window.floorManager = floorManager;
  return floorManager;
}
