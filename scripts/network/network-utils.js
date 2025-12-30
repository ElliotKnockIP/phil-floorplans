// Utility functions for geometric calculations.

// Calculate distance between two points
export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Calculate midpoint between two points
export function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// Find the exact middle point along a multi-segment path
export function pathMidpoint(points) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  // Calculate segment lengths and total
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = distance(points[i], points[i + 1]);
    lengths.push(len);
    total += len;
  }

  // Find the point at half the total length
  let accumulated = 0;
  const target = total / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (accumulated + lengths[i] >= target) {
      const ratio = (target - accumulated) / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    accumulated += lengths[i];
  }
  return points[points.length - 1];
}

// Calculate the shortest distance from a point to a line segment
export function distanceToSegment(point, segStart, segEnd) {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return distance(point, segStart);

  const t = Math.max(0, Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq));

  return distance(point, {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  });
}

// Find the best index to insert a new point into a path
export function findInsertIndex(points, newPoint) {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(newPoint, points[i], points[i + 1]);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Calculate total path length
export function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += distance(points[i], points[i + 1]);
  }
  return total;
}

// Get position along a path based on a ratio (0-1)
export function positionOnPath(points, ratio) {
  if (points.length < 2) return points[0] || { x: 0, y: 0 };

  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = distance(points[i], points[i + 1]);
    lengths.push(len);
    total += len;
  }

  if (total === 0) return points[0];

  const targetLen = ratio * total;
  let accumulated = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (accumulated + lengths[i] >= targetLen) {
      const segRatio = (targetLen - accumulated) / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * segRatio,
        y: points[i].y + (points[i + 1].y - points[i].y) * segRatio,
      };
    }
    accumulated += lengths[i];
  }
  return points[points.length - 1];
}

// Calculate where a point sits along a path as a ratio (0-1)
export function ratioOnPath(points, point) {
  if (points.length < 2) return 0;

  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = distance(points[i], points[i + 1]);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return 0;

  // Find closest segment
  let minDist = Infinity;
  let closestRatio = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(point, points[i], points[i + 1]);
    if (dist < minDist) {
      minDist = dist;

      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const segLen = lengths[i];

      if (segLen > 0) {
        const ratioAlongSeg = Math.max(0, Math.min(1, ((point.x - points[i].x) * dx + (point.y - points[i].y) * dy) / (segLen * segLen)));

        let lengthBefore = 0;
        for (let j = 0; j < i; j++) lengthBefore += lengths[j];
        closestRatio = (lengthBefore + ratioAlongSeg * segLen) / total;
      }
    }
  }
  return Math.max(0, Math.min(1, closestRatio));
}

// Clamp a point to stay within bounds
export function clampToBounds(point, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  };
}

// Calculate bounding box containing all points
export function computeBounds(points) {
  if (!points.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}
