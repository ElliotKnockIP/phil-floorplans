// Handles undo/redo functionality using the command pattern
class CanvasUndoSystem {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.undoStack = [];
    this.redoStack = [];
    this.maxStackSize = 50;
    this.isExecutingCommand = false;
    this.isDrawingMode = false;
    this.pendingObjects = [];

    this.setupEventHandlers();
    this.updateButtonState();
  }

  // Notify layer UI that items have changed
  static notifyLayersItemsChanged() {
    try {
      const evt = new Event("layers:items-changed");
      document.dispatchEvent(evt);
    } catch (e) {
      // Non-fatal if DOM not available
    }
  }

  // Base command class for undoable actions
  static Command = class {
    execute() {
      throw new Error("Execute method must be implemented");
    }
    undo() {
      throw new Error("Undo method must be implemented");
    }
  };

  // Command for adding objects to the canvas
  static AddCommand = class extends CanvasUndoSystem.Command {
    constructor(canvas, object, relatedObjects = []) {
      super();
      this.canvas = canvas;
      this.object = object;
      this.relatedObjects = relatedObjects;
    }

    // Add object and its related components back to canvas
    execute() {
      this.canvas.add(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.add(obj));

      // Re-register special global collections
      try {
        // Title blocks
        if (this.object.deviceType === "title-block") {
          if (!window.activeTitleBlocks) window.activeTitleBlocks = [];
          if (!window.activeTitleBlocks.includes(this.object)) {
            window.activeTitleBlocks.push(this.object);
          }
        }

        // Zones
        if (this.object.type === "polygon" && this.object.class === "zone-polygon" && window.zones) {
          const existing = window.zones.some((z) => z.polygon === this.object);
          if (!existing) {
            window.zones.push({ polygon: this.object, text: this.object.associatedText });
          }
        }

        // Rooms
        if (this.object.type === "polygon" && this.object.class === "room-polygon" && window.rooms) {
          const existingRoom = window.rooms.some((r) => r.polygon === this.object);
          if (!existingRoom) {
            window.rooms.push({
              polygon: this.object,
              text: this.object.associatedText,
              roomName: this.object.roomName || (this.object.associatedText ? this.object.associatedText.text : ""),
              roomNotes: this.object.roomNotes || "",
              devices: [],
              roomColor: this.object.stroke || (this.object.associatedText ? this.object.associatedText.fill : undefined),
              area: this.object.area,
              height: this.object.height,
              volume: this.object.volume,
            });
          }
        }
      } catch (e) {
        // Non-fatal; continue
      }

      // Recreate missing device label if needed
      if (this.object && this.object.type === "group" && this.object.deviceType) {
        const existingRef = !!this.object.textObject;
        const onCanvas = existingRef && this.canvas.getObjects().includes(this.object.textObject);
        const shouldRecreate = !existingRef || (!onCanvas && !this.object.labelHidden);

        if (shouldRecreate && this.object.initialLabelText && typeof fabric !== "undefined" && fabric.Text) {
          try {
            const center = this.object.getCenterPoint();
            const scaleFactor = this.object.scaleFactor || 1;
            const label = new fabric.Text(this.object.initialLabelText, {
              left: center.x,
              top: center.y + 20 * scaleFactor + 10,
              fontFamily: "Poppins, sans-serif",
              fontSize: 12 * scaleFactor,
              fill: "#FFFFFF",
              selectable: false,
              evented: false,
              backgroundColor: "rgba(20, 18, 18, 0.8)",
              originX: "center",
              originY: "top",
              isDeviceLabel: true,
              visible: this.object.labelHidden ? false : true,
            });
            label._isHidden = !!this.object.labelHidden;
            this.canvas.add(label);
            this.object.textObject = label;

            if (!this.relatedObjects.includes(label)) {
              this.relatedObjects.push(label);
            }
            label.setCoords();

            if (this.object.labelHidden) {
              try {
                this.canvas.remove(label);
              } catch (e) {}
            }
            this.object.textObject = label;
          } catch (e) {
            // ignore label recreation errors
          }
        }
      }

      // Recreate camera coverage area and icons
      const isCameraGroup = this.object && this.object.type === "group" && this.object.deviceType;
      const hasCoverage = this.object && this.object.coverageConfig && window.addCameraCoverage;

      if (isCameraGroup && hasCoverage) {
        setTimeout(() => {
          try {
            ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
              const val = this.object[prop];
              if (val && !this.canvas.getObjects().includes(val)) {
                try {
                  this.object[prop] = null;
                } catch (e) {}
              }
            });
            window.addCameraCoverage(this.canvas, this.object);
          } catch (err) {
            console.warn("Failed to recreate camera coverage on redo/add:", err);
          }
          this.canvas.requestRenderAll();
        }, 50);
      }

      this.canvas.renderAll();
      CanvasUndoSystem.notifyLayersItemsChanged();
    }

    // Remove object and its related components from canvas
    undo() {
      this.canvas.remove(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.remove(obj));
      this.performCleanup();
      this.canvas.renderAll();
      CanvasUndoSystem.notifyLayersItemsChanged();
    }

    // Clean up global references and associated objects
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

      // Clean up zones/rooms
      const toCheck = [this.object, ...this.relatedObjects];
      if (window.zones) {
        toCheck.forEach((o) => {
          if (o && o.type === "polygon" && o.class === "zone-polygon") {
            window.zones = window.zones.filter((zone) => zone.polygon !== o);
          }
        });
      }
      if (window.rooms) {
        toCheck.forEach((o) => {
          if (o && o.type === "polygon" && o.class === "room-polygon") {
            window.rooms = window.rooms.filter((room) => room.polygon !== o);
          }
        });
      }

      // Clean up walls
      if (this.object.type === "line" && this.object.stroke === "red") {
        if (window.lineSegments) {
          const segmentIndex = window.lineSegments.findIndex((seg) => seg.line === this.object);
          if (segmentIndex !== -1) {
            window.lineSegments.splice(segmentIndex, 1);
          }
        }
      }
    }
  };

  // Command for removing objects from the canvas
  static RemoveCommand = class extends CanvasUndoSystem.Command {
    constructor(canvas, object, relatedObjects = []) {
      super();
      this.canvas = canvas;
      this.object = object;
      this.relatedObjects = relatedObjects;
      this.storeObjectData();
    }

    // Store object properties for restoration
    storeObjectData() {
      // Store device data
      if (this.object.type === "group" && this.object.deviceType) {
        this.deviceData = {
          scaleFactor: this.object.scaleFactor,
          location: this.object.location,
          mountedPosition: this.object.mountedPosition,
          partNumber: this.object.partNumber,
          stockNumber: this.object.stockNumber,
          ipAddress: this.object.ipAddress,
          subnetMask: this.object.subnetMask,
          gatewayAddress: this.object.gatewayAddress,
          macAddress: this.object.macAddress,
          focalLength: this.object.focalLength,
          sensorSize: this.object.sensorSize,
          resolution: this.object.resolution,
          coverageConfig: this.object.coverageConfig ? { ...this.object.coverageConfig } : null,
          labelHidden: this.getLabelHiddenState(),
        };
      }

      // Store wall connection data
      if (this.object.type === "line" && this.object.stroke === "red") {
        this.wallData = {
          startCircle: this.object.startCircle,
          endCircle: this.object.endCircle,
        };
      }
    }

    // Helper to determine if label is hidden
    getLabelHiddenState() {
      if (this.object.labelHidden !== undefined) {
        return this.object.labelHidden;
      }
      if (this.object.textObject) {
        return !!this.object.textObject._isHidden;
      }
      return false;
    }

    // Remove object and its related components from canvas
    execute() {
      this.canvas.remove(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.remove(obj));
      this.performCleanup();
      this.canvas.renderAll();
      CanvasUndoSystem.notifyLayersItemsChanged();
    }

    // Restore object and its related components to canvas
    undo() {
      this.canvas.add(this.object);
      this.relatedObjects.forEach((obj) => this.canvas.add(obj));
      this.restoreObjectData();
      this.canvas.renderAll();
      CanvasUndoSystem.notifyLayersItemsChanged();
    }

    // Clean up global references and associated objects
    performCleanup() {
      if (this.object.type === "group" && this.object.deviceType) {
        ["coverageArea", "leftResizeIcon", "rightResizeIcon", "rotateResizeIcon"].forEach((prop) => {
          if (this.object[prop]) this.canvas.remove(this.object[prop]);
        });

        if (window.activeTitleBlocks && this.object.deviceType === "title-block") {
          window.activeTitleBlocks = window.activeTitleBlocks.filter((block) => block !== this.object);
        }
      }

      const zoneRoomObjects = [this.object, ...this.relatedObjects];
      if (window.zones) {
        zoneRoomObjects.forEach((o) => {
          if (o && o.type === "polygon" && o.class === "zone-polygon") {
            window.zones = window.zones.filter((zone) => zone.polygon !== o);
          }
        });
      }
      if (window.rooms) {
        zoneRoomObjects.forEach((o) => {
          if (o && o.type === "polygon" && o.class === "room-polygon") {
            window.rooms = window.rooms.filter((room) => room.polygon !== o);
          }
        });
      }

      if (this.object.type === "line" && this.object.stroke === "red") {
        if (window.lineSegments) {
          const segmentIndex = window.lineSegments.findIndex((seg) => seg.line === this.object);
          if (segmentIndex !== -1) {
            window.lineSegments.splice(segmentIndex, 1);
          }
        }
      }
    }

    // Restore object properties and global references
    restoreObjectData() {
      if (this.deviceData && this.object.type === "group") {
        Object.assign(this.object, this.deviceData);

        if (this.deviceData.coverageConfig && window.addCameraCoverage) {
          setTimeout(() => window.addCameraCoverage(this.canvas, this.object), 100);
        }

        if (this.object.textObject) {
          const hidden = !!this.object.labelHidden;
          this.object.textObject._isHidden = hidden;
          this.object.textObject.visible = !hidden;
          if (hidden) {
            try {
              this.canvas.remove(this.object.textObject);
            } catch (e) {}
          } else if (!this.canvas.getObjects().includes(this.object.textObject)) {
            this.canvas.add(this.object.textObject);
          }
        }

        if (this.object.deviceType === "title-block" && window.activeTitleBlocks) {
          if (!window.activeTitleBlocks.includes(this.object)) {
            window.activeTitleBlocks.push(this.object);
          }
        }
      }

      // Restore zones/rooms
      try {
        const toRestore = [this.object, ...this.relatedObjects];
        toRestore.forEach((o) => {
          if (!o || o.type !== "polygon") return;
          if (o.class === "zone-polygon" && window.zones) {
            const exists = window.zones.some((z) => z.polygon === o);
            if (!exists) {
              window.zones.push({ polygon: o, text: o.associatedText });
            }
          }
          if (o.class === "room-polygon" && window.rooms) {
            const exists = window.rooms.some((r) => r.polygon === o);
            if (!exists) {
              window.rooms.push({
                polygon: o,
                text: o.associatedText,
                roomName: o.roomName || (o.associatedText ? o.associatedText.text : ""),
                roomNotes: o.roomNotes || "",
                devices: [],
                roomColor: o.stroke || (o.associatedText ? o.associatedText.fill : undefined),
                area: o.area,
                height: o.height,
                volume: o.volume,
              });
            }
          }
        });
      } catch (e) {
        // Non-fatal
      }

      // Restore wall connection data
      if (this.wallData && this.object.type === "line") {
        this.object.startCircle = this.wallData.startCircle;
        this.object.endCircle = this.wallData.endCircle;

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

  // Wrapper for executing multiple commands as a single action
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

  // Execute a command and add it to the undo stack
  executeCommand(command) {
    if (this.isExecutingCommand) return;

    this.isExecutingCommand = true;
    try {
      command.execute();
      this.addToStack(command);
      this.redoStack = [];
      this.updateButtonState();
    } finally {
      this.isExecutingCommand = false;
    }
  }

  // Add a command to the undo stack and manage stack size
  addToStack(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.updateButtonState();
  }

  // Undo the last command
  undo() {
    if (this.undoStack.length === 0 || this.isExecutingCommand) return;

    this.isExecutingCommand = true;
    try {
      const command = this.undoStack.pop();
      command.undo();
      this.redoStack.push(command);
      if (this.redoStack.length > this.maxStackSize) this.redoStack.shift();
      this.updateButtonState();
      this.fabricCanvas.discardActiveObject();
      this.recalculateAllCoverage();
    } finally {
      this.isExecutingCommand = false;
    }
  }

  // Redo the last undone command
  redo() {
    if (this.redoStack.length === 0 || this.isExecutingCommand) return;

    this.isExecutingCommand = true;
    try {
      const command = this.redoStack.pop();
      command.execute();
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxStackSize) this.undoStack.shift();
      this.updateButtonState();
      this.fabricCanvas.discardActiveObject();
      this.recalculateAllCoverage();
    } finally {
      this.isExecutingCommand = false;
    }
  }

  // Recalculate coverage areas for all devices on canvas
  recalculateAllCoverage() {
    setTimeout(() => {
      this.fabricCanvas.getObjects().forEach((obj) => {
        if (obj.type === "group" && obj.deviceType && obj.coverageConfig && obj.createOrUpdateCoverageArea) {
          obj.lastCoverageState = null;
          obj.createOrUpdateCoverageArea();
        }
      });
      this.fabricCanvas.requestRenderAll();
    }, 100);
  }

  // Update UI state of undo/redo buttons
  updateButtonState() {
    const updateButton = (btnId, stack) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      const img = btn.querySelector("img");
      if (!img) return;

      const isEmpty = stack.length === 0;
      btn.disabled = isEmpty;

      const disabledFilter = "brightness(0) saturate(100%) invert(42%) sepia(0%) saturate(0%) " + "hue-rotate(0deg) brightness(96%) contrast(89%)";
      const enabledFilter = "brightness(0) saturate(100%) invert(1)";
      img.style.filter = isEmpty ? disabledFilter : enabledFilter;
    };

    updateButton("undo-btn", this.undoStack);
    updateButton("redo-btn", this.redoStack);
  }

  // Track objects added to canvas to create undo commands
  setupObjectAddedTracking() {
    this.fabricCanvas.off("object:added");
    this.fabricCanvas.on("object:added", (e) => {
      if (this.isExecutingCommand) return;

      const obj = e.target;
      if (!obj || obj.isBackground || obj.isResizeIcon || obj.isCoverage || obj.isDeviceLabel) return;
      if (this.shouldSkipObject(obj)) return;
      if (this.isDrawingModeObject(obj)) return;

      const relatedObjects = this.findRelatedObjects(obj);
      const command = new CanvasUndoSystem.AddCommand(this.fabricCanvas, obj, relatedObjects);
      this.addToStack(command);
    });
  }

  // Determine if an object should be ignored by the undo system
  shouldSkipObject(obj) {
    // Skip temporary objects during wall drawing
    if (obj.type === "line" && (obj.strokeDashArray || obj.evented === false)) return true;
    if (obj.type === "circle" && (obj.strokeDashArray || obj.evented === false)) return true;
    if (obj.type === "line" && obj.stroke === "red" && obj.selectable === false) return true;
    if (obj.type === "circle" && obj.isWallCircle && obj.selectable === false) return true;
    if (obj.class === "zone-text") return true;
    if (obj.selectable === false && obj.evented === false && !obj.isBackground) return true;
    return false;
  }

  // Identify objects created during drawing modes
  isDrawingModeObject(obj) {
    // Measurement groups
    if (obj.type === "group" && obj._objects) {
      const hasLine = obj._objects.some((o) => o.type === "line");
      const hasText = obj._objects.some((o) => o.type === "i-text");
      const hasTriangle = obj._objects.some((o) => o.type === "triangle");
      if ((hasLine && hasText) || (hasLine && hasTriangle)) return true;
    }
    if (obj.type === "polygon" && obj.class === "zone-polygon") return true;
    if (obj.type === "arrow") return true;
    return false;
  }

  // Create a compound command for multiple drawing objects
  createDrawingCommand(objects) {
    if (!objects || objects.length === 0) return null;
    const commands = objects.map((obj) => {
      const relatedObjects = this.findRelatedObjects(obj);
      return new CanvasUndoSystem.AddCommand(this.fabricCanvas, obj, relatedObjects);
    });
    return new CanvasUndoSystem.MultipleCommand(commands);
  }

  // Setup event listeners for UI and keyboard shortcuts
  setupEventHandlers() {
    // Undo/Redo buttons
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.undo();
      });
    }

    const redoBtn = document.getElementById("redo-btn");
    if (redoBtn) {
      redoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.redo();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "Z" && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }
    });

    // Delete handling
    this.fabricCanvas.on("selection:created", () => {
      document.addEventListener("keydown", this.deleteHandler);
    });

    this.fabricCanvas.on("selection:cleared", () => {
      document.removeEventListener("keydown", this.deleteHandler);
    });

    this.deleteHandler = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !this.isExecutingCommand) {
        // Don't interfere with input fields, textareas, or contenteditable elements
        const target = e.target;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }

        const activeObject = this.fabricCanvas.getActiveObject();
        if (!activeObject || activeObject.isEditing) return;

        e.preventDefault();
        e.stopPropagation();
        this.handleDeletion(activeObject);
      }
    };

    this.setupObjectAddedTracking();
  }

  // Handle deletion of objects with undo support
  handleDeletion(activeObject) {
    this.fabricCanvas.discardActiveObject();

    if (activeObject.type === "line" && activeObject.stroke === "red") {
      // Wall line deletion
      const relatedObjects = [];
      const connectedCircles = [activeObject.startCircle, activeObject.endCircle].filter((circle) => circle);

      connectedCircles.forEach((circle) => {
        if (!circle) return;
        const otherLines = this.fabricCanvas.getObjects().filter((obj) => {
          const isWall = obj.type === "line" && obj.stroke === "red";
          const isConnected = obj.startCircle === circle || obj.endCircle === circle;
          return isWall && obj !== activeObject && isConnected;
        });
        if (otherLines.length === 0) {
          relatedObjects.push(circle);
        }
      });

      const command = new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, activeObject, relatedObjects);
      this.executeCommand(command);
    } else if (activeObject.type === "circle" && activeObject.isWallCircle) {
      // Wall circle deletion
      const connectedLines = this.fabricCanvas.getObjects().filter((obj) => {
        const isWall = obj.type === "line" && obj.stroke === "red";
        const isConnected = obj.startCircle === activeObject || obj.endCircle === activeObject;
        return isWall && isConnected;
      });

      const allObjectsToDelete = [activeObject, ...connectedLines];
      const orphanedCircles = [];

      connectedLines.forEach((line) => {
        const otherCircle = line.startCircle === activeObject ? line.endCircle : line.startCircle;
        if (otherCircle && !orphanedCircles.includes(otherCircle)) {
          const remainingConnections = this.fabricCanvas.getObjects().filter((obj) => {
            const isWall = obj.type === "line" && obj.stroke === "red";
            const isNotCurrent = !connectedLines.includes(obj);
            const isConnected = obj.startCircle === otherCircle || obj.endCircle === otherCircle;
            return isWall && isNotCurrent && isConnected;
          });
          if (remainingConnections.length === 0) {
            orphanedCircles.push(otherCircle);
          }
        }
      });

      allObjectsToDelete.push(...orphanedCircles);
      const commands = allObjectsToDelete.map((obj) => new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, obj, []));
      const compoundCommand = new CanvasUndoSystem.MultipleCommand(commands);
      this.executeCommand(compoundCommand);
    } else {
      // Regular deletion
      const relatedObjects = this.findRelatedObjects(activeObject);
      const command = new CanvasUndoSystem.RemoveCommand(this.fabricCanvas, activeObject, relatedObjects);
      this.executeCommand(command);
    }
  }

  // Find objects related to a target object (e.g., labels for devices)
  findRelatedObjects(obj) {
    const related = [];

    // Device groups
    if (obj.type === "group" && obj.deviceType) {
      if (obj.textObject) {
        related.push(obj.textObject);
      } else {
        const deviceText = this.fabricCanvas.getObjects().find((textObj) => {
          const isLabel = textObj.type === "i-text" && textObj.isDeviceLabel;
          const isMatch = textObj.deviceId === obj.id;
          return isLabel || isMatch;
        });
        if (deviceText) related.push(deviceText);
      }
    }

    // Zone polygons
    if (obj.type === "polygon" && obj.class === "zone-polygon") {
      if (obj.associatedText) {
        related.push(obj.associatedText);
      } else {
        const zoneText = this.fabricCanvas.getObjects().find((textObj) => {
          const isZoneText = textObj.type === "i-text" && textObj.class === "zone-text";
          const isMatch = textObj.associatedPolygon === obj;
          return isZoneText && isMatch;
        });
        if (zoneText) related.push(zoneText);
      }
    }

    // Zone text
    if (obj.type === "i-text" && obj.class === "zone-text" && obj.associatedPolygon) {
      related.push(obj.associatedPolygon);
    }

    return related;
  }

  // Clear undo and redo stacks
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateButtonState();
  }

  // Reset the undo system state
  reset() {
    this.undoStack = [];
    this.redoStack = [];
    this.isExecutingCommand = false;
    this.updateButtonState();
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) undoBtn.disabled = true;
  }

  // Reinitialize the undo system
  reinitialize() {
    this.fabricCanvas.off("object:added");
    this.undoStack = [];
    this.redoStack = [];
    this.isExecutingCommand = true;
    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) undoBtn.disabled = true;
  }

  // Enable object tracking for undo commands
  enableTracking() {
    this.isExecutingCommand = false;
    this.setupObjectAddedTracking();
    this.updateButtonState();
  }
}

// Initialize undo system and expose to global scope
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
