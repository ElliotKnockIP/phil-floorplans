import { createOrUpdateCoverageArea } from "./camera-resize-rotate.js";

export function addCameraCoverage(fabricCanvas, cameraIcon) {
  // Initialize coverageConfig only if it doesn't exist
  cameraIcon.coverageConfig = cameraIcon.coverageConfig || {};
  const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;

  // Set defaults only if not already defined
  cameraIcon.coverageConfig.radius = cameraIcon.coverageConfig.radius || 10 * pixelsPerMeter;
  cameraIcon.coverageConfig.fillColor = cameraIcon.coverageConfig.fillColor || "rgba(165, 155, 155, 0.3)";
  // Derive and persist a baseColor (without alpha) so opacity math isn't compounded on redo / drag updates
  if (!cameraIcon.coverageConfig.baseColor) {
    const match = cameraIcon.coverageConfig.fillColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) {
      const [, r, g, b] = match;
      cameraIcon.coverageConfig.baseColor = `rgb(${r}, ${g}, ${b})`;
    } else {
      cameraIcon.coverageConfig.baseColor = "rgb(165, 155, 155)";
    }
  }
  cameraIcon.coverageConfig.startAngle = cameraIcon.coverageConfig.startAngle !== undefined ? cameraIcon.coverageConfig.startAngle : 270;
  cameraIcon.coverageConfig.endAngle = cameraIcon.coverageConfig.endAngle !== undefined ? cameraIcon.coverageConfig.endAngle : 0;
  cameraIcon.coverageConfig.visible = cameraIcon.coverageConfig.visible !== undefined ? cameraIcon.coverageConfig.visible : true;
  cameraIcon.coverageConfig.edgeStyle = cameraIcon.coverageConfig.edgeStyle || "solid";
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

  // Distance helpers
  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalize(vx, vy) {
    const len = Math.hypot(vx, vy) || 1;
    return { x: vx / len, y: vy / len, len };
  }

  function closestPointOnRayToPoint(rayOrigin, rayDirUnit, point) {
    const vx = point.x - rayOrigin.x;
    const vy = point.y - rayOrigin.y;
    const t = vx * rayDirUnit.x + vy * rayDirUnit.y; // projection length along ray
    return {
      t,
      point: { x: rayOrigin.x + rayDirUnit.x * t, y: rayOrigin.y + rayDirUnit.y * t },
      dist: Math.abs(vx * rayDirUnit.y - vy * rayDirUnit.x), // perpendicular distance to ray line
    };
  }

  // Robust intersection that accounts for wall stroke thickness and near-miss at endpoints
  function getThickIntersection(p1, p2, p3, p4, wallStroke = 2, maxRange = Infinity) {
    // First try exact segment intersection
    const inter = getLineIntersection(p1, p2, p3, p4);
    if (inter) return inter;

    // Fallback: treat walls as thick by allowing a small tolerance around endpoints
    const eps = wallStroke / 2 + 1.2; // half stroke + small buffer
    const dir = normalize(p2.x - p1.x, p2.y - p1.y);
    let best = null;
    let bestDist = Infinity;
    // Check both endpoints of wall segment
    [p3, p4].forEach((endpoint) => {
      const { t, point, dist: perp } = closestPointOnRayToPoint(p1, { x: dir.x, y: dir.y }, endpoint);
      if (t >= 0 && t <= maxRange && perp <= eps) {
        const d = distance(p1, point);
        if (d < bestDist) {
          bestDist = d;
          best = point;
        }
      }
    });
    return best;
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
    const numPoints = Math.max(isFullCircle ? 180 : Math.ceil(actualSpan / 2), 20);
    const angleStep = actualSpan / numPoints;

    const walls = fabricCanvas.getObjects("line").filter((line) => line.isWallLine || line.startCircle || line.endCircle);

    for (let i = 0; i <= numPoints; i++) {
      const angle = actualStartAngle + i * angleStep;
      const rad = fabric.util.degreesToRadians(angle % 360);
      const rayEnd = {
        x: camCenterX + cameraIcon.coverageConfig.radius * 2 * Math.cos(rad),
        y: camCenterY + cameraIcon.coverageConfig.radius * 2 * Math.sin(rad),
      };

      // Precompute ray direction unit for endpoint tolerance checks
      const rayDir = normalize(rayEnd.x - camCenterX, rayEnd.y - camCenterY);

      let closestPoint = null;
      let minDist = Infinity;

      // Check wall intersections even for full circle
      for (const wall of walls) {
        const p1 = camCenter;
        const p2 = rayEnd;
        const p3 = { x: wall.x1, y: wall.y1 };
        const p4 = { x: wall.x2, y: wall.y2 };
        const wallStroke = wall.strokeWidth || 2;
        const intersection = getThickIntersection(p1, p2, p3, p4, wallStroke, cameraIcon.coverageConfig.radius);

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

// Utility to normalize all existing camera coverage areas (e.g. after loading project or fixing legacy compounded alpha)
export function normalizeAllCameraCoverage(fabricCanvas) {
  const cameras = fabricCanvas.getObjects().filter((o) => o.type === "group" && o.deviceType && o.coverageConfig);
  cameras.forEach((cam) => {
    if (!cam.coverageConfig) return;
    // Extract base color from current fill (strip alpha)
    const match = (cam.coverageConfig.fillColor || "").match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) {
      const [, r, g, b] = match;
      cam.coverageConfig.baseColor = `rgb(${r}, ${g}, ${b})`;
    }
    // Ensure logical opacity is not compounded (cap between 0 and 1)
    if (cam.coverageConfig.opacity === undefined) {
      // Attempt to infer from fill alpha
      const alphaMatch = (cam.coverageConfig.fillColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/i);
      if (alphaMatch) {
        const alpha = parseFloat(alphaMatch[1]);
        if (!isNaN(alpha)) cam.coverageConfig.opacity = Math.min(1, Math.max(0, alpha));
      } else {
        cam.coverageConfig.opacity = 0.3;
      }
    }
    // Force a lightweight update
    if (cam.createOrUpdateCoverageArea) cam.createOrUpdateCoverageArea();
  });
  fabricCanvas.requestRenderAll();
}
