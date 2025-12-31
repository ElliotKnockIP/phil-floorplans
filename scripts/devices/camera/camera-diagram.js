// Renders a side-view diagram of camera coverage on a 2D canvas
export function drawSideView(canvas, height, tilt, distance, deadZone, fov) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const canvasHeight = canvas.height;

  // Clear the canvas before redrawing
  context.clearRect(0, 0, width, canvasHeight);

  const margin = 40;
  const groundY = canvasHeight - margin;

  // Calculate the horizontal range to display in the diagram
  const backDistance = deadZone && deadZone < 0 ? Math.abs(deadZone) : 0;
  const forwardDistance = Math.max(distance || 0, deadZone > 0 ? deadZone : 0, 10);

  const totalMeters = backDistance + forwardDistance;
  const maxDistanceShown = Math.max(totalMeters * 1.2, 30);

  const availableWidth = width - 2 * margin;
  const scaleX = availableWidth / maxDistanceShown;

  // Position the camera horizontally based on the dead zone
  const cameraX = margin + 40 + backDistance * scaleX;

  const maxHeightShown = Math.max(height * 1.5, 6);
  const scaleY = (canvasHeight - 2 * margin) / maxHeightShown;

  // Draw the ground line
  context.beginPath();
  context.moveTo(margin, groundY);
  context.lineTo(width - margin, groundY);
  context.strokeStyle = "#333";
  context.lineWidth = 2;
  context.stroke();

  // Draw the vertical pole representing camera height
  const cameraY = groundY - height * scaleY;

  context.beginPath();
  context.moveTo(cameraX, groundY);
  context.lineTo(cameraX, cameraY);
  context.strokeStyle = "#666";
  context.lineWidth = 1;
  context.stroke();

  // Add height label text next to the pole
  context.fillStyle = "#333";
  context.font = "11px Arial";
  context.fontWeight = "500";
  context.textAlign = "center";
  context.fillText(`${height.toFixed(2)}m`, cameraX - 18, groundY - (height * scaleY) / 2);

  // Draw the camera body and lens with rotation
  context.save();
  context.translate(cameraX, cameraY);
  context.rotate((tilt * Math.PI) / 180);

  context.fillStyle = "#f8794b";
  context.beginPath();
  context.rect(-8, -4, 16, 8);
  context.fill();
  context.strokeStyle = "#ea6036";
  context.lineWidth = 1;
  context.stroke();

  context.fillStyle = "#ea6036";
  context.beginPath();
  context.arc(8, 0, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Calculate the starting point for FOV rays at the lens
  const lensOffsetX = 8 * Math.cos((tilt * Math.PI) / 180);
  const lensOffsetY = 8 * Math.sin((tilt * Math.PI) / 180);
  const lensX = cameraX + lensOffsetX;
  const lensY = cameraY + lensOffsetY;

  const halfFov = (fov || 60) / 2;

  // Calculate angles for the top and bottom boundaries of the FOV
  const bottomRayAngleRad = ((tilt + halfFov) * Math.PI) / 180;
  const topRayAngleRad = ((tilt - halfFov) * Math.PI) / 180;

  const bottomDirX = Math.cos(bottomRayAngleRad);
  const bottomDirY = Math.sin(bottomRayAngleRad);
  const topDirX = Math.cos(topRayAngleRad);
  const topDirY = Math.sin(topRayAngleRad);

  const deltaY = groundY - lensY;
  let bottomPoint = null;

  // Determine where the bottom ray hits the ground or canvas edge
  if (bottomDirY > 0.001) {
    const tGround = deltaY / bottomDirY;
    bottomPoint = { x: lensX + bottomDirX * tGround, y: groundY };
  }

  if (!bottomPoint) {
    const targetX = bottomDirX >= 0 ? width - margin : margin;
    if (Math.abs(bottomDirX) > 0.001) {
      const tEdge = (targetX - lensX) / bottomDirX;
      if (tEdge > 0) {
        bottomPoint = { x: targetX, y: lensY + bottomDirY * tEdge };
      }
    }
  }

  if (!bottomPoint) {
    bottomPoint = { x: width - margin, y: lensY };
  }

  let topGroundPoint = null;
  let topGroundMeters = null;

  // Determine where the top ray hits the ground
  if (topDirY > 0.001) {
    const tGround = deltaY / topDirY;
    if (tGround > 0) {
      const xGround = lensX + topDirX * tGround;
      topGroundPoint = { x: xGround, y: groundY };
      topGroundMeters = (xGround - cameraX) / scaleX;
    }
  }

  let topPoint;

  // Calculate the endpoint for the top ray, extending to canvas edge if needed
  if (topGroundPoint && topGroundPoint.x <= width - margin) {
    topPoint = topGroundPoint;
  } else {
    const maxProjectionDistance = maxDistanceShown * 2;
    const projectedX = lensX + topDirX * maxProjectionDistance;
    const projectedY = lensY + topDirY * maxProjectionDistance;

    const rightEdge = width - margin;
    const topEdge = margin;

    let finalX = projectedX;
    let finalY = projectedY;

    if (topDirX > 0.001) {
      const tRight = (rightEdge - lensX) / topDirX;
      if (tRight > 0) {
        const yAtRight = lensY + topDirY * tRight;
        if (yAtRight >= topEdge && yAtRight <= groundY) {
          finalX = rightEdge;
          finalY = yAtRight;
        }
      }
    }

    if (topDirY < -0.001 && Math.abs(topDirX) > 0.001) {
      const tTop = (topEdge - lensY) / topDirY;
      if (tTop > 0) {
        const xAtTop = lensX + topDirX * tTop;
        if (xAtTop >= margin && xAtTop <= rightEdge) {
          finalX = xAtTop;
          finalY = topEdge;
        }
      }
    }

    topPoint = { x: finalX, y: Math.max(topEdge, Math.min(finalY, groundY)) };
  }

  // Draw dashed lines representing the FOV boundaries
  context.beginPath();
  context.setLineDash([4, 4]);
  context.strokeStyle = "#4a90e2";
  context.lineWidth = 1.5;

  context.moveTo(lensX, lensY);
  context.lineTo(bottomPoint.x, bottomPoint.y);

  context.moveTo(lensX, lensY);
  context.lineTo(topPoint.x, topPoint.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#333";
  context.font = "11px Arial";
  context.fontWeight = "500";
  context.textAlign = "center";

  const isDeadZoneValid = typeof deadZone === "number" && !Number.isNaN(deadZone);
  const bottomDistanceMeters = isDeadZoneValid ? deadZone : (bottomPoint.x - cameraX) / scaleX;

  // Draw the dead zone measurement indicator if applicable
  if (bottomDistanceMeters > 0.05) {
    const deadZoneMeters = bottomDistanceMeters;
    const deadZoneStartX = cameraX;
    const deadZoneEndX = bottomPoint.x;

    if (deadZoneEndX < width - margin + 1) {
      context.fillStyle = "#e74c3c";
      const textX = deadZoneStartX + (deadZoneEndX - deadZoneStartX) / 2;
      context.fillText(`Dead: ${deadZoneMeters.toFixed(2)}m`, textX, groundY + 15);
      context.beginPath();
      context.moveTo(deadZoneStartX, groundY + 5);
      context.lineTo(deadZoneEndX, groundY + 5);
      context.strokeStyle = "#e74c3c";
      context.lineWidth = 2;
      context.stroke();
    }
  } else if (bottomDistanceMeters < -0.05) {
    // Draw backward coverage measurement for cameras looking behind the pole
    const absDist = Math.abs(bottomDistanceMeters);
    const backStartX = bottomPoint.x;
    const backEndX = cameraX;

    if (backStartX > margin - 1) {
      context.fillStyle = "#9b59b6";
      context.fillText(`Back: ${absDist.toFixed(2)}m`, backStartX + (backEndX - backStartX) / 2, groundY + 15);
      context.beginPath();
      context.moveTo(backStartX, groundY + 5);
      context.lineTo(backEndX, groundY + 5);
      context.strokeStyle = "#9b59b6";
      context.lineWidth = 2;
      context.stroke();
    }

    // Draw forward coverage measurement if the camera has split coverage
    const forwardDist = distance;
    if (forwardDist > 0.05 && topGroundPoint) {
      const rangeStartX = cameraX;
      const rangeEndX = topGroundPoint.x;
      if (rangeEndX < width - margin + 1) {
        context.fillStyle = "#27ae60";
        const textX = rangeStartX + (rangeEndX - rangeStartX) / 2;
        context.fillText(`Range: ${forwardDist.toFixed(2)}m`, textX, groundY + 30);
        context.beginPath();
        context.moveTo(rangeStartX, groundY + 20);
        context.lineTo(rangeEndX, groundY + 20);
        context.strokeStyle = "#27ae60";
        context.lineWidth = 2;
        context.stroke();
      }
    }
  }
}
