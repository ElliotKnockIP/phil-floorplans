import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";
import { enablePolygonEditing, disablePolygonEditing } from "./polygon-editing.js";

class PolygonDrawer {
  constructor(fabricCanvas, type) {
    this.fabricCanvas = fabricCanvas;
    this.type = type;
    this.isCreating = false;
    this.points = [];
    this.tempLines = [];
    this.preview = null;
    this.startCircle = null;
    this.guideLines = [];
    this.lineLock = false;
    this.keyHandler = null;

    // Initialize arrays and event listeners
    const arrayName = type === "zone" ? "zones" : type === "room" ? "rooms" : "risks";
    const btnId = type === "zone" ? "create-zone-btn" : type === "room" ? "create-room-btn" : "create-risk-btn";
    window[arrayName] = window[arrayName] || [];
    document.getElementById(btnId)?.addEventListener("click", () => this.activate());

    // Clear edit handles if selection is fully cleared (clicking empty space)
    if (!fabricCanvas.polygonEditSelectionHandlerAttached) {
      fabricCanvas.polygonEditSelectionHandlerAttached = true;
      fabricCanvas.on("selection:cleared", () => {
        const poly = fabricCanvas.currentEditedPolygon;
        if (poly) {
          disablePolygonEditing(fabricCanvas, poly);
          window.hideDeviceProperties?.();
        }
      });

      // Also clear when clicking on anything unrelated (including empty canvas)
      fabricCanvas.on("mouse:down", (opt) => {
        const currentPoly = fabricCanvas.currentEditedPolygon;
        if (!currentPoly) return;
        const target = opt.target;
        const isRelated = target && (target === currentPoly || target === currentPoly.associatedText || (target.data && target.data.polygon === currentPoly));
        if (!isRelated) {
          disablePolygonEditing(fabricCanvas, currentPoly);
          window.hideDeviceProperties?.();
        }
      });
    }
  }

  // Get array name based on type
  getArrayName() {
    return this.type === "zone" ? "zones" : this.type === "room" ? "rooms" : "risks";
  }

  // Get color based on type and count
  getDrawingColor() {
    const count = window[this.getArrayName()].length;
    const hueArrays = {
      zone: [0, 120, 240, 60, 180, 300, 30, 150, 270, 90],
      room: [210, 30, 120, 270, 60, 330, 90, 180, 240, 300],
      risk: [170, 280, 320, 200, 45, 260, 340, 80, 300, 160], // Starts with teal (#00897b), then varied
    };
    const hue = hueArrays[this.type][count % 10];
    if (this.type === "zone") return `hsla(${hue}, 70%, 60%, 1)`;
    if (this.type === "room") return `hsl(${hue}, 70%, 50%)`;
    return `hsl(${hue}, 100%, 27%)`; // Risk: starts teal, then varied colors
  }

  // Create and manage line lock toggle UI
  createToggle() {
    let toggle = document.getElementById("line-lock-toggle");
    if (toggle) return toggle;

    toggle = document.createElement("div");
    toggle.id = "line-lock-toggle";
    toggle.innerHTML = `
      <span style="font-weight:500">Line Lock:</span>
      <div class="switch" style="position:relative;width:44px;height:24px;background:#555;border-radius:12px;cursor:pointer;transition:background 0.3s">
        <div class="slider" style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:white;border-radius:50%;transition:transform 0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2)"></div>
      </div>
      <span class="status" style="font-weight:600;min-width:30px"></span>
      <div style="font-size:12px;color:#aaa;margin-top:4px;text-align:center;">Press 'L' to toggle<br>ESC to exit</div>
    `;

    Object.assign(toggle.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: "rgba(40,40,40,0.95)",
      border: "2px solid #f8794b",
      borderRadius: "8px",
      padding: "12px 16px",
      color: "white",
      fontFamily: '"Poppins", sans-serif',
      fontSize: "14px",
      zIndex: "1000",
      display: "none",
      alignItems: "center",
      gap: "10px",
      backdropFilter: "blur(5px)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });

    toggle.querySelector(".switch").onclick = () => this.toggleLock();
    document.body.appendChild(toggle);
    return toggle;
  }

  // Toggle line lock and update UI
  toggleLock() {
    this.lineLock = !this.lineLock;
    this.updateToggleUI();
  }

  // Update toggle UI appearance
  updateToggleUI() {
    const toggle = document.getElementById("line-lock-toggle");
    if (!toggle) return;

    const [switchEl, slider, status] = [".switch", ".slider", ".status"].map((sel) => toggle.querySelector(sel));
    const isOn = this.lineLock;

    switchEl.style.background = isOn ? "#f8794b" : "#555";
    slider.style.transform = isOn ? "translateX(20px)" : "translateX(0)";
    status.textContent = isOn ? "ON" : "OFF";
    status.style.color = isOn ? "#51cf66" : "#ff6b6b";
  }

  // Snap point to cardinal directions when line lock is enabled
  snapPoint(start, current) {
    if (!this.lineLock) return current;

    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return current;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const cardinals = [0, 90, 180, 270];
    const closest = cardinals.reduce((prev, curr) => {
      const prevDiff = Math.min(Math.abs(angle - prev), Math.abs(angle - prev + 360), Math.abs(angle - prev - 360));
      const currDiff = Math.min(Math.abs(angle - curr), Math.abs(angle - curr + 360), Math.abs(angle - curr - 360));
      return currDiff < prevDiff ? curr : prev;
    });

    const angleDiff = Math.min(Math.abs(angle - closest), Math.abs(angle - closest + 360), Math.abs(angle - closest - 360));
    if (angleDiff <= 15) {
      const rad = (closest * Math.PI) / 180;
      return { x: start.x + dist * Math.cos(rad), y: start.y + dist * Math.sin(rad) };
    }
    return current;
  }

  // Utility functions
  distance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  isNearStart = (point) => this.points.length >= 3 && this.distance(point, this.points[0]) <= 20;
  calcArea = (points, ppm = 17.5) => Math.abs(points.reduce((area, p, i) => area + p.x * points[(i + 1) % points.length].y - points[(i + 1) % points.length].x * p.y, 0)) / (2 * ppm * ppm);
  calcCenter = (points) => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });

  // Clear guide lines from canvas
  clearGuideLines() {
    this.guideLines.forEach((line) => this.fabricCanvas.remove(line));
    this.guideLines = [];
  }

  // Handle mouse down events for point placement
  handleMouseDown = (o) => {
    o.e.preventDefault();
    let pointer = this.fabricCanvas.getPointer(o.e);

    // Apply line lock snapping if enabled
    if (this.points.length > 0 && this.lineLock) {
      pointer = this.snapPoint(this.points[this.points.length - 1], pointer);
    }

    // Auto-align to start point when near completion
    if (this.points.length >= 3) {
      const startPoint = this.points[0];
      const threshold = 25;
      if (Math.abs(pointer.x - startPoint.x) <= threshold) pointer.x = startPoint.x;
      else if (Math.abs(pointer.y - startPoint.y) <= threshold) pointer.y = startPoint.y;
    }

    if (this.isNearStart(pointer)) return this.complete();

    this.points.push(pointer);

    // Create start circle for first point
    if (this.points.length === 1) {
      this.startCircle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 6,
        fill: "transparent",
        stroke: "#00ff00",
        strokeWidth: 3,
        strokeDashArray: [5, 5],
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        isTempCircle: true,
      });
      this.fabricCanvas.add(this.startCircle);
    } else {
      // Create temporary line between points
      const lastPoint = this.points[this.points.length - 2];
      const drawingColor = this.getDrawingColor();
      const newLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
        stroke: this.lineLock ? "#f8794b" : drawingColor,
        strokeWidth: 2,
        strokeDashArray: this.lineLock ? [3, 3] : [5, 5],
        selectable: false,
        evented: false,
        isTempLine: true,
      });
      this.fabricCanvas.add(newLine);
      this.tempLines.push(newLine);
    }

    this.startCircle?.bringToFront();
    this.fabricCanvas.requestRenderAll();
  };

  // Handle mouse move for preview line and guides
  handleMouseMove = (o) => {
    if (!this.points.length) return;

    let pointer = this.fabricCanvas.getPointer(o.e);
    const lastPoint = this.points[this.points.length - 1];
    const startPoint = this.points[0];
    const nearStart = this.isNearStart(pointer);

    // Apply line lock snapping
    if (this.lineLock) pointer = this.snapPoint(lastPoint, pointer);

    // Handle auto-alignment guides
    this.clearGuideLines();
    if (!nearStart && this.points.length >= 3) {
      const threshold = 15;
      const verticallyAligned = Math.abs(pointer.x - startPoint.x) <= threshold;
      const horizontallyAligned = Math.abs(pointer.y - startPoint.y) <= threshold;

      if (verticallyAligned) {
        const guide = new fabric.Line([startPoint.x, 0, startPoint.x, this.fabricCanvas.height], {
          stroke: "#00ff00",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          isGuideLine: true,
          opacity: 0.7,
        });
        this.fabricCanvas.add(guide);
        this.guideLines.push(guide);
        pointer.x = startPoint.x;
      }

      if (horizontallyAligned) {
        const guide = new fabric.Line([0, startPoint.y, this.fabricCanvas.width, startPoint.y], {
          stroke: "#00ff00",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          isGuideLine: true,
          opacity: 0.7,
        });
        this.fabricCanvas.add(guide);
        this.guideLines.push(guide);
        pointer.y = startPoint.y;
      }
    }

    // Create preview line
    const drawingColor = this.getDrawingColor();
    const lineStyle = nearStart ? { color: "#00ff00", width: 3, dash: [5, 5] } : this.lineLock ? { color: "#f8794b", width: 2, dash: [3, 3] } : { color: drawingColor, width: 2, dash: [5, 5] };

    this.preview && this.fabricCanvas.remove(this.preview);
    this.preview = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
      stroke: lineStyle.color,
      strokeWidth: lineStyle.width,
      strokeDashArray: lineStyle.dash,
      selectable: false,
      evented: false,
    });

    this.fabricCanvas.add(this.preview);
    this.startCircle?.bringToFront();
    this.guideLines.forEach((guide) => guide.bringToFront());
    this.fabricCanvas.setCursor(nearStart ? "pointer" : "crosshair");
    this.fabricCanvas.requestRenderAll();
  };

  // Complete polygon creation
  complete() {
    // Clean up temporary objects
    [...this.tempLines, this.preview, this.startCircle].forEach((obj) => obj && this.fabricCanvas.remove(obj));
    this.clearGuideLines();

    const area = this.calcArea(this.points, this.fabricCanvas.pixelsPerMeter);
    const center = this.calcCenter(this.points);

    // Create polygon and text objects
    this.createPolygon(area, center);
    this.cleanup();
    stopCurrentTool();
  }

  // Unified polygon creation for zones, rooms, and risks
  createPolygon(area, center) {
    const arrayName = this.getArrayName();
    const count = window[arrayName].length;
    const typeName = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    const name = `${typeName} ${count + 1}`;
    const color = this.getDrawingColor();
    const height = 2.4;

    // Determine fill style based on type
    let fillStyle;
    if (this.type === "zone") {
      fillStyle = color.replace("1)", "0.2)");
    } else if (this.type === "room") {
      fillStyle = "transparent";
    } else {
      // Risk: more prominent fill to clearly distinguish from zones/rooms
      fillStyle = this.hexToRgba(color, 0.35);
    }

    // Create polygon object
    const polygon = new fabric.Polygon(this.points, {
      fill: fillStyle,
      stroke: color,
      strokeWidth: 2,
      selectable: true,
      evented: true,
      perPixelTargetFind: true,
      hasControls: false,
      hasBorders: false,
      class: `${this.type}-polygon`,
      [`${this.type}Name`]: name,
      [`${this.type}Notes`]: "",
      area,
      height,
      volume: area * height,
    });

    // Create text object
    const text = new fabric.IText(name, {
      class: `${this.type}-text`,
      left: center.x,
      top: center.y,
      fontSize: this.type === "zone" ? 15 : 14,
      fill: color,
      fontFamily: "Poppins, sans-serif",
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      editable: false,
      hasControls: false,
      hasBorders: true,
      displayHeight: height,
      borderColor: "#f8794b",
      borderScaleFactor: 2,
      cornerSize: 8,
      cornerColor: "#f8794b",
      cornerStrokeColor: "#000000",
      cornerStyle: "circle",
      transparentCorners: false,
      padding: 5,
      offsetX: 0,
      offsetY: 0,
    });

    // Set up event handlers
    this.addEventHandlers(polygon, text);

    // Add to appropriate array and canvas
    const item = this.type === "zone" 
      ? { polygon, text } 
      : { polygon, text, [`${this.type}Name`]: name, [`${this.type}Notes`]: "", devices: [], [`${this.type}Color`]: color, area, height, volume: area * height };
    window[arrayName].push(item);

    // Handle undo system
    const undoSystem = window.undoSystem;
    const prevExecuting = undoSystem?.isExecutingCommand || false;
    if (undoSystem) undoSystem.isExecutingCommand = true;
    this.fabricCanvas.add(polygon, text);
    if (undoSystem) {
      undoSystem.isExecutingCommand = prevExecuting;
      const addCommand = new window.UndoCommands.AddCommand(this.fabricCanvas, polygon, [text]);
      undoSystem.addToStack(addCommand);
    }
  }

  // Helper to convert hex/hsl color to rgba
  hexToRgba(color, alpha) {
    // Create a temporary element to compute the color
    const temp = document.createElement("div");
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    // Parse rgb(r, g, b) format
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    return color;
  }

  // Set up event handlers for polygon and text
  addEventHandlers(polygon, text) {
    polygon.associatedText = text;
    text.associatedPolygon = polygon;

    // Set original center after a brief delay
    setTimeout(() => (polygon.originalCenter = polygon.getCenterPoint()), 100);

    // Handle polygon movement
    polygon.on("moving", () => {
      if (text && this.fabricCanvas.getObjects().includes(text)) {
        const center = polygon.getCenterPoint();
        text.set({ left: center.x + (text.offsetX || 0), top: center.y + (text.offsetY || 0) });
        text.setCoords();
        this.fabricCanvas.requestRenderAll();
      }
    });

    // Handle text movement
    text.on("moving", () => {
      if (polygon && this.fabricCanvas.getObjects().includes(polygon)) {
        const center = polygon.getCenterPoint();
        text.offsetX = text.left - center.x;
        text.offsetY = text.top - center.y;
        text.setCoords();
        this.fabricCanvas.requestRenderAll();
      }
    });

    // Handle selection events
    const showProps = () => {
      if (this.type === "zone") {
        window.showDeviceProperties?.("zone-polygon", text, polygon, polygon.height);
      } else if (this.type === "room") {
        const room = window.rooms.find((r) => r.polygon === polygon);
        window.showRoomProperties?.(polygon, text, room);
      } else {
        // Risk type
        const risk = window.risks.find((r) => r.polygon === polygon);
        window.showRiskProperties?.(polygon, text, risk);
      }
    };

    [polygon, text].forEach((obj) => {
      obj.on("selected", () => {
        showProps();
        enablePolygonEditing(this.fabricCanvas, polygon);
        this.fabricCanvas.requestRenderAll();
      });
      obj.on("deselected", () => {
        setTimeout(() => {
          const active = this.fabricCanvas.getActiveObject();
          const other = obj === polygon ? text : polygon;
          // Keep editing if the new active object is the polygon, its text, or one of its edit controls
          const isRelated = active && (active === polygon || active === text || (active.data && active.data.polygon === polygon));

          if (isRelated) return;

          window.hideDeviceProperties?.();
          disablePolygonEditing(this.fabricCanvas, polygon);
        }, 10);
      });
    });
  }

  // Activate polygon drawing tool
  activate() {
    if (this.isCreating) return;
    this.isCreating = true;

    closeSidebar();
    this.cleanup();
    this.lineLock = true;

    // Create and show toggle
    const existingToggle = document.getElementById("line-lock-toggle");
    if (existingToggle) existingToggle.remove();
    const toggle = this.createToggle();
    toggle.style.display = "flex";
    this.updateToggleUI();

    // Set up keyboard handler
    this.keyHandler = (e) => {
      if (e.key.toLowerCase() === "l" || e.key === "F8") {
        e.preventDefault();
        this.toggleLock();
      }
    };
    document.addEventListener("keydown", this.keyHandler);

    registerToolCleanup(() => this.cleanup());
    startTool(this.fabricCanvas, this.type, this.handleMouseDown, this.handleMouseMove, null, true);
  }

  // Clean up all temporary objects and reset state
  cleanup() {
    [...this.tempLines, this.preview, this.startCircle].forEach((obj) => obj && this.fabricCanvas.remove(obj));
    this.clearGuideLines();

    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    // Reset all state
    Object.assign(this, {
      tempLines: [],
      preview: null,
      startCircle: null,
      points: [],
      isCreating: false,
      lineLock: false,
    });

    const toggle = document.getElementById("line-lock-toggle");
    if (toggle) toggle.style.display = "none";
    this.fabricCanvas.requestRenderAll();
  }
}

// Setup functions for zones, rooms, and risks
export function setupZoneTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "zone");
  setupDeletion(fabricCanvas, "zone");
}

export function setupRoomTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "room");
  setupDeletion(fabricCanvas, "room");
}

export function setupRiskTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "risk");
  setupDeletion(fabricCanvas, "risk");
}

// Unified deletion handler for zones, rooms, and risks
function setupDeletion(fabricCanvas, type) {
  const arrayName = type === "zone" ? "zones" : type === "room" ? "rooms" : "risks";
  const className = `${type}-polygon`;
  const textClass = `${type}-text`;

  const deleteItem = (item) => {
    const index = window[arrayName].findIndex((obj) => obj.polygon === item || obj.text === item);
    if (index === -1) return false;

    const obj = window[arrayName][index];
    [obj.polygon, obj.text].forEach((el) => {
      if (el) {
        el.off();
        fabricCanvas.remove(el);
      }
    });

    window[arrayName].splice(index, 1);
    fabricCanvas.discardActiveObject();
    window.hideDeviceProperties?.();
    fabricCanvas.requestRenderAll();
    return true;
  };

  window[`delete${type.charAt(0).toUpperCase() + type.slice(1)}`] = deleteItem;

  const handler = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const active = fabricCanvas.getActiveObject();
      if (active && ((active.type === "polygon" && active.class === className) || (active.type === "i-text" && active.class === textClass))) {
        if (deleteItem(active)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  const handlerName = `${type}DeletionHandler`;
  if (window[handlerName]) document.removeEventListener("keydown", window[handlerName]);
  window[handlerName] = handler;
  document.addEventListener("keydown", handler);
}
