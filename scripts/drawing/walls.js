import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export function setupWallTool(fabricCanvas) {
  const addLineButton = document.getElementById("add-wall-btn");
  let isAddingLine = false;
  let currentLine = null;
  let lastPoint = null;
  let pointCircle = null;
  let startPointCircle = null;
  const lineSegments = [];
  const tempSegments = [];
  const tempCircles = [];

  const CLOSE_DISTANCE_THRESHOLD = 25;
  const MIN_POINTS_FOR_COMPLETION = 2;

  // Calculate distance between two points
  const calculateDistance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

  // Check if cursor is near start point to close the loop
  const isCloseToStart = (pointer) => tempSegments.length >= MIN_POINTS_FOR_COMPLETION && startPointCircle && calculateDistance(pointer, startPointCircle.getCenterPoint()) <= CLOSE_DISTANCE_THRESHOLD;

  // Cleanup function for temporary objects
  function cleanupTempObjects() {
    // Remove temporary segments
    tempSegments.forEach((segment) => {
      if (segment.line) fabricCanvas.remove(segment.line);
    });
    tempSegments.length = 0;

    // Remove temporary circles
    tempCircles.forEach((circle) => {
      if (circle) fabricCanvas.remove(circle);
    });
    tempCircles.length = 0;

    // Remove current preview line
    if (currentLine) {
      fabricCanvas.remove(currentLine);
      currentLine = null;
    }

    // Reset state
    lastPoint = null;
    pointCircle = null;
    startPointCircle = null;
    isAddingLine = false;

    fabricCanvas.requestRenderAll();

    // Force update all camera coverage areas after wall cleanup
    setTimeout(() => {
      fabricCanvas.getObjects("group").forEach((obj) => {
        if (obj.type === "group" && obj.deviceType && obj.coverageConfig && obj.createOrUpdateCoverageArea) {
          obj.createOrUpdateCoverageArea();
        }
      });
      fabricCanvas.requestRenderAll();
    }, 50);
  }

  // Ensure circles stay on top
  fabricCanvas.on("object:added", () => (fabricCanvas.getObjects("circle").forEach((circle) => circle.bringToFront()), fabricCanvas.requestRenderAll()));

  // Update lines when a circle moves
  const updateConnectedLines = (circle) => {
    const center = circle.getCenterPoint();
    [...lineSegments, ...tempSegments].forEach((segment) => {
      if (segment.startCircle === circle) segment.line.set({ x1: center.x, y1: center.y }), segment.line.setCoords();
      if (segment.endCircle === circle) segment.line.set({ x2: center.x, y2: center.y }), segment.line.setCoords();
    });
    fabricCanvas.requestRenderAll();
  };

  // Complete the wall loop by connecting to start point
  const completeWallLoop = () => {
    currentLine && fabricCanvas.remove(currentLine);
    currentLine = null;

    if (lastPoint && startPointCircle) {
      const startCenter = startPointCircle.getCenterPoint();
      const closingLine = new fabric.Line([lastPoint.x, lastPoint.y, startCenter.x, startCenter.y], {
        stroke: "red",
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: true,
        lockMovementX: true,
        lockMovementY: true,
        perPixelTargetFind: true,
        borderColor: "#f8794b",
      });
      fabricCanvas.add(closingLine);
      tempSegments.push({ line: closingLine, startCircle: pointCircle, endCircle: startPointCircle });
    }
    finalizeTempSegments();
  };

  // Finalize temporary segments and reset state
  const finalizeTempSegments = () => {
    // Create arrays of all objects that were created in this wall drawing session
    const newLines = tempSegments.map((segment) => segment.line);
    const newCircles = [...tempCircles];

    // Add to permanent storage
    tempSegments.forEach((segment) => lineSegments.push(segment));
    tempSegments.length = 0;

    // Update circle properties
    tempCircles.forEach((circle) =>
      circle.set({
        selectable: true,
        hoverCursor: "pointer",
        fill: "black",
        stroke: undefined,
        strokeWidth: 0,
        strokeDashArray: undefined,
        radius: 3,
        deletable: false,
        hasControls: false,
        hasBorders: false,
      })
    );
    tempCircles.length = 0;

    // Create a single undo command for all the wall objects created in this session
    if (window.undoSystem && (newLines.length > 0 || newCircles.length > 0)) {
      if (!window.undoSystem.isExecutingCommand) {
        const wasExecuting = window.undoSystem.isExecutingCommand;
        window.undoSystem.isExecutingCommand = true;

        try {
          const commands = [];

          newLines.forEach((line) => {
            commands.push(new window.UndoCommands.AddCommand(fabricCanvas, line, []));
          });

          newCircles.forEach((circle) => {
            commands.push(new window.UndoCommands.AddCommand(fabricCanvas, circle, []));
          });

          const wallCommand = new window.UndoCommands.MultipleCommand(commands);
          window.undoSystem.addToStack(wallCommand);
        } finally {
          window.undoSystem.isExecutingCommand = wasExecuting;
        }
      }
    }

    resetDrawingState();
    fabricCanvas.getObjects("group").forEach((obj) => obj.coverageConfig && obj.createOrUpdateCoverageArea && obj.createOrUpdateCoverageArea());
    fabricCanvas.requestRenderAll();
  };

  // Reset drawing state
  const resetDrawingState = () => {
    cleanupTempObjects();
    stopCurrentTool();
  };

  // Handle mouse down to place points and draw lines
  const handleMouseDown = (o) => {
    o.e.preventDefault();
    o.e.stopPropagation();
    const pointer = fabricCanvas.getPointer(o.e);

    if (isCloseToStart(pointer)) return completeWallLoop();

    const newCircle = new fabric.Circle({
      left: pointer.x,
      top: pointer.y,
      radius: 3,
      fill: "black",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: true,
      hasControls: false,
      isWallCircle: true,
      borderColor: "#f8794b",
      deletable: false,
    });

    newCircle.on("moving", () => updateConnectedLines(newCircle));

    // Temporarily disable undo tracking for temp objects
    const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

    fabricCanvas.add(newCircle);

    if (window.undoSystem) window.undoSystem.isExecutingCommand = wasExecuting;

    tempCircles.push(newCircle);
    newCircle.bringToFront();

    if (!lastPoint) {
      lastPoint = { x: pointer.x, y: pointer.y };
      pointCircle = newCircle;
      startPointCircle = newCircle;
      startPointCircle.set({ stroke: "#00ff00", strokeWidth: 3, strokeDashArray: [4, 4], radius: 6 });
    } else {
      currentLine && fabricCanvas.remove(currentLine);
      currentLine = null;

      const newLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
        stroke: "red",
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: true,
        lockMovementX: true,
        lockMovementY: true,
        perPixelTargetFind: true,
        borderColor: "#f8794b",
      });

      // Temporarily disable undo tracking for temp objects
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      fabricCanvas.add(newLine);

      if (window.undoSystem) window.undoSystem.isExecutingCommand = wasExecuting;

      tempSegments.push({ line: newLine, startCircle: pointCircle, endCircle: newCircle });
      lastPoint = { x: pointer.x, y: pointer.y };
      pointCircle = newCircle;
    }
    fabricCanvas.requestRenderAll();
  };

  // Handle mouse movement to preview lines
  const handleMouseMove = (o) => {
    if (!lastPoint) return;
    const pointer = fabricCanvas.getPointer(o.e);

    if (!currentLine) {
      currentLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
        stroke: "red",
        strokeWidth: 3,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        perPixelTargetFind: true,
      });

      // Temporarily disable undo tracking for preview line
      const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      fabricCanvas.add(currentLine);

      if (window.undoSystem) window.undoSystem.isExecutingCommand = wasExecuting;
    } else {
      currentLine.set({ x2: pointer.x, y2: pointer.y });
    }

    const isNearStart = isCloseToStart(pointer);
    currentLine.set({ stroke: isNearStart ? "#00ff00" : "red", strokeWidth: isNearStart ? 4 : 3 });
    fabricCanvas.setCursor(isNearStart ? "pointer" : "crosshair");

    if (startPointCircle) {
      startPointCircle.set({
        stroke: "#00ff00",
        strokeWidth: isNearStart ? 4 : 3,
        radius: isNearStart ? 8 : 6,
      });
    }
    fabricCanvas.requestRenderAll();
  };

  // Activate wall tool on button click
  addLineButton.addEventListener("click", () => {
    if (isAddingLine) return;
    isAddingLine = true;
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "wall", handleMouseDown, handleMouseMove);
  });
}
