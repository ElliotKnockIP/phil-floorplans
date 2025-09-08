import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

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

    this.init();
  }

  init() {
    const buttonId = this.type === "zone" ? "create-zone-btn" : "create-room-btn";
    document.getElementById(buttonId)?.addEventListener("click", () => this.activate());

    if (this.type === "zone") window.zones = window.zones || [];
    else window.rooms = window.rooms || [];
  }

  getDrawingColor() {
    if (this.type === "zone") {
      const hue = [0, 120, 240, 60, 180, 300, 30, 150, 270, 90][window.zones.length % 10];
      return `hsla(${hue}, 70%, 60%, 1)`;
    } else {
      const hues = [210, 30, 120, 270, 60, 330, 90, 180, 240, 300];
      return `hsl(${hues[window.rooms.length % hues.length]}, 70%, 50%)`;
    }
  }

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

  toggleLock() {
    this.lineLock = !this.lineLock;
    this.updateToggleUI();
  }

  updateToggleUI() {
    const toggle = document.getElementById("line-lock-toggle");
    if (!toggle) return;

    const switchEl = toggle.querySelector(".switch");
    const slider = toggle.querySelector(".slider");
    const status = toggle.querySelector(".status");

    if (this.lineLock) {
      switchEl.style.background = "#f8794b";
      slider.style.transform = "translateX(20px)";
      status.textContent = "ON";
      status.style.color = "#51cf66";
    } else {
      switchEl.style.background = "#555";
      slider.style.transform = "translateX(0)";
      status.textContent = "OFF";
      status.style.color = "#ff6b6b";
    }
  }

  snapPoint(start, current) {
    if (!this.lineLock) return current;

    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return current;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const cardinals = [0, 90, 180, 270];
    let closest = cardinals.reduce((prev, curr) => {
      const prevDiff = Math.min(Math.abs(angle - prev), Math.abs(angle - prev + 360), Math.abs(angle - prev - 360));
      const currDiff = Math.min(Math.abs(angle - curr), Math.abs(angle - curr + 360), Math.abs(angle - curr - 360));
      return currDiff < prevDiff ? curr : prev;
    });

    const snapThreshold = 15;
    const angleDiff = Math.min(Math.abs(angle - closest), Math.abs(angle - closest + 360), Math.abs(angle - closest - 360));

    if (angleDiff <= snapThreshold) {
      const rad = (closest * Math.PI) / 180;
      return { x: start.x + dist * Math.cos(rad), y: start.y + dist * Math.sin(rad) };
    }
    return current;
  }

  distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  isNearStart(point) {
    return this.points.length >= 3 && this.distance(point, this.points[0]) <= 20;
  }

  calcArea(points, ppm = 17.5) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / (2 * ppm * ppm);
  }

  calcCenter(points) {
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  }

  clearGuideLines() {
    this.guideLines.forEach((line) => this.fabricCanvas.remove(line));
    this.guideLines = [];
  }

  handleMouseDown = (o) => {
    o.e.preventDefault();
    let pointer = this.fabricCanvas.getPointer(o.e);

    if (this.points.length > 0 && this.lineLock) {
      pointer = this.snapPoint(this.points[this.points.length - 1], pointer);
    }

    if (this.points.length >= 3) {
      const startPoint = this.points[0];
      const alignmentThreshold = 25;
      const verticallyAligned = Math.abs(pointer.x - startPoint.x) <= alignmentThreshold;
      const horizontallyAligned = Math.abs(pointer.y - startPoint.y) <= alignmentThreshold;

      if (verticallyAligned) {
        pointer.x = startPoint.x;
      } else if (horizontallyAligned) {
        pointer.y = startPoint.y;
      }
    }

    if (this.isNearStart(pointer)) return this.complete();

    this.points.push(pointer);

    if (this.points.length === 1) {
      const startCircle = new fabric.Circle({
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

      this.fabricCanvas.add(startCircle);
      this.startCircle = startCircle;
    } else {
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

  handleMouseMove = (o) => {
    if (!this.points.length) return;

    let pointer = this.fabricCanvas.getPointer(o.e);
    const lastPoint = this.points[this.points.length - 1];
    const startPoint = this.points[0];
    const nearStart = this.isNearStart(pointer);

    if (this.lineLock) {
      pointer = this.snapPoint(lastPoint, pointer);
    }

    const alignmentThreshold = 15;
    if (!nearStart && this.points.length >= 3) {
      const verticallyAligned = Math.abs(pointer.x - startPoint.x) <= alignmentThreshold;
      const horizontallyAligned = Math.abs(pointer.y - startPoint.y) <= alignmentThreshold;

      this.clearGuideLines();

      if (verticallyAligned) {
        const verticalGuide = new fabric.Line([startPoint.x, 0, startPoint.x, this.fabricCanvas.height], {
          stroke: "#00ff00",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          isGuideLine: true,
          opacity: 0.7,
        });
        this.fabricCanvas.add(verticalGuide);
        this.guideLines.push(verticalGuide);
        pointer.x = startPoint.x;
      }

      if (horizontallyAligned) {
        const horizontalGuide = new fabric.Line([0, startPoint.y, this.fabricCanvas.width, startPoint.y], {
          stroke: "#00ff00",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          isGuideLine: true,
          opacity: 0.7,
        });
        this.fabricCanvas.add(horizontalGuide);
        this.guideLines.push(horizontalGuide);
        pointer.y = startPoint.y;
      }
    } else {
      this.clearGuideLines();
    }

    const drawingColor = this.getDrawingColor();
    let lineColor = drawingColor;
    let lineWidth = 2;
    let dashArray = [5, 5];

    if (nearStart) {
      lineColor = "#00ff00";
      lineWidth = 3;
    } else if (this.lineLock) {
      lineColor = "#f8794b";
      dashArray = [3, 3];
    }

    this.preview && this.fabricCanvas.remove(this.preview);
    this.preview = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
      stroke: lineColor,
      strokeWidth: lineWidth,
      strokeDashArray: dashArray,
      selectable: false,
      evented: false,
    });

    this.fabricCanvas.add(this.preview);
    this.startCircle?.bringToFront();
    this.guideLines.forEach((guide) => guide.bringToFront());

    this.fabricCanvas.setCursor(nearStart ? "pointer" : "crosshair");
    this.fabricCanvas.requestRenderAll();
  };

  complete() {
    this.tempLines.forEach((line) => line && this.fabricCanvas.remove(line));
    this.preview && this.fabricCanvas.remove(this.preview);
    this.startCircle && this.fabricCanvas.remove(this.startCircle);
    this.clearGuideLines();

    const area = this.calcArea(this.points, this.fabricCanvas.pixelsPerMeter);
    const center = this.calcCenter(this.points);

    if (this.type === "zone") this.createZone(area, center);
    else this.createRoom(area, center);

    this.cleanup();
    stopCurrentTool();
  }

  createZone(area, center) {
    const name = `Zone ${window.zones.length + 1}`;
    const height = 2.4;
    const hue = [0, 120, 240, 60, 180, 300, 30, 150, 270, 90][window.zones.length % 10];
    const fill = `hsla(${hue}, 70%, 60%, 0.2)`;
    const stroke = `hsla(${hue}, 70%, 60%, 1)`;

    const polygon = new fabric.Polygon(this.points, {
      fill,
      stroke,
      strokeWidth: 2,
      zoneName: name,
      zoneNotes: "",
      class: "zone-polygon",
      area,
      height,
      volume: area * height,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
    });

    const text = new fabric.IText(name, {
      class: "zone-text",
      left: center.x,
      top: center.y,
      fontSize: 15,
      fill: stroke,
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

    this.addEventHandlers(polygon, text);
    window.zones.push({ polygon, text });
    this.fabricCanvas.add(polygon, text);
  }

  createRoom(area, center) {
    const name = `Room ${window.rooms.length + 1}`;
    const hues = [210, 30, 120, 270, 60, 330, 90, 180, 240, 300];
    const color = `hsl(${hues[window.rooms.length % hues.length]}, 70%, 50%)`;

    const polygon = new fabric.Polygon(this.points, {
      fill: "transparent",
      stroke: color,
      strokeWidth: 2,
      roomName: name,
      roomNotes: "",
      class: "room-polygon",
      area,
      height: 2.4,
      volume: area * 2.4,
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
    });

    const text = new fabric.IText(name, {
      class: "room-text",
      left: center.x,
      top: center.y,
      fontSize: 14,
      fill: color,
      fontFamily: "Poppins, sans-serif",
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      editable: false,
      hasControls: false,
      hasBorders: true,
      displayHeight: 2.4,
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

    this.addEventHandlers(polygon, text);
    const room = { polygon, text, roomName: name, roomNotes: "", devices: [], roomColor: color, area, height: 2.4, volume: area * 2.4 };
    window.rooms.push(room);
    this.fabricCanvas.add(polygon, text);
  }

  addEventHandlers(polygon, text) {
    polygon.associatedText = text;
    text.associatedPolygon = polygon;

    setTimeout(() => (polygon.originalCenter = polygon.getCenterPoint()), 100);

    polygon.on("moving", () => {
      if (text && this.fabricCanvas.getObjects().includes(text)) {
        const center = polygon.getCenterPoint();
        text.set({ left: center.x + (text.offsetX || 0), top: center.y + (text.offsetY || 0) });
        text.setCoords();
        this.fabricCanvas.requestRenderAll();
      }
    });

    text.on("moving", () => {
      if (polygon && this.fabricCanvas.getObjects().includes(polygon)) {
        const center = polygon.getCenterPoint();
        text.offsetX = text.left - center.x;
        text.offsetY = text.top - center.y;
        text.setCoords();
        this.fabricCanvas.requestRenderAll();
      }
    });

    const showProps = () => {
      if (this.type === "zone") {
        window.showDeviceProperties?.("zone-polygon", text, polygon, polygon.height);
      } else {
        const room = window.rooms.find((r) => r.polygon === polygon);
        window.showRoomProperties?.(polygon, text, room);
      }
    };

    [polygon, text].forEach((obj) => {
      obj.on("selected", () => {
        showProps();
        this.fabricCanvas.requestRenderAll();
      });
      obj.on("deselected", () => window.hideDeviceProperties?.());
    });
  }

  activate() {
    if (this.isCreating) return;
    this.isCreating = true;

    closeSidebar();
    this.cleanup();
    this.lineLock = true;

    const existingToggle = document.getElementById("line-lock-toggle");
    if (existingToggle) existingToggle.remove();

    const toggle = this.createToggle();
    toggle.style.display = "flex";
    this.updateToggleUI();

    this.keyHandler = (e) => {
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        this.toggleLock();
      }
    };
    document.addEventListener("keydown", this.keyHandler);

    registerToolCleanup(() => this.cleanup());

    // Pass true as the last parameter to skip showing the popup
    startTool(this.fabricCanvas, this.type, this.handleMouseDown, this.handleMouseMove, null, true);
  }

  cleanup() {
    this.tempLines.forEach((line) => line && this.fabricCanvas.remove(line));
    this.preview && this.fabricCanvas.remove(this.preview);
    this.startCircle && this.fabricCanvas.remove(this.startCircle);
    this.clearGuideLines();

    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    this.tempLines = [];
    this.preview = null;
    this.startCircle = null;
    this.points = [];
    this.isCreating = false;
    this.lineLock = false;

    const toggle = document.getElementById("line-lock-toggle");
    if (toggle) toggle.style.display = "none";

    this.fabricCanvas.requestRenderAll();
  }
}

export function setupZoneTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "zone");
  setupDeletion(fabricCanvas, "zone");
}

export function setupRoomTool(fabricCanvas) {
  new PolygonDrawer(fabricCanvas, "room");
  setupDeletion(fabricCanvas, "room");
}

function setupDeletion(fabricCanvas, type) {
  const arrayName = type === "zone" ? "zones" : "rooms";
  const className = type === "zone" ? "zone-polygon" : "room-polygon";
  const textClass = type === "zone" ? "zone-text" : "room-text";

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
  if (window[handlerName]) {
    document.removeEventListener("keydown", window[handlerName]);
  }
  window[handlerName] = handler;
  document.addEventListener("keydown", handler);
}
