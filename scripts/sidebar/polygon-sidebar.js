import { updateSliderTrack, createSliderInputSync, setupColorControls, preventEventPropagation, wrapGlobalFunction, setMultipleObjectProperties, hexToRgba, rgbToHex, hslToHex, createToggleHandler, safeCanvasRender } from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  // Zone controls
  const zoneNameInput = document.getElementById("zone-label-input");
  const zoneNotesInput = document.getElementById("zone-notes-input");
  const zoneHeightInput = document.getElementById("zone-height-input");
  const zoneHeightSlider = document.getElementById("zone-height-slider");
  const zoneTextSizeInput = document.getElementById("zone-text-size-input");
  const zoneTextSizeSlider = document.getElementById("zone-text-size-slider");
  const zoneColorPicker = document.getElementById("zone-color-picker");
  const zoneColorIcons = document.querySelectorAll(".change-zone-colour .colour-icon");
  const zoneTextColorPicker = document.getElementById("zone-text-color-picker");
  const zoneTextColorIcons = document.querySelectorAll(".zone-text-colour .colour-icon");
  const zoneNameToggle = document.getElementById("zone-name-toggle");
  const zoneAreaToggle = document.getElementById("zone-area-toggle");
  const zoneVolumeToggle = document.getElementById("zone-volume-toggle");
  const zoneNotesToggle = document.getElementById("zone-notes-toggle");
  const zoneWarning = document.getElementById("zone-warning");

  // Room controls
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
  const roomNameToggle = document.getElementById("room-name-toggle");
  const roomAreaToggle = document.getElementById("room-area-toggle");
  const roomVolumeToggle = document.getElementById("room-volume-toggle");
  const roomNotesToggle = document.getElementById("room-notes-toggle");
  const roomWarning = document.getElementById("room-warning");

  // State
  let currentPolygon = null; // for zones
  let currentTextObject = null; // for zones
  let currentZone = null;

  let currentRoom = null;
  let currentRoomPolygon = null;
  let currentRoomText = null;

  // Utility: point-in-polygon
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

  // Utility: area calc from points and canvas scale
  function calculateArea(points, canvas) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    const pixelsPerMeter = canvas?.pixelsPerMeter || 17.5;
    return Math.abs(area) / (2 * pixelsPerMeter * pixelsPerMeter);
  }

  // Utility: warning text
  function updateWarningText(targetEl, height) {
    if (!targetEl) return;
    if (height > 2 && height <= 4) {
      targetEl.textContent = "Scaffold or Step Ladders recommended.";
    } else if (height > 4 && height <= 7) {
      targetEl.textContent = "Cherry Picker or Scissor Lift recommended.";
    } else if (height > 7) {
      targetEl.textContent = "Fall Arrest System recommended.";
    } else {
      targetEl.textContent = "";
    }
  }

  // Utility: color to hex
  function getHexFromFill(fill) {
    if (!fill || typeof fill !== "string") return "#ffffff";
    if (fill.startsWith("hsla")) {
      const m = fill.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
      if (m) {
        const [, h, s, l] = m.map(Number);
        return hslToHex(h, s, l);
      }
    } else if (fill.startsWith("hsl")) {
      const m = fill.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (m) {
        const [, h, s, l] = m.map(Number);
        return hslToHex(h, s, l);
      }
    } else if (fill.startsWith("rgba")) {
      const m = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (m) {
        const [, r, g, b] = m.map(Number);
        return rgbToHex(r, g, b);
      }
    } else if (fill.startsWith("rgb")) {
      const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        const [, r, g, b] = m.map(Number);
        return rgbToHex(r, g, b);
      }
    } else if (fill.startsWith("#")) {
      return fill;
    }
    return "#ffffff";
  }

  // ---------- ZONES ----------
  function getDevicesInZone(zonePolygon, fabricCanvas) {
    const devices = [];
    const allObjects = fabricCanvas.getObjects();
    allObjects.forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        const deviceCenter = obj.getCenterPoint();
        if (isPointInPolygon(deviceCenter, zonePolygon)) {
          let roomInfo = "";
          if (window.rooms && window.rooms.length > 0) {
            const deviceInRoom = window.rooms.find((room) => room.polygon && isPointInPolygon(deviceCenter, room.polygon));
            if (deviceInRoom) {
              roomInfo = ` (in ${deviceInRoom.polygon.roomName || deviceInRoom.roomName || "Room"})`;
            }
          }
          devices.push({ type: "device", name: obj.textObject ? obj.textObject.text : obj.deviceType.replace(".png", "").replace("-", " "), deviceType: obj.deviceType, object: obj, roomInfo });
        }
      } else if (["rect", "circle", "triangle"].includes(obj.type) || (obj.type === "image" && obj.isUploadedImage)) {
        const objCenter = obj.getCenterPoint();
        if (isPointInPolygon(objCenter, zonePolygon)) {
          let roomInfo = "";
          if (window.rooms && window.rooms.length > 0) {
            const objectInRoom = window.rooms.find((room) => room.polygon && isPointInPolygon(objCenter, room.polygon));
            if (objectInRoom) {
              roomInfo = ` (in ${objectInRoom.polygon.roomName || objectInRoom.roomName || "Room"})`;
            }
          }
          devices.push({ type: "object", name: obj.type === "image" ? "Uploaded Image" : obj.type.charAt(0).toUpperCase() + obj.type.slice(1), deviceType: obj.type, object: obj, roomInfo });
        }
      }
    });
    return devices;
  }

  function updateZoneDevicesList(zone, fabricCanvas) {
    let zoneDevicesList = document.getElementById("zone-devices-list");
    if (!zoneDevicesList) {
      const zoneProperties = document.getElementById("zone-properties");
      if (zoneProperties) {
        const devicesSection = document.createElement("div");
        devicesSection.className = "mb-3";
        devicesSection.innerHTML = `
          <label class="form-label text-white">Devices in Zone:</label>
          <div id="zone-devices-list" class="bg-light p-2 rounded text-dark" style="max-height: 200px; overflow-y: auto"></div>
        `;
        zoneProperties.appendChild(devicesSection);
      }
      zoneDevicesList = document.getElementById("zone-devices-list");
    }
    if (!zoneDevicesList || !zone || !fabricCanvas) return;
    const devices = getDevicesInZone(zone.polygon, fabricCanvas);
    if (devices.length === 0) {
      zoneDevicesList.innerHTML = '<span class="text-muted">No devices in this zone</span>';
    } else {
      const deviceNames = devices.map((d) => d.name + d.roomInfo);
      const deviceCountMap = {};
      deviceNames.forEach((name) => (deviceCountMap[name] = (deviceCountMap[name] || 0) + 1));
      zoneDevicesList.innerHTML = Object.entries(deviceCountMap)
        .map(([name, count]) => `<div class="text-dark d-flex align-items-center gap-2"><span class="badge bg-orange">${count}</span><span>${name}</span></div>`)
        .join("");
    }
  }

  function updateZoneText() {
    if (!currentPolygon || !currentTextObject || !currentPolygon.canvas) return;
    const area = calculateArea(currentPolygon.points, currentPolygon.canvas);
    const height = currentTextObject.displayHeight || currentPolygon.height || 2.4;
    const volume = area * height;
    const name = currentPolygon.zoneName || currentTextObject.text?.split("\n")[0] || "Zone";
    const notes = currentPolygon.zoneNotes || "";
    const lines = [];
    if (zoneNameToggle?.checked) lines.push(name);
    if (zoneAreaToggle?.checked) lines.push(`Area: ${area.toFixed(2)} m²`);
    if (zoneVolumeToggle?.checked) lines.push(`Volume: ${volume.toFixed(2)} m³`);
    if (zoneNotesToggle?.checked && notes) lines.push(`Notes: ${notes}`);
    const newText = lines.length ? lines.join("\n") : name;
    setMultipleObjectProperties(currentTextObject, { text: newText, visible: true }, currentPolygon.canvas);
  }

  function updateZoneColor(color) {
    if (!currentPolygon || !currentPolygon.canvas) return;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const fillColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
    const strokeColor = `rgba(${r}, ${g}, ${b}, 1)`;
    setMultipleObjectProperties(currentPolygon, { fill: fillColor, stroke: strokeColor }, currentPolygon.canvas);
    setMultipleObjectProperties(currentTextObject, { fill: strokeColor, cursorColor: strokeColor });
  }

  function updateZoneTextColor(color) {
    if (currentPolygon && currentTextObject && currentPolygon.canvas) {
      setMultipleObjectProperties(currentTextObject, { fill: color }, currentPolygon.canvas);
    }
  }

  // ---------- ROOMS ----------
  function getDevicesInRoom(roomPolygon, fabricCanvas) {
    const devices = [];
    const allObjects = fabricCanvas.getObjects();
    allObjects.forEach((obj) => {
      if (obj.type === "group" && obj.deviceType) {
        const deviceCenter = obj.getCenterPoint();
        if (isPointInPolygon(deviceCenter, roomPolygon)) {
          let zoneInfo = "";
          if (window.zones && window.zones.length > 0) {
            const deviceInZone = window.zones.find((zone) => zone.polygon && isPointInPolygon(deviceCenter, zone.polygon));
            if (deviceInZone) {
              zoneInfo = ` (in ${deviceInZone.polygon.zoneName || "Zone"})`;
            }
          }
          devices.push({ type: "device", name: obj.textObject ? obj.textObject.text : obj.deviceType.replace(".png", "").replace("-", " "), deviceType: obj.deviceType, object: obj, zoneInfo });
        }
      } else if (["rect", "circle", "triangle"].includes(obj.type) || (obj.type === "image" && obj.isUploadedImage)) {
        const objCenter = obj.getCenterPoint();
        if (isPointInPolygon(objCenter, roomPolygon)) {
          devices.push({ type: "object", name: obj.type === "image" ? "Uploaded Image" : obj.type.charAt(0).toUpperCase() + obj.type.slice(1), deviceType: obj.type, object: obj, zoneInfo: "" });
        }
      }
    });
    return devices;
  }

  function updateRoomDevicesList(room, fabricCanvas) {
    if (!roomDevicesList || !room || !fabricCanvas) return;
    const devices = getDevicesInRoom(room.polygon, fabricCanvas);
    if (devices.length === 0) {
      roomDevicesList.innerHTML = '<span class="text-muted">No devices in this room</span>';
    } else {
      const deviceNames = devices.map((d) => d.name + d.zoneInfo);
      const deviceCountMap = {};
      deviceNames.forEach((name) => (deviceCountMap[name] = (deviceCountMap[name] || 0) + 1));
      roomDevicesList.innerHTML = Object.entries(deviceCountMap)
        .map(([name, count]) => `<div class="text-dark d-flex align-items-center gap-2"><span class="badge bg-orange">${count}</span><span>${name}</span></div>`)
        .join("");
    }
  }

  function updateRoomText() {
    if (!currentRoomPolygon || !currentRoomText || !currentRoomPolygon.canvas) return;
    const name = currentRoomPolygon.roomName;
    const notes = currentRoomPolygon.roomNotes || "";
    const area = calculateArea(currentRoomPolygon.points, currentRoomPolygon.canvas);
    const height = currentRoomText.displayHeight || currentRoomPolygon.height || 2.4;
    const volume = area * height;
    const lines = [];
    if (roomNameToggle?.checked) lines.push(name);
    if (roomAreaToggle?.checked) lines.push(`Area: ${area.toFixed(2)} m²`);
    if (roomVolumeToggle?.checked) lines.push(`Volume: ${volume.toFixed(2)} m³`);
    if (roomNotesToggle?.checked && notes) lines.push(`Notes: ${notes}`);
    const newText = lines.length ? lines.join("\n") : name;
    setMultipleObjectProperties(currentRoomText, { text: newText, visible: true }, currentRoomPolygon.canvas);
    // store
    currentRoomPolygon.area = area;
    currentRoomPolygon.volume = volume;
    if (currentRoom) {
      currentRoom.area = area;
      currentRoom.volume = volume;
    }
  }

  function updateRoomColor(color) {
    if (!currentRoomPolygon || !currentRoomText || !currentRoom) return;
    setMultipleObjectProperties(currentRoomPolygon, { stroke: color });
    setMultipleObjectProperties(currentRoomText, { fill: color, cursorColor: color });
    currentRoom.roomColor = color;
  }

  function updateRoomTextColor(color) {
    if (currentRoomText) {
      setMultipleObjectProperties(currentRoomText, { fill: color, cursorColor: color });
    }
  }

  // ---------- Global show/hide wrappers (merged) ----------
  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, polygon, fourthParam) => {
    // Zone polygon
    if (deviceType === "zone-polygon") {
      currentPolygon = polygon;
      currentTextObject = textObject;
      currentZone = window.zones ? window.zones.find((zone) => zone.polygon === polygon || zone.text === textObject) : null;

      if (zoneNameInput && textObject) {
        const zoneName = textObject.text.split("\n")[0] || polygon.zoneName;
        zoneNameInput.value = zoneName || "";
      }
      if (zoneNotesInput) {
        const notesLine = textObject?.text?.split("\n").find((line) => line.startsWith("Notes:"));
        const zoneNotes = notesLine ? notesLine.replace("Notes: ", "") : polygon.zoneNotes || "";
        zoneNotesInput.value = zoneNotes;
      }
      if (zoneHeightInput && zoneHeightSlider) {
        let heightValue = textObject?.displayHeight !== undefined ? textObject.displayHeight : fourthParam !== undefined ? fourthParam : 2.4;
        if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) heightValue = 2.4;
        zoneHeightInput.value = heightValue.toFixed(2);
        zoneHeightSlider.value = heightValue;
        if (textObject) textObject.displayHeight = heightValue;
        updateSliderTrack(zoneHeightSlider, heightValue, zoneHeightSlider.min || 1, zoneHeightSlider.max || 10);
        updateWarningText(zoneWarning, heightValue);
      }
      if (zoneTextSizeInput && zoneTextSizeSlider && textObject) {
        let textSizeValue = textObject.fontSize || 15;
        if (isNaN(textSizeValue) || textSizeValue < 1 || textSizeValue > 100) textSizeValue = 15;
        zoneTextSizeInput.value = textSizeValue;
        zoneTextSizeSlider.value = textSizeValue;
        textObject.fontSize = textSizeValue;
        updateSliderTrack(zoneTextSizeSlider, textSizeValue, zoneTextSizeSlider.min || 1, zoneTextSizeSlider.max || 100);
      }
      if (zoneColorPicker && polygon.fill) zoneColorPicker.value = getHexFromFill(polygon.fill);
      if (zoneTextColorPicker && textObject && textObject.fill) zoneTextColorPicker.value = textObject.fill;
      if (zoneNameToggle && zoneAreaToggle && zoneVolumeToggle && zoneNotesToggle && textObject) {
        const textLines = textObject.text.split("\n");
        zoneNameToggle.checked = true;
        zoneAreaToggle.checked = textLines.some((line) => line.startsWith("Area:"));
        zoneVolumeToggle.checked = textLines.some((line) => line.startsWith("Volume:"));
        zoneNotesToggle.checked = textLines.some((line) => line.startsWith("Notes:"));
      }
      if (currentZone && polygon && polygon.canvas) updateZoneDevicesList(currentZone, polygon.canvas);
    }

    // Room polygon
    if (deviceType === "room-polygon") {
      currentRoomPolygon = polygon;
      currentRoomText = textObject;
      currentRoom = fourthParam; // room object

      if (roomLabelInput && currentRoom) roomLabelInput.value = currentRoom.roomName || "";
      if (roomNotesInput && currentRoom) roomNotesInput.value = currentRoom.roomNotes || "";

      if (roomHeightInput && roomHeightSlider && currentRoom) {
        let heightValue = currentRoomText?.displayHeight || 2.4;
        if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) heightValue = 2.4;
        roomHeightInput.value = heightValue.toFixed(2);
        roomHeightSlider.value = heightValue;
        if (currentRoomText) currentRoomText.displayHeight = heightValue;
        updateSliderTrack(roomHeightSlider, heightValue, roomHeightSlider.min || 1, roomHeightSlider.max || 10);
        updateWarningText(roomWarning, heightValue);
      }

      if (roomTextSizeInput && roomTextSizeSlider && textObject) {
        let textSizeValue = textObject.fontSize || 14;
        if (isNaN(textSizeValue) || textSizeValue < 10 || textSizeValue > 30) textSizeValue = 14;
        roomTextSizeInput.value = textSizeValue;
        roomTextSizeSlider.value = textSizeValue;
        updateSliderTrack(roomTextSizeSlider, textSizeValue, 10, 30);
      }

      if (roomColorPicker && polygon.stroke) roomColorPicker.value = getHexFromFill(polygon.stroke);
      if (roomTextColorPicker && textObject && textObject.fill) roomTextColorPicker.value = getHexFromFill(textObject.fill);

      if (roomNameToggle && roomAreaToggle && roomVolumeToggle && roomNotesToggle && textObject) {
        const textLines = textObject.text.split("\n");
        roomNameToggle.checked = true;
        roomAreaToggle.checked = textLines.some((line) => line.startsWith("Area:"));
        roomVolumeToggle.checked = textLines.some((line) => line.startsWith("Volume:"));
        roomNotesToggle.checked = textLines.some((line) => line.startsWith("Notes:"));
      }

      if (currentRoom && polygon && polygon.canvas) updateRoomDevicesList(currentRoom, polygon.canvas);
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    // zones
    currentPolygon = null;
    currentTextObject = null;
    currentZone = null;
    if (zoneWarning) zoneWarning.textContent = "";
    // rooms
    currentRoom = null;
    currentRoomPolygon = null;
    currentRoomText = null;
    if (roomWarning) roomWarning.textContent = "";
  });

  // Zone input handlers
  if (zoneNameInput) {
    zoneNameInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        currentPolygon.zoneName = e.target.value;
        updateZoneText();
      }
    });
    preventEventPropagation(zoneNameInput);
  }
  if (zoneNotesInput) {
    zoneNotesInput.addEventListener("input", (e) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        currentPolygon.zoneNotes = e.target.value;
        updateZoneText();
      }
    });
    preventEventPropagation(zoneNotesInput);
  }

  createSliderInputSync(
    zoneHeightSlider,
    zoneHeightInput,
    (height) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        currentTextObject.displayHeight = height;
        updateWarningText(zoneWarning, height);
        updateZoneText();
      }
    },
    { min: 1, max: 10, step: 0.01, precision: 2 }
  );

  createSliderInputSync(
    zoneTextSizeSlider,
    zoneTextSizeInput,
    (size) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        setMultipleObjectProperties(currentTextObject, { fontSize: size }, currentPolygon.canvas);
      }
    },
    { min: 1, max: 100, step: 1 }
  );

  createToggleHandler(zoneNameToggle, () => updateZoneText());
  createToggleHandler(zoneAreaToggle, () => updateZoneText());
  createToggleHandler(zoneVolumeToggle, () => updateZoneText());
  createToggleHandler(zoneNotesToggle, () => updateZoneText());

  setupColorControls(zoneColorPicker, zoneColorIcons, updateZoneColor);
  setupColorControls(zoneTextColorPicker, zoneTextColorIcons, updateZoneTextColor);

  [zoneHeightInput, zoneHeightSlider, zoneTextSizeInput, zoneTextSizeSlider].forEach((el) => {
    if (el) preventEventPropagation(el, ["click"]);
  });

  // Room input handlers
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

  createSliderInputSync(
    roomHeightSlider,
    roomHeightInput,
    (height) => {
      if (currentRoom && currentRoomText && currentRoomPolygon && currentRoomPolygon.canvas) {
        currentRoomText.displayHeight = height; // display only
        currentRoom.height = height; // store on room
        updateWarningText(roomWarning, height);
        updateRoomText();
      }
    },
    { min: 1, max: 10, step: 0.01, precision: 2 }
  );

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

  setupColorControls(roomColorPicker, roomColorIcons, updateRoomColor);
  setupColorControls(roomTextColorPicker, roomTextColorIcons, updateRoomTextColor);

  createToggleHandler(roomNameToggle, () => updateRoomText());
  createToggleHandler(roomAreaToggle, () => updateRoomText());
  createToggleHandler(roomVolumeToggle, () => updateRoomText());
  createToggleHandler(roomNotesToggle, () => updateRoomText());

  [roomHeightInput, roomHeightSlider, roomTextSizeInput, roomTextSizeSlider].forEach((el) => {
    if (el) preventEventPropagation(el, ["click"]);
  });

  // Maintain global helper for rooms
  window.showRoomProperties = function (roomPolygon, roomText, room) {
    window.showDeviceProperties("room-polygon", roomText, roomPolygon, room);
    const roomProperties = document.getElementById("room-properties");
    const cameraProperties = document.getElementById("camera-properties");
    const genericProperties = document.getElementById("generic-properties");
    const zoneProperties = document.getElementById("zone-properties");
    if (roomProperties) roomProperties.style.display = "block";
    if (cameraProperties) cameraProperties.style.display = "none";
    if (genericProperties) genericProperties.style.display = "none";
    if (zoneProperties) zoneProperties.style.display = "none";
    const deviceHeading = document.getElementById("device-heading");
    if (deviceHeading) deviceHeading.textContent = "Room Properties";
  };
});
