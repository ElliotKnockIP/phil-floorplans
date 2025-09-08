import { updateSliderTrack, createSliderInputSync, setupColorControls, preventEventPropagation, wrapGlobalFunction, setMultipleObjectProperties, hexToRgba, rgbToHex, hslToHex, createToggleHandler, safeCanvasRender } from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
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

  let currentPolygon = null;
  let currentTextObject = null;
  let currentZone = null;

  // Updates warning text based on zone height
  function updateWarningText(height) {
    if (!zoneWarning) return;

    if (height > 2 && height <= 4) {
      zoneWarning.textContent = "Scaffold or Step Ladders recommended.";
    } else if (height > 4 && height <= 7) {
      zoneWarning.textContent = "Cherry Picker or Scissor Lift recommended.";
    } else if (height > 7) {
      zoneWarning.textContent = "Fall Arrest System recommended.";
    } else {
      zoneWarning.textContent = "";
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

  // Get devices inside a zone polygon
  function getDevicesInZone(zonePolygon, fabricCanvas) {
    const devices = [];
    const allObjects = fabricCanvas.getObjects();

    allObjects.forEach((obj) => {
      // Check for device groups
      if (obj.type === "group" && obj.deviceType) {
        const deviceCenter = obj.getCenterPoint();
        if (isPointInPolygon(deviceCenter, zonePolygon)) {
          // Check if device is also in a room
          let roomInfo = "";
          if (window.rooms && window.rooms.length > 0) {
            const deviceInRoom = window.rooms.find((room) => room.polygon && isPointInPolygon(deviceCenter, room.polygon));
            if (deviceInRoom) {
              roomInfo = ` (in ${deviceInRoom.polygon.roomName || deviceInRoom.roomName || "Room"})`;
            }
          }

          devices.push({
            type: "device",
            name: obj.textObject ? obj.textObject.text : obj.deviceType.replace(".png", "").replace("-", " "),
            deviceType: obj.deviceType,
            object: obj,
            roomInfo: roomInfo,
          });
        }
      }
      // Check for other objects like uploaded images, shapes, etc.
      else if (["rect", "circle", "triangle"].includes(obj.type) || (obj.type === "image" && obj.isUploadedImage)) {
        const objCenter = obj.getCenterPoint();
        if (isPointInPolygon(objCenter, zonePolygon)) {
          // Check if object is also in a room
          let roomInfo = "";
          if (window.rooms && window.rooms.length > 0) {
            const objectInRoom = window.rooms.find((room) => room.polygon && isPointInPolygon(objCenter, room.polygon));
            if (objectInRoom) {
              roomInfo = ` (in ${objectInRoom.polygon.roomName || objectInRoom.roomName || "Room"})`;
            }
          }

          devices.push({
            type: "object",
            name: obj.type === "image" ? "Uploaded Image" : obj.type.charAt(0).toUpperCase() + obj.type.slice(1),
            deviceType: obj.type,
            object: obj,
            roomInfo: roomInfo,
          });
        }
      }
    });

    return devices;
  }

  // Update the devices list in the zone sidebar
  function updateZoneDevicesList(zone, fabricCanvas) {
    // Find or create the zone devices list element
    let zoneDevicesList = document.getElementById("zone-devices-list");
    if (!zoneDevicesList) {
      // Create the devices list section if it doesn't exist
      const zoneProperties = document.getElementById("zone-properties");
      if (zoneProperties) {
        const devicesSection = document.createElement("div");
        devicesSection.className = "mb-3";
        devicesSection.innerHTML = `
          <label class="form-label text-white">Devices in Zone:</label>
          <div id="zone-devices-list" class="bg-light p-2 rounded text-dark" style="max-height: 200px; overflow-y: auto">
            <!-- Inserted by JavaScript -->
          </div>
        `;
        zoneProperties.appendChild(devicesSection);
        zoneDevicesList = document.getElementById("zone-devices-list");
      }
    }

    if (!zoneDevicesList || !zone || !fabricCanvas) return;

    const devices = getDevicesInZone(zone.polygon, fabricCanvas);
    if (devices.length === 0) {
      zoneDevicesList.innerHTML = '<span class="text-muted">No devices in this zone</span>';
    } else {
      const deviceNames = devices.map((d) => d.name + d.roomInfo);
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

      zoneDevicesList.innerHTML = deviceListHTML;
    }
  }

  // Calculate zone area
  function calculateZoneArea(points, pixelsPerMeter) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / (2 * pixelsPerMeter * pixelsPerMeter);
  }

  // Updates the text displayed for a zone
  function updateZoneText() {
    if (!currentPolygon || !currentTextObject || !currentPolygon.canvas) return;

    const name = currentPolygon.zoneName;
    const notes = currentPolygon.zoneNotes || "";
    const area = currentPolygon.area;
    const height = currentTextObject.displayHeight || currentPolygon.height;
    const volume = area * height;
    const textLines = [];

    if (zoneNameToggle?.checked) textLines.push(name);
    if (zoneNotesToggle?.checked && notes) textLines.push(`Notes: ${notes}`);
    if (zoneAreaToggle?.checked) textLines.push(`Area: ${area.toFixed(2)} m²`);
    if (zoneVolumeToggle?.checked) textLines.push(`Volume: ${volume.toFixed(2)} m³`);

    const newText = textLines.length > 0 ? textLines.join("\n") : name; // Always show at least the name
    setMultipleObjectProperties(
      currentTextObject,
      {
        text: newText,
        visible: true,
      },
      currentPolygon.canvas
    );
  }

  // Updates the zone's fill and stroke colors
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

  // Updates the zone's text color
  function updateZoneTextColor(color) {
    if (currentPolygon && currentTextObject && currentPolygon.canvas) {
      setMultipleObjectProperties(currentTextObject, { fill: color }, currentPolygon.canvas);
    }
  }

  // Converts fill color (hsla or rgba) to hex
  function getHexFromFill(fill) {
    if (fill.startsWith("hsla")) {
      const hslaMatch = fill.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
      if (hslaMatch) {
        const [, h, s, l] = hslaMatch.map(Number);
        return hslToHex(h, s, l);
      }
    } else if (fill.startsWith("rgba")) {
      const rgbaMatch = fill.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (rgbaMatch) {
        const [, r, g, b] = rgbaMatch.map(Number);
        return rgbToHex(r, g, b);
      }
    }
    return "#ffffff";
  }

  // Wraps global show/hide functions for zone properties
  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, polygon, height) => {
    if (deviceType !== "zone-polygon") return;

    currentPolygon = polygon;
    currentTextObject = textObject;

    // Find the zone object from the global zones array
    currentZone = window.zones ? window.zones.find((zone) => zone.polygon === polygon || zone.text === textObject) : null;

    if (zoneNameInput && textObject) {
      const zoneName = textObject.text.split("\n")[0] || polygon.zoneName;
      zoneNameInput.value = zoneName;
    }

    if (zoneNotesInput && textObject) {
      const notesLine = textObject.text.split("\n").find((line) => line.startsWith("Notes:"));
      const zoneNotes = notesLine ? notesLine.replace("Notes: ", "") : polygon.zoneNotes || "";
      zoneNotesInput.value = zoneNotes;
    }

    if (zoneHeightInput && zoneHeightSlider && polygon) {
      // Use displayHeight from textObject, not the polygon height (which should stay as geometry)
      let heightValue = textObject.displayHeight !== undefined ? textObject.displayHeight : height !== undefined ? height : 2.4;
      if (isNaN(heightValue) || heightValue <= 0 || heightValue > 10) {
        heightValue = 2.4;
      }
      zoneHeightInput.value = heightValue.toFixed(2);
      zoneHeightSlider.value = heightValue;
      textObject.displayHeight = heightValue;
      updateSliderTrack(zoneHeightSlider, heightValue, zoneHeightSlider.min || 1, zoneHeightSlider.max || 10);
      updateWarningText(heightValue);
    }

    if (zoneTextSizeInput && zoneTextSizeSlider && textObject) {
      let textSizeValue = textObject.fontSize || 15;
      if (isNaN(textSizeValue) || textSizeValue < 1 || textSizeValue > 100) {
        textSizeValue = 15;
      }
      zoneTextSizeInput.value = textSizeValue;
      zoneTextSizeSlider.value = textSizeValue;
      textObject.fontSize = textSizeValue;
      updateSliderTrack(zoneTextSizeSlider, textSizeValue, zoneTextSizeSlider.min || 1, zoneTextSizeSlider.max || 100);
    }

    if (zoneColorPicker && polygon.fill) {
      zoneColorPicker.value = getHexFromFill(polygon.fill);
    }

    if (zoneTextColorPicker && textObject && textObject.fill) {
      zoneTextColorPicker.value = textObject.fill;
    }

    // Update toggle states based on current text content - similar to rooms
    if (zoneNameToggle && zoneAreaToggle && zoneVolumeToggle && zoneNotesToggle && textObject) {
      const textLines = textObject.text.split("\n");
      zoneNameToggle.checked = true; // Name is always shown like in rooms
      zoneAreaToggle.checked = textLines.some((line) => line.startsWith("Area:"));
      zoneVolumeToggle.checked = textLines.some((line) => line.startsWith("Volume:"));
      zoneNotesToggle.checked = textLines.some((line) => line.startsWith("Notes:"));
    }

    // Update devices list
    if (currentZone && polygon && polygon.canvas) {
      updateZoneDevicesList(currentZone, polygon.canvas);
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    currentPolygon = null;
    currentTextObject = null;
    currentZone = null;
    if (zoneWarning) zoneWarning.textContent = "";
  });

  // Sets up input handlers for zone name and notes
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

  // Sets up height controls - only updates displayHeight for text calculations, not polygon geometry
  createSliderInputSync(
    zoneHeightSlider,
    zoneHeightInput,
    (height) => {
      if (currentPolygon && currentTextObject && currentPolygon.canvas) {
        // Only update displayHeight for text calculations, don't modify polygon
        currentTextObject.displayHeight = height;
        updateWarningText(height);
        updateZoneText();
      }
    },
    { min: 1, max: 10, step: 0.01, precision: 2 }
  );

  // Sets up text size controls
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

  // Sets up toggle handlers for zone text properties
  createToggleHandler(zoneNameToggle, () => updateZoneText());
  createToggleHandler(zoneAreaToggle, () => updateZoneText());
  createToggleHandler(zoneVolumeToggle, () => updateZoneText());
  createToggleHandler(zoneNotesToggle, () => updateZoneText());

  // Sets up color controls for zone and text
  setupColorControls(zoneColorPicker, zoneColorIcons, updateZoneColor);
  setupColorControls(zoneTextColorPicker, zoneTextColorIcons, updateZoneTextColor);

  // Prevents event propagation for input elements
  [zoneHeightInput, zoneHeightSlider, zoneTextSizeInput, zoneTextSizeSlider].forEach((el) => {
    if (el) preventEventPropagation(el, ["click"]);
  });
});
