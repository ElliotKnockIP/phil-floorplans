import { CameraDeviceSerializer } from "./camera-device-save.js";
import { DrawingObjectSerializer } from "./drawing-save.js";
import { ObjectTypeUtils, SerializationUtils, FormUtils, NotificationSystem } from "./save-utils.js";

class EnhancedSaveSystem {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.cameraSerializer = new CameraDeviceSerializer(fabricCanvas);
    this.drawingSerializer = new DrawingObjectSerializer(fabricCanvas);
  }

  // Use centralized utilities
  isCameraDevice = ObjectTypeUtils.isCameraDevice;
  isDevice = ObjectTypeUtils.isDevice;
  isManagedObject = ObjectTypeUtils.isManagedObject;

  // Serialize client details from sidebar
  serializeClientDetails() {
    return {
      date: FormUtils.getValue("client-date-input"),
      clientName: FormUtils.getValue("client-name-test-input"),
      address: FormUtils.getValue("address-input"),
      reportTitle: FormUtils.getValue("report-title-input"),
      rev1: FormUtils.getValue("rev-one-input"),
      rev2: FormUtils.getValue("rev-two-input"),
      rev3: FormUtils.getValue("rev-three-input"),
      logoFile: this.getLogoData(),
    };
  }

  getLogoData() {
    const logoImg = document.querySelector("#client-logo-preview img");
    return logoImg
      ? {
          present: true,
          src: logoImg.src,
          alt: logoImg.alt || "Client Logo",
        }
      : null;
  }

  // Serialize screenshot previews from the sidebar
  serializeScreenshots() {
    const screenshots = [];
    const screenshotPreviews = document.querySelectorAll(".screenshot-preview-item");

    screenshotPreviews.forEach((preview, index) => {
      const img = preview.querySelector(".screenshot-image");
      const checkbox = preview.querySelector(".screenshot-checkbox");
      const titleTextarea = preview.querySelector(".screenshot-title");

      if (img && img.src) {
        screenshots.push({
          id: Date.now() + index, // Create unique ID
          dataURL: img.src,
          includeInPrint: checkbox ? checkbox.checked : false,
          title: titleTextarea ? titleTextarea.value.trim() : `Screenshot ${index + 1}`,
          order: index,
        });
      }
    });

    return screenshots;
  }

  // Serialize topology data
  serializeTopologyData() {
    if (window.topologyManager) {
      return window.topologyManager.getConnectionsData();
    }
    return [];
  }

  saveProject() {
    try {
      // Serialize cameras/devices
      const cameraData = this.cameraSerializer.serializeCameraDevices();

      // Serialize drawing objects (including walls, zones, and rooms)
      const drawingData = this.drawingSerializer.serializeDrawingObjects();

      // Serialize client details
      const clientDetails = this.serializeClientDetails();

      // Serialize screenshots
      const screenshots = this.serializeScreenshots();

      // Serialize topology data
      const topologyData = this.serializeTopologyData();

      const allObjects = this.fabricCanvas.getObjects();

      // Store coverage states
      const coverageStates = new Map();
      allObjects.forEach((obj) => {
        if (this.isDevice(obj) && obj.coverageArea) {
          coverageStates.set(obj.id || obj, {
            visible: obj.coverageArea.visible,
            coverageArea: obj.coverageArea,
          });
          obj.coverageArea.set({ visible: true });
        }
      });

      // Temporarily remove managed objects AND drawing objects for clean background serialization
      const managedObjects = allObjects.filter((obj) => this.isManagedObject(obj));
      const drawingObjects = allObjects.filter((obj) => this.drawingSerializer.isDrawingObject(obj));
      const objectsToRemove = [...new Set([...managedObjects, ...drawingObjects])];

      objectsToRemove.forEach((obj) => this.fabricCanvas.remove(obj));

      // Serialize only the background
      const canvasData = this.fabricCanvas.toJSON(["class", "associatedText", "pixelsPerMeter", "isBackground"]);

      // Re-add all objects
      objectsToRemove.forEach((obj) => this.fabricCanvas.add(obj));

      // Restore coverage states
      allObjects.forEach((obj) => {
        if (this.isDevice(obj) && obj.coverageArea) {
          const savedState = coverageStates.get(obj.id || obj);
          if (savedState) {
            obj.coverageArea.visible = savedState.visible;
            obj.coverageArea.set({ visible: savedState.visible });
            if (savedState.visible && obj.createOrUpdateCoverageArea) {
              obj.createOrUpdateCoverageArea();
            }
          }
        }
      });

      this.fabricCanvas.renderAll();

      const settings = {
        pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
        zoom: this.fabricCanvas.getZoom(),
        viewportTransform: [...this.fabricCanvas.viewportTransform],
        defaultDeviceIconSize: window.defaultDeviceIconSize || 30,
        globalIconTextVisible: window.globalIconTextVisible !== undefined ? !!window.globalIconTextVisible : true,
        globalDeviceColor: window.globalDeviceColor || "#f8794b",
        globalTextColor: window.globalTextColor || "#FFFFFF",
        globalFont: window.globalFont || "Poppins, sans-serif",
        globalTextBackground: window.globalTextBackground !== undefined ? !!window.globalTextBackground : true,
        globalBoldText: window.globalBoldText !== undefined ? !!window.globalBoldText : false,
        globalCompleteDeviceIndicator: window.globalCompleteDeviceIndicator !== undefined ? !!window.globalCompleteDeviceIndicator : true,
      };

      const projectData = {
        version: "3.3",
        timestamp: new Date().toISOString(),
        cameras: cameraData,
        drawing: drawingData,
        canvas: canvasData,
        clientDetails,
        screenshots,
        topology: topologyData,
        settings,
      };

      this.downloadFile(projectData, `project_${new Date().toISOString().split("T")[0]}.json`);
      NotificationSystem.show("Project saved successfully!", true);
      return true;
    } catch (error) {
      console.error("Error saving project:", error);
      NotificationSystem.show("Error saving project: " + error.message, false);
      return false;
    }
  }

  // Load client details to sidebar form fields
  async loadClientDetailsToSidebar(clientDetails) {
    try {
      // Set form field values using utility
      const fieldMappings = {
        "client-date-input": clientDetails.date,
        "client-name-test-input": clientDetails.clientName,
        "address-input": clientDetails.address,
        "report-title-input": clientDetails.reportTitle,
        "rev-one-input": clientDetails.rev1,
        "rev-two-input": clientDetails.rev2,
        "rev-three-input": clientDetails.rev3,
      };

      Object.entries(fieldMappings).forEach(([id, value]) => {
        FormUtils.setValue(id, value);
      });

      // Handle client logo
      const logoPreview = document.getElementById("client-logo-preview");
      if (logoPreview && clientDetails.logoFile && clientDetails.logoFile.present) {
        logoPreview.innerHTML = `<img src="${clientDetails.logoFile.src}" alt="${clientDetails.logoFile.alt}" style="max-width: 100%; max-height: 100px;">`;
        try {
          localStorage.setItem("clientLogoDataUrl", clientDetails.logoFile.src);
        } catch (_) {}

        // Trigger any logo change events
        const logoChangeEvent = new CustomEvent("logoChanged", {
          detail: { src: clientDetails.logoFile.src },
        });
        logoPreview.dispatchEvent(logoChangeEvent);
      } else if (logoPreview) {
        logoPreview.innerHTML = '<span style="color: #999">No logo selected</span>';
        try {
          localStorage.removeItem("clientLogoDataUrl");
        } catch (_) {}
      }

      // Trigger any global update events that the titleblock system might be listening for
      if (typeof window.updateAllTitleBlocks === "function") {
        setTimeout(() => window.updateAllTitleBlocks(), 100);
      }
    } catch (error) {
      console.error("Error loading client details to sidebar:", error);
    }
  }

  // Load screenshots to sidebar previews
  async loadScreenshotsToSidebar(screenshots) {
    try {
      if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
        return;
      }

      const screenshotPreviews = document.getElementById("screenshot-previews");
      const template = document.getElementById("screenshot-preview-template");

      if (!screenshotPreviews || !template) {
        console.warn("Screenshot preview elements not found");
        return;
      }

      // Clear existing previews
      screenshotPreviews.innerHTML = "";

      // Sort screenshots by order to maintain the original sequence
      const sortedScreenshots = screenshots.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Store screenshots in a temporary array
      const tempScreenshots = [];

      // Recreate each screenshot preview
      for (const screenshot of sortedScreenshots) {
        try {
          // Create the screenshot object
          const screenshotObj = {
            dataURL: screenshot.dataURL,
            includeInPrint: screenshot.includeInPrint || false,
            id: screenshot.id || Date.now() + Math.random(),
          };

          tempScreenshots.push(screenshotObj);

          // Clone the template
          const previewContainer = template.content.cloneNode(true);
          const previewItem = previewContainer.querySelector(".screenshot-preview-item");

          // Update the cloned elements
          const img = previewItem.querySelector(".screenshot-image");
          img.src = screenshot.dataURL;
          img.alt = screenshot.title || `Screenshot ${tempScreenshots.length}`;

          const checkbox = previewItem.querySelector(".screenshot-checkbox");
          checkbox.id = `screenshot-${screenshotObj.id}`;
          checkbox.checked = screenshot.includeInPrint || false;

          const label = previewItem.querySelector(".screenshot-checkbox-label");
          label.setAttribute("for", checkbox.id);

          const titleTextarea = previewItem.querySelector(".screenshot-title");
          if (titleTextarea && screenshot.title) {
            titleTextarea.value = screenshot.title;
          }

          // Add event listeners
          checkbox.addEventListener("change", () => {
            screenshotObj.includeInPrint = checkbox.checked;
            // Also try to update canvasCrop if available
            if (window.canvasCrop && typeof window.canvasCrop.getScreenshots === "function") {
              const canvasCropScreenshots = window.canvasCrop.getScreenshots();
              const match = canvasCropScreenshots.find((s) => s.dataURL === screenshotObj.dataURL);
              if (match) {
                match.includeInPrint = checkbox.checked;
              }
            }
          });

          const deleteBtn = previewItem.querySelector(".screenshot-delete-btn");
          deleteBtn.addEventListener("click", () => {
            // Remove from temp array
            const index = tempScreenshots.indexOf(screenshotObj);
            if (index > -1) {
              tempScreenshots.splice(index, 1);
            }

            // Remove from canvasCrop if available
            if (window.canvasCrop && typeof window.canvasCrop.getScreenshots === "function") {
              const canvasCropScreenshots = window.canvasCrop.getScreenshots();
              const canvasCropIndex = canvasCropScreenshots.findIndex((s) => s.dataURL === screenshotObj.dataURL);
              if (canvasCropIndex > -1) {
                canvasCropScreenshots.splice(canvasCropIndex, 1);
              }
            }

            previewItem.remove();
          });

          // Append the preview item to the container
          screenshotPreviews.appendChild(previewContainer);
        } catch (error) {
          console.error("Error loading individual screenshot:", error, screenshot);
        }
      }

      // Try to integrate with canvasCrop after a short delay
      setTimeout(() => {
        try {
          if (window.canvasCrop && typeof window.canvasCrop.getScreenshots === "function") {
            const canvasCropScreenshots = window.canvasCrop.getScreenshots();
            // Clear existing and add our screenshots
            canvasCropScreenshots.length = 0;
            canvasCropScreenshots.push(...tempScreenshots);
          } else {
            console.warn("CanvasCrop not available, storing screenshots globally");
            // Store globally as fallback
            window.loadedScreenshots = tempScreenshots;
          }

          // Force update the screenshot status
          setTimeout(() => {
            // Update the "No screenshots taken" display
            const noScreenshotElement = document.getElementById("no-screenshot-taken");
            if (noScreenshotElement) {
              noScreenshotElement.style.display = tempScreenshots.length > 0 ? "none" : "block";
            }

            // Trigger any existing screenshot status update functions
            if (window.updateScreenshotStatus) {
              window.updateScreenshotStatus();
            }

            // Force mutation observer to fire by modifying the container
            const screenshotContainer = document.getElementById("screenshot-previews");
            if (screenshotContainer) {
              // Temporarily add and remove an element to trigger mutation observer
              const tempDiv = document.createElement("div");
              tempDiv.style.display = "none";
              screenshotContainer.appendChild(tempDiv);
              setTimeout(() => {
                if (screenshotContainer.contains(tempDiv)) {
                  screenshotContainer.removeChild(tempDiv);
                }
              }, 10);
            }
          }, 100);
        } catch (error) {
          console.error("Error integrating with canvasCrop:", error);
          window.loadedScreenshots = tempScreenshots;
        }
      }, 500);
    } catch (error) {
      console.error("Error loading screenshots to sidebar:", error);
    }
  }

  // Load topology data (expects devices to already be present on the canvas)
  async loadTopologyData(topologyData) {
    try {
      if (window.topologyManager && Array.isArray(topologyData)) {
        // Small delay to allow device layout/render to settle
        setTimeout(() => {
          try {
            window.topologyManager.loadConnectionsData(topologyData);
          } catch (e) {
            console.error("Topology load failed:", e);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error loading topology data:", error);
    }
  }

  downloadFile(data, filename) {
    SerializationUtils.downloadFile(data, filename);
  }

  async loadProject(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          window.isLoadingProject = true;
          const projectData = JSON.parse(e.target.result);

          // Reinitialize undo system when loading new project
          if (window.undoSystem) {
            window.undoSystem.reinitialize();
          }

          // Unregister coverage event listeners from existing devices
          const existingObjects = this.fabricCanvas.getObjects();
          existingObjects.forEach((obj) => {
            if (this.isDevice(obj) && obj.coverageConfig) {
              ["added", "modified", "moving"].forEach((event) => {
                const handler = obj[`${event}Handler`];
                if (handler) {
                  this.fabricCanvas.off(`object:${event}`, handler);
                }
              });
            }
          });

          // Clear canvas
          this.fabricCanvas.clear();
          this.fabricCanvas.getObjects().forEach((obj) => this.fabricCanvas.remove(obj));
          this.fabricCanvas.renderAll();

          // IMPORTANT: Clear global arrays to prevent deleted objects from reappearing
          window.zones = [];
          window.rooms = [];

          // Reset global state including rooms
          const counters = projectData.cameras?.counters || {};
          const savedSettings = projectData.settings || {};
          const savedZoom = typeof savedSettings.zoom === "number" ? savedSettings.zoom : null;
          const savedViewportTransform = Array.isArray(savedSettings.viewportTransform) ? [...savedSettings.viewportTransform] : null;
          Object.assign(window, {
            cameraCounter: counters.cameraCounter || 1,
            deviceCounter: counters.deviceCounter || 1,
            defaultDeviceIconSize: savedSettings.defaultDeviceIconSize || 30,
            globalIconTextVisible: savedSettings.globalIconTextVisible !== undefined ? !!savedSettings.globalIconTextVisible : true,
            globalDeviceColor: savedSettings.globalDeviceColor || "#f8794b",
            globalTextColor: savedSettings.globalTextColor || "#FFFFFF",
            globalFont: savedSettings.globalFont || "Poppins, sans-serif",
            globalTextBackground: savedSettings.globalTextBackground !== undefined ? !!savedSettings.globalTextBackground : true,
            globalBoldText: savedSettings.globalBoldText !== undefined ? !!savedSettings.globalBoldText : false,
            globalCompleteDeviceIndicator: savedSettings.globalCompleteDeviceIndicator !== undefined ? !!savedSettings.globalCompleteDeviceIndicator : true,
          });

          // Apply settings
          if (projectData.settings) {
            const { pixelsPerMeter, zoom, viewportTransform } = projectData.settings;
            this.fabricCanvas.pixelsPerMeter = pixelsPerMeter || 17.5;
            if (zoom) this.fabricCanvas.setZoom(zoom);
            if (viewportTransform) this.fabricCanvas.setViewportTransform(viewportTransform);
          }

          // Load client details to sidebar FIRST
          if (projectData.clientDetails) {
            await this.loadClientDetailsToSidebar(projectData.clientDetails);
          }

          // Load screenshots to sidebar
          if (projectData.screenshots) {
            await this.loadScreenshotsToSidebar(projectData.screenshots);
          }

          // (Deferred) Topology is loaded AFTER devices (see below)

          // Load background first
          if (projectData.canvas?.objects) {
            const backgroundObjects = projectData.canvas.objects.filter((obj) => obj.type === "image" && (obj.isBackground || (!obj.selectable && !obj.evented)));

            if (backgroundObjects.length > 0) {
              await new Promise((resolveCanvas) => {
                this.fabricCanvas.loadFromJSON(
                  {
                    version: projectData.canvas.version,
                    objects: backgroundObjects,
                  },
                  () => {
                    // Set background flags
                    this.fabricCanvas.getObjects().forEach((obj) => {
                      if (obj.isBackground) {
                        obj.set({
                          selectable: false,
                          evented: false,
                          hoverCursor: "default",
                        });
                      }
                    });
                    this.fabricCanvas.requestRenderAll();
                    resolveCanvas();
                  }
                );
              });
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 100));

          // Load drawing objects (including walls, zones, and rooms)
          if (projectData.drawing) {
            try {
              await this.drawingSerializer.loadDrawingObjects(projectData.drawing);
            } catch (error) {
              console.error("Error loading drawing objects:", error);
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 200));

          // Load devices; topology will be loaded immediately after
          const devices = projectData.cameras?.cameraDevices;
          if (devices?.length) {
            for (let i = 0; i < devices.length; i++) {
              try {
                await this.cameraSerializer.loadCameraDevice(devices[i]);
                if (i < devices.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              } catch (error) {
                console.error(`Failed to load device ${i + 1}:`, error);
              }
            }
          }

          if (projectData.settings) {
            window.pendingGlobalSettings = projectData.settings;
            if (window.globalSettingsAPI && typeof window.globalSettingsAPI.applySettingsFromSave === "function") {
              window.globalSettingsAPI.applySettingsFromSave(projectData.settings);
            } else {
              const fallbackToggle = typeof document !== "undefined" ? document.getElementById("global-icon-text-toggle") : null;
              if (fallbackToggle && projectData.settings.globalIconTextVisible !== undefined) {
                fallbackToggle.checked = !!projectData.settings.globalIconTextVisible;
              }
            }
            setTimeout(() => {
              if (window.globalSettingsAPI && typeof window.globalSettingsAPI.applySettingsFromSave === "function") {
                window.globalSettingsAPI.applySettingsFromSave(projectData.settings);
                window.pendingGlobalSettings = null;
              }
            }, 50);
          }

          // Now that devices exist, load topology so connections can attach
          if (projectData.topology && window.topologyManager) {
            await this.loadTopologyData(projectData.topology);
          }

          // Cleanup pass: remove any legacy connection lines that may have been loaded as drawing objects
          try {
            if (window.topologyManager && typeof window.topologyManager.removeLegacyConnectionLines === 'function') {
              window.topologyManager.removeLegacyConnectionLines();
            }
          } catch (_) {}

          // Initialize layers
          if (window.initCanvasLayers) window.initCanvasLayers(this.fabricCanvas);

          // Re-categorize layers and ensure proper ordering
          setTimeout(() => {
            const allObjects = this.fabricCanvas.getObjects();

            // Categorize device labels
            allObjects.forEach((obj) => {
              if (obj.type === "text" && obj.isDeviceLabel) {
                const parentDevice = allObjects.find((device) => device.type === "group" && device.deviceType && device.textObject === obj);
                if (parentDevice) obj.parentDeviceType = parentDevice.deviceType;
              }
            });

            // Ensure proper layer order for zones and rooms
            if (window.maintainZoneLayerOrder) {
              window.maintainZoneLayerOrder();
            }

            if (window.maintainRoomLayerOrder) {
              window.maintainRoomLayerOrder();
            }

            if (window.initCanvasLayers) window.initCanvasLayers(this.fabricCanvas);

            if (savedZoom) {
              this.fabricCanvas.setZoom(savedZoom);
            }
            if (savedViewportTransform) {
              this.fabricCanvas.setViewportTransform(savedViewportTransform);
            }
            if (typeof window.updateZoomDisplay === "function") {
              window.updateZoomDisplay();
            }

            // CRITICAL FIX: Reinitialize ALL drawing tools AFTER everything is loaded
            this.reinitializeAllDrawingTools();

            // Trigger titleblock updates after everything is loaded
            if (typeof window.updateAllTitleBlocks === "function") {
              setTimeout(() => window.updateAllTitleBlocks(), 500);
            }

            // Re-enable undo tracking ONLY after everything is fully loaded
            if (window.undoSystem) {
              setTimeout(() => {
                window.undoSystem.enableTracking();
              }, 100);
            }
          }, 300);

          this.fabricCanvas.requestRenderAll();
          // Clear any residual snap lines created during load
          if (window.canvasSnapping && typeof window.canvasSnapping.clearSnapLines === "function") {
            window.canvasSnapping.clearSnapLines();
          }
          NotificationSystem.show("Project loaded successfully!", true);
          // Ensure undo tracking is enabled for single-floor project loads
          if (window.undoSystem) {
            window.undoSystem.enableTracking();
          }
          window.isLoadingProject = false;
          resolve(true);
        } catch (error) {
          console.error("Error loading project:", error);
          NotificationSystem.show("Error loading project: " + error.message, false);
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

  // NEW METHOD: Properly reinitialize ALL drawing tools after loading
  reinitializeAllDrawingTools() {
    try {
      // Import and setup all drawing tools
  import("./drawing-utils.js").then(({ setupDeletion, setupColorPicker, setupTextColorPicker, setupBackgroundColorPicker }) => {
        // Setup deletion for ALL drawing object types
        setupDeletion(this.fabricCanvas, (obj) => {
          // Enhanced condition to include all drawing objects
          if (obj.type === "i-text" && obj.isEditing) return false;
          if (this.fabricCanvas.getObjects().some((o) => o.type === "i-text" && o.isEditing)) return false;

          // Include zones, rooms, and all drawing objects
          return (
            (obj.type === "polygon" && (obj.class === "zone-polygon" || obj.class === "room-polygon")) ||
            (obj.type === "i-text" && (obj.class === "zone-text" || obj.class === "room-text")) ||
            (obj.type === "circle" && obj.isWallCircle === true) ||
            (obj.type === "line" && obj.stroke === "red") ||
            (obj.type === "circle" && obj.type === "circle" && !obj.isWallCircle && !obj.isDeviceLabel) ||
            (obj.type === "rect" && !obj.deviceType) ||
            (obj.type === "i-text" && !obj.class && !obj.isDeviceLabel) ||
            (obj.type === "textbox" && !obj.isHeader && !obj.deviceType) ||
            (obj.type === "line" && obj.stroke !== "red" && obj.stroke !== "grey" && obj.stroke !== "blue") ||
            (obj.type === "triangle" && !obj.deviceType) ||
            (obj.type === "group" && obj.isArrow) ||
            (obj.type === "image" && obj.isUploadedImage)
          );
        });

        // Setup color picker
        setupColorPicker(this.fabricCanvas);
        if (typeof setupTextColorPicker === "function") setupTextColorPicker(this.fabricCanvas);
        if (typeof setupBackgroundColorPicker === "function") setupBackgroundColorPicker(this.fabricCanvas);
      });

      // Reinitialize shape tools
      import("./shapes.js").then(({ setupShapeTools }) => {
        setupShapeTools(this.fabricCanvas);
      });

      // Reinitialize text tools
      import("./text-tools.js").then(({ setupTextTools }) => {
        setupTextTools(this.fabricCanvas);
      });

      // Reinitialize network link tool
      import("../drawing/network-link.js").then(({ setupNetworkLinkTool }) => {
        setupNetworkLinkTool(this.fabricCanvas);
      });

      // Reinitialize zone tool
      if (window.setupZoneTool) {
        window.setupZoneTool(this.fabricCanvas);
      }

      // Reinitialize room tool
      if (window.setupRoomTool) {
        window.setupRoomTool(this.fabricCanvas);
      }

      // Reinitialize wall tool
      if (window.setupWallTool) {
        window.setupWallTool(this.fabricCanvas);
      }
    } catch (error) {
      console.error("Error reinitializing drawing tools:", error);
    }
  }

  isSerializedDevice(obj) {
    return this.isDevice(obj) || (obj.type === "text" && obj.isDeviceLabel) || (obj.type === "polygon" && obj.fill?.includes("165, 155, 155")) || obj.isResizeIcon === true || (obj.type === "circle" && obj.fill === "#f8794b" && obj.radius < 30 && !obj.isWallCircle) || obj.isCoverage === true;
  }

  setupButtonIntegration() {
    const checkButtons = setInterval(() => {
      const saveButton = document.getElementById("save-project-btn");
      const loadButton = document.getElementById("load-project-btn");

      if (saveButton && loadButton) {
        clearInterval(checkButtons);

        // Setup save button
        const originalSaveHandler = saveButton.onclick;
        saveButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Call original handler if exists
          if (typeof originalSaveHandler === "function") {
            try {
              originalSaveHandler.call(saveButton, e);
            } catch (err) {
              console.warn("Original save handler failed:", err);
            }
          }

          this.saveProject();
          return false;
        };

        // Setup load button
        this.setupLoadButton(loadButton);
      }
    }, 100);

    setTimeout(() => clearInterval(checkButtons), 10000);
  }

  setupLoadButton(loadButton) {
    // Find the existing file input in the HTML
    const existingFileInput = document.getElementById("load-project-input");

    if (existingFileInput) {
      // Remove any existing event listeners to prevent duplicates
      const newFileInput = existingFileInput.cloneNode(true);
      existingFileInput.parentNode.replaceChild(newFileInput, existingFileInput);

      // Use the existing input from HTML
      newFileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file && confirm("This will replace the current project. Continue?")) {
          try {
            await this.loadProject(file);
          } catch (error) {
            console.error("Load failed:", error);
            this.showNotification("Failed to load project: " + error.message, false);
          }
          newFileInput.value = "";
        }
      });

      // Remove existing click listeners from load button
      const newLoadButton = loadButton.cloneNode(true);
      loadButton.parentNode.replaceChild(newLoadButton, loadButton);

      // Make the load button trigger the file input
      newLoadButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        newFileInput.click();
        return false;
      });
    } else {
      console.warn("Could not find existing load-project-input element");
    }
  }

  getCameraSerializer() {
    return this.cameraSerializer;
  }

  getDrawingSerializer() {
    return this.drawingSerializer;
  }
}

export { EnhancedSaveSystem };
