export class TopologyManager {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    // Map<connectionId, { id, device1, device2, type, nodes: Array<{x,y}>, properties }>
    this.connections = new Map();
    this.updatingSegments = false; // Guard against recursion on canvas mutations
    this.trackedDevices = new WeakSet(); // Devices with attached move listeners
  this.deviceIndex = new Map(); // Map<deviceId, deviceObj>
  this._bulkRemovingConnectionIds = new Set(); // Guard for whole-connection removals
  this._suppressAllRemovalHandling = false; // Guard for bulk clear
  this._recentConnectionKeys = new Set(); // Short-lived keys to prevent accidental duplicates
  this.activeHighlight = null; // { type: 'device'|'connection', id: string }

    // Styling in one place
    this.styles = {
      line: { stroke: '#2196F3', strokeWidth: 3 },
      lineHighlight: { stroke: '#FF6B35', strokeWidth: 4 },
      split: { radius: 8, fill: '#FF6B35', stroke: '#fff', strokeWidth: 2 },
      splitHighlight: { radius: 10, fill: '#FFD700' }
    };

    this.initializeTopologySystem();
  }

  initializeTopologySystem() {
    // Listen for device movements to update connections
    this.setupDeviceConnectionTracking();
    this.setupDeletionHandling();

    // Enable quick splitting: double-click a segment to insert a node at the click
    this.fabricCanvas.on('mouse:down', (e) => {
      // If clicked on empty canvas, clear highlights and hide split handles
      if (!e || !e.target) {
        this.activeHighlight = null;
        this.clearConnectionHighlights();
        return;
      }
      if (!e.e) return;
      // use double click via pointer detail when available
      if (e.target.isConnectionSegment && e.e.detail === 2) {
        const pointer = this.fabricCanvas.getPointer(e.e);
        this.addSplitPointAtSegment(e.target, pointer);
        // Keep the connection active so the new split remains visible
        if (e.target.connectionId) {
          this.activeHighlight = { type: 'connection', id: e.target.connectionId };
          this.highlightConnectionById(e.target.connectionId);
        }
      }
    });

    // Track device additions to rebind connections after save/load or other reinsertions
    this.fabricCanvas.on('object:added', (e) => {
      const obj = e.target;
      if (obj && obj.type === 'group' && obj.deviceType) {
        this.indexDevice(obj);
        this.rebindConnectionsForDevice(obj);
      }
    });

    // Index existing devices on startup
    try {
      this.fabricCanvas.getObjects().forEach((obj) => {
        if (obj.type === 'group' && obj.deviceType) this.indexDevice(obj);
      });
    } catch (_) {}
  }

  setupDeviceConnectionTracking() {
    // Listen for device movements to update connection lines
    this.fabricCanvas.on('object:moving', (e) => {
      if (e.target && e.target.type === 'group' && e.target.deviceType) {
        this.updateConnectionsForDevice(e.target);
        // While dragging a device, show ALL split handles and optionally highlight this device's connections
        this.activeHighlight = { type: 'all' };
        this.showAllSplitPoints(e.target);
      }
    });

    // Also listen for other transforms that can change the device center
    const updateOnEvent = (e) => {
      if (e && e.target && e.target.type === 'group' && e.target.deviceType) {
        this.updateConnectionsForDevice(e.target);
        // During transforms like scaling/rotating, also reveal all split points for convenience
        this.activeHighlight = { type: 'all' };
        this.showAllSplitPoints(e.target);
      }
    };
    this.fabricCanvas.on('object:modified', updateOnEvent);
    this.fabricCanvas.on('object:scaling', updateOnEvent);
    this.fabricCanvas.on('object:rotating', updateOnEvent);

    // Listen for device selection changes
    const onSelection = (e) => {
      const obj = e && e.selected && e.selected.length ? e.selected[0] : this.fabricCanvas.getActiveObject();
      if (!obj) return;
      // Device selected: show all its connection splits
      if (obj.type === 'group' && obj.deviceType) {
        const deviceId = this.getDeviceId(obj);
        this.activeHighlight = { type: 'device', id: deviceId };
        this.highlightDeviceConnections(obj);
        return;
      }
      // Connection segment selected: show that connection's splits
      if (obj.isConnectionSegment) {
        this.activeHighlight = { type: 'connection', id: obj.connectionId };
        this.highlightConnectionById(obj.connectionId);
        return;
      }
      // Split handle selected: treat like its connection so other splits show
      if (obj.isNetworkSplitPoint) {
        this.activeHighlight = { type: 'connection', id: obj.connectionId };
        this.highlightConnectionById(obj.connectionId);
        return;
      }
      // Any other selection clears highlights (e.g., background image or other shapes)
      this.activeHighlight = null;
      this.clearConnectionHighlights();
    };
    this.fabricCanvas.on('selection:created', onSelection);
    this.fabricCanvas.on('selection:updated', onSelection);

    this.fabricCanvas.on('selection:cleared', () => {
      this.activeHighlight = null;
      this.clearConnectionHighlights();
    });


  }

  setupDeletionHandling() {
    // Handle deletion of connection segments or split points
    this.fabricCanvas.on('object:removed', (e) => {
      const target = e.target;
      if (!target || this.updatingSegments || this._suppressAllRemovalHandling) return;
      if (target.connectionId && this._bulkRemovingConnectionIds.has(target.connectionId)) return;

      if (target.isConnectionSegment) {
        const connection = this.connections.get(target.connectionId);
        if (!connection) return;
        // New behavior: deleting any segment removes the entire connection
        this.removeConnection(connection.id);
        return;
      }

      if (target.isNetworkSplitPoint) {
        const connection = this.connections.get(target.connectionId);
        if (!connection) return;
        // Remove the node by matching index if present, else by coordinate proximity
        let removed = false;
        if (typeof target.nodeIndex === 'number' && connection.nodes[target.nodeIndex]) {
          connection.nodes.splice(target.nodeIndex, 1);
          removed = true;
        }
        if (!removed) {
          const idx = this.findClosestNodeIndex(connection, { x: target.left, y: target.top });
          if (idx > -1) connection.nodes.splice(idx, 1);
        }
        if (connection.nodes.length === 0) {
          // still keep a direct line between devices
          this.renderConnection(connection);
        } else {
          this.renderConnection(connection);
        }
      }

      // Handle device deletion: remove all connections to it
      if (target.type === 'group' && target.deviceType) {
        this.removeConnectionsForDevice(target);
      }
    });
  }

  // Create connection between two devices
  createConnection(device1, device2, connectionType = 'network') {
    const device1Id = this.getDeviceId(device1);
    const device2Id = this.getDeviceId(device2);
    
    // Create bidirectional connection ID (normalize order to prevent duplicates)
    const connectionId = device1Id < device2Id ? 
      `${device1Id}_${device2Id}` : `${device2Id}_${device1Id}`;
    const pairKey = device1Id < device2Id ? `${device1Id}__${device2Id}` : `${device2Id}__${device1Id}`;
    
    // Check if connection already exists
    if (this.connections.has(connectionId)) return;

    // Extra guard: if any connection links the same pair, skip
    for (const [, conn] of this.connections) {
      if (!conn) continue;
      const k = conn.device1Id < conn.device2Id ? `${conn.device1Id}__${conn.device2Id}` : `${conn.device2Id}__${conn.device1Id}`;
      if (k === pairKey) return;
    }

    // Short cooldown to avoid double-creation from duplicate events
    if (this._recentConnectionKeys.has(pairKey)) return;
    this._recentConnectionKeys.add(pairKey);
    setTimeout(() => this._recentConnectionKeys.delete(pairKey), 600);

    const connection = {
      id: connectionId,
      device1: device1,
      device2: device2,
      device1Id,
      device2Id,
      type: connectionType,
      nodes: [], // intermediate split points, e.g., [{x,y}]
      properties: {
        bandwidth: '1Gbps',
        protocol: 'Ethernet',
        status: 'active',
        // Base stroke color for this connection (supports per-connection coloring)
        color: this.styles.line.stroke
      }
    };

    this.connections.set(connectionId, connection);
  // Ensure devices with connections notify us when they move
  this.attachTrackingForDevice(device1);
  this.attachTrackingForDevice(device2);
    // Index devices for rebinding
    this.indexDevice(device1);
    this.indexDevice(device2);
  this.renderConnection(connection);
    
    // Dispatch event for other systems
    document.dispatchEvent(new CustomEvent('topology:connection-created', { 
      detail: { connection } 
    }));
  }

  // Render a connection as a set of segments and draggable split nodes
  renderConnection(connection) {
    this.updatingSegments = true;

    // Remove previous visuals for this connection
    const toRemove = this.fabricCanvas.getObjects().filter(obj => (
      (obj.isConnectionSegment || obj.isNetworkSplitPoint) && obj.connectionId === connection.id
    ));
    toRemove.forEach(obj => this.fabricCanvas.remove(obj));

    const d1 = this.getDeviceCenter(connection.device1);
    const d2 = this.getDeviceCenter(connection.device2);

    // Build points list: device1 -> nodes[] -> device2
    const points = [d1, ...connection.nodes.map(n => ({ x: n.x, y: n.y })), d2];

    // Create line segments
    for (let i = 0; i < points.length - 1; i++) {
      const segment = new fabric.Line([
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y
      ], {
        // Apply per-connection base style
        ...this.styles.line,
        stroke: (connection && connection.properties && connection.properties.color) ? connection.properties.color : this.styles.line.stroke,
        strokeWidth: this.styles.line.strokeWidth,
        selectable: true,
        hasControls: false,
        hasBorders: false,
        evented: true,
        hoverCursor: 'pointer',
        moveCursor: 'default',
        lockMovementX: true,
        lockMovementY: true,
        isConnectionSegment: true,
        connectionId: connection.id,
        segmentIndex: i, // 0..nodes.length
        perPixelTargetFind: true,
        targetFindTolerance: 8
      });
      this.fabricCanvas.add(segment);
    }

    // Create draggable split point handles for nodes
    connection.nodes.forEach((node, idx) => {
      const splitPoint = new fabric.Circle({
        left: node.x,
        top: node.y,
        originX: 'center',
        originY: 'center',
        ...this.styles.split,
        selectable: true,
        hasControls: false,
        evented: true,
        hoverCursor: 'move',
        moveCursor: 'move',
        isNetworkSplitPoint: true,
        connectionId: connection.id,
        nodeIndex: idx,
        visible: this.shouldShowSplitPointsForConnection(connection.id)
      });

      // Update node coords while moving
      splitPoint.on('moving', () => {
        node.x = splitPoint.left;
        node.y = splitPoint.top;
        this.renderConnection(connection);
      });

      this.fabricCanvas.add(splitPoint);
    });

    // Ensure devices and labels stay above
    this.bringDevicesToFront();
    this.fabricCanvas.requestRenderAll();
    this.updatingSegments = false;
  }

  // Determine if split points should be visible for a given connection based on current highlight
  shouldShowSplitPointsForConnection(connectionId) {
    if (!this.activeHighlight) return false;
    // If user is dragging any device or in 'show all' mode, show all split points
    if (this.activeHighlight.type === 'all') return true;
    if (this.activeHighlight.type === 'connection') return this.activeHighlight.id === connectionId;
    if (this.activeHighlight.type === 'device') {
      // Show if the connection involves the active device
      const conn = this.connections.get(connectionId);
      if (!conn) return false;
      const did = this.activeHighlight.id;
      return conn.device1Id === did || conn.device2Id === did;
    }
    return false;
  }

  // Split a connection by adding a movable node (compat: accepts a segment or legacy line)
  splitConnection(connectionLineOrSegment, pointer) {
    const connectionId = connectionLineOrSegment.connectionId;
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // If a segment is provided, use its index; else compute best insert position
    let insertIndex;
    if (typeof connectionLineOrSegment.segmentIndex === 'number') {
      insertIndex = connectionLineOrSegment.segmentIndex; // insert before the next point
    } else {
      insertIndex = this.findInsertPosition(connection, pointer);
    }

    connection.nodes.splice(insertIndex, 0, { x: pointer.x, y: pointer.y });
    this.renderConnection(connection);
    this.fabricCanvas.requestRenderAll();
  }

  // Helper for double-click splitting
  addSplitPointAtSegment(segment, pointer) {
    const connection = this.connections.get(segment.connectionId);
    if (!connection) return;
    const insertIndex = segment.segmentIndex ?? this.findInsertPosition(connection, pointer);
    connection.nodes.splice(insertIndex, 0, { x: pointer.x, y: pointer.y });
    this.renderConnection(connection);
  }

  // Find the correct position to insert a split point along the connection path
  findInsertPosition(connection, splitPoint) {
    const device1Center = this.getDeviceCenter(connection.device1);
    const device2Center = this.getDeviceCenter(connection.device2);

    if (!connection.nodes || connection.nodes.length === 0) return 0;

    const pathPoints = [device1Center, ...connection.nodes.map(n => ({ x: n.x, y: n.y })), device2Center];

    // Find which segment this split point should be inserted into
    let minDistance = Infinity;
    let bestSegmentIndex = 0;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const segmentStart = pathPoints[i];
      const segmentEnd = pathPoints[i + 1];
      const distance = this.distanceToLineSegment(splitPoint, segmentStart, segmentEnd);
      if (distance < minDistance) {
        minDistance = distance;
        bestSegmentIndex = i;
      }
    }
    // segmentIndex maps 0..nodes.length, but nodes index maps 0..nodes.length-1
    // Insert before the next point => same numeric index in nodes array
    return Math.min(bestSegmentIndex, (connection.nodes?.length ?? 0));
  }

  // Calculate distance from a point to a line segment
  distanceToLineSegment(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line segment is actually a point
      return Math.sqrt(A * A + B * B);
    }
    
    const param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Bring devices and their labels to the front for proper layering
  bringDevicesToFront() {
    const allDevices = this.fabricCanvas.getObjects().filter(obj => obj.type === 'group' && obj.deviceType);
    allDevices.forEach(device => {
      this.fabricCanvas.bringToFront(device);
      if (device.textObject) this.fabricCanvas.bringToFront(device.textObject);
    });
    const allSplitPoints = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint);
    allSplitPoints.forEach(point => this.fabricCanvas.bringToFront(point));
  }

  updateConnectionsForDevice(device) {
    // Update all connections involving this device using stable IDs
    const id = this.getDeviceId(device);
    this.connections.forEach(connection => {
      if (connection.device1Id === id) {
        if (connection.device1 !== device) connection.device1 = device; // rebind if needed
        this.renderConnection(connection);
      } else if (connection.device2Id === id) {
        if (connection.device2 !== device) connection.device2 = device; // rebind if needed
        this.renderConnection(connection);
      }
    });
    this.fabricCanvas.requestRenderAll();
  }

  getDeviceCenter(device) {
    // Get the actual center point of the device
    const center = device.getCenterPoint ? device.getCenterPoint() : {
      x: device.left,
      y: device.top
    };
    
    return {
      x: center.x,
      y: center.y
    };
  }

  highlightDeviceConnections(device) {
    // Highlight connected segments and reveal only their split points; do not recolor split points
    this.clearConnectionHighlights();
    const deviceId = this.getDeviceId(device);
    // First hide all split points
    const allSplits = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint);
    allSplits.forEach(p => p.set({ visible: false, ...this.styles.split }));
    this.connections.forEach(connection => {
      if (connection.device1Id === deviceId || connection.device2Id === deviceId) {
        const segments = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment && obj.connectionId === connection.id);
        segments.forEach(segment => segment.set({ ...this.styles.lineHighlight }));
        const splitPoints = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint && obj.connectionId === connection.id);
        splitPoints.forEach(point => point.set({ visible: true, ...this.styles.split }));
      }
    });
    this.fabricCanvas.requestRenderAll();
  }

  // Show all split points on canvas; optionally keep the dragged device's lines highlighted
  showAllSplitPoints(draggedDevice = null) {
    // Reset line styles first (respect per-connection color)
    const segments = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment);
    segments.forEach(segment => {
      const conn = this.connections.get(segment.connectionId);
      segment.set({
        stroke: (conn && conn.properties && conn.properties.color) ? conn.properties.color : this.styles.line.stroke,
        strokeWidth: this.styles.line.strokeWidth
      });
    });
    // Show every split point
    const splitPoints = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint);
    splitPoints.forEach(point => point.set({ visible: true, ...this.styles.split }));
    // If a device is being dragged, lightly highlight its connected segments for feedback
    if (draggedDevice) {
      const did = this.getDeviceId(draggedDevice);
      this.connections.forEach(connection => {
        if (connection.device1Id === did || connection.device2Id === did) {
          const segs = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment && obj.connectionId === connection.id);
          segs.forEach(seg => seg.set({ ...this.styles.lineHighlight }));
        }
      });
    }
    this.fabricCanvas.requestRenderAll();
  }

  clearConnectionHighlights() {
    // Reset connection segment colors to their per-connection base color
    const segments = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment);
    segments.forEach(segment => {
      const conn = this.connections.get(segment.connectionId);
      segment.set({
        stroke: (conn && conn.properties && conn.properties.color) ? conn.properties.color : this.styles.line.stroke,
        strokeWidth: this.styles.line.strokeWidth,
        shadow: null
      });
    });
    // Hide all split points and reset style
    const splitPoints = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint);
    splitPoints.forEach(point => point.set({ ...this.styles.split, visible: false }));
    this.fabricCanvas.requestRenderAll();
  }

  // Highlight a single connection by id (when a segment is selected)
  highlightConnectionById(connectionId) {
    this.clearConnectionHighlights();
    const segments = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment && obj.connectionId === connectionId);
    segments.forEach(segment => segment.set({ ...this.styles.lineHighlight }));
    // Reveal only this connection's split points, keep their base style
    const splitPoints = this.fabricCanvas.getObjects().filter(obj => obj.isNetworkSplitPoint && obj.connectionId === connectionId);
    splitPoints.forEach(point => point.set({ visible: true, ...this.styles.split }));
    this.fabricCanvas.requestRenderAll();
  }



  clearAllConnections() {
    // Remove connection visuals from canvas
    const objectsToRemove = this.fabricCanvas.getObjects().filter(obj => obj.isConnectionSegment || obj.isNetworkSplitPoint);
    this._suppressAllRemovalHandling = true;
    try {
      objectsToRemove.forEach(obj => this.fabricCanvas.remove(obj));
    } finally {
      this._suppressAllRemovalHandling = false;
    }

    // Clear internal data
    this.connections.clear();
    this.fabricCanvas.requestRenderAll();
  }

  // Remove a single connection and its visuals
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    const toRemove = this.fabricCanvas.getObjects().filter(obj => (obj.isConnectionSegment || obj.isNetworkSplitPoint) && obj.connectionId === connectionId);
    this._bulkRemovingConnectionIds.add(connectionId);
    try {
      toRemove.forEach(obj => this.fabricCanvas.remove(obj));
    } finally {
      this._bulkRemovingConnectionIds.delete(connectionId);
    }
    this.connections.delete(connectionId);
    this.fabricCanvas.requestRenderAll();
  }

  // Compatibility: remove connection by id (used by deletion utils)
  removeConnectionById(connectionId) {
    this.removeConnection(connectionId);
  }

  // Remove all connections involving a specific device
  removeConnectionsForDevice(device) {
    const deviceId = this.getDeviceId(device);
    const connectionsToRemove = [];
    this.connections.forEach((connection, id) => {
      if (connection.device1Id === deviceId || connection.device2Id === deviceId) {
        connectionsToRemove.push(id);
      }
    });
    connectionsToRemove.forEach(id => this.removeConnection(id));
  }

  // Compatibility: remove a split point handle object
  removeSplitPoint(splitPointObj) {
    if (!splitPointObj || !splitPointObj.connectionId) return;
    const connection = this.connections.get(splitPointObj.connectionId);
    if (!connection) return;
    const idx = typeof splitPointObj.nodeIndex === 'number' ? splitPointObj.nodeIndex : this.findClosestNodeIndex(connection, { x: splitPointObj.left, y: splitPointObj.top });
    if (idx > -1 && connection.nodes[idx]) {
      connection.nodes.splice(idx, 1);
      this.renderConnection(connection);
    }
  }

  // Debug helper
  debugConnections() {
    try {
      const data = this.getConnectionsData();
      console.table(data.map(d => ({ id: d.id, d1: d.device1Id, d2: d.device2Id, nodes: d.splitPoints.length })));
      return data;
    } catch (e) {
      console.warn('debugConnections failed', e);
      return [];
    }
  }



  // Serialization methods for save/load
  getConnectionsData() {
    const connectionsData = [];
    this.connections.forEach(connection => {
      connectionsData.push({
        id: connection.id,
        device1Id: connection.device1Id || this.getDeviceId(connection.device1),
        device2Id: connection.device2Id || this.getDeviceId(connection.device2),
        type: connection.type,
        properties: connection.properties,
        splitPoints: (connection.nodes || []).map(n => ({ x: n.x, y: n.y }))
      });
    });
    return connectionsData;
  }

  loadConnectionsData(connectionsData) {
    // Remove any current visuals managed by topology
    this.clearAllConnections();
    // Also purge any legacy connection lines that may have been serialized as generic drawing objects
    this.removeLegacyConnectionLines();
    connectionsData.forEach(connData => {
      const device1 = this.findDeviceById(connData.device1Id);
      const device2 = this.findDeviceById(connData.device2Id);
      if (!device1 || !device2) return;
      this.createConnection(device1, device2, connData.type);
      const connection = this.connections.get(connData.id) || this.connections.get(this.makeNormalizedConnectionId(device1, device2));
      if (connection) {
        connection.properties = connData.properties;
        connection.nodes = (connData.splitPoints || []).map(p => ({ x: p.x, y: p.y }));
        // Re-attach move tracking just in case
        this.attachTrackingForDevice(connection.device1);
        this.attachTrackingForDevice(connection.device2);
        this.renderConnection(connection);
      }
    });
  }

  // Remove legacy connection visuals that were saved as generic lines in older saves
  removeLegacyConnectionLines() {
    const isConnectionColor = (stroke) => {
      if (!stroke || typeof stroke !== 'string') return false;
      const s = stroke.toLowerCase();
      return s === '#2196f3' || s.includes('rgb(33') && s.includes('150') && s.includes('243');
    };
    const candidates = this.fabricCanvas.getObjects().filter((obj) => {
      if (obj.type !== 'line') return false;
      // Exclude walls and measuring/arrow colors; exclude any explicit device/resize visuals
      if (obj.stroke === 'red' || obj.stroke === 'grey' || obj.stroke === 'blue') return false;
      if (obj.deviceType || obj.isResizeIcon || obj.isConnectionSegment || obj.isNetworkSplitPoint) return false;
      // Heuristic: our legacy connection visuals used our connection color and were non-movable
      const locked = obj.lockMovementX === true && obj.lockMovementY === true;
      return isConnectionColor(obj.stroke) && locked;
    });
    candidates.forEach((obj) => {
      try { this.fabricCanvas.remove(obj); } catch (_) {}
    });
    if (candidates.length) this.fabricCanvas.requestRenderAll();
  }

  // Utility to normalize id from two devices
  makeNormalizedConnectionId(device1, device2) {
    const d1 = this.getDeviceId(device1);
    const d2 = this.getDeviceId(device2);
    return d1 < d2 ? `${d1}_${d2}` : `${d2}_${d1}`;
  }

  getDeviceId(device) {
    if (!device) return undefined;
    // Prefer a pre-existing stable id
    if (device.id) return device.id;
    // Fall back to a previously generated topology id
    if (device._topologyId) return device._topologyId;
    // Generate and assign a stable id to the device object so it persists for saves
    const newId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    device.id = newId;
    device._topologyId = newId;
    return newId;
  }

  findDeviceById(deviceId) {
    return this.fabricCanvas.getObjects().find(obj => 
      obj.type === 'group' && obj.deviceType && this.getDeviceId(obj) === deviceId
    );
  }

  // Attach a per-device moving listener so connections always update even if global listeners are disrupted
  attachTrackingForDevice(device) {
    if (!device || this.trackedDevices.has(device)) return;
    const handler = () => {
      this.updateConnectionsForDevice(device);
      // Ensure active highlight while dragging this device
      const deviceId = this.getDeviceId(device);
      this.activeHighlight = { type: 'device', id: deviceId };
      this.highlightDeviceConnections(device);
    };
    // Store handler for potential future cleanup
    device._topologyMoveHandler = handler;
    device.on('moving', handler);
    // Also clean up on removal
    device.on('removed', () => {
      try { device.off('moving', handler); } catch (_) {}
      this.trackedDevices.delete(device);
    });
    this.trackedDevices.add(device);
  }

  // Maintain a device index for id -> object rebinding
  indexDevice(device) {
    try {
      const id = this.getDeviceId(device);
      if (id) this.deviceIndex.set(id, device);
    } catch (_) {}
  }

  // If a device is re-added, ensure all connections pointing to that id are bound to this object
  rebindConnectionsForDevice(device) {
    const deviceId = this.getDeviceId(device);
    this.connections.forEach((conn) => {
      if (conn.device1Id === deviceId && conn.device1 !== device) {
        conn.device1 = device;
        this.attachTrackingForDevice(device);
        this.renderConnection(conn);
      }
      if (conn.device2Id === deviceId && conn.device2 !== device) {
        conn.device2 = device;
        this.attachTrackingForDevice(device);
        this.renderConnection(conn);
      }
    });
  }

  // Find the closest node in a connection to a given point
  findClosestNodeIndex(connection, point) {
    if (!connection.nodes || connection.nodes.length === 0) return -1;
    let minD = Infinity;
    let idx = -1;
    connection.nodes.forEach((n, i) => {
      const dx = point.x - n.x;
      const dy = point.y - n.y;
      const d = dx * dx + dy * dy;
      if (d < minD) { minD = d; idx = i; }
    });
    return idx;
  }
}