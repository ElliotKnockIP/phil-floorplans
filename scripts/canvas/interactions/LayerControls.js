// Layer system for organizing canvas objects
export let layers = {
  zones: { objects: [], visible: true, opacity: 1 },
  rooms: { objects: [], visible: true, opacity: 1 },
  risks: { objects: [], visible: true, opacity: 1 },
  safetyZones: { objects: [], visible: true, opacity: 1 },
  drawings: { objects: [], visible: true, opacity: 1 },
  devices: { objects: [], visible: true, opacity: 1 },
  custom: { objects: [], visible: true, opacity: 1 },
  background: { objects: [], visible: true, opacity: 1 },
  cctv: { objects: [], visible: true, opacity: 1 },
  intruder: { objects: [], visible: true, opacity: 1 },
  fire: { objects: [], visible: true, opacity: 1 },
  access: { objects: [], visible: true, opacity: 1 },
  networks: { objects: [], visible: true, opacity: 1 },
  networkLinks: { objects: [], visible: true, opacity: 1 },
  textDevices: { objects: [], visible: true, opacity: 1 },
};

// Maps device types to layer categories
const DEVICE_CATEGORIES = {
  cctv: ["fixed-camera.png", "box-camera.png", "dome-camera.png", "ptz-camera.png", "bullet-camera.png", "thermal-camera.png", "custom-camera-icon.png"],
  access: ["access-system.png", "door-entry.png", "gates.png", "vehicle-entry.png", "turnstiles.png", "mobile-entry.png", "pir-icon.png", "card-reader.png", "lock-icon.png"],
  intruder: ["intruder-alarm.png", "panic-alarm.png", "motion-detector.png", "infrared-sensors.png", "pressure-mat.png", "glass-contact.png"],
  fire: ["fire-alarm.png", "fire-extinguisher.png", "fire-blanket.png", "emergency-exit.png", "assembly-point.png", "emergency-telephone.png"],
  networks: ["Series.png", "panel-control.png", "Sensor.png", "interface-unit.png", "access-panel.png", "expander-connection.png", "dvr.png", "nvr.png"],
  custom: ["custom-device-icon.png", "text-device"],
};

// Drawing types for categorization
const DRAWING_TYPES = ["line", "rect", "circle", "group", "path", "arrow", "textbox"];
const EXCLUDED_TEXT_CLASSES = ["zone-text", "room-text", "risk-text", "safety-text"];

// Layers that depend on the main devices layer visibility
const SYSTEM_LAYERS = ["cctv", "intruder", "fire", "access", "networks", "networkLinks", "custom"];

export class LayerControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.domItemsChangedHandler = null;
    this.perItemContainers = { zones: null, rooms: null, risks: null, safetyZones: null };
    if (typeof window !== "undefined") {
      window.layers = layers;
    }
    this.init();
  }

  // Initialize the layer system
  init() {
    if (this.isInitialized) {
      this.reinitializeCanvasLayers();
      return;
    }

    // Clear existing layer objects
    Object.keys(layers).forEach((layerName) => (layers[layerName].objects = []));

    this.setupLayerSystem();
    this.isInitialized = true;
  }

  // Rebuild layer lists and reattach listeners
  reinitializeCanvasLayers() {
    Object.keys(layers).forEach((layerName) => (layers[layerName].objects = []));
    this.removeCanvasEventListeners();
    this.categorizeAllObjects();
    this.setupLayerControls();
    this.setupCanvasEventListeners();
    this.applyPendingLayerState();
    this.updateLayerVisibility();
    this.updateLayerOpacity();
  }

  // Setup core layer system components
  setupLayerSystem() {
    this.categorizeAllObjects();
    this.setupLayerControls();
    this.setupCanvasEventListeners();
    this.ensurePerItemContainers();
    this.renderLayerItems("zones");
    this.renderLayerItems("rooms");
    this.renderLayerItems("risks");
    this.renderLayerItems("safetyZones");
    this.applyPendingLayerState();
    this.updateLayerVisibility();
    this.updateLayerOpacity();
  }

  // Categorize all existing canvas objects into layers
  categorizeAllObjects() {
    if (!this.canvas) return;

    this.canvas.getObjects().forEach((obj) => {
      if (obj.type === "image" && (obj.isBackground || (obj.selectable === false && obj.evented === false))) {
        obj.isBackground = true;
        this.canvas.sendToBack(obj);
      }
      this.categorizeObject(obj);
    });
  }

  // Remove all canvas event listeners managed by this class
  removeCanvasEventListeners() {
    if (!this.canvas) return;

    this.eventListeners.forEach((handler, eventName) => this.canvas.off(eventName, handler));
    this.eventListeners.clear();

    if (this.domItemsChangedHandler) {
      document.removeEventListener("layers:items-changed", this.domItemsChangedHandler);
      this.domItemsChangedHandler = null;
    }
  }

  // Setup event listeners to keep layers in sync with canvas changes
  setupCanvasEventListeners() {
    if (!this.canvas) return;

    // Handle new objects being added to the canvas
    const onObjectAdded = (e) => {
      this.categorizeObject(e.target);
      this.updateLayerVisibility();
      this.updateLayerOpacity();

      if (e.target?.class === "zone-polygon" || e.target?.class === "zone-text") {
        this.renderLayerItems("zones");
      }
      if (e.target?.class === "room-polygon" || e.target?.class === "room-text") {
        this.renderLayerItems("rooms");
      }
      if (e.target?.class === "risk-polygon" || e.target?.class === "risk-text") {
        this.renderLayerItems("risks");
      }
      if (e.target?.class === "safety-polygon" || e.target?.class === "safety-text") {
        this.renderLayerItems("safetyZones");
      }
    };

    // Handle objects being removed from the canvas
    const onObjectRemoved = (e) => {
      const obj = e.target;
      Object.keys(layers).forEach((layerName) => {
        layers[layerName].objects = layers[layerName].objects.filter((item) => item !== obj);
      });

      if (obj?.class === "zone-polygon" || obj?.class === "zone-text") {
        this.renderLayerItems("zones");
      }
      if (obj?.class === "room-polygon" || obj?.class === "room-text") {
        this.renderLayerItems("rooms");
      }
      if (obj?.class === "risk-polygon" || obj?.class === "risk-text") {
        this.renderLayerItems("risks");
      }
      if (obj?.class === "safety-polygon" || obj?.class === "safety-text") {
        this.renderLayerItems("safetyZones");
      }
    };

    // Update visibility and opacity when selection changes
    const onSelectionChanged = () => {
      this.updateLayerVisibility();
      this.updateLayerOpacity();
    };

    const events = ["object:added", "object:removed", "selection:created", "selection:updated", "selection:cleared"];
    const handlers = [onObjectAdded, onObjectRemoved, onSelectionChanged, onSelectionChanged, onSelectionChanged];

    events.forEach((event, i) => {
      this.canvas.on(event, handlers[i]);
      this.eventListeners.set(event, handlers[i]);
    });

    // Listen for external requests to refresh layer items
    const onItemsChanged = () => {
      this.renderLayerItems("zones");
      this.renderLayerItems("rooms");
      this.renderLayerItems("risks");
      this.renderLayerItems("safetyZones");
    };
    document.addEventListener("layers:items-changed", onItemsChanged);
    this.domItemsChangedHandler = onItemsChanged;
  }

  // Retrieve toggle and slider elements for a specific layer
  getLayerElements(layerName) {
    const toggle = document.getElementById(`${layerName}-layer-toggle`);
    const slider = document.getElementById(`${layerName}-layer-opacity-slider`);
    if (!toggle || !slider) {
      console.warn(`Layer controls not found for ${layerName}. Toggle: ${!!toggle}, Slider: ${!!slider}`);
    }
    return { toggle, slider };
  }

  // Update the visual track of a range slider
  updateSliderTrack(slider, value, min = 0, max = 100) {
    if (!slider) return;
    const percentage = ((value - min) / (max - min)) * 100;
    const color = "var(--orange-ip2, #f8794b)";
    slider.style.background = `linear-gradient(to right, ${color} ${percentage}%, #ffffff ${percentage}%)`;
  }

  // Determine the category for a device based on its type
  findDeviceCategory(deviceType) {
    const category = Object.keys(DEVICE_CATEGORIES).find((cat) => DEVICE_CATEGORIES[cat].includes(deviceType));
    return category || "devices";
  }

  // Check if an object is a drawing object
  isDrawingObject(obj) {
    const isDrawingType = DRAWING_TYPES.includes(obj.type);
    const isValidText = obj.type === "i-text" && !EXCLUDED_TEXT_CLASSES.includes(obj.class);
    return isDrawingType || isValidText;
  }

  // Check if an object is network-related
  isNetworkObject(obj) {
    return obj.isNetworkConnection || obj.isConnectionSegment || obj.isNetworkSplitPoint || obj.isSegmentDistanceLabel || obj.isConnectionCustomLabel || obj.isConnectionLine || obj.isChannelLabel;
  }

  // Find the parent device for a resize icon
  findParentDeviceForIcon(obj) {
    if (obj.type !== "image") return null;
    return this.canvas?.getObjects().find((d) => {
      return d.type === "group" && d.deviceType && (d.leftResizeIcon === obj || d.rightResizeIcon === obj || d.rotateResizeIcon === obj);
    });
  }

  // Find the parent device for a text label
  findParentDeviceForText(obj) {
    return this.canvas?.getObjects().find((device) => {
      return device.type === "group" && device.deviceType && device.textObject === obj;
    });
  }

  // Check if an object is a resize icon
  isResizeIcon(obj) {
    return this.canvas?.getObjects().some((o) => {
      return o.type === "group" && o.deviceType && [o.leftResizeIcon, o.rightResizeIcon, o.rotateResizeIcon].includes(obj);
    });
  }

  // Assign a canvas object to its corresponding layer
  categorizeObject(obj) {
    if (!obj) return;

    // Handle background images
    if (obj.isBackground || (obj.type === "image" && obj.selectable === false && obj.evented === false)) {
      layers.background.objects.push(obj);
      return;
    }

    // Handle network-related objects
    if (this.isNetworkObject(obj)) {
      layers.networkLinks.objects.push(obj);
      return;
    }

    // Handle title blocks
    if (obj.deviceType === "title-block") {
      layers.drawings.objects.push(obj);
      return;
    }

    // Handle device groups and their associated components
    if (obj.type === "group" && obj.deviceType) {
      const category = obj.coverageConfig ? "cctv" : obj.deviceType === "text-device" ? "textDevices" : this.findDeviceCategory(obj.deviceType);
      layers[category].objects.push(obj);

      ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
        if (obj[prop]) layers[category].objects.push(obj[prop]);
      });

      if (obj.textObject) layers[category].objects.push(obj.textObject);
      return;
    }

    // Handle device text labels
    if (obj.type === "text" && obj.isDeviceLabel) {
      const parentDevice = this.findParentDeviceForText(obj);

      if (parentDevice) {
        const category = parentDevice.coverageConfig ? "cctv" : this.findDeviceCategory(parentDevice.deviceType);
        layers[category].objects.push(obj);
      } else {
        layers.devices.objects.push(obj);
      }
      return;
    }

    // Handle polygons and other drawing shapes
    if ((obj.type === "polygon" && obj.class === "zone-polygon") || (obj.type === "i-text" && obj.class === "zone-text")) {
      layers.zones.objects.push(obj);
    } else if ((obj.type === "polygon" && obj.class === "room-polygon") || (obj.type === "i-text" && obj.class === "room-text")) {
      layers.rooms.objects.push(obj);
    } else if ((obj.type === "polygon" && obj.class === "risk-polygon") || (obj.type === "i-text" && obj.class === "risk-text")) {
      layers.risks.objects.push(obj);
    } else if ((obj.type === "polygon" && obj.class === "safety-polygon") || (obj.type === "i-text" && obj.class === "safety-text")) {
      layers.safetyZones.objects.push(obj);
    } else if (this.isDrawingObject(obj)) {
      layers.drawings.objects.push(obj);
    } else if (obj.type === "image") {
      const isResizeIcon = this.isResizeIcon(obj);
      if (!isResizeIcon) {
        layers.drawings.objects.push(obj);
      }
    }
  }

  // Update visibility of all objects based on layer settings
  updateLayerVisibility() {
    if (!this.canvas) return;

    const activeObject = this.canvas.getActiveObject();

    Object.keys(layers).forEach((layerName) => {
      layers[layerName].objects.forEach((obj) => {
        if (!obj?.set) return;

        // Handle visibility for camera resize icons
        const parentDeviceForIcon = this.findParentDeviceForIcon(obj);

        let isVisible = layers[layerName].visible && layers[layerName].opacity > 0;
        if (SYSTEM_LAYERS.includes(layerName)) {
          isVisible = isVisible && layers.devices.visible && layers.devices.opacity > 0;
        }

        if (obj._individualVisible === false) isVisible = false;

        if (parentDeviceForIcon) {
          const showIcon = isVisible && layers.devices.visible && layers.devices.opacity > 0 && parentDeviceForIcon.coverageConfig?.visible && activeObject === parentDeviceForIcon;
          obj.set({ visible: showIcon });
          return;
        }

        // Handle background visibility and layering
        if (layerName === "background" && obj.type === "image") {
          this.canvas.sendToBack(obj);
          obj.set({ visible: isVisible, selectable: false, evented: false });
        } else {
          obj.set({ visible: isVisible });
        }

        // Handle coverage area visibility
        if (obj.coverageArea?.set) {
          obj.coverageArea.set({ visible: isVisible && obj.coverageConfig?.visible });
        }

        // Handle CCTV resize icon visibility
        if (layerName === "cctv" && activeObject === obj) {
          ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconType) => {
            if (obj[iconType]) {
              obj[iconType].set({ visible: isVisible && obj.coverageConfig?.visible });
            }
          });
        }
      });
    });
    this.canvas.requestRenderAll();
  }

  // Helper to set alpha channel on various color formats
  setColorAlpha(colorStr, alpha) {
    if (!colorStr) return colorStr;

    const rgbaMatch = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (rgbaMatch) return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;

    const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`;

    const hslaMatch = colorStr.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
    if (hslaMatch) return `hsla(${hslaMatch[1]},${hslaMatch[2]}%,${hslaMatch[3]}%,${alpha})`;

    const hslMatch = colorStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) return `hsla(${hslMatch[1]},${hslMatch[2]}%,${hslMatch[3]}%,${alpha})`;

    return colorStr;
  }

  // Update color opacity while preserving base opacity
  updateColorOpacity(colorStr, newOpacity, isZone = false) {
    const rgbaMatch = colorStr?.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    const hslaMatch = colorStr?.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);

    if (rgbaMatch) {
      const baseOpacity = isZone ? 0.2 : parseFloat(rgbaMatch[4]);
      return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${baseOpacity * newOpacity})`;
    }
    if (hslaMatch) {
      const baseOpacity = isZone ? 0.2 : parseFloat(hslaMatch[4]);
      return `hsla(${hslaMatch[1]},${hslaMatch[2]}%,${hslaMatch[3]}%,${baseOpacity * newOpacity})`;
    }
    return colorStr;
  }

  // Update opacity of all objects based on layer and individual settings
  updateLayerOpacity() {
    if (!this.canvas) return;

    const activeObject = this.canvas.getActiveObject();

    Object.keys(layers).forEach((layerName) => {
      const effectiveOpacity = SYSTEM_LAYERS.includes(layerName) ? layers[layerName].opacity * layers.devices.opacity : layers[layerName].opacity;

      layers[layerName].objects.forEach((obj) => {
        if (!obj?.set) return;

        const parentDeviceForIcon = this.findParentDeviceForIcon(obj);

        const objectOpacityFactor = typeof obj._individualOpacity === "number" ? obj._individualOpacity : 1;
        const objectEffectiveOpacity = effectiveOpacity * objectOpacityFactor;

        // Handle opacity for camera resize icons
        if (parentDeviceForIcon) {
          const isCameraSelected = activeObject === parentDeviceForIcon;
          const visible = layers[layerName].visible && layers.devices.visible && objectEffectiveOpacity > 0 && parentDeviceForIcon.coverageConfig?.visible && isCameraSelected;
          obj.set({
            opacity: objectEffectiveOpacity,
            visible,
          });
          return;
        }

        // Apply opacity to polygons with specific fill/stroke rules
        if (layerName === "zones" && obj.type === "polygon") {
          obj.set({
            fill: this.setColorAlpha(obj.fill, 0.2 * objectEffectiveOpacity),
            stroke: this.setColorAlpha(obj.stroke, objectEffectiveOpacity),
          });
        } else if (layerName === "risks" && obj.type === "polygon") {
          obj.set({
            fill: this.setColorAlpha(obj.fill, 0.35 * objectEffectiveOpacity),
            stroke: this.setColorAlpha(obj.stroke, objectEffectiveOpacity),
          });
        } else if (layerName === "safetyZones" && obj.type === "polygon") {
          obj.set({
            fill: this.setColorAlpha(obj.fill, 0.3 * objectEffectiveOpacity),
            stroke: this.setColorAlpha(obj.stroke, objectEffectiveOpacity),
          });
        } else if (SYSTEM_LAYERS.includes(layerName) && obj.type === "polygon") {
          obj.set({
            fill: this.updateColorOpacity(obj.fill, objectEffectiveOpacity),
            stroke: this.updateColorOpacity(obj.stroke, objectEffectiveOpacity) || obj.stroke,
          });
          if (!this.updateColorOpacity(obj.stroke, objectEffectiveOpacity)) {
            obj.set({ opacity: objectEffectiveOpacity });
          }
        } else {
          // Default opacity application
          obj.set({ opacity: objectEffectiveOpacity });

          // Handle coverage area opacity
          if (SYSTEM_LAYERS.includes(layerName) && obj.coverageArea?.set) {
            const fill = obj.coverageConfig?.fillColor || obj.coverageArea.fill;
            obj.coverageArea.set({
              fill: this.updateColorOpacity(fill, objectEffectiveOpacity),
              stroke: `rgba(0, 0, 0, ${objectEffectiveOpacity})`,
              visible: layers[layerName].visible && layers.devices.visible && objectEffectiveOpacity > 0 && obj.coverageConfig?.visible,
            });
          }

          // Handle CCTV resize icon opacity
          if (layerName === "cctv") {
            const isCameraSelected = activeObject === obj;
            ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconType) => {
              if (obj[iconType]) {
                obj[iconType].set({
                  opacity: objectEffectiveOpacity,
                  visible: layers[layerName].visible && layers.devices.visible && objectEffectiveOpacity > 0 && obj.coverageConfig?.visible && isCameraSelected,
                });
              }
            });
          }
        }
      });
    });
    this.canvas.requestRenderAll();
  }

  // Setup UI controls for each layer
  setupLayerControls() {
    Object.keys(layers).forEach((layerName) => {
      const { toggle, slider } = this.getLayerElements(layerName);

      // Setup opacity slider
      if (slider) {
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        this.updateSliderTrack(newSlider, newSlider.value, newSlider.min || 0, newSlider.max || 100);

        newSlider.addEventListener("input", () => {
          layers[layerName].opacity = newSlider.value / 100;
          this.updateLayerOpacity();
          this.updateSliderTrack(newSlider, newSlider.value, newSlider.min || 0, newSlider.max || 100);
        });
      }

      // Setup visibility toggle
      if (toggle) {
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);

        newToggle.addEventListener("change", () => {
          layers[layerName].visible = newToggle.checked;

          // System layer visibility is independent
          if (SYSTEM_LAYERS.includes(layerName)) {
            layers[layerName].visible = newToggle.checked;
          }

          this.updateLayerVisibility();
        });
      }
    });

    // Initialize individual item controls
    this.ensurePerItemContainers();
    this.renderLayerItems("zones");
    this.renderLayerItems("rooms");
    this.renderLayerItems("risks");
    this.renderLayerItems("safetyZones");
    this.syncLayerControlsUI();
  }

  // Get a serializable snapshot of layer settings (visibility + opacity)
  getSerializableLayerState() {
    const layerState = {};
    Object.keys(layers).forEach((layerName) => {
      layerState[layerName] = {
        visible: !!layers[layerName].visible,
        opacity: typeof layers[layerName].opacity === "number" ? layers[layerName].opacity : 1,
      };
    });
    return {
      version: 1,
      layers: layerState,
    };
  }

  // Apply a saved layer settings snapshot
  applySerializableLayerState(state) {
    if (!state || !state.layers) return false;

    Object.keys(state.layers).forEach((layerName) => {
      if (!layers[layerName]) return;
      const saved = state.layers[layerName] || {};
      if (typeof saved.visible === "boolean") {
        layers[layerName].visible = saved.visible;
      } else if (typeof saved.visible === "string") {
        layers[layerName].visible = saved.visible.toLowerCase() === "true";
      } else if (typeof saved.visible === "number") {
        layers[layerName].visible = saved.visible !== 0;
      }

      if (typeof saved.opacity === "number") {
        layers[layerName].opacity = Math.max(0, Math.min(1, saved.opacity));
      } else if (typeof saved.opacity === "string") {
        const parsedOpacity = Number.parseFloat(saved.opacity);
        if (!Number.isNaN(parsedOpacity)) {
          layers[layerName].opacity = Math.max(0, Math.min(1, parsedOpacity));
        }
      }
    });

    this.syncLayerControlsUI();
    this.updateLayerVisibility();
    this.updateLayerOpacity();
    return true;
  }

  // Sync UI toggles/sliders with current layer settings
  syncLayerControlsUI() {
    Object.keys(layers).forEach((layerName) => {
      const { toggle, slider } = this.getLayerElements(layerName);
      if (toggle) toggle.checked = !!layers[layerName].visible;
      if (slider) {
        const val = Math.round((typeof layers[layerName].opacity === "number" ? layers[layerName].opacity : 1) * 100);
        slider.value = `${Math.max(0, Math.min(100, val))}`;
        this.updateSliderTrack(slider, Number(slider.value), Number(slider.min || 0), Number(slider.max || 100));
      }
    });
  }

  // Apply pending layer state if provided by a project load
  applyPendingLayerState() {
    if (typeof window === "undefined") return;
    const pending = window.pendingLayerControlsState;
    if (pending) {
      this.applySerializableLayerState(pending);
      window.pendingLayerControlsState = null;
    }
  }

  // Ensure UI containers for individual item controls exist
  ensurePerItemContainers() {
    const layerControlsSubmenu = document.getElementById("layer-controls-submenu");
    if (!layerControlsSubmenu) return;

    ["zones", "rooms", "risks", "safetyZones"].forEach((name) => {
      if (this.perItemContainers[name] && document.body.contains(this.perItemContainers[name])) return;

      const container = document.createElement("div");
      container.id = `${name}-layer-items`;
      container.className = "mb-3 layer-item-container";

      const label = document.createElement("div");
      label.textContent = name === "zones" ? "Individual Zone Controls" : name === "rooms" ? "Individual Room Controls" : name === "safetyZones" ? "Individual Safety Zone Controls" : "Individual Risk Controls";
      label.style.cssText = "font-weight: 500; margin-bottom: 8px; color: #495057;";
      container.appendChild(label);

      const list = document.createElement("div");
      list.className = "layer-item-list";
      container.appendChild(list);

      layerControlsSubmenu.appendChild(container);
      this.perItemContainers[name] = container;
    });
  }

  // Render individual item controls for a specific layer
  renderLayerItems(layerName) {
    this.ensurePerItemContainers();
    const container = this.perItemContainers[layerName];
    if (!container) return;

    const list = container.querySelector(".layer-item-list");
    if (!list) return;

    const items = (layerName === "zones" ? window.zones : layerName === "rooms" ? window.rooms : layerName === "safetyZones" ? window.safetyZones : window.risks) || [];

    const frag = document.createDocumentFragment();

    items.forEach((item, idx) => {
      const polygon = item?.polygon || item;
      const text = item?.text;
      if (!polygon) return;

      if (!polygon._layerItemId) {
        polygon._layerItemId = `layer-${layerName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      const name = layerName === "zones" ? polygon.zoneName || `Zone ${idx + 1}` : layerName === "rooms" ? polygon.roomName || item?.roomName || `Room ${idx + 1}` : polygon.riskName || item?.riskName || `Risk ${idx + 1}`;

      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 8px; margin: 4px 0;";

      // Individual visibility checkbox
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `${polygon._layerItemId}-checkbox`;
      checkbox.className = "form-check-input";
      checkbox.style.marginTop = "0";
      checkbox.checked = polygon._individualVisible !== false;

      checkbox.addEventListener("change", () => {
        const checked = checkbox.checked;
        polygon._individualVisible = checked;
        if (text) text._individualVisible = checked;
        this.updateLayerVisibility();
      });

      const span = document.createElement("label");
      span.setAttribute("for", `${polygon._layerItemId}-checkbox`);
      span.textContent = name;
      span.style.cssText = "flex: 1 1 50%; min-width: 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";

      // Individual opacity slider
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      const opacityVal = typeof polygon._individualOpacity === "number" ? polygon._individualOpacity : 1;
      slider.value = Math.round(opacityVal * 100).toString();
      slider.style.cssText = "flex: 1 1 50%; width: auto; min-width: 80px;";
      slider.className = "form-range";

      this.updateSliderTrack(slider, Number(slider.value), Number(slider.min), Number(slider.max));
      slider.addEventListener("input", () => {
        const v = Number(slider.value) / 100;
        polygon._individualOpacity = v;
        if (text) text._individualOpacity = v;
        this.updateLayerOpacity();
        this.updateSliderTrack(slider, Number(slider.value), Number(slider.min), Number(slider.max));
      });

      row.appendChild(checkbox);
      row.appendChild(span);
      row.appendChild(slider);
      frag.appendChild(row);
    });

    const prevScroll = list.scrollTop;
    list.innerHTML = "";
    list.appendChild(frag);
    list.scrollTop = prevScroll;
  }

  // Refresh all layer data and UI
  refreshLayers() {
    if (this.isInitialized && this.canvas) {
      this.reinitializeCanvasLayers();
    }
  }

  // Get current state of the layer system for debugging
  getLayersState() {
    return {
      layers: { ...layers },
      isInitialized: this.isInitialized,
      objectCounts: Object.keys(layers).map((key) => ({
        layer: key,
        count: layers[key].objects.length,
      })),
    };
  }
}

// Global wrapper functions for layer management
export function refreshLayers() {
  if (window.layerControls) window.layerControls.refreshLayers();
}

export function initCanvasLayers(canvas) {
  if (window.layerControls) {
    if (canvas) window.layerControls.canvas = canvas;
    window.layerControls.refreshLayers();
    if (window.layerControls.syncLayerControlsUI) window.layerControls.syncLayerControlsUI();
  } else if (canvas) {
    window.layerControls = new LayerControls(canvas);
  }
}

export function getLayersState() {
  if (window.layerControls) return window.layerControls.getLayersState();
  return null;
}

window.refreshLayers = refreshLayers;
window.initCanvasLayers = initCanvasLayers;
window.getLayersState = getLayersState;
window.requestLayerItemsRefresh = () => {
  if (window.layerControls) {
    window.layerControls.renderLayerItems("zones");
    window.layerControls.renderLayerItems("rooms");
    window.layerControls.renderLayerItems("risks");
    window.layerControls.renderLayerItems("safetyZones");
  }
};
