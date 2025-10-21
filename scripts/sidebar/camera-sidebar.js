import { addCameraCoverage } from "../devices/camera-management.js";
import { layers } from "../canvas/canvas-layers.js";
import { updateSliderTrack, createSliderInputSync, setupColorControls, hexToRgba, wrapGlobalFunction, setObjectProperty, setMultipleObjectProperties, safeCanvasRender, CAMERA_TYPES, DEFAULT_PIXELS_PER_METER } from "./sidebar-utils.js";

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
  const edgeStyleSelect = document.getElementById("camera-edge-style");

  let currentGroup = null;
  let isInitializing = true;
  let controlsInitialized = false;

  const CUSTOM_CAMERA_TYPES = ["custom-camera-icon.png"];

  function updateCoverageOpacity(activeObject, cameraOpacity) {
    const rgbMatch = activeObject.coverageConfig.fillColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const devicesLayerOpacity = layers.devices.opacity;
    const finalOpacity = cameraOpacity * devicesLayerOpacity;

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

  function initCameraControls(fabricCanvas) {
    if (controlsInitialized) return;
    controlsInitialized = true;

    if (angleSlider) {
      angleSlider.value = 90;
      if (angleInput) angleInput.textContent = "90°";
    }

    if (distanceSlider) {
      distanceSlider.min = 1;
      distanceSlider.max = 500;
      distanceSlider.step = 0.1;
      distanceSlider.value = 10;
      if (distanceInput) distanceInput.textContent = "10m";
    }

    if (coverageToggle) {
      coverageToggle.addEventListener("change", () => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig) {
          const visible = coverageToggle.checked && layers.devices.visible;
          activeObject.coverageConfig.visible = coverageToggle.checked;

          setObjectProperty(activeObject.coverageArea, "visible", visible);
          ["leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
            if (activeObject[prop]) setObjectProperty(activeObject[prop], "visible", visible);
          });
        }
      });
    }

    createSliderInputSync(
      angleSlider,
      angleInput,
      (value) => {
        if (isInitializing) return;
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.angleDiff) {
          updateAngle(activeObject, Math.round(value));
        }
      },
      { min: 1, max: 360, step: 1, format: (v) => v.toFixed(0) + "°" }
    );

    createSliderInputSync(
      opacitySlider,
      opacityInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          updateCoverageOpacity(activeObject, value);
        }
      },
      { min: 0, max: 1, step: 0.01, precision: 2, format: (v) => (v * 100).toFixed(0) + "%" }
    );

    createSliderInputSync(
      distanceSlider,
      distanceInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          const pixelsPerMeter = fabricCanvas.pixelsPerMeter || DEFAULT_PIXELS_PER_METER;
          activeObject.coverageConfig.radius = Math.min(value, 500) * pixelsPerMeter;
          if (activeObject.createOrUpdateCoverageArea) activeObject.createOrUpdateCoverageArea();
        }
      },
      { min: 1, max: 500, step: 0.1, precision: 1, format: (v) => v.toFixed(1) + "m" }
    );

    if (edgeStyleSelect) {
      edgeStyleSelect.addEventListener("change", () => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          const edgeStyle = edgeStyleSelect.value;
          activeObject.coverageConfig.edgeStyle = edgeStyle;

          let strokeDashArray = null;
          switch (edgeStyle) {
            case "dashed":
              strokeDashArray = [10, 5];
              break;
            case "dotted":
              strokeDashArray = [2, 2];
              break;
          }

          setMultipleObjectProperties(activeObject.coverageArea, { strokeDashArray });
        }
      });
    }

    updateSliderTrack(angleSlider, 90, 1, 360);
    updateSliderTrack(opacitySlider, 0.3, 0, 1);
    updateSliderTrack(distanceSlider, 10, 1, 500);

    isInitializing = false;
  }

  wrapGlobalFunction("showDeviceProperties", (deviceType, textObject, group) => {
    currentGroup = group;
    if (group && group.canvas && !controlsInitialized) {
      initCameraControls(group.canvas);
    }

    if (group && group.coverageConfig && opacitySlider && opacityInput) {
      const cameraOpacity = group.coverageConfig.opacity || 0.3;
      opacitySlider.value = cameraOpacity;
      opacityInput.textContent = (cameraOpacity * 100).toFixed(0) + "%";
      updateSliderTrack(opacitySlider, cameraOpacity, 0, 1);
    }

    if (group && group.coverageConfig && distanceSlider && distanceInput) {
      const fabricCanvas = group.canvas;
      const pixelsPerMeter = fabricCanvas.pixelsPerMeter || DEFAULT_PIXELS_PER_METER;

      if (!group.coverageConfig.radius) {
        group.coverageConfig.radius = 10 * pixelsPerMeter;
      }

      const currentDistanceInMeters = group.coverageConfig.radius / pixelsPerMeter;
      const clampedDistance = Math.max(1, Math.min(500, currentDistanceInMeters));

      distanceSlider.value = clampedDistance;
      distanceInput.textContent = clampedDistance.toFixed(1) + "m";
      updateSliderTrack(distanceSlider, clampedDistance, 1, 500);
    }

    if (group && group.coverageConfig && group.angleDiff && angleSlider && angleInput) {
      const currentAngleSpan = Math.round(group.angleDiff(group.coverageConfig.startAngle, group.coverageConfig.endAngle));
      angleSlider.value = currentAngleSpan;
      angleInput.textContent = currentAngleSpan + "°";
      updateSliderTrack(angleSlider, currentAngleSpan, 1, 360);
    }

    if (group && group.coverageConfig && edgeStyleSelect) {
      edgeStyleSelect.value = group.coverageConfig.edgeStyle || "solid";
    }
  });

  wrapGlobalFunction("hideDeviceProperties", () => {
    currentGroup = null;
  });

  setupColorControls(coverageColorPicker, coverageColorIcons, (color) => {
    if (currentGroup && currentGroup.canvas && currentGroup.coverageArea && currentGroup.coverageConfig) {
      const logicalOpacity = parseFloat(opacitySlider?.value) || currentGroup.coverageConfig.opacity || 0.3;
      const rgbaColorTemp = hexToRgba(color, logicalOpacity);
      const match = rgbaColorTemp.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (match) {
        const [, r, g, b] = match;
        currentGroup.coverageConfig.baseColor = `rgb(${r}, ${g}, ${b})`;
      }
      currentGroup.coverageConfig.opacity = logicalOpacity;
      if (typeof currentGroup.createOrUpdateCoverageArea === "function") {
        currentGroup.createOrUpdateCoverageArea();
      } else {
        setMultipleObjectProperties(currentGroup.coverageArea, { fill: rgbaColorTemp });
        currentGroup.coverageConfig.fillColor = rgbaColorTemp;
      }
      currentGroup.canvas.requestRenderAll();
    }
  });

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
          (newImg) => {
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
            const isCamera = CAMERA_TYPES.includes(currentGroup.deviceType);

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

  window.initCameraControls = initCameraControls;
});
