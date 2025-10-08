import { setTextVisibility } from "../sidebar/sidebar-utils.js";

export function initGlobalSettings(fabricCanvas) {
  let globalIconSize = 30; // Default global icon size
  let globalIconTextVisible = true; // Default text visible
   let globalDeviceColor = "#f8794b"; // Default global device color
  let globalTextColor = "#FFFFFF"; // Default global text color
  let globalFont = "Poppins, sans-serif"; // Default global font
  let globalTextBackground = true; // Default text background visible
  let globalBoldText = false; // Default bold text off

  // Set initial global defaults
  window.defaultDeviceIconSize = globalIconSize;
  window.globalIconTextVisible = globalIconTextVisible;
  window.globalDeviceColor = globalDeviceColor;
  window.globalTextColor = globalTextColor;
  window.globalFont = globalFont;
  window.globalTextBackground = globalTextBackground;
  window.globalBoldText = globalBoldText;

  // Update slider track appearance
  function updateSliderTrack(slider, value, min, max) {
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, #e9ecef ${percentage}%)`;
  }

  // Get all device groups on the canvas
  function getAllDeviceGroups() {
    return fabricCanvas.getObjects().filter(obj => obj.type === "group" && obj.deviceType);
  }

  // Update icon size for all devices
  function updateAllIconSizes(size) {
    globalIconSize = size;
    window.defaultDeviceIconSize = size; // Update global default for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceIconSize(group, size);
    });

    fabricCanvas.renderAll();
  }

  // Update icon size for a single device
  function updateDeviceIconSize(group, size) {
    if (!group || !group.getObjects) return;

    const clampedSize = Math.max(1, Math.min(100, parseInt(size) || 30));
    const scaleFactor = clampedSize / 30; // Base size is 30px
    group.scaleFactor = scaleFactor;

    const imageObj = group.getObjects().find(obj => obj.type === "image");
    const circleObj = group.getObjects().find(obj => obj.type === "circle");

    if (imageObj && circleObj) {
      const baseCircleRadius = 20;

      imageObj.set({
        scaleX: scaleFactor * (30 / imageObj.width),
        scaleY: scaleFactor * (30 / imageObj.height),
      });

      circleObj.set({
        radius: baseCircleRadius * scaleFactor,
        scaleX: 1,
        scaleY: 1,
      });

      group.set({
        scaleX: 1,
        scaleY: 1,
        width: circleObj.radius * 2,
        height: circleObj.radius * 2,
      });

      // Update text position and size
      if (group.textObject) {
        const groupCenter = group.getCenterPoint();
        const textTop = groupCenter.y + baseCircleRadius * scaleFactor + 10;
        const fontSize = 12 * scaleFactor;

        group.textObject.set({
          top: textTop,
          fontSize: fontSize,
        });
      }

      // Update coverage if exists
      if (group.coverageConfig && group.createOrUpdateCoverageArea) {
        group.createOrUpdateCoverageArea();
      }

      group.setCoords();
    }
  }

  // Update text visibility for all devices
  function updateAllIconTextVisibility(visible) {
    globalIconTextVisible = visible;
    window.globalIconTextVisible = visible; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      if (group.textObject) {
        setTextVisibility(group.textObject, visible, fabricCanvas);
        group.labelHidden = !visible;
      }
    });
  }

  // Update device color for all devices
  function updateAllDeviceColors(color) {
    globalDeviceColor = color;
    window.globalDeviceColor = color; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceColor(group, color);
    });

    fabricCanvas.renderAll();
  }

  // Update device color for a single device
  function updateDeviceColor(group, color) {
    if (!group || !group.getObjects) return;

    const circleObj = group.getObjects().find(obj => obj.type === "circle");
    if (circleObj) {
      circleObj.set({ fill: color });
    }
  }

  // Update text color for all devices
  function updateAllTextColors(color) {
    globalTextColor = color;
    window.globalTextColor = color; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceTextColor(group, color);
    });

    fabricCanvas.renderAll();
  }

  // Update text color for a single device
  function updateDeviceTextColor(group, color) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fill: color });
  }

  // Update font for all devices
  function updateAllFonts(font) {
    globalFont = font;
    window.globalFont = font; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceFont(group, font);
    });

    fabricCanvas.renderAll();
  }

  // Update font for a single device
  function updateDeviceFont(group, font) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fontFamily: font });
  }

  // Update text background for all devices
  function updateAllTextBackgrounds(showBackground) {
    globalTextBackground = showBackground;
    window.globalTextBackground = showBackground; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceTextBackground(group, showBackground);
    });

    fabricCanvas.renderAll();
  }

  // Update text background for a single device
  function updateDeviceTextBackground(group, showBackground) {
    if (!group || !group.textObject) return;
    group.textObject.set({ backgroundColor: showBackground ? "rgba(20, 18, 18, 0.8)" : "transparent" });
  }

  // Update bold text for all devices
  function updateAllBoldText(isBold) {
    globalBoldText = isBold;
    window.globalBoldText = isBold; // Update global for new devices
    const deviceGroups = getAllDeviceGroups();

    deviceGroups.forEach(group => {
      updateDeviceBoldText(group, isBold);
    });

    fabricCanvas.renderAll();
  }

  // Update bold text for a single device
  function updateDeviceBoldText(group, isBold) {
    if (!group || !group.textObject) return;
    group.textObject.set({ fontWeight: isBold ? "bold" : "normal" });
  }

  // Handle hover for device text when global text is off
  function handleDeviceHover(group, isHover) {
    if (globalIconTextVisible || !group.textObject) return;

    if (isHover) {
      // Show on hover
      if (!fabricCanvas.getObjects().includes(group.textObject)) {
        fabricCanvas.add(group.textObject);
      }
      group.textObject.set({ visible: true });
      group.textObject.bringToFront();
    } else {
      // Hide on mouse out
      group.textObject.set({ visible: false });
      fabricCanvas.remove(group.textObject);
    }
    fabricCanvas.renderAll();
  }

  // Initialize event listeners for global settings
  function initializeSettingsListeners() {
    const globalIconSizeSlider = document.getElementById("global-icon-size-slider");
    const globalIconSizeInput = document.getElementById("global-icon-size-input");
    const globalIconTextToggle = document.getElementById("global-icon-text-toggle");
    const globalDeviceColorPicker = document.getElementById("global-device-color-picker");
    const globalDeviceColorIcons = document.querySelectorAll(".global-device-colour .colour-icon");
    const globalTextColorPicker = document.getElementById("global-text-color-picker");
    const globalTextColorIcons = document.querySelectorAll(".global-text-colour .colour-icon");
    const globalFontSelect = document.getElementById("global-font-select");
    const globalTextBackgroundToggle = document.getElementById("global-text-background-toggle");
    const globalBoldTextToggle = document.getElementById("global-bold-text-toggle");

    // Global icon size slider
    if (globalIconSizeSlider) {
      globalIconSizeSlider.addEventListener("input", (e) => {
        const size = parseInt(e.target.value);
        globalIconSize = size;
        if (globalIconSizeInput) {
          globalIconSizeInput.textContent = size + "px";
        }
        updateSliderTrack(globalIconSizeSlider, size, 1, 100);
        updateAllIconSizes(size);
      });
    }

    // Global icon text toggle
    if (globalIconTextToggle) {
      globalIconTextToggle.addEventListener("change", (e) => {
        updateAllIconTextVisibility(e.target.checked);
      });
    }

    // Global device color controls
    if (globalDeviceColorPicker) {
      globalDeviceColorPicker.addEventListener("input", (e) => {
        updateAllDeviceColors(e.target.value);
      });
    }

    globalDeviceColorIcons.forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const color = icon.getAttribute("data-color");
        if (color) {
          updateAllDeviceColors(color);
        }
      });
    });

    // Global text color controls
    if (globalTextColorPicker) {
      globalTextColorPicker.addEventListener("input", (e) => {
        updateAllTextColors(e.target.value);
      });
    }

    globalTextColorIcons.forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const color = icon.getAttribute("data-color");
        if (color) {
          updateAllTextColors(color);
        }
      });
    });

    // Global font selection
    if (globalFontSelect) {
      globalFontSelect.addEventListener("change", (e) => {
        updateAllFonts(e.target.value);
      });
    }

    // Global text background toggle
    if (globalTextBackgroundToggle) {
      globalTextBackgroundToggle.addEventListener("change", (e) => {
        updateAllTextBackgrounds(e.target.checked);
      });
    }

    // Global bold text toggle
    if (globalBoldTextToggle) {
      globalBoldTextToggle.addEventListener("change", (e) => {
        updateAllBoldText(e.target.checked);
      });
    }

    // Set initial values
    if (globalIconSizeSlider) {
      globalIconSizeSlider.value = globalIconSize;
      updateSliderTrack(globalIconSizeSlider, globalIconSize, 1, 100);
      if (globalIconSizeInput) {
        globalIconSizeInput.textContent = globalIconSize + "px";
      }
    }

    if (globalIconTextToggle) {
      globalIconTextToggle.checked = globalIconTextVisible;
    }

    if (globalDeviceColorPicker) {
      globalDeviceColorPicker.value = globalDeviceColor;
    }

    if (globalTextColorPicker) {
      globalTextColorPicker.value = globalTextColor;
    }

    if (globalFontSelect) {
      globalFontSelect.value = globalFont;
    }

    if (globalTextBackgroundToggle) {
      globalTextBackgroundToggle.checked = globalTextBackground;
    }

    if (globalBoldTextToggle) {
      globalBoldTextToggle.checked = globalBoldText;
    }
  }

  // Set up hover events for devices
  function setupDeviceHoverEvents() {
    fabricCanvas.on("mouse:over", (e) => {
      const target = e.target;
      if (target && target.type === "group" && target.deviceType) {
        handleDeviceHover(target, true);
      }
    });

    fabricCanvas.on("mouse:out", (e) => {
      const target = e.target;
      if (target && target.type === "group" && target.deviceType) {
        handleDeviceHover(target, false);
      }
    });
  }

  // Initialize everything
  initializeSettingsListeners();
  setupDeviceHoverEvents();

  // Return API for external use
  return {
    updateAllIconSizes,
    updateAllIconTextVisibility,
    updateAllDeviceColors,
    updateAllTextColors,
    updateAllFonts,
    updateAllTextBackgrounds,
    updateAllBoldText,
    getGlobalIconSize: () => globalIconSize,
    getGlobalIconTextVisible: () => globalIconTextVisible,
    getGlobalDeviceColor: () => globalDeviceColor,
    getGlobalTextColor: () => globalTextColor,
    getGlobalFont: () => globalFont,
    getGlobalTextBackground: () => globalTextBackground,
    getGlobalBoldText: () => globalBoldText,
  };
}