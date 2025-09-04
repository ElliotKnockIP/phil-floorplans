import { createOrUpdateCoverageArea } from "./camera-resize-rotate.js";

export function addCameraCoverage(fabricCanvas, cameraIcon) {
  // Initialize coverageConfig only if it doesn't exist
  cameraIcon.coverageConfig = cameraIcon.coverageConfig || {};
  const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;

  // Set defaults only if not already defined
  cameraIcon.coverageConfig.radius = cameraIcon.coverageConfig.radius || 10 * pixelsPerMeter;
  cameraIcon.coverageConfig.fillColor = cameraIcon.coverageConfig.fillColor || "rgba(165, 155, 155, 0.3)";
  cameraIcon.coverageConfig.startAngle = cameraIcon.coverageConfig.startAngle !== undefined ? cameraIcon.coverageConfig.startAngle : 270;
  cameraIcon.coverageConfig.endAngle = cameraIcon.coverageConfig.endAngle !== undefined ? cameraIcon.coverageConfig.endAngle : 0;
  cameraIcon.coverageConfig.visible = cameraIcon.coverageConfig.visible !== undefined ? cameraIcon.coverageConfig.visible : true;
  cameraIcon.coverageConfig.isInitialized = true;

  // Calculate angle difference
  function angleDiff(start, end) {
    let diff = (end - start + 360) % 360;
    // If initialized and angles are equal, assume full circle if previously set to 360
    if (cameraIcon.coverageConfig.isInitialized && diff === 0 && (start === end || Math.abs(end - start) % 360 === 0)) {
      return 360;
    }
    return diff;
  }

  // Calculate line intersection
  function getLineIntersection(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-10) return null;

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      const x = p1.x + ua * (p2.x - p1.x);
      const y = p1.y + ua * (p2.y - p1.y);
      return { x, y };
    }
    return null;
  }

  // Create points for coverage area
  function createCoveragePoints(startAngle, endAngle, camCenterX, camCenterY) {
    const angularSpan = angleDiff(startAngle, endAngle);
    const isFullCircle = angularSpan >= 359.9;

    const points = [];
    const camCenter = { x: camCenterX, y: camCenterY };

    // Always add center point for partial coverage
    if (!isFullCircle) {
      points.push(camCenter);
    }

    let adjustedEndAngle = endAngle;
    if (endAngle <= startAngle && !isFullCircle) adjustedEndAngle += 360;

    // For full circle, use 360 degrees of coverage but still check for walls
    const actualSpan = isFullCircle ? 360 : angularSpan;
    const actualStartAngle = isFullCircle ? 0 : startAngle;
    const numPoints = Math.max(isFullCircle ? 100 : 10, Math.ceil(actualSpan / 3));
    const angleStep = actualSpan / numPoints;

    const walls = fabricCanvas.getObjects("line").filter((line) => line.stroke === "red");

    for (let i = 0; i <= numPoints; i++) {
      const angle = actualStartAngle + i * angleStep;
      const rad = fabric.util.degreesToRadians(angle % 360);
      const rayEnd = {
        x: camCenterX + cameraIcon.coverageConfig.radius * 2 * Math.cos(rad),
        y: camCenterY + cameraIcon.coverageConfig.radius * 2 * Math.sin(rad),
      };

      let closestPoint = null;
      let minDist = Infinity;

      // Check wall intersections even for full circle
      for (const wall of walls) {
        const p1 = camCenter;
        const p2 = rayEnd;
        const p3 = { x: wall.x1, y: wall.y1 };
        const p4 = { x: wall.x2, y: wall.y2 };
        const intersection = getLineIntersection(p1, p2, p3, p4);

        if (intersection) {
          const dist = Math.hypot(intersection.x - camCenterX, intersection.y - camCenterY);
          if (dist < minDist && dist <= cameraIcon.coverageConfig.radius) {
            minDist = dist;
            closestPoint = intersection;
          }
        }
      }

      if (closestPoint) {
        points.push(closestPoint);
      } else {
        points.push({
          x: camCenterX + cameraIcon.coverageConfig.radius * Math.cos(rad),
          y: camCenterY + cameraIcon.coverageConfig.radius * Math.sin(rad),
        });
      }
    }

    return points;
  }

  cameraIcon.angleDiff = angleDiff;
  cameraIcon.createCoveragePoints = createCoveragePoints;

  createOrUpdateCoverageArea(fabricCanvas, cameraIcon);

  return { coverageArea: cameraIcon.coverageArea };
}
