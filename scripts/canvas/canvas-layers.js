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
let domItemsChangedHandler = null; // track DOM listener for cleanup

// Cache for per-item containers to avoid repeated DOM lookups
const perItemContainers = {
  zones: null,
  rooms: null,
};

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

  // Ensure per-item containers exist and initial render
  ensurePerItemContainers();
  renderLayerItems("zones");
  renderLayerItems("rooms");

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

  // Remove DOM listener if set
  if (domItemsChangedHandler) {
    document.removeEventListener("layers:items-changed", domItemsChangedHandler);
    domItemsChangedHandler = null;
  }
}

function setupCanvasEventListeners() {
  if (!fabricCanvas) return;

  // Object added handler
  const onObjectAdded = (e) => {
    categorizeObject(e.target);
    updateLayerVisibility();
    updateLayerOpacity();

    // If a zone or room was added, refresh lists
    if (e.target?.class === "zone-polygon" || e.target?.class === "zone-text") {
      renderLayerItems("zones");
    }
    if (e.target?.class === "room-polygon" || e.target?.class === "room-text") {
      renderLayerItems("rooms");
    }
  };

  // Object removed handler
  const onObjectRemoved = (e) => {
    const obj = e.target;
    Object.keys(layers).forEach((layerName) => {
      layers[layerName].objects = layers[layerName].objects.filter((item) => item !== obj);
    });

    // If a zone or room was removed, refresh lists
    if (obj?.class === "zone-polygon" || obj?.class === "zone-text") {
      renderLayerItems("zones");
    }
    if (obj?.class === "room-polygon" || obj?.class === "room-text") {
      renderLayerItems("rooms");
    }
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

  // Listen for external requests to refresh item lists (e.g., name changes)
  const onItemsChanged = () => {
    renderLayerItems("zones");
    renderLayerItems("rooms");
  };
  document.addEventListener("layers:items-changed", onItemsChanged);
  domItemsChangedHandler = onItemsChanged;
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

      // Apply per-item individual visibility if set on the object
      if (obj._individualVisible === false) {
        isVisible = false;
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

// Set a color's alpha without compounding prior alpha; preserves original RGB/HSL components
const setColorAlpha = (colorStr, alpha) => {
  if (!colorStr) return colorStr;
  const rgbaMatch = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`;
  }
  const hslaMatch = colorStr.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
  if (hslaMatch) {
    return `hsla(${hslaMatch[1]},${hslaMatch[2]}%,${hslaMatch[3]}%,${alpha})`;
  }
  const hslMatch = colorStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (hslMatch) {
    return `hsla(${hslMatch[1]},${hslMatch[2]}%,${hslMatch[3]}%,${alpha})`;
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
      const objectOpacityFactor = typeof obj._individualOpacity === "number" ? obj._individualOpacity : 1;
      const objectEffectiveOpacity = effectiveOpacity * objectOpacityFactor;

      if (layerName === "zones" && obj.type === "polygon") {
        // Handle zone polygon colors with non-compounding alpha
        const fillBaseAlpha = 0.2;
        const strokeBaseAlpha = 1;
        obj.set({
          fill: setColorAlpha(obj.fill, fillBaseAlpha * objectEffectiveOpacity),
          stroke: setColorAlpha(obj.stroke, strokeBaseAlpha * objectEffectiveOpacity),
        });
      } else if (SYSTEM_LAYERS.includes(layerName) && obj.type === "polygon") {
        // Handle system layer polygons
        obj.set({
          fill: updateColorOpacity(obj.fill, objectEffectiveOpacity),
          stroke: updateColorOpacity(obj.stroke, objectEffectiveOpacity) || obj.stroke,
        });
        if (!updateColorOpacity(obj.stroke, objectEffectiveOpacity)) {
          obj.set({ opacity: objectEffectiveOpacity });
        }
      } else {
        obj.set({ opacity: objectEffectiveOpacity });

        // Handle coverage areas for system layers
        if (SYSTEM_LAYERS.includes(layerName) && obj.coverageArea?.set) {
          const fill = obj.coverageConfig?.fillColor || obj.coverageArea.fill;
          obj.coverageArea.set({
            fill: updateColorOpacity(fill, objectEffectiveOpacity),
            stroke: `rgba(0, 0, 0, ${objectEffectiveOpacity})`,
            visible: layers[layerName].visible && layers.devices.visible && objectEffectiveOpacity > 0 && obj.coverageConfig?.visible,
          });
        }

        // Handle CCTV resize icons
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

  // Ensure per-item containers exist each time controls are set up
  ensurePerItemContainers();
  // Initial render of items
  renderLayerItems("zones");
  renderLayerItems("rooms");
};

// Ensure per-item containers exist under the Zones and Rooms sections
function ensurePerItemContainers() {
  ["zones", "rooms"].forEach((name) => {
    if (perItemContainers[name] && document.body.contains(perItemContainers[name])) return;
    // Anchor under the Access layer slider as requested
    const accessSlider = document.getElementById("access-layer-opacity-slider");
    // Fallback to the original layer slider only if Access slider isn't present
    const fallbackSlider = document.getElementById(`${name}-layer-opacity-slider`);
    let anchorEl = accessSlider || fallbackSlider;
    if (!anchorEl) return;

    // Create container only once and insert after the slider
    const container = document.createElement("div");
    container.id = `${name}-layer-items`;
    container.style.margin = "8px 0 16px 0";
    container.style.borderTop = "1px dashed rgba(255,255,255,0.15)";
    container.style.paddingTop = "8px";
    container.style.maxHeight = "180px";
    container.style.overflowY = "auto";
    container.style.fontSize = "0.9rem";

    // Add a subtle label
    const label = document.createElement("div");
    label.textContent = name === "zones" ? "Zones (toggle individually)" : "Rooms (toggle individually)";
    label.style.color = "#bbb";
    label.style.marginBottom = "6px";
    label.style.fontWeight = "500";
    container.appendChild(label);

    // List wrapper
    const list = document.createElement("div");
    list.className = "layer-item-list";
    container.appendChild(list);

    // Insert after the anchor; if creating rooms and zones already exists, anchor after zones
    if (name === "rooms" && perItemContainers["zones"]) {
      anchorEl = perItemContainers["zones"]; // place rooms after zones
    }
    anchorEl.parentNode.insertBefore(container, anchorEl.nextSibling);
    perItemContainers[name] = container;
  });
}

// Render items (zones or rooms) with checkboxes for individual visibility
function renderLayerItems(layerName) {
  ensurePerItemContainers();
  const container = perItemContainers[layerName];
  if (!container) return;
  const list = container.querySelector(".layer-item-list");
  if (!list) return;

  // Decide source and accessors
  const isZones = layerName === "zones";
  const items = (isZones ? window.zones : window.rooms) || [];

  // Build a DocumentFragment for performance
  const frag = document.createDocumentFragment();

  items.forEach((item, idx) => {
    const polygon = item?.polygon || item; // fallback if structure changes
    const text = item?.text;
    if (!polygon) return;

    // Ensure a stable id on polygon for checkbox mapping
    if (!polygon._layerItemId) polygon._layerItemId = `layer-${layerName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const name = isZones ? polygon.zoneName || `Zone ${idx + 1}` : polygon.roomName || item?.roomName || `Room ${idx + 1}`;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.margin = "4px 0";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `${polygon._layerItemId}-checkbox`;
    checkbox.className = "form-check-input";
    checkbox.style.marginTop = "0";
    checkbox.checked = polygon._individualVisible !== false; // default true

    checkbox.addEventListener("change", () => {
      const checked = checkbox.checked;
      polygon._individualVisible = checked;
      if (text) text._individualVisible = checked;
      updateLayerVisibility();
    });

    const span = document.createElement("label");
    span.setAttribute("for", `${polygon._layerItemId}-checkbox`);
    span.textContent = name;
    // Make label take up half of the available space
    span.style.flex = "1 1 50%";
    span.style.minWidth = "0"; // allow ellipsis to work within flex
    span.style.cursor = "pointer";
    // Prevent wrapping; truncate with ellipsis to keep slider on the same line
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";

    // Per-item opacity slider (0-100)
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = Math.round((typeof polygon._individualOpacity === "number" ? polygon._individualOpacity : 1) * 100).toString();
    // Make the slider take available space between label and end
    slider.style.flex = "1 1 50%";
    slider.style.width = "auto";
    slider.style.minWidth = "80px";
    slider.className = "form-range";

    // Update track style and handler
    updateSliderTrack(slider, Number(slider.value), Number(slider.min), Number(slider.max));
    slider.addEventListener("input", () => {
      const v = Number(slider.value) / 100;
      polygon._individualOpacity = v;
      if (text) text._individualOpacity = v;
      updateLayerOpacity();
      updateSliderTrack(slider, Number(slider.value), Number(slider.min), Number(slider.max));
    });

    row.appendChild(checkbox);
    row.appendChild(span);
    row.appendChild(slider);
    frag.appendChild(row);
  });

  // Replace content while preserving scroll if possible
  const prevScroll = list.scrollTop;
  list.innerHTML = "";
  list.appendChild(frag);
  list.scrollTop = prevScroll;
}

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
// Allow external scripts (e.g., sidebars) to request a re-render of per-item lists
window.requestLayerItemsRefresh = () => {
  renderLayerItems("zones");
  renderLayerItems("rooms");
};
