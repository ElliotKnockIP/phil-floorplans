import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export function setupRoomTool(fabricCanvas) {
  const createRoomButton = document.getElementById("create-room-btn");

  let isCreatingRoom = false;
  let currentRoomPoints = [];
  let currentPolygon = null;
  let previewLine = null;
  let startPointCircle = null;
  window.rooms = window.rooms || [];

  const CLOSE_DISTANCE_THRESHOLD = 20;
  const MIN_POINTS_FOR_COMPLETION = 3;
  const roomColorsMap = new Map();
  let nextColorIndex = 0;
  const distinctRoomHues = [210, 30, 120, 270, 60, 330, 90, 180, 240, 300, 150, 15, 195, 345, 75, 225, 45, 135, 285, 105];

  // Generate color for rooms (different hues than zones)
  const generateRoomColor = (index) => {
    const hue = distinctRoomHues[index % distinctRoomHues.length];
    return `hsl(${hue}, 70%, 50%)`; // Solid color for borders
  };

  const getColorForRoomName = (name) => {
    if (!roomColorsMap.has(name)) {
      roomColorsMap.set(name, generateRoomColor(nextColorIndex++));
    }
    return roomColorsMap.get(name);
  };

  // Calculate distance between points
  const calculateDistance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const isCloseToStart = (pointer) => currentRoomPoints.length >= MIN_POINTS_FOR_COMPLETION && calculateDistance(pointer, currentRoomPoints[0]) <= CLOSE_DISTANCE_THRESHOLD;

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

  // Check if a point is inside a polygon
  const isPointInPolygon = (point, polygon) => {
    const vertices = polygon.points;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (vertices[i].y > point.y !== vertices[j].y > point.y && point.x < ((vertices[j].x - vertices[i].x) * (point.y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Get devices inside a room polygon
  const getDevicesInRoom = (roomPolygon) => {
    const devices = [];
    const allObjects = fabricCanvas.getObjects();

    allObjects.forEach((obj) => {
      // Check for device groups
      if (obj.type === "group" && obj.deviceType) {
        const deviceCenter = obj.getCenterPoint();
        if (isPointInPolygon(deviceCenter, roomPolygon)) {
          // Check if device is also in a zone
          let zoneInfo = "";
          if (window.zones && window.zones.length > 0) {
            const deviceInZone = window.zones.find((zone) => zone.polygon && isPointInPolygon(deviceCenter, zone.polygon));
            if (deviceInZone) {
              zoneInfo = ` (in ${deviceInZone.polygon.zoneName || "Zone"})`;
            }
          }

          devices.push({
            type: "device",
            name: obj.textObject ? obj.textObject.text : obj.deviceType.replace(".png", "").replace("-", " "),
            deviceType: obj.deviceType,
            object: obj,
            zoneInfo: zoneInfo,
          });
        }
      }
      // Check for other objects like uploaded images, shapes, etc.
      else if (["rect", "circle", "triangle"].includes(obj.type) || (obj.type === "image" && obj.isUploadedImage)) {
        const objCenter = obj.getCenterPoint();
        if (isPointInPolygon(objCenter, roomPolygon)) {
          devices.push({
            type: "object",
            name: obj.type === "image" ? "Uploaded Image" : obj.type.charAt(0).toUpperCase() + obj.type.slice(1),
            deviceType: obj.type,
            object: obj,
            zoneInfo: "",
          });
        }
      }
    });

    return devices;
  };

  // Update room text with device list (only called manually)
  const updateRoomText = (room) => {
    const devices = getDevicesInRoom(room.polygon);
    const deviceNames = devices.map((d) => d.name + d.zoneInfo);
    const uniqueDevices = [...new Set(deviceNames)];

    let displayText = room.roomName;
    if (uniqueDevices.length > 0) {
      displayText += "\nContains:\n" + uniqueDevices.join("\n");
    }

    room.text.set({ text: displayText });
    room.devices = devices;
    fabricCanvas.requestRenderAll();
  };

  // Update all rooms manually (removed automatic calls)
  const updateAllRooms = () => {
    if (window.rooms && window.rooms.length > 0) {
      window.rooms.forEach((room) => {
        updateRoomText(room);
      });
    }
  };

  // Delete a room (both polygon and text together)
  const deleteRoom = (roomToDelete) => {
    const roomIndex = window.rooms.findIndex((room) => room.polygon === roomToDelete || room.text === roomToDelete);
    if (roomIndex === -1) return false;

    const room = window.rooms[roomIndex];

    // Remove all event listeners first to prevent memory leaks
    [room.polygon, room.text].forEach((obj) => {
      if (obj) {
        obj.off(); // Remove all event listeners
        fabricCanvas.remove(obj);
      }
    });

    // CRITICAL: Remove from global array to prevent reappearance after save/load
    window.rooms.splice(roomIndex, 1);

    fabricCanvas.discardActiveObject();
    window.hideDeviceProperties?.();
    fabricCanvas.requestRenderAll();
    return true;
  };

  window.deleteRoom = deleteRoom;

  // Cleanup function for temporary objects
  function cleanupTempObjects() {
    [previewLine, currentPolygon, startPointCircle].forEach((obj) => {
      if (obj) {
        fabricCanvas.remove(obj);
      }
    });
    previewLine = currentPolygon = startPointCircle = null;
    currentRoomPoints = [];
    isCreatingRoom = false;
    fabricCanvas.requestRenderAll();
  }

  // Maintain layer order for rooms (similar to zones)
  const maintainLayerOrder = () => {
    const objects = fabricCanvas.getObjects();
    const backgroundImage = objects.find((obj) => obj.isBackground);

    backgroundImage?.sendToBack();
    window.rooms.forEach((room) => {
      if (room.polygon && objects.includes(room.polygon)) {
        backgroundImage ? fabricCanvas.bringForward(room.polygon, false) : room.polygon.sendToBack();
      }
    });
    objects.forEach((obj) => {
      if ((obj.type === "group" && obj.deviceType) || ["line", "circle", "rect"].includes(obj.type) || (obj.type === "i-text" && !obj.class)) {
        obj.bringToFront();
        obj.textObject?.bringToFront();
      }
    });
    window.rooms.forEach((room) => {
      if (room.text && objects.includes(room.text)) {
        room.text.bringToFront();
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

  // Complete room creation
  const completeRoom = () => {
    [previewLine, currentPolygon, startPointCircle].forEach((obj) => obj && fabricCanvas.remove(obj));
    previewLine = currentPolygon = startPointCircle = null;

    const roomName = `Room ${window.rooms.length + 1}`;
    const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
    const area = calculatePolygonArea(currentRoomPoints, pixelsPerMeter);
    const roomColor = getColorForRoomName(roomName);

    const { finalPolygon, text } = createRoomObjects(currentRoomPoints.slice(), roomName, area, roomColor);
    addRoomEventHandlers(finalPolygon, text);

    const room = {
      polygon: finalPolygon,
      text,
      roomName,
      roomNotes: "",
      devices: [],
      roomColor,
      area,
      height: 2.4,
      volume: area * 2.4,
    };
    window.rooms.push(room);

    // Temporarily disable undo tracking for individual objects
    const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

    fabricCanvas.add(finalPolygon, text);

    // Re-enable undo tracking and create a single command for both room objects
    if (window.undoSystem) {
      window.undoSystem.isExecutingCommand = wasExecuting;
      const commands = [new window.UndoCommands.AddCommand(fabricCanvas, finalPolygon, []), new window.UndoCommands.AddCommand(fabricCanvas, text, [])];
      const roomCommand = new window.UndoCommands.MultipleCommand(commands);
      window.undoSystem.addToStack(roomCommand);
    }

    // Don't automatically update room content after creation - just show room name
    setTimeout(() => {
      maintainLayerOrder();
      // Room starts with just the name, no automatic device detection
    }, 10);
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

    if (isCloseToStart(pointer)) return completeRoom();

    currentRoomPoints.push({ x: pointer.x, y: pointer.y });

    if (currentRoomPoints.length === 1) {
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

    if (currentRoomPoints.length > 1) {
      currentPolygon && fabricCanvas.remove(currentPolygon);
      // Use color for the room being created
      const tempRoomName = `Room ${window.rooms.length + 1}`;
      const previewColor = getColorForRoomName(tempRoomName);

      currentPolygon = new fabric.Polygon(currentRoomPoints.slice(), {
        fill: "transparent", // No fill for rooms
        stroke: previewColor, // Use the room's designated color
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
    if (currentRoomPoints.length === 0) return;
    const pointer = fabricCanvas.getPointer(o.e);
    previewLine && fabricCanvas.remove(previewLine);

    const lastPoint = currentRoomPoints[currentRoomPoints.length - 1];
    const isNearStart = isCloseToStart(pointer);

    // Use the room's designated color for preview
    const tempRoomName = `Room ${window.rooms.length + 1}`;
    const previewColor = getColorForRoomName(tempRoomName);

    previewLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
      stroke: isNearStart ? "#00ff00" : previewColor,
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

  // Create room polygon and text
  const createRoomObjects = (polygonPoints, roomName, area, roomColor) => {
    const center = calculatePolygonCenter(polygonPoints);

    const finalPolygon = new fabric.Polygon(polygonPoints, {
      fill: "transparent", // No fill for rooms
      stroke: roomColor, // Use the assigned color for border
      strokeWidth: 2,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      // hoverCursor: "pointer",
      roomName,
      roomNotes: "",
      class: "room-polygon",
      area,
      height: 2.4, // Default room height
      volume: area * 2.4,
      perPixelTargetFind: false,
    });

    const text = new fabric.IText(`${roomName}`, {
      class: "room-text",
      left: center.x,
      top: center.y,
      fontFamily: "Poppins, sans-serif",
      fontSize: 14,
      fill: roomColor, // Use the same color for text
      selectable: true,
      evented: true,
      editable: false,
      hasControls: false,
      hasBorders: true,
      hoverCursor: "move",
      originX: "center",
      originY: "center",
      cursorColor: roomColor,
      offsetX: 0,
      offsetY: 0,
      displayHeight: 2.4,
      borderColor: "#f8794b",
      borderScaleFactor: 2,
      cornerSize: 8,
      cornerColor: "#f8794b",
      cornerStrokeColor: "#000000",
      cornerStyle: "circle",
      transparentCorners: false,
      padding: 5,
    });

    return { finalPolygon, text };
  };

  // Room snapping function
  const handleRoomSnapping = (obj) => {
    if (!obj.originalCenter) return false;

    const ROOM_SNAP_THRESHOLD = 25;
    const currentCenter = obj.getCenterPoint();

    if (calculateDistance(currentCenter, obj.originalCenter) <= ROOM_SNAP_THRESHOLD) {
      const deltaX = obj.originalCenter.x - currentCenter.x;
      const deltaY = obj.originalCenter.y - currentCenter.y;

      obj.set({
        left: obj.left + deltaX,
        top: obj.top + deltaY,
      });

      // Update associated text
      const room = window.rooms?.find((r) => r.polygon === obj);
      if (room?.text && fabricCanvas.getObjects().includes(room.text)) {
        const newCenter = obj.getCenterPoint();
        room.text.set({
          left: newCenter.x + (room.text.offsetX || 0),
          top: newCenter.y + (room.text.offsetY || 0),
        });
        room.text.setCoords();
      }

      obj.setCoords();
      return true;
    }
    return false;
  };

  // Add event handlers for rooms
  const addRoomEventHandlers = (finalPolygon, text) => {
    finalPolygon.associatedText = text;
    text.associatedPolygon = finalPolygon;

    setTimeout(() => (finalPolygon.originalCenter = finalPolygon.getCenterPoint()), 100);

    finalPolygon.on("moving", () => {
      if (!finalPolygon || !fabricCanvas.getObjects().includes(finalPolygon)) return;

      // Apply room snapping
      handleRoomSnapping(finalPolygon);

      if (text && fabricCanvas.getObjects().includes(text)) {
        const newCenter = finalPolygon.getCenterPoint();
        text.set({ left: newCenter.x + (text.offsetX || 0), top: newCenter.y + (text.offsetY || 0) });
        text.setCoords();
      }
      fabricCanvas.requestRenderAll();
    });

    finalPolygon.on("moved", () => {
      setTimeout(() => {
        maintainLayerOrder();
        // Removed automatic room content update - only update manually
      }, 10);
    });

    text.on("moving", () => {
      if (!text || !finalPolygon || !fabricCanvas.getObjects().includes(text) || !fabricCanvas.getObjects().includes(finalPolygon)) return;
      const polygonCenter = finalPolygon.getCenterPoint();
      text.offsetX = text.left - polygonCenter.x;
      text.offsetY = text.top - polygonCenter.y;
      text.setCoords();
      fabricCanvas.requestRenderAll();
    });

    const showProperties = () => {
      // Find the room object
      const room = window.rooms.find((r) => r.polygon === finalPolygon);
      if (room && window.showRoomProperties) {
        window.showRoomProperties(finalPolygon, text, room);
      }
    };
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

  // Activate room creation
  const activateRoomCreation = () => {
    if (isCreatingRoom) return;
    isCreatingRoom = true;
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "room", handleMouseDown, handleMouseMove);
  };

  createRoomButton.addEventListener("click", activateRoomCreation);
  fabricCanvas.on("object:modified", () => setTimeout(maintainLayerOrder, 10));

  // Expose functions globally for deletion system integration
  window.maintainRoomLayerOrder = maintainLayerOrder;
  window.updateAllRooms = updateAllRooms;
  window.deleteRoom = deleteRoom; // This is critical for deletion to work

  // Setup enhanced deletion handler specifically for rooms
  const handleRoomDeletion = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const active = fabricCanvas.getActiveObject();
      if (active && ((active.type === "polygon" && active.class === "room-polygon") || (active.type === "i-text" && active.class === "room-text"))) {
        const wasDeleted = deleteRoom(active);
        if (wasDeleted) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  // Remove existing handler if it exists
  if (window.roomDeletionHandler) {
    document.removeEventListener("keydown", window.roomDeletionHandler);
  }

  // Add new handler
  window.roomDeletionHandler = handleRoomDeletion;
  document.addEventListener("keydown", handleRoomDeletion);
}
