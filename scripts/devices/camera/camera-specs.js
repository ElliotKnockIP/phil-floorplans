// Maps sensor sizes to their actual dimensions in millimeters
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

// Figures out how wide and tall the camera can see based on focal length and sensor size
export const calculateFOV = (focalLength, sensorSize) => {
  // Remove "mm" text if present
  const focal = parseFloat(focalLength.toString().replace("mm", "").trim());
  if (!focal || focal <= 0) return null;

  const sensor = sensorDimensions[sensorSize];
  if (!sensor) return null;

  // Calculate how wide and tall the view is
  const horizontalFOV = 2 * Math.atan(sensor.width / (2 * focal)) * (180 / Math.PI);
  const verticalFOV = 2 * Math.atan(sensor.height / (2 * focal)) * (180 / Math.PI);

  return { horizontal: horizontalFOV, vertical: verticalFOV };
};

// Calculates camera angles (plan and side) based on specs
export const calculateCameraAngles = (focalLength, sensorSize, isAspectRatio) => {
  const fov = calculateFOV(focalLength, sensorSize);
  if (!fov) return null;

  let planAngle, sideAngle;

  if (isAspectRatio) {
    // Aspect Ratio Mode: Sensor rotated 90 degrees
    // Plan View (Horizontal on map) uses the sensor's Vertical dimension (narrower)
    planAngle = Math.round(fov.vertical);
    // Side View (Vertical on map) uses the sensor's Horizontal dimension (taller)
    sideAngle = fov.horizontal;
  } else {
    // Standard Mode
    // Plan View uses sensor's Horizontal dimension
    planAngle = Math.round(fov.horizontal);
    // Side View: Standard physics uses Vertical dimension (narrower)
    sideAngle = fov.vertical;
  }

  return {
    planAngle,
    sideAngle,
    verticalFOV: fov.vertical,
    horizontalFOV: fov.horizontal,
  };
};

// Updates the camera coverage angle when focal length or sensor size changes
export const updateCameraFromSpecs = (camera) => {
  if (!camera || !camera.coverageConfig) return null;

  const focalLength = camera.focalLength || "";
  const sensorSize = camera.sensorSize || "1/2.0";
  const isAspectRatio = camera.coverageConfig.aspectRatioMode || false;

  if (!focalLength) return null;

  const angles = calculateCameraAngles(focalLength, sensorSize, isAspectRatio);
  if (!angles) return null;

  const { planAngle, sideAngle, verticalFOV } = angles;

  // Store sideFOV for the coverage panel to use
  camera.coverageConfig.sideFOV = sideAngle;
  // Also store verticalFOV for backward compatibility or reference
  camera.coverageConfig.verticalFOV = verticalFOV;
  // Store the calculated plan angle for warning comparison
  camera.coverageConfig.calculatedAngle = planAngle;

  const midAngle = (camera.coverageConfig.startAngle + camera.angleDiff(camera.coverageConfig.startAngle, camera.coverageConfig.endAngle) / 2) % 360;

  camera.coverageConfig.startAngle = (midAngle - planAngle / 2 + 360) % 360;
  camera.coverageConfig.endAngle = (midAngle + planAngle / 2) % 360;

  // Full circle if angle is large enough
  if (planAngle >= 359) {
    camera.coverageConfig.startAngle = 0;
    camera.coverageConfig.endAngle = 360;
  }

  camera.coverageConfig.isInitialized = true;
  if (camera.createOrUpdateCoverageArea) camera.createOrUpdateCoverageArea();

  return planAngle;
};
