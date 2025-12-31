// Enables edit mode for a polygon by creating draggable control points at each vertex.
export function enablePolygonEditing(fabricCanvas, polygon) {
  // Exit early if polygon is invalid or already has edit controls
  if (!polygon || !polygon.points || polygon.editControlPoints) return;

  // Keep controls visible above the active polygon
  if (fabricCanvas.editPreserveObjectStackingBackup === undefined) {
    fabricCanvas.editPreserveObjectStackingBackup = fabricCanvas.preserveObjectStacking;
    fabricCanvas.preserveObjectStacking = true;
  }

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
    controlCircle.on("moving", (e) => {
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
        polygon.points.reduce((sum, point, i) => {
          const nextPoint = polygon.points[(i + 1) % polygon.points.length];
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
