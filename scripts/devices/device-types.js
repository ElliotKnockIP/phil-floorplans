// Centralized device type definitions and utilities
// This module is the single source of truth for all device type mappings

// Camera types that support coverage areas
export const CAMERA_TYPES = [
  "fixed-camera.png",
  "box-camera.png",
  "dome-camera.png",
  "ptz-camera.png",
  "bullet-camera.png",
  "thermal-camera.png",
];

// Device types organized by system category
export const DEVICE_TYPES_BY_CATEGORY = {
  cctv: [...CAMERA_TYPES, "custom-camera-icon.png"],
  access: [
    "access-system.png",
    "door-entry.png",
    "gates.png",
    "vehicle-entry.png",
    "turnstiles.png",
    "mobile-entry.png",
    "pir-icon.png",
    "card-reader.png",
    "lock-icon.png",
  ],
  intruder: [
    "intruder-alarm.png",
    "panic-alarm.png",
    "motion-detector.png",
    "infrared-sensors.png",
    "pressure-mat.png",
    "glass-contact.png",
  ],
  fire: [
    "fire-alarm.png",
    "fire-extinguisher.png",
    "fire-blanket.png",
    "emergency-exit.png",
    "assembly-point.png",
    "emergency-telephone.png",
  ],
  networks: [
    "Series.png",
    "panel-control.png",
    "Sensor.png",
    "interface-unit.png",
    "access-panel.png",
    "expander-connection.png",
    "dvr.png",
    "nvr.png",
  ],
  custom: ["custom-device-icon.png", "text-device"],
};

// Reverse lookup map: device type -> category
export const DEVICE_TYPE_LOOKUP = new Map(
  Object.entries(DEVICE_TYPES_BY_CATEGORY).flatMap(([category, types]) =>
    types.map((type) => [type.toLowerCase(), category])
  )
);

// Categories that can connect to any other category
export const UNIVERSAL_CONNECTION_CATEGORIES = new Set(["custom", "networks"]);

// User-friendly category labels for UI
export const CATEGORY_LABELS = {
  cctv: "CCTV",
  access: "Access",
  intruder: "Intruder",
  fire: "Fire",
  networks: "Network",
  custom: "Custom",
};

// Device types that support channel numbering (panels, DVRs, NVRs)
export const PANEL_DEVICE_TYPES = [
  "panel-control.png",
  "access-panel.png",
  "interface-unit.png",
  "dvr.png",
  "nvr.png",
];

// Device type to image path mapping for drag/drop
export const DEVICE_TYPE_TO_IMAGE = {
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
  gates: "./images/devices/gates.png",
  "vehicle-entry": "./images/devices/vehicle-entry.png",
  turnstiles: "./images/devices/turnstiles.png",
  "mobile-entry": "./images/devices/mobile-entry.png",
  pir: "./images/devices/pir-icon.png",
  "card-reader": "./images/devices/card-reader.png",
  lock: "./images/devices/lock-icon.png",

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
  Series: "./images/devices/Series.png",
  "panel-control": "./images/devices/panel-control.png",
  Sensor: "./images/devices/Sensor.png",
  "interface-unit": "./images/devices/interface-unit.png",
  "access-panel": "./images/devices/access-panel.png",
  "expander-connection": "./images/devices/expander-connection.png",
  dvr: "./images/devices/dvr.png",
  nvr: "./images/devices/nvr.png",
};

// Map from .png filename to image path (for serialization)
export const IMAGE_MAP = Object.fromEntries(
  CAMERA_TYPES.map((type) => [type, `./images/devices/${type}`])
);

// Checks if a device type is a camera
export function isCameraType(deviceType) {
  if (!deviceType) return false;
  const cleaned = deviceType.split(/[/\\]/).pop()?.toLowerCase() || "";
  return CAMERA_TYPES.some((ct) => ct.toLowerCase() === cleaned) || cleaned.includes("camera");
}

// Gets the category for a device
export function getDeviceCategory(device) {
  if (!device) return "custom";
  if (device.coverageConfig) return "cctv";
  const rawType = typeof device.deviceType === "string" ? device.deviceType : "";
  const cleaned = rawType.split(/[/\\]/).pop()?.toLowerCase() || "";
  return DEVICE_TYPE_LOOKUP.get(cleaned) || "custom";
}

// Checks if a device is a panel type
export function isPanelDevice(device) {
  if (!device?.deviceType) return false;
  const rawType = typeof device.deviceType === "string" ? device.deviceType : "";
  const cleaned = rawType.split(/[/\\]/).pop() || "";
  return PANEL_DEVICE_TYPES.includes(cleaned);
}

// Checks if two device categories can be connected
export function areCategoriesCompatible(catA, catB) {
  if (!catA || !catB || catA === catB) return true;
  return UNIVERSAL_CONNECTION_CATEGORIES.has(catA) || UNIVERSAL_CONNECTION_CATEGORIES.has(catB);
}

