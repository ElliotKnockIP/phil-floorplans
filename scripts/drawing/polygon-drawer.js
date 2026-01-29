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

    // Initialize arrays and event listeners based on polygon type
    const arrayName = type === "zone" ? "zones" : type === "room" ? "rooms" : type === "risk" ? "risks" : "safetyZones";
    const btnId = type === "zone" ? "create-zone-btn" : type === "room" ? "create-room-btn" : type === "risk" ? "create-risk-btn" : "create-safety-btn";
    window[arrayName] = window[arrayName] || [];

    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => this.activate());
    } else {
      // Handle case where button is loaded dynamically
      document.addEventListener("htmlIncludesLoaded", () => {
        document.getElementById(btnId)?.addEventListener("click", () => this.activate());
      });
    }

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
        // Check if clicked object is related to the current polygon
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
    if (this.type === "zone") return "zones";
    if (this.type === "room") return "rooms";
    if (this.type === "risk") return "risks";
    return "safetyZones";
  }

  // Get color based on type and count
  getDrawingColor() {
    const count = window[this.getArrayName()].length;
    const hueArrays = {
      zone: [0, 120, 240, 60, 180, 300, 30, 150, 270, 90],
      room: [210, 30, 120, 270, 60, 330, 90, 180, 240, 300],
      risk: [170, 280, 320, 200, 45, 260, 340, 80, 300, 160], // Starts with teal (#00897b), then varied
      safety: [35, 45, 55, 25, 15, 65, 75, 30, 40, 50], // Darker yellow/orange hues for safety zones
    };
    const hue = hueArrays[this.type][count % 10];
    if (this.type === "zone") return `hsla(${hue}, 70%, 60%, 1)`;
    if (this.type === "room") return `hsl(${hue}, 70%, 50%)`;
    if (this.type === "safety") return `hsl(${hue}, 90%, 45%)`; // Safety: darker yellow-based colors
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
      <div class="switch">
        <div class="slider"></div>
      </div>
      <span class="status" style="font-weight:600;min-width:30px"></span>
      <div style="font-size:12px;color:#aaa;margin-top:4px;text-align:center;">Press 'L' to toggle<br>ESC to exit</div>
    `;

    toggle.querySelector(".switch").onclick = () => this.toggleLock();
    document.body.appendChild(toggle);
    return toggle;
  }

  // Toggle line lock and update UI
  toggleLock() {
    this.lineLock = !this.lineLock;
    this.updateToggleUI();
    this.updateTempLineStyles();
  }

  // Update style of existing temporary lines when lock state changes
  updateTempLineStyles() {
    if (!this.points.length) return;

    const drawingColor = this.getDrawingColor();
    const style = this.lineLock ? { color: "#f8794b", dash: [3, 3] } : { color: drawingColor, dash: [5, 5] };

    this.tempLines.forEach((line) => {
      line.set({
        stroke: style.color,
        strokeDashArray: style.dash,
      });
    });

    if (this.preview) {
      this.preview.set({
        stroke: style.color,
        strokeDashArray: style.dash,
      });
    }

    this.fabricCanvas.requestRenderAll();
  }

  // Update toggle UI appearance
  updateToggleUI() {
    const toggle = document.getElementById("line-lock-toggle");
    if (!toggle) return;

    const [switchEl, slider, status] = [".switch", ".slider", ".status"].map((sel) => toggle.querySelector(sel));
    const isOn = this.lineLock;

    if (isOn) {
      switchEl.classList.add("active");
    } else {
      switchEl.classList.remove("active");
    }

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

    // Find closest cardinal direction
    const cardinals = [0, 90, 180, 270];
    const getDiff = (a, b) => Math.min(Math.abs(a - b), Math.abs(a - b + 360), Math.abs(a - b - 360));

    const closest = cardinals.reduce((prev, curr) => {
      const prevDiff = getDiff(angle, prev);
      const currDiff = getDiff(angle, curr);
      return currDiff < prevDiff ? curr : prev;
    });

    // Snap if within 15 degrees of cardinal
    const angleDiff = getDiff(angle, closest);
    if (angleDiff <= 15) {
      const rad = (closest * Math.PI) / 180;
      return { x: start.x + dist * Math.cos(rad), y: start.y + dist * Math.sin(rad) };
    }
    return current;
  }

  // Utility functions
  // Calculate distance between two points
  distance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  // Check if point is near the start point to close polygon
  isNearStart = (point) => this.points.length >= 3 && this.distance(point, this.points[0]) <= 20;
  // Calculate area of polygon in square meters
  calcArea = (points, ppm = 17.5) => {
    const area = points.reduce((acc, p, i) => acc + p.x * points[(i + 1) % points.length].y - points[(i + 1) % points.length].x * p.y, 0);
    return Math.abs(area) / (2 * ppm * ppm);
  };
  // Calculate geometric center of points
  calcCenter = (points) => ({
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  });

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

    // Complete polygon if clicking near start
    if (this.isNearStart(pointer)) return this.complete();

    this.points.push(pointer);

    // Create start circle for first point
    if (this.points.length === 1) {
      this.startCircle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 5,
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
    if (this.lineLock && !nearStart && this.points.length >= 3) {
      const threshold = 15;
      const verticallyAligned = Math.abs(pointer.x - startPoint.x) <= threshold;
      const horizontallyAligned = Math.abs(pointer.y - startPoint.y) <= threshold;

      // Show vertical alignment guide
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

      // Show horizontal alignment guide
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
    const lineStyle = nearStart ? { color: "#00ff00", width: 2, dash: [5, 5] } : this.lineLock ? { color: "#f8794b", width: 2, dash: [3, 3] } : { color: drawingColor, width: 2, dash: [5, 5] };

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

    // Determine fill style based on type
    let fillStyle;
    if (this.type === "zone") {
      fillStyle = color.replace("1)", "0.2)");
    } else if (this.type === "room") {
      fillStyle = "transparent";
    } else if (this.type === "safety") {
      // Safety: yellow tinted fill
      fillStyle = this.hexToRgba(color, 0.3);
    } else {
      // Risk: more prominent fill to clearly distinguish from zones/rooms
      fillStyle = this.hexToRgba(color, 0.35);
    }

    // Create polygon object
    const polygonProps = {
      fill: fillStyle,
      stroke: color,
      strokeWidth: 2,
      strokeLineJoin: "round",
      selectable: true,
      evented: true,
      perPixelTargetFind: true,
      hasControls: false,
      hasBorders: false,
      class: `${this.type}-polygon`,
      [`${this.type}Name`]: name,
      [`${this.type}Notes`]: "",
    };

    // Add height/volume for non-risk types
    if (this.type !== "risk") {
      const height = 2.4;
      polygonProps.area = area;
      polygonProps.ceilingHeight = height;
      polygonProps.volume = area * height;
    }

    const polygon = new fabric.Polygon(this.points, polygonProps);

    // Create text object
    const textProps = {
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
    };

    if (this.type !== "risk") {
      textProps.displayHeight = 2.4;
    }

    const text = new fabric.IText(name, textProps);

    // Set up event handlers
    this.addEventHandlers(polygon, text);

    // Add to appropriate array and canvas
    let item;
    if (this.type === "zone") {
      item = { polygon, text };
    } else if (this.type === "room") {
      const height = 2.4;
      item = {
        polygon,
        text,
        roomName: name,
        roomNotes: "",
        devices: [],
        roomColor: color,
        area,
        height,
        volume: area * height,
      };
    } else if (this.type === "safety") {
      item = { polygon, text, safetyName: name, safetySubDetails: [], devices: [], safetyColor: color };
    } else {
      // Risk type
      item = { polygon, text, riskName: name, riskNotes: "", devices: [], riskColor: color };
    }
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
      } else if (this.type === "safety") {
        const safety = window.safetyZones.find((s) => s.polygon === polygon);
        window.showSafetyProperties?.(polygon, text, safety);
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

    // Set up keyboard handler for line lock
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

export function setupSafetyTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "safety");
  setupDeletion(fabricCanvas, "safety");
}

// Unified deletion handler for zones, rooms, risks, and safety zones
function setupDeletion(fabricCanvas, type) {
  const arrayName = type === "zone" ? "zones" : type === "room" ? "rooms" : type === "risk" ? "risks" : "safetyZones";
  const className = `${type}-polygon`;
  const textClass = `${type}-text`;

  // Delete item from canvas and global array
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

  // Handle delete key events
  const handler = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const active = fabricCanvas.getActiveObject();
      if (!active) return;

      const isTargetPolygon = active.type === "polygon" && active.class === className;
      const isTargetText = active.type === "i-text" && active.class === textClass;

      if (isTargetPolygon || isTargetText) {
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
