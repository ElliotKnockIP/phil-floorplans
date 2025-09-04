import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export function setupZoneTool(fabricCanvas) {
  const createZoneButton = document.getElementById("create-zone-btn");

  let isCreatingZone = false;
  let currentZonePoints = [];
  let currentPolygon = null;
  let previewLine = null;
  let startPointCircle = null;
  window.zones = window.zones || [];

  const CLOSE_DISTANCE_THRESHOLD = 20;
  const MIN_POINTS_FOR_COMPLETION = 3;
  const zoneColorsMap = new Map();
  let nextColorIndex = 0;
  const distinctHues = [0, 120, 240, 60, 180, 300, 30, 150, 270, 90, 15, 135, 255, 75, 195, 315, 45, 165, 285, 105];

  // Generate color for zones
  const generateZoneColor = (index) => `hsla(${distinctHues[index % distinctHues.length]}, 70%, 60%, 0.2)`;
  const getColorForZoneName = (name) => zoneColorsMap.get(name) || zoneColorsMap.set(name, generateZoneColor(nextColorIndex++)).get(name);

  // Calculate distance between points
  const calculateDistance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const isCloseToStart = (pointer) => currentZonePoints.length >= MIN_POINTS_FOR_COMPLETION && calculateDistance(pointer, currentZonePoints[0]) <= CLOSE_DISTANCE_THRESHOLD;

  // Calculate polygon area
  const calculatePolygonArea = (points, pixelsPerMeter) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / (2 * pixelsPerMeter * pixelsPerMeter);
  };

  // Calculate polygon center
  const calculatePolygonCenter = (points) => ({
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  });

  // Cleanup function for temporary objects
  function cleanupTempObjects() {
    [previewLine, currentPolygon, startPointCircle].forEach((obj) => {
      if (obj) {
        fabricCanvas.remove(obj);
      }
    });
    previewLine = currentPolygon = startPointCircle = null;
    currentZonePoints = [];
    isCreatingZone = false;
    fabricCanvas.requestRenderAll();
  }

  // Maintain layer order for zones
  const maintainLayerOrder = () => {
    const objects = fabricCanvas.getObjects();
    const backgroundImage = objects.find((obj) => obj.isBackground);

    backgroundImage?.sendToBack();
    window.zones.forEach((zone) => {
      if (zone.polygon && objects.includes(zone.polygon)) {
        backgroundImage ? fabricCanvas.bringForward(zone.polygon, false) : zone.polygon.sendToBack();
      }
    });
    objects.forEach((obj) => {
      if ((obj.type === "group" && obj.deviceType) || ["line", "circle", "rect"].includes(obj.type) || (obj.type === "i-text" && !obj.class)) {
        obj.bringToFront();
        obj.textObject?.bringToFront();
      }
    });
    window.zones.forEach((zone) => {
      if (zone.text && objects.includes(zone.text)) {
        zone.text.bringToFront();
        objects.forEach((obj) => {
          if (obj.type === "group" && obj.deviceType) {
            obj.bringToFront();
            obj.textObject?.bringToFront();
          }
        });
      }
    });
    fabricCanvas.requestRenderAll();
  };

  // Delete a zone (both polygon and text together)
  const deleteZone = (zoneToDelete) => {
    const zoneIndex = window.zones.findIndex((zone) => zone.polygon === zoneToDelete || zone.text === zoneToDelete);
    if (zoneIndex === -1) return false;

    const zone = window.zones[zoneIndex];

    // Remove all event listeners first to prevent memory leaks
    [zone.polygon, zone.text].forEach((obj) => {
      if (obj) {
        obj.off(); // Remove all event listeners
        fabricCanvas.remove(obj);
      }
    });

    // CRITICAL: Remove from global array to prevent reappearance after save/load
    window.zones.splice(zoneIndex, 1);

    fabricCanvas.discardActiveObject();
    window.hideDeviceProperties?.();
    fabricCanvas.requestRenderAll();
    return true;
  };

  // Complete zone creation
  const completeZone = () => {
    [previewLine, currentPolygon, startPointCircle].forEach((obj) => obj && fabricCanvas.remove(obj));
    previewLine = currentPolygon = startPointCircle = null;

    const zoneName = `Zone ${window.zones.length + 1}`;
    const height = 2.4;
    const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    const area = calculatePolygonArea(currentZonePoints, pixelsPerMeter);
    const volume = area * height;

    const { finalPolygon, text } = createZoneObjects(currentZonePoints.slice(), zoneName, "", height, area, volume);
    addZoneEventHandlers(finalPolygon, text);

    window.zones.push({ polygon: finalPolygon, text });

    // Temporarily disable undo tracking for individual objects
    const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

    fabricCanvas.add(finalPolygon, text);

    // Re-enable undo tracking and create a single command for both zone objects
    if (window.undoSystem) {
      window.undoSystem.isExecutingCommand = wasExecuting;
      const commands = [new window.UndoCommands.AddCommand(fabricCanvas, finalPolygon, []), new window.UndoCommands.AddCommand(fabricCanvas, text, [])];
      const zoneCommand = new window.UndoCommands.MultipleCommand(commands);
      window.undoSystem.addToStack(zoneCommand);
    }

    setTimeout(maintainLayerOrder, 10);
    resetDrawingState();
  };

  // Reset drawing state
  const resetDrawingState = () => {
    cleanupTempObjects();
    stopCurrentTool();
  };

  // Handle mouse down to add points
  const handleMouseDown = (o) => {
    o.e.preventDefault();
    o.e.stopPropagation();
    const pointer = fabricCanvas.getPointer(o.e);

    if (isCloseToStart(pointer)) return completeZone();

    currentZonePoints.push({ x: pointer.x, y: pointer.y });

    if (currentZonePoints.length === 1) {
      startPointCircle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 8,
        fill: "transparent",
        stroke: "#00ff00",
        strokeWidth: 3,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        strokeDashArray: [5, 5],
      });
      fabricCanvas.add(startPointCircle);
    }

    if (currentZonePoints.length > 1) {
      currentPolygon && fabricCanvas.remove(currentPolygon);
      currentPolygon = new fabric.Polygon(currentZonePoints.slice(), {
        fill: "rgba(0,0,0,0.1)",
        stroke: "rgba(0,0,0,0.5)",
        strokeWidth: 2,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
        perPixelTargetFind: true,
      });
      fabricCanvas.add(currentPolygon);
      startPointCircle?.bringToFront();
    }
    fabricCanvas.requestRenderAll();
  };

  // Handle mouse movement to preview lines
  const handleMouseMove = (o) => {
    if (currentZonePoints.length === 0) return;
    const pointer = fabricCanvas.getPointer(o.e);
    previewLine && fabricCanvas.remove(previewLine);

    const lastPoint = currentZonePoints[currentZonePoints.length - 1];
    const isNearStart = isCloseToStart(pointer);

    previewLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
      stroke: isNearStart ? "#00ff00" : "blue",
      strokeWidth: isNearStart ? 3 : 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      perPixelTargetFind: true,
    });

    fabricCanvas.add(previewLine);
    startPointCircle?.bringToFront();
    fabricCanvas.setCursor(isNearStart ? "pointer" : "crosshair");
    fabricCanvas.requestRenderAll();
  };

  // Create zone polygon and text
  const createZoneObjects = (polygonPoints, zoneName, zoneNotes, height, area, volume) => {
    const fillColor = getColorForZoneName(zoneName);
    const strokeColor = fillColor.replace("0.2", "1") || "#f8794b";
    const center = calculatePolygonCenter(polygonPoints);

    const finalPolygon = new fabric.Polygon(polygonPoints, {
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 2,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      // hoverCursor: "pointer",
      zoneName,
      zoneNotes,
      class: "zone-polygon",
      area,
      height,
      volume,
      perPixelTargetFind: false,
    });

    // Create text with ONLY the zone name initially (like rooms)
    const text = new fabric.IText(`${zoneName}`, {
      class: "zone-text",
      left: center.x,
      top: center.y,
      fontFamily: "Poppins, sans-serif",
      fontSize: 15,
      fill: strokeColor,
      selectable: true,
      evented: true,
      editable: false,
      hasControls: false,
      hasBorders: true,
      hoverCursor: "move",
      originX: "center",
      originY: "center",
      cursorColor: strokeColor,
      offsetX: 0,
      offsetY: 0,
      displayHeight: height, // Store height for calculations without affecting polygon
      borderColor: "#f8794b",
      borderScaleFactor: 2,
      cornerSize: 8,
      cornerColor: "#f8794b",
      cornerStrokeColor: "#000000",
      cornerStyle: "circle",
      transparentCorners: false,
      padding: 5,
    });

    return { finalPolygon, text, strokeColor };
  };

  // Add event handlers for zones
  const addZoneEventHandlers = (finalPolygon, text) => {
    finalPolygon.associatedText = text;
    text.associatedPolygon = finalPolygon;

    setTimeout(() => (finalPolygon.originalCenter = finalPolygon.getCenterPoint()), 100);

    finalPolygon.on("moving", () => {
      if (!finalPolygon || !fabricCanvas.getObjects().includes(finalPolygon)) return;
      if (text && fabricCanvas.getObjects().includes(text)) {
        const newCenter = finalPolygon.getCenterPoint();
        text.set({ left: newCenter.x + (text.offsetX || 0), top: newCenter.y + (text.offsetY || 0) });
        text.setCoords();
      }
      fabricCanvas.requestRenderAll();
    });

    finalPolygon.on("moved", () => setTimeout(maintainLayerOrder, 10));

    text.on("moving", () => {
      if (!text || !finalPolygon || !fabricCanvas.getObjects().includes(text) || !fabricCanvas.getObjects().includes(finalPolygon)) return;
      const polygonCenter = finalPolygon.getCenterPoint();
      text.offsetX = text.left - polygonCenter.x;
      text.offsetY = text.top - polygonCenter.y;
      text.setCoords();
      fabricCanvas.requestRenderAll();
    });

    const showProperties = () => window.showDeviceProperties?.("zone-polygon", text, finalPolygon, finalPolygon.height);
    const hideProperties = () => window.hideDeviceProperties?.();

    [text, finalPolygon].forEach((obj) => {
      obj.on("selected", () => (showProperties(), fabricCanvas.requestRenderAll()));
      obj.on("deselected", hideProperties);
    });

    finalPolygon.on("mousedown", (e) => {
      const pointer = fabricCanvas.getPointer(e.e);
      finalPolygon.set("evented", false);
      const devicesUnderneath = fabricCanvas.getObjects().filter((obj) => obj !== finalPolygon && obj !== text && obj.type === "group" && obj.deviceType && obj.containsPoint(pointer));
      finalPolygon.set("evented", true);

      e.e.preventDefault();
      e.e.stopPropagation();
      if (devicesUnderneath.length > 0) {
        fabricCanvas.setActiveObject(devicesUnderneath[0]);
      } else {
        fabricCanvas.setActiveObject(finalPolygon);
      }
      fabricCanvas.requestRenderAll();
    });
  };

  // Activate zone creation
  const activateZoneCreation = () => {
    if (isCreatingZone) return;
    isCreatingZone = true;
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "zone", handleMouseDown, handleMouseMove);
  };

  createZoneButton.addEventListener("click", activateZoneCreation);
  fabricCanvas.on("object:added", () => fabricCanvas.requestRenderAll());
  fabricCanvas.on("object:modified", () => setTimeout(maintainLayerOrder, 10));

  // Expose functions globally for deletion system integration
  window.maintainZoneLayerOrder = maintainLayerOrder;
  window.deleteZone = deleteZone; // This is critical for deletion to work

  // Setup enhanced deletion handler specifically for zones
  const handleZoneDeletion = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const active = fabricCanvas.getActiveObject();
      if (active && ((active.type === "polygon" && active.class === "zone-polygon") || (active.type === "i-text" && active.class === "zone-text"))) {
        const wasDeleted = deleteZone(active);
        if (wasDeleted) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  // Remove existing handler if it exists
  if (window.zoneDeletionHandler) {
    document.removeEventListener("keydown", window.zoneDeletionHandler);
  }

  // Add new handler
  window.zoneDeletionHandler = handleZoneDeletion;
  document.addEventListener("keydown", handleZoneDeletion);
}
