import { updateSliderTrack, createSliderInputSync, setupColorControls, preventEventPropagation, createToggleHandler, setMultipleObjectProperties, safeCanvasRender, hexToRgba } from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const subSidebar = document.getElementById("sub-sidebar");
  const closeSubSidebarBtn = document.getElementById("close-sub-sidebar");
  const rightSidebar = document.getElementById("right-sidebar");
  const closeRightSidebarBtn = document.getElementById("close-right-sidebar");
  const deviceHeading = document.getElementById("device-heading");
  const cameraProperties = document.getElementById("camera-properties");
  const genericProperties = document.getElementById("generic-properties");
  const zoneProperties = document.getElementById("zone-properties");
  const roomProperties = document.getElementById("room-properties");
  const deviceLabelInput = document.getElementById("device-label-input");
  const deviceLabelToggle = document.getElementById("device-label-toggle");
  const colorIcons = document.querySelectorAll(".change-icon-colour .colour-icon");
  const iconColorPicker = document.getElementById("icon-color-picker");
  const customIconInput = document.getElementById("custom-icon-input");
  const iconSizeSlider = document.getElementById("icon-size-slider");
  const iconSizeInput = document.getElementById("icon-size-input");
  const iconRotationSlider = document.getElementById("icon-rotation-slider");
  const iconRotationInput = document.getElementById("icon-rotation-input");
  const deviceTextColorPicker = document.getElementById("device-text-color-picker");
  const deviceTextColorIcons = document.querySelectorAll(".device-text-colour .colour-icon");
  const deviceTextBgColorPicker = document.getElementById("device-background-text-color-picker");
  const deviceTextBgColorIcons = document.querySelectorAll(".device-background-text-colour .colour-icon");
  const partNumberInput = document.getElementById("device-part-number-input");
  const fittingPositionsInput = document.getElementById("fitting-positions");
  const stockNumberInput = document.getElementById("device-stock-number-input");

  let currentTextObject = null;
  let currentGroup = null;

  const CAMERA_TYPES = ["bullet-camera.png", "box-camera.png", "ptz-camera.png", "dome-camera.png", "fixed-camera.png", "thermal-camera.png", "custom-camera-icon.png"];

  const DEVICE_NAME_MAP = {
    "bullet-camera.png": "Camera Properties",
    "box-camera.png": "Camera Properties",
    "ptz-camera.png": "Camera Properties",
    "dome-camera.png": "Camera Properties",
    "fixed-camera.png": "Camera Properties",
    "thermal-camera.png": "Camera Properties",
    "custom-camera-icon.png": "Camera Properties",
    "zone-polygon": "Zone Properties",
    "room-polygon": "Room Properties",
  };

  // Text visibility management
  function setTextVisibility(textObject, visible, canvas = null) {
    if (!textObject) return;

    const targetCanvas = canvas || textObject.canvas;
    if (!targetCanvas) return;

    if (visible) {
      // Show text - add to canvas if not present
      if (!targetCanvas.getObjects().includes(textObject)) {
        targetCanvas.add(textObject);
        textObject.bringToFront();
      }
      textObject.set({ visible: true });
      textObject._isHidden = false;
    } else {
      // Hide text - remove completely from canvas
      if (targetCanvas.getObjects().includes(textObject)) {
        targetCanvas.remove(textObject);
      }
      textObject.set({ visible: false });
      textObject._isHidden = true;
    }

    targetCanvas.renderAll();
  }

  // Update text position only if it's visible and on canvas
  function updateTextPosition(group, textObject) {
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

  // Hides all submenus
  function hideAllSubmenus() {
    document.querySelectorAll(".submenu").forEach((submenu) => {
      submenu.classList.add("hidden");
      submenu.classList.remove("show");
    });
  }

  // Shows a specific submenu
  function showSubmenu(menuId) {
    hideAllSubmenus();
    rightSidebar.classList.add("hidden");
    const submenu = document.getElementById(menuId);
    if (submenu) {
      submenu.classList.remove("hidden");
      submenu.classList.add("show");
      subSidebar.classList.remove("hidden");
    }
  }

  // Updates the size of a device icon
  function updateIconSize(size) {
    if (!currentGroup || !currentGroup.canvas || typeof currentGroup.getObjects !== "function") return;

    // Clamp size between 1 and 100px
    const clampedSize = Math.max(1, Math.min(100, parseInt(size) || 30));
    const scaleFactor = clampedSize / 30; // 30 is the base icon size
    currentGroup.scaleFactor = scaleFactor;

    const imageObj = currentGroup.getObjects().find((obj) => obj.type === "image");
    const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");

    if (imageObj && circleObj) {
      const baseIconSize = 30;
      const baseCircleRadius = 20;

      setMultipleObjectProperties(imageObj, {
        scaleX: scaleFactor * (baseIconSize / imageObj.width),
        scaleY: scaleFactor * (baseIconSize / imageObj.height),
      });

      setMultipleObjectProperties(circleObj, {
        radius: baseCircleRadius * scaleFactor,
        scaleX: 1, // Reset scale since adjust radius directly
        scaleY: 1,
      });

      setMultipleObjectProperties(currentGroup, {
        scaleX: 1,
        scaleY: 1,
        width: circleObj.radius * 2,
        height: circleObj.radius * 2,
      });

      // Update text size and position if visible
      if (currentTextObject && !currentTextObject._isHidden) {
        const groupCenter = currentGroup.getCenterPoint();
        const textTop = groupCenter.y + baseCircleRadius * scaleFactor + 10;
        const fontSize = 12 * scaleFactor;

        setMultipleObjectProperties(currentTextObject, {
          top: textTop,
          fontSize: fontSize,
        });
      }

      // Update camera coverage if this is a camera device
      if (currentGroup.coverageConfig && currentGroup.createOrUpdateCoverageArea) {
        currentGroup.createOrUpdateCoverageArea();
      }

      currentGroup.setCoords();
      safeCanvasRender(currentGroup.canvas);
    }
  }

  // Updates the rotation of a device icon
  function updateIconRotation(sliderValue) {
    if (!currentGroup || !currentGroup.canvas || typeof currentGroup.getObjects !== "function") return;

    const rotationAngle = ((sliderValue - 1) / 99) * 360;
    const imageObj = currentGroup.getObjects().find((obj) => obj.type === "image");
    const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");

    if (imageObj && circleObj) {
      setMultipleObjectProperties(imageObj, { angle: rotationAngle });
      setMultipleObjectProperties(circleObj, { angle: rotationAngle });
      currentGroup.setCoords();
      safeCanvasRender(currentGroup.canvas);
    }
  }

  // Updates the color of a device icon
  function updateIconColor(color) {
    if (currentGroup && currentGroup.canvas && typeof currentGroup.getObjects === "function") {
      const circle = currentGroup.getObjects()[0];
      if (circle && circle.type === "circle") {
        setMultipleObjectProperties(circle, { fill: color }, currentGroup.canvas);
      }
    }
  }

  // Updates the text color of a device label
  function updateDeviceTextColor(color) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      setMultipleObjectProperties(currentTextObject, { fill: color }, currentTextObject.canvas);
    }
  }

  // Updates the background color of a device label
  function updateDeviceTextBackgroundColor(color) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      const rgbaColor = hexToRgba(color, 0.8);
      setMultipleObjectProperties(currentTextObject, { backgroundColor: rgbaColor }, currentTextObject.canvas);
    }
  }

  // Handles custom icon uploads
  function handleCustomIconUpload(file) {
    if (!file || !currentGroup || !currentGroup.canvas || typeof currentGroup.getObjects !== "function") return;

    if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
      alert("Please upload a valid JPG or PNG image.");
      customIconInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const imgSrc = event.target.result;
      const originalDeviceType = currentGroup.deviceType;
      const isCameraDevice = CAMERA_TYPES.includes(originalDeviceType);

      const imageObj = currentGroup.getObjects().find((obj) => obj.type === "image");
      const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");

      if (imageObj && circleObj) {
        fabric.Image.fromURL(
          imgSrc,
          function (newImg) {
            const scaleFactor = currentGroup.scaleFactor || 1;
            const iconSize = 30 * scaleFactor;

            setMultipleObjectProperties(newImg, {
              scaleX: iconSize / newImg.width,
              scaleY: iconSize / newImg.height,
              angle: imageObj.angle,
              left: imageObj.left,
              top: imageObj.top,
              originX: imageObj.originX,
              originY: imageObj.originY,
            });

            const index = currentGroup._objects.indexOf(imageObj);
            currentGroup.remove(imageObj);
            currentGroup.insertAt(newImg, index, false);

            currentGroup.hasCustomIcon = true;

            if (isCameraDevice) {
              if (!currentGroup.coverageConfig) {
                currentGroup.coverageConfig = {
                  startAngle: 270,
                  endAngle: 0,
                  fillColor: "rgba(165, 155, 155, 0.3)",
                  visible: true,
                };
                window.addCameraCoverage(currentGroup.canvas, currentGroup);
              }
            } else {
              if (currentGroup.coverageConfig) {
                ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
                  if (currentGroup[prop]) {
                    currentGroup.canvas.remove(currentGroup[prop]);
                    currentGroup[prop] = null;
                  }
                });
                currentGroup.coverageConfig = null;
              }
            }

            currentGroup.setCoords();
            safeCanvasRender(currentGroup.canvas);
            customIconInput.value = "";
          },
          { crossOrigin: "anonymous" }
        );
      }
    };
    reader.readAsDataURL(file);
  }

  // Converts RGB values to hexadecimal
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Sets up sidebar navigation event listeners
  document.querySelectorAll(".sidebar-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const menuType = button.getAttribute("data-menu");
      showSubmenu(menuType);
    });
  });

  document.querySelectorAll(".toggle-device-dropdown").forEach((button) => {
    button.addEventListener("click", () => {
      window.toggleSubMenu(button);
    });
  });

  closeSubSidebarBtn.addEventListener("click", () => {
    subSidebar.classList.add("hidden");
    hideAllSubmenus();
  });

  closeRightSidebarBtn.addEventListener("click", () => {
    rightSidebar.classList.add("hidden");
    hideAllSubmenus();
    currentGroup = null;
    currentTextObject = null;
  });

  // Defines global toggle submenu function
  window.toggleSubMenu = function (button) {
    const container = button.parentElement;
    const deviceRows = container.querySelectorAll(".device-row");
    const icon = button.querySelector(".dropdown-icon");

    deviceRows.forEach((row) => row.classList.toggle("show"));
    if (icon) icon.classList.toggle("rotate");
  };

  // Export the text visibility function for use in other modules
  window.setDeviceTextVisibility = setTextVisibility;
  window.updateDeviceTextPosition = updateTextPosition;

  // Shows device properties in the sidebar
  window.showDeviceProperties = function (deviceType, textObject, group) {
    const displayName = DEVICE_NAME_MAP[deviceType] || "Device Properties";
    deviceHeading.textContent = displayName;

    const isCamera = CAMERA_TYPES.includes(deviceType);
    const isZone = deviceType === "zone-polygon";
    const isRoom = deviceType === "room-polygon";

    // Show/hide appropriate property sections
    if (cameraProperties) cameraProperties.style.display = isCamera ? "block" : "none";
    if (zoneProperties) zoneProperties.style.display = isZone ? "block" : "none";
    if (roomProperties) roomProperties.style.display = isRoom ? "block" : "none";
    if (genericProperties) genericProperties.style.display = !isZone && !isRoom ? "block" : "none";

    if (textObject && deviceLabelInput) {
      deviceLabelInput.value = textObject.text;
      currentTextObject = textObject;

      // Set the label toggle to match the actual visibility state
      if (deviceLabelToggle) {
        const isVisible = !textObject._isHidden;
        deviceLabelToggle.checked = isVisible;
      }

      if (deviceTextColorPicker && textObject.fill) {
        deviceTextColorPicker.value = textObject.fill.startsWith("rgb") ? rgbToHex(...textObject.fill.match(/\d+/g).map(Number)) : textObject.fill;
      }

      if (deviceTextBgColorPicker && textObject.backgroundColor) {
        let bgColor = textObject.backgroundColor;
        if (bgColor.startsWith("rgba")) {
          const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (rgbMatch) {
            const [, r, g, b] = rgbMatch;
            bgColor = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
          }
        }
        deviceTextBgColorPicker.value = bgColor || "#141212";
      } else if (deviceTextBgColorPicker) {
        deviceTextBgColorPicker.value = "#141212";
      }
    } else {
      deviceLabelInput.value = "";
      if (deviceLabelToggle) {
        deviceLabelToggle.checked = true;
      }
      currentTextObject = null;
    }

    currentGroup = group;

    // Update part number, fitting positions, and stock number
    if (partNumberInput) {
      partNumberInput.value = group.partNumber || "";
    }
    if (fittingPositionsInput) {
      fittingPositionsInput.value = group.fittingPositions || "Select";
    }
    if (stockNumberInput) {
      stockNumberInput.value = group.stockNumber || "";
    }

    // Update camera coverage toggle to reflect actual state
    if (isCamera && group && group.coverageConfig !== undefined) {
      const coverageToggle = document.getElementById("camera-coverage-toggle");
      if (coverageToggle) {
        coverageToggle.checked = group.coverageConfig.visible !== false;
      }
    }

    if (currentGroup && typeof currentGroup.getObjects === "function") {
      const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");
      if (circleObj && iconColorPicker) {
        let currentColor = circleObj.fill;
        if (typeof currentColor === "string" && currentColor.startsWith("rgb")) {
          currentColor = rgbToHex(...currentColor.match(/\d+/g).map(Number));
        }
        iconColorPicker.value = currentColor || "#000000";
      }
    }

    if (group && typeof group.getObjects === "function") {
      // Calculate current icon size based on scale factor
      if (iconSizeSlider && iconSizeInput && group.scaleFactor !== undefined) {
        const currentSize = Math.max(1, Math.min(100, Math.round(group.scaleFactor * 30))); // Clamp between 1-100
        iconSizeSlider.value = currentSize;
        iconSizeInput.value = currentSize.toString();
        updateSliderTrack(iconSizeSlider, currentSize, parseInt(iconSizeSlider.min) || 1, parseInt(iconSizeSlider.max) || 100);
      } else if (iconSizeSlider && iconSizeInput) {
        // Fallback: try to calculate from circle radius
        const circleObj = group.getObjects().find((obj) => obj.type === "circle");
        if (circleObj) {
          const currentSize = Math.max(1, Math.min(100, Math.round((circleObj.radius / 20) * 30))); // Clamp between 1-100
          iconSizeSlider.value = currentSize;
          iconSizeInput.value = currentSize.toString();
          updateSliderTrack(iconSizeSlider, currentSize, parseInt(iconSizeSlider.min) || 1, parseInt(iconSizeSlider.max) || 100);
        } else {
          // Ultimate fallback to default size
          const defaultSize = Math.max(1, Math.min(100, window.defaultDeviceIconSize || 30));
          iconSizeSlider.value = defaultSize;
          iconSizeInput.value = defaultSize.toString();
          updateSliderTrack(iconSizeSlider, defaultSize, parseInt(iconSizeSlider.min) || 1, parseInt(iconSizeSlider.max) || 100);
        }
      }

      if (iconRotationSlider && iconRotationInput) {
        const imageObj = group.getObjects().find((obj) => obj.type === "image");
        if (imageObj) {
          const currentAngle = imageObj.angle || 0;
          const sliderValue = Math.round((currentAngle / 360) * 99) + 1;
          iconRotationSlider.value = sliderValue;
          iconRotationInput.value = sliderValue;
          updateSliderTrack(iconRotationSlider, sliderValue, parseInt(iconRotationSlider.min) || 1, parseInt(iconRotationSlider.max) || 100);
        } else {
          iconRotationSlider.value = 1;
          iconRotationInput.value = 1;
          updateSliderTrack(iconRotationSlider, 1, 1, 100);
        }
      }
    }

    const devicePropertiesSubmenu = document.getElementById("device-properties");
    devicePropertiesSubmenu.classList.remove("hidden");
    devicePropertiesSubmenu.classList.add("show");
    rightSidebar.classList.remove("hidden");
  };

  // Hides device properties
  window.hideDeviceProperties = function () {
    rightSidebar.classList.add("hidden");
    if (cameraProperties) cameraProperties.style.display = "none";
    if (genericProperties) genericProperties.style.display = "block";
    if (zoneProperties) zoneProperties.style.display = "none";
    if (roomProperties) roomProperties.style.display = "none";
    currentTextObject = null;
    currentGroup = null;
    // Clear part number, fitting positions, and stock number
    if (partNumberInput) partNumberInput.value = "";
    if (fittingPositionsInput) fittingPositionsInput.value = "Select";
    if (stockNumberInput) stockNumberInput.value = "";
  };

  // Completely removes/adds text to canvas
  createToggleHandler(deviceLabelToggle, (checked) => {
    if (currentTextObject && currentGroup && currentGroup.canvas) {
      setTextVisibility(currentTextObject, checked, currentGroup.canvas);
    }
  });

  // Sets up device label input handlers
  if (deviceLabelInput) {
    deviceLabelInput.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const start = deviceLabelInput.selectionStart;
        const end = deviceLabelInput.selectionEnd;
        const value = deviceLabelInput.value;
        deviceLabelInput.value = value.substring(0, start) + "\n" + value.substring(end);
        deviceLabelInput.selectionStart = deviceLabelInput.selectionEnd = start + 1;
        const inputEvent = new Event("input", { bubbles: true });
        deviceLabelInput.dispatchEvent(inputEvent);
      }
    });

    deviceLabelInput.addEventListener("input", (e) => {
      if (currentTextObject) {
        // Always update the text content, even if hidden
        currentTextObject.set({ text: e.target.value });

        // If the text is currently visible (on canvas), update it properly
        if (!currentTextObject._isHidden && currentTextObject.canvas) {
          setMultipleObjectProperties(currentTextObject, { text: e.target.value }, currentTextObject.canvas);
        }
      }
    });

    preventEventPropagation(deviceLabelInput, ["mousedown"]);
  }

  // Sets up part number input handler
  if (partNumberInput) {
    partNumberInput.addEventListener("input", (e) => {
      if (currentGroup) {
        currentGroup.partNumber = e.target.value;
      }
    });
    preventEventPropagation(partNumberInput, ["mousedown"]);
  }

  // Sets up fitting positions select handler
  if (fittingPositionsInput) {
    fittingPositionsInput.addEventListener("change", (e) => {
      if (currentGroup) {
        currentGroup.fittingPositions = e.target.value === "Select" ? "" : e.target.value;
      }
    });
    preventEventPropagation(fittingPositionsInput, ["mousedown"]);
  }

  // Sets up stock number input handler
  if (stockNumberInput) {
    stockNumberInput.addEventListener("input", (e) => {
      if (currentGroup) {
        currentGroup.stockNumber = e.target.value;
      }
    });
    preventEventPropagation(stockNumberInput, ["mousedown"]);
  }

  // Sets up icon size controls
  createSliderInputSync(iconSizeSlider, iconSizeInput, updateIconSize, { min: 10, max: 100, step: 1 });

  // Sets up icon rotation controls
  createSliderInputSync(iconRotationSlider, iconRotationInput, updateIconRotation, { min: 1, max: 100, step: 1 });

  // Sets up icon color controls
  setupColorControls(iconColorPicker, colorIcons, updateIconColor);

  // Sets up device text color controls
  setupColorControls(deviceTextColorPicker, deviceTextColorIcons, updateDeviceTextColor);

  // Sets up device text background color controls
  setupColorControls(deviceTextBgColorPicker, deviceTextBgColorIcons, updateDeviceTextBackgroundColor);

  // Sets up custom icon upload
  if (customIconInput) {
    customIconInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleCustomIconUpload(file);
    });
    preventEventPropagation(customIconInput, ["click"]);
  }
});
