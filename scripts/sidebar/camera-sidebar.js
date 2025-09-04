import { addCameraCoverage } from "../devices/camera-coverage.js";
import { layers } from "../canvas/canvas-layers.js";
import { updateSliderTrack, createSliderInputSync, setupColorControls, hexToRgba, wrapGlobalFunction, setObjectProperty, setMultipleObjectProperties, safeCanvasRender } from "./sidebar-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const coverageColorIcons = document.querySelectorAll(".change-coverage-colour .colour-icon");
  const coverageColorPicker = document.getElementById("coverage-color-picker");
  const coverageToggle = document.getElementById("camera-coverage-toggle");
  const angleSlider = document.getElementById("camera-angle-slider");
  const angleInput = document.getElementById("camera-angle-input");
  const opacitySlider = document.getElementById("camera-opacity-slider");
  const opacityInput = document.getElementById("camera-opacity-input");
  const distanceSlider = document.getElementById("camera-distance-slider");
  const distanceInput = document.getElementById("camera-distance-input");

  let currentGroup = null;
  let isInitializing = true;
  let controlsInitialized = false;

  // Updates the opacity of a camera's coverage area
  function updateCoverageOpacity(activeObject, cameraOpacity) {
    const rgbMatch = activeObject.coverageConfig.fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const devicesLayerOpacity = layers.devices.opacity;
    const finalOpacity = cameraOpacity * devicesLayerOpacity;

    // Store the opacity separately in coverageConfig
    activeObject.coverageConfig.opacity = cameraOpacity;

    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      const newFill = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
      setMultipleObjectProperties(activeObject.coverageArea, { fill: newFill });
      activeObject.coverageConfig.fillColor = newFill;
    } else {
      const newFill = `rgba(165, 155, 155, ${finalOpacity})`;
      setMultipleObjectProperties(activeObject.coverageArea, { fill: newFill });
      activeObject.coverageConfig.fillColor = newFill;
    }
  }

  // Updates the angle span of a camera's coverage
  function updateAngle(activeObject, angleSpan) {
    const midAngle = (activeObject.coverageConfig.startAngle + activeObject.angleDiff(activeObject.coverageConfig.startAngle, activeObject.coverageConfig.endAngle) / 2) % 360;
    activeObject.coverageConfig.startAngle = (midAngle - angleSpan / 2 + 360) % 360;
    activeObject.coverageConfig.endAngle = (midAngle + angleSpan / 2) % 360;

    if (angleSpan >= 359) {
      activeObject.coverageConfig.startAngle = 0;
      activeObject.coverageConfig.endAngle = 360;
    }

    activeObject.coverageConfig.isInitialized = true;
    if (activeObject.createOrUpdateCoverageArea) activeObject.createOrUpdateCoverageArea();
  }

  // Initializes camera controls with default values
  function initCameraControls(fabricCanvas) {
    if (controlsInitialized) return;
    controlsInitialized = true;

    if (angleSlider) {
      angleSlider.value = 90;
      if (angleInput) angleInput.value = 90;
    }

    if (distanceSlider) {
      distanceSlider.min = 1;
      distanceSlider.max = 500;
      distanceSlider.step = 0.1;
      distanceSlider.value = 10;
      if (distanceInput) distanceInput.value = 10;
    }

    // Sets up coverage toggle
    if (coverageToggle) {
      coverageToggle.addEventListener("change", () => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig) {
          const visible = coverageToggle.checked && layers.devices.visible;
          activeObject.coverageConfig.visible = coverageToggle.checked;

          setObjectProperty(activeObject.coverageArea, "visible", visible, fabricCanvas);
          if (activeObject.leftResizeIcon) setObjectProperty(activeObject.leftResizeIcon, "visible", visible);
          if (activeObject.rightResizeIcon) setObjectProperty(activeObject.rightResizeIcon, "visible", visible);
          if (activeObject.rotateResizeIcon) setObjectProperty(activeObject.rotateResizeIcon, "visible", visible);
        }
      });
    }

    // Sets up angle controls
    createSliderInputSync(
      angleSlider,
      angleInput,
      (value) => {
        if (isInitializing) return;
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.angleDiff) {
          const angleSpan = Math.round(value);
          updateAngle(activeObject, angleSpan);
        }
      },
      { min: 1, max: 360, step: 1 }
    );

    // Sets up opacity controls
    createSliderInputSync(
      opacitySlider,
      opacityInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          updateCoverageOpacity(activeObject, value);
        }
      },
      { min: 0, max: 1, step: 0.01, precision: 2 }
    );

    // Sets up distance controls
    createSliderInputSync(
      distanceSlider,
      distanceInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
          const distance = Math.min(value, 500);
          activeObject.coverageConfig.radius = distance * pixelsPerMeter;
          if (activeObject.createOrUpdateCoverageArea) activeObject.createOrUpdateCoverageArea();
        }
      },
      { min: 1, max: 500, step: 0.1, precision: 2 }
    );

    // Initializes slider tracks
    updateSliderTrack(angleSlider, 90, 1, 360);
    updateSliderTrack(opacitySlider, 0.3, 0, 1);
    updateSliderTrack(distanceSlider, 10, 1, 500);

    isInitializing = false;
  }

  // Wraps global show/hide functions for device properties
  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, group) => {
    currentGroup = group;
    if (group && group.canvas && !controlsInitialized) {
      initCameraControls(group.canvas);
    }

    // Set opacity slider to this camera's specific opacity
    if (group && group.coverageConfig && opacitySlider && opacityInput) {
      const cameraOpacity = group.coverageConfig.opacity || 0.3;
      opacitySlider.value = cameraOpacity;
      opacityInput.value = cameraOpacity.toFixed(2);
      updateSliderTrack(opacitySlider, cameraOpacity, 0, 1);
    }

    // Update distance slider to show correct distance based on current radius
    if (group && group.coverageConfig && distanceSlider && distanceInput) {
      const fabricCanvas = group.canvas;
      const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;

      // Ensure radius is properly set if not initialized
      if (!group.coverageConfig.radius) {
        group.coverageConfig.radius = 10 * pixelsPerMeter; // 10 meters default
      }

      const currentDistanceInMeters = group.coverageConfig.radius / pixelsPerMeter;
      const clampedDistance = Math.max(1, Math.min(500, currentDistanceInMeters));

      distanceSlider.value = clampedDistance;
      distanceInput.value = clampedDistance.toFixed(1);
      updateSliderTrack(distanceSlider, clampedDistance, 1, 500);
    }

    // Update angle slider to show correct angle span
    if (group && group.coverageConfig && group.angleDiff && angleSlider && angleInput) {
      const currentAngleSpan = Math.round(group.angleDiff(group.coverageConfig.startAngle, group.coverageConfig.endAngle));
      angleSlider.value = currentAngleSpan;
      angleInput.value = currentAngleSpan;
      updateSliderTrack(angleSlider, currentAngleSpan, 1, 360);
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    currentGroup = null;
  });

  // Sets up coverage color controls
  setupColorControls(coverageColorPicker, coverageColorIcons, (color) => {
    if (currentGroup && currentGroup.canvas && currentGroup.coverageArea) {
      const opacity = parseFloat(opacitySlider?.value) || 0.3;
      const rgbaColor = hexToRgba(color, opacity);
      setMultipleObjectProperties(currentGroup.coverageArea, { fill: rgbaColor }, currentGroup.canvas);
      currentGroup.coverageConfig.fillColor = rgbaColor;
    }
  });

  // Handles camera icon changes
  document.querySelectorAll(".change-camera-icons img").forEach((img) => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentGroup || !currentGroup.canvas) return;

      const newSrc = img.getAttribute("src");
      const imageObj = currentGroup.getObjects().find((obj) => obj.type === "image");
      const circleObj = currentGroup.getObjects().find((obj) => obj.type === "circle");

      if (imageObj && circleObj) {
        fabric.Image.fromURL(
          newSrc,
          function (newImg) {
            const scaleFactor = currentGroup.scaleFactor || 1;
            const iconSize = 30 * scaleFactor;

            setMultipleObjectProperties(newImg, {
              scaleX: iconSize / newImg.width,
              scaleY: iconSize / newImg.height,
              angle: imageObj.angle,
              left: imageObj.left,
              top: imageObj.top,
              originX: imageObj.originX,
              originY: imageObj.originY,
            });

            const index = currentGroup._objects.indexOf(imageObj);
            currentGroup.remove(imageObj);
            currentGroup.insertAt(newImg, index, false);

            currentGroup.deviceType = newImg._element.src.split("/").pop();
            const isCamera = ["fixed-camera.png", "box-camera.png", "ptz-camera.png", "dome-camera.png", "bullet-camera.png", "thermal-camera.png"].includes(currentGroup.deviceType);

            document.getElementById("camera-properties").style.display = isCamera ? "block" : "none";

            if (isCamera && !currentGroup.coverageConfig) {
              currentGroup.coverageConfig = {
                startAngle: 270,
                endAngle: 0,
                fillColor: "rgba(165, 155, 155, 0.3)",
                visible: true,
              };
              addCameraCoverage(currentGroup.canvas, currentGroup);
            } else if (!isCamera && currentGroup.coverageConfig) {
              ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
                if (currentGroup[prop]) {
                  currentGroup.canvas.remove(currentGroup[prop]);
                  currentGroup[prop] = null;
                }
              });
              currentGroup.coverageConfig = null;
            }

            currentGroup.setCoords();
            safeCanvasRender(currentGroup.canvas);
          },
          { crossOrigin: "anonymous" }
        );
      }
    });
  });

  // Exposes initCameraControls globally
  window.initCameraControls = initCameraControls;
});
