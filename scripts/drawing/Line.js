// Line class handles drawing lines, connections, and arrows on the canvas
import { closeSidebar, startTool, stopCurrentTool, setupDeletion, registerToolCleanup } from "./drawing-utils.js";

export class Line {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.startPoint = null;
    this.tempObject = null;
    this.init();
  }

  // Initialize the line tool with button event listeners
  init() {
    const lineBtn = document.getElementById("add-line-btn");
    const connectionBtn = document.getElementById("add-connection-btn");
    const arrowBtn = document.getElementById("add-arrow-btn");

    // Configure deletion for lines and arrows
    setupDeletion(this.fabricCanvas, (obj) => {
      const isLineOrArrow = obj.type === "line" || obj.type === "arrow";
      const isArrowGroup = obj.type === "group" && obj.isArrow;
      return isLineOrArrow || isArrowGroup;
    });

    if (lineBtn) {
      lineBtn.addEventListener("click", () => {
        closeSidebar();
        this.cleanupTempObjects();
        registerToolCleanup(() => this.cleanupTempObjects());
        startTool(
          this.fabricCanvas,
          "line",
          (e) => this.handleLineClick(e),
          (e) => this.handleLineMove(e)
        );
      });
    }

    if (connectionBtn) {
      connectionBtn.addEventListener("click", () => {
        closeSidebar();
        this.cleanupTempObjects();
        registerToolCleanup(() => this.cleanupTempObjects());
        startTool(
          this.fabricCanvas,
          "connection",
          (e) => this.handleConnectionClick(e),
          (e) => this.handleConnectionMove(e)
        );
      });
    }

    if (arrowBtn) {
      arrowBtn.addEventListener("click", () => {
        closeSidebar();
        this.cleanupTempObjects();
        registerToolCleanup(() => this.cleanupTempObjects());
        startTool(
          this.fabricCanvas,
          "arrow",
          (e) => this.handleArrowClick(e),
          (e) => this.handleArrowMove(e)
        );
      });
    }

    // Expose cleanup function globally
    window.cleanupLinesTempObjects = () => this.cleanupTempObjects();
  }

  // Clean up temporary line objects
  cleanupTempObjects() {
    if (this.tempObject) {
      this.fabricCanvas.remove(this.tempObject);
      this.tempObject = null;
    }
    this.startPoint = null;
    this.fabricCanvas.requestRenderAll();
  }

  // Handle click events for line drawing
  handleLineClick(e) {
    this.lineClick(e, "green", false);
  }

  // Handle click events for connection drawing
  handleConnectionClick(e) {
    this.lineClick(e, "grey", true);
  }

  // Handle click events for arrow drawing
  handleArrowClick(e) {
    this.arrowClick(e);
  }

  // Handle mouse move events for line drawing
  handleLineMove(e) {
    this.lineMove(e, "green", false);
  }

  // Handle mouse move events for connection drawing
  handleConnectionMove(e) {
    this.lineMove(e, "grey", true);
  }

  // Handle mouse move events for arrow drawing
  handleArrowMove(e) {
    this.arrowMove(e);
  }

  // Generic click handler for line and connection creation
  lineClick(e, color, dashed) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = this.fabricCanvas.getPointer(e.e);

    if (!this.startPoint) {
      // Set start point on first click
      this.startPoint = { x: pointer.x, y: pointer.y };
    } else {
      // Create final line on second click
      if (this.tempObject) this.fabricCanvas.remove(this.tempObject);

      const line = new fabric.Line([this.startPoint.x, this.startPoint.y, pointer.x, pointer.y], {
        stroke: color,
        strokeWidth: 2,
        strokeDashArray: dashed ? [5, 5] : null,
        selectable: true,
        hasControls: false,
        borderColor: "#f8794b",
        cornerColor: "#f8794b",
        isConnectionLine: dashed,
      });

      // Handle undo/redo state
      const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      this.fabricCanvas.add(line);
      this.fabricCanvas.setActiveObject(line);

      // Add to undo stack
      if (window.undoSystem) {
        window.undoSystem.isExecutingCommand = wasExecuting;
        const command = new window.UndoCommands.AddCommand(this.fabricCanvas, line, []);
        window.undoSystem.addToStack(command);
      }

      this.startPoint = null;
      this.tempObject = null;
      stopCurrentTool();
    }
  }

  // Generic move handler for line and connection preview
  lineMove(e, color, dashed) {
    if (!this.startPoint) return;

    const pointer = this.fabricCanvas.getPointer(e.e);

    if (this.tempObject) this.fabricCanvas.remove(this.tempObject);

    // Create dashed preview line
    this.tempObject = new fabric.Line([this.startPoint.x, this.startPoint.y, pointer.x, pointer.y], {
      stroke: color,
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });

    this.fabricCanvas.add(this.tempObject);
    this.fabricCanvas.requestRenderAll();
  }

  // Handle click events for arrow creation
  arrowClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = this.fabricCanvas.getPointer(e.e);

    if (!this.startPoint) {
      // Set start point on first click
      this.startPoint = { x: pointer.x, y: pointer.y };
    } else {
      // Create final arrow on second click
      if (this.tempObject) this.fabricCanvas.remove(this.tempObject);

      const arrow = this.createArrow(this.startPoint, pointer);

      // Handle undo/redo state
      const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
      if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

      this.fabricCanvas.add(arrow);
      this.fabricCanvas.setActiveObject(arrow);

      // Add to undo stack
      if (window.undoSystem) {
        window.undoSystem.isExecutingCommand = wasExecuting;
        const command = new window.UndoCommands.AddCommand(this.fabricCanvas, arrow, []);
        window.undoSystem.addToStack(command);
      }

      this.startPoint = null;
      this.tempObject = null;
      stopCurrentTool();
    }
  }

  // Handle mouse move events for arrow preview
  arrowMove(e) {
    if (!this.startPoint) return;

    const pointer = this.fabricCanvas.getPointer(e.e);

    if (this.tempObject) this.fabricCanvas.remove(this.tempObject);

    // Create arrow preview
    this.tempObject = this.createArrow(this.startPoint, pointer, true);
    this.fabricCanvas.add(this.tempObject);
    this.fabricCanvas.requestRenderAll();
  }

  // Create an arrow group consisting of a line and triangle head
  createArrow(start, end, isPreview = false) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);

    // Create the line part of the arrow
    const line = new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: "blue",
      strokeWidth: isPreview ? 3 : 2,
      strokeDashArray: isPreview ? [5, 5] : null,
      selectable: !isPreview,
      evented: !isPreview,
    });

    // Create the triangle head of the arrow
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

    // Group line and head together
    const group = new fabric.Group([line, arrowHead], {
      selectable: !isPreview,
      hasControls: false,
      borderColor: "#f8794b",
      cornerColor: "#f8794b",
      isArrow: true,
    });

    return group;
  }
}

// Helper function to initialize line tools
export function setupLineTools(fabricCanvas) {
  new Line(fabricCanvas);
}
