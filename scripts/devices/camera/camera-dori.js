import { layers } from "../../canvas/interactions/LayerControls.js";
import { angleDiff } from "./camera-calculations.js";

// Calculates DORI distances based on resolution and FOV
export function calculateDoriDistances(camera) {
  if (!camera.resolution) return null;

  let widthPixels = 1920; // Default fallback

  // Handle WxH format like 1920x1080
  if (camera.resolution.toLowerCase().includes("x")) {
    const parts = camera.resolution.toLowerCase().split("x");
    const dimension1 = parseInt(parts[0]);
    const dimension2 = parseInt(parts[1]);

    if (!isNaN(dimension1) && !isNaN(dimension2)) {
      // Use smaller dimension for corridor mode width
      if (camera.coverageConfig.aspectRatioMode) {
        widthPixels = Math.min(dimension1, dimension2);
      } else {
        widthPixels = Math.max(dimension1, dimension2);
      }
    }
  }
  // Handle MP format like 2MP
  else if (camera.resolution.toLowerCase().includes("mp")) {
    const megapixels = parseFloat(camera.resolution);
    if (!isNaN(megapixels)) {
      // Calculate width based on aspect ratio
      const ratio = camera.coverageConfig.aspectRatioMode ? 9 / 16 : 16 / 9;
      widthPixels = Math.sqrt(megapixels * 1000000 * ratio);
    }
  }

  // Calculate horizontal FOV in radians
  const angleSpan = angleDiff(camera.coverageConfig.startAngle, camera.coverageConfig.endAngle);
  const fovRad = fabric.util.degreesToRadians(angleSpan);

  // IEC 62676-4 Standard PPM thresholds
  const ppm = {
    detection: 25,
    observation: 62.5,
    recognition: 125,
    identification: 250,
  };

  // Calculate distances using resolution and FOV
  const tanHalfFov = Math.tan(fovRad / 2);

  // Avoid division by zero
  if (tanHalfFov <= 0.001) return null;

  return {
    detection: widthPixels / (2 * ppm.detection * tanHalfFov),
    observation: widthPixels / (2 * ppm.observation * tanHalfFov),
    recognition: widthPixels / (2 * ppm.recognition * tanHalfFov),
    identification: widthPixels / (2 * ppm.identification * tanHalfFov),
  };
}

// Chooses the right dash pattern for the coverage edge
const getStrokeDashArray = (edgeStyle) => (edgeStyle === "dashed" ? [10, 5] : edgeStyle === "dotted" ? [2, 2] : null);

// Creates visual zones for DORI levels
export function createDoriZones(cameraIcon, fabricCanvas, commonProps) {
  const doriZones = [];
  const distances = calculateDoriDistances(cameraIcon);

  if (distances) {
    const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    const maxRange = cameraIcon.coverageConfig.radius / pixelsPerMeter;
    const currentMinRange = cameraIcon.coverageConfig.minRange || 0;
    const center = cameraIcon.getCenterPoint();
    const edgeStyle = cameraIcon.coverageConfig.edgeStyle || "solid";

    // Calculate final opacity based on slider and layer settings
    const opacitySlider = document.getElementById("camera-opacity-slider");
    let opacity = cameraIcon.coverageConfig.opacity ?? (opacitySlider ? parseFloat(opacitySlider.value) : 0.3);
    if (isNaN(opacity) || opacity < 0) opacity = 0.3;
    const finalOpacity = opacity * layers.devices.opacity;

    // Define colors for each DORI zone
    const zones = [
      {
        name: "detection",
        dist: distances.detection,
        color: `rgba(186, 225, 255, ${finalOpacity})`,
      },
      {
        name: "observation",
        dist: distances.observation,
        color: `rgba(186, 255, 201, ${finalOpacity})`,
      },
      {
        name: "recognition",
        dist: distances.recognition,
        color: `rgba(255, 255, 186, ${finalOpacity})`,
      },
      {
        name: "identification",
        dist: distances.identification,
        color: `rgba(255, 179, 186, ${finalOpacity})`,
      },
    ];

    // Sort by distance descending to draw largest zones first
    zones.sort((a, b) => b.dist - a.dist);

    zones.forEach((zone) => {
      // Clip zone to the maximum camera range
      const radiusMeters = Math.min(zone.dist, maxRange);
      if (radiusMeters <= 0.1) return;

      const radiusPixels = radiusMeters * pixelsPerMeter;

      // Skip if zone is entirely within the deadzone
      if (radiusPixels <= currentMinRange) return;

      // Create polygon points for the coverage area
      const { startAngle, endAngle } = cameraIcon.coverageConfig;
      const points = cameraIcon.createCoveragePoints(startAngle, endAngle, center.x, center.y, radiusPixels);

      // Create the fabric polygon for the zone
      const poly = new fabric.Polygon(points, {
        ...commonProps,
        strokeWidth: 1,
        stroke: "rgba(0,0,0,0.1)",
        strokeDashArray: getStrokeDashArray(edgeStyle),
        visible: cameraIcon.coverageConfig.visible && layers.devices.visible,
        fill: zone.color,
        isCoverage: true,
        evented: false,
        selectable: false,
      });
      doriZones.push(poly);
    });
  }
  return doriZones;
}
