import { angleDiff, createCoveragePoints } from "./camera-geometry.js";
import { setupCameraEvents } from "./camera-interaction.js";
import { updateCoverageDisplay } from "./camera-visuals.js";

// Initializes the camera configuration with default values
export function initConfig(camera, pixelsPerMeter) {
  const config = camera.coverageConfig || {};
  config.radius = config.radius || 10 * pixelsPerMeter;
  config.fillColor = config.fillColor || "rgba(165, 155, 155, 0.3)";

  // Extract base color from fill color
  if (!config.baseColor) {
    const match = config.fillColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    config.baseColor = match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : "rgb(165, 155, 155)";
  }

  config.startAngle = config.startAngle ?? 270;
  config.endAngle = config.endAngle ?? 0;
  config.visible = config.visible ?? true;
  config.edgeStyle = config.edgeStyle || "solid";
  config.cameraHeight = config.cameraHeight || 3;
  config.cameraTilt = config.cameraTilt ?? 25;
  config.cameraFov = config.cameraFov || 60;
  config.projectionMode = config.projectionMode || "circular";
  // Initialize maxRange with current radius or default 50m
  config.maxRange = config.maxRange !== undefined ? config.maxRange : config.radius ? config.radius / pixelsPerMeter : 50;
  // Auto-enable DORI if resolution is set and doriEnabled hasn't been explicitly set
  if (camera.resolution && config.doriEnabled === undefined) {
    config.doriEnabled = true;
  }
  config.isInitialized = true;

  camera.coverageConfig = config;
}

// Normalizes coverage configuration for all cameras on the canvas
export function normalizeAllCameraCoverage(fabricCanvas) {
  fabricCanvas
    .getObjects()
    .filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageConfig)
    .forEach((camera) => {
      if (!camera.coverageConfig) return;

      // Extract base color from fill color
      const match = (camera.coverageConfig.fillColor || "").match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (match) camera.coverageConfig.baseColor = `rgb(${match[1]}, ${match[2]}, ${match[3]})`;

      // Set opacity if not defined
      if (camera.coverageConfig.opacity === undefined) {
        const alphaMatch = (camera.coverageConfig.fillColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/i);
        camera.coverageConfig.opacity = alphaMatch ? Math.min(1, Math.max(0, parseFloat(alphaMatch[1]))) : 0.3;
      }

      if (camera.createOrUpdateCoverageArea) camera.createOrUpdateCoverageArea();
    });

  fabricCanvas.requestRenderAll();
}

// Adds camera coverage area to a camera device
export function addCameraCoverage(fabricCanvas, cameraIcon) {
  const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;

  // Initialize configuration
  initConfig(cameraIcon, pixelsPerMeter);

  // Attach utility functions to the camera icon
  cameraIcon.angleDiff = angleDiff;
  cameraIcon.createCoveragePoints = (start, end, x, y, r) => {
    const walls = fabricCanvas.getObjects("line").filter((line) => line.isWallLine || line.startCircle || line.endCircle);
    return createCoveragePoints(walls, cameraIcon, start, end, x, y, r);
  };

  // Define the update function
  const updateCoverage = () => {
    updateCoverageDisplay(fabricCanvas, cameraIcon);
  };

  // Attach the update function to the camera icon
  cameraIcon.createOrUpdateCoverageArea = updateCoverage;

  // Initial update
  updateCoverage();

  // Setup event handlers
  setupCameraEvents(fabricCanvas, cameraIcon, updateCoverage);

  return { coverageArea: cameraIcon.coverageArea };
}
