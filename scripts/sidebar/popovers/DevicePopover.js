import { PopoverBase } from "./PopoverBase.js";

// Manages the Device properties popover
export class DevicePopover extends PopoverBase {
  // Initialize popover and setup device name mapping
  constructor() {
    super("device-popover", {
      shouldPreventClose: (e) => {
        // Don't close when clicking on device icon
        return e.target.closest(".device-icon") !== null;
      },
      onClose: () => {
        this.currentTarget = null;
      },
    });

    if (!this.popover) return;

    this.deviceNameMap = {
      "bullet-camera.png": "Camera Properties",
      "box-camera.png": "Camera Properties",
      "ptz-camera.png": "Camera Properties",
      "dome-camera.png": "Camera Properties",
      "fixed-camera.png": "Camera Properties",
      "thermal-camera.png": "Camera Properties",
      "custom-camera-icon.png": "Camera Properties",
      "text-device": "Placeholder Text Properties",
    };

    this.setupIntercepts();
  }

  // Sets up intercepts for global device property functions
  setupIntercepts() {
    this.installIntercepts({
      installKey: "__devicePopoverInterceptInstalled",
      shouldIntercept: (deviceType) => {
        // Don't intercept polygons - let polygon popover handle those
        return !["zone-polygon", "room-polygon", "risk-polygon", "safety-polygon"].includes(deviceType);
      },
      onShowDeviceProperties: (deviceType, textObject, group, fourth, originalShow) => {
        // Let polygon popover handle polygons
        if (["zone-polygon", "room-polygon", "risk-polygon", "safety-polygon"].includes(deviceType)) {
          this.closePopover();
          return originalShow(deviceType, textObject, group, fourth);
        }

        try {
          originalShow(deviceType, textObject, group, fourth);
        } catch (_) {}

        // Initialize camera controls if needed
        if (group && group.canvas && typeof window.initCameraControls === "function") {
          try {
            window.initCameraControls(group.canvas);
          } catch (_) {}
        }

        const label = this.deviceNameMap[deviceType] || "Device Properties";
        if (deviceType === "text-device") {
          this.closePopover();
          return;
        }
        this.open(group, label, deviceType);
      },
      onHideDeviceProperties: () => {
        this.closePopover();
      },
    });
  }

  // Shows or hides a tab in the popover
  setTabVisibility(panelKey, visible) {
    const tab = this.popover.querySelector(`.panel-navigation .nav-item[data-panel="${panelKey}"]`);
    const panel = this.popover.querySelector(`.slide-panel[data-panel="${panelKey}"]`);
    if (tab) tab.style.display = visible ? "" : "none";
    if (panel) panel.style.display = visible ? "" : "none";
  }

  // Opens the popover with specific device context
  open(group, deviceTypeLabel = "Device Properties", deviceType = null) {
    if (this.isDragging) return;

    const popoverTitle = document.getElementById("device-popover-title");
    if (popoverTitle) popoverTitle.textContent = deviceTypeLabel;

    this.setActivePanel("details");

    ["details", "spec", "style", "coverage"].forEach((k) => this.setTabVisibility(k, true));

    let typeString = "";
    if (typeof deviceType === "string") {
      typeString = deviceType;
    } else if (group && typeof group.deviceType === "string") {
      typeString = group.deviceType;
    }

    const isCamera = !!typeString && typeString.includes("camera");
    const isPlaceholderText = typeString === "text-device";

    // Hide tabs that don't apply to placeholder text
    if (isPlaceholderText) {
      this.setTabVisibility("coverage", false);
      this.setTabVisibility("style", false);
      this.setTabVisibility("spec", false);
      this.setActivePanel("details");
    } else {
      this.setTabVisibility("coverage", isCamera);
      this.setTabVisibility("style", true);
      this.setTabVisibility("spec", isCamera);

      // Switch to details tab if on a camera-only tab for non-camera
      if (!isCamera && this.popover.querySelector('.panel-navigation .nav-item[data-panel="coverage"].active')) {
        this.setActivePanel("details");
      }
      if (!isCamera && this.popover.querySelector('.panel-navigation .nav-item[data-panel="spec"].active')) {
        this.setActivePanel("details");
      }
    }

    // Show the right icon section based on device type
    const cameraIconsSection = this.popover.querySelector(".camera-icons-section");
    const deviceIconsSection = this.popover.querySelector(".device-icons-section");

    if (isCamera) {
      if (cameraIconsSection) cameraIconsSection.style.display = "";
      if (deviceIconsSection) deviceIconsSection.style.display = "none";
    } else {
      if (cameraIconsSection) cameraIconsSection.style.display = "none";
      if (deviceIconsSection) deviceIconsSection.style.display = "";
    }

    ["camera-properties", "generic-properties"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "";
    });

    this.baseOpenPopover(group);

    window.requestAnimationFrame(() => this.positionPopover());
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("device-popover")) {
    new DevicePopover();
  } else {
    document.addEventListener("htmlIncludesLoaded", () => new DevicePopover());
  }
});
