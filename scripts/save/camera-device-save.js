import { addCameraCoverage } from "../devices/camera-coverage.js";

const CAMERA_TYPES = ["fixed-camera.png", "box-camera.png", "dome-camera.png", "ptz-camera.png", "bullet-camera.png", "thermal-camera.png"];
const IMAGE_MAP = Object.fromEntries(CAMERA_TYPES.map((type) => [type, `./images/devices/${type}`]));

class CameraDeviceSerializer {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
  }

  isCameraDevice = (deviceType) => CAMERA_TYPES.includes(deviceType);
  isDevice = (obj) => obj.type === "group" && obj.deviceType;

  serializeCameraDevices() {
    const devices = this.fabricCanvas
      .getObjects()
      .filter(this.isDevice)
      .map((group) => this.serializeDevice(group))
      .filter(Boolean);

    return {
      cameraDevices: devices,
      counters: {
        cameraCounter: window.cameraCounter || 1,
        deviceCounter: window.deviceCounter || 1,
      },
      canvasSettings: {
        pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
        zoom: this.fabricCanvas.getZoom(),
        viewportTransform: [...this.fabricCanvas.viewportTransform],
      },
    };
  }

  serializeDevice(group) {
    try {
      const groupCenter = group.getCenterPoint();
      const isCamera = this.isCameraDevice(group.deviceType);
      const [imageObj, circleObj] = [group.getObjects().find((obj) => obj.type === "image"), group.getObjects().find((obj) => obj.type === "circle")];

      const deviceData = {
        id: group.id || `device_${Date.now()}_${Math.random()}`,
        deviceType: group.deviceType,
        isCamera,
        position: { left: group.left, top: group.top, centerX: groupCenter.x, centerY: groupCenter.y },
        transform: {
          scaleX: group.scaleX || 1,
          scaleY: group.scaleY || 1,
          angle: group.angle || 0,
          originX: group.originX || "center",
          originY: group.originY || "center",
        },
        scaleFactor: group.scaleFactor || 1,
        deviceProperties: {
          fittingPositions: group.fittingPositions || "",
          partNumber: group.partNumber || "",
          stockNumber: group.stockNumber || "",
        },
        individualObjects: {
          image: imageObj
            ? {
                scaleX: imageObj.scaleX,
                scaleY: imageObj.scaleY,
                angle: imageObj.angle || 0,
                width: imageObj.width,
                height: imageObj.height,
              }
            : null,
          circle: circleObj
            ? {
                scaleX: circleObj.scaleX,
                scaleY: circleObj.scaleY,
                angle: circleObj.angle || 0,
                radius: circleObj.radius,
                fill: circleObj.fill,
              }
            : null,
        },
        textLabel: null,
        coverageConfig: null,
        visual: {
          borderColor: group.borderColor || "#000000",
          borderScaleFactor: group.borderScaleFactor || 2,
          selectable: group.selectable !== false,
          hasControls: group.hasControls || false,
          hoverCursor: group.hoverCursor || (isCamera ? "move" : "default"),
        },
      };

      // Capture custom image source if it's a data URL
      if (imageObj && imageObj._element && imageObj._element.src.startsWith("data:")) {
        deviceData.customImageSrc = imageObj._element.src;
      }

      // Serialize text label
      if (group.textObject) {
        const isTextVisible = !group.textObject._isHidden && group.textObject.visible !== false && (!group.textObject.canvas || group.textObject.canvas.getObjects().includes(group.textObject));

        const scaleFactor = group.scaleFactor || 1;

        deviceData.textLabel = {
          text: group.textObject.text || "",
          position: { left: group.textObject.left, top: group.textObject.top },
          style: {
            fontFamily: group.textObject.fontFamily || "Poppins, sans-serif",
            fontSize: group.textObject.fontSize || 12,
            fill: group.textObject.fill || "#FFFFFF",
            backgroundColor: group.textObject.backgroundColor || "rgba(20, 18, 18, 0.8)",
            originX: group.textObject.originX || "center",
            originY: group.textObject.originY || "top",
          },
          properties: {
            selectable: group.textObject.selectable || false,
            isDeviceLabel: group.textObject.isDeviceLabel || true,
            visible: isTextVisible,
            _isHidden: group.textObject._isHidden || false,
          },
          scaleRelation: {
            baseFontSize: 12,
            currentScaleFactor: scaleFactor,
          },
        };
      }

      // Serialize coverage config for cameras with proper opacity handling
      if (isCamera && group.coverageConfig) {
        let baseOpacity = 0.3; // default

        if (group.coverageConfig.opacity !== undefined) {
          baseOpacity = group.coverageConfig.opacity;
        } else if (group.coverageArea && group.coverageArea.fill) {
          const rgbaMatch = group.coverageArea.fill.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
          if (rgbaMatch) {
            const layers = window.layers || { devices: { opacity: 1 } };
            const deviceLayerOpacity = layers.devices ? layers.devices.opacity : 1;
            baseOpacity = parseFloat(rgbaMatch[1]) / deviceLayerOpacity;
          }
        }

        deviceData.coverageConfig = {
          startAngle: group.coverageConfig.startAngle || 270,
          endAngle: group.coverageConfig.endAngle || 0,
          radius: group.coverageConfig.radius || 175,
          fillColor: group.coverageConfig.fillColor || "rgba(165, 155, 155, 0.3)",
          visible: group.coverageConfig.visible !== false,
          isInitialized: group.coverageConfig.isInitialized || true,
          opacity: baseOpacity,
        };
      }

      // Legacy support
      if (circleObj) deviceData.circleColor = circleObj.fill || "#f8794b";

      return deviceData;
    } catch (error) {
      console.error("Error serializing device:", error);
      return null;
    }
  }

  async loadCameraDevices(serializedData) {
    try {
      // Restore counters and settings
      Object.assign(window, serializedData.counters || {});

      if (serializedData.canvasSettings) {
        const { pixelsPerMeter, zoom, viewportTransform } = serializedData.canvasSettings;
        this.fabricCanvas.pixelsPerMeter = pixelsPerMeter || 17.5;
        if (zoom) this.fabricCanvas.setZoom(zoom);
        if (viewportTransform) this.fabricCanvas.setViewportTransform(viewportTransform);
      }

      if (serializedData.cameraDevices?.length) {
        for (let i = 0; i < serializedData.cameraDevices.length; i++) {
          try {
            await this.loadCameraDevice(serializedData.cameraDevices[i], true); // Pass skipSelection flag
            if (i < serializedData.cameraDevices.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch (error) {
            console.error(`Failed to load device ${i + 1}:`, error);
          }
        }
        this.fabricCanvas.requestRenderAll();
      }
      return true;
    } catch (error) {
      console.error("Error loading devices:", error);
      return false;
    }
  }

  async loadCameraDevice(deviceData, skipSelection = false) {
    return new Promise((resolve, reject) => {
      try {
        // Check for duplicates
        const duplicate = this.fabricCanvas.getObjects().find((obj) => this.isDevice(obj) && obj.deviceType === deviceData.deviceType && Math.abs(obj.left - deviceData.position.left) < 1 && Math.abs(obj.top - deviceData.position.top) < 1);

        if (duplicate) return resolve(duplicate);

        // Prefer customImageSrc if present, else fall back to IMAGE_MAP
        let imgSrc = IMAGE_MAP[deviceData.deviceType] || `./images/devices/${deviceData.deviceType}`;
        if (deviceData.customImageSrc) {
          imgSrc = deviceData.customImageSrc;
        }

        fabric.Image.fromURL(
          imgSrc,
          (img) => {
            try {
              if (!img) throw new Error(`Failed to load image: ${imgSrc}`);

              // Use defaultDeviceIconSize for scaling
              const defaultIconSize = window.defaultDeviceIconSize || 30;
              const scaleFactor = defaultIconSize / 30; // Base size is 30

              // Apply saved scale and rotation to image, or use default icon size
              const savedImageData = deviceData.individualObjects?.image;
              if (savedImageData) {
                img.set({
                  ...savedImageData,
                  originX: "center",
                  originY: "center",
                  deviceType: deviceData.deviceType,
                });
              } else {
                img.set({
                  scaleX: scaleFactor * (defaultIconSize / img.width),
                  scaleY: scaleFactor * (defaultIconSize / img.height),
                  angle: deviceData.transform.angle || 0,
                  originX: "center",
                  originY: "center",
                  deviceType: deviceData.deviceType,
                });
              }

              // Create circle
              const savedCircleData = deviceData.individualObjects?.circle;
              const circleRadius = savedCircleData?.radius || 20;
              const circle = new fabric.Circle({
                radius: circleRadius,
                fill: savedCircleData?.fill || deviceData.circleColor || "#f8794b",
                originX: "center",
                originY: "center",
                scaleX: savedCircleData?.scaleX || scaleFactor, // Apply scaleFactor to circle
                scaleY: savedCircleData?.scaleY || scaleFactor, // Apply scaleFactor to circle
                angle: savedCircleData?.angle || 0,
              });

              // Create group
              const group = new fabric.Group([circle, img], {
                ...deviceData.position,
                ...deviceData.transform,
                ...deviceData.visual,
                scaleFactor: deviceData.scaleFactor || scaleFactor, // Use scaleFactor
              });

              group.deviceType = deviceData.deviceType;
              group.id = deviceData.id;

              // Restore hasCustomIcon flag if custom image was used
              if (deviceData.customImageSrc) {
                group.hasCustomIcon = true;
              }

              // Restore device properties
              Object.assign(group, deviceData.deviceProperties || {});

              // Set coverage config with proper opacity restoration
              if (deviceData.coverageConfig) {
                group.coverageConfig = {
                  ...deviceData.coverageConfig,
                  opacity: deviceData.coverageConfig.opacity || 0.3,
                };
                delete group.coverageConfig.currentCoverage;
              }

              this.fabricCanvas.add(group);

              // Add text label
              if (deviceData.textLabel) {
                this.createTextLabel(group, deviceData.textLabel, group.scaleFactor || scaleFactor);
              }

              // Only add event handlers if not skipping selection to prevent brief selection flash
              if (!skipSelection) {
                this.addDeviceEventHandlers(group);
              } else {
                // During floor loading, add a flag to defer event handler setup
                group._deferEventHandlers = true;
              }

              // Add camera coverage
              if (deviceData.isCamera !== false && this.isCameraDevice(deviceData.deviceType) && deviceData.coverageConfig) {
                this.addCameraCoverageDelayed(group, deviceData.coverageConfig);
              }

              group.bringToFront();
              if (group.textObject && !group.textObject._isHidden) {
                group.textObject.bringToFront();
              }

              // Only set as active object if not skipping selection (e.g., during floor loading)
              if (!skipSelection) {
                this.fabricCanvas.setActiveObject(group);
              }

              resolve(group);
            } catch (error) {
              reject(error);
            }
          },
          { crossOrigin: "anonymous" }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  createTextLabel(group, textData, scaleFactor) {
    let fontSize = textData.style.fontSize;

    // Calculate proper font size
    if (textData.scaleRelation) {
      const baseFontSize = textData.scaleRelation.baseFontSize || 12;
      fontSize = baseFontSize * scaleFactor;
    } else {
      const expectedScaledSize = 12 * scaleFactor;
      fontSize = Math.abs(fontSize - expectedScaledSize) > 1 ? fontSize : expectedScaledSize;
    }

    const groupCenter = group.getCenterPoint();
    const text = new fabric.Text(textData.text, {
      left: groupCenter.x,
      top: groupCenter.y + 20 * scaleFactor + 10,
      ...textData.style,
      fontSize,
      ...textData.properties,
      visible: true,
    });

    const shouldBeVisible = textData.properties.visible !== false;
    const wasHidden = textData.properties._isHidden === true;

    text._isHidden = wasHidden || !shouldBeVisible;
    group.textObject = text;

    if (shouldBeVisible) {
      this.fabricCanvas.add(text);
      text._isHidden = false;
      text.bringToFront();
    } else {
      text._isHidden = true;
      text.visible = false;
    }

    this.bindTextToGroup(group, text);

    // Handle layer categorization
    setTimeout(() => {
      if (window.initCanvasLayers && shouldBeVisible && this.fabricCanvas.getObjects().includes(text)) {
        this.fabricCanvas.fire("object:added", { target: text });
      }
      this.fabricCanvas.renderAll();
    }, 20);
  }

  addCameraCoverageDelayed(group, coverageConfig) {
    // Don't create coverage if it already exists
    if (group.coverageArea && this.fabricCanvas.getObjects().includes(group.coverageArea)) {
      return;
    }

    setTimeout(() => {
      // Double-check that coverage doesn't exist before creating
      if (group.coverageArea && this.fabricCanvas.getObjects().includes(group.coverageArea)) {
        return;
      }

      // Clean up any orphaned coverage/icons that might exist for this group
      const allObjects = this.fabricCanvas.getObjects();
      const orphanedCoverage = allObjects.filter((obj) => (obj.isCoverage || obj.isResizeIcon === true) && !obj.parentGroup);

      orphanedCoverage.forEach((obj) => {
        this.fabricCanvas.remove(obj);
      });

      const addCoverage = window.addCameraCoverage || addCameraCoverage;
      if (addCoverage) {
        addCoverage(this.fabricCanvas, group);
      }

      // Restore coverage visibility AND opacity
      const restoreCoverageVisibility = (attempts = 0) => {
        if (attempts > 10) return;

        if (group.coverageArea && this.fabricCanvas.getObjects().includes(group.coverageArea)) {
          const shouldBeVisible = coverageConfig.visible !== false;
          group.coverageConfig.visible = shouldBeVisible;
          group.coverageArea.visible = shouldBeVisible;
          group.coverageArea.set({ visible: shouldBeVisible });

          // Restore the saved opacity
          if (coverageConfig.opacity !== undefined && group.coverageArea.fill) {
            const layers = window.layers || { devices: { opacity: 1 } };
            const deviceLayerOpacity = layers.devices ? layers.devices.opacity : 1;
            const finalOpacity = coverageConfig.opacity * deviceLayerOpacity;

            // Extract RGB values and apply the correct opacity
            const rgbMatch = group.coverageArea.fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
              const [, r, g, b] = rgbMatch;
              const newFill = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
              group.coverageArea.set({ fill: newFill });
              group.coverageConfig.fillColor = newFill;
            }
          }

          // ALWAYS hide resize icons initially - they should only show when camera is selected
          ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconName) => {
            if (group[iconName] && this.fabricCanvas.getObjects().includes(group[iconName])) {
              group[iconName].visible = false;
              group[iconName].set({ visible: false });
              // Add reference back to parent group for cleanup tracking
              group[iconName].parentGroup = group;
            }
          });

          // Add reference back to parent group for cleanup tracking
          if (group.coverageArea) {
            group.coverageArea.parentGroup = group;
          }

          this.fabricCanvas.renderAll();

          if (!shouldBeVisible) {
            setTimeout(() => {
              if (group.coverageArea && this.fabricCanvas.getObjects().includes(group.coverageArea)) {
                group.coverageArea.visible = false;
                group.coverageArea.set({ visible: false });
                this.fabricCanvas.renderAll();
              }
            }, 50);
          }
        } else {
          setTimeout(() => restoreCoverageVisibility(attempts + 1), 100);
        }
      };

      setTimeout(() => restoreCoverageVisibility(), 100);
    }, 10);
  }

  bindTextToGroup(group, text) {
    const updateTextPosition = () => {
      const groupCenter = group.getCenterPoint();
      const currentScaleFactor = group.scaleFactor || 1;
      text.set({
        left: groupCenter.x,
        top: groupCenter.y + 20 * currentScaleFactor + 10,
      });
      text.setCoords();
      group.bringToFront();
      if (!text._isHidden) text.bringToFront();
      this.fabricCanvas.requestRenderAll();
    };

    group.on("moving", updateTextPosition);
    text.on("changed", () => {
      updateTextPosition();
      this.fabricCanvas.renderAll();
    });
  }

  addDeviceEventHandlers(group) {
    group.on("selected", () => {
      if (window.showDeviceProperties) window.showDeviceProperties(group.deviceType, group.textObject, group);
      group.bringToFront();
      if (group.textObject && !group.textObject._isHidden) group.textObject.bringToFront();
      this.fabricCanvas.renderAll();
    });

    group.on("deselected", () => {
      if (window.hideDeviceProperties) window.hideDeviceProperties();
    });

    group.on("removed", () => {
      ["textObject", "coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
        if (group[prop]) this.fabricCanvas.remove(group[prop]);
      });
      this.fabricCanvas.renderAll();
    });
  }

  // Storage and file operations
  saveToLocalStorage(key = "cameraDevicesData") {
    try {
      const data = this.serializeCameraDevices();
      localStorage.setItem(key, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      return false;
    }
  }

  async loadFromLocalStorage(key = "cameraDevicesData") {
    try {
      const jsonString = localStorage.getItem(key);
      if (!jsonString) return false;
      return await this.loadCameraDevices(JSON.parse(jsonString));
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return false;
    }
  }

  exportAsFile(filename = "camera_devices_export.json") {
    try {
      const data = this.serializeCameraDevices();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: filename,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Error exporting camera devices:", error);
      return false;
    }
  }

  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const success = await this.loadCameraDevices(data);
          success ? resolve(true) : reject(new Error("Failed to load camera devices"));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  }
}

export { CameraDeviceSerializer };
