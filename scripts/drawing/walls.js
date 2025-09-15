import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export function setupWallTool(fabricCanvas) {
  const addLineButton = document.getElementById("add-wall-btn");
  let isAddingLine = false;
  let currentLine = null;
  let lastPoint = null;
  let pointCircle = null;
  let startPointCircle = null;
  let selectedWallCircle = null;
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

  // Helpers to show/hide wall control circles when not actively drawing
  const showCirclesForWallLine = (line) => {
    if (!line || !line.isWallLine) return;
    const circles = [];
    if (line.startCircle) circles.push(line.startCircle);
    if (line.endCircle) circles.push(line.endCircle);

    circles.forEach((c) => {
      if (!c) return;
      c.set({ visible: true, selectable: true, evented: true });
      c.bringToFront();
    });
    fabricCanvas.requestRenderAll();
  };

  const hideAllWallCircles = () => {
    // Do not hide temporary circles while drawing
    if (isAddingLine) return;
    const temps = new Set(tempCircles);
    fabricCanvas.getObjects("circle").forEach((c) => {
      if (c.isWallCircle && !temps.has(c)) {
        c.set({ visible: false });
      }
    });
    fabricCanvas.requestRenderAll();
  };

  const showCirclesForConnectedSegments = (circle) => {
    if (!circle || !circle.isWallCircle) return;
    // Find segments connected to this circle and reveal their endpoints
    const segments = [...lineSegments, ...tempSegments];
    const revealed = new Set();
    segments.forEach((seg) => {
      if (seg.startCircle === circle || seg.endCircle === circle) {
        if (seg.startCircle) revealed.add(seg.startCircle);
        if (seg.endCircle) revealed.add(seg.endCircle);
      }
    });
    revealed.forEach((c) => {
      c.set({ visible: true, selectable: true, evented: true });
      c.bringToFront();
    });
    fabricCanvas.requestRenderAll();
  };

  // Styling for selected vs default wall circle
  const setCircleSelected = (circle, selected) => {
    if (!circle || !circle.isWallCircle) return;
    if (selected) {
      circle.set({ stroke: "#f8794b", strokeWidth: 3, radius: 7 });
    } else {
      circle.set({ stroke: undefined, strokeWidth: 0, radius: 4 });
    }
  };

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
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        perPixelTargetFind: true,
        borderColor: "#f8794b",
        isWallLine: true,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 2,
      });
      fabricCanvas.add(closingLine);
      // Store references on the line itself for easier lookup when deleting
      try {
        closingLine.startCircle = pointCircle;
        closingLine.endCircle = startPointCircle;
      } catch (e) {}
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
        radius: 4,
        deletable: false,
        hasControls: false,
        hasBorders: false,
        visible: false, // hide by default after finishing drawing
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
      radius: 4,
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
      startPointCircle.set({ stroke: "#00ff00", strokeWidth: 3, strokeDashArray: [4, 4], radius: 7 });
    } else {
      currentLine && fabricCanvas.remove(currentLine);
      currentLine = null;

      const newLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
        stroke: "red",
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        perPixelTargetFind: true,
        borderColor: "#f8794b",
        isWallLine: true,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 2,
      });

      // Temporarily disable undo tracking for temp objects
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      fabricCanvas.add(newLine);
      // Attach circle references to the line so deletion helpers can find connected circles
      try {
        newLine.startCircle = pointCircle;
        newLine.endCircle = newCircle;
      } catch (e) {}

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
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeMiterLimit: 2,
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
        radius: isNearStart ? 9 : 7,
      });
    }
    fabricCanvas.requestRenderAll();
  };

  // Activate wall tool on button click
  addLineButton.addEventListener("click", () => {
    if (isAddingLine) return;
    // Hide any previously revealed wall circles before starting a new drawing session
    hideAllWallCircles();
    // Clear selection state if any
    if (selectedWallCircle) {
      setCircleSelected(selectedWallCircle, false);
      selectedWallCircle = null;
    }
    isAddingLine = true;
    closeSidebar();
    cleanupTempObjects(); // Clean up any existing temp objects
    registerToolCleanup(cleanupTempObjects); // Register cleanup with drawing utils
    startTool(fabricCanvas, "wall", handleMouseDown, handleMouseMove);
  });

  // Global canvas click handler to toggle visibility of wall circles when not drawing
  fabricCanvas.on("mouse:down", (opt) => {
    if (isAddingLine) return; // ignore while actively drawing walls
    const target = opt.target;
    const isLineWithWallRefs = target && target.type === "line" && (target.startCircle || target.endCircle);
    if (target && (target.isWallLine || isLineWithWallRefs)) {
      // Clear any selected circle styling
      if (selectedWallCircle) {
        setCircleSelected(selectedWallCircle, false);
        selectedWallCircle = null;
      }
      showCirclesForWallLine(target);
    } else if (target && target.isWallCircle) {
      // Update selection styling
      if (selectedWallCircle && selectedWallCircle !== target) {
        setCircleSelected(selectedWallCircle, false);
      }
      selectedWallCircle = target;
      setCircleSelected(target, true);
      showCirclesForConnectedSegments(target);
    } else {
      // Clicked elsewhere: clear selection and hide circles
      if (selectedWallCircle) {
        setCircleSelected(selectedWallCircle, false);
        selectedWallCircle = null;
      }
      hideAllWallCircles();
    }
  });

  // Ensure any pre-existing wall circles start hidden and existing wall lines use rounded caps/joins on init
  setTimeout(() => {
    hideAllWallCircles();
    fabricCanvas.getObjects("line").forEach((ln) => {
      if (ln.isWallLine || ln.startCircle || ln.endCircle) {
        ln.set({ strokeLineCap: "round", strokeLineJoin: "round", strokeMiterLimit: 2, hasBorders: false, hasControls: false });
      }
    });
    fabricCanvas.requestRenderAll();
  }, 0);
}
