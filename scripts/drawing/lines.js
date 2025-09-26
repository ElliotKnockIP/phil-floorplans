import { closeSidebar, startTool, stopCurrentTool, setupDeletion, registerToolCleanup } from "./drawing-utils.js";

// Sets up line, connection, and arrow drawing tools
export function setupLineTools(fabricCanvas) {
  const lineBtn = document.getElementById("add-line-btn");
  const connectionBtn = document.getElementById("add-connection-btn");
  const arrowBtn = document.getElementById("add-arrow-btn");

  let startPoint = null;
  let tempObject = null;

  // Enable deletion of lines and arrows
  setupDeletion(fabricCanvas, (obj) => obj.type === "line" || obj.type === "arrow" || (obj.type === "group" && obj.isArrow));

  // Cleanup function for temporary objects
  function cleanupTempObjects() {
    if (tempObject) {
      fabricCanvas.remove(tempObject);
      tempObject = null;
    }
    startPoint = null;
    fabricCanvas.requestRenderAll();
  }

  // Activate line tool
  lineBtn.addEventListener("click", () => {
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "line", handleLineClick, handleLineMove);
  });

  // Activate connection tool
  connectionBtn.addEventListener("click", () => {
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "connection", handleConnectionClick, handleConnectionMove);
  });

  // Activate arrow tool
  arrowBtn.addEventListener("click", () => {
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "arrow", handleArrowClick, handleArrowMove);
  });

  // Handle line click events
  function handleLineClick(e) {
    lineClick(e, "green", false);
  }

  // Handle connection click events
  function handleConnectionClick(e) {
    lineClick(e, "grey", true);
  }

  // Handle arrow click events
  function handleArrowClick(e) {
    arrowClick(e);
  }

  // Handle line movement
  function handleLineMove(e) {
    lineMove(e, "green", false);
  }

  // Handle connection movement
  function handleConnectionMove(e) {
    lineMove(e, "grey", true);
  }

  // Handle arrow movement
  function handleArrowMove(e) {
    arrowMove(e);
  }

  // Create line or connection on click
  function lineClick(e, color, dashed) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);

    if (!startPoint) {
      startPoint = { x: pointer.x, y: pointer.y };
    } else {
      // Clean up temp object before creating final line
      if (tempObject) fabricCanvas.remove(tempObject);

      const line = new fabric.Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
        stroke: color,
        strokeWidth: 2,
        strokeDashArray: dashed ? [5, 5] : null,
        selectable: true,
        hasControls: false,
        borderColor: "#f8794b",
        cornerColor: "#f8794b",
        isConnectionLine: dashed, // Mark connection lines for proper save/load
      });

      // Temporarily disable undo tracking for individual objects
      const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      fabricCanvas.add(line);
      fabricCanvas.setActiveObject(line);

      // Re-enable undo tracking and create a single command for the line
      if (window.undoSystem) {
        window.undoSystem.isExecutingCommand = wasExecuting;
        const command = new window.UndoCommands.AddCommand(fabricCanvas, line, []);
        window.undoSystem.addToStack(command);
      }

      // Reset state and stop tool
      startPoint = null;
      tempObject = null;
      stopCurrentTool();
    }
  }

  // Preview line or connection during movement
  function lineMove(e, color, dashed) {
    if (!startPoint) return;

    const pointer = fabricCanvas.getPointer(e.e);

    // Remove existing temp object
    if (tempObject) fabricCanvas.remove(tempObject);

    tempObject = new fabric.Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
      stroke: color,
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });

    fabricCanvas.add(tempObject);
    fabricCanvas.requestRenderAll();
  }

  // Create arrow on click
  function arrowClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);

    if (!startPoint) {
      startPoint = { x: pointer.x, y: pointer.y };
    } else {
      // Clean up temp object before creating final arrow
      if (tempObject) fabricCanvas.remove(tempObject);

      const arrow = createArrow(startPoint, pointer);

      // Temporarily disable undo tracking for individual objects
      const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      fabricCanvas.add(arrow);
      fabricCanvas.setActiveObject(arrow);

      // Re-enable undo tracking and create a single command for the arrow
      if (window.undoSystem) {
        window.undoSystem.isExecutingCommand = wasExecuting;
        const command = new window.UndoCommands.AddCommand(fabricCanvas, arrow, []);
        window.undoSystem.addToStack(command);
      }

      // Reset state and stop tool
      startPoint = null;
      tempObject = null;
      stopCurrentTool();
    }
  }

  // Preview arrow during movement
  function arrowMove(e) {
    if (!startPoint) return;

    const pointer = fabricCanvas.getPointer(e.e);

    // Remove existing temp object
    if (tempObject) fabricCanvas.remove(tempObject);

    tempObject = createArrow(startPoint, pointer, true);
    fabricCanvas.add(tempObject);
    fabricCanvas.requestRenderAll();
  }

  // Create arrow group with line and arrowhead
  function createArrow(start, end, isPreview = false) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);

    const line = new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: "blue",
      strokeWidth: isPreview ? 3 : 2,
      strokeDashArray: isPreview ? [5, 5] : null,
      selectable: !isPreview,
      evented: !isPreview,
    });

    const arrowHead = new fabric.Triangle({
      left: end.x,
      top: end.y,
      originX: "center",
      originY: "center",
      width: 10,
      height: 10,
      fill: "blue",
      angle: (angle * 180) / Math.PI + 90,
      selectable: false,
      evented: false,
    });

    const group = new fabric.Group([line, arrowHead], {
      selectable: !isPreview,
      hasControls: false,
      borderColor: "#f8794b",
      cornerColor: "#f8794b",
      isArrow: true,
    });

    return group;
  }

  // Expose cleanup function so it can be called externally if needed
  window.cleanupLinesTempObjects = cleanupTempObjects;
}
