import { setupColorControls, setMultipleObjectProperties, getHexFromFill, createSliderInputSync, DEFAULT_DEVICE_ICON_SIZE, updateTextPosition, createToggleHandler, setTextVisibility } from "../sidebar-utils.js";

// Manages the style panel for device properties (colors, sizes, labels, etc.)
export class StylePanel {
  // Initialize panel elements and setup controls
  constructor() {
    this.currentGroup = null;
    this.currentTextObject = null;

    // Icon panel elements
    this.iconColorPicker = document.getElementById("icon-color-picker");
    this.iconColorIcons = document.querySelectorAll(".change-icon-colour .colour-icon");
    this.iconSizeSlider = document.getElementById("icon-size-slider");
    this.iconSizeInput = document.getElementById("icon-size-input");

    // Device label panel elements
    this.deviceLabelInput = document.getElementById("device-label-input");
    this.deviceLabelToggle = document.getElementById("device-label-toggle");
    this.deviceTextColorPicker = document.getElementById("device-text-color-picker");
    this.deviceTextColorIcons = document.querySelectorAll(".device-text-colour .colour-icon");
    this.deviceTextBgColorPicker = document.getElementById("device-background-text-color-picker");
    this.deviceTextBgColorIcons = document.querySelectorAll(".device-background-text-colour .colour-icon");
    this.iconRotationSlider = document.getElementById("icon-rotation-slider");
    this.iconRotationInput = document.getElementById("icon-rotation-input");

    this.setupControls();
  }

  // Sets the current device group
  setCurrentGroup(group) {
    this.currentGroup = group;
  }

  // Sets the current text object
  setCurrentTextObject(textObject) {
    this.currentTextObject = textObject;
  }

  // Finds an object in the current group by predicate
  findInGroup(predicate) {
    if (!this.currentGroup || typeof this.currentGroup.getObjects !== "function") {
      return null;
    }
    return this.currentGroup.getObjects().find(predicate);
  }

  // Sets up UI controls and event listeners
  setupControls() {
    // Icon Color
    setupColorControls(this.iconColorPicker, this.iconColorIcons, (color) => {
      if (!this.currentGroup) return;
      const circle = this.findInGroup((o) => o.type === "circle");
      if (circle) {
        circle.set({ fill: color });
        this.currentGroup.canvas?.renderAll();
      }
    });

    // Icon Size
    createSliderInputSync(
      this.iconSizeSlider,
      this.iconSizeInput,
      (size) => {
        this.updateIconSize(size);
      },
      { min: 1, max: 100, defaultValue: DEFAULT_DEVICE_ICON_SIZE, suffix: "px" }
    );

    // Camera Icon Selection
    const cameraContainer = document.querySelector(".change-camera-icons");
    if (cameraContainer) {
      cameraContainer.querySelectorAll("img").forEach((img) => {
        img.addEventListener("click", () => {
          if (!this.currentGroup) return;
          const imageObj = this.findInGroup((o) => o.type === "image");
          if (imageObj) {
            const newSrc = img.getAttribute("src");
            imageObj.setSrc(newSrc, () => {
              const scaleFactor = this.currentGroup.scaleFactor || 1;
              imageObj.set({
                scaleX: (DEFAULT_DEVICE_ICON_SIZE * scaleFactor) / imageObj.width,
                scaleY: (DEFAULT_DEVICE_ICON_SIZE * scaleFactor) / imageObj.height,
              });
              this.currentGroup.deviceType = newSrc.split("/").pop();
              this.currentGroup.dirty = true;
              this.currentGroup.setCoords();
              this.currentGroup.canvas?.renderAll();
            });
          }
        });
      });
    }

    // Device Icon Selection
    const deviceContainer = document.querySelector(".change-device-icons");
    if (deviceContainer) {
      deviceContainer.querySelectorAll("img").forEach((img) => {
        img.addEventListener("click", () => {
          if (!this.currentGroup) return;
          const imageObj = this.findInGroup((o) => o.type === "image");
          if (imageObj) {
            const newSrc = img.getAttribute("src");
            imageObj.setSrc(newSrc, () => {
              const scaleFactor = this.currentGroup.scaleFactor || 1;
              imageObj.set({
                scaleX: (DEFAULT_DEVICE_ICON_SIZE * scaleFactor) / imageObj.width,
                scaleY: (DEFAULT_DEVICE_ICON_SIZE * scaleFactor) / imageObj.height,
              });
              this.currentGroup.deviceType = newSrc.split("/").pop();
              this.currentGroup.dirty = true;
              this.currentGroup.setCoords();
              this.currentGroup.canvas?.renderAll();
            });
          }
        });
      });
    }

    // Device Label Text
    if (this.deviceLabelInput) {
      this.deviceLabelInput.addEventListener("input", (e) => {
        if (this.currentTextObject) {
          this.currentTextObject.set({ text: e.target.value });
          updateTextPosition(this.currentGroup, this.currentTextObject);
          this.currentGroup?.canvas?.renderAll();
        }
      });
    }

    // Device Label Toggle
    createToggleHandler(this.deviceLabelToggle, (visible) => {
      if (this.currentTextObject) {
        setTextVisibility(this.currentTextObject, visible);
      }
    });

    // Text Color
    setupColorControls(this.deviceTextColorPicker, this.deviceTextColorIcons, (color) => {
      if (this.currentTextObject) {
        this.currentTextObject.set({ fill: color });
        this.currentGroup?.canvas?.renderAll();
      }
    });

    // Text Background Color
    setupColorControls(this.deviceTextBgColorPicker, this.deviceTextBgColorIcons, (color) => {
      if (this.currentTextObject) {
        this.currentTextObject.set({ backgroundColor: color });
        this.currentGroup?.canvas?.renderAll();
      }
    });

    // Rotation
    createSliderInputSync(
      this.iconRotationSlider,
      this.iconRotationInput,
      (angle) => {
        if (this.currentGroup) {
          this.currentGroup.set({ angle: angle });
          this.currentGroup.setCoords();
          this.currentGroup.canvas?.renderAll();
        }
      },
      { min: 0, max: 360, suffix: "°" }
    );
  }

  // Updates the icon size and scales related objects
  updateIconSize(size) {
    if (!this.currentGroup || !this.currentGroup.canvas) return;

    const clampedSize = Math.max(1, Math.min(100, parseInt(size) || DEFAULT_DEVICE_ICON_SIZE));
    const scaleFactor = clampedSize / DEFAULT_DEVICE_ICON_SIZE;
    this.currentGroup.scaleFactor = scaleFactor;

    const imageObj = this.findInGroup((o) => o.type === "image");
    const circleObj = this.findInGroup((o) => o.type === "circle");

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

      setMultipleObjectProperties(this.currentGroup, {
        scaleX: 1,
        scaleY: 1,
        width: circleObj.radius * 2,
        height: circleObj.radius * 2,
      });

      if (this.currentTextObject && !this.currentTextObject._isHidden) {
        updateTextPosition(this.currentGroup, this.currentTextObject);
        setMultipleObjectProperties(this.currentTextObject, { fontSize: 12 * scaleFactor });
      }

      if (this.currentGroup.coverageConfig && this.currentGroup.createOrUpdateCoverageArea) {
        this.currentGroup.createOrUpdateCoverageArea();
      }

      this.currentGroup.setCoords();
      this.currentGroup.canvas.renderAll();
    }
  }

  // Updates the label panel UI
  updateDeviceLabelPanel(textObject, group, isTextDevice) {
    if (this.deviceLabelInput) this.deviceLabelInput.value = textObject?.text || "";
    if (this.deviceLabelToggle) this.deviceLabelToggle.checked = textObject ? !textObject._isHidden : false;

    if (this.deviceTextColorPicker) {
      const fill = textObject?.fill;
      this.deviceTextColorPicker.value = fill ? getHexFromFill(fill) : "#000000";
    }
    if (this.deviceTextBgColorPicker) {
      const bgColor = textObject?.backgroundColor;
      this.deviceTextBgColorPicker.value = bgColor ? getHexFromFill(bgColor) : "#ffffff";
    }

    const labelGroup = document.getElementById("device-label-properties-group");
    if (labelGroup) labelGroup.style.display = isTextDevice ? "none" : "block";
  }

  // Updates the icon panel UI
  updateIconPanel(group, textObject, isTextDevice) {
    const circle = this.findInGroup((o) => o.type === "circle");
    if (this.iconColorPicker && circle) {
      this.iconColorPicker.value = circle.fill ? getHexFromFill(circle.fill) : "#000000";
    }

    const size = group?.scaleFactor ? group.scaleFactor * DEFAULT_DEVICE_ICON_SIZE : DEFAULT_DEVICE_ICON_SIZE;
    if (this.iconSizeSlider) this.iconSizeSlider.value = size;
    if (this.iconSizeInput) this.iconSizeInput.value = Math.round(size);

    if (this.iconRotationSlider) this.iconRotationSlider.value = group?.angle || 0;
    if (this.iconRotationInput) this.iconRotationInput.value = Math.round(group?.angle || 0);

    const iconGroup = document.getElementById("device-icon-properties-group");
    if (iconGroup) iconGroup.style.display = isTextDevice ? "none" : "block";
  }

  // Clears the label panel UI
  clearDeviceLabelPanel() {
    if (this.deviceLabelInput) this.deviceLabelInput.value = "";
    if (this.deviceLabelToggle) this.deviceLabelToggle.checked = false;
  }
}
