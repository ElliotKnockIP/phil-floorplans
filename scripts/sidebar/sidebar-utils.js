// Updates the visual appearance of a slider track based on its value
export function updateSliderTrack(slider, value, min, max) {
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, #d3d3d3 ${percentage}%)`;
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
  const { min = 0, max = 100, step = 1, precision = 0 } = options;

  if (slider) {
    slider.addEventListener("input", () => {
      const value = parseFloat(slider.value);
      if (input) input.value = precision > 0 ? value.toFixed(precision) : value;
      updateSliderTrack(slider, value, slider.min || min, slider.max || max);
      if (callback) callback(value);
    });
  }

  if (input) {
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
