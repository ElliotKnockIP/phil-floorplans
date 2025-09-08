import { closeSidebar, setDefaultCursor, setupDeletion, applyStandardStyling } from "./drawing-utils.js";

export function setupImageUploadTool(fabricCanvas) {
  const button = document.getElementById("upload-image-btn");
  // Enable deletion for uploaded images (only when unlocked)
  setupDeletion(fabricCanvas, (obj) => obj.type === "image" && obj.isUploadedImage && !obj.isLocked);

  // Set up lock/unlock functionality
  setupImageLockUnlock(fabricCanvas);

  // Handle image upload when button is clicked
  button.addEventListener("click", () => {
    closeSidebar();

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    document.body.appendChild(fileInput);
    fileInput.click();

    // Read and add the uploaded image to the canvas
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imgElement = new Image();
          imgElement.src = event.target.result;

          imgElement.onload = () => {
            const fabricImage = new fabric.Image(imgElement, {
              left: fabricCanvas.getWidth() / 2,
              top: fabricCanvas.getHeight() / 2,
              originX: "center",
              originY: "center",
              isUploadedImage: true,
              isLocked: false, // Start unlocked
            });

            // Scale image if too large
            const maxWidth = fabricCanvas.getWidth() * 0.8;
            const maxHeight = fabricCanvas.getHeight() * 0.8;
            if (fabricImage.width > maxWidth || fabricImage.height > maxHeight) {
              const scale = Math.min(maxWidth / fabricImage.width, maxHeight / fabricImage.height);
              fabricImage.scale(scale);
            }

            applyStandardStyling(fabricImage);
            fabricCanvas.add(fabricImage);
            fabricCanvas.setActiveObject(fabricImage);
            setDefaultCursor(fabricCanvas);
            fabricCanvas.requestRenderAll();
          };
        };
        reader.readAsDataURL(file);
      }

      document.body.removeChild(fileInput);
    });
  });
}

// Set up lock/unlock functionality for images
function setupImageLockUnlock(fabricCanvas) {
  fabric.Object.prototype.controls.lockControl = new fabric.Control({
    x: 0,
    y: -0.5,
    offsetY: -60,
    cursorStyle: "pointer",
    sizeX: 40,
    sizeY: 40,
    mouseUpHandler: function (eventData, transform) {
      const target = transform.target;
      if (target && target.type === "image" && target.isUploadedImage) {
        toggleImageLock(target, fabricCanvas);
      }
      return true;
    },
    render: function (ctx, left, top, styleOverride, fabricObject) {
      if (!fabricObject.isUploadedImage) return;

      const size = 24;
      const isLocked = fabricObject.isLocked || false;

      // Draw background circle
      ctx.save();
      ctx.translate(left, top);
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
      ctx.fillStyle = isLocked ? "#ff4444" : "#4CAF50";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw lock/unlock icon
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isLocked ? "🔒" : "🔓", 0, 0);

      ctx.restore();
    },
    getVisibility: function (fabricObject) {
      return fabricObject.isUploadedImage && fabricCanvas.getActiveObject() === fabricObject;
    },
  });
}

// Toggle lock/unlock state of an image
function toggleImageLock(imageObj, fabricCanvas) {
  const isCurrentlyLocked = imageObj.isLocked || false;

  if (isCurrentlyLocked) {
    // Unlock the image
    unlockImage(imageObj, fabricCanvas);
  } else {
    // Lock the image
    lockImage(imageObj, fabricCanvas);
  }
}

// Lock an image (make it non-draggable but keep it clickable for selection)
function lockImage(imageObj, fabricCanvas) {
  imageObj.set({
    isLocked: true,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
  });

  // Show only the lock control when locked
  imageObj.setControlsVisibility({
    lockControl: true,
    mtr: false,
    ml: false,
    mr: false,
    mt: false,
    mb: false,
    tl: false,
    tr: false,
    bl: false,
    br: false,
  });

  fabricCanvas.requestRenderAll();
}

// Unlock an image (restore draggable and selectable state)
function unlockImage(imageObj, fabricCanvas) {
  imageObj.set({
    isLocked: false,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    lockRotation: false,
    lockScalingX: false,
    lockScalingY: false,
  });

  // Show all controls when unlocked, including our custom lock control
  imageObj.setControlsVisibility({
    lockControl: true,
    mtr: true,
    ml: true,
    mr: true,
    mt: true,
    mb: true,
    tl: true,
    tr: true,
    bl: true,
    br: true,
  });

  // Reapply standard styling
  applyStandardStyling(imageObj);

  fabricCanvas.requestRenderAll();
}
