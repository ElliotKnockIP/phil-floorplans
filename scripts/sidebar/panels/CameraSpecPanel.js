import { updateSliderTrack, createToggleHandler, bindInputToProperty, bindSelectToProperty } from "../sidebar-utils.js";
import { updateCameraFromSpecs } from "../../devices/camera/camera-calculations.js";

// Manages the camera specification panel (resolution, sensor, focal length, etc.)
export class CameraSpecPanel {
  // Initialize panel elements and setup inputs
  constructor() {
    this.currentGroup = null;

    this.focalLengthInput = document.getElementById("device-focal-length-input");
    this.sensorSizeInput = document.getElementById("device-sensor-size-input");
    this.resolutionInput = document.getElementById("device-resolution-input");
    this.ipAddressInput = document.getElementById("device-ip-address-input");
    this.subnetInput = document.getElementById("device-subnet-input");
    this.gatewayInput = document.getElementById("device-gateway-input");
    this.macAddressInput = document.getElementById("device-mac-address-input");
    this.aspectRatioToggle = document.getElementById("camera-aspect-ratio-toggle");

    this.setupInputs();
  }

  // Sets the current device group
  setCurrentGroup(group) {
    this.currentGroup = group;
  }

  // Binds inputs to camera properties
  setupInputs() {
    if (this.focalLengthInput) {
      bindInputToProperty(this.focalLengthInput, "focalLength", () => this.currentGroup, {
        onUpdate: () => this.updateCameraCoverageFromFOV(),
      });
    }

    if (this.sensorSizeInput) {
      bindSelectToProperty(this.sensorSizeInput, "sensorSize", () => this.currentGroup, {
        onUpdate: () => this.updateCameraCoverageFromFOV(),
      });
    }

    if (this.resolutionInput) {
      bindInputToProperty(this.resolutionInput, "resolution", () => this.currentGroup, {
        onUpdate: (group, value) => {
          if (group.coverageConfig && value) {
            group.coverageConfig.doriEnabled = true;
            const doriToggle = document.getElementById("camera-dori-toggle");
            if (doriToggle) doriToggle.checked = true;
            if (group.createOrUpdateCoverageArea) {
              group.createOrUpdateCoverageArea();
            }
          }
          this.updateCameraCoverageFromFOV();
        },
      });
    }

    // Network settings
    if (this.ipAddressInput) bindInputToProperty(this.ipAddressInput, "ipAddress", () => this.currentGroup);
    if (this.subnetInput) bindInputToProperty(this.subnetInput, "subnetMask", () => this.currentGroup);
    if (this.gatewayInput) bindInputToProperty(this.gatewayInput, "gatewayAddress", () => this.currentGroup);
    if (this.macAddressInput) bindInputToProperty(this.macAddressInput, "macAddress", () => this.currentGroup);

    // Aspect Ratio Toggle
    if (this.aspectRatioToggle) {
      createToggleHandler(this.aspectRatioToggle, (checked) => {
        if (!this.currentGroup || !this.currentGroup.coverageConfig) return;
        this.currentGroup.coverageConfig.aspectRatioMode = checked;
        this.updateCameraCoverageFromFOV();
      });
    }
  }

  // Updates the camera coverage angle based on FOV calculations
  updateCameraCoverageFromFOV() {
    if (!this.currentGroup || !this.currentGroup.coverageConfig) return;

    const planAngle = updateCameraFromSpecs(this.currentGroup);
    if (planAngle === null) return;

    const angleSlider = document.getElementById("camera-angle-slider");
    const angleInput = document.getElementById("camera-angle-input");

    if (angleSlider && angleInput) {
      angleSlider.value = planAngle;
      angleInput.value = planAngle;
      try {
        updateSliderTrack(angleSlider, planAngle, 1, 360);
      } catch (err) {}
    }

    // Notify coverage panel to update
    const event = new CustomEvent("camera-specs-changed", { detail: { group: this.currentGroup } });
    document.dispatchEvent(event);
  }

  // Updates the panel UI with group data
  updateCameraSpecPanel(group) {
    this.currentGroup = group;
    if (this.aspectRatioToggle) {
      this.aspectRatioToggle.checked = group?.coverageConfig?.aspectRatioMode || false;
    }
    if (this.focalLengthInput) {
      this.focalLengthInput.value = group?.focalLength || "";
    }
    if (this.sensorSizeInput) {
      this.sensorSizeInput.value = group?.sensorSize || "1/3";
    }
    if (this.resolutionInput) {
      this.resolutionInput.value = group?.resolution || "";
    }
    if (this.ipAddressInput) this.ipAddressInput.value = group?.ipAddress || "";
    if (this.subnetInput) this.subnetInput.value = group?.subnetMask || "";
    if (this.gatewayInput) this.gatewayInput.value = group?.gatewayAddress || "";
    if (this.macAddressInput) this.macAddressInput.value = group?.macAddress || "";
  }

  // Clears the panel inputs
  clearCameraSpecPanel() {
    this.currentGroup = null;
    if (this.focalLengthInput) this.focalLengthInput.value = "";
    if (this.sensorSizeInput) this.sensorSizeInput.value = "1/3";
    if (this.resolutionInput) this.resolutionInput.value = "";
    if (this.ipAddressInput) this.ipAddressInput.value = "";
    if (this.subnetInput) this.subnetInput.value = "";
    if (this.gatewayInput) this.gatewayInput.value = "";
    if (this.macAddressInput) this.macAddressInput.value = "";
    if (this.aspectRatioToggle) this.aspectRatioToggle.checked = false;
  }
}
