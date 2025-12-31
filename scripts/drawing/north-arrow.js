import { closeSidebar, startTool, stopCurrentTool, setupDeletion, applyStandardStyling } from "./drawing-utils.js";

// Sets up north arrow tool
export function setupNorthArrowTool(fabricCanvas) {
  const northArrowBtn = document.getElementById("north-arrow-btn");

  // Configure deletion for north arrow images
  setupDeletion(fabricCanvas, (obj) => {
    return obj.type === "image" && obj.northArrowImage;
  });

  // Activates north arrow tool
  northArrowBtn.addEventListener("click", () => {
    closeSidebar();
    startTool(fabricCanvas, "north-arrow", handleNorthArrowClick);
  });

  // Places north arrow image on canvas
  function handleNorthArrowClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);

    // Load and place the north arrow image
    fabric.Image.fromURL(
      "../images/content/north-arrow.png",
      (img) => {
        img.scale(0.1);

        img.set({
          left: pointer.x,
          top: pointer.y,
          originX: "center",
          originY: "center",
          lockUniScaling: true,
          northArrowImage: true,
        });

        applyStandardStyling(img);
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        stopCurrentTool();
      },
      {
        crossOrigin: "anonymous",
      }
    );
  }
}
