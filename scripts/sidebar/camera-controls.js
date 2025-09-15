import { updateSliderTrack, createSliderInputSync, setupColorControls, setMultipleObjectProperties, safeCanvasRender, hexToRgba } from "./sidebar-utils.js";
import { layers } from "../canvas/canvas-layers.js";

export function createCameraControls({ elements }) {
  const { coverageColorIcons, coverageColorPicker, coverageToggle, angleSlider, angleInput, opacitySlider, opacityInput, distanceSlider, distanceInput } = elements;

  let initialized = false;
  let isInitializing = true;

  function updateCoverageOpacity(activeObject, cameraOpacity) {
    if (!activeObject || !activeObject.coverageConfig) return;
    const rgbMatch = (activeObject.coverageConfig.baseColor || activeObject.coverageConfig.fillColor || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const devicesLayerOpacity = layers?.devices?.opacity ?? 1;
    const finalOpacity = cameraOpacity * devicesLayerOpacity;
    activeObject.coverageConfig.opacity = cameraOpacity;

    let r = 165, g = 155, b = 155;
    if (rgbMatch) {
      [, r, g, b] = rgbMatch;
    }
    const newFill = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
    if (activeObject.coverageArea) setMultipleObjectProperties(activeObject.coverageArea, { fill: newFill });
    activeObject.coverageConfig.fillColor = newFill;
  }

  function updateAngle(activeObject, angleSpan) {
    if (!activeObject || !activeObject.coverageConfig || !activeObject.angleDiff) return;
    const midAngle = (activeObject.coverageConfig.startAngle + activeObject.angleDiff(activeObject.coverageConfig.startAngle, activeObject.coverageConfig.endAngle) / 2) % 360;
    activeObject.coverageConfig.startAngle = (midAngle - angleSpan / 2 + 360) % 360;
    activeObject.coverageConfig.endAngle = (midAngle + angleSpan / 2) % 360;
    if (angleSpan >= 359) {
      activeObject.coverageConfig.startAngle = 0;
      activeObject.coverageConfig.endAngle = 360;
    }
    activeObject.coverageConfig.isInitialized = true;
    if (typeof activeObject.createOrUpdateCoverageArea === "function") activeObject.createOrUpdateCoverageArea();
  }

  function ensureInitialized(fabricCanvas, getCurrentGroup) {
    if (initialized) return;

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

    if (coverageToggle) {
      coverageToggle.addEventListener("change", () => {
        const activeObject = fabricCanvas.getActiveObject?.() || getCurrentGroup?.();
        if (activeObject && activeObject.coverageConfig) {
          const visible = coverageToggle.checked && (layers?.devices?.visible ?? true);
          activeObject.coverageConfig.visible = coverageToggle.checked;
          if (activeObject.coverageArea) setMultipleObjectProperties(activeObject.coverageArea, { visible }, fabricCanvas);
          if (activeObject.leftResizeIcon) setMultipleObjectProperties(activeObject.leftResizeIcon, { visible });
          if (activeObject.rightResizeIcon) setMultipleObjectProperties(activeObject.rightResizeIcon, { visible });
          if (activeObject.rotateResizeIcon) setMultipleObjectProperties(activeObject.rotateResizeIcon, { visible });
          safeCanvasRender(fabricCanvas);
        }
      });
    }

    createSliderInputSync(
      angleSlider,
      angleInput,
      (value) => {
        if (isInitializing) return;
        const activeObject = fabricCanvas.getActiveObject?.() || getCurrentGroup?.();
        if (activeObject && activeObject.coverageConfig && activeObject.angleDiff) {
          const angleSpan = Math.round(value);
          updateAngle(activeObject, angleSpan);
        }
      },
      { min: 1, max: 360, step: 1 }
    );

    createSliderInputSync(
      opacitySlider,
      opacityInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject?.() || getCurrentGroup?.();
        if (activeObject && activeObject.coverageConfig && activeObject.coverageArea) {
          updateCoverageOpacity(activeObject, value);
        }
      },
      { min: 0, max: 1, step: 0.01, precision: 2 }
    );

    createSliderInputSync(
      distanceSlider,
      distanceInput,
      (value) => {
        const activeObject = fabricCanvas.getActiveObject?.() || getCurrentGroup?.();
        if (activeObject && activeObject.coverageConfig) {
          const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
          const distance = Math.min(value, 500);
          activeObject.coverageConfig.radius = distance * pixelsPerMeter;
          if (typeof activeObject.createOrUpdateCoverageArea === "function") activeObject.createOrUpdateCoverageArea();
        }
      },
      { min: 1, max: 500, step: 0.1, precision: 2 }
    );

    updateSliderTrack(angleSlider, 90, 1, 360);
    updateSliderTrack(opacitySlider, 0.3, 0, 1);
    updateSliderTrack(distanceSlider, 10, 1, 500);

    // Coverage color controls
    setupColorControls(coverageColorPicker, coverageColorIcons, (color) => {
      const currentGroup = getCurrentGroup?.();
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
          setMultipleObjectProperties(currentGroup.coverageArea, { fill: rgbaColorTemp }, currentGroup.canvas);
          currentGroup.coverageConfig.fillColor = rgbaColorTemp;
        }
        currentGroup.canvas.requestRenderAll();
      }
    });

    // Icon change handler (camera set)
    document.querySelectorAll(".change-camera-icons img").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentGroup = getCurrentGroup?.();
        if (!currentGroup || !currentGroup.canvas || typeof currentGroup.getObjects !== "function") return;

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

              const cameraPropsEl = document.getElementById("camera-properties");
              if (cameraPropsEl) cameraPropsEl.style.display = isCamera ? "block" : "none";

              if (isCamera && !currentGroup.coverageConfig) {
                currentGroup.coverageConfig = {
                  startAngle: 270,
                  endAngle: 0,
                  fillColor: "rgba(165, 155, 155, 0.3)",
                  visible: true,
                };
                if (window.addCameraCoverage) window.addCameraCoverage(currentGroup.canvas, currentGroup);
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

    isInitializing = false;
    initialized = true;
  }

  function applyGroup(group) {
    if (!group) return;
    // Set opacity slider to this camera's specific opacity
    if (group.coverageConfig && opacitySlider && opacityInput) {
      const cameraOpacity = group.coverageConfig.opacity ?? 0.3;
      opacitySlider.value = cameraOpacity;
      opacityInput.value = Number(cameraOpacity).toFixed(2);
      updateSliderTrack(opacitySlider, cameraOpacity, 0, 1);
    }

    // Update distance slider to show correct distance based on current radius
    if (group.coverageConfig && distanceSlider && distanceInput) {
      const fabricCanvas = group.canvas;
      const pixelsPerMeter = fabricCanvas.pixelsPerMeter || 17.5;
      if (!group.coverageConfig.radius) {
        group.coverageConfig.radius = 10 * pixelsPerMeter;
      }
      const currentDistanceInMeters = group.coverageConfig.radius / pixelsPerMeter;
      const clampedDistance = Math.max(1, Math.min(500, currentDistanceInMeters));
      distanceSlider.value = clampedDistance;
      distanceInput.value = clampedDistance.toFixed(1);
      updateSliderTrack(distanceSlider, clampedDistance, 1, 500);
    }

    // Update angle slider to show correct angle span
    if (group.coverageConfig && group.angleDiff && angleSlider && angleInput) {
      const currentAngleSpan = Math.round(group.angleDiff(group.coverageConfig.startAngle, group.coverageConfig.endAngle));
      angleSlider.value = currentAngleSpan;
      angleInput.value = currentAngleSpan;
      updateSliderTrack(angleSlider, currentAngleSpan, 1, 360);
    }

    // Update coverage toggle
    if (coverageToggle && group.coverageConfig !== undefined) {
      coverageToggle.checked = group.coverageConfig.visible !== false;
    }
  }

  return { ensureInitialized, applyGroup };
}
