// Calculates angle difference between two angles
export const angleDiff = (start, end) => (end - start + 360) % 360 || 360;

// Calculates distance between two points
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Normalizes a vector to unit length
export const normalize = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

// Finds intersection point between two lines
export const lineIntersect = (p1, p2, p3, p4) => {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-10) return null;
  const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
  return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1 ? { x: p1.x + uA * (p2.x - p1.x), y: p1.y + uA * (p2.y - p1.y) } : null;
};

// Helper for degrees to radians to avoid fabric dependency in pure math file
const toRad = (deg) => deg * (Math.PI / 180);

// Creates coverage area points with wall collision detection
export function createCoveragePoints(walls, camera, startAngle, endAngle, centerX, centerY, overrideRadius) {
  const span = angleDiff(startAngle, endAngle);
  const isFullCircle = span >= 359.9;
  const points = [];
  const center = { x: centerX, y: centerY };

  const maxRadius = overrideRadius !== undefined ? overrideRadius : camera.coverageConfig.radius;
  let minRadius = camera.coverageConfig.minRange || 0; // Can be negative

  const projectionMode = camera.coverageConfig.projectionMode || "circular";
  const midAngle = startAngle + span / 2;

  // Determine number of rays for smoothness
  // Full circle needs more rays (180), partial arcs use fewer but at least 20
  const numRays = Math.max(isFullCircle ? 180 : Math.ceil(span / 2), 20);
  const step = (isFullCircle ? 360 : span) / numRays;

  const rayDistances = [];

  // 1. Generate Outer Arc (Forward View)
  for (let i = 0; i <= numRays; i++) {
    const angle = (isFullCircle ? 0 : startAngle) + i * step;
    const radians = toRad(angle % 360);

    let radius = maxRadius;

    // --- Rectangular Projection Logic ---
    // If mode is rectangular, stretch the radius for rays further from the center
    // to create a flat edge instead of a curved arc.
    if (!isFullCircle && projectionMode === "rectangular" && span < 170 && Math.abs(maxRadius) > 0.01) {
      const diffRad = toRad(angle - midAngle);

      // Only apply correction within reasonable angular bounds (< 80 degrees from center)
      if (Math.abs(diffRad) < 1.4) {
        const cosVal = Math.cos(diffRad);
        if (Math.abs(cosVal) > 0.1) {
          // Radius = Distance to flat plane / cos(angle)
          radius = maxRadius / cosVal;
        }
      }
    }

    // Calculate the theoretical end point of the ray
    const rayEnd = {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    };

    // --- Wall Intersection (Ray Casting) ---
    let closest = null;
    let minDist = Infinity;

    // Check for wall intersections from Center to RayEnd
    for (const wall of walls) {
      const intersection = lineIntersect(center, rayEnd, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });

      if (intersection) {
        const dist = distance(center, intersection);
        // If this wall is closer than the current closest wall (and within the ray's length)
        if (dist < minDist && dist <= Math.abs(radius)) {
          minDist = dist;
          closest = intersection;
        }
      }
    }

    // Use the intersection point if a wall was hit, otherwise use the full ray length
    points.push(closest || rayEnd);
    rayDistances.push(closest ? minDist : radius);
  }

  // 2. Generate Inner Arc (Backward / Dead Zone)
  // Draw backwards from EndAngle to StartAngle to close the polygon shape.
  if (!isFullCircle) {
    if (Math.abs(minRadius) < 0.1) {
      // No dead zone, just return to center
      points.push(center);
    } else {
      // --- Inner Arc (Circular or Rectangular) ---
      // Generate arc points from End to Start for a curved or flat dead zone
      for (let i = numRays; i >= 0; i--) {
        const angle = startAngle + i * step;
        const radians = toRad(angle % 360);
        let radius = minRadius;

        // --- Rectangular Dead Zone Logic ---
        if (projectionMode === "rectangular" && span < 170) {
          const diffRad = toRad(angle - midAngle);
          // Only apply correction within reasonable angular bounds
          if (Math.abs(diffRad) < 1.4) {
            const cosVal = Math.cos(diffRad);
            if (Math.abs(cosVal) > 0.1) {
              radius = minRadius / cosVal;
            }
          }
        }

        // Clamp inner radius to outer radius (wall distance)
        // This prevents the dead zone from extending past walls
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
