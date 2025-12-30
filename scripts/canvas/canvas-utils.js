// Canvas utilities - shared helper functions for canvas operations

// Get the center point of the canvas viewport
export function getCanvasCenter(canvas) {
  return {
    x: canvas.getWidth() / 2,
    y: canvas.getHeight() / 2,
  };
}

// Convert screen coordinates to canvas coordinates
export function screenToCanvas(canvas, screenX, screenY) {
  const point = new fabric.Point(screenX, screenY);
  return fabric.util.transformPoint(point, canvas.viewportTransform);
}

// Check if a point is within canvas bounds
export function isPointInCanvas(canvas, point) {
  return (
    point.x >= 0 && point.x <= canvas.getWidth() && point.y >= 0 && point.y <= canvas.getHeight()
  );
}

// Get all objects of a specific type from canvas
export function getObjectsByType(canvas, type) {
  return canvas.getObjects().filter((obj) => obj.type === type);
}

// Calculate distance between two points
export function getDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}

// Debounce function calls
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
