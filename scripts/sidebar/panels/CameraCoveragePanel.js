import { layers } from "../../canvas/interactions/LayerControls.js";
import { updateSliderTrack, createSliderInputSync, setupColorControls, setMultipleObjectProperties, DEFAULT_PIXELS_PER_METER } from "../sidebar-utils.js";
import { drawSideView } from "../../devices/camera/camera-diagram.js";
import { applyCameraPhysics } from "../../devices/camera/camera-calculations.js";

// Manages the camera coverage panel (angle, distance, height, tilt, etc.)
export class CameraCoveragePanel {
  // Initialize panel elements and setup controls
  constructor() {
    this.currentGroup = null;
    this.isInitializing = true;

    this.coverageColorPicker = document.getElementById("coverage-color-picker");
    this.coverageColorIcons = document.querySelectorAll(".change-coverage-colour .colour-icon");
    this.coverageToggle = document.getElementById("camera-coverage-toggle");
    this.doriToggle = document.getElementById("camera-dori-toggle");
    this.lockDistanceToggle = document.getElementById("camera-lock-distance-on-rotate");
    this.angleSlider = document.getElementById("camera-angle-slider");
    this.angleInput = document.getElementById("camera-angle-input");
    this.opacitySlider = document.getElementById("camera-opacity-slider");
    this.opacityInput = document.getElementById("camera-opacity-input");
    this.distanceSlider = document.getElementById("camera-distance-slider");
    this.distanceInput = document.getElementById("camera-distance-input");
    this.heightSlider = document.getElementById("camera-height-slider");
    this.heightInput = document.getElementById("camera-height-input");
    this.tiltSlider = document.getElementById("camera-tilt-slider");
    this.tiltInput = document.getElementById("camera-tilt-input");
    this.edgeStyleSelect = document.getElementById("camera-edge-style");
    this.projectionModeSelect = document.getElementById("camera-projection-mode");
    this.sideViewCanvas = document.getElementById("camera-side-view");

    this.setupControls();
    this.setupEventListeners();
  }

  // Sets the current device group
  setCurrentGroup(group) {
    this.currentGroup = group;
  }

  // Sets up UI controls and event listeners
  setupControls() {
    // Coverage Color
    setupColorControls(this.coverageColorPicker, this.coverageColorIcons, (color) => {
      if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
      const opacity = this.currentGroup.coverageConfig.opacity || 0.3;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const rgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;

      this.currentGroup.coverageConfig.fillColor = rgba;
      if (this.currentGroup.coverageArea) {
        this.currentGroup.coverageArea.set({ fill: rgba });
      }
      this.currentGroup.canvas?.renderAll();
    });

    // Angle
    createSliderInputSync(
      this.angleSlider,
      this.angleInput,
      (angle) => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.updateAngle(this.currentGroup, angle);
      },
      { min: 1, max: 360 }
    );

    // Distance
    createSliderInputSync(
      this.distanceSlider,
      this.distanceInput,
      (distance) => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.maxRange = distance;
        if (this.currentGroup.createOrUpdateCoverageArea) this.currentGroup.createOrUpdateCoverageArea();
      },
      { min: 1, max: 500 }
    );

    // Height
    createSliderInputSync(
      this.heightSlider,
      this.heightInput,
      (height) => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.cameraHeight = height;
        this.updateRadiusFromHeightAndTilt(this.currentGroup);
      },
      { min: 0, max: 50, step: 0.1, precision: 1 }
    );

    // Tilt
    createSliderInputSync(
      this.tiltSlider,
      this.tiltInput,
      (tilt) => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.cameraTilt = tilt;
        this.updateRadiusFromHeightAndTilt(this.currentGroup);
      },
      { min: 0, max: 90 }
    );

    // Opacity (Special handling for 0-1 slider vs 0-100 input)
    if (this.opacitySlider && this.opacityInput) {
      this.opacitySlider.addEventListener("input", () => {
        const val = parseFloat(this.opacitySlider.value);
        this.opacityInput.value = Math.round(val * 100);
        updateSliderTrack(this.opacitySlider, val, 0, 1);
        if (this.currentGroup) this.updateCoverageOpacity(this.currentGroup, val);
      });
      this.opacityInput.addEventListener("input", () => {
        let val = parseFloat(this.opacityInput.value);
        if (isNaN(val)) return;
        val = Math.max(0, Math.min(100, val)) / 100;
        this.opacitySlider.value = val;
        updateSliderTrack(this.opacitySlider, val, 0, 1);
        if (this.currentGroup) this.updateCoverageOpacity(this.currentGroup, val);
      });
    }

    // Coverage Toggle
    if (this.coverageToggle) {
      this.coverageToggle.addEventListener("change", () => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.visible = this.coverageToggle.checked;
        if (this.currentGroup.coverageArea) {
          this.currentGroup.coverageArea.set({ visible: this.coverageToggle.checked });
        }
        this.currentGroup.canvas?.renderAll();
      });
    }

    // DORI Toggle
    if (this.doriToggle) {
      this.doriToggle.addEventListener("change", () => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.doriEnabled = this.doriToggle.checked;
        if (this.currentGroup.createOrUpdateCoverageArea) this.currentGroup.createOrUpdateCoverageArea();
        this.currentGroup.canvas?.renderAll();
      });
    }

    // Lock Distance on Rotate Toggle
    if (this.lockDistanceToggle) {
      this.lockDistanceToggle.addEventListener("change", () => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.lockDistanceOnRotate = this.lockDistanceToggle.checked;
      });
    }

    // Edge Style
    if (this.edgeStyleSelect) {
      this.edgeStyleSelect.addEventListener("change", () => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.edgeStyle = this.edgeStyleSelect.value;
        if (this.currentGroup.createOrUpdateCoverageArea) this.currentGroup.createOrUpdateCoverageArea();
        this.currentGroup.canvas?.renderAll();
      });
    }

    // Projection Mode
    if (this.projectionModeSelect) {
      this.projectionModeSelect.addEventListener("change", () => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.projectionMode = this.projectionModeSelect.value;
        if (this.currentGroup.createOrUpdateCoverageArea) this.currentGroup.createOrUpdateCoverageArea();
        this.currentGroup.canvas?.renderAll();
      });
    }
  }

  // Sets up global event listeners
  setupEventListeners() {
    document.addEventListener("camera-specs-changed", (e) => {
      if (this.currentGroup === e.detail.group) {
        this.updateRadiusFromHeightAndTilt(this.currentGroup);
      }
    });
  }

  // Updates the panel UI with group data
  updateCameraCoveragePanel(group) {
    this.currentGroup = group;
    if (!group || !group.coverageConfig) return;

    const config = group.coverageConfig;

    if (this.coverageToggle) this.coverageToggle.checked = config.visible !== false;
    if (this.doriToggle) this.doriToggle.checked = !!config.doriEnabled;
    if (this.lockDistanceToggle) this.lockDistanceToggle.checked = !!config.lockDistanceOnRotate;
    if (this.edgeStyleSelect) this.edgeStyleSelect.value = config.edgeStyle || "solid";
    if (this.projectionModeSelect) this.projectionModeSelect.value = config.projectionMode || "2d";

    if (this.angleSlider) {
      const angle = group.angleDiff ? group.angleDiff(config.startAngle, config.endAngle) : 60;
      this.angleSlider.value = angle;
      if (this.angleInput) this.angleInput.value = angle;
      updateSliderTrack(this.angleSlider, angle, 1, 360);
    }

    if (this.distanceSlider) {
      const distance = config.maxRange || config.radiusMeters || 20;
      this.distanceSlider.value = distance;
      if (this.distanceInput) this.distanceInput.value = distance;
      updateSliderTrack(this.distanceSlider, distance, 1, 500);
    }

    if (this.heightSlider) {
      const height = config.cameraHeight || 3;
      this.heightSlider.value = height;
      if (this.heightInput) this.heightInput.value = height;
      updateSliderTrack(this.heightSlider, height, 0, 50);
    }

    if (this.tiltSlider) {
      const tilt = config.cameraTilt ?? 25;
      this.tiltSlider.value = tilt;
      if (this.tiltInput) this.tiltInput.value = tilt;
      updateSliderTrack(this.tiltSlider, tilt, 0, 90);
    }

    if (this.opacitySlider) {
      const opacity = config.opacity || 0.3;
      this.opacitySlider.value = opacity;
      if (this.opacityInput) this.opacityInput.value = Math.round(opacity * 100);
      updateSliderTrack(this.opacitySlider, opacity, 0, 1);
    }

    this.updateRadiusFromHeightAndTilt(group);
  }

  // Calculates coverage radius based on height and tilt
  updateRadiusFromHeightAndTilt(activeObject) {
    if (!activeObject || !activeObject.coverageConfig) return;

    const result = applyCameraPhysics(activeObject);
    if (!result) return;

    const { minRangeMeters, clampedRadiusMeters } = result;

    if (activeObject.createOrUpdateCoverageArea) activeObject.createOrUpdateCoverageArea();

    const height = activeObject.coverageConfig.cameraHeight || 3;
    const tilt = activeObject.coverageConfig.cameraTilt ?? 25;
    const fov = activeObject.coverageConfig.sideFOV || 60;

    drawSideView(this.sideViewCanvas, height, tilt, clampedRadiusMeters, minRangeMeters, fov);
  }

  // Updates coverage opacity
  updateCoverageOpacity(activeObject, cameraOpacity) {
    const rgbMatch = activeObject.coverageConfig.fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const devicesLayerOpacity = layers.devices.opacity;
    const finalOpacity = cameraOpacity * devicesLayerOpacity;

    activeObject.coverageConfig.opacity = cameraOpacity;

    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      const newFill = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
      if (activeObject.coverageArea) activeObject.coverageArea.set({ fill: newFill });
      activeObject.coverageConfig.fillColor = newFill;
    }
    activeObject.canvas?.renderAll();
  }

  // Updates coverage angle
  updateAngle(activeObject, angleSpan) {
    const config = activeObject.coverageConfig;
    const currentSpan = activeObject.angleDiff(config.startAngle, config.endAngle);
    const midAngle = (config.startAngle + currentSpan / 2) % 360;

    activeObject.coverageConfig.startAngle = (midAngle - angleSpan / 2 + 360) % 360;
    activeObject.coverageConfig.endAngle = (midAngle + angleSpan / 2) % 360;

    if (activeObject.createOrUpdateCoverageArea) activeObject.createOrUpdateCoverageArea();
    activeObject.canvas?.renderAll();
  }
}
