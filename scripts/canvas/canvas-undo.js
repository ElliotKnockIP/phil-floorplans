class CanvasUndoSystem {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.undoStack = [];
    this.maxStackSize = 50;
    this.isExecutingCommand = false;
    this.isDrawingMode = false;
    this.pendingObjects = []; // Objects added during drawing mode

    this.setupEventHandlers();
    this.updateButtonState();
  }

  // Base command class
  static Command = class {
    execute() {
      throw new Error("Execute method must be implemented");
    }
    undo() {
      throw new Error("Undo method must be implemented");
    }
  };

  // Add object command
  static AddCommand = class extends CanvasUndoSystem.Command {
    constructor(canvas, object, relatedObjects = []) {
      super();
      this.canvas = canvas;
      this.object = object;
      this.relatedObjects = relatedObjects;
    }

    execute() {
      this.canvas.add(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.add(obj));
      this.canvas.renderAll();
    }

    undo() {
      this.canvas.remove(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.remove(obj));
      this.performCleanup();
      this.canvas.renderAll();
    }

    performCleanup() {
      // Clean up devices
      if (this.object.type === "group" && this.object.deviceType) {
        ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
          if (this.object[prop]) this.canvas.remove(this.object[prop]);
        });

        if (window.activeTitleBlocks && this.object.deviceType === "title-block") {
          window.activeTitleBlocks = window.activeTitleBlocks.filter((block) => block !== this.object);
        }
      }

      // Clean up zones
      if (this.object.type === "polygon" && this.object.class === "zone-polygon" && window.zones) {
        window.zones = window.zones.filter((zone) => zone.polygon !== this.object);
      }

      // Clean up walls from lineSegments array
      if (this.object.type === "line" && this.object.stroke === "red") {
        // Remove from global lineSegments if it exists
        if (window.lineSegments) {
          const segmentIndex = window.lineSegments.findIndex((seg) => seg.line === this.object);
          if (segmentIndex !== -1) {
            window.lineSegments.splice(segmentIndex, 1);
          }
        }
      }
    }
  };

  // Remove object command
  static RemoveCommand = class extends CanvasUndoSystem.Command {
    constructor(canvas, object, relatedObjects = []) {
      super();
      this.canvas = canvas;
      this.object = object;
      this.relatedObjects = relatedObjects;
      this.storeObjectData();
    }

    storeObjectData() {
      // Store device data for restoration
      if (this.object.type === "group" && this.object.deviceType) {
        this.deviceData = {
          scaleFactor: this.object.scaleFactor,
          partNumber: this.object.partNumber,
          stockNumber: this.object.stockNumber,
          coverageConfig: this.object.coverageConfig ? { ...this.object.coverageConfig } : null,
        };
      }

      // Store wall connection data for restoration
      if (this.object.type === "line" && this.object.stroke === "red") {
        this.wallData = {
          startCircle: this.object.startCircle,
          endCircle: this.object.endCircle,
        };
      }
    }

    execute() {
      this.canvas.remove(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.remove(obj));
      this.performCleanup();
      this.canvas.renderAll();
    }

    undo() {
      this.canvas.add(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.add(obj));
      this.restoreObjectData();
      this.canvas.renderAll();
    }

    performCleanup() {
      // Same cleanup as AddCommand
      if (this.object.type === "group" && this.object.deviceType) {
        ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
          if (this.object[prop]) this.canvas.remove(this.object[prop]);
        });

        if (window.activeTitleBlocks && this.object.deviceType === "title-block") {
          window.activeTitleBlocks = window.activeTitleBlocks.filter((block) => block !== this.object);
        }
      }

      // Clean up walls from lineSegments array
      if (this.object.type === "line" && this.object.stroke === "red") {
        if (window.lineSegments) {
          const segmentIndex = window.lineSegments.findIndex((seg) => seg.line === this.object);
          if (segmentIndex !== -1) {
            window.lineSegments.splice(segmentIndex, 1);
          }
        }
      }
    }

    restoreObjectData() {
      if (this.deviceData && this.object.type === "group") {
        Object.assign(this.object, this.deviceData);

        // Restore camera coverage if needed
        if (this.deviceData.coverageConfig && window.addCameraCoverage) {
          setTimeout(() => window.addCameraCoverage(this.canvas, this.object), 100);
        }

        // Restore titleblock to active list
        if (this.object.deviceType === "title-block" && window.activeTitleBlocks) {
          if (!window.activeTitleBlocks.includes(this.object)) {
            window.activeTitleBlocks.push(this.object);
          }
        }
      }

      // Restore wall connection data
      if (this.wallData && this.object.type === "line") {
        this.object.startCircle = this.wallData.startCircle;
        this.object.endCircle = this.wallData.endCircle;

        // Re-add to lineSegments array if it exists
        if (window.lineSegments && !window.lineSegments.some((seg) => seg.line === this.object)) {
          window.lineSegments.push({
            line: this.object,
            startCircle: this.wallData.startCircle,
            endCircle: this.wallData.endCircle,
          });
        }
      }
    }
  };

  // Multiple commands wrapper
  static MultipleCommand = class extends CanvasUndoSystem.Command {
    constructor(commands) {
      super();
      this.commands = commands;
    }

    execute() {
      this.commands.forEach((cmd) => cmd.execute());
    }

    undo() {
      for (let i = this.commands.length - 1; i >= 0; i--) {
        this.commands[i].undo();
      }
    }
  };

  // Execute command and add to stack
  executeCommand(command) {
    if (this.isExecutingCommand) return;

    this.isExecutingCommand = true;
    try {
      command.execute();
      this.addToStack(command);
    } finally {
      this.isExecutingCommand = false;
    }
  }

  // Add to undo stack
  addToStack(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.updateButtonState();
  }

  // Undo last command
  undo() {
    if (this.undoStack.length === 0 || this.isExecutingCommand) return;

    this.isExecutingCommand = true;
    try {
      const command = this.undoStack.pop();
      command.undo();
      this.updateButtonState();
      this.fabricCanvas.discardActiveObject();

      // Recalculate coverage after undo
      this.recalculateAllCoverage();
    } finally {
      this.isExecutingCommand = false;
    }
  }

  recalculateAllCoverage() {
    setTimeout(() => {
      this.fabricCanvas.getObjects().forEach((obj) => {
        if (obj.type === "group" && obj.deviceType && obj.coverageConfig && obj.createOrUpdateCoverageArea) {
          obj.createOrUpdateCoverageArea();
        }
      });
      this.fabricCanvas.requestRenderAll();
    }, 100);
  }

  // Update undo button state
  updateButtonState() {
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      const img = undoBtn.querySelector("img");
      if (img) {
        if (this.undoStack.length === 0) {
          // Disabled state
          undoBtn.disabled = true;
          img.style.filter = "brightness(0) saturate(100%) invert(42%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(96%) contrast(89%)";
        } else {
          // Enabled state
          undoBtn.disabled = false;
          img.style.filter = "brightness(0) saturate(100%) invert(1)";
        }
      }
    }
  }

  // Track object additions with smarter grouping
  setupObjectAddedTracking() {
    // Remove any existing listeners first
    this.fabricCanvas.off("object:added");

    this.fabricCanvas.on("object:added", (e) => {
      if (this.isExecutingCommand) {
        return;
      }

      const obj = e.target;

      // Skip certain objects that shouldn't create undo commands
      if (!obj || obj.isBackground || obj.isResizeIcon || obj.isCoverage || obj.isDeviceLabel) {
        return;
      }

      // Skip temporary objects during drawing modes
      if (this.shouldSkipObject(obj)) {
        return;
      }

      // Handle different object types
      if (this.isDrawingModeObject(obj)) {
        return;
      }

      // Create undo command for regular objects (like devices)
      const relatedObjects = this.findRelatedObjects(obj);
      const command = new CanvasUndoSystem.AddCommand(this.fabricCanvas, obj, relatedObjects);
      this.addToStack(command);
    });
  }

  // Check if object should be skipped
  shouldSkipObject(obj) {
    // Skip temporary objects during wall drawing
    if (obj.type === "line" && (obj.strokeDashArray || obj.evented === false)) {
      return true;
    }
    if (obj.type === "circle" && (obj.strokeDashArray || obj.evented === false)) {
      return true;
    }

    // Skip wall objects that are being created during wall drawing mode
    if (obj.type === "line" && obj.stroke === "red" && obj.selectable === false) {
      return true;
    }
    if (obj.type === "circle" && obj.isWallCircle && obj.selectable === false) {
      return true;
    }

    // Skip zone text objects (they're handled by zone creation)
    if (obj.class === "zone-text") {
      return true;
    }

    // Skip preview objects
    if (obj.selectable === false && obj.evented === false && !obj.isBackground) {
      return true;
    }

    return false;
  }

  // Check if object is part of a drawing mode operation
  isDrawingModeObject(obj) {
    // Measurement groups (distance and apex)
    if (obj.type === "group" && obj._objects) {
      const hasLine = obj._objects.some((o) => o.type === "line");
      const hasText = obj._objects.some((o) => o.type === "i-text");
      const hasTriangle = obj._objects.some((o) => o.type === "triangle");

      // Measurement groups have line + text
      if (hasLine && hasText) {
        return true;
      }

      // Arrow groups have line + triangle
      if (hasLine && hasTriangle) {
        return true;
      }
    }

    // Zone polygons (but not zone text - that's handled separately)
    if (obj.type === "polygon" && obj.class === "zone-polygon") {
      return true;
    }

    // Arrows with explicit type
    if (obj.type === "arrow") {
      return true;
    }

    return false;
  }

  // Create a drawing mode command for multiple objects
  createDrawingCommand(objects) {
    if (!objects || objects.length === 0) return null;

    const commands = objects.map((obj) => {
      const relatedObjects = this.findRelatedObjects(obj);
      return new CanvasUndoSystem.AddCommand(this.fabricCanvas, obj, relatedObjects);
    });

    return new CanvasUndoSystem.MultipleCommand(commands);
  }

  // Setup all event handlers
  setupEventHandlers() {
    // Undo button
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.undo();
      });
    }

    // Keyboard shortcut
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
    });

    // Override fabric's default delete behavior completely
    this.fabricCanvas.on("selection:created", () => {
      document.addEventListener("keydown", this.deleteHandler);
    });

    this.fabricCanvas.on("selection:cleared", () => {
      document.removeEventListener("keydown", this.deleteHandler);
    });

    // Create delete handler as arrow function to preserve 'this'
    this.deleteHandler = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !this.isExecutingCommand) {
        const activeObject = this.fabricCanvas.getActiveObject();
        if (!activeObject) return;

        // Don't interfere with text editing
        if (activeObject.isEditing) return;

        e.preventDefault();
        e.stopPropagation();

        // Handle deletion with proper grouping
        this.handleDeletion(activeObject);
      }
    };

    // Setup object tracking
    this.setupObjectAddedTracking();
  }

  // Handle deletion with proper grouping
  handleDeletion(activeObject) {
    // Prevent fabric from handling the deletion automatically
    this.fabricCanvas.discardActiveObject();

    if (activeObject.type === "line" && activeObject.stroke === "red") {
      // Wall line deletion - include orphaned circles
      const relatedObjects = [];

      // Find circles connected to this line
      const connectedCircles = [activeObject.startCircle, activeObject.endCircle].filter((circle) => circle);

      connectedCircles.forEach((circle) => {
        if (!circle) return;

        // Find other lines connected to this circle (excluding the one being deleted)
        const otherLines = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && obj !== activeObject && obj.stroke === "red" && (obj.startCircle === circle || obj.endCircle === circle));

        // If no other lines are connected, this circle will become orphaned
        if (otherLines.length === 0) {
          relatedObjects.push(circle);
        }
      });

      const command = new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, activeObject, relatedObjects);
      this.executeCommand(command);
    } else if (activeObject.type === "circle" && activeObject.isWallCircle) {
      // Wall circle deletion - include all connected lines and orphaned circles
      const connectedLines = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && obj.stroke === "red" && (obj.startCircle === activeObject || obj.endCircle === activeObject));

      const allObjectsToDelete = [activeObject, ...connectedLines];
      const orphanedCircles = [];

      connectedLines.forEach((line) => {
        const otherCircle = line.startCircle === activeObject ? line.endCircle : line.startCircle;
        if (otherCircle && !orphanedCircles.includes(otherCircle)) {
          const remainingConnections = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && obj.stroke === "red" && !connectedLines.includes(obj) && (obj.startCircle === otherCircle || obj.endCircle === otherCircle));
          if (remainingConnections.length === 0) {
            orphanedCircles.push(otherCircle);
          }
        }
      });

      allObjectsToDelete.push(...orphanedCircles);

      // Create a single command that removes everything at once
      const commands = allObjectsToDelete.map((obj) => new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, obj, []));
      const compoundCommand = new CanvasUndoSystem.MultipleCommand(commands);
      this.executeCommand(compoundCommand);
    } else {
      // Regular deletion - include related objects
      const relatedObjects = this.findRelatedObjects(activeObject);
      const command = new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, activeObject, relatedObjects);
      this.executeCommand(command);
    }
  }

  // Find related objects (text labels, etc.)
  findRelatedObjects(obj) {
    const related = [];

    // For device groups, find their text label
    if (obj.type === "group" && obj.deviceType) {
      // Check textObject property first
      if (obj.textObject) {
        related.push(obj.textObject);
      } else {
        // Look for text that references this device
        const deviceText = this.fabricCanvas.getObjects().find((textObj) => textObj.type === "i-text" && (textObj.isDeviceLabel || textObj.deviceId === obj.id));
        if (deviceText) {
          related.push(deviceText);
        }
      }
    }

    // For zone polygons, find associated text
    if (obj.type === "polygon" && obj.class === "zone-polygon") {
      if (obj.associatedText) {
        related.push(obj.associatedText);
      } else {
        const zoneText = this.fabricCanvas.getObjects().find((textObj) => textObj.type === "i-text" && textObj.class === "zone-text" && textObj.associatedPolygon === obj);
        if (zoneText) {
          related.push(zoneText);
        }
      }
    }

    // For zone text, find associated polygon
    if (obj.type === "i-text" && obj.class === "zone-text" && obj.associatedPolygon) {
      related.push(obj.associatedPolygon);
    }

    return related;
  }

  // Clear undo history
  clear() {
    this.undoStack = [];
    this.updateButtonState();
  }

  // Reset undo system when loading a new project
  reset() {
    // Clear the undo stack
    this.undoStack = [];

    // Reset execution state
    this.isExecutingCommand = false;

    // Update button state immediately
    this.updateButtonState();

    // Force disable the undo button
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.disabled = true;
      undoBtn.style.opacity = "0.5";
    }
  }

  // Completely reinitialize the undo system for a new project
  reinitialize() {
    // Remove existing event listeners
    this.fabricCanvas.off("object:added");

    // Reset state completely
    this.undoStack = [];
    this.isExecutingCommand = true; // Block all tracking during load

    // Force disable button immediately
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.disabled = true;
      undoBtn.style.opacity = "0.5";
    }
  }

  // Re-enable undo tracking after project load is complete
  enableTracking() {
    this.isExecutingCommand = false;
    this.setupObjectAddedTracking();
    this.updateButtonState(); // Should still be disabled since stack is empty
  }
}

// Export for use
export function initializeUndo(fabricCanvas) {
  const undoSystem = new CanvasUndoSystem(fabricCanvas);
  window.undoSystem = undoSystem;

  window.UndoCommands = {
    AddCommand: CanvasUndoSystem.AddCommand,
    RemoveCommand: CanvasUndoSystem.RemoveCommand,
    MultipleCommand: CanvasUndoSystem.MultipleCommand,
  };

  return undoSystem;
}

export { CanvasUndoSystem };
