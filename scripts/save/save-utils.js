// Centralized utilities for the save system
export const ObjectTypeUtils = {
  isDevice: (obj) => obj.type === "group" && obj.deviceType,
  isCameraDevice: (deviceType) => ["fixed-camera.png", "box-camera.png", "dome-camera.png", "ptz-camera.png", "bullet-camera.png", "thermal-camera.png"].includes(deviceType),
  isDrawingObject: (obj) => {
    if (obj.isCoverage || obj.isBackground) return false;
    if (obj.type === "group" && obj.deviceType && obj.deviceType !== "title-block") return false;
    if (obj.type === "text" && obj.isDeviceLabel) return false;
    if (obj.type === "polygon" && obj.fill?.includes("165, 155, 155")) return false;
    if (obj.isResizeIcon === true) return false;
    // Exclude network connection visuals; saved separately in topology
    if (obj.isConnectionSegment || obj.isNetworkSplitPoint || obj.isNetworkConnection) return false;
    if (obj.type === "circle" && obj.fill === "#f8794b" && obj.radius < 30 && !obj.isWallCircle) return false;
    return true;
  },
  isManagedObject: (obj) => {
    return ObjectTypeUtils.isDevice(obj) || (obj.type === "text" && obj.isDeviceLabel) || (obj.type === "polygon" && obj.fill?.includes("165, 155, 155")) || obj.isResizeIcon === true || (obj.type === "circle" && obj.fill === "#f8794b" && obj.radius < 30 && !obj.isWallCircle) || obj.isCoverage === true;
  },
  isZoneObject: (obj) => (obj.type === "polygon" && obj.class === "zone-polygon") || (obj.type === "i-text" && obj.class === "zone-text"),
  isRoomObject: (obj) => (obj.type === "polygon" && obj.class === "room-polygon") || (obj.type === "i-text" && obj.class === "room-text"),
  isWallObject: (obj) => (obj.type === "line" && !obj.deviceType && !obj.isResizeIcon && obj.stroke !== "grey" && obj.stroke !== "blue") || (obj.type === "circle" && obj.isWallCircle === true),
  isTitleBlockObject: (obj) => obj.type === "group" && obj.deviceType === "title-block",
};

export const StyleConfig = {
  standard: {
    borderColor: "#f8794b",
    borderScaleFactor: 2,
    cornerSize: 8,
    cornerColor: "#f8794b",
    cornerStrokeColor: "#000000",
    cornerStyle: "circle",
    padding: 5,
    transparentCorners: false,
    hasControls: true,
    hasBorders: true,
    selectable: true,
    evented: true,
  },
  line: {
    borderColor: "#f8794b",
    borderScaleFactor: 2,
    cornerSize: 8,
    cornerColor: "#f8794b",
    cornerStrokeColor: "#000000",
    cornerStyle: "circle",
    transparentCorners: false,
    hasControls: false,
    hasBorders: true,
    selectable: true,
    evented: true,
  },
};

export const SerializationUtils = {
  extractBaseData: (obj) => ({
    id: obj.id || `obj_${Date.now()}_${Math.random()}`,
    type: obj.type,
    position: { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY },
    transform: {
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      angle: obj.angle || 0,
      skewX: obj.skewX || 0,
      skewY: obj.skewY || 0,
    },
    visual: {
      opacity: obj.opacity || 1,
      visible: obj.visible !== false,
      selectable: obj.selectable !== false,
      evented: obj.evented !== false,
      hasControls: obj.hasControls || false,
      hasBorders: obj.hasBorders !== false,
      borderColor: obj.borderColor || "#f8794b",
      borderScaleFactor: obj.borderScaleFactor || 2,
      cornerSize: obj.cornerSize || 8,
      cornerColor: obj.cornerColor || "#f8794b",
      cornerStrokeColor: obj.cornerStrokeColor || "#000000",
      cornerStyle: obj.cornerStyle || "circle",
      transparentCorners: obj.transparentCorners !== undefined ? obj.transparentCorners : false,
    },
    customProperties: SerializationUtils.extractCustomProperties(obj),
  }),

  extractCustomProperties: (obj) => {
    const customProps = {};
    const customKeys = ["isUploadedImage", "isLocked", "northArrowImage", "lockUniScaling", "strokeUniform", "cursorColor", "isConnectionLine", "isArrow"];
    customKeys.forEach((key) => {
      if (obj[key]) customProps[key] = obj[key];
    });
    return customProps;
  },

  applyStandardStyling: (obj, styleType = "standard") => {
    const style = StyleConfig[styleType] || StyleConfig.standard;
    obj.set(style);
    return obj;
  },

  downloadFile: (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

export const FormUtils = {
  getValue: (id) => document.getElementById(id)?.value || "",
  setValue: (id, value) => {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
};

export const NotificationSystem = {
  show: (message, isSuccess = true) => {
    const notification = Object.assign(document.createElement("div"), { textContent: message });
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 12px 24px;
      background: ${isSuccess ? "#ff6f42" : "#dc3545"}; color: white;
      border-radius: 4px; z-index: 10000; font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  },
};

