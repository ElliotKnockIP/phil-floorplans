// Manages global configuration and visual styles for all devices on the canvas
import { setTextVisibility } from "../sidebar/sidebar-utils.js";
import { DeviceFactory } from "./DeviceFactory.js";

export class DeviceSettings {
  // Initialize settings with default values and canvas reference
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.globalIconSize = 30;
    this.globalIconTextVisible = true;
    this.globalDeviceColor = "#f8794b";
    this.globalTextColor = "#FFFFFF";
    this.globalFont = "Poppins, sans-serif";
    this.globalTextBackground = true;
    this.globalBoldText = false;
    this.globalCompleteDeviceIndicator = true;
    this.globalLabelDragEnabled = false;

    // Set initial global defaults
    this.setGlobalDefaults();

    // Initialize settings
    this.initializeSettingsListeners();
    this.setupDeviceHoverEvents();
  }

  // Export local settings to the global window object for cross-module access
  setGlobalDefaults() {
    const globalDefaults = {
      defaultDeviceIconSize: this.globalIconSize,
      globalIconTextVisible: this.globalIconTextVisible,
      globalDeviceColor: this.globalDeviceColor,
      globalTextColor: this.globalTextColor,
      globalFont: this.globalFont,
      globalTextBackground: this.globalTextBackground,
      globalBoldText: this.globalBoldText,
      globalCompleteDeviceIndicator: this.globalCompleteDeviceIndicator,
      globalLabelDragEnabled: this.globalLabelDragEnabled,
    };
    Object.assign(window, globalDefaults);
  }

  // Retrieve all objects on the canvas that are identified as devices
  getAllDeviceGroups() {
    return this.fabricCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType);
  }

  // Resize a specific device icon and its associated elements
  updateDeviceIconSize(group, size) {
    if (!group || !group.getObjects) return;

    // Re-attach label behavior to ensure correct positioning after scale change
    DeviceFactory.attachLabelBehavior(group, group.textObject, this.fabricCanvas);

    const clampedSize = Math.max(1, Math.min(100, parseInt(size) || 30));
    const scaleFactor = clampedSize / 30;
    group.scaleFactor = scaleFactor;

    const imageObj = group.getObjects().find((obj) => obj.type === "image");
    const circleObj = group.getObjects().find((obj) => obj.type === "circle");

    if (imageObj && circleObj) {
      const baseCircleRadius = 20;

      // Scale the icon image
      imageObj.set({
        scaleX: scaleFactor * (30 / imageObj.width),
        scaleY: scaleFactor * (30 / imageObj.height),
      });

      // Scale the background circle
      circleObj.set({
        radius: baseCircleRadius * scaleFactor,
        scaleX: 1,
        scaleY: 1,
      });

      // Update group dimensions
      group.set({
        scaleX: 1,
        scaleY: 1,
        width: circleObj.radius * 2,
        height: circleObj.radius * 2,
      });

      // Adjust label font size and position
      if (group.textObject) {
        const fontSize = 12 * scaleFactor;

        group.textObject.set({
          fontSize: fontSize,
        });
        DeviceFactory.applyLabelPosition(group);
      }

      // Refresh camera coverage area if it exists
      if (group.coverageConfig && group.createOrUpdateCoverageArea) {
        group.createOrUpdateCoverageArea();
      }

      group.setCoords();
    }
  }

  // Change the background circle color for a device
  updateDeviceColor(group, color) {
    if (!group || !group.getObjects) return;
    const circleObj = group.getObjects().find((obj) => obj.type === "circle");
    if (circleObj) {
      circleObj.set({ fill: color });
      group.originalCircleColor = color;
    }
  }

  // Change the text color for a device label
  updateDeviceTextColor(group, color) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fill: color });
  }

  // Change the font family for a device label
  updateDeviceFont(group, font) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fontFamily: font });
  }

  // Toggle the semi-transparent background for a device label
  updateDeviceTextBackground(group, showBackground) {
    if (!group || !group.textObject) return;
    group.textObject.set({
      backgroundColor: showBackground ? "rgba(20, 18, 18, 0.8)" : "transparent",
    });
  }

  // Toggle bold styling for a device label
  updateDeviceBoldText(group, isBold) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fontWeight: isBold ? "bold" : "normal" });
  }

  // Determine if all required fields for a device have been filled out
  isDeviceComplete(group) {
    if (!group) return false;
    const deviceName = group.textObject?.text || "";
    const mounted = group.mountedPosition || "";
    const location = group.location || "";
    const partNumber = group.partNumber || "";
    const stockNumber = group.stockNumber || "";

    return deviceName.trim() !== "" && mounted.trim() !== "" && location.trim() !== "" && partNumber.trim() !== "" && stockNumber.trim() !== "";
  }

  // Change device color to green if complete, or revert to original color
  updateDeviceCompleteIndicator(group) {
    if (!group || !group.getObjects) return;

    const circleObj = group.getObjects().find((obj) => obj.type === "circle");
    if (!circleObj) return;

    // Store original color before changing to green
    if (!group.originalCircleColor) {
      group.originalCircleColor = circleObj.fill;
    }

    if (this.globalCompleteDeviceIndicator && this.isDeviceComplete(group)) {
      circleObj.set({ fill: "#00ff00" });
    } else {
      circleObj.set({ fill: group.originalCircleColor || window.globalDeviceColor || "#f8794b" });
    }

    this.fabricCanvas.renderAll();
  }

  // Show or hide labels when hovering over devices if global visibility is off
  handleDeviceHover(group, isHover) {
    if (this.globalIconTextVisible || !group.textObject) return;
    if (group.deviceType === "text-device") return;

    if (isHover) {
      if (!this.fabricCanvas.getObjects().includes(group.textObject)) {
        this.fabricCanvas.add(group.textObject);
      }
      group.textObject.set({ visible: true });
      group.textObject.bringToFront();
    } else {
      group.textObject.set({ visible: false });
      this.fabricCanvas.remove(group.textObject);
    }
    this.fabricCanvas.renderAll();
  }

  // Ensure the label behavior is correctly attached to a group
  ensureGroupLabelBehavior(group) {
    if (!group || !group.textObject) return;
    DeviceFactory.attachLabelBehavior(group, group.textObject, this.fabricCanvas);
  }

  // Apply a new icon size to all devices on the canvas
  updateAllIconSizes(size) {
    this.globalIconSize = size;
    window.defaultDeviceIconSize = size;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceIconSize(group, size));
    this.fabricCanvas.renderAll();
  }

  // Toggle label visibility for all devices
  updateAllIconTextVisibility(visible) {
    this.globalIconTextVisible = visible;
    window.globalIconTextVisible = visible;
    this.getAllDeviceGroups().forEach((group) => {
      if (group.textObject) {
        this.ensureGroupLabelBehavior(group);
        setTextVisibility(group.textObject, visible, this.fabricCanvas);
        DeviceFactory.setGroupLabelDragState(group, this.globalLabelDragEnabled);
        DeviceFactory.applyLabelPosition(group);
        group.labelHidden = !visible;
      }
    });
    this.fabricCanvas.renderAll();
  }

  // Apply a new background color to all device icons
  updateAllDeviceColors(color) {
    this.globalDeviceColor = color;
    window.globalDeviceColor = color;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceColor(group, color));
    this.fabricCanvas.renderAll();
  }

  // Apply a new text color to all device labels
  updateAllTextColors(color) {
    this.globalTextColor = color;
    window.globalTextColor = color;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceTextColor(group, color));
    this.fabricCanvas.renderAll();
  }

  // Apply a new font family to all device labels
  updateAllFonts(font) {
    this.globalFont = font;
    window.globalFont = font;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceFont(group, font));
    this.fabricCanvas.renderAll();
  }

  // Toggle label backgrounds for all devices
  updateAllTextBackgrounds(showBackground) {
    this.globalTextBackground = showBackground;
    window.globalTextBackground = showBackground;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceTextBackground(group, showBackground));
    this.fabricCanvas.renderAll();
  }

  // Toggle bold styling for all device labels
  updateAllBoldText(isBold) {
    this.globalBoldText = isBold;
    window.globalBoldText = isBold;
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceBoldText(group, isBold));
    this.fabricCanvas.renderAll();
  }

  // Enable or disable label dragging for all devices
  updateAllLabelDrag(enabled) {
    this.globalLabelDragEnabled = enabled;
    window.globalLabelDragEnabled = enabled;
    this.getAllDeviceGroups().forEach((group) => {
      if (group.textObject) {
        this.ensureGroupLabelBehavior(group);
        DeviceFactory.setGroupLabelDragState(group, enabled);
      }
    });
    this.fabricCanvas.renderAll();
  }

  // Refresh the completion status indicator for all devices
  updateAllCompleteIndicators() {
    this.getAllDeviceGroups().forEach((group) => this.updateDeviceCompleteIndicator(group));
  }

  // Restrict zoom level to a safe range
  clampZoom(z) {
    return Math.min(10, Math.max(0.25, z));
  }

  // Zoom the canvas to a specific point and update the UI
  setZoomAndCenter(newZoom, centerPoint) {
    const vpt = this.fabricCanvas.viewportTransform;
    if (!centerPoint) {
      const center = this.fabricCanvas.getCenter();
      centerPoint = new fabric.Point(center.left, center.top);
    }
    this.fabricCanvas.zoomToPoint(centerPoint, newZoom);
    this.fabricCanvas.requestRenderAll();
    this.updateZoomDisplay();
  }

  // Update the zoom percentage text in the UI
  updateZoomDisplay() {
    const zoomPctEl = document.getElementById("zoom-percentage");
    if (!zoomPctEl) return;
    const pct = Math.round(this.fabricCanvas.getZoom() * 100);
    zoomPctEl.textContent = pct + "%";
  }

  // Update the visual track of a range slider
  updateSliderTrack(slider, value, min, max) {
    const percentage = ((value - min) / (max - min)) * 100;
    const color = "var(--orange-ip2, #f8794b)";
    slider.style.background = `linear-gradient(to right, ${color} ${percentage}%, #e9ecef ${percentage}%)`;
  }

  // Bind UI elements to settings logic
  initializeSettingsListeners() {
    // Zoom controls
    const zoomOutBtn = document.getElementById("zoom-out-btn");
    const zoomInBtn = document.getElementById("zoom-in-btn");

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        const current = this.fabricCanvas.getZoom();
        this.setZoomAndCenter(this.clampZoom(current - 0.1));
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        const current = this.fabricCanvas.getZoom();
        this.setZoomAndCenter(this.clampZoom(current + 0.1));
      });
    }

    this.updateZoomDisplay();

    // Global settings elements
    const elements = {
      globalIconSizeSlider: document.getElementById("global-icon-size-slider"),
      globalIconSizeInput: document.getElementById("global-icon-size-input"),
      globalIconTextToggle: document.getElementById("global-icon-text-toggle"),
      globalDeviceColorPicker: document.getElementById("global-device-color-picker"),
      globalDeviceColorIcons: document.querySelectorAll(".global-device-colour .colour-icon"),
      globalTextColorPicker: document.getElementById("global-text-color-picker"),
      globalTextColorIcons: document.querySelectorAll(".global-text-colour .colour-icon"),
      globalFontSelect: document.getElementById("global-font-select"),
      globalTextBackgroundToggle: document.getElementById("global-text-background-toggle"),
      globalBoldTextToggle: document.getElementById("global-bold-text-toggle"),
      globalCompleteDeviceIndicatorToggle: document.getElementById("global-complete-device-indicator-toggle"),
      globalLabelDragToggle: document.getElementById("global-label-drag-toggle"),
    };

    // Icon size slider
    if (elements.globalIconSizeSlider) {
      elements.globalIconSizeSlider.addEventListener("input", (e) => {
        const size = parseInt(e.target.value);
        this.globalIconSize = size;
        if (elements.globalIconSizeInput) {
          elements.globalIconSizeInput.textContent = size + "px";
        }
        this.updateSliderTrack(elements.globalIconSizeSlider, size, 1, 100);
        this.updateAllIconSizes(size);
      });
    }

    // Icon text toggle
    if (elements.globalIconTextToggle) {
      elements.globalIconTextToggle.addEventListener("change", (e) => {
        this.updateAllIconTextVisibility(e.target.checked);
      });
    }

    // Device color controls
    if (elements.globalDeviceColorPicker) {
      elements.globalDeviceColorPicker.addEventListener("input", (e) => {
        this.updateAllDeviceColors(e.target.value);
      });
    }

    elements.globalDeviceColorIcons.forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const color = icon.getAttribute("data-color");
        if (color) this.updateAllDeviceColors(color);
      });
    });

    // Text color controls
    if (elements.globalTextColorPicker) {
      elements.globalTextColorPicker.addEventListener("input", (e) => {
        this.updateAllTextColors(e.target.value);
      });
    }

    elements.globalTextColorIcons.forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const color = icon.getAttribute("data-color");
        if (color) this.updateAllTextColors(color);
      });
    });

    // Font selection
    if (elements.globalFontSelect) {
      elements.globalFontSelect.addEventListener("change", (e) => {
        this.updateAllFonts(e.target.value);
      });
    }

    // Text background toggle
    if (elements.globalTextBackgroundToggle) {
      elements.globalTextBackgroundToggle.addEventListener("change", (e) => {
        this.updateAllTextBackgrounds(e.target.checked);
      });
    }

    // Bold text toggle
    if (elements.globalBoldTextToggle) {
      elements.globalBoldTextToggle.addEventListener("change", (e) => {
        this.updateAllBoldText(e.target.checked);
      });
    }

    // Complete device indicator toggle
    if (elements.globalCompleteDeviceIndicatorToggle) {
      elements.globalCompleteDeviceIndicatorToggle.addEventListener("change", (e) => {
        this.globalCompleteDeviceIndicator = e.target.checked;
        window.globalCompleteDeviceIndicator = e.target.checked;
        this.updateAllCompleteIndicators();
      });
    }

    // Label drag toggle
    if (elements.globalLabelDragToggle) {
      elements.globalLabelDragToggle.addEventListener("change", (e) => {
        this.updateAllLabelDrag(e.target.checked);
      });
    }

    // Set initial values
    if (elements.globalIconSizeSlider) {
      elements.globalIconSizeSlider.value = this.globalIconSize;
      this.updateSliderTrack(elements.globalIconSizeSlider, this.globalIconSize, 1, 100);
      if (elements.globalIconSizeInput) {
        elements.globalIconSizeInput.textContent = this.globalIconSize + "px";
      }
    }

    if (elements.globalIconTextToggle) elements.globalIconTextToggle.checked = this.globalIconTextVisible;
    if (elements.globalDeviceColorPicker) elements.globalDeviceColorPicker.value = this.globalDeviceColor;
    if (elements.globalTextColorPicker) elements.globalTextColorPicker.value = this.globalTextColor;
    if (elements.globalFontSelect) elements.globalFontSelect.value = this.globalFont;
    if (elements.globalTextBackgroundToggle) elements.globalTextBackgroundToggle.checked = this.globalTextBackground;
    if (elements.globalBoldTextToggle) elements.globalBoldTextToggle.checked = this.globalBoldText;
    if (elements.globalCompleteDeviceIndicatorToggle) {
      elements.globalCompleteDeviceIndicatorToggle.checked = this.globalCompleteDeviceIndicator;
    }
    if (elements.globalLabelDragToggle) elements.globalLabelDragToggle.checked = this.globalLabelDragEnabled;
  }

  // Restore settings from a saved project state
  applySettingsFromSave(savedSettings = {}) {
    if (!savedSettings || typeof savedSettings !== "object") {
      this.updateAllCompleteIndicators();
      return;
    }

    const { defaultDeviceIconSize, globalIconTextVisible: savedTextVisible, globalDeviceColor: savedDeviceColor, globalTextColor: savedTextColor, globalFont: savedFont, globalTextBackground: savedTextBackground, globalBoldText: savedBoldText, globalCompleteDeviceIndicator: savedCompleteIndicator, globalLabelDragEnabled: savedLabelDragEnabled } = savedSettings;

    const elements = {
      slider: document.getElementById("global-icon-size-slider"),
      sliderLabel: document.getElementById("global-icon-size-input"),
      textToggle: document.getElementById("global-icon-text-toggle"),
      deviceColorPicker: document.getElementById("global-device-color-picker"),
      textColorPicker: document.getElementById("global-text-color-picker"),
      fontSelect: document.getElementById("global-font-select"),
      textBackgroundToggle: document.getElementById("global-text-background-toggle"),
      boldToggle: document.getElementById("global-bold-text-toggle"),
      completeIndicatorToggle: document.getElementById("global-complete-device-indicator-toggle"),
      labelDragToggle: document.getElementById("global-label-drag-toggle"),
    };

    if (typeof defaultDeviceIconSize === "number" && !Number.isNaN(defaultDeviceIconSize)) {
      this.updateAllIconSizes(defaultDeviceIconSize);
      if (elements.slider) {
        elements.slider.value = defaultDeviceIconSize;
        const sliderMin = Number(elements.slider.min) || 1;
        const sliderMax = Number(elements.slider.max) || 100;
        this.updateSliderTrack(elements.slider, defaultDeviceIconSize, sliderMin, sliderMax);
      }
      if (elements.sliderLabel) {
        elements.sliderLabel.textContent = `${defaultDeviceIconSize}px`;
      }
    }

    if (typeof savedTextVisible === "boolean") {
      this.updateAllIconTextVisibility(savedTextVisible);
      if (elements.textToggle) elements.textToggle.checked = savedTextVisible;
    }

    if (typeof savedDeviceColor === "string" && savedDeviceColor) {
      this.updateAllDeviceColors(savedDeviceColor);
      if (elements.deviceColorPicker) elements.deviceColorPicker.value = savedDeviceColor;
    }

    if (typeof savedTextColor === "string" && savedTextColor) {
      this.updateAllTextColors(savedTextColor);
      if (elements.textColorPicker) elements.textColorPicker.value = savedTextColor;
    }

    if (typeof savedFont === "string" && savedFont) {
      this.updateAllFonts(savedFont);
      if (elements.fontSelect) elements.fontSelect.value = savedFont;
    }

    if (typeof savedTextBackground === "boolean") {
      this.updateAllTextBackgrounds(savedTextBackground);
      if (elements.textBackgroundToggle) elements.textBackgroundToggle.checked = savedTextBackground;
    }

    if (typeof savedBoldText === "boolean") {
      this.updateAllBoldText(savedBoldText);
      if (elements.boldToggle) elements.boldToggle.checked = savedBoldText;
    }

    if (typeof savedCompleteIndicator === "boolean") {
      this.globalCompleteDeviceIndicator = savedCompleteIndicator;
      window.globalCompleteDeviceIndicator = savedCompleteIndicator;
      this.updateAllCompleteIndicators();
      if (elements.completeIndicatorToggle) elements.completeIndicatorToggle.checked = savedCompleteIndicator;
    } else {
      this.updateAllCompleteIndicators();
    }

    if (typeof savedLabelDragEnabled === "boolean") {
      this.updateAllLabelDrag(savedLabelDragEnabled);
      if (elements.labelDragToggle) elements.labelDragToggle.checked = savedLabelDragEnabled;
    }
  }

  // Register mouse events for device hover effects
  setupDeviceHoverEvents() {
    this.fabricCanvas.on("mouse:over", (e) => {
      const target = e.target;
      if (target && target.type === "group" && target.deviceType) {
        this.handleDeviceHover(target, true);
      }
    });

    this.fabricCanvas.on("mouse:out", (e) => {
      const target = e.target;
      if (target && target.type === "group" && target.deviceType) {
        this.handleDeviceHover(target, false);
      }
    });
  }

  // Initialize the settings manager and expose its API
  init() {
    this.updateAllLabelDrag(this.globalLabelDragEnabled);

    // Apply any settings that were queued before initialization
    if (window.pendingGlobalSettings) {
      try {
        this.applySettingsFromSave(window.pendingGlobalSettings);
      } finally {
        window.pendingGlobalSettings = null;
      }
    }

    // Expose update function globally
    window.updateDeviceCompleteIndicator = (group) => this.updateDeviceCompleteIndicator(group);

    // Return API for external use
    return {
      updateAllIconSizes: (size) => this.updateAllIconSizes(size),
      updateAllIconTextVisibility: (visible) => this.updateAllIconTextVisibility(visible),
      updateAllDeviceColors: (color) => this.updateAllDeviceColors(color),
      updateAllTextColors: (color) => this.updateAllTextColors(color),
      updateAllFonts: (font) => this.updateAllFonts(font),
      updateAllTextBackgrounds: (show) => this.updateAllTextBackgrounds(show),
      updateAllBoldText: (bold) => this.updateAllBoldText(bold),
      updateAllLabelDrag: (enabled) => this.updateAllLabelDrag(enabled),
      updateAllCompleteIndicators: () => this.updateAllCompleteIndicators(),
      getGlobalIconSize: () => this.globalIconSize,
      getGlobalIconTextVisible: () => this.globalIconTextVisible,
      getGlobalDeviceColor: () => this.globalDeviceColor,
      getGlobalTextColor: () => this.globalTextColor,
      getGlobalFont: () => this.globalFont,
      getGlobalTextBackground: () => this.globalTextBackground,
      getGlobalBoldText: () => this.globalBoldText,
      getGlobalCompleteDeviceIndicator: () => this.globalCompleteDeviceIndicator,
      getGlobalLabelDragEnabled: () => this.globalLabelDragEnabled,
      applySettingsFromSave: (settings) => this.applySettingsFromSave(settings),
    };
  }
}

// Initialize device settings when the canvas is ready
document.addEventListener("canvas:initialized", (e) => {
  const fabricCanvas = e.detail.canvas;
  if (!fabricCanvas) return;

  const deviceSettings = new DeviceSettings(fabricCanvas);
  window.globalSettingsAPI = deviceSettings.init();
});
