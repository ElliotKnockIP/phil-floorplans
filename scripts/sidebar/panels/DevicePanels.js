import { setTextVisibility, updateTextPosition, bindInputToProperty } from "../sidebar-utils.js";
import { StylePanel } from "./StylePanel.js";
import { CameraSpecPanel } from "./CameraSpecPanel.js";
import { DetailsPanel } from "./DetailsPanel.js";
import { CameraCoveragePanel } from "./CameraCoveragePanel.js";

// Coordinates all device property panels
export class DevicePanels {
  // Initialize sub-panels and setup common inputs
  constructor() {
    this.currentGroup = null;

    this.stylePanel = new StylePanel();
    this.cameraSpecPanel = new CameraSpecPanel();
    this.detailsPanel = new DetailsPanel();
    this.cameraCoveragePanel = new CameraCoveragePanel();

    this.setupInputs();
    this.initializeGlobalFunctions();
  }

  // Binds common device inputs
  setupInputs() {
    const partNumberInput = document.getElementById("device-part-number-input");
    const deviceLocationInput = document.getElementById("device-location-input");
    const stockNumberInput = document.getElementById("device-stock-number-input");

    bindInputToProperty(partNumberInput, "partNumber", () => this.currentGroup);
    bindInputToProperty(deviceLocationInput, "location", () => this.currentGroup);
    bindInputToProperty(stockNumberInput, "stockNumber", () => this.currentGroup);
  }

  // Sets up global functions for showing/hiding properties
  initializeGlobalFunctions() {
    window.setDeviceTextVisibility = setTextVisibility;
    window.updateDeviceTextPosition = updateTextPosition;

    window.showDeviceProperties = (deviceType, textObject, group) => {
      this.show(deviceType, textObject, group);
    };

    window.hideDeviceProperties = () => {
      this.hide();
    };
  }

  // Shows device properties and updates all panels
  show(deviceType, textObject, group) {
    const isTextDevice = deviceType === "text-device";
    this.currentGroup = group;
    window.__currentDeviceGroup = group; // Legacy support

    this.detailsPanel.updateChannelInfo(group);
    this.detailsPanel.updateDetailsPanel(group);

    this.cameraSpecPanel.setCurrentGroup(group);
    this.cameraSpecPanel.updateCameraSpecPanel(group);

    if (group && group.coverageConfig) {
      this.cameraCoveragePanel.updateCameraCoveragePanel(group);
    }

    this.stylePanel.setCurrentGroup(group);
    this.stylePanel.setCurrentTextObject(textObject);
    this.stylePanel.updateDeviceLabelPanel(textObject, group, isTextDevice);
    this.stylePanel.updateIconPanel(group, textObject, isTextDevice);
  }

  // Hides device properties and clears all panels
  hide() {
    this.currentGroup = null;
    window.__currentDeviceGroup = null;

    this.detailsPanel.clearDetailsPanel();
    this.cameraSpecPanel.clearCameraSpecPanel();
    this.stylePanel.clearDeviceLabelPanel();
    this.stylePanel.setCurrentGroup(null);
    this.stylePanel.setCurrentTextObject(null);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector("[data-include]")) {
    document.addEventListener("htmlIncludesLoaded", () => new DevicePanels());
  } else {
    new DevicePanels();
  }
});
