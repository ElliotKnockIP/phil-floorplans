import { bindInputToProperty, bindSelectToProperty } from "../sidebar-utils.js";

// Manages the details panel for device properties
export class DetailsPanel {
  // Initialize panel elements and setup inputs
  constructor() {
    this.currentGroup = null;

    this.locationInput = document.getElementById("device-location-input");
    this.partNumberInput = document.getElementById("device-part-number-input");
    this.fittingPositionsInput = document.getElementById("fitting-positions");
    this.stockNumberInput = document.getElementById("device-stock-number-input");

    this.setupInputs();
  }

  // Binds inputs to device properties
  setupInputs() {
    if (this.partNumberInput) {
      bindInputToProperty(this.partNumberInput, "partNumber", () => this.currentGroup);
    }
    if (this.locationInput) {
      bindInputToProperty(this.locationInput, "location", () => this.currentGroup);
    }
    if (this.stockNumberInput) {
      bindInputToProperty(this.stockNumberInput, "stockNumber", () => this.currentGroup);
    }

    if (this.fittingPositionsInput) {
      bindSelectToProperty(this.fittingPositionsInput, "mountedPosition", () => this.currentGroup, {
        transformValue: (value) => (value === "Select" ? "" : value),
      });
    }
  }

  // Updates the panel with group data
  updateDetailsPanel(group) {
    this.currentGroup = group;

    if (this.partNumberInput) {
      this.partNumberInput.value = group?.partNumber || "";
    }
    if (this.locationInput) {
      this.locationInput.value = group?.location || "";
    }
    if (this.fittingPositionsInput) {
      this.fittingPositionsInput.value = group?.mountedPosition || "Select";
    }
    if (this.stockNumberInput) {
      this.stockNumberInput.value = group?.stockNumber || "";
    }
  }

  // Clears the panel inputs
  clearDetailsPanel() {
    this.currentGroup = null;
    if (this.partNumberInput) this.partNumberInput.value = "";
    if (this.locationInput) this.locationInput.value = "";
    if (this.fittingPositionsInput) this.fittingPositionsInput.value = "Select";
    if (this.stockNumberInput) this.stockNumberInput.value = "";
  }

  // Updates channel information from topology
  updateChannelInfo(group) {
    const channelInfoGroup = document.getElementById("device-channel-info-group");
    const channelInfoText = document.getElementById("device-channel-info");

    if (channelInfoGroup && channelInfoText && window.topologyManager && group) {
      const isPanel = window.topologyManager.isPanelDevice(group);

      if (isPanel) {
        const connections = window.topologyManager.getPanelConnections(group);
        if (connections && connections.length > 0) {
          const connectionText = connections.map((conn) => `${conn.deviceLabel} (Channel ${conn.channel})`).join(", ");
          channelInfoText.textContent = `Connected Devices: ${connectionText}`;
          channelInfoGroup.style.display = "block";
        } else {
          channelInfoGroup.style.display = "none";
        }
      } else {
        const channelInfo = window.topologyManager.getDeviceChannelInfo(group);
        if (channelInfo) {
          channelInfoText.textContent = `Channel ${channelInfo.channel} on ${channelInfo.panelLabel}`;
          channelInfoGroup.style.display = "block";
        } else {
          channelInfoGroup.style.display = "none";
        }
      }
    }
  }
}
