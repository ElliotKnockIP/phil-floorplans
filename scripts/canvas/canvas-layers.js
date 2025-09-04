export let layers = {
  zones: { objects: [], visible: true, opacity: 1 },
  rooms: { objects: [], visible: true, opacity: 1 },
  drawings: { objects: [], visible: true, opacity: 1 },
  devices: { objects: [], visible: true, opacity: 1 },
  background: { objects: [], visible: true, opacity: 1 },
  cctv: { objects: [], visible: true, opacity: 1 },
  intruder: { objects: [], visible: true, opacity: 1 },
  fire: { objects: [], visible: true, opacity: 1 },
  access: { objects: [], visible: true, opacity: 1 },
};

// Device type mappings
const DEVICE_CATEGORIES = {
  cctv: ["fixed-camera.png", "box-camera.png", "dome-camera.png", "ptz-camera.png", "bullet-camera.png", "thermal-camera.png"],
  access: ["access-system.png", "door-entry.png", "gates.png", "vehicle-entry.png", "turnstiles.png", "mobile-entry.png"],
  intruder: ["intruder-alarm.png", "panic-alarm.png", "motion-detector.png", "infrared-sensors.png", "pressure-mat.png", "glass-contact.png"],
  fire: ["fire-alarm.png", "fire-extinguisher.png", "fire-blanket.png", "emergency-exit.png", "assembly-point.png", "emergency-telephone.png"],
};

const SYSTEM_LAYERS = ["cctv", "intruder", "fire", "access"];

let fabricCanvas = null;
let isInitialized = false;
let eventListeners = new Map(); // Track event listeners to prevent duplicates

export function initCanvasLayers(canvas) {
  fabricCanvas = canvas;

  // If already initialized, reinitialize properly
  if (isInitialized) {
    reinitializeCanvasLayers();
    return;
  }
  // Clear existing layer objects to avoid duplicates
  Object.keys(layers).forEach((layerName) => {
    layers[layerName].objects = [];
  });

  setupLayerSystem();
  isInitialized = true;
}

function reinitializeCanvasLayers() {
  // Clear existing layer objects
  Object.keys(layers).forEach((layerName) => {
    layers[layerName].objects = [];
  });

  // Remove existing canvas event listeners to prevent duplicates
  removeCanvasEventListeners();

  // Recategorize all objects on canvas
  categorizeAllObjects();

  // Re-setup layer controls and events
  setupLayerControls();
  setupCanvasEventListeners();

  // Update visibility and opacity
  updateLayerVisibility();
  updateLayerOpacity();
}

function setupLayerSystem() {
  // Categorize existing objects
  categorizeAllObjects();

  // Setup controls and events
  setupLayerControls();
  setupCanvasEventListeners();

  // Initialize visibility and opacity
  updateLayerVisibility();
  updateLayerOpacity();
}

function categorizeAllObjects() {
  if (!fabricCanvas) return;

  fabricCanvas.getObjects().forEach((obj) => {
    // Ensure background images are properly identified and positioned
    if (obj.type === "image" && (obj.isBackground || (obj.selectable === false && obj.evented === false))) {
      obj.isBackground = true;
      fabricCanvas.sendToBack(obj);
    }
    categorizeObject(obj);
  });
}

function removeCanvasEventListeners() {
  if (!fabricCanvas) return;

  // Remove existing event listeners
  eventListeners.forEach((handler, eventName) => {
    fabricCanvas.off(eventName, handler);
  });
  eventListeners.clear();
}

function setupCanvasEventListeners() {
  if (!fabricCanvas) return;

  // Object added handler
  const onObjectAdded = (e) => {
    categorizeObject(e.target);
    updateLayerVisibility();
    updateLayerOpacity();
  };

  // Object removed handler
  const onObjectRemoved = (e) => {
    const obj = e.target;
    Object.keys(layers).forEach((layerName) => {
      layers[layerName].objects = layers[layerName].objects.filter((item) => item !== obj);
    });
  };

  // Selection changed handler for resize icons
  const onSelectionChanged = () => {
    updateLayerVisibility();
    updateLayerOpacity();
  };

  // Add event listeners
  fabricCanvas.on("object:added", onObjectAdded);
  fabricCanvas.on("object:removed", onObjectRemoved);
  fabricCanvas.on("selection:created", onSelectionChanged);
  fabricCanvas.on("selection:updated", onSelectionChanged);
  fabricCanvas.on("selection:cleared", onSelectionChanged);

  // Track listeners for cleanup
  eventListeners.set("object:added", onObjectAdded);
  eventListeners.set("object:removed", onObjectRemoved);
  eventListeners.set("selection:created", onSelectionChanged);
  eventListeners.set("selection:updated", onSelectionChanged);
  eventListeners.set("selection:cleared", onSelectionChanged);
}

// Get DOM elements dynamically with fallback
const getLayerElements = (layerName) => {
  const toggle = document.getElementById(`${layerName}-layer-toggle`);
  const slider = document.getElementById(`${layerName}-layer-opacity-slider`);

  // If elements don't exist, log warning but don't break
  if (!toggle || !slider) {
    console.warn(`Layer controls not found for ${layerName}. Toggle: ${!!toggle}, Slider: ${!!slider}`);
  }

  return { toggle, slider };
};

// Update slider track appearance
const updateSliderTrack = (slider, value, min = 0, max = 100) => {
  if (!slider) return;
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, var(--white-ip2, #ffffff) ${percentage}%)`;
};

// Find device category for a device type
const findDeviceCategory = (deviceType) => {
  return Object.keys(DEVICE_CATEGORIES).find((cat) => DEVICE_CATEGORIES[cat].includes(deviceType)) || "devices";
};

// Categorize canvas objects
const categorizeObject = (obj) => {
  if (!obj) return;

  if (obj.isBackground || (obj.type === "image" && obj.selectable === false && obj.evented === false)) {
    layers.background.objects.push(obj);
    return;
  }

  if (obj.deviceType === "title-block") {
    layers.drawings.objects.push(obj);
    return;
  }

  // Handle device groups
  if (obj.type === "group" && obj.deviceType) {
    const category = findDeviceCategory(obj.deviceType);
    layers[category].objects.push(obj);

    // Add related objects to the same category
    ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
      if (obj[prop]) layers[category].objects.push(obj[prop]);
    });

    // Add text object to the same category as its parent device
    if (obj.textObject) {
      layers[category].objects.push(obj.textObject);
    }
    return;
  }

  // Handle device text labels
  if (obj.type === "text" && obj.isDeviceLabel) {
    // Find the parent device for this text
    const parentDevice = fabricCanvas?.getObjects().find((device) => device.type === "group" && device.deviceType && device.textObject === obj);

    if (parentDevice) {
      const category = findDeviceCategory(parentDevice.deviceType);
      layers[category].objects.push(obj);
    } else {
      // Fallback to devices layer if no parent found
      layers.devices.objects.push(obj);
    }
    return;
  }

  // Handle other object types
  if ((obj.type === "polygon" && obj.class === "zone-polygon") || (obj.type === "i-text" && obj.class === "zone-text")) {
    layers.zones.objects.push(obj);
  } else if ((obj.type === "polygon" && obj.class === "room-polygon") || (obj.type === "i-text" && obj.class === "room-text")) {
    layers.rooms.objects.push(obj);
  } else if (["line", "rect", "circle", "group", "path", "arrow", "textbox"].includes(obj.type) || (obj.type === "i-text" && obj.class !== "zone-text" && obj.class !== "room-text")) {
    layers.drawings.objects.push(obj);
  } else if (obj.type === "image") {
    const isResizeIcon = fabricCanvas?.getObjects().some((o) => o.type === "group" && o.deviceType && [o.leftResizeIcon, o.rightResizeIcon, o.rotateResizeIcon].includes(obj));
    if (!isResizeIcon) {
      layers.drawings.objects.push(obj);
    }
  }
};

// Update visibility of objects in a layer
const updateLayerVisibility = () => {
  if (!fabricCanvas) return;

  const activeObject = fabricCanvas.getActiveObject();

  Object.keys(layers).forEach((layerName) => {
    layers[layerName].objects.forEach((obj) => {
      if (!obj?.set) return;

      let isVisible = layers[layerName].visible && layers[layerName].opacity > 0;
      if (SYSTEM_LAYERS.includes(layerName)) {
        isVisible = isVisible && layers.devices.visible && layers.devices.opacity > 0;
      }

      // Special handling for background images - always keep them at the back
      if (layerName === "background" && obj.type === "image") {
        fabricCanvas.sendToBack(obj);
        obj.set({
          visible: isVisible,
          selectable: false,
          evented: false,
        });
      } else {
        obj.set({ visible: isVisible });
      }

      // Handle coverage area visibility
      if (obj.coverageArea?.set) {
        obj.coverageArea.set({ visible: isVisible && obj.coverageConfig?.visible });
      }

      // Handle CCTV resize icons (only visible when camera is selected)
      if (layerName === "cctv" && activeObject === obj) {
        ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconType) => {
          if (obj[iconType]) {
            obj[iconType].set({
              visible: isVisible && obj.coverageConfig?.visible,
            });
          }
        });
      }
    });
  });
  fabricCanvas.requestRenderAll();
};

// Update opacity with color handling
const updateColorOpacity = (colorStr, newOpacity, isZone = false) => {
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
};

// Update opacity of objects in a layer
const updateLayerOpacity = () => {
  if (!fabricCanvas) return;

  const activeObject = fabricCanvas.getActiveObject();

  Object.keys(layers).forEach((layerName) => {
    const effectiveOpacity = SYSTEM_LAYERS.includes(layerName) ? layers[layerName].opacity * layers.devices.opacity : layers[layerName].opacity;

    layers[layerName].objects.forEach((obj) => {
      if (!obj?.set) return;

      if (layerName === "zones" && obj.type === "polygon") {
        // Handle zone polygon colors specially
        obj.set({
          fill: updateColorOpacity(obj.fill, effectiveOpacity, true),
          stroke: updateColorOpacity(obj.stroke, effectiveOpacity),
        });
      } else if (SYSTEM_LAYERS.includes(layerName) && obj.type === "polygon") {
        // Handle system layer polygons
        obj.set({
          fill: updateColorOpacity(obj.fill, effectiveOpacity),
          stroke: updateColorOpacity(obj.stroke, effectiveOpacity) || obj.stroke,
        });
        if (!updateColorOpacity(obj.stroke, effectiveOpacity)) {
          obj.set({ opacity: effectiveOpacity });
        }
      } else {
        obj.set({ opacity: effectiveOpacity });

        // Handle coverage areas for system layers
        if (SYSTEM_LAYERS.includes(layerName) && obj.coverageArea?.set) {
          const fill = obj.coverageConfig?.fillColor || obj.coverageArea.fill;
          obj.coverageArea.set({
            fill: updateColorOpacity(fill, effectiveOpacity),
            stroke: `rgba(0, 0, 0, ${effectiveOpacity})`,
            visible: layers[layerName].visible && layers.devices.visible && effectiveOpacity > 0 && obj.coverageConfig?.visible,
          });
        }

        // Handle CCTV resize icons
        if (layerName === "cctv") {
          const isCameraSelected = activeObject === obj;
          ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((iconType) => {
            if (obj[iconType]) {
              obj[iconType].set({
                opacity: effectiveOpacity,
                visible: layers[layerName].visible && layers.devices.visible && effectiveOpacity > 0 && obj.coverageConfig?.visible && isCameraSelected,
              });
            }
          });
        }
      }
    });
  });
  fabricCanvas.requestRenderAll();
};

// Setup layer controls
const setupLayerControls = () => {
  Object.keys(layers).forEach((layerName) => {
    const { toggle, slider } = getLayerElements(layerName);

    // Initialize slider appearance and event
    if (slider) {
      // Remove existing event listeners to prevent duplicates
      const newSlider = slider.cloneNode(true);
      slider.parentNode.replaceChild(newSlider, slider);

      updateSliderTrack(newSlider, newSlider.value, newSlider.min || 0, newSlider.max || 100);

      // Opacity slider event
      newSlider.addEventListener("input", () => {
        layers[layerName].opacity = newSlider.value / 100;
        updateLayerOpacity();
        updateSliderTrack(newSlider, newSlider.value, newSlider.min || 0, newSlider.max || 100);
      });
    }

    // Toggle event
    if (toggle) {
      // Remove existing event listeners to prevent duplicates
      const newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);

      newToggle.addEventListener("change", () => {
        layers[layerName].visible = newToggle.checked;

        // Special handling for devices layer affecting system layers
        if (layerName === "devices") {
          SYSTEM_LAYERS.forEach((sysLayer) => {
            const sysToggle = getLayerElements(sysLayer).toggle;
            layers[sysLayer].visible = newToggle.checked && (sysToggle?.checked ?? true);
          });
        }

        // System layers depend on devices layer
        if (SYSTEM_LAYERS.includes(layerName)) {
          layers[layerName].visible = newToggle.checked && layers.devices.visible;
        }

        updateLayerVisibility();
      });
    }
  });
};

// Public function to refresh layers (can be called externally)
export function refreshLayers() {
  if (isInitialized && fabricCanvas) {
    reinitializeCanvasLayers();
  }
}

// Public function to get current layers state
export function getLayersState() {
  return {
    layers: { ...layers },
    isInitialized,
    objectCounts: Object.keys(layers).map((key) => ({ layer: key, count: layers[key].objects.length })),
  };
}

// Make functions available globally for external use
window.initCanvasLayers = initCanvasLayers;
window.refreshLayers = refreshLayers;
window.getLayersState = getLayersState;
