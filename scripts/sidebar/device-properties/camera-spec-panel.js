import { preventEventPropagation, updateSliderTrack } from "../sidebar-utils.js";
import { calculateFOV, calculateCameraAngles, updateCameraFromSpecs } from "../../devices/camera/camera-specs.js";

// Sets up the camera specification panel with controls for resolution, sensor size, focal length, and aspect ratio
export function initCameraSpecPanel() {
  const deviceFocalLengthInput = document.getElementById("device-focal-length-input");
  const deviceSensorSizeInput = document.getElementById("device-sensor-size-input");
  const deviceResolutionInput = document.getElementById("device-resolution-input");
  const deviceIpAddressInput = document.getElementById("device-ip-address-input");
  const deviceSubnetInput = document.getElementById("device-subnet-input");
  const deviceGatewayInput = document.getElementById("device-gateway-input");
  const deviceMacAddressInput = document.getElementById("device-mac-address-input");
  const aspectRatioToggle = document.getElementById("camera-aspect-ratio-toggle");

  let currentGroup = null;
  let updateCameraCoverageFromFOV = null;

  // Updates the camera coverage angle when focal length or sensor size changes
  updateCameraCoverageFromFOV = () => {
    if (!currentGroup || !currentGroup.coverageConfig) return;

    const planAngle = updateCameraFromSpecs(currentGroup);
    if (planAngle === null) return;

    // Update the slider to match the calculated angle
    const angleSlider = document.getElementById("camera-angle-slider");
    const angleInput = document.getElementById("camera-angle-input");
    if (angleSlider && angleInput) {
      angleSlider.value = planAngle;
      angleInput.value = planAngle;
      // Always update the slider track using the imported helper so the
      // visual track color stays in sync immediately when FOV/angle changes.
      try {
        updateSliderTrack(angleSlider, planAngle, 1, 360);
      } catch (err) {
        // If anything goes wrong, fallback silently - not fatal for the app.
        // (This avoids breaking in environments where DOM or style isn't available.)
      }
    }

    // Notify coverage panel to update physics (dead zone, side view)
    const event = new CustomEvent("camera-specs-changed", { detail: { group: currentGroup } });
    document.dispatchEvent(event);
  };

  // Handles changes to focal length input
  if (deviceFocalLengthInput) {
    deviceFocalLengthInput.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
      }
    });
    deviceFocalLengthInput.addEventListener("input", (e) => {
      if (!currentGroup) return;
      currentGroup.focalLength = e.target.value;
      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(currentGroup);
      }
      updateCameraCoverageFromFOV();
    });
    preventEventPropagation(deviceFocalLengthInput, ["mousedown", "keyup"]);
  }

  // Handles changes to sensor size dropdown
  if (deviceSensorSizeInput) {
    deviceSensorSizeInput.addEventListener("change", (e) => {
      if (!currentGroup) return;
      currentGroup.sensorSize = e.target.value;
      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(currentGroup);
      }
      updateCameraCoverageFromFOV();
    });
    preventEventPropagation(deviceSensorSizeInput, ["mousedown", "keydown", "keyup"]);
  }

  // Handles changes to resolution input
  if (deviceResolutionInput) {
    deviceResolutionInput.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
      }
    });
    deviceResolutionInput.addEventListener("input", (e) => {
      if (!currentGroup) return;
      currentGroup.resolution = e.target.value;

      // Auto-enable DORI if resolution is set
      if (currentGroup.coverageConfig && e.target.value) {
        currentGroup.coverageConfig.doriEnabled = true;
        const doriToggle = document.getElementById("camera-dori-toggle");
        if (doriToggle) doriToggle.checked = true;
        if (currentGroup.createOrUpdateCoverageArea) {
          currentGroup.createOrUpdateCoverageArea();
        }
      }

      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(currentGroup);
      }
    });
    preventEventPropagation(deviceResolutionInput, ["mousedown", "keyup"]);
  }

  // Handles network settings like IP address, subnet, gateway, and MAC address
  const bindGroupInput = (inputEl, propName) => {
    if (!inputEl) return;
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
      }
    });
    inputEl.addEventListener("input", (e) => {
      if (!currentGroup) return;
      currentGroup[propName] = e.target.value;
      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(currentGroup);
      }
    });
    preventEventPropagation(inputEl, ["mousedown", "keyup"]);
  };

  if (deviceIpAddressInput) bindGroupInput(deviceIpAddressInput, "ipAddress");
  if (deviceSubnetInput) bindGroupInput(deviceSubnetInput, "subnetMask");
  if (deviceGatewayInput) bindGroupInput(deviceGatewayInput, "gatewayAddress");
  if (deviceMacAddressInput) bindGroupInput(deviceMacAddressInput, "macAddress");

  // Handle Aspect Ratio Toggle
  if (aspectRatioToggle) {
    aspectRatioToggle.addEventListener("change", (e) => {
      if (!currentGroup || !currentGroup.coverageConfig) return;
      currentGroup.coverageConfig.aspectRatioMode = e.target.checked;
      updateCameraCoverageFromFOV();
    });
  }

  return {
    setCurrentGroup: (group) => {
      currentGroup = group;
    },
    updateCameraSpecPanel: (group) => {
      currentGroup = group;
      if (aspectRatioToggle) {
        aspectRatioToggle.checked = group?.coverageConfig?.aspectRatioMode || false;
      }
      if (deviceFocalLengthInput) {
        deviceFocalLengthInput.value = group?.focalLength || "";
      }
      if (deviceSensorSizeInput) {
        deviceSensorSizeInput.value = group?.sensorSize || "1/2.0";
      }
      if (deviceResolutionInput) {
        deviceResolutionInput.value = group?.resolution || "";
      }
      if (deviceIpAddressInput) {
        deviceIpAddressInput.value = group?.ipAddress || "";
      }
      if (deviceSubnetInput) {
        deviceSubnetInput.value = group?.subnetMask || "";
      }
      if (deviceGatewayInput) {
        deviceGatewayInput.value = group?.gatewayAddress || "";
      }
      if (deviceMacAddressInput) {
        deviceMacAddressInput.value = group?.macAddress || "";
      }

      // Calculate and store the theoretical angle for warning comparison
      if (group && group.focalLength && group.sensorSize) {
        const fov = calculateFOV(group.focalLength, group.sensorSize);
        if (fov) {
          const isAspectRatio = group.coverageConfig?.aspectRatioMode || false;
          let planAngle;
          if (isAspectRatio) {
            planAngle = Math.round(fov.vertical);
          } else {
            planAngle = Math.round(fov.horizontal);
          }
          if (group.coverageConfig) {
            group.coverageConfig.calculatedAngle = planAngle;
          }
        }
      }
    },
    // Clears all input fields
    clearCameraSpecPanel: () => {
      currentGroup = null;
      if (deviceFocalLengthInput) deviceFocalLengthInput.value = "";
      if (deviceSensorSizeInput) deviceSensorSizeInput.value = "1/2.0";
      if (deviceResolutionInput) deviceResolutionInput.value = "";
      if (deviceIpAddressInput) deviceIpAddressInput.value = "";
      if (deviceSubnetInput) deviceSubnetInput.value = "";
      if (deviceGatewayInput) deviceGatewayInput.value = "";
      if (deviceMacAddressInput) deviceMacAddressInput.value = "";
    },
  };
}
