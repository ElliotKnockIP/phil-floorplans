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
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    currentPolygon = null;
    currentTextObject = null;
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
