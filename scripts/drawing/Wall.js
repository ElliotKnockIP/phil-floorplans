// Wall class handles wall drawing and editing on the canvas
import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export class Wall {
  // Initializes wall tool state and properties
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.isAddingLine = false;
    this.currentLine = null;
    this.lastPoint = null;
    this.pointCircle = null;
    this.startPointCircle = null;
    this.selectedWallCircle = null;
    this.justCompleted = false;
    this.lineSegments = [];
    this.tempSegments = [];
    this.tempCircles = [];

    this.CLOSE_DISTANCE_THRESHOLD = 25;
    this.MIN_POINTS_FOR_COMPLETION = 2;

    // Default properties for wall lines
    this.WALL_LINE_PROPS = {
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
    };

    // Default properties for wall vertex circles
    this.WALL_CIRCLE_PROPS = {
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
      hoverCursor: "move",
      moveCursor: "move",
    };

    // Default properties for the preview line during drawing
    this.PREVIEW_LINE_PROPS = {
      stroke: "red",
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      perPixelTargetFind: true,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeMiterLimit: 2,
    };

    this.init();
  }

  // Rebinds events for existing wall lines and circles after loading
  rebindWallEvents() {
    this.lineSegments = [];
    this.fabricCanvas.getObjects().forEach((obj) => {
      if (obj.isWallLine && obj.startCircle && obj.endCircle) {
        this.lineSegments.push({
          line: obj,
          startCircle: obj.startCircle,
          endCircle: obj.endCircle,
        });
        obj.off("removed");
        obj.on("removed", () => this.handleWallLineDeletion(obj));
      }
      if (obj.isWallCircle) {
        obj.off("moving");
        obj.on("moving", () => this.updateConnectedLines(obj));
      }
    });
    this.hideAllWallCircles();
  }

  // Handles deletion of a wall line and cleans up orphaned circles
  handleWallLineDeletion(deletedLine) {
    this.lineSegments = this.lineSegments.filter((s) => s.line !== deletedLine);
    const remaining = this.fabricCanvas.getObjects().filter((obj) => {
      return obj.type === "line" && !obj.deviceType && !obj.isResizeIcon && !obj.isConnectionLine && obj !== deletedLine;
    });
    [deletedLine.startCircle, deletedLine.endCircle]
      .filter((c) => c && this.fabricCanvas.getObjects().includes(c))
      .forEach((c) => {
        if (!remaining.some((l) => l.startCircle === c || l.endCircle === c)) this.fabricCanvas.remove(c);
      });
    this.updateCoverage();
  }

  // Initializes the wall tool and sets up global listeners
  init() {
    const addLineButton = document.getElementById("add-wall-btn");
    if (addLineButton) {
      addLineButton.addEventListener("click", () => this.activate());
    }

    this.fabricCanvas.on("mouse:down", (opt) => this.handleGlobalMouseDown(opt));
    this.fabricCanvas.on("object:added", () => {
      this.fabricCanvas.getObjects("circle").forEach((circle) => circle.bringToFront());
    });

    // Listens for walls loaded event to rebind
    document.addEventListener("walls:loaded", () => {
      this.rebindWallEvents();
      this.updateCoverage();
    });

    this.rebindWallEvents();

    setTimeout(() => {
      this.hideAllWallCircles();
      this.fabricCanvas.getObjects("line").forEach((ln) => {
        if (ln.isWallLine || ln.startCircle || ln.endCircle)
          ln.set({
            strokeLineCap: "round",
            strokeLineJoin: "round",
            strokeMiterLimit: 2,
            hasBorders: false,
            hasControls: false,
          });
      });
      this.fabricCanvas.requestRenderAll();
    }, 0);
  }

  // Calculates distance between two points
  calculateDistance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  // Checks if pointer is near the starting point to close the loop
  isCloseToStart(pointer) {
    const hasMinPoints = this.tempSegments.length >= this.MIN_POINTS_FOR_COMPLETION;
    if (!hasMinPoints || !this.startPointCircle) return false;

    const dist = this.calculateDistance(pointer, this.startPointCircle.getCenterPoint());
    return dist <= this.CLOSE_DISTANCE_THRESHOLD;
  }

  // Disables undo system during drawing
  disableUndo() {
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;
  }

  // Enables undo system after drawing
  enableUndo() {
    if (window.undoSystem) window.undoSystem.isExecutingCommand = false;
  }

  // Creates a new wall line segment
  createWallLine(x1, y1, x2, y2, startCircle, endCircle) {
    const line = new fabric.Line([x1, y1, x2, y2], this.WALL_LINE_PROPS);
    line.set({ selectable: false, evented: true });
    line.startCircle = startCircle;
    line.endCircle = endCircle;
    return line;
  }

  // Creates a new wall vertex circle
  createWallCircle(x, y) {
    const circle = new fabric.Circle({ ...this.WALL_CIRCLE_PROPS, left: x, top: y });
    circle.set({ selectable: false, evented: true });
    circle.on("moving", () => this.updateConnectedLines(circle));
    return circle;
  }

  // Updates coverage areas for all devices
  updateCoverage() {
    const wasSelection = this.fabricCanvas.selection;
    this.fabricCanvas.selection = false;

    this.fabricCanvas.getObjects("group").forEach((obj) => {
      if (obj.type === "group" && obj.deviceType && obj.coverageConfig && obj.createOrUpdateCoverageArea) {
        obj.lastCoverageState = null;
        obj.createOrUpdateCoverageArea();
      }
    });

    this.fabricCanvas.selection = wasSelection;
    this.fabricCanvas.requestRenderAll();
  }

  // Removes temporary drawing objects
  cleanupTempObjects() {
    this.tempSegments.forEach(({ line }) => this.fabricCanvas.remove(line));
    this.tempSegments.length = 0;
    this.tempCircles.forEach((circle) => this.fabricCanvas.remove(circle));
    this.tempCircles.length = 0;
    if (this.currentLine) this.fabricCanvas.remove(this.currentLine), (this.currentLine = null);
    this.lastPoint = null;
    this.pointCircle = null;
    this.startPointCircle = null;
    this.isAddingLine = false;
    this.fabricCanvas.requestRenderAll();
    setTimeout(() => this.updateCoverage(), 50);
  }

  // Finds all circles connected to a starting circle
  getAllConnectedCircles(startCircle) {
    const connectedCircles = new Set([startCircle]);
    const queue = [startCircle];
    const visitedLines = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      const segments = [...this.lineSegments, ...this.tempSegments].filter((s) => {
        const isConnected = s.startCircle === current || s.endCircle === current;
        return isConnected && !visitedLines.has(s.line);
      });

      segments.forEach((seg) => {
        visitedLines.add(seg.line);
        const neighbor = seg.startCircle === current ? seg.endCircle : seg.startCircle;
        if (neighbor && !connectedCircles.has(neighbor)) {
          connectedCircles.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    return connectedCircles;
  }

  // Shows circles for all segments connected to a line
  showCirclesForWallLine(line) {
    if (!line || !line.isWallLine) return;
    const startNode = line.startCircle || line.endCircle;
    if (!startNode) return;

    const allCircles = this.getAllConnectedCircles(startNode);
    allCircles.forEach((c) => {
      c.set({ visible: true, selectable: true, evented: true });
      c.bringToFront();
    });
    this.fabricCanvas.requestRenderAll();
  }

  // Hides all wall vertex circles
  hideAllWallCircles() {
    if (this.isAddingLine) return;
    const temps = new Set(this.tempCircles);
    this.fabricCanvas.getObjects("circle").forEach((c) => {
      if (c.isWallCircle && !temps.has(c)) c.set({ visible: false });
    });
    this.fabricCanvas.requestRenderAll();
  }

  // Shows circles for all segments connected to a circle
  showCirclesForConnectedSegments(circle) {
    if (!circle || !circle.isWallCircle) return;
    const allCircles = this.getAllConnectedCircles(circle);
    allCircles.forEach((c) => {
      c.set({ visible: true, selectable: true, evented: true });
      c.bringToFront();
    });
    this.fabricCanvas.requestRenderAll();
  }

  // Sets selection styling for a wall circle
  setCircleSelected(circle, selected) {
    if (!circle || !circle.isWallCircle) return;

    const selectedProps = { stroke: "#f8794b", strokeWidth: 3, radius: 7 };
    const defaultProps = { stroke: undefined, strokeWidth: 0, radius: 4 };

    circle.set(selected ? selectedProps : defaultProps);
  }

  // Updates line positions when a connected circle moves
  updateConnectedLines(circle) {
    const center = circle.getCenterPoint();
    [...this.lineSegments, ...this.tempSegments].forEach(({ line }) => {
      if (line.startCircle === circle) line.set({ x1: center.x, y1: center.y }), line.setCoords();
      if (line.endCircle === circle) line.set({ x2: center.x, y2: center.y }), line.setCoords();
    });
    this.updateCoverage();
    this.fabricCanvas.requestRenderAll();
  }

  // Closes the wall loop by connecting to the start
  completeWallLoop() {
    if (this.currentLine) this.fabricCanvas.remove(this.currentLine), (this.currentLine = null);
    if (this.lastPoint && this.startPointCircle) {
      const startCenter = this.startPointCircle.getCenterPoint();
      const closingLine = this.createWallLine(this.lastPoint.x, this.lastPoint.y, startCenter.x, startCenter.y, this.pointCircle, this.startPointCircle);
      this.fabricCanvas.add(closingLine);
      this.tempSegments.push({
        line: closingLine,
        startCircle: this.pointCircle,
        endCircle: this.startPointCircle,
      });
    }
    this.finalizeTempSegments();
    this.justCompleted = true;
  }

  // Converts temporary segments to permanent wall objects
  finalizeTempSegments() {
    const newLines = this.tempSegments.map((s) => s.line);
    const newCircles = [...this.tempCircles];
    this.tempSegments.forEach((s) => this.lineSegments.push(s));
    this.tempSegments.length = 0;
    this.tempCircles.forEach((c) =>
      c.set({
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
        visible: false,
      })
    );
    this.tempCircles.length = 0;

    if (window.undoSystem && (newLines.length || newCircles.length) && !window.undoSystem.isExecutingCommand) {
      const wasExecuting = window.undoSystem.isExecutingCommand;
      window.undoSystem.isExecutingCommand = true;
      try {
        const lineCommands = newLines.map((l) => {
          return new window.UndoCommands.AddCommand(this.fabricCanvas, l, []);
        });
        const circleCommands = newCircles.map((c) => {
          return new window.UndoCommands.AddCommand(this.fabricCanvas, c, []);
        });

        const commands = [...lineCommands, ...circleCommands];
        const multipleCommand = new window.UndoCommands.MultipleCommand(commands);
        window.undoSystem.addToStack(multipleCommand);
      } finally {
        window.undoSystem.isExecutingCommand = wasExecuting;
      }
    }

    this.resetDrawingState();
    this.updateCoverage();
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.requestRenderAll();
  }

  // Resets drawing state and stops tool
  resetDrawingState() {
    this.cleanupTempObjects();
    stopCurrentTool();
  }

  // Handles mouse down to add a new wall segment
  handleMouseDown(o) {
    o.e.preventDefault();
    o.e.stopPropagation();
    this.fabricCanvas.discardActiveObject();
    const pointer = this.fabricCanvas.getPointer(o.e);
    if (this.isCloseToStart(pointer)) return this.completeWallLoop();

    const newCircle = this.createWallCircle(pointer.x, pointer.y);
    this.disableUndo();
    this.fabricCanvas.add(newCircle);
    this.enableUndo();
    this.tempCircles.push(newCircle);
    newCircle.bringToFront();

    if (!this.lastPoint) {
      this.lastPoint = { x: pointer.x, y: pointer.y };
      this.pointCircle = newCircle;
      this.startPointCircle = newCircle;
      this.startPointCircle.set({
        stroke: "#00ff00",
        strokeWidth: 3,
        strokeDashArray: [4, 4],
        radius: 7,
      });
    } else {
      if (this.currentLine) {
        this.fabricCanvas.remove(this.currentLine);
        this.currentLine = null;
      }

      const newLine = this.createWallLine(this.lastPoint.x, this.lastPoint.y, pointer.x, pointer.y, this.pointCircle, newCircle);
      this.disableUndo();
      this.fabricCanvas.add(newLine);
      this.enableUndo();
      this.tempSegments.push({
        line: newLine,
        startCircle: this.pointCircle,
        endCircle: newCircle,
      });
      this.lastPoint = { x: pointer.x, y: pointer.y };
      this.pointCircle = newCircle;
    }
    this.updateCoverage();
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.requestRenderAll();
  }

  // Handles mouse move to show segment preview
  handleMouseMove(o) {
    if (!this.lastPoint) return;
    const pointer = this.fabricCanvas.getPointer(o.e);
    if (!this.currentLine) {
      const points = [this.lastPoint.x, this.lastPoint.y, pointer.x, pointer.y];
      this.currentLine = new fabric.Line(points, this.PREVIEW_LINE_PROPS);
      this.currentLine.set({ selectable: false, evented: false });
      this.disableUndo();
      this.fabricCanvas.add(this.currentLine);
      this.enableUndo();
    } else {
      this.currentLine.set({ x2: pointer.x, y2: pointer.y });
    }
    const isNearStart = this.isCloseToStart(pointer);
    this.currentLine.set({
      stroke: isNearStart ? "#00ff00" : "red",
      strokeWidth: isNearStart ? 4 : 3,
    });
    this.fabricCanvas.setCursor(isNearStart ? "pointer" : "crosshair");
    if (this.startPointCircle)
      this.startPointCircle.set({
        stroke: "#00ff00",
        strokeWidth: isNearStart ? 4 : 3,
        radius: isNearStart ? 9 : 7,
      });
    this.fabricCanvas.requestRenderAll();
  }

  // Activates wall drawing mode
  activate() {
    if (this.isAddingLine) return;
    this.hideAllWallCircles();

    if (this.selectedWallCircle) {
      this.setCircleSelected(this.selectedWallCircle, false);
      this.selectedWallCircle = null;
    }

    this.isAddingLine = true;
    closeSidebar();
    this.cleanupTempObjects();
    registerToolCleanup(() => this.cleanupTempObjects());
    startTool(
      this.fabricCanvas,
      "wall",
      (e) => this.handleMouseDown(e),
      (e) => this.handleMouseMove(e)
    );
  }

  // Handles global mouse down for selection and interaction
  handleGlobalMouseDown(opt) {
    if (this.justCompleted) {
      this.justCompleted = false;
      return;
    }
    if (this.isAddingLine) return;
    const target = opt.target;
    const isLineWithWallRefs = target && target.type === "line" && (target.startCircle || target.endCircle);
    if (target && target.type === "line" && (target.isWallLine || isLineWithWallRefs)) {
      if (this.selectedWallCircle) {
        this.setCircleSelected(this.selectedWallCircle, false);
        this.selectedWallCircle = null;
      }
      this.showCirclesForWallLine(target);
    } else if (target && target.isWallCircle) {
      if (this.selectedWallCircle && this.selectedWallCircle !== target) {
        this.setCircleSelected(this.selectedWallCircle, false);
      }
      this.selectedWallCircle = target;
      this.setCircleSelected(target, true);
      this.showCirclesForConnectedSegments(target);
    } else {
      if (this.selectedWallCircle) {
        this.setCircleSelected(this.selectedWallCircle, false);
        this.selectedWallCircle = null;
      }
      this.hideAllWallCircles();
    }
  }
}

// Setup function to initialize the wall tool
export function setupWallTool(fabricCanvas) {
  new Wall(fabricCanvas);
}
