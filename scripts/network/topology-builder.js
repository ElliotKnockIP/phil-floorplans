import { getPrintInputs, proceedWithPrint } from "../export/canvas-print.js";
import { Connection } from "./connection.js";
import { ConnectionRenderer } from "./connection-renderer.js";
import { computeBounds, pathLength } from "./geometry.js";
import { DEFAULT_STYLES } from "./topology-manager.js";

// In-memory position storage (via project save)
let savedPositions = {};

// Handles the topology map modal view
class TopologyBuilder {
  constructor(mainCanvas, topologyManager) {
    this.mainCanvas = mainCanvas;
    this.topologyManager = topologyManager;
    this.topoCanvas = null;
    this.renderer = null;
    this.modal = null;
    this.nodeMap = new Map();
    this.workingConnections = new Map();
    this.fixedDistances = new Map();
    this.margins = { x: 22, top: 22, bottom: 42 };
    this.baselinePixelsPerMeter = 17.5;
  }

  // Open the topology builder modal

  open(elements) {
    this.elements = elements;
    this.ensureModal();
    this.modal?.show();
    setTimeout(() => this.build(), 200);
  }

  ensureModal() {
    if (!this.modal && typeof bootstrap !== "undefined") {
      this.modal = new bootstrap.Modal(this.elements.modalEl);
    }
  }

  // Build/rebuild topology view

  build() {
    const { wrapper, canvasEl } = this.elements;

    // Dispose existing canvas
    if (this.topoCanvas) {
      try {
        this.topoCanvas.dispose();
      } catch (e) {
        /* ignore */
      }
      this.topoCanvas = null;
    }

    // Create new canvas
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    canvasEl.width = w;
    canvasEl.height = h;
    this.topoCanvas = new fabric.Canvas(canvasEl, { width: w, height: h, backgroundColor: "#ffffff" });
    this.renderer = new ConnectionRenderer(this.topoCanvas, DEFAULT_STYLES);

    // Reset state
    this.nodeMap.clear();
    this.workingConnections.clear();

    // Get devices and connections
    const allDevices = this.mainCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType);
    const connectedIds = new Set();
    let connectionsData = [];

    if (this.topologyManager) {
      connectionsData = this.topologyManager.getConnectionsData();
      connectionsData.forEach((c) => {
        if (c.device1Id) connectedIds.add(c.device1Id);
        if (c.device2Id) connectedIds.add(c.device2Id);
      });
    }

    // Filter to connected devices
    const devices = allDevices.filter((d) => connectedIds.has(this.getDeviceId(d)));

    if (!connectionsData.length || !connectedIds.size) {
      this.topoCanvas.requestRenderAll();
      return;
    }

    // Calculate margins and scaling
    this.calculateMargins();
    const { mapPoint } = this.calculateScaling(devices);

    // Create nodes
    devices.forEach((device) => {
      const id = this.getDeviceId(device);
      const center = this.getDeviceCenter(device);
      const hasSavedPos = !!savedPositions[id];
      let pos = hasSavedPos ? this.clampPosition(savedPositions[id]) : mapPoint(center);

      const node = this.createNode(device, pos);
      this.topoCanvas.add(node);
      if (node.textObject) this.topoCanvas.add(node.textObject);
      this.nodeMap.set(id, node);
    });

    // Calculate fixed distances and create working connections
    this.calculateFixedDistances(connectionsData);
    connectionsData.forEach((c) => {
      const connId = Connection.normalizeId(c.device1Id, c.device2Id);
      this.workingConnections.set(connId, {
        id: connId,
        device1Id: c.device1Id,
        device2Id: c.device2Id,
        properties: c.properties || {},
      });
    });

    // Render connections and setup events
    this.renderConnections();
    this.enforceZOrder();
    this.setupCanvasEvents();

    // Save initial positions so they're captured even if user doesn't move anything
    this.savePositions();

    setTimeout(() => this.topoCanvas.requestRenderAll(), 50);
  }

  // Calculate margins based on device/node sizes
  calculateMargins() {
    const NODE_RADIUS = 18;
    const LABEL_CLEARANCE = 24; // Space for label below node
    this.margins = {
      x: Math.max(20, NODE_RADIUS + 4),
      top: Math.max(20, NODE_RADIUS + 4),
      bottom: Math.max(24, NODE_RADIUS + LABEL_CLEARANCE),
    };
  }

  // Calculate scaling and mapping function
  calculateScaling(devices) {
    const centers = devices.map((d) => this.getDeviceCenter(d));
    const bounds = computeBounds(centers);
    const canvas = this.topoCanvas;

    const PADDING = 0.9;
    const fullW = canvas.getWidth() - this.margins.x * 2;
    const fullH = canvas.getHeight() - (this.margins.top + this.margins.bottom);
    const availW = fullW * PADDING;
    const availH = fullH * PADDING;

    const srcW = Math.max(1, bounds.maxX - bounds.minX);
    const srcH = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(availW / srcW, availH / srcH);

    const offsetX = this.margins.x + (fullW - availW) / 2;
    const offsetY = this.margins.top + (fullH - availH) / 2;

    const mapPoint = (point) => {
      const x = (point.x - bounds.minX) * scale + offsetX;
      const y = (point.y - bounds.minY) * scale + offsetY;
      return this.clampPosition({ x, y });
    };

    this.mapPoint = mapPoint;
    return { mapPoint, scale, bounds };
  }

  // Calculate fixed distances for all connections
  calculateFixedDistances(connectionsData) {
    this.baselinePixelsPerMeter = this.mainCanvas.pixelsPerMeter || 17.5;
    this.fixedDistances.clear();

    connectionsData.forEach((c) => {
      const d1Center = this.getMainDeviceCenter(c.device1Id);
      const d2Center = this.getMainDeviceCenter(c.device2Id);
      const points = [d1Center, ...(c.splitPoints || []).map((p) => ({ x: p.x, y: p.y })), d2Center];
      const dist = (pathLength(points) / this.baselinePixelsPerMeter).toFixed(2);
      this.fixedDistances.set(c.id, dist);
    });
  }

  // Get main canvas device center by ID
  getMainDeviceCenter(deviceId) {
    const device = this.topologyManager?.findDeviceById?.(deviceId) || this.mainCanvas.getObjects().find((obj) => obj.type === "group" && this.getDeviceId(obj) === deviceId);

    if (device) {
      const c = device.getCenterPoint?.() || { x: device.left, y: device.top };
      return { x: c.x, y: c.y };
    }
    return { x: 0, y: 0 };
  }

  // Create a draggable node for a device
  createNode(device, pos) {
    const circle = new fabric.Circle({
      radius: 18,
      fill: "#f8794b",
      originX: "center",
      originY: "center",
    });

    const image = this.getDeviceImage(device);
    const children = image ? [circle, image] : [circle];

    const node = new fabric.Group(children, {
      left: pos.x,
      top: pos.y,
      originX: "center",
      originY: "center",
      hasControls: false,
      selectable: true,
      hoverCursor: "move",
      deviceId: this.getDeviceId(device),
    });

    const label = new fabric.Text(this.getDeviceLabel(device), {
      fontFamily: "Poppins, sans-serif",
      fontSize: 12,
      fill: "#FFFFFF",
      backgroundColor: "rgba(20,18,18,0.8)",
      originX: "center",
      originY: "top",
      left: pos.x,
      top: pos.y + 28,
      selectable: false,
      isDeviceLabel: true,
    });

    node.textObject = label;

    node.on("moving", () => {
      const clamped = this.clampPosition(node.getCenterPoint());
      node.set({ left: clamped.x, top: clamped.y });
      node.setCoords();
      label.set({ left: clamped.x, top: clamped.y + 28 });
      label.setCoords();
      node.bringToFront();
      label.bringToFront();
    });

    node.on("removed", () => {
      if (label) this.topoCanvas?.remove(label);
    });

    return node;
  }

  // Get device image for node representation
  getDeviceImage(device) {
    const targetSize = 24;

    try {
      const objects = device._objects || device.getObjects?.() || [];
      const childImage = objects.find((o) => o.type === "image");

      if (childImage?.getElement) {
        const element = childImage.getElement();
        if (element) {
          const clonedElement = element.cloneNode(true);
          const img = new fabric.Image(clonedElement, { originX: "center", originY: "center" });
          const scaleX = targetSize / (img.width || targetSize);
          const scaleY = targetSize / (img.height || targetSize);
          img.set({ scaleX, scaleY });
          return img;
        }
      }

      if (childImage?.element) {
        const clonedElement = childImage.element.cloneNode(true);
        const img = new fabric.Image(clonedElement, { originX: "center", originY: "center" });
        const scaleX = targetSize / (img.width || targetSize);
        const scaleY = targetSize / (img.height || targetSize);
        img.set({ scaleX, scaleY });
        return img;
      }

      if (device.deviceType?.endsWith(".png")) {
        const src = `./images/devices/${device.deviceType}`;
        const imgElement = document.createElement("img");
        imgElement.crossOrigin = "anonymous";
        const img = new fabric.Image(imgElement, { originX: "center", originY: "center" });

        imgElement.onload = () => {
          const scaleX = targetSize / imgElement.naturalWidth;
          const scaleY = targetSize / imgElement.naturalHeight;
          img.set({ scaleX, scaleY });
          this.topoCanvas?.requestRenderAll();
        };
        imgElement.src = src;
        return img;
      }
    } catch (e) {
      console.warn("Failed to get device image:", e);
    }

    return new fabric.Rect({
      width: targetSize,
      height: targetSize,
      fill: "#fff",
      originX: "center",
      originY: "center",
    });
  }

  // Render all connections
  renderConnections() {
    this.renderer.clearSimplified();

    // Group by device pair
    const groups = new Map();
    this.workingConnections.forEach((wc) => {
      const n1 = this.nodeMap.get(wc.device1Id);
      const n2 = this.nodeMap.get(wc.device2Id);
      if (!n1 || !n2) return;

      const pairKey = Connection.normalizeId(wc.device1Id, wc.device2Id);
      if (!groups.has(pairKey)) groups.set(pairKey, []);
      groups.get(pairKey).push({ ...wc, node1: n1, node2: n2 });
    });

    // Render each group using shared renderer
    groups.forEach((conns) => {
      const first = conns[0];
      const p1 = this.clampPosition(first.node1.getCenterPoint());
      const p2 = this.clampPosition(first.node2.getCenterPoint());
      const props = first.properties || {};

      if (conns.length === 1) {
        this.renderer.renderSimplified({
          id: first.id,
          p1,
          p2,
          distanceText: `${this.fixedDistances.get(first.id) || ""} m`,
          label: props.label || "",
          customLabels: props.customTextLabels || [],
        });
      } else {
        // Multiple parallel connections
        const spacing = 6;
        const totalWidth = (conns.length - 1) * spacing;
        const startOffset = -totalWidth / 2;

        conns.forEach((conn, idx) => {
          const offset = startOffset + idx * spacing;
          this.renderer.renderSimplified({
            id: conn.id,
            p1,
            p2,
            distanceText: idx === 0 ? `${this.fixedDistances.get(conn.id) || ""} m` : "",
            label: idx === 0 ? conn.properties?.label || "" : "",
            customLabels: idx === 0 ? conn.properties?.customTextLabels || [] : [],
            isMultiple: true,
            offset,
          });
        });
      }
    });
  }

  // Enforce Z-ordering of devices and connections
  enforceZOrder() {
    if (!this.topoCanvas) return;
    const objects = this.topoCanvas.getObjects();

    objects.filter((o) => o.isTopoSegment).forEach((o) => this.topoCanvas.sendToBack(o));
    objects.filter((o) => o.type === "group" && o.deviceId).forEach((o) => this.topoCanvas.bringToFront(o));
    objects.filter((o) => o.type === "text" && !o.isDeviceLabel && !o.isTopoSegment).forEach((o) => this.topoCanvas.bringToFront(o));
  }

  // Highlight all connections related to a device
  highlightDevice(deviceGroup) {
    const deviceId = deviceGroup?.deviceId;
    if (!deviceId) {
      this.renderer.clearSimplifiedHighlights();
      return;
    }

    const connectionIds = [];
    this.workingConnections.forEach((wc) => {
      if (wc.device1Id === deviceId || wc.device2Id === deviceId) {
        connectionIds.push(wc.id);
      }
    });

    this.renderer.clearSimplifiedHighlights();
    this.renderer.highlightSimplified(connectionIds, true);
  }

  // Setup canvas event handlers
  setupCanvasEvents() {
    this.topoCanvas.on("object:moving", () => {
      this.renderConnections();
      this.enforceZOrder();
    });

    this.topoCanvas.on("object:modified", () => this.savePositions());

    const onSelection = (e) => {
      const selected = e?.selected?.[0] || this.topoCanvas.getActiveObject();
      if (selected?.deviceId) {
        this.highlightDevice(selected);
      } else {
        this.renderer.clearSimplifiedHighlights();
      }
    };

    this.topoCanvas.on("selection:created", onSelection);
    this.topoCanvas.on("selection:updated", onSelection);
    this.topoCanvas.on("selection:cleared", () => this.renderer.clearSimplifiedHighlights());

    this.topoCanvas.on("mouse:down", (e) => {
      if (!e.target) {
        this.topoCanvas.discardActiveObject();
        this.renderer.clearSimplifiedHighlights();
      }
    });
  }

  // Auto-layout devices based on main canvas positions
  autoLayout() {
    if (!this.topoCanvas) return;

    const allDevices = this.mainCanvas.getObjects().filter((o) => o.type === "group" && o.deviceType);
    const connectedIds = new Set();

    if (this.topologyManager) {
      this.topologyManager.getConnectionsData().forEach((c) => {
        if (c.device1Id) connectedIds.add(c.device1Id);
        if (c.device2Id) connectedIds.add(c.device2Id);
      });
    }

    const devices = allDevices.filter((d) => connectedIds.has(this.getDeviceId(d)));
    const { mapPoint } = this.calculateScaling(devices);

    this.nodeMap.forEach((node, nodeId) => {
      const sourceDevice = devices.find((d) => this.getDeviceId(d) === nodeId);
      if (!sourceDevice) return;

      const pos = mapPoint(this.getDeviceCenter(sourceDevice));
      node.set({ left: pos.x, top: pos.y });
      if (node.textObject) {
        node.textObject.set({ left: pos.x, top: pos.y + 28 });
        node.textObject.setCoords();
      }
      node.setCoords();
    });

    // Clear saved positions so auto-layout is used
    savedPositions = {};
    this.renderConnections();
    this.enforceZOrder();
  }

  // Get device ID with fallback
  getDeviceId(device) {
    if (this.topologyManager?.getDeviceId) return this.topologyManager.getDeviceId(device);
    return device?.id || device?.topologyId || (device.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  }

  // Get device center point
  getDeviceCenter(device) {
    const c = device.getCenterPoint?.() || { x: device.left, y: device.top };
    return { x: c.x, y: c.y };
  }

  // Get device label text
  getDeviceLabel(device) {
    return device?.textObject?.text || device?.initialLabelText || "Device";
  }

  clampPosition(point) {
    const canvas = this.topoCanvas;
    const w = canvas?.getWidth() || 800;
    const h = canvas?.getHeight() || 600;
    return {
      x: Math.max(this.margins.x, Math.min(w - this.margins.x, point.x)),
      y: Math.max(this.margins.top, Math.min(h - this.margins.bottom, point.y)),
    };
  }

  // Save current node positions to in-memory storage
  savePositions() {
    this.nodeMap.forEach((node, id) => {
      const c = node.getCenterPoint();
      savedPositions[id] = { x: c.x, y: c.y };
    });
    return savedPositions;
  }

  getPositions() {
    return { ...savedPositions };
  }

  // Export topology map as PNG
  toPngDataUrl(multiplier = 2) {
    this.topoCanvas.discardActiveObject();
    this.topoCanvas.requestRenderAll();
    return this.topoCanvas.toDataURL({ format: "png", multiplier, quality: 1.0 });
  }
}

// Initialize topology builder and setup UI interactions
export function initTopologyBuilder(mainCanvas, topologyManager) {
  const elements = {
    openBtn: document.getElementById("open-topology-builder-btn"),
    modalEl: document.getElementById("topologyModal"),
    dlBtn: document.getElementById("topology-download"),
    printBtn: document.getElementById("topology-print"),
    addShotBtn: document.getElementById("topology-add-screenshot"),
    autolayoutBtn: document.getElementById("topology-autolayout"),
    wrapper: document.getElementById("topology-canvas-wrapper"),
    canvasEl: document.getElementById("topology-canvas"),
  };

  if (!elements.openBtn || !elements.modalEl || !elements.wrapper || !elements.canvasEl) return;

  const builder = new TopologyBuilder(mainCanvas, topologyManager);

  // Open button
  elements.openBtn.addEventListener("click", () => builder.open(elements));

  // Auto-layout
  elements.autolayoutBtn?.addEventListener("click", () => builder.autoLayout());

  // Download
  elements.dlBtn?.addEventListener("click", () => {
    if (!builder.topoCanvas) return;
    const url = builder.toPngDataUrl(3);
    const a = document.createElement("a");
    a.href = url;
    a.download = "topology-map.png";
    a.click();
  });

  // Add screenshot
  elements.addShotBtn?.addEventListener("click", () => {
    if (!builder.topoCanvas) return;
    const url = builder.toPngDataUrl(3);
    const shot = { dataURL: url, includeInPrint: false, id: Date.now() + Math.random(), title: "Topology Map" };

    try {
      if (window.canvasCrop?.getScreenshots) {
        const shots = window.canvasCrop.getScreenshots();
        shots.push(shot);
        addScreenshotPreview(shot, url);
      } else {
        window.loadedScreenshots = window.loadedScreenshots || [];
        window.loadedScreenshots.push(shot);
        if (window.updateScreenshotStatus) window.updateScreenshotStatus();
      }
    } catch (e) {
      console.warn("Could not add screenshot", e);
    }
  });

  // Print
  elements.printBtn?.addEventListener("click", () => {
    if (!builder.topoCanvas) return;
    const url = builder.toPngDataUrl(3);
    const shot = { dataURL: url, includeInPrint: true, id: Date.now(), title: "Topology Map" };
    const container = document.querySelector(".canvas-container");
    const subSidebar = document.getElementById("sub-sidebar");
    proceedWithPrint(container, subSidebar, mainCanvas, getPrintInputs(), [shot]);
  });

  // Modal events
  elements.modalEl.addEventListener("shown.bs.modal", () => {
    if (builder.topoCanvas) {
      const w = elements.wrapper.clientWidth;
      const h = elements.wrapper.clientHeight;
      builder.topoCanvas.setDimensions({ width: w, height: h });
      builder.topoCanvas.calcOffset();
      builder.topoCanvas.requestRenderAll();
    }
  });

  elements.modalEl.addEventListener("hidden.bs.modal", () => builder.savePositions());

  // Public API (used by network-save.js for project save/load)
  const api = {
    getTopologyPositions: () => builder.getPositions(),
    setTopologyPositions: (pos) => {
      savedPositions = pos || {};
    },
    rebuild: () => builder.build(),
    clearTopologyPositions: () => {
      savedPositions = {};
    },
  };

  window.topologyBuilderAPI = api;
  return api;
}

// Helper to add screenshot preview item
function addScreenshotPreview(shot, url) {
  const previews = document.getElementById("screenshot-previews");
  if (!previews) {
    if (window.updateScreenshotStatus) window.updateScreenshotStatus();
    return;
  }

  const item = document.createElement("div");
  item.className = "screenshot-preview-item";
  item.innerHTML = `
    <img class="screenshot-image" src="${url}" alt="Topology Screenshot" />
    <div class="screenshot-controls">
      <label class="screenshot-checkbox-label">
        <input type="checkbox" class="screenshot-checkbox" />
        <span>Include in print</span>
      </label>
      <textarea class="screenshot-title" placeholder="Title or Description" maxlength="74">Topology Map</textarea>
      <button class="screenshot-delete-btn">Delete</button>
    </div>`;

  const checkbox = item.querySelector(".screenshot-checkbox");
  checkbox?.addEventListener("change", () => (shot.includeInPrint = checkbox.checked));

  const deleteBtn = item.querySelector(".screenshot-delete-btn");
  deleteBtn?.addEventListener("click", () => {
    const shots = window.canvasCrop?.getScreenshots() || [];
    const idx = shots.indexOf(shot);
    if (idx > -1) shots.splice(idx, 1);
    item.remove();
    if (window.updateScreenshotStatus) window.updateScreenshotStatus();
  });

  previews.appendChild(item);
  if (window.updateScreenshotStatus) window.updateScreenshotStatus();
}
