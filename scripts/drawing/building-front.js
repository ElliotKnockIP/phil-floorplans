import { closeSidebar, startTool, stopCurrentTool, setupDeletion, applyStandardStyling } from "./drawing-utils.js";

export function setupBuildingFrontTool(fabricCanvas) {
  const buildingFrontBtn = document.getElementById("add-buildingfront-btn");

  let startPoint = null;
  let tempLine = null;

  // Enable deletion for groups containing triangles
  setupDeletion(fabricCanvas, (obj) => obj.type === "group" && obj._objects?.some((subObj) => subObj.type === "triangle"));

  // Activate the tool when the button is clicked
  buildingFrontBtn.addEventListener("click", () => {
    closeSidebar();
    startTool(fabricCanvas, "building-front", handleClick, handleMove);
  });

  // Handle clicks on the canvas to place arrow and text
  function handleClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);

    if (!startPoint) {
      // First click: set start point
      startPoint = { x: pointer.x, y: pointer.y };
    } else {
      // Second click: create the arrow and text group
      if (tempLine) fabricCanvas.remove(tempLine);

      const dx = pointer.x - startPoint.x;
      const dy = pointer.y - startPoint.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

      const arrow = new fabric.Triangle({
        left: pointer.x,
        top: pointer.y,
        width: 30,
        height: 50,
        fill: "grey",
        originX: "center",
        originY: "center",
        angle: angle,
        selectable: false,
        evented: false,
      });

      const textOffset = 60;
      const textX = pointer.x + textOffset * Math.cos((angle - 90) * (Math.PI / 180));
      const textY = pointer.y + textOffset * Math.sin((angle - 90) * (Math.PI / 180));

      const text = new fabric.Text("Front", {
        left: textX,
        top: textY,
        fontSize: 18,
        fill: "black",
        originX: "center",
        originY: "center",
        angle: 0,
        selectable: false,
        evented: false,
      });

      const group = new fabric.Group([arrow, text], {
        left: pointer.x,
        top: pointer.y,
      });

      group.groupType = "buildingFront";
      group.isBuildingFront = true;
      group.id = `buildingFront_${Date.now()}_${Math.random()}`;

      applyStandardStyling(group);
      fabricCanvas.add(group);
      fabricCanvas.setActiveObject(group);

      startPoint = null;
      tempLine = null;
      stopCurrentTool();
    }
  }

  // Handle mouse movement to draw a temporary line
  function handleMove(e) {
    if (!startPoint) return;

    const pointer = fabricCanvas.getPointer(e.e);

    if (tempLine) fabricCanvas.remove(tempLine);

    tempLine = new fabric.Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
      stroke: "grey",
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });

    fabricCanvas.add(tempLine);
    fabricCanvas.requestRenderAll();
  }
}
