// Handles geometric and physical calculations for camera coverage and FOV
import { layers } from "../../canvas/interactions/LayerControls.js";
import { DEFAULT_PIXELS_PER_METER } from "../../sidebar/sidebar-utils.js";

// Calculate the angular difference between two points in degrees
export const angleDiff = (start, end) => (end - start + 360) % 360 || 360;

// Calculate the Euclidean distance between two coordinate points
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Normalize a 2D vector to a unit length of 1
export const normalize = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

// Find the intersection point of two line segments if it exists
export const lineIntersect = (p1, p2, p3, p4) => {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-10) return null;
  const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
    return {
      x: p1.x + uA * (p2.x - p1.x),
      y: p1.y + uA * (p2.y - p1.y),
    };
  }
  return null;
};

// Convert degrees to radians for trigonometric functions
const toRad = (deg) => deg * (Math.PI / 180);

// Generate the polygon points for a camera's coverage area, accounting for walls
export function createCoveragePoints(walls, camera, startAngle, endAngle, centerX, centerY, overrideRadius) {
  const span = angleDiff(startAngle, endAngle);
  const isFullCircle = span >= 359.9;
  const points = [];
  const center = { x: centerX, y: centerY };

  const maxRadius = overrideRadius !== undefined ? overrideRadius : camera.coverageConfig.radius;
  let minRadius = camera.coverageConfig.minRange || 0;

  const projectionMode = camera.coverageConfig.projectionMode || "circular";
  const midAngle = startAngle + span / 2;

  // Determine ray density based on the field of view span
  const numRays = Math.max(isFullCircle ? 90 : Math.ceil(span / 3), 16);
  const step = (isFullCircle ? 360 : span) / numRays;

  const rayDistances = [];

  // Generate the outer boundary of the coverage area
  for (let i = 0; i <= numRays; i++) {
    const angle = (isFullCircle ? 0 : startAngle) + i * step;
    const radians = toRad(angle % 360);

    let radius = maxRadius;

    // Adjust radius for rectangular projection to create flat edges
    if (!isFullCircle && projectionMode === "rectangular" && span < 170 && Math.abs(maxRadius) > 0.01) {
      const diffRad = toRad(angle - midAngle);

      if (Math.abs(diffRad) < 1.4) {
        const cosVal = Math.cos(diffRad);
        if (Math.abs(cosVal) > 0.1) {
          radius = maxRadius / cosVal;
        }
      }
    }

    const rayEnd = {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    };

    let closest = null;
    let minDist = Infinity;

    // Check for wall collisions along the current ray
    for (const wall of walls) {
      const intersection = lineIntersect(center, rayEnd, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });

      if (intersection) {
        const dist = distance(center, intersection);
        if (dist < minDist && dist <= Math.abs(radius)) {
          minDist = dist;
          closest = intersection;
        }
      }
    }

    points.push(closest || rayEnd);
    rayDistances.push(closest ? minDist : radius);
  }

  // Generate the inner boundary (dead zone) to close the polygon
  if (!isFullCircle) {
    if (minRadius <= 0 || Math.abs(minRadius) < 0.1) {
      points.push(center);
    } else {
      for (let i = numRays; i >= 0; i--) {
        const angle = startAngle + i * step;
        const radians = toRad(angle % 360);
        let radius = minRadius;

        // Adjust inner radius for rectangular projection
        if (projectionMode === "rectangular" && span < 170) {
          const diffRad = toRad(angle - midAngle);
          if (Math.abs(diffRad) < 1.4) {
            const cosVal = Math.cos(diffRad);
            if (Math.abs(cosVal) > 0.1) {
              radius = minRadius / cosVal;
            }
          }
        }

        // Ensure dead zone doesn't extend beyond wall collisions
        if (radius > 0 && radius > rayDistances[i]) {
          radius = rayDistances[i];
        }

        points.push({
          x: centerX + radius * Math.cos(radians),
          y: centerY + radius * Math.sin(radians),
        });
      }
    }
  }

  return points;
}

// Calculate physical range and dead zone based on camera height and tilt
export function calculateCameraPhysics(activeObject) {
  if (!activeObject || !activeObject.coverageConfig) return null;

  const height = activeObject.coverageConfig.cameraHeight || 3;
  const tilt = activeObject.coverageConfig.cameraTilt ?? 45;
  const fabricCanvas = activeObject.canvas;
  const pixelsPerMeter = fabricCanvas?.pixelsPerMeter || DEFAULT_PIXELS_PER_METER;

  const config = activeObject.coverageConfig;
  const fov = config.sideFOV || config.cameraFov || 60;
  const halfFov = fov / 2;

  // Calculate the maximum ground distance visible at the top of the FOV
  let maxDist = 10000;
  const topAngleDeg = tilt - halfFov;

  if (topAngleDeg > 0) {
    maxDist = height / Math.tan((topAngleDeg * Math.PI) / 180);
  }

  // Calculate the minimum ground distance (dead zone) at the bottom of the FOV
  const bottomRayAngleDeg = tilt + halfFov;
  const bottomRayAngleRad = (bottomRayAngleDeg * Math.PI) / 180;

  let minRange = 0;
  const tanVal = Math.tan(bottomRayAngleRad);

  if (Math.abs(tanVal) < 1e-10) {
    minRange = tanVal >= 0 ? 10000 : -10000;
  } else {
    minRange = height / tanVal;
  }

  return {
    minRangeMeters: minRange,
    maxDistMeters: maxDist,
    pixelsPerMeter,
  };
}

// Apply calculated physical ranges to the camera object's configuration
export function applyCameraPhysics(activeObject) {
  const physics = calculateCameraPhysics(activeObject);
  if (!physics) return null;

  const { minRangeMeters, maxDistMeters, pixelsPerMeter } = physics;

  const height = activeObject.coverageConfig.cameraHeight || 3;
  const tilt = activeObject.coverageConfig.cameraTilt ?? 45;
  const config = activeObject.coverageConfig;
  const fov = config.sideFOV || config.cameraFov || 60;
  const halfFov = fov / 2;
  const bottomRayAngleDeg = tilt + halfFov;

  // Clamp dead zone to 0 if the camera is looking straight down
  const clampedMinRangeMeters = bottomRayAngleDeg >= 90 ? 0 : minRangeMeters;

  activeObject.coverageConfig.minRange = clampedMinRangeMeters * pixelsPerMeter;

  const maxRange = activeObject.coverageConfig.maxRange || 50;
  const clampedRadiusMeters = Math.min(maxDistMeters, maxRange);

  activeObject.coverageConfig.radius = clampedRadiusMeters * pixelsPerMeter;

  return {
    minRangeMeters,
    clampedRadiusMeters,
  };
}

// Physical dimensions of common camera sensor sizes in millimeters
export const sensorDimensions = {
  "1/1.1": { width: 12.68, height: 7.13 },
  "1/1.2": { width: 11.62, height: 6.54 },
  "2/3": { width: 9.35, height: 23 },
  "1/1.6": { width: 8.72, height: 4.9 },
  "1/1.7": { width: 8.2, height: 4.61 },
  "1/1.8": { width: 7.75, height: 4.36 },
  "1/1.9": { width: 7.34, height: 4.13 },
  "1/2.0": { width: 6.97, height: 3.92 },
  "1/2.3": { width: 6.82, height: 3.84 },
  "1/2.5": { width: 6.28, height: 3.53 },
  "1/2.7": { width: 5.81, height: 3.27 },
  "1/2.8": { width: 5.6, height: 3.15 },
  "1/2.9": { width: 5.41, height: 3.04 },
  "1/3.0": { width: 5.23, height: 2.94 },
  "1/3.2": { width: 4.9, height: 2.76 },
  "1/3.4": { width: 4.61, height: 2.6 },
  "1/3.6": { width: 4.36, height: 2.45 },
  "1/4.0": { width: 3.92, height: 2.21 },
  "1/5.0": { width: 3.14, height: 1.76 },
  "1/6.0": { width: 2.61, height: 1.47 },
  "1/7.5": { width: 2.09, height: 1.18 },
};

// Calculate horizontal and vertical FOV based on focal length and sensor size
export const calculateFOV = (focalLength, sensorSize) => {
  const focal = parseFloat(focalLength.toString().replace("mm", "").trim());
  if (!focal || focal <= 0) return null;

  const sensor = sensorDimensions[sensorSize];
  if (!sensor) return null;

  const horizontalFOV = 2 * Math.atan(sensor.width / (2 * focal)) * (180 / Math.PI);
  const verticalFOV = 2 * Math.atan(sensor.height / (2 * focal)) * (180 / Math.PI);

  return { horizontal: horizontalFOV, vertical: verticalFOV };
};

// Determine plan and side view angles based on sensor orientation and FOV
export const calculateCameraAngles = (focalLength, sensorSize, isAspectRatio) => {
  const fov = calculateFOV(focalLength, sensorSize);
  if (!fov) return null;

  let planAngle, sideAngle;

  if (isAspectRatio) {
    planAngle = Math.round(fov.vertical);
    sideAngle = fov.horizontal;
  } else {
    planAngle = Math.round(fov.horizontal);
    sideAngle = fov.vertical;
  }

  return {
    planAngle,
    sideAngle,
    verticalFOV: fov.vertical,
    horizontalFOV: fov.horizontal,
  };
};

// Update camera coverage parameters based on hardware specifications
export const updateCameraFromSpecs = (camera) => {
  if (!camera || !camera.coverageConfig) return null;

  const focalLength = camera.focalLength || "";
  const sensorSize = camera.sensorSize || "1/2.0";
  const isAspectRatio = camera.coverageConfig.aspectRatioMode || false;

  if (!focalLength) return null;

  const angles = calculateCameraAngles(focalLength, sensorSize, isAspectRatio);
  if (!angles) return null;

  const { planAngle, sideAngle, verticalFOV } = angles;

  camera.coverageConfig.sideFOV = sideAngle;
  camera.coverageConfig.verticalFOV = verticalFOV;
  camera.coverageConfig.calculatedAngle = planAngle;

  const start = camera.coverageConfig.startAngle;
  const end = camera.coverageConfig.endAngle;
  const diff = camera.angleDiff(start, end);
  const midAngle = (start + diff / 2) % 360;

  camera.coverageConfig.startAngle = (midAngle - planAngle / 2 + 360) % 360;
  camera.coverageConfig.endAngle = (midAngle + planAngle / 2) % 360;

  if (planAngle >= 359) {
    camera.coverageConfig.startAngle = 0;
    camera.coverageConfig.endAngle = 360;
  }

  camera.coverageConfig.isInitialized = true;
  if (camera.createOrUpdateCoverageArea) camera.createOrUpdateCoverageArea();

  return planAngle;
};
