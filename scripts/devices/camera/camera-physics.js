import { DEFAULT_PIXELS_PER_METER } from "../../sidebar/sidebar-utils.js";

// Calculates camera physics parameters (min range, max distance) based on height, tilt, and FOV
export function calculateCameraPhysics(activeObject) {
  if (!activeObject || !activeObject.coverageConfig) return null;

  const height = activeObject.coverageConfig.cameraHeight || 3;
  const tilt = activeObject.coverageConfig.cameraTilt ?? 25;
  const fabricCanvas = activeObject.canvas;
  const pixelsPerMeter = fabricCanvas?.pixelsPerMeter || DEFAULT_PIXELS_PER_METER;

  // Use sideFOV if available (calculated by spec panel), otherwise fallback to Plan Angle
  const horizontalFov = activeObject.coverageConfig.sideFOV || (activeObject.angleDiff ? activeObject.angleDiff(activeObject.coverageConfig.startAngle, activeObject.coverageConfig.endAngle) : 60);
  const fov = horizontalFov;
  const halfFov = fov / 2;

  // 1. Calculate Max Distance (Horizon)
  // This is where the TOP ray of the camera view hits the ground.
  // Angle from horizontal = tilt - halfFov
  let maxDist = 10000; // Default large value for infinite range
  const topAngleDeg = tilt - halfFov;

  if (topAngleDeg > 0) {
    // If looking down, calculate intersection with ground
    // Distance = Height / tan(angle)
    maxDist = height / Math.tan((topAngleDeg * Math.PI) / 180);
  }
  // If topAngleDeg <= 0, the camera is looking parallel to ground or up, so range is "infinite"

  // 2. Calculate Dead Zone (Min Range)
  // This is where the BOTTOM ray of the camera view hits the ground.
  let minRange = 0;
  // Angle from horizontal = tilt + halfFov
  const bottomRayAngleRad = ((tilt + halfFov) * Math.PI) / 180;

  // Handle tan near zero (horizontal ray) to avoid infinity
  const tanVal = Math.tan(bottomRayAngleRad);

  if (Math.abs(tanVal) < 1e-10) {
    minRange = tanVal >= 0 ? 10000 : -10000; // Infinite positive or negative distance
  } else {
    minRange = height / tanVal;
  }

  return {
    minRangeMeters: minRange,
    maxDistMeters: maxDist,
    pixelsPerMeter,
  };
}

// Applies calculated physics to the camera object
export function applyCameraPhysics(activeObject) {
  const physics = calculateCameraPhysics(activeObject);
  if (!physics) return null;

  const { minRangeMeters, maxDistMeters, pixelsPerMeter } = physics;

  // Store minRange in pixels
  activeObject.coverageConfig.minRange = minRangeMeters * pixelsPerMeter;

  // Clamp to max distance (e.g. 500m) or user's maxRange setting
  const maxRange = activeObject.coverageConfig.maxRange || 50;
  const clampedRadiusMeters = Math.min(maxDistMeters, maxRange);

  activeObject.coverageConfig.radius = clampedRadiusMeters * pixelsPerMeter;

  return {
    minRangeMeters,
    clampedRadiusMeters,
  };
}
