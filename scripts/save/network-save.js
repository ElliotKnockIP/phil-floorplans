// Helper functions for saving and loading network topology data

// Serialize connections for project saving (used by TopologyManager)
export function serializeConnections(connections, getDeviceId) {
  const data = [];
  connections.forEach((conn) => {
    data.push({
      id: conn.id,
      device1Id: conn.device1Id,
      device2Id: conn.device2Id,
      type: conn.type,
      splitPoints: conn.nodes.map((n) => ({ x: n.x, y: n.y })),
      properties: { ...conn.properties },
    });
  });
  return data;
}

// Restore connections from saved data (used by TopologyManager)
export function deserializeConnections(data, findDevice, createConnection) {
  if (!Array.isArray(data)) return [];

  const restored = [];
  data.forEach((connData) => {
    const device1 = findDevice(connData.device1Id);
    const device2 = findDevice(connData.device2Id);

    if (!device1 || !device2) return;

    const conn = createConnection(device1, device2, connData.type, { skipValidation: true });
    if (!conn) return;

    if (connData.splitPoints?.length) {
      conn.nodes = connData.splitPoints.map((p) => ({ x: p.x, y: p.y }));
    }

    if (connData.properties) {
      Object.assign(conn.properties, connData.properties);
    }

    restored.push(conn);
  });

  return restored;
}

// Converts all network connections into a saveable format
export function getConnectionsData(topologyManager) {
  const manager = topologyManager || (typeof window !== "undefined" ? window.topologyManager : null);
  if (!manager || !manager.connections) return [];

  const connectionsData = [];
  manager.connections.forEach((connection) => {
    try {
      let serializedProperties = {};
      if (connection.properties) {
        try {
          serializedProperties = JSON.parse(JSON.stringify(connection.properties));
        } catch (e) {
          serializedProperties = {
            label: connection.properties.label,
            channel: connection.properties.channel,
            panelDeviceId: connection.properties.panelDeviceId,
            showDistance: connection.properties.showDistance,
            color: connection.properties.color,
            customTextLabels: connection.properties.customTextLabels,
          };
          Object.keys(serializedProperties).forEach((key) => {
            if (serializedProperties[key] === undefined || serializedProperties[key] === null) {
              delete serializedProperties[key];
            }
          });
        }
      }

      const data = {
        id: connection.id,
        device1Id: connection.device1Id || manager.getDeviceId(connection.device1),
        device2Id: connection.device2Id || manager.getDeviceId(connection.device2),
        type: connection.type || "network",
        properties: serializedProperties,
        splitPoints: (connection.nodes || []).map((n) => ({ x: n.x, y: n.y })),
      };

      if (data.properties.customTextLabels && Array.isArray(data.properties.customTextLabels)) {
        data.properties.customTextLabels = data.properties.customTextLabels.map((label) => ({
          id: label.id,
          text: label.text,
          pathRatio: label.pathRatio,
          customTextId: label.customTextId,
        }));
      }

      connectionsData.push(data);
    } catch (e) {
      console.error("Error serializing connection:", e, connection);
    }
  });
  return connectionsData;
}

// Restores network connections from saved data
export function loadConnectionsData(topologyManager, connectionsData = []) {
  const manager = topologyManager || (typeof window !== "undefined" ? window.topologyManager : null);
  if (!manager || !Array.isArray(connectionsData)) return;

  manager.clearAllConnections();
  removeLegacyConnectionLines(manager);
  connectionsData.forEach((connData) => {
    const device1 = manager.findDeviceById(connData.device1Id);
    const device2 = manager.findDeviceById(connData.device2Id);
    if (!device1 || !device2) return;
    manager.createConnection(device1, device2, connData.type, { skipValidation: true });
    const normalizedId = manager.makeNormalizedConnectionId(device1, device2);
    const connection = manager.connections.get(connData.id) || manager.connections.get(normalizedId);
    if (!connection) return;
    const previousPanelId = connection.properties?.panelDeviceId || null;

    const rawProperties = connData.properties || {};
    const clonedProperties = (() => {
      try {
        return JSON.parse(JSON.stringify(rawProperties));
      } catch (_) {
        return { ...rawProperties };
      }
    })();

    const normalizedProperties = clonedProperties && typeof clonedProperties === "object" ? clonedProperties : {};

    const restoredProperties = {
      color: connection.properties?.color || manager.styles.line.stroke,
      label: connection.properties?.label || "",
      showDistance: typeof connection.properties?.showDistance === "boolean" ? connection.properties.showDistance : true,
      customTextLabels: [],
      channel: connection.properties?.channel,
      panelDeviceId: connection.properties?.panelDeviceId,
      ...normalizedProperties,
    };

    if (typeof restoredProperties.label !== "string") {
      restoredProperties.label = "";
    }

    const hasValidColor = typeof restoredProperties.color === "string" && restoredProperties.color.trim();
    if (!hasValidColor) {
      restoredProperties.color = manager.styles.line.stroke;
    }

    if (typeof restoredProperties.showDistance === "string") {
      restoredProperties.showDistance = restoredProperties.showDistance.toLowerCase() !== "false";
    } else {
      const isBool = typeof restoredProperties.showDistance === "boolean";
      restoredProperties.showDistance = isBool ? restoredProperties.showDistance : true;
    }

    if (Array.isArray(normalizedProperties.customTextLabels)) {
      restoredProperties.customTextLabels = normalizedProperties.customTextLabels.map((label) => {
        const ratio = Number(label?.pathRatio);
        return {
          id: label?.id || `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          text: label?.text || "",
          pathRatio: Number.isFinite(ratio) ? ratio : 0.5,
          customTextId: label?.customTextId || label?.id || null,
        };
      });
    } else {
      delete restoredProperties.customTextLabels;
    }

    const channelNumber = Number(restoredProperties.channel);
    restoredProperties.channel = Number.isFinite(channelNumber) && channelNumber > 0 ? channelNumber : null;

    if (typeof restoredProperties.panelDeviceId !== "string") {
      restoredProperties.panelDeviceId = null;
    } else {
      restoredProperties.panelDeviceId = restoredProperties.panelDeviceId.trim();
      if (!restoredProperties.panelDeviceId) restoredProperties.panelDeviceId = null;
    }
    if (!restoredProperties.panelDeviceId) {
      restoredProperties.channel = null;
    }

    connection.properties = restoredProperties;
    connection.nodes = (connData.splitPoints || []).map((p) => ({ x: p.x, y: p.y }));

    if (previousPanelId && previousPanelId !== restoredProperties.panelDeviceId) {
      const previousEntries = manager.panelChannels.get(previousPanelId);
      if (previousEntries) {
        const idx = previousEntries.indexOf(connection.id);
        if (idx > -1) previousEntries.splice(idx, 1);
        if (previousEntries.length === 0) manager.panelChannels.delete(previousPanelId);
      }
    }

    if (restoredProperties.panelDeviceId && restoredProperties.channel) {
      if (!manager.panelChannels.has(restoredProperties.panelDeviceId)) {
        manager.panelChannels.set(restoredProperties.panelDeviceId, []);
      }
      const channelEntries = manager.panelChannels.get(restoredProperties.panelDeviceId);
      if (!channelEntries.includes(connection.id)) channelEntries.push(connection.id);
    }

    manager.attachTrackingForDevice(connection.device1);
    manager.attachTrackingForDevice(connection.device2);
    manager.renderConnection(connection);
  });
}

// Cleans up old connection line objects from the canvas
export function removeLegacyConnectionLines(topologyManager) {
  const manager = topologyManager || (typeof window !== "undefined" ? window.topologyManager : null);
  if (!manager || !manager.fabricCanvas) return;
  const isConnectionColor = (stroke) => {
    if (!stroke || typeof stroke !== "string") return false;
    const s = stroke.toLowerCase();
    return s === "#2196f3" || (s.includes("rgb(33") && s.includes("150") && s.includes("243"));
  };
  const candidates = manager.fabricCanvas.getObjects().filter((obj) => {
    if (obj.type !== "line") return false;
    if (obj.stroke === "red" || obj.stroke === "grey" || obj.stroke === "blue") return false;
    if (obj.deviceType || obj.isResizeIcon || obj.isConnectionSegment || obj.isNetworkSplitPoint) return false;
    const locked = obj.lockMovementX === true && obj.lockMovementY === true;
    return isConnectionColor(obj.stroke) && locked;
  });
  candidates.forEach((obj) => {
    try {
      manager.fabricCanvas.remove(obj);
    } catch (_) {}
  });
  if (candidates.length) manager.fabricCanvas.requestRenderAll();
}

// Saves the entire network topology state including map positions
export function serializeTopologyState(topologyManager, topologyBuilderAPI) {
  try {
    const connectionsData = getConnectionsData(topologyManager);
    let topologyMapPositions = {};

    const builderAPI = topologyBuilderAPI || (typeof window !== "undefined" ? window.topologyBuilderAPI : null);
    if (builderAPI && typeof builderAPI.getTopologyPositions === "function") {
      try {
        topologyMapPositions = builderAPI.getTopologyPositions() || {};
      } catch (e) {
        console.warn("Failed to get topology map positions:", e);
      }
    }

    return {
      connections: connectionsData,
      mapPositions: topologyMapPositions,
    };
  } catch (e) {
    console.error("Error serializing topology data:", e);
    return {
      connections: getConnectionsData(topologyManager),
      mapPositions: {},
    };
  }
}

// Restores the entire network topology state from saved data
export function loadTopologyState(topologyManager, topologyData, topologyBuilderAPI) {
  const manager = topologyManager || (typeof window !== "undefined" ? window.topologyManager : null);
  if (!manager || !topologyData) return;

  try {
    if (Array.isArray(topologyData)) {
      loadConnectionsData(manager, topologyData);
    } else {
      if (topologyData.connections) {
        loadConnectionsData(manager, topologyData.connections);
      }
      if (topologyData.mapPositions) {
        const builderAPI = topologyBuilderAPI || (typeof window !== "undefined" ? window.topologyBuilderAPI : null);
        if (builderAPI?.setTopologyPositions) {
          try {
            builderAPI.setTopologyPositions(topologyData.mapPositions);
          } catch (e) {
            console.warn("Failed to restore topology map positions:", e);
          }
        }
      }
    }
  } catch (e) {
    console.error("Topology load failed:", e);
  }
}
