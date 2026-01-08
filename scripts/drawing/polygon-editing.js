// Enables edit mode for a polygon by creating draggable control points at each vertex.
export function enablePolygonEditing(fabricCanvas, polygon) {
  // Exit early if polygon is invalid or already has edit controls
  if (!polygon || !polygon.points || polygon.editControlPoints) return;

  // Keep controls visible above the active polygon
  if (fabricCanvas.editPreserveObjectStackingBackup === undefined) {
    fabricCanvas.editPreserveObjectStackingBackup = fabricCanvas.preserveObjectStacking;
    fabricCanvas.preserveObjectStacking = true;
  }

  // Setup double-click handler for adding control points on edges
  setupPolygonDoubleClick(fabricCanvas, polygon);

  // Get the transformation matrix to convert local coordinates to canvas coordinates
  const transformMatrix = polygon.calcTransformMatrix();

  // Create a draggable circle control for each vertex point of the polygon
  const controlPoints = polygon.points.map((point, index) => {
    const localPoint = new fabric.Point(point.x - polygon.pathOffset.x, point.y - polygon.pathOffset.y);
    const canvasPoint = fabric.util.transformPoint(localPoint, transformMatrix);

    // Create a small circle to represent the control point
    const controlCircle = new fabric.Circle({
      left: canvasPoint.x,
      top: canvasPoint.y,
      radius: 5,
      fill: polygon.stroke || "#f8794b",
      stroke: "white",
      strokeWidth: 2,
      hasControls: false,
      hasBorders: false,
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      hoverCursor: "move",
      data: { index: index, polygon: polygon }, // Store reference data
    });

    // When the control circle is moved, update the polygons shape
    controlCircle.on("moving", (event) => {
      handleControlMove(fabricCanvas, polygon, index, controlCircle);
    });

    // Add control circle to canvas and bring it to the front
    fabricCanvas.add(controlCircle);
    controlCircle.bringToFront();
    return controlCircle;
  });

  // Store the control points on the polygon for later reference
  polygon.editControlPoints = controlPoints;

  // Ensure controls are always on top of other objects
  raiseControls(polygon);
  setTimeout(() => raiseControls(polygon), 0);

  // Track which polygon is currently being edited
  fabricCanvas.currentEditedPolygon = polygon;

  // Create event handler to update control positions when polygon is transformed
  polygon.updateControlsHandler = () => updateControls(polygon);
  polygon.on("moving", polygon.updateControlsHandler);
  polygon.on("modified", polygon.updateControlsHandler);

  fabricCanvas.requestRenderAll();
}

// Disables edit mode for a polygon by removing all control points
export function disablePolygonEditing(fabricCanvas, polygon) {
  // Exit early if polygon doesn't have edit controls
  if (!polygon || !polygon.editControlPoints) return;

  // Remove event listeners
  if (polygon.updateControlsHandler) {
    polygon.off("moving", polygon.updateControlsHandler);
    polygon.off("modified", polygon.updateControlsHandler);
    delete polygon.updateControlsHandler;
  }

  // Remove double-click handler
  if (polygon._dblClickHandler) {
    polygon.off("mousedown", polygon._dblClickHandler);
    delete polygon._dblClickHandler;
  }

  // Remove all control circles from the canvas
  polygon.editControlPoints.forEach((control) => fabricCanvas.remove(control));
  delete polygon.editControlPoints;

  // Clear the reference if this was the currently edited polygon
  if (fabricCanvas.currentEditedPolygon === polygon) {
    fabricCanvas.currentEditedPolygon = null;

    // Restore stacking behavior toggled on for editing
    if (fabricCanvas._editPreserveObjectStackingBackup !== undefined) {
      fabricCanvas.preserveObjectStacking = fabricCanvas._editPreserveObjectStackingBackup;
      delete fabricCanvas._editPreserveObjectStackingBackup;
    }
  }

  fabricCanvas.requestRenderAll();
}

// Updates the positions of all control points to match the current polygon transformation
function updateControls(polygon) {
  if (!polygon || !polygon.editControlPoints) return;

  // Get current transformation matrix
  const transformMatrix = polygon.calcTransformMatrix();

  // Update each control circles position
  polygon.editControlPoints.forEach((controlCircle, index) => {
    const point = polygon.points[index];

    // Convert local point to canvas coordinates
    const localPoint = new fabric.Point(point.x - polygon.pathOffset.x, point.y - polygon.pathOffset.y);
    const canvasPoint = fabric.util.transformPoint(localPoint, transformMatrix);

    // Update control circle position
    controlCircle.set({ left: canvasPoint.x, top: canvasPoint.y });
    controlCircle.setCoords();
  });

  // Ensure controls stay on top
  raiseControls(polygon);
}

// Handles the movement of a control point and updates the polygon shape accordingly
function handleControlMove(fabricCanvas, polygon, movedIndex, movedCircle) {
  // Get all control circles
  const controlPoints = polygon.editControlPoints;
  if (!controlPoints) return;

  // Get the current absolute positions of all control points
  const absolutePoints = controlPoints.map((control) => control.getCenterPoint());

  // Calculate the new bounding box of the polygon
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  absolutePoints.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  });

  const newWidth = maxX - minX;
  const newHeight = maxY - minY;

  // Convert absolute points to relative points (relative to top-left corner of bounding box)
  const relativePoints = absolutePoints.map((point) => ({
    x: point.x - minX,
    y: point.y - minY,
  }));

  // Update the polygon with new dimensions and points
  polygon.set({
    points: relativePoints,
    left: minX,
    top: minY,
    width: newWidth,
    height: newHeight,
    pathOffset: { x: newWidth / 2, y: newHeight / 2 }, // Center offset
    dirty: true, // Mark for re-render
  });

  // Recalculate the polygons area
  if (relativePoints.length >= 3) {
    const areaInPixels =
      Math.abs(
        relativePoints.reduce((sum, point, i) => {
          const nextPoint = relativePoints[(i + 1) % relativePoints.length];
          return sum + (point.x * nextPoint.y - nextPoint.x * point.y);
        }, 0)
      ) / 2;

    // Convert from pixels to square meters
    const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    polygon.area = areaInPixels / (pixelsPerMeter * pixelsPerMeter);

    // Calculate volume (area * height in meters)
    polygon.volume = polygon.area * (polygon.height || 2.4);
  }

  // Update polygonss coordinates
  polygon.setCoords();

  // Update associated text label position to follow the polygon center
  const centerX = minX + newWidth / 2;
  const centerY = minY + newHeight / 2;

  if (polygon.associatedText) {
    const textLabel = polygon.associatedText;
    textLabel.set({
      left: centerX + (textLabel.offsetX || 0),
      top: centerY + (textLabel.offsetY || 0),
    });
    textLabel.setCoords();

    // Update the text content to reflect the new area/volume
    updatePolygonTextContent(polygon, fabricCanvas);
  }

  // Ensure control points stay on top of the polygon
  raiseControls(polygon);

  // Re-render the canvas
  fabricCanvas.requestRenderAll();
}

// Updates the text content of a polygon to reflect the new area/volume after control point move
function updatePolygonTextContent(polygon, fabricCanvas) {
  if (!polygon || !polygon.associatedText) return;

  const textObject = polygon.associatedText;
  const currentText = textObject.text || "";

  // If text is hidden or empty, nothing to update
  if (textObject._isHidden || !currentText.trim()) return;

  // Calculate new area and volume
  const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
  let areaInPixels = 0;
  if (polygon.points && polygon.points.length >= 3) {
    areaInPixels =
      Math.abs(
        polygon.points.reduce((sum, point, index) => {
          const nextPoint = polygon.points[(index + 1) % polygon.points.length];
          return sum + (point.x * nextPoint.y - nextPoint.x * point.y);
        }, 0)
      ) / 2;
  }
  const area = areaInPixels / (pixelsPerMeter * pixelsPerMeter);
  const height = textObject.displayHeight || polygon.height || 2.4;
  const volume = area * height;

  // Parse existing text lines and update area/volume values
  const lines = currentText.split("\n");
  const updatedLines = lines.map((line) => {
    if (line.startsWith("Area:")) {
      return `Area: ${area.toFixed(2)} m²`;
    } else if (line.startsWith("Volume:")) {
      return `Volume: ${volume.toFixed(2)} m³`;
    }
    return line;
  });

  // Update the text object
  textObject.set({ text: updatedLines.join("\n") });
  textObject.setCoords();
}

// Brings all control points to the front of the canvas z-order to ensure they are always clickable
function raiseControls(polygon) {
  if (!polygon || !polygon.editControlPoints) return;

  const canvas = polygon.canvas;
  const totalObjects = canvas ? canvas.getObjects().length : 0;

  // Move each control to the front
  polygon.editControlPoints.forEach((control) => {
    control.bringToFront();
    if (canvas) control.moveTo(totalObjects);
  });
}

// Updates the color of all control points to match the polygon stroke color
export function updateControlPointColors(polygon) {
  if (!polygon || !polygon.editControlPoints) return;

  const color = polygon.stroke || "#f8794b";
  polygon.editControlPoints.forEach((control) => {
    control.set({ fill: color });
  });

  if (polygon.canvas) {
    polygon.canvas.requestRenderAll();
  }
}

// Sets up double-click handler for adding control points on polygon edges
function setupPolygonDoubleClick(fabricCanvas, polygon) {
  if (polygon._dblClickHandler) return; // Already set up

  polygon._dblClickHandler = (event) => {
    if (event.e?.detail === 2) {
      const pointer = fabricCanvas.getPointer(event.e);
      addControlPointAtPosition(fabricCanvas, polygon, pointer);
    }
  };

  polygon.on("mousedown", polygon._dblClickHandler);
}

// Removes the double-click handler from a polygon
function removePolygonDoubleClick(polygon) {
  if (polygon._dblClickHandler) {
    polygon.off("mousedown", polygon._dblClickHandler);
    delete polygon._dblClickHandler;
  }
}

// Finds the closest edge of a polygon to a given point and returns the insertion index
function findClosestEdgeIndex(polygon, point) {
  if (!polygon || !polygon.points || polygon.points.length < 2) return -1;

  const transformMatrix = polygon.calcTransformMatrix();
  const points = polygon.points;
  let minDistance = Infinity;
  let insertIndex = -1;

  for (let index = 0; index < points.length; index++) {
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];

    // Convert to canvas coordinates
    const localP1 = new fabric.Point(p1.x - polygon.pathOffset.x, p1.y - polygon.pathOffset.y);
    const localP2 = new fabric.Point(p2.x - polygon.pathOffset.x, p2.y - polygon.pathOffset.y);
    const canvasP1 = fabric.util.transformPoint(localP1, transformMatrix);
    const canvasP2 = fabric.util.transformPoint(localP2, transformMatrix);

    const distance = pointToSegmentDistance(point, canvasP1, canvasP2);
    if (distance < minDistance) {
      minDistance = distance;
      insertIndex = index + 1; // Insert after this point
    }
  }

  return minDistance < 20 ? insertIndex : -1; // Only if within 20 pixels of edge
}

// Calculates the distance from a point to a line segment
function pointToSegmentDistance(point, segStart, segEnd) {
  const deltaX = segEnd.x - segStart.x;
  const deltaY = segEnd.y - segStart.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    // Segment is a point
    return Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
  }

  let projectionFactor = ((point.x - segStart.x) * deltaX + (point.y - segStart.y) * deltaY) / lengthSquared;
  projectionFactor = Math.max(0, Math.min(1, projectionFactor));

  const projectedX = segStart.x + projectionFactor * deltaX;
  const projectedY = segStart.y + projectionFactor * deltaY;

  return Math.sqrt((point.x - projectedX) ** 2 + (point.y - projectedY) ** 2);
}

// Adds a new control point to a polygon at the specified canvas position
export function addControlPointAtPosition(fabricCanvas, polygon, canvasPoint) {
  if (!polygon || !polygon.points || !polygon.editControlPoints) return false;

  const insertIndex = findClosestEdgeIndex(polygon, canvasPoint);
  if (insertIndex < 0) return false;

  // Convert canvas point to polygon local coordinates
  const inverseMatrix = fabric.util.invertTransform(polygon.calcTransformMatrix());
  const localPoint = fabric.util.transformPoint(new fabric.Point(canvasPoint.x, canvasPoint.y), inverseMatrix);

  // Add path offset back to get the point in polygon's coordinate system
  const newPoint = {
    x: localPoint.x + polygon.pathOffset.x,
    y: localPoint.y + polygon.pathOffset.y,
  };

  // Insert the new point
  polygon.points.splice(insertIndex, 0, newPoint);

  // Rebuild control points
  rebuildControlPoints(fabricCanvas, polygon);

  return true;
}

// Removes a control point from a polygon at the specified index
export function removeControlPointAtIndex(fabricCanvas, polygon, index) {
  if (!polygon || !polygon.points || polygon.points.length <= 3) return false; // Keep at least 3 points

  polygon.points.splice(index, 1);
  rebuildControlPoints(fabricCanvas, polygon);
  return true;
}

// Rebuilds all control points for a polygon after points array changes
function rebuildControlPoints(fabricCanvas, polygon) {
  // Remove existing control points
  if (polygon.editControlPoints) {
    polygon.editControlPoints.forEach((control) => fabricCanvas.remove(control));
    delete polygon.editControlPoints;
  }

  // Remove and restore double-click handler
  removePolygonDoubleClick(polygon);

  // Recalculate path offset based on new bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polygon.points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  const newWidth = maxX - minX;
  const newHeight = maxY - minY;

  polygon.set({
    width: newWidth,
    height: newHeight,
    pathOffset: { x: minX + newWidth / 2, y: minY + newHeight / 2 },
    dirty: true,
  });

  polygon.setCoords();

  // Recenter associated label using actual canvas center (prevents jump after point deletion)
  if (polygon.associatedText) {
    const center = polygon.getCenterPoint();
    const textLabel = polygon.associatedText;
    textLabel.set({
      left: center.x + (textLabel.offsetX || 0),
      top: center.y + (textLabel.offsetY || 0),
    });
    textLabel.setCoords();
    updatePolygonTextContent(polygon, fabricCanvas);
  }

  // Re-enable editing to create new control points
  enablePolygonEditing(fabricCanvas, polygon);
  fabricCanvas.requestRenderAll();
}

// Expose function globally for context menu
window.addPolygonControlPoint = addControlPointAtPosition;
window.removePolygonControlPoint = removeControlPointAtIndex;
