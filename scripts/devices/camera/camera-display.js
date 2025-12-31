// Manages the visual rendering and UI interactions for camera coverage areas
import { layers } from "../../canvas/interactions/LayerControls.js";
import { angleDiff, createCoveragePoints, applyCameraPhysics } from "./camera-calculations.js";
import { createDoriZones } from "./camera-dori.js";

// Synchronize a slider and its numeric input field with the same value
export const updateSlider = (sliderId, inputId, value, min, max) => {
  const slider = document.getElementById(sliderId);
  const input = document.getElementById(inputId);
  if (slider) {
    slider.value = value;
    const percentage = ((value - min) / (max - min)) * 100;
    const orange = "var(--orange-ip2)";
    const white = "var(--white-ip2)";
    slider.style.background = `linear-gradient(to right, ${orange} ${percentage}%, ${white} ${percentage}%)`;
  }
  if (input) input.value = typeof value === "number" ? value.toFixed(2) : value;
};

// Determine the dash pattern for the coverage area's border
const getStrokeDashArray = (edgeStyle) => (edgeStyle === "dashed" ? [10, 5] : edgeStyle === "dotted" ? [2, 2] : null);

// Calculate the angular positions for the camera's resize and rotation handles
const calculateIconPositions = (camera, angleSpan, isFullCircle, center) => {
  const isSmallAngle = angleSpan <= 5;
  const start = camera.coverageConfig.startAngle;
  const end = camera.coverageConfig.endAngle;

  return {
    leftRad: fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (start - 5 + 360) % 360 : start),
    rightRad: fabric.util.degreesToRadians(isFullCircle || isSmallAngle ? (start + 5) % 360 : end),
    midRad: fabric.util.degreesToRadians((start + angleSpan / 2) % 360),
  };
};

// Position and rotate a control handle relative to the camera's center and coverage
export const updateIconPosition = (icon, camera, center, angle, radius, iconScale, shouldShow, iconType) => {
  if (!icon) return;

  let adjustedRadius = radius;
  const { startAngle, endAngle, projectionMode } = camera.coverageConfig;

  // Adjust handle distance for rectangular projection modes
  if (projectionMode === "rectangular") {
    const angleSpan = angleDiff(startAngle, endAngle);
    const midAngle = startAngle + angleSpan / 2;
    let diff = ((fabric.util.radiansToDegrees(angle) + 360) % 360) - midAngle;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const diffRad = fabric.util.degreesToRadians(diff);
    if (angleSpan < 170 && Math.abs(diffRad) < 1.4 && Math.abs(Math.cos(diffRad)) > 0.1) {
      adjustedRadius = radius / Math.cos(diffRad);
    }
  }

  let iconAngle = angle + 90;
  if (iconType === "left") iconAngle = startAngle + 90;
  else if (iconType === "right") {
    const span = angleDiff(startAngle, endAngle);
    iconAngle = (span >= 359.9 || span <= 5 ? startAngle + 5 + 90 : endAngle + 90) % 360;
  } else if (iconType === "rotate") {
    iconAngle = ((startAngle + angleDiff(startAngle, endAngle) / 2) % 360) + 90;
  }

  icon
    .set({
      left: center.x + adjustedRadius * Math.cos(angle),
      top: center.y + adjustedRadius * Math.sin(angle),
      angle: iconAngle,
      scaleX: iconScale,
      scaleY: iconScale,
      opacity: layers.devices.opacity,
      visible: shouldShow,
      evented: true,
      selectable: false,
    })
    .setCoords();

  if (shouldShow) icon.bringToFront();
};

// Shared properties for coverage area objects on the canvas
const commonProps = {
  stroke: "black",
  strokeWidth: 1,
  originX: "left",
  originY: "top",
  hasControls: false,
  hasBorders: false,
  selectable: false,
  evented: false,
  hoverCursor: "default",
  lockMovementX: true,
  lockMovementY: true,
  lockScalingX: true,
  lockScalingY: true,
  excludeFromExport: true,
};

// Update the visual representation of a camera's coverage area and its control handles
export function updateCoverageDisplay(fabricCanvas, cameraIcon) {
  if (!cameraIcon.createCoveragePoints) return;

  // Recalculate physical ranges before updating the display
  applyCameraPhysics(cameraIcon);

  const center = cameraIcon.getCenterPoint();
  const angleSpan = angleDiff(cameraIcon.coverageConfig.startAngle, cameraIcon.coverageConfig.endAngle);

  // Create a state hash to detect if visual updates are actually needed
  const currentState = {
    center: `${center.x.toFixed(1)},${center.y.toFixed(1)}`,
    angles: `${cameraIcon.coverageConfig.startAngle},${cameraIcon.coverageConfig.endAngle}`,
    radius: cameraIcon.coverageConfig.radius,
    minRange: cameraIcon.coverageConfig.minRange,
    visible: cameraIcon.coverageConfig.visible,
    doriEnabled: cameraIcon.coverageConfig.doriEnabled,
    projectionMode: cameraIcon.coverageConfig.projectionMode,
    edgeStyle: cameraIcon.coverageConfig.edgeStyle,
    opacity: cameraIcon.coverageConfig.opacity,
    fillColor: cameraIcon.coverageConfig.fillColor,
  };
  const stateHash = JSON.stringify(currentState);

  if (cameraIcon.lastCoverageState === stateHash) {
    return;
  }
  cameraIcon.lastCoverageState = stateHash;

  // Remove existing coverage area before redrawing
  if (cameraIcon.coverageArea) {
    fabricCanvas.remove(cameraIcon.coverageArea);
    cameraIcon.coverageArea = null;
  }

  const opacitySlider = document.getElementById("camera-opacity-slider");
  let opacity = cameraIcon.coverageConfig.opacity ?? (opacitySlider ? parseFloat(opacitySlider.value) : 0.3);
  if (isNaN(opacity) || opacity < 0) opacity = 0.3;
  cameraIcon.coverageConfig.opacity = opacity;

  const baseColor = cameraIcon.coverageConfig.baseColor || "rgb(165, 155, 155)";
  const layerOpacity = layers.devices.opacity;
  const fillColor = baseColor.replace(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i, (_, r, g, b) => `rgba(${r}, ${g}, ${b}, ${opacity * layerOpacity})`);
  cameraIcon.coverageConfig.fillColor = fillColor;

  const { radius, minRange = 0, doriEnabled, visible, edgeStyle } = cameraIcon.coverageConfig;
  const isInvalid = minRange >= radius;

  if (!isInvalid) {
    let coverageArea;
    const doriZones = doriEnabled ? createDoriZones(cameraIcon, fabricCanvas, commonProps) : [];

    // Create either a DORI zone group or a standard coverage polygon
    if (doriZones.length > 0) {
      coverageArea = new fabric.Group(doriZones, {
        ...commonProps,
        visible: visible && layers.devices.visible,
        isCoverage: true,
      });
    } else {
      const walls = fabricCanvas.getObjects("line").filter((l) => {
        return l.isWallLine || l.startCircle || l.endCircle;
      });

      const { startAngle, endAngle } = cameraIcon.coverageConfig;
      const points = createCoveragePoints(walls, cameraIcon, startAngle, endAngle, center.x, center.y);

      coverageArea = new fabric.Polygon(points, {
        ...commonProps,
        strokeWidth: 2,
        strokeDashArray: getStrokeDashArray(edgeStyle),
        visible: visible && layers.devices.visible,
        fill: fillColor,
        isCoverage: true,
      });
    }

    // Insert the coverage area behind the camera icon
    const camIndex = fabricCanvas.getObjects().indexOf(cameraIcon);
    if (camIndex !== -1) fabricCanvas.insertAt(coverageArea, camIndex);
    else {
      fabricCanvas.add(coverageArea);
      coverageArea.sendToBack();
      cameraIcon.bringToFront();
    }
    cameraIcon.coverageArea = coverageArea;
    coverageArea.setCoords();
  }

  // Update positions for all control handles
  const { leftRad, rightRad, midRad } = calculateIconPositions(cameraIcon, angleSpan, angleSpan >= 359.9, center);
  const shouldShow = fabricCanvas.getActiveObject() === cameraIcon && visible && layers.devices.visible;

  updateIconPosition(cameraIcon.leftResizeIcon, cameraIcon, center, leftRad, radius, 0.03, shouldShow, "left");
  updateIconPosition(cameraIcon.rightResizeIcon, cameraIcon, center, rightRad, radius, 0.03, shouldShow, "right");
  updateIconPosition(cameraIcon.rotateResizeIcon, cameraIcon, center, midRad, radius, 0.06, shouldShow, "rotate");

  // Ensure proper layering of all camera-related objects
  cameraIcon.bringToFront();
  if (cameraIcon.textObject?.visible) cameraIcon.textObject.bringToFront();

  const icons = [cameraIcon.leftResizeIcon, cameraIcon.rightResizeIcon, cameraIcon.rotateResizeIcon];
  icons.forEach((i) => i?.visible && i.bringToFront());

  fabricCanvas.requestRenderAll();
}
