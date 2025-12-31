import { Connection } from "./connections/Connection.js";
import { ConnectionRenderer } from "./connections/ConnectionRenderer.js";
import { findInsertIndex, ratioOnPath, positionOnPath } from "./network-utils.js";
import { serializeConnections, deserializeConnections } from "../save/network-save.js";
import { CATEGORY_LABELS, getDeviceCategory, isPanelDevice, areCategoriesCompatible } from "../devices/categories/device-types.js";

// Re-export for external consumers
export { CATEGORY_LABELS };

// Default visual styles for connections and split points
export const DEFAULT_STYLES = {
  line: { stroke: "#2196F3", strokeWidth: 3 },
  lineHighlight: { stroke: "#FF6B35", strokeWidth: 4 },
  split: { radius: 8, fill: "#FF6B35", stroke: "#fff", strokeWidth: 2 },
  splitHighlight: { radius: 10, fill: "#FFD700" },
};

// Manages network connections between devices on the canvas.
export class NetworkManager {
  // Initialize network manager with canvas and renderer
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.connections = new Map();
    this.renderer = new ConnectionRenderer(fabricCanvas, DEFAULT_STYLES);
    this.styles = DEFAULT_STYLES;

    // State flags
    this.trackedDevices = new WeakSet();
    this.deviceIndex = new Map();
    this.bulkRemovingConnectionIds = new Set();
    this.suppressAllRemovalHandling = false;
    this.recentConnectionKeys = new Set();
    this.activeHighlight = null;
    this.panelChannels = new Map();

    this.init();
  }

  // Start the manager and index existing devices
  init() {
    this.setupCanvasEvents();
    this.indexExistingDevices();
  }

  // Set up all canvas event listeners for network interactions
  setupCanvasEvents() {
    const canvas = this.fabricCanvas;

    // Click handling
    canvas.on("mouse:down", (e) => {
      if (!e?.target) {
        this.activeHighlight = null;
        this.renderer.clearHighlights(this.connections);
        return;
      }
      // Double-click on segment adds split point
      if (e.target.isConnectionSegment && e.e?.detail === 2) {
        this.addSplitPoint(e.target, canvas.getPointer(e.e));
        this.activeHighlight = { type: "connection", id: e.target.connectionId };
        this.highlightConnection(e.target.connectionId);
      }
    });

    // Device movement
    canvas.on("object:moving", (e) => {
      if (this.isDevice(e?.target)) {
        this.updateDeviceConnections(e.target);
        this.renderer.showAllSplitPoints();
      }
    });

    ["object:modified", "object:scaling", "object:rotating"].forEach((event) => {
      canvas.on(event, (e) => {
        if (this.isDevice(e?.target)) {
          this.updateDeviceConnections(e.target);
        }
      });
    });

    // Selection handling
    const onSelect = (e) => {
      const obj = e?.selected?.[0] || canvas.getActiveObject();
      if (!obj) return;

      if (this.isDevice(obj)) {
        this.activeHighlight = { type: "device", id: this.getDeviceId(obj) };
        this.highlightDeviceConnections(obj);
      } else if (obj.isConnectionSegment || obj.isNetworkSplitPoint) {
        this.activeHighlight = { type: "connection", id: obj.connectionId };
        this.highlightConnection(obj.connectionId);
      } else {
        this.activeHighlight = null;
        this.renderer.clearHighlights(this.connections);
      }
    };

    canvas.on("selection:created", onSelect);
    canvas.on("selection:updated", onSelect);
    canvas.on("selection:cleared", () => {
      this.activeHighlight = null;
      this.renderer.clearHighlights(this.connections);
    });

    // Deletion handling
    canvas.on("object:removed", (e) => this.handleRemoval(e?.target));

    // New device tracking
    canvas.on("object:added", (e) => {
      if (this.isDevice(e?.target)) {
        this.indexDevice(e.target);
        this.rebindDeviceConnections(e.target);
      }
    });
  }

  // Index all devices currently on the canvas
  indexExistingDevices() {
    this.fabricCanvas.getObjects().forEach((obj) => {
      if (this.isDevice(obj)) this.indexDevice(obj);
    });
  }

  // Check if an object is a device
  isDevice(obj) {
    return obj?.type === "group" && obj?.deviceType;
  }

  // Get or generate a unique ID for a device
  getDeviceId(device) {
    if (!device) return undefined;
    if (device.id) return device.id;
    if (device.topologyId) return device.topologyId;
    const newId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    device.id = newId;
    device.topologyId = newId;
    return newId;
  }

  // Get the center coordinates of a device
  getDeviceCenter(device) {
    const c = device.getCenterPoint?.() || { x: device.left, y: device.top };
    return { x: c.x, y: c.y };
  }

  // Create a normalized ID for a connection between two devices
  makeNormalizedConnectionId(device1, device2) {
    return Connection.normalizeId(this.getDeviceId(device1), this.getDeviceId(device2));
  }

  // Find a device object on the canvas by its ID
  findDeviceById(deviceId) {
    return this.fabricCanvas.getObjects().find((obj) => this.isDevice(obj) && this.getDeviceId(obj) === deviceId);
  }

  // Add a device to the internal index
  indexDevice(device) {
    const id = this.getDeviceId(device);
    if (id) this.deviceIndex.set(id, device);
  }

  // Set up movement tracking for a device to update its connections
  attachTrackingForDevice(device) {
    if (!device || this.trackedDevices.has(device)) return;

    const handler = () => {
      this.updateDeviceConnections(device);
      this.activeHighlight = { type: "device", id: this.getDeviceId(device) };
      this.highlightDeviceConnections(device);
    };

    device.topologyMoveHandler = handler;
    device.on("moving", handler);
    device.on("removed", () => {
      try {
        device.off("moving", handler);
      } catch (e) {
        /* ignore */
      }
      this.trackedDevices.delete(device);
    });

    this.trackedDevices.add(device);
  }

  // Delegate to shared device-types module
  getDeviceCategory(device) {
    return getDeviceCategory(device);
  }

  // Delegate to shared device-types module
  isPanelDevice(device) {
    return isPanelDevice(device);
  }

  // Create a new connection between two devices
  createConnection(device1, device2, type = "network", options = {}) {
    const id1 = this.getDeviceId(device1);
    const id2 = this.getDeviceId(device2);

    // Validate categories
    if (!options.skipValidation) {
      const cat1 = this.getDeviceCategory(device1);
      const cat2 = this.getDeviceCategory(device2);
      if (!this.areCategoriesCompatible(cat1, cat2)) {
        this.emitConnectionBlocked(cat1, cat2);
        return null;
      }
    }

    const connId = Connection.normalizeId(id1, id2);
    const pairKey = id1 < id2 ? `${id1}__${id2}` : `${id2}__${id1}`;

    // Check duplicates
    if (this.connections.has(connId)) return null;
    if (this.recentConnectionKeys.has(pairKey)) return null;

    this.recentConnectionKeys.add(pairKey);
    setTimeout(() => this.recentConnectionKeys.delete(pairKey), 600);

    // Create connection
    const conn = new Connection(device1, device2, type);
    this.connections.set(connId, conn);

    // Assign channel if panel
    this.assignChannel(conn);

    // Track and render
    this.indexDevice(device1);
    this.indexDevice(device2);
    this.renderConnection(conn);

    document.dispatchEvent(new CustomEvent("topology:connection-created", { detail: { connection: conn } }));
    return conn;
  }

  // Remove a connection by ID
  removeConnection(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    this.bulkRemovingConnectionIds.add(connectionId);
    this.renderer.clear(connectionId);
    this.bulkRemovingConnectionIds.delete(connectionId);

    // Clean up channel
    if (conn.properties.panelDeviceId) {
      const channels = this.panelChannels.get(conn.properties.panelDeviceId);
      if (channels) {
        const idx = channels.indexOf(connectionId);
        if (idx > -1) channels.splice(idx, 1);
      }
    }

    this.connections.delete(connectionId);
    this.fabricCanvas.requestRenderAll();
  }

  // Remove all connections associated with a specific device
  removeConnectionsForDevice(device) {
    const deviceId = this.getDeviceId(device);
    const toRemove = [];
    this.connections.forEach((conn, id) => {
      if (conn.involvesDevice(deviceId)) toRemove.push(id);
    });
    toRemove.forEach((id) => this.removeConnection(id));
  }

  // Clear all network connections and related UI elements from the canvas
  clearAllConnections() {
    this.suppressAllRemovalHandling = true;
    const toRemove = this.fabricCanvas.getObjects().filter((obj) => obj.isConnectionSegment || obj.isNetworkSplitPoint || obj.isSegmentDistanceLabel || obj.isConnectionCustomLabel || obj.isChannelLabel);
    toRemove.forEach((obj) => this.fabricCanvas.remove(obj));
    this.suppressAllRemovalHandling = false;

    this.connections.clear();
    this.panelChannels.clear();
    this.recentConnectionKeys.clear();
    this.fabricCanvas.requestRenderAll();
  }

  // Render a connection on the canvas using the renderer
  renderConnection(conn) {
    this.renderer.render(conn, {
      getDeviceCenter: (d) => this.getDeviceCenter(d),
      pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
      showSplitPoints: this.shouldShowSplitPoints(conn.id),
      onNodeMove: (c) => this.renderConnection(c),
    });
    this.bringDevicesToFront();
  }

  // Update all connections for a device when it moves or changes
  updateDeviceConnections(device) {
    const deviceId = this.getDeviceId(device);
    this.connections.forEach((conn) => {
      if (conn.involvesDevice(deviceId)) {
        conn.rebindDevice(deviceId, device);
        this.renderConnection(conn);
      }
    });
  }

  // Alias for updateDeviceConnections (used by object:added handler)
  rebindDeviceConnections(device) {
    this.updateDeviceConnections(device);
  }

  // Add a split point to a connection at the specified pointer location
  addSplitPoint(segment, pointer) {
    const conn = this.connections.get(segment.connectionId);
    if (!conn) return;

    const insertIdx =
      typeof segment.segmentIndex === "number"
        ? segment.segmentIndex
        : findInsertIndex(
            conn.getPath((d) => this.getDeviceCenter(d)),
            pointer
          );

    conn.addNode(pointer.x, pointer.y, insertIdx);
    this.renderConnection(conn);
  }

  // Remove a split point from a connection
  removeSplitPoint(splitObj) {
    if (!splitObj?.connectionId) return;
    const conn = this.connections.get(splitObj.connectionId);
    if (!conn) return;

    const idx = typeof splitObj.nodeIndex === "number" ? splitObj.nodeIndex : conn.findClosestNodeIndex({ x: splitObj.left, y: splitObj.top });

    if (idx > -1) {
      conn.removeNode(idx);
      this.renderConnection(conn);
    }
  }

  // Determine if split points should be shown for a specific connection
  shouldShowSplitPoints(connectionId) {
    if (!this.activeHighlight) return false;
    if (this.activeHighlight.type === "all") return true;
    if (this.activeHighlight.type === "connection") return this.activeHighlight.id === connectionId;
    if (this.activeHighlight.type === "device") {
      const conn = this.connections.get(connectionId);
      return conn?.involvesDevice(this.activeHighlight.id);
    }
    return false;
  }

  // Highlight a specific connection on the canvas
  highlightConnection(connectionId) {
    this.renderer.clearHighlights(this.connections);
    this.renderer.highlightConnection(connectionId);
  }

  // Highlight all connections associated with a specific device
  highlightDeviceConnections(device) {
    this.renderer.clearHighlights(this.connections);
    const deviceId = this.getDeviceId(device);

    this.connections.forEach((conn) => {
      if (conn.involvesDevice(deviceId)) {
        this.renderer.highlightConnection(conn.id);
      }
    });
  }

  // Ensure devices and split points are always rendered on top of connection lines
  bringDevicesToFront() {
    this.fabricCanvas
      .getObjects()
      .filter((obj) => this.isDevice(obj))
      .forEach((dev) => {
        this.fabricCanvas.bringToFront(dev);
        if (dev.textObject && !dev.textObject.isHidden) {
          this.fabricCanvas.bringToFront(dev.textObject);
        }
      });
    this.fabricCanvas
      .getObjects()
      .filter((obj) => obj.isNetworkSplitPoint)
      .forEach((sp) => this.fabricCanvas.bringToFront(sp));
  }

  // Assign channel numbers for connections involving panel devices
  assignChannel(conn) {
    const dev1Panel = this.isPanelDevice(conn.device1);
    const dev2Panel = this.isPanelDevice(conn.device2);

    if (!dev1Panel && !dev2Panel) {
      conn.properties.channel = null;
      conn.properties.panelDeviceId = null;
      return;
    }

    const panelDevice = dev1Panel ? conn.device1 : conn.device2;
    const panelId = this.getDeviceId(panelDevice);

    if (!this.panelChannels.has(panelId)) {
      this.panelChannels.set(panelId, []);
    }
    const channels = this.panelChannels.get(panelId);

    conn.properties.channel = channels.length + 1;
    conn.properties.panelDeviceId = panelId;
    channels.push(conn.id);

    // Rebuild topology if it's currently open
    if (window.topologyBuilderAPI?.rebuild) {
      window.topologyBuilderAPI.rebuild();
    }
  }

  // Get channel and panel information for a specific device
  getDeviceChannelInfo(device) {
    const deviceId = this.getDeviceId(device);
    for (const conn of this.connections.values()) {
      if (conn.involvesDevice(deviceId) && conn.properties.channel) {
        const panelDevice = conn.properties.panelDeviceId === conn.device1Id ? conn.device1 : conn.device2;
        return {
          channel: conn.properties.channel,
          panelDeviceId: conn.properties.panelDeviceId,
          panelLabel: panelDevice?.textObject?.text || "Panel",
        };
      }
    }
    return null;
  }

  // Get a list of all channel numbers assigned to a device
  getAllDeviceChannels(device) {
    const deviceId = this.getDeviceId(device);
    const channels = [];
    for (const conn of this.connections.values()) {
      if (conn.involvesDevice(deviceId) && conn.properties.channel) {
        channels.push(conn.properties.channel);
      }
    }
    return channels.sort((a, b) => a - b);
  }

  // Get all connections and their channel info for a panel device
  getPanelConnections(panelDevice) {
    const panelId = this.getDeviceId(panelDevice);
    const result = [];

    this.connections.forEach((conn) => {
      if (conn.properties.panelDeviceId === panelId) {
        const otherDevice = conn.device1Id === panelId ? conn.device2 : conn.device1;
        result.push({
          channel: conn.properties.channel,
          deviceLabel: otherDevice?.textObject?.text || "Device",
          deviceId: conn.device1Id === panelId ? conn.device2Id : conn.device1Id,
        });
      }
    });

    return result.sort((a, b) => a.channel - b.channel);
  }

  // Delegate to shared device-types module
  areCategoriesCompatible(catA, catB) {
    return areCategoriesCompatible(catA, catB);
  }

  // Dispatch an event when a connection is blocked due to incompatible categories
  emitConnectionBlocked(catA, catB) {
    const labelA = CATEGORY_LABELS[catA] || "Device";
    const labelB = CATEGORY_LABELS[catB] || "Device";
    document.dispatchEvent(
      new CustomEvent("topology:connection-blocked", {
        detail: {
          categoryA: catA,
          categoryB: catB,
          message: `Cannot connect ${labelA} to ${labelB}. Use same category or bridge via Custom/Network.`,
        },
      })
    );
  }

  // Handle removal of objects from the canvas
  handleRemoval(target) {
    if (!target || this.renderer.updatingSegments || this.suppressAllRemovalHandling) return;
    if (target.connectionId && this.bulkRemovingConnectionIds.has(target.connectionId)) return;

    if (target.isConnectionSegment) {
      this.removeConnection(target.connectionId);
    } else if (target.isNetworkSplitPoint) {
      this.removeSplitPoint(target);
    } else if (target.isConnectionCustomLabel && target.customTextId) {
      const conn = this.connections.get(target.connectionId);
      if (conn?.properties.customTextLabels) {
        conn.properties.customTextLabels = conn.properties.customTextLabels.filter((l) => l.id !== target.customTextId);
      }
    } else if (this.isDevice(target)) {
      this.removeConnectionsForDevice(target);
    }
  }

  // Edit the label of a connection
  editConnectionLabel(conn) {
    const current = conn.properties.label || "";
    const newLabel = prompt("Enter connection label:", current);
    if (newLabel !== null) {
      conn.properties.label = newLabel;
      this.renderConnection(conn);
    }
  }

  // Update all connection labels when the canvas scale changes
  updateLabelsForScaleChange(newPixelsPerMeter) {
    if (!newPixelsPerMeter || newPixelsPerMeter <= 0) return;
    this.connections.forEach((conn) => this.renderConnection(conn));
  }

  // Aliases for external API compatibility
  removeConnectionById = (id) => this.removeConnection(id);
  splitConnection = (segment, pointer) => this.addSplitPoint(segment, pointer);
  updateConnectionLabelsForScaleChange = (ppm) => this.updateLabelsForScaleChange(ppm);

  // Calculate the ratio (0-1) of a point along a connection path
  calculatePositionRatioOnPath(connection, point) {
    const path = connection.getPath((d) => this.getDeviceCenter(d));
    return ratioOnPath(path, point);
  }

  // Get the coordinates of a point at a specific ratio (0-1) along a connection path
  getPositionFromPathRatio(connection, ratio) {
    const path = connection.getPath((d) => this.getDeviceCenter(d));
    return positionOnPath(path, ratio);
  }

  // Serialize all connections to data
  getConnectionsData() {
    return serializeConnections(this.connections, (d) => this.getDeviceId(d));
  }

  // Load connections from serialized data
  loadConnectionsData(data) {
    return deserializeConnections(
      data,
      (id) => this.findDeviceById(id),
      (d1, d2, type, opts) => this.createConnection(d1, d2, type, opts)
    );
  }

  // Remove old connection lines that are no longer used
  removeLegacyConnectionLines() {
    const legacy = this.fabricCanvas.getObjects().filter((obj) => obj.isConnectionLine && !obj.isConnectionSegment);
    legacy.forEach((obj) => this.fabricCanvas.remove(obj));
  }
}
