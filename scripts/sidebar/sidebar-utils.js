// Updates the visual appearance of a slider track based on its value
export function updateSliderTrack(slider, value, min, max) {
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, #e9ecef ${percentage}%)`;
}

// Prevents event propagation for specified events on an element
export function preventEventPropagation(element, events = ["click", "keydown"]) {
  events.forEach((eventType) => {
    element.addEventListener(eventType, (e) => {
      e.stopPropagation();
      if (eventType === "keydown" && (e.key === "Backspace" || e.key === "Delete")) {
        e.stopPropagation();
      }
    });
  });
}

// Synchronizes slider and input elements, with optional callback
export function createSliderInputSync(slider, input, callback, options = {}) {
  const { min = 0, max = 100, step = 1, precision = 0, format } = options;

  if (slider) {
    slider.addEventListener("input", () => {
      const value = parseFloat(slider.value);
      if (input) {
        if (input.tagName === "INPUT") {
          input.value = precision > 0 ? value.toFixed(precision) : value;
        } else {
          input.textContent = format ? format(value) : (value * 100).toFixed(0) + "%";
        }
      }
      updateSliderTrack(slider, value, slider.min || min, slider.max || max);
      if (callback) callback(value);
    });
  }

  if (input && input.tagName === "INPUT") {
    input.addEventListener("input", () => {
      let value = parseFloat(input.value);
      if (isNaN(value) || value < min) value = min;
      if (value > max) value = max;
      input.value = precision > 0 ? value.toFixed(precision) : value;
      if (slider) {
        slider.value = value;
        slider.dispatchEvent(new Event("input"));
      }
    });
  }
}

// Converts RGB values to hexadecimal color code
export function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Converts HSL values to hexadecimal color code
export function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Converts hex color to RGBA format
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Retrieves the color of an icon element
export function getIconColor(icon) {
  const color = icon.getAttribute("data-color") || getComputedStyle(icon).backgroundColor;
  if (color.startsWith("rgb")) {
    const rgb = color.match(/\d+/g).map(Number);
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  return color;
}

// Sets up color controls for color picker and icons
export function setupColorControls(colorPicker, colorIcons, callback) {
  if (colorPicker) {
    colorPicker.addEventListener("input", (e) => {
      e.stopPropagation();
      callback(e.target.value);
    });
    colorPicker.addEventListener("click", (e) => e.stopPropagation());
  }

  colorIcons.forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      const hexColor = getIconColor(icon);
      callback(hexColor);
      if (colorPicker) colorPicker.value = hexColor;
    });
  });
}

// Wraps a global function with a custom wrapper
export function wrapGlobalFunction(funcName, wrapper) {
  const original = window[funcName];
  window[funcName] = function (...args) {
    wrapper(...args);
    if (original) original.apply(this, args);
  };
  return original;
}

// Creates a toggle handler for checkbox elements
export function createToggleHandler(toggle, callback) {
  if (toggle) {
    toggle.addEventListener("change", () => callback(toggle.checked));
  }
}

// Validates and clamps a value within a specified range
export function validateAndClamp(value, min, max, defaultValue = min) {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

// Safely renders a canvas if it exists
export function safeCanvasRender(canvas) {
  if (canvas && typeof canvas.renderAll === "function") {
    canvas.renderAll();
  }
}

// Sets a single property on an object and updates canvas
export function setObjectProperty(obj, property, value, canvas = null) {
  if (obj && obj.set) {
    obj.set({ [property]: value });
    if (obj.setCoords) obj.setCoords();
    safeCanvasRender(canvas || obj.canvas);
  }
}

// Sets multiple properties on an object and updates canvas
export function setMultipleObjectProperties(obj, properties, canvas = null) {
  if (obj && obj.set) {
    obj.set(properties);
    if (obj.setCoords) obj.setCoords();
    safeCanvasRender(canvas || obj.canvas);
  }
}

// Constants
export const CAMERA_TYPES = ["bullet-camera.png", "box-camera.png", "ptz-camera.png", "dome-camera.png", "fixed-camera.png", "thermal-camera.png", "custom-camera-icon.png"];
export const DEFAULT_DEVICE_ICON_SIZE = 30;
export const DEFAULT_PIXELS_PER_METER = 17.5;

// Utility: point-in-polygon
export function isPointInPolygon(point, polygon) {
  const vertices = polygon.points;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    if (vertices[i].y > point.y !== vertices[j].y > point.y && point.x < ((vertices[j].x - vertices[i].x) * (point.y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

// Utility: area calc from points and canvas scale
export function calculateArea(points, canvas) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  const pixelsPerMeter = canvas?.pixelsPerMeter || DEFAULT_PIXELS_PER_METER;
  return Math.abs(area) / (2 * pixelsPerMeter * pixelsPerMeter);
}

// Utility: color to hex
export function getHexFromFill(fill) {
  if (!fill || typeof fill !== "string") return "#ffffff";
  if (fill.startsWith("hsla")) {
    const m = fill.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
    if (m) {
      const [, h, s, l] = m.map(Number);
      return hslToHex(h, s, l);
    }
  } else if (fill.startsWith("hsl")) {
    const m = fill.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (m) {
      const [, h, s, l] = m.map(Number);
      return hslToHex(h, s, l);
    }
  } else if (fill.startsWith("rgba")) {
    const m = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (m) {
      const [, r, g, b] = m.map(Number);
      return rgbToHex(r, g, b);
    }
  } else if (fill.startsWith("rgb")) {
    const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const [, r, g, b] = m.map(Number);
      return rgbToHex(r, g, b);
    }
  } else if (fill.startsWith("#")) {
    return fill;
  }
  return "#ffffff";
}

// Utility: warning text
export function updateWarningText(targetEl, height) {
  if (!targetEl) return;
  if (height > 2 && height <= 4) {
    targetEl.textContent = "Scaffold or Step Ladders recommended.";
  } else if (height > 4 && height <= 7) {
    targetEl.textContent = "Cherry Picker or Scissor Lift recommended.";
  } else if (height > 7) {
    targetEl.textContent = "Fall Arrest System recommended.";
  } else {
    targetEl.textContent = "";
  }
}

// Text visibility management
export function setTextVisibility(textObject, visible, canvas = null) {
  if (!textObject) return;

  const targetCanvas = canvas || textObject.canvas;
  if (!targetCanvas) return;
  
  // Don't manage visibility for text device labels - they should never be visible
  if (textObject.isDeviceLabel && textObject._parentGroup && textObject._parentGroup.deviceType === "text-device") {
    textObject._isHidden = true;
    textObject.visible = false;
    return;
  }

  if (visible) {
    if (!targetCanvas.getObjects().includes(textObject)) {
      targetCanvas.add(textObject);
      textObject.bringToFront();
    }
    textObject.set({ visible: true });
    textObject._isHidden = false;
  } else {
    if (targetCanvas.getObjects().includes(textObject)) {
      targetCanvas.remove(textObject);
    }
    textObject.set({ visible: false });
    textObject._isHidden = true;
  }

  targetCanvas.renderAll();
}

// Update text position only if it's visible and on canvas
export function updateTextPosition(group, textObject) {
  if (!textObject || textObject._isHidden) return;

  const canvas = group.canvas || textObject.canvas;
  if (!canvas || !canvas.getObjects().includes(textObject)) return;

  const groupCenter = group.getCenterPoint();
  const currentScaleFactor = group.scaleFactor || 1;

  textObject.set({
    left: groupCenter.x,
    top: groupCenter.y + 20 * currentScaleFactor + 10,
  });
  textObject.setCoords();
  textObject.bringToFront();
}
