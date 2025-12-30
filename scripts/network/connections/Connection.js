import { distance, pathLength } from "../network-utils.js";

// Connection data and behavior between two devices.
export class Connection {
  constructor(device1, device2, type = "network") {
    this.device1 = device1;
    this.device2 = device2;
    this.device1Id = device1.id || device1.topologyId;
    this.device2Id = device2.id || device2.topologyId;
    this.id = Connection.normalizeId(this.device1Id, this.device2Id);
    this.type = type;
    this.nodes = []; // Split points / waypoints
    this.properties = {
      color: "#2196F3",
      label: "",
      showDistance: true,
      channel: null,
      panelDeviceId: null,
      customTextLabels: [],
    };
  }

  // Creates a consistent ID from two device IDs (always same order)
  static normalizeId(id1, id2) {
    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
  }

  // Check if this connection involves a specific device
  involvesDevice(deviceId) {
    return this.device1Id === deviceId || this.device2Id === deviceId;
  }

  // Get the other device in this connection
  getOtherDevice(deviceId) {
    if (this.device1Id === deviceId) return this.device2;
    if (this.device2Id === deviceId) return this.device1;
    return null;
  }

  // Add a split point to the connection
  addNode(x, y, index = null) {
    const node = { x, y };
    if (index !== null && index >= 0) {
      this.nodes.splice(index, 0, node);
    } else {
      this.nodes.push(node);
    }
    return node;
  }

  // Remove a split point by index
  removeNode(index) {
    if (index >= 0 && index < this.nodes.length) {
      return this.nodes.splice(index, 1)[0];
    }
    return null;
  }

  // Get the full path including device centers and split points
  getPath(getDeviceCenter) {
    const p1 = getDeviceCenter(this.device1);
    const p2 = getDeviceCenter(this.device2);
    return [p1, ...this.nodes.map((n) => ({ x: n.x, y: n.y })), p2];
  }

  // Calculate total distance in meters
  getDistanceMeters(getDeviceCenter, pixelsPerMeter = 17.5) {
    const path = this.getPath(getDeviceCenter);
    const totalPixels = pathLength(path);
    return (totalPixels / pixelsPerMeter).toFixed(2);
  }

  // Find the closest node index to a point
  findClosestNodeIndex(point) {
    if (this.nodes.length === 0) return -1;

    let minDistSq = Infinity;
    let closestIdx = -1;

    this.nodes.forEach((node, idx) => {
      const dx = point.x - node.x;
      const dy = point.y - node.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }

  // Serialize connection for saving
  toJSON() {
    return {
      id: this.id,
      device1Id: this.device1Id,
      device2Id: this.device2Id,
      type: this.type,
      splitPoints: this.nodes.map((n) => ({ x: n.x, y: n.y })),
      properties: { ...this.properties },
    };
  }

  // Update device references (used after undo/redo)
  rebindDevice(deviceId, newDevice) {
    if (this.device1Id === deviceId) {
      this.device1 = newDevice;
    }
    if (this.device2Id === deviceId) {
      this.device2 = newDevice;
    }
  }
}
