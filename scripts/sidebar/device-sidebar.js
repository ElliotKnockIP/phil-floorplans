import {
  updateSliderTrack,
  createSliderInputSync,
  setupColorControls,
  preventEventPropagation,
  createToggleHandler,
  setMultipleObjectProperties,
  safeCanvasRender,
  hexToRgba,
  rgbToHex,
  CAMERA_TYPES,
  DEFAULT_DEVICE_ICON_SIZE,
  setTextVisibility,
  updateTextPosition,
  getHexFromFill,
} from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const subSidebar = document.getElementById("sub-sidebar");
  const closeSubSidebarBtn = document.getElementById("close-sub-sidebar");
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
  const deviceLocationInput = document.getElementById("device-location-input");
  const fittingPositionsInput = document.getElementById("fitting-positions");
  const stockNumberInput = document.getElementById("device-stock-number-input");
  const deviceFontSelect = document.getElementById("device-font-select");
  const deviceLabelBoldToggle = document.getElementById("device-label-bold-toggle");
  const deviceLabelBackgroundToggle = document.getElementById("device-label-background-toggle");
  const deviceIpAddressInput = document.getElementById("device-ip-address-input");
  const deviceSubnetInput = document.getElementById("device-subnet-input");
  const deviceGatewayInput = document.getElementById("device-gateway-input");
  const deviceMacAddressInput = document.getElementById("device-mac-address-input");
  const deviceFocalLengthInput = document.getElementById("device-focal-length-input");
  const deviceResolutionInput = document.getElementById("device-resolution-input");

  let currentTextObject = null;
  let currentGroup = null;

  // Find first object in a group matching a predicate
  const findInGroup = (predicate) => (currentGroup && typeof currentGroup.getObjects === "function" ? currentGroup.getObjects().find(predicate) : null);

  // Quick clamp util
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Sync an <input type="color"> from a fabric fill string (rgb/rgba/hsl/hex)
  const syncPickerFromFill = (picker, fill, fallback = "#000000") => {
    if (!picker) return;
    picker.value = fill ? getHexFromFill(fill) : fallback;
  };

  // Safe set text and reflect background according to toggle
  const setLabelTextSafely = (textObj, newText) => {
    if (!textObj) return;
    textObj.set({ text: newText });
    if (!textObj._isHidden && textObj.canvas) {
      const shouldShowBackground = deviceLabelBackgroundToggle ? deviceLabelBackgroundToggle.checked : true;
      const bgColor = newText.trim() === "" ? "transparent" : shouldShowBackground ? textObj.backgroundColor === "transparent" ? "rgba(20, 18, 18, 0.8)" : textObj.backgroundColor : "transparent";
      setMultipleObjectProperties(textObj, { text: newText, backgroundColor: bgColor }, textObj.canvas);
    }
  };

  // Bind a text/number input to a property on currentGroup and trigger complete-indicator update
  const bindGroupInput = (inputEl, propName) => {
    if (!inputEl) return;
    inputEl.addEventListener("input", (e) => {
      if (!currentGroup) return;
      currentGroup[propName] = e.target.value;
      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(currentGroup);
      }
    });
    preventEventPropagation(inputEl, ["mousedown", "keydown", "keyup"]);
  };

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
    const submenu = document.getElementById(menuId);
    if (submenu) {
      submenu.classList.remove("hidden");
      submenu.classList.add("show");
      subSidebar.classList.remove("hidden");
    }
  }

  // Updates the size of a device icon
  function updateIconSize(size) {
    if (!currentGroup || !currentGroup.canvas || !currentGroup.getObjects) return;

    const clampedSize = clamp(parseInt(size) || DEFAULT_DEVICE_ICON_SIZE, 1, 100);
    const scaleFactor = clampedSize / DEFAULT_DEVICE_ICON_SIZE;
    currentGroup.scaleFactor = scaleFactor;

    const imageObj = findInGroup((o) => o.type === "image");
    const circleObj = findInGroup((o) => o.type === "circle");

    if (imageObj && circleObj) {
      const baseCircleRadius = 20;

      setMultipleObjectProperties(imageObj, {
        scaleX: scaleFactor * (DEFAULT_DEVICE_ICON_SIZE / imageObj.width),
        scaleY: scaleFactor * (DEFAULT_DEVICE_ICON_SIZE / imageObj.height),
      });

      setMultipleObjectProperties(circleObj, {
        radius: baseCircleRadius * scaleFactor,
        scaleX: 1,
        scaleY: 1,
      });

      setMultipleObjectProperties(currentGroup, {
        scaleX: 1,
        scaleY: 1,
        width: circleObj.radius * 2,
        height: circleObj.radius * 2,
      });

      if (currentTextObject && !currentTextObject._isHidden) {
        // Maintain original behavior: reposition and scale label font with icon size
        updateTextPosition(currentGroup, currentTextObject);
        setMultipleObjectProperties(currentTextObject, { fontSize: 12 * scaleFactor });
      }

      if (currentGroup.coverageConfig && currentGroup.createOrUpdateCoverageArea) {
        currentGroup.createOrUpdateCoverageArea();
      }

      currentGroup.setCoords();
      safeCanvasRender(currentGroup.canvas);
    }
  }

  // Updates the rotation of a device icon
  function updateIconRotation(rotationAngle) {
    if (!currentGroup || !currentGroup.canvas || typeof currentGroup.getObjects !== "function") return;

    const imageObj = findInGroup((o) => o.type === "image");
    const circleObj = findInGroup((o) => o.type === "circle");

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
      const isTextDevice = currentGroup.deviceType === "text-device";
      
      if (isTextDevice) {
        // For text devices, update the shape (rect or circle) background color
        const shapeObj = findInGroup((obj) => obj.type === "rect" || obj.type === "circle");
        if (shapeObj) {
          setMultipleObjectProperties(shapeObj, { fill: color }, currentGroup.canvas);
          // Store the updated config
          if (currentGroup.textDeviceConfig) {
            currentGroup.textDeviceConfig.bgColor = color;
          }
        }
      } else {
        // For regular devices, update the circle
        const circle = currentGroup.getObjects()[0];
        if (circle && circle.type === "circle") {
          setMultipleObjectProperties(circle, { fill: color }, currentGroup.canvas);
        }
      }
    }
  }

  // Updates the text color of a device label
  function updateDeviceTextColor(color) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      setMultipleObjectProperties(currentTextObject, { fill: color }, currentTextObject.canvas);
    }
    
    // For text devices, also update the main text (not the label)
    if (currentGroup && currentGroup.deviceType === "text-device" && currentGroup.canvas) {
      const objects = currentGroup.getObjects ? currentGroup.getObjects() : [];
      const mainTextObj = objects.find((obj) => obj.type === "text" && !obj.isDeviceLabel);
      if (mainTextObj) {
        setMultipleObjectProperties(mainTextObj, { fill: color }, currentGroup.canvas);
        // Store the updated config
        if (currentGroup.textDeviceConfig) {
          currentGroup.textDeviceConfig.textColor = color;
        }
      }
    }
  }

  // Updates the background color of a device label
  function updateDeviceTextBackgroundColor(color) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      const rgbaColor = hexToRgba(color, 0.8);
      setMultipleObjectProperties(currentTextObject, { backgroundColor: rgbaColor }, currentTextObject.canvas);
    }
  }

  // Updates the font of a device label
  function updateDeviceTextFont(fontFamily) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      setMultipleObjectProperties(currentTextObject, { fontFamily: fontFamily }, currentTextObject.canvas);
    }
  }

  // Updates the font weight (bold) of a device label
  function updateDeviceTextBold(isBold) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      setMultipleObjectProperties(currentTextObject, { fontWeight: isBold ? "bold" : "normal" }, currentTextObject.canvas);
    }
  }

  // Updates the background visibility of a device label
  function updateDeviceTextBackground(showBackground) {
    if (currentTextObject && currentTextObject.canvas && !currentTextObject._isHidden) {
      const backgroundColor = showBackground ? "rgba(20, 18, 18, 0.8)" : "transparent";
      setMultipleObjectProperties(currentTextObject, { backgroundColor: backgroundColor }, currentTextObject.canvas);
    }
  }

  // Handles custom icon uploads
  function handleCustomIconUpload(file) {
    if (!file || !currentGroup || !currentGroup.canvas || !currentGroup.getObjects) return;

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

  const imageObj = findInGroup((o) => o.type === "image");
  const circleObj = findInGroup((o) => o.type === "circle");

      if (imageObj && circleObj) {
        fabric.Image.fromURL(
          imgSrc,
          (newImg) => {
            const scaleFactor = currentGroup.scaleFactor || 1;
            const iconSize = DEFAULT_DEVICE_ICON_SIZE * scaleFactor;

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
            } else if (currentGroup.coverageConfig) {
              ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
                if (currentGroup[prop]) {
                  currentGroup.canvas.remove(currentGroup[prop]);
                  currentGroup[prop] = null;
                }
              });
              currentGroup.coverageConfig = null;
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

  if (closeSubSidebarBtn) {
    closeSubSidebarBtn.addEventListener("click", () => {
      subSidebar.classList.add("hidden");
      hideAllSubmenus();
    });
  }

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

  // Shows device properties - now only handles data, UI is handled by popovers
  window.showDeviceProperties = function (deviceType, textObject, group) {
    const isCamera = CAMERA_TYPES.includes(deviceType);
    const isTextDevice = deviceType === "text-device";

    if (textObject && deviceLabelInput) {
      // For text devices, set the device name to the text content itself
      if (isTextDevice && group && group.textDeviceConfig) {
        deviceLabelInput.value = group.textDeviceConfig.text;
      } else {
        deviceLabelInput.value = textObject.text;
      }
      currentTextObject = textObject;

      // Set the label toggle to match the actual visibility state
      if (deviceLabelToggle) {
        const isVisible = !textObject._isHidden;
        deviceLabelToggle.checked = isVisible;
      }

      if (deviceTextColorPicker && textObject.fill && !textObject._isHidden) deviceTextColorPicker.value = getHexFromFill(textObject.fill);
      if (deviceTextBgColorPicker && textObject.backgroundColor && !textObject._isHidden) deviceTextBgColorPicker.value = getHexFromFill(textObject.backgroundColor) || "#141212";
      else if (deviceTextBgColorPicker) deviceTextBgColorPicker.value = "#141212";

      // Set device font select to current font or default
      if (deviceFontSelect) {
        const currentFont = textObject.fontFamily || "Poppins, sans-serif";
        deviceFontSelect.value = currentFont;
      }

      // Set device label bold toggle to current state
      if (deviceLabelBoldToggle) {
        const currentWeight = textObject.fontWeight || "normal";
        deviceLabelBoldToggle.checked = currentWeight === "bold";
      }

      // Set device label background toggle to current state
      if (deviceLabelBackgroundToggle) {
        const currentBgColor = textObject.backgroundColor || "rgba(20, 18, 18, 0.8)";
        deviceLabelBackgroundToggle.checked = currentBgColor !== "transparent";
      }
      // If label is hidden ensure it stays off-canvas (some flows may have re-added it)
      if (textObject._isHidden && textObject.canvas && textObject.canvas.getObjects().includes(textObject)) {
        try {
          textObject.canvas.remove(textObject);
        } catch (e) {}
      }
    } else {
      if (deviceLabelInput) deviceLabelInput.value = "";
      if (deviceLabelToggle) {
        deviceLabelToggle.checked = true;
      }
      if (deviceFontSelect) {
        deviceFontSelect.value = "Poppins, sans-serif";
      }
      if (deviceLabelBoldToggle) {
        deviceLabelBoldToggle.checked = false;
      }
      if (deviceLabelBackgroundToggle) {
        deviceLabelBackgroundToggle.checked = true;
      }
      currentTextObject = null;
    }

    currentGroup = group;

    // Update part number, mounted position, and stock number
    if (partNumberInput) {
      partNumberInput.value = group.partNumber || "";
    }
    if (deviceLocationInput) {
      deviceLocationInput.value = group.location || "";
    }
    if (fittingPositionsInput) {
      fittingPositionsInput.value = group.mountedPosition || "Select";
    }
    if (stockNumberInput) {
      stockNumberInput.value = group.stockNumber || "";
    }
    if (deviceIpAddressInput) {
      deviceIpAddressInput.value = group.ipAddress || "";
    }
    if (deviceSubnetInput) {
      deviceSubnetInput.value = group.subnetMask || "";
    }
    if (deviceGatewayInput) {
      deviceGatewayInput.value = group.gatewayAddress || "";
    }
    if (deviceMacAddressInput) {
      deviceMacAddressInput.value = group.macAddress || "";
    }
    if (deviceFocalLengthInput) {
      deviceFocalLengthInput.value = group.focalLength || "";
    }
    if (deviceResolutionInput) {
      deviceResolutionInput.value = group.resolution || "";
    }

    // Update camera coverage toggle to reflect actual state
    if (isCamera && group && group.coverageConfig !== undefined) {
      const coverageToggle = document.getElementById("camera-coverage-toggle");
      if (coverageToggle) {
        coverageToggle.checked = group.coverageConfig.visible !== false;
      }
    }

    // For text devices, update icon-related controls based on the text device itself
    if (isTextDevice && group) {
  const objects = group.getObjects ? group.getObjects() : [];
  const shapeObj = objects.find((obj) => obj.type === "rect" || obj.type === "circle");
  const textObj = objects.find((obj) => obj.type === "text" && !obj.isDeviceLabel);

      // Update icon color to match shape color (if shape exists)
      if (shapeObj && iconColorPicker) syncPickerFromFill(iconColorPicker, shapeObj.fill, "#000000");
      
      // Update device text color to match the main text in the text device
      if (textObj && deviceTextColorPicker) syncPickerFromFill(deviceTextColorPicker, textObj.fill, "#ffffff");

      // Disable rotation slider for text devices (doesn't make sense)
      if (iconRotationSlider) {
        iconRotationSlider.disabled = true;
        iconRotationSlider.value = 0;
        if (iconRotationInput) iconRotationInput.textContent = "0°";
      }

      // Size slider should be disabled for text devices
      if (iconSizeSlider) {
        iconSizeSlider.disabled = true;
        if (iconSizeInput) iconSizeInput.textContent = "N/A";
      }
    } else {
      // Re-enable controls for normal devices
      if (iconRotationSlider) {
        iconRotationSlider.disabled = false;
      }
      if (iconSizeSlider) {
        iconSizeSlider.disabled = false;
      }
      
      // For regular devices, update icon color from circle
      if (currentGroup && typeof currentGroup.getObjects === "function") {
        const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");
        if (circleObj && iconColorPicker) syncPickerFromFill(iconColorPicker, circleObj.fill, "#000000");
      }
    }

    if (group && typeof group.getObjects === "function" && !isTextDevice) {
      if (iconSizeSlider && iconSizeInput && group.scaleFactor !== undefined) {
        const currentSize = Math.max(1, Math.min(100, Math.round(group.scaleFactor * DEFAULT_DEVICE_ICON_SIZE)));
        iconSizeSlider.value = currentSize;
        iconSizeInput.textContent = currentSize.toFixed(0) + "px";
        updateSliderTrack(iconSizeSlider, currentSize, 1, 100);
      } else if (iconSizeSlider && iconSizeInput) {
        const circleObj = group.getObjects().find((obj) => obj.type === "circle");
        if (circleObj) {
          const currentSize = Math.max(1, Math.min(100, Math.round((circleObj.radius / 20) * DEFAULT_DEVICE_ICON_SIZE)));
          iconSizeSlider.value = currentSize;
          iconSizeInput.textContent = currentSize.toFixed(0) + "px";
          updateSliderTrack(iconSizeSlider, currentSize, 1, 100);
        } else {
          const defaultSize = Math.max(1, Math.min(100, window.defaultDeviceIconSize || DEFAULT_DEVICE_ICON_SIZE));
          iconSizeSlider.value = defaultSize;
          iconSizeInput.textContent = defaultSize.toFixed(0) + "px";
          updateSliderTrack(iconSizeSlider, defaultSize, 1, 100);
        }
      }

      if (iconRotationSlider && iconRotationInput) {
        const imageObj = group.getObjects().find((obj) => obj.type === "image");
        if (imageObj) {
          const currentAngle = imageObj.angle || 0;
          iconRotationSlider.value = currentAngle;
          iconRotationInput.textContent = currentAngle.toFixed(0) + "°";
          updateSliderTrack(iconRotationSlider, currentAngle, 0, 360);
        } else {
          iconRotationSlider.value = 0;
          iconRotationInput.textContent = "0°";
          updateSliderTrack(iconRotationSlider, 0, 0, 360);
        }
      }
    }
  };

  // Hides device properties
  window.hideDeviceProperties = function () {
    currentTextObject = null;
    currentGroup = null;
    // Clear part number, mounted position, and stock number
    if (partNumberInput) partNumberInput.value = "";
    if (deviceLocationInput) deviceLocationInput.value = "";
    if (fittingPositionsInput) fittingPositionsInput.value = "Select";
    if (stockNumberInput) stockNumberInput.value = "";
    if (deviceIpAddressInput) deviceIpAddressInput.value = "";
    if (deviceSubnetInput) deviceSubnetInput.value = "";
    if (deviceGatewayInput) deviceGatewayInput.value = "";
    if (deviceMacAddressInput) deviceMacAddressInput.value = "";
    if (deviceFocalLengthInput) deviceFocalLengthInput.value = "";
    if (deviceResolutionInput) deviceResolutionInput.value = "";
  };

  // Completely removes/adds text to canvas
  createToggleHandler(deviceLabelToggle, (checked) => {
    if (currentTextObject && currentGroup && currentGroup.canvas) {
      setTextVisibility(currentTextObject, checked, currentGroup.canvas);
      currentGroup.labelHidden = !checked;
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
        const newText = e.target.value;
        
        // Check if this is a text device
        const isTextDevice = currentGroup && currentGroup.deviceType === "text-device";
        
        if (isTextDevice && currentGroup) {
          // Rebuild the text device group so outline matches content
          const rebuildTextDeviceGroup = (textValue) => {
            const canvas = currentGroup.canvas;
            const config = currentGroup.textDeviceConfig;
            if (!config || !canvas) return;

            const { left, top, angle, id, deviceProperties } = currentGroup;
            const scaleFactor = currentGroup.scaleFactor || 1;
            const labelTextObj = currentGroup.textObject;

            config.text = textValue;
            canvas.remove(currentGroup);

            const objects = [];
            const fontSize = 14 * scaleFactor;

            if (config.shape === "rectangle") {
              const tempText = new fabric.Text(textValue, { fontSize, fontFamily: "Poppins, sans-serif", fontWeight: "normal" });
              const padding = 8 * scaleFactor;
              const width = tempText.width + padding * 2;
              const height = tempText.height + padding * 2;
              objects.push(new fabric.Rect({ width, height, fill: config.bgColor, rx: 4 * scaleFactor, ry: 4 * scaleFactor, originX: "center", originY: "center" }));
            } else if (config.shape === "circle") {
              objects.push(new fabric.Circle({ radius: 20 * scaleFactor, fill: config.bgColor, originX: "center", originY: "center" }));
            }

            const textObj = new fabric.Text(textValue, { fontSize, fontFamily: "Poppins, sans-serif", fontWeight: "normal", fill: config.textColor, originX: "center", originY: "center" });
            objects.push(textObj);

            const newGroup = new fabric.Group(objects, { left, top, angle, originX: "center", originY: "center", selectable: true, hasControls: false, borderColor: "#000000", borderScaleFactor: 2, scaleFactor });
            newGroup.id = id;
            newGroup.deviceType = "text-device";
            newGroup.textDeviceConfig = config;
            newGroup.initialLabelText = textValue;
            newGroup.labelHidden = true;
            newGroup.deviceProperties = deviceProperties;
            newGroup.textObject = labelTextObj;

            if (labelTextObj) {
              labelTextObj.set({ text: textValue });
              labelTextObj._parentGroup = newGroup;
            }

            newGroup.on("selected", () => {
              if (window.suppressDeviceProperties) return;
              window.showDeviceProperties && window.showDeviceProperties("text-device", newGroup.textObject, newGroup);
            });
            newGroup.on("deselected", () => window.hideDeviceProperties && window.hideDeviceProperties());

            canvas.add(newGroup);
            newGroup.setCoords();
            canvas.setActiveObject(newGroup);
            currentGroup = newGroup;
            currentTextObject = newGroup.textObject;
            canvas.requestRenderAll();
          };

          rebuildTextDeviceGroup(newText);
          // Keep hidden label text in sync
          currentTextObject.set({ text: newText });
        } else {
          // Regular devices: just set label safely
          setLabelTextSafely(currentTextObject, newText);
        }
        
        // Update complete device indicator
        if (currentGroup && typeof window.updateDeviceCompleteIndicator === "function") {
          window.updateDeviceCompleteIndicator(currentGroup);
        }
      }
    });

    preventEventPropagation(deviceLabelInput, ["mousedown", "keydown", "keyup"]);
  }

  // Bind simple inputs to group properties
  bindGroupInput(partNumberInput, "partNumber");
  bindGroupInput(deviceLocationInput, "location");
  bindGroupInput(stockNumberInput, "stockNumber");
  bindGroupInput(deviceIpAddressInput, "ipAddress");
  bindGroupInput(deviceSubnetInput, "subnetMask");
  bindGroupInput(deviceGatewayInput, "gatewayAddress");
  bindGroupInput(deviceMacAddressInput, "macAddress");
  bindGroupInput(deviceFocalLengthInput, "focalLength");
  bindGroupInput(deviceResolutionInput, "resolution");

  // Mounted position select needs to map "Select" to empty string
  if (fittingPositionsInput) {
    fittingPositionsInput.addEventListener("change", (e) => {
      if (!currentGroup) return;
      currentGroup.mountedPosition = e.target.value === "Select" ? "" : e.target.value;
      if (typeof window.updateDeviceCompleteIndicator === "function") window.updateDeviceCompleteIndicator(currentGroup);
    });
    preventEventPropagation(fittingPositionsInput, ["mousedown", "keydown", "keyup"]);
  }

  // Sets up icon size controls
  createSliderInputSync(iconSizeSlider, iconSizeInput, updateIconSize, { min: 10, max: 100, step: 1, format: (v) => v.toFixed(0) + "px" });

  // Sets up icon rotation controls
  createSliderInputSync(iconRotationSlider, iconRotationInput, updateIconRotation, { min: 0, max: 360, step: 1, format: (v) => v.toFixed(0) + "°" });

  // Sets up icon color controls
  setupColorControls(iconColorPicker, colorIcons, updateIconColor);

  // Sets up device text color controls
  setupColorControls(deviceTextColorPicker, deviceTextColorIcons, updateDeviceTextColor);

  // Sets up device text background color controls
  setupColorControls(deviceTextBgColorPicker, deviceTextBgColorIcons, updateDeviceTextBackgroundColor);

  // Sets up device font selection
  if (deviceFontSelect) {
    deviceFontSelect.addEventListener("change", (e) => {
      updateDeviceTextFont(e.target.value);
    });
  }

  // Sets up device label bold toggle
  if (deviceLabelBoldToggle) {
    deviceLabelBoldToggle.addEventListener("change", (e) => {
      updateDeviceTextBold(e.target.checked);
    });
  }

  // Sets up device label background toggle
  if (deviceLabelBackgroundToggle) {
    deviceLabelBackgroundToggle.addEventListener("change", (e) => {
      updateDeviceTextBackground(e.target.checked);
    });
  }

  // Sets up custom icon upload
  if (customIconInput) {
    customIconInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleCustomIconUpload(file);
    });
    preventEventPropagation(customIconInput, ["click"]);
  }

  // Handles device icon changes
  document.querySelectorAll(".change-device-icons img").forEach((img) => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentGroup || !currentGroup.canvas) return;

      const newSrc = img.getAttribute("src");
  const imageObj = findInGroup((o) => o.type === "image");
  const circleObj = findInGroup((o) => o.type === "circle");

      if (imageObj && circleObj) {
        fabric.Image.fromURL(
          newSrc,
          (newImg) => {
            const scaleFactor = currentGroup.scaleFactor || 1;
            const iconSize = DEFAULT_DEVICE_ICON_SIZE * scaleFactor;

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

            currentGroup.deviceType = newImg._element.src.split("/").pop();

            if (currentGroup.coverageConfig) {
              ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
                if (currentGroup[prop]) {
                  currentGroup.canvas.remove(currentGroup[prop]);
                  currentGroup[prop] = null;
                }
              });
              currentGroup.coverageConfig = null;
            }

            currentGroup.setCoords();
            safeCanvasRender(currentGroup.canvas);
          },
          { crossOrigin: "anonymous" }
        );
      }
    });
  });

  // Setup drag functionality for new device items
  setupDeviceItemDrag();
});

// Device type to image path mapping
const DEVICE_TYPE_TO_IMAGE = {
  // CCTV devices
  "fixed-camera": "./images/devices/fixed-camera.png",
  "ptz-camera": "./images/devices/ptz-camera.png",
  "box-camera": "./images/devices/box-camera.png",
  "dome-camera": "./images/devices/dome-camera.png",
  "bullet-camera": "./images/devices/bullet-camera.png",
  "thermal-camera": "./images/devices/thermal-camera.png",

  // Access control devices
  "access-system": "./images/devices/access-system.png",
  "door-entry": "./images/devices/door-entry.png",
  "gates": "./images/devices/gates.png",
  "vehicle-entry": "./images/devices/vehicle-entry.png",
  "turnstiles": "./images/devices/turnstiles.png",
  "mobile-entry": "./images/devices/mobile-entry.png",
  "pir": "./images/devices/pir.png",
  "card-reader": "./images/devices/card-reader.png",
  "locks": "./images/devices/locks.png",

  // Intruder detection devices
  "intruder-alarm": "./images/devices/intruder-alarm.png",
  "panic-alarm": "./images/devices/panic-alarm.png",
  "motion-detector": "./images/devices/motion-detector.png",
  "infrared-sensors": "./images/devices/infrared-sensors.png",
  "pressure-mat": "./images/devices/pressure-mat.png",
  "glass-contact": "./images/devices/glass-contact.png",

  // Fire evacuation devices
  "fire-alarm": "./images/devices/fire-alarm.png",
  "fire-extinguisher": "./images/devices/fire-extinguisher.png",
  "fire-blanket": "./images/devices/fire-blanket.png",
  "emergency-exit": "./images/devices/emergency-exit.png",
  "assembly-point": "./images/devices/assembly-point.png",
  "emergency-telephone": "./images/devices/emergency-telephone.png",

  // Network devices
  "Series": "./images/devices/Series.png",
  "panel-control": "./images/devices/panel-control.png",
  "Sensor": "./images/devices/Sensor.png",
  "interface-unit": "./images/devices/interface-unit.png",
  "access-panel": "./images/devices/access-panel.png",
  "expander-connection": "./images/devices/expander-connection.png",
};

function setupDeviceItemDrag() {
  // Add drag event listeners to all device items
  document.querySelectorAll(".device-item").forEach((item) => {
    item.addEventListener("dragstart", function (e) {
      const deviceType = this.dataset.device;
      const imagePath = DEVICE_TYPE_TO_IMAGE[deviceType];

      if (imagePath) {
        // Set the image path as drag data to maintain compatibility with existing drop handler
        e.dataTransfer.setData("text/plain", imagePath);
        e.dataTransfer.effectAllowed = "copy";

        // Add dragging class for visual feedback
        this.classList.add("dragging");
        document.body.classList.add("dragging");
      }
    });

    item.addEventListener("dragend", function (e) {
      // Remove dragging class
      this.classList.remove("dragging");
      document.body.classList.remove("dragging");
    });
  });
}