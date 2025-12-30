import { distance, midpoint, pathMidpoint, positionOnPath, ratioOnPath } from "../network-utils.js";

// Handles rendering of connections, labels, and split points on canvas.
export class ConnectionRenderer {
  constructor(canvas, styles) {
    this.canvas = canvas;
    this.styles = styles;
    this.updatingSegments = false;
  }

  // Render a complete connection with all its visual elements
  render(connection, options = {}) {
    const { getDeviceCenter, pixelsPerMeter = 17.5, showSplitPoints = false } = options;
    this.updatingSegments = true;

    // Save existing label styles before clearing
    const labelStyles = this.saveLabelStyles(connection.id);

    // Clear existing visuals
    this.clear(connection.id);

    // Build path
    const path = connection.getPath(getDeviceCenter);

    // Render segments
    this.renderSegments(connection, path);

    // Render labels
    if (connection.properties.showDistance) {
      this.renderDistanceLabels(connection, path, pixelsPerMeter, labelStyles);
    }
    if (connection.properties.label) {
      this.renderMainLabel(connection, path, labelStyles);
    }
    if (connection.properties.customTextLabels?.length) {
      this.renderCustomLabels(connection, path, labelStyles, options);
    }
    if (connection.properties.channel) {
      this.renderChannelLabel(connection, getDeviceCenter);
    }

    // Render split points
    this.renderSplitPoints(connection, showSplitPoints, options.onNodeMove);

    this.updatingSegments = false;
    this.canvas.requestRenderAll();
  }

  // Clear all visual elements for a connection
  clear(connectionId) {
    const toRemove = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          obj.connectionId === connectionId &&
          (obj.isConnectionSegment ||
            obj.isNetworkSplitPoint ||
            obj.isSegmentDistanceLabel ||
            obj.isConnectionCustomLabel ||
            obj.isChannelLabel)
      );
    toRemove.forEach((obj) => this.canvas.remove(obj));
  }

  // Save label styles before re-rendering
  saveLabelStyles(connectionId) {
    const styles = new Map();
    const labels = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          obj.connectionId === connectionId &&
          (obj.isSegmentDistanceLabel || obj.isConnectionCustomLabel || obj.isChannelLabel)
      );

    labels.forEach((label) => {
      const key = label.isSegmentDistanceLabel
        ? `distance_${label.segmentIndex}`
        : label.isConnectionCustomLabel
        ? `custom_${label.customTextId || "main"}`
        : "channel";
      styles.set(key, {
        fill: label.fill,
        backgroundColor: label.backgroundColor,
        fontSize: label.fontSize,
        fontFamily: label.fontFamily,
        fontWeight: label.fontWeight,
        fontStyle: label.fontStyle,
      });
    });
    return styles;
  }

  // Render line segments between path points
  renderSegments(connection, path) {
    const strokeColor = connection.properties.color || this.styles.line.stroke;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = new fabric.Line([path[i].x, path[i].y, path[i + 1].x, path[i + 1].y], {
        stroke: strokeColor,
        strokeWidth: this.styles.line.strokeWidth,
        selectable: true,
        hasControls: false,
        hasBorders: false,
        evented: true,
        hoverCursor: "pointer",
        moveCursor: "default",
        lockMovementX: true,
        lockMovementY: true,
        isConnectionSegment: true,
        connectionId: connection.id,
        segmentIndex: i,
        perPixelTargetFind: true,
        targetFindTolerance: 8,
      });
      this.canvas.add(segment);
    }
  }

  // Render distance labels for each segment
  renderDistanceLabels(connection, path, pixelsPerMeter, labelStyles) {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i],
        p2 = path[i + 1];
      const dist = distance(p1, p2);
      const meters = (dist / pixelsPerMeter).toFixed(2);
      const mid = midpoint(p1, p2);

      const styleKey = `distance_${i}`;
      const saved = labelStyles?.get(styleKey);

      const label = new fabric.Text(`${meters} m`, {
        left: mid.x,
        top: mid.y - 15,
        fontSize: saved?.fontSize || 10,
        fill: saved?.fill || "#000000",
        fontFamily: saved?.fontFamily || "Poppins, sans-serif",
        backgroundColor: saved?.backgroundColor || "transparent",
        fontWeight: saved?.fontWeight || "normal",
        fontStyle: saved?.fontStyle || "normal",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        textAlign: "center",
        isSegmentDistanceLabel: true,
        connectionId: connection.id,
        segmentIndex: i,
      });
      this.canvas.add(label);
    }
  }

  // Render the main custom label at path midpoint
  renderMainLabel(connection, path, labelStyles) {
    const mid = pathMidpoint(path);
    const saved = labelStyles?.get("custom_main");

    const label = new fabric.IText(connection.properties.label, {
      left: mid.x,
      top: mid.y - 25,
      fontSize: saved?.fontSize || 12,
      fill: saved?.fill || "#000000",
      fontFamily: saved?.fontFamily || "Poppins, sans-serif",
      backgroundColor: saved?.backgroundColor || "transparent",
      selectionColor: "rgba(0,0,0,0)",
      selectionBackgroundColor: "rgba(0,0,0,0)",
      fontWeight: saved?.fontWeight || "normal",
      fontStyle: saved?.fontStyle || "normal",
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: "move",
      moveCursor: "move",
      isConnectionCustomLabel: true,
      connectionId: connection.id,
      textAlign: "center",
    });

    label.on("moving", () => label.setCoords());
    this.canvas.add(label);
  }

  // Render custom text labels at specific path positions
  renderCustomLabels(connection, path, labelStyles, options) {
    connection.properties.customTextLabels.forEach((textData) => {
      const pos = positionOnPath(path, textData.pathRatio);
      const saved = labelStyles?.get(`custom_${textData.id}`);

      const label = new fabric.IText(textData.text, {
        left: pos.x,
        top: pos.y - 15,
        fontSize: saved?.fontSize || 12,
        fill: saved?.fill || "#000000",
        fontFamily: saved?.fontFamily || "Poppins, sans-serif",
        backgroundColor: saved?.backgroundColor || "transparent",
        selectionColor: "rgba(0,0,0,0)",
        selectionBackgroundColor: "rgba(0,0,0,0)",
        fontWeight: saved?.fontWeight || "normal",
        fontStyle: saved?.fontStyle || "normal",
        originX: "center",
        originY: "center",
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        hoverCursor: "text",
        moveCursor: "move",
        isConnectionCustomLabel: true,
        connectionId: connection.id,
        textAlign: "center",
        customTextId: textData.id,
      });

      let isEditing = false;

      label.on("moving", () => {
        if (isEditing || label.isEditing) return;
        label.setCoords();
        textData.pathRatio = ratioOnPath(path, { x: label.left, y: label.top });
      });

      label.on("editing:entered", () => {
        isEditing = true;
        label.set({ selectable: false, evented: false, hoverCursor: "text" });
      });

      label.on("editing:exited", () => {
        isEditing = false;
        label.set({ selectable: true, evented: true, hoverCursor: "text", moveCursor: "move" });
        textData.text = label.text;
        this.canvas.requestRenderAll();
      });

      label.on("mousedown", (e) => {
        if (e.e?.detail === 2) {
          e.e.preventDefault();
          e.e.stopPropagation();
          label.enterEditing();
        }
      });

      this.canvas.add(label);
    });
  }

  // Render channel number label for panel connections
  renderChannelLabel(connection, getDeviceCenter) {
    const panelDevice =
      connection.properties.panelDeviceId === connection.device1Id
        ? connection.device1
        : connection.device2;
    const otherDevice =
      connection.properties.panelDeviceId === connection.device1Id
        ? connection.device2
        : connection.device1;

    const panelCenter = getDeviceCenter(panelDevice);
    const otherCenter = getDeviceCenter(otherDevice);

    const angle = Math.atan2(otherCenter.y - panelCenter.y, otherCenter.x - panelCenter.x);
    const offset = 30;

    const label = new fabric.Text(`${connection.properties.channel}`, {
      left: panelCenter.x + Math.cos(angle) * offset,
      top: panelCenter.y + Math.sin(angle) * offset,
      fontSize: 15,
      fill: "#000000",
      fontFamily: "Poppins, sans-serif",
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      fontWeight: "bold",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      textAlign: "center",
      isChannelLabel: true,
      connectionId: connection.id,
    });
    this.canvas.add(label);
  }

  // Render draggable split point handles
  renderSplitPoints(connection, visible, onNodeMove) {
    connection.nodes.forEach((node, idx) => {
      const splitPoint = new fabric.Circle({
        left: node.x,
        top: node.y,
        originX: "center",
        originY: "center",
        ...this.styles.split,
        selectable: true,
        hasControls: false,
        evented: true,
        hoverCursor: "move",
        moveCursor: "move",
        isNetworkSplitPoint: true,
        connectionId: connection.id,
        nodeIndex: idx,
        visible,
      });

      splitPoint.on("moving", () => {
        node.x = splitPoint.left;
        node.y = splitPoint.top;
        if (onNodeMove) onNodeMove(connection);
      });

      this.canvas.add(splitPoint);
    });
  }

  // Apply highlight style to segments
  highlightConnection(connectionId) {
    const segments = this.canvas
      .getObjects()
      .filter((obj) => obj.isConnectionSegment && obj.connectionId === connectionId);
    segments.forEach((seg) => seg.set({ ...this.styles.lineHighlight }));

    const splits = this.canvas
      .getObjects()
      .filter((obj) => obj.isNetworkSplitPoint && obj.connectionId === connectionId);
    splits.forEach((sp) => sp.set({ visible: true, ...this.styles.split }));

    this.canvas.requestRenderAll();
  }

  // Clear all connection highlights
  clearHighlights(connections) {
    const segments = this.canvas.getObjects().filter((obj) => obj.isConnectionSegment);
    segments.forEach((seg) => {
      const conn = connections.get(seg.connectionId);
      seg.set({
        stroke: conn?.properties?.color || this.styles.line.stroke,
        strokeWidth: this.styles.line.strokeWidth,
        shadow: null,
      });
    });

    const splits = this.canvas.getObjects().filter((obj) => obj.isNetworkSplitPoint);
    splits.forEach((sp) => sp.set({ ...this.styles.split, visible: false }));

    this.canvas.requestRenderAll();
  }

  // Show all split points (for dragging)
  showAllSplitPoints() {
    const splits = this.canvas.getObjects().filter((obj) => obj.isNetworkSplitPoint);
    splits.forEach((sp) => sp.set({ visible: true, ...this.styles.split }));
    this.canvas.requestRenderAll();
  }

  // Render a simplified connection (straight line, no split points) for topology map view
  renderSimplified(options) {
    const { id, p1, p2, distanceText, label, customLabels, isMultiple, offset = 0 } = options;

    // Draw line segment
    const line = new fabric.Line([p1.x + offset, p1.y, p2.x + offset, p2.y], {
      stroke: this.styles.line.stroke,
      strokeWidth: 2,
      selectable: false,
      evented: false,
      isTopoSegment: true,
      connectionId: id,
    });
    this.canvas.add(line);

    // Only render labels for single connections or first of multiple
    if (!isMultiple || offset === 0) {
      this.renderSimplifiedLabel(id, p1, p2, distanceText, label, customLabels);
    }

    return line;
  }

  // Render labels for simplified connection
  renderSimplifiedLabel(id, p1, p2, distanceText, label, customLabels = []) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Main label (distance + optional label)
    const mainText = label ? `${distanceText}${distanceText ? " | " : ""}${label}` : distanceText;
    if (mainText) {
      const textLabel = new fabric.Text(mainText, {
        left: midX,
        top: midY - 15,
        fontSize: 12,
        fill: "#000000",
        fontFamily: "Poppins, sans-serif",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        isTopoLabel: true,
        connectionId: id,
      });
      this.canvas.add(textLabel);
    }

    // Custom text labels along path
    customLabels.forEach((td, idx) => {
      const ratio = td.pathRatio || 0.5;
      const lx = p1.x + (p2.x - p1.x) * ratio;
      const ly = p1.y + (p2.y - p1.y) * ratio;

      const customLabel = new fabric.Text(td.text, {
        left: lx,
        top: ly - 15 - idx * 20,
        fontSize: 12,
        fill: "#000000",
        fontFamily: "Poppins, sans-serif",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        isTopoLabel: true,
        connectionId: id,
      });
      this.canvas.add(customLabel);
    });
  }

  // Clear simplified connection visuals
  clearSimplified() {
    const toRemove = this.canvas.getObjects().filter((o) => o.isTopoSegment || o.isTopoLabel);
    toRemove.forEach((o) => this.canvas.remove(o));
  }

  // Highlight/unhighlight simplified connections
  highlightSimplified(connectionIds, highlight = true) {
    const segments = this.canvas.getObjects().filter((o) => o.isTopoSegment);
    segments.forEach((seg) => {
      const isTarget = connectionIds.includes(seg.connectionId);
      seg.set({
        stroke: isTarget && highlight ? this.styles.lineHighlight.stroke : this.styles.line.stroke,
        strokeWidth: isTarget && highlight ? 3 : 2,
      });
    });
    this.canvas.requestRenderAll();
  }

  // Clear all simplified highlights
  clearSimplifiedHighlights() {
    const segments = this.canvas.getObjects().filter((o) => o.isTopoSegment);
    segments.forEach((s) => s.set({ stroke: this.styles.line.stroke, strokeWidth: 2 }));
    this.canvas.requestRenderAll();
  }
}
