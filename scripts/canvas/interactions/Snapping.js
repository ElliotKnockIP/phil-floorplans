// Handles snapping objects to background edges and original positions
export class CanvasSnapping {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;

    // Configuration
    this.snapThreshold = 10;
    this.snapLines = [];
    this.isSnappingFlag = false;
    this.ZONE_SNAP_THRESHOLD = 25;
    this.ROOM_SNAP_THRESHOLD = 25;
    this.SAFETY_SNAP_THRESHOLD = 25;

    this.SNAP_TYPES = {
      corner: ["topLeft", "topRight", "bottomLeft", "bottomRight"],
      centerPoint: ["centerTop", "centerBottom", "centerLeft", "centerRight"],
      edge: ["left", "right", "centerV", "top", "bottom", "centerH"],
    };

    this.setupEventHandlers();
    this.initializeSnapToggle();
  }

  // Check if device snapping is enabled in UI
  isDeviceSnappingEnabled() {
    const snapToggle = document.getElementById("snap-device-toggle");
    return !snapToggle || !snapToggle.checked;
  }

  // Check if canvas has a background image to snap to
  hasBackgroundImage() {
    const bg = this.fabricCanvas.getObjects().find((obj) => obj.isBackground === true);
    return bg && bg.width && bg.height;
  }

  // Identify if object is a device
  isDeviceObject(obj) {
    return obj?.type === "group" && obj.deviceType && obj.deviceType !== "title-block";
  }

  // Identify if object is a zone
  isZone(obj) {
    return obj?.type === "polygon" && obj.class === "zone-polygon";
  }

  // Identify if object is a room
  isRoom(obj) {
    return obj?.type === "polygon" && obj.class === "room-polygon";
  }

  // Identify if object is a risk
  isRisk(obj) {
    return obj?.type === "polygon" && obj.class === "risk-polygon";
  }

  // Identify if object is a safety zone
  isSafety(obj) {
    return obj?.type === "polygon" && obj.class === "safety-polygon";
  }

  // Check if object is eligible for snapping
  isSnappableObject(obj) {
    return this.isDeviceObject(obj) || this.isZone(obj) || this.isRoom(obj) || this.isRisk(obj) || this.isSafety(obj);
  }

  // Calculate distance between two points
  calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  // Get coordinates for background snap points
  getSnapPoints() {
    const bg = this.fabricCanvas.getObjects().find((obj) => obj.isBackground === true);
    if (!bg?.width || !bg?.height) return null;

    const left = bg.left;
    const top = bg.top;
    const width = bg.getScaledWidth();
    const height = bg.getScaledHeight();
    const right = left + width;
    const bottom = top + height;
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    return {
      topLeft: { x: left, y: top },
      topRight: { x: right, y: top },
      bottomLeft: { x: left, y: bottom },
      bottomRight: { x: right, y: bottom },
      center: { x: centerX, y: centerY },
      centerTop: { x: centerX, y: top },
      centerBottom: { x: centerX, y: bottom },
      centerLeft: { x: left, y: centerY },
      centerRight: { x: right, y: centerY },
      edges: { top, bottom, left, right, centerH: centerY, centerV: centerX },
      bounds: { left, top, right, bottom },
    };
  }

  // Create a visual snap line
  createSnapLine(x1, y1, x2, y2) {
    return new fabric.Line([x1, y1, x2, y2], {
      stroke: "#FF6B35",
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      isSnapLine: true,
      opacity: 0.8,
    });
  }

  // Remove all snap lines from canvas
  clearSnapLines() {
    this.snapLines.forEach((line) => this.fabricCanvas.remove(line));
    this.snapLines = [];
    this.fabricCanvas.renderAll();
  }

  // Add a snap line to canvas
  addSnapLine(line) {
    this.snapLines.push(line);
    this.fabricCanvas.add(line);
  }

  // Show visual guides for snapping
  showSnapLines(snapPoint, type, bounds) {
    this.clearSnapLines();
    const { left, right, top, bottom } = bounds;

    const lineConfigs = {
      corner: [
        [left, snapPoint.y, right, snapPoint.y],
        [snapPoint.x, top, snapPoint.x, bottom],
      ],
      center: [
        [left, snapPoint.y, right, snapPoint.y],
        [snapPoint.x, top, snapPoint.x, bottom],
      ],
      centerH: [[left, snapPoint.y, right, snapPoint.y]],
      centerV: [[snapPoint.x, top, snapPoint.x, bottom]],
      edge: [snapPoint.isVertical ? [snapPoint.x, top, snapPoint.x, bottom] : [left, snapPoint.y, right, snapPoint.y]],
    };

    lineConfigs[type]?.forEach((coords) => this.addSnapLine(this.createSnapLine(...coords)));

    this.snapLines.forEach((line) => line.moveTo(this.fabricCanvas.getObjects().length - 2));
    this.fabricCanvas.renderAll();
  }

  // Check if object center snaps to specific points
  checkSnapPoints(obj, objCenter, snapData, pointType, threshold = this.snapThreshold) {
    const points = this.SNAP_TYPES[pointType];
    if (!points) return null;

    for (const pointName of points) {
      const point = snapData[pointName];
      if (!point) continue;

      const distance = this.calculateDistance(objCenter, point);
      if (distance <= threshold) {
        obj.set({ left: point.x, top: point.y });
        obj.setCoords();

        let displayType = pointType;
        if (pointType === "centerPoint") {
          const isVertical = pointName.includes("Top") || pointName.includes("Bottom");
          displayType = isVertical ? "centerV" : "centerH";
        }

        this.showSnapLines(point, displayType, snapData.bounds);
        return { snapped: true, point, type: displayType };
      }
    }
    return null;
  }

  // Check if object aligns with background edges
  checkEdgeAlignment(obj, objCenter, edges, bounds) {
    const edgeChecks = [
      { edge: "left", isVertical: true },
      { edge: "right", isVertical: true },
      { edge: "centerV", isVertical: true },
      { edge: "top", isVertical: false },
      { edge: "bottom", isVertical: false },
      { edge: "centerH", isVertical: false },
    ];

    for (const { edge, isVertical } of edgeChecks) {
      const edgeValue = edges[edge];
      const objValue = isVertical ? objCenter.x : objCenter.y;

      if (Math.abs(objValue - edgeValue) <= this.snapThreshold) {
        const newPos = isVertical ? { left: edgeValue } : { top: edgeValue };
        obj.set(newPos);
        obj.setCoords();

        const snapPoint = isVertical ? { x: edgeValue, y: objCenter.y, isVertical: true } : { x: objCenter.x, y: edgeValue, isVertical: false };

        this.showSnapLines(snapPoint, "edge", bounds);
        return { snapped: true, point: snapPoint, type: "edge" };
      }
    }
    return null;
  }

  // Run all snapping checks for an object
  checkSnapping(obj) {
    if (!this.hasBackgroundImage()) return { snapped: false };

    const objCenter = obj.getCenterPoint();
    const snapData = this.getSnapPoints();
    if (!snapData) return { snapped: false };

    const snapChecks = [
      () => this.checkSnapPoints(obj, objCenter, snapData, "corner"),
      () => {
        const centerDistance = this.calculateDistance(objCenter, snapData.center);
        if (centerDistance <= this.snapThreshold) {
          obj.set({ left: snapData.center.x, top: snapData.center.y });
          obj.setCoords();
          this.showSnapLines(snapData.center, "center", snapData.bounds);
          return { snapped: true, point: snapData.center, type: "center" };
        }
        return null;
      },
      () => this.checkSnapPoints(obj, objCenter, snapData, "centerPoint"),
      () => this.checkEdgeAlignment(obj, objCenter, snapData.edges, snapData.bounds),
    ];

    for (const check of snapChecks) {
      const result = check();
      if (result?.snapped) return result;
    }

    return { snapped: false };
  }

  // Check if point is within threshold of original center
  isNearOriginal(currentCenter, originalCenter, threshold) {
    return this.calculateDistance(currentCenter, originalCenter) <= threshold;
  }

  // Snap polygon back to its original center point
  snapToOriginalCenter(obj, threshold, collectionName) {
    if (!obj.originalCenter) return false;

    const currentCenter = obj.getCenterPoint();
    if (!this.isNearOriginal(currentCenter, obj.originalCenter, threshold)) return false;

    const deltaX = obj.originalCenter.x - currentCenter.x;
    const deltaY = obj.originalCenter.y - currentCenter.y;

    obj.set({ left: obj.left + deltaX, top: obj.top + deltaY });

    const collection = window[collectionName];
    if (collection && Array.isArray(collection)) {
      const entry = collection.find((c) => c.polygon === obj);
      if (entry?.text && this.fabricCanvas.getObjects().includes(entry.text)) {
        const newCenter = obj.getCenterPoint();
        entry.text.set({
          left: newCenter.x + (entry.text.offsetX || 0),
          top: newCenter.y + (entry.text.offsetY || 0),
        });
        entry.text.setCoords();
      }
    }

    obj.setCoords();
    return true;
  }

  // Setup canvas event listeners for snapping
  setupEventHandlers() {
    this.fabricCanvas.on("object:moving", (e) => {
      const obj = e.target;
      if (!obj) return;

      if (window.isLoadingProject || window.isLoadingFloor) {
        this.clearSnapLines();
        return;
      }

      // Devices -> background snapping (if enabled)
      if (this.isDeviceObject(obj) && this.isDeviceSnappingEnabled() && this.hasBackgroundImage()) {
        const result = this.checkSnapping(obj);
        this.isSnappingFlag = result.snapped;
      }

      // Zones
      if (this.isZone(obj)) {
        const snapped = this.snapToOriginalCenter(obj, this.ZONE_SNAP_THRESHOLD, "zones");
        this.isSnappingFlag = this.isSnappingFlag || snapped;
      }

      // Rooms
      if (this.isRoom(obj)) {
        const snapped = this.snapToOriginalCenter(obj, this.ROOM_SNAP_THRESHOLD, "rooms");
        this.isSnappingFlag = this.isSnappingFlag || snapped;
      }

      // Risks
      if (this.isRisk(obj)) {
        const snapped = this.snapToOriginalCenter(obj, this.ROOM_SNAP_THRESHOLD, "risks");
        this.isSnappingFlag = this.isSnappingFlag || snapped;
      }

      // Safety Zones
      if (this.isSafety(obj)) {
        const snapped = this.snapToOriginalCenter(obj, this.SAFETY_SNAP_THRESHOLD, "safetyZones");
        this.isSnappingFlag = this.isSnappingFlag || snapped;
      }

      // Clear lines if object not snappable
      if (!this.isSnappableObject(obj) && this.snapLines.length > 0) {
        this.clearSnapLines();
        this.isSnappingFlag = false;
      }
    });

    this.fabricCanvas.on("object:moved", () => {
      setTimeout(() => {
        this.clearSnapLines();
        this.isSnappingFlag = false;
      }, 100);
    });

    this.fabricCanvas.on("selection:cleared", () => {
      this.clearSnapLines();
      this.isSnappingFlag = false;
    });

    this.fabricCanvas.on("canvas:cleared", () => {
      this.snapLines = [];
      this.isSnappingFlag = false;
    });
  }

  // Initialize UI toggle for snapping
  initializeSnapToggle() {
    const snapToggle = document.getElementById("snap-device-toggle");
    if (!snapToggle) return;

    snapToggle.addEventListener("change", () => {
      if (!this.isDeviceSnappingEnabled()) {
        this.clearSnapLines();
        this.isSnappingFlag = false;
      }
    });
  }

  // Set global snap threshold
  setSnapThreshold(threshold) {
    this.snapThreshold = threshold;
  }

  // Get global snap threshold
  getSnapThreshold() {
    return this.snapThreshold;
  }

  // Set zone-specific snap threshold
  setZoneSnapThreshold(threshold) {
    this.ZONE_SNAP_THRESHOLD = Math.max(10, Math.min(100, threshold));
  }

  // Set room-specific snap threshold
  setRoomSnapThreshold(threshold) {
    this.ROOM_SNAP_THRESHOLD = Math.max(10, Math.min(100, threshold));
  }

  // Set safety zone-specific snap threshold
  setSafetySnapThreshold(threshold) {
    this.SAFETY_SNAP_THRESHOLD = Math.max(10, Math.min(100, threshold));
  }

  // Check if snapping is currently active
  isSnapping() {
    return this.isSnappingFlag;
  }
}

// Initialize snapping system and return public API
export function initCanvasSnapping(fabricCanvas) {
  const instance = new CanvasSnapping(fabricCanvas);
  return {
    setSnapThreshold: (v) => instance.setSnapThreshold(v),
    getSnapThreshold: () => instance.getSnapThreshold(),
    setZoneSnapThreshold: (v) => instance.setZoneSnapThreshold(v),
    setRoomSnapThreshold: (v) => instance.setRoomSnapThreshold(v),
    setSafetySnapThreshold: (v) => instance.setSafetySnapThreshold(v),
    isDeviceSnappingEnabled: () => instance.isDeviceSnappingEnabled(),
    clearSnapLines: () => instance.clearSnapLines(),
    isSnapping: () => instance.isSnapping(),
    hasBackgroundImage: () => instance.hasBackgroundImage(),
  };
}
