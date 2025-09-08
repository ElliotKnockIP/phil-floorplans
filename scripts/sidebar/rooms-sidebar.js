import { updateSliderTrack, createSliderInputSync, setupColorControls, preventEventPropagation, wrapGlobalFunction, setMultipleObjectProperties, safeCanvasRender, hexToRgba, rgbToHex, hslToHex, createToggleHandler } from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const roomLabelInput = document.getElementById("room-label-input");
  const roomNotesInput = document.getElementById("room-notes-input");
  const roomHeightInput = document.getElementById("room-height-input");
  const roomHeightSlider = document.getElementById("room-height-slider");
  const roomTextSizeInput = document.getElementById("room-text-size-input");
  const roomTextSizeSlider = document.getElementById("room-text-size-slider");
  const roomColorPicker = document.getElementById("room-color-picker");
  const roomColorIcons = document.querySelectorAll(".change-room-colour .colour-icon");
  const roomTextColorPicker = document.getElementById("room-text-color-picker");
  const roomTextColorIcons = document.querySelectorAll(".room-text-colour .colour-icon");
  const roomDevicesList = document.getElementById("room-devices-list");

  // Toggle controls
  const roomNameToggle = document.getElementById("room-name-toggle");
  const roomAreaToggle = document.getElementById("room-area-toggle");
  const roomVolumeToggle = document.getElementById("room-volume-toggle");
  const roomNotesToggle = document.getElementById("room-notes-toggle");
  const roomWarning = document.getElementById("room-warning");

  let currentRoom = null;
  let currentRoomPolygon = null;
  let currentRoomText = null;

  // Updates warning text based on zone height
  function updateWarningText(height) {
    if (!roomWarning) return;

    if (height > 2 && height <= 4) {
      roomWarning.textContent = "Scaffold or Step Ladders recommended.";
    } else if (height > 4 && height <= 7) {
      roomWarning.textContent = "Cherry Picker or Scissor Lift recommended.";
    } else if (height > 7) {
      roomWarning.textContent = "Fall Arrest System recommended.";
    } else {
      roomWarning.textContent = "";
    }
  }

  // Check if a point is inside a polygon
  function isPointInPolygon(point, polygon) {
    const vertices = polygon.points;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (vertices[i].y > point.y !== vertices[j].y > point.y && point.x < ((vertices[j].x - vertices[i].x) * (point.y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Get devices inside a room polygon
  function getDevicesInRoom(roomPolygon, fabricCanvas) {
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
  }

  // Update the devices list in the sidebar
  function updateRoomDevicesList(room, fabricCanvas) {
    if (!roomDevicesList || !room || !fabricCanvas) return;

    const devices = getDevicesInRoom(room.polygon, fabricCanvas);
    if (devices.length === 0) {
      roomDevicesList.innerHTML = '<span class="text-muted">No devices in this room</span>';
    } else {
      const deviceNames = devices.map((d) => d.name + d.zoneInfo);
      const deviceCountMap = {};
      deviceNames.forEach((name) => {
        deviceCountMap[name] = (deviceCountMap[name] || 0) + 1;
      });

      const deviceListHTML = Object.entries(deviceCountMap)
        .map(
          ([name, count]) =>
            `<div class="text-dark d-flex align-items-center gap-2">
            <span class="badge bg-orange">${count}</span>
            <span>${name}</span>
          </div>`
        )
        .join("");

      roomDevicesList.innerHTML = deviceListHTML;
    }
  }

  // Calculate room area
  function calculateRoomArea(points, pixelsPerMeter) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / (2 * pixelsPerMeter * pixelsPerMeter);
  }

  // Update room text with all selected properties
  function updateRoomText() {
    if (!currentRoomPolygon || !currentRoomText || !currentRoomPolygon.canvas) return;

    const name = currentRoomPolygon.roomName;
    const notes = currentRoomPolygon.roomNotes || "";
    const pixelsPerMeter = currentRoomPolygon.canvas.pixelsPerMeter || 17.5;
    const area = calculateRoomArea(currentRoomPolygon.points, pixelsPerMeter);
    const height = currentRoomText.displayHeight || currentRoomPolygon.height || 2.4;
    const volume = area * height;
    const textLines = [];

    if (roomNameToggle?.checked) textLines.push(name);
    if (roomNotesToggle?.checked && notes) textLines.push(`Notes: ${notes}`);
    if (roomAreaToggle?.checked) textLines.push(`Area: ${area.toFixed(2)} m²`);
    if (roomVolumeToggle?.checked) textLines.push(`Volume: ${volume.toFixed(2)} m³`);

    const newText = textLines.length > 0 ? textLines.join("\n") : name; // Always show at least the name
    setMultipleObjectProperties(
      currentRoomText,
      {
        text: newText,
        visible: true,
      },
      currentRoomPolygon.canvas
    );

    // Update stored values
    currentRoomPolygon.area = area;
    currentRoomPolygon.volume = volume;
    currentRoom.area = area;
    currentRoom.volume = volume;
  }

  // Update room border color
  function updateRoomColor(color) {
    if (!currentRoomPolygon || !currentRoomText || !currentRoom) return;

    setMultipleObjectProperties(currentRoomPolygon, { stroke: color });
    setMultipleObjectProperties(currentRoomText, { fill: color, cursorColor: color });
    currentRoom.roomColor = color;
  }

  // Update room text color
  function updateRoomTextColor(color) {
    if (currentRoomText) {
      setMultipleObjectProperties(currentRoomText, { fill: color, cursorColor: color });
    }
  }

  // Convert fill color to hex
  function getHexFromFill(fill) {
    if (fill.startsWith("hsl")) {
      const hslMatch = fill.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const [, h, s, l] = hslMatch.map(Number);
        return hslToHex(h, s, l);
      }
    } else if (fill.startsWith("rgb")) {
      const rgbMatch = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        return rgbToHex(r, g, b);
      }
    } else if (fill.startsWith("#")) {
      return fill;
    }
    return "#0066cc";
  }

  // ONLY wrap the global function for room-specific cases
  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, polygon, roomOrHeight) => {
    // ONLY handle room polygons - don't interfere with other device types
    if (deviceType !== "room-polygon") return;

    currentRoomPolygon = polygon;
    currentRoomText = textObject;
    currentRoom = roomOrHeight; // For rooms, the 4th parameter is the room object

    // Update room name input
    if (roomLabelInput && currentRoom) {
      roomLabelInput.value = currentRoom.roomName || "";
    }

    // Update room notes input
    if (roomNotesInput && currentRoom) {
      roomNotesInput.value = currentRoom.roomNotes || "";
    }

    // Update height controls (this should only update displayHeight for text, not polygon)
    if (roomHeightInput && roomHeightSlider && currentRoom) {
      let heightValue = currentRoomText.displayHeight || 2.4;
      if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) {
        heightValue = 2.4;
      }
      roomHeightInput.value = heightValue.toFixed(2);
      roomHeightSlider.value = heightValue;
      currentRoomText.displayHeight = heightValue;
      updateSliderTrack(roomHeightSlider, heightValue, roomHeightSlider.min || 1, roomHeightSlider.max || 10);
      updateWarningText(heightValue);
    }

    // Update text size controls
    if (roomTextSizeInput && roomTextSizeSlider && textObject) {
      let textSizeValue = textObject.fontSize || 14;
      if (isNaN(textSizeValue) || textSizeValue < 10 || textSizeValue > 30) {
        textSizeValue = 14;
      }
      roomTextSizeInput.value = textSizeValue;
      roomTextSizeSlider.value = textSizeValue;
      updateSliderTrack(roomTextSizeSlider, textSizeValue, 10, 30);
    }

    // Update room border color picker
    if (roomColorPicker && polygon.stroke) {
      roomColorPicker.value = getHexFromFill(polygon.stroke);
    }

    // Update room text color picker
    if (roomTextColorPicker && textObject && textObject.fill) {
      roomTextColorPicker.value = getHexFromFill(textObject.fill);
    }

    // Update toggle states based on current text content
    if (roomNameToggle && roomAreaToggle && roomVolumeToggle && roomNotesToggle && textObject) {
      const textLines = textObject.text.split("\n");
      roomNameToggle.checked = true; // Name is always first line if present
      roomAreaToggle.checked = textLines.some((line) => line.startsWith("Area:"));
      roomVolumeToggle.checked = textLines.some((line) => line.startsWith("Volume:"));
      roomNotesToggle.checked = textLines.some((line) => line.startsWith("Notes:"));
    }

    // Update devices list
    if (currentRoom && polygon && polygon.canvas) {
      updateRoomDevicesList(currentRoom, polygon.canvas);
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    currentRoom = null;
    currentRoomPolygon = null;
    currentRoomText = null;
    if (roomWarning) roomWarning.textContent = "";
  });

  // Set up room name input handler
  if (roomLabelInput) {
    roomLabelInput.addEventListener("input", (e) => {
      if (currentRoom && currentRoomPolygon && currentRoomText && currentRoomPolygon.canvas) {
        const newName = e.target.value.trim() || `Room ${window.rooms.indexOf(currentRoom) + 1}`;
        currentRoom.roomName = newName;
        currentRoomPolygon.roomName = newName;
        updateRoomText();
      }
    });
    preventEventPropagation(roomLabelInput);
  }

  // Set up room notes input handler
  if (roomNotesInput) {
    roomNotesInput.addEventListener("input", (e) => {
      if (currentRoom && currentRoomPolygon && currentRoomText && currentRoomPolygon.canvas) {
        const newNotes = e.target.value.trim();
        currentRoom.roomNotes = newNotes;
        currentRoomPolygon.roomNotes = newNotes;
        updateRoomText();
      }
    });
    preventEventPropagation(roomNotesInput);
  }

  // Set up height controls - only update displayHeight for text calculations, don't modify polygon
  createSliderInputSync(
    roomHeightSlider,
    roomHeightInput,
    (height) => {
      if (currentRoom && currentRoomText && currentRoomPolygon && currentRoomPolygon.canvas) {
        // Only update the displayHeight for text display purposes, don't modify the actual polygon
        currentRoomText.displayHeight = height;
        // Update room object but don't change polygon geometry
        currentRoom.height = height;
        updateWarningText(height);
        updateRoomText();
      }
    },
    { min: 1, max: 10, step: 0.01, precision: 2 }
  );

  // Set up text size controls
  createSliderInputSync(
    roomTextSizeSlider,
    roomTextSizeInput,
    (size) => {
      if (currentRoomPolygon && currentRoomText && currentRoomPolygon.canvas) {
        setMultipleObjectProperties(currentRoomText, { fontSize: size }, currentRoomPolygon.canvas);
      }
    },
    { min: 10, max: 30, step: 1 }
  );

  // Set up room color controls
  setupColorControls(roomColorPicker, roomColorIcons, updateRoomColor);

  // Set up room text color controls
  setupColorControls(roomTextColorPicker, roomTextColorIcons, updateRoomTextColor);

  // Set up toggle handlers
  createToggleHandler(roomNameToggle, () => updateRoomText());
  createToggleHandler(roomAreaToggle, () => updateRoomText());
  createToggleHandler(roomVolumeToggle, () => updateRoomText());
  createToggleHandler(roomNotesToggle, () => updateRoomText());

  // Prevent event propagation for input elements
  [roomHeightInput, roomHeightSlider, roomTextSizeInput, roomTextSizeSlider].forEach((el) => {
    if (el) preventEventPropagation(el, ["click"]);
  });

  // Make the room properties function globally available
  window.showRoomProperties = function (roomPolygon, roomText, room) {
    // Show room properties in the device properties sidebar
    window.showDeviceProperties("room-polygon", roomText, roomPolygon, room);

    // Show room properties section and hide others
    const roomProperties = document.getElementById("room-properties");
    const cameraProperties = document.getElementById("camera-properties");
    const genericProperties = document.getElementById("generic-properties");
    const zoneProperties = document.getElementById("zone-properties");

    if (roomProperties) roomProperties.style.display = "block";
    if (cameraProperties) cameraProperties.style.display = "none";
    if (genericProperties) genericProperties.style.display = "none";
    if (zoneProperties) zoneProperties.style.display = "none";

    // Update the sidebar title
    const deviceHeading = document.getElementById("device-heading");
    if (deviceHeading) {
      deviceHeading.textContent = "Room Properties";
    }
  };
});
