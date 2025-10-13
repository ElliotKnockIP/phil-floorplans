// Topology Builder modal logic: builds a separate canvas for arranging topology
// Requires Fabric.js loaded globally and window.topologyManager available

import { getPrintInputs, proceedWithPrint } from "../canvas/canvas-print.js";

export function initTopologyBuilder(mainCanvas) {
  const openBtn = document.getElementById("open-topology-builder-btn");
  const modalEl = document.getElementById("topologyModal");
  const dlBtn = document.getElementById("topology-download");
  const printBtn = document.getElementById("topology-print");
  const addShotBtn = document.getElementById("topology-add-screenshot");
  const autolayoutBtn = document.getElementById("topology-autolayout");
  const wrapper = document.getElementById("topology-canvas-wrapper");
  const canvasEl = document.getElementById("topology-canvas");

  if (!openBtn || !modalEl || !wrapper || !canvasEl) return;

  let modal = null;
  let topoCanvas = null;
  let nodeMap = new Map(); // deviceId -> fabric.Group clone in topo canvas
  let tempConnections = []; // store segments/split points to clean up
  let workingConnections = new Map(); // connectionId -> { device1Id, device2Id, nodes: [] }
  let toModalPoint = (pt) => pt; // currently unused with list layout
  let lastSelectedSegment = null; // { connectionId, segmentIndex }
  let activeHighlight = null; // { type: 'device'|'connection'|'all', id?: string }
  let currentMargins = { SAFE_MARGIN_X: 24, SAFE_MARGIN_TOP: 24, SAFE_MARGIN_BOTTOM: 48 };
  let initialNodePositions = new Map(); // deviceId -> { x, y }
  let initialConnectionNodes = new Map(); // connectionId -> [ {x,y}, ... ]

  const styles = {
    line: { stroke: "#2196F3", strokeWidth: 2 },
    lineHighlight: { stroke: "#FF6B35", strokeWidth: 3 },
    split: { radius: 6, fill: "#FF6B35", stroke: "#fff", strokeWidth: 2 },
    splitHighlight: { radius: 7, fill: "#FFD700" }
  };

  function ensureModal() {
    if (!modal && typeof bootstrap !== "undefined") {
      modal = new bootstrap.Modal(modalEl);
    }
  }

  // Build the topology canvas view
  function buildTopology() {
    // Reset any previous canvas
    if (topoCanvas) {
      try { topoCanvas.dispose(); } catch (_) {}
      topoCanvas = null;
    }

    // Size canvas to wrapper
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    canvasEl.width = w;
    canvasEl.height = h;
    topoCanvas = new fabric.Canvas(canvasEl, { width: w, height: h, backgroundColor: "#ffffff" });

  nodeMap.clear();
  tempConnections.length = 0;
  workingConnections.clear();
  initialNodePositions.clear();
  initialConnectionNodes.clear();

  // Collect devices from main canvas
  const devices = mainCanvas.getObjects().filter(o => o.type === "group" && o.deviceType);

  // Build transform mapping from main canvas device bounds to modal canvas
  const NODE_RADIUS = 18;
  const LABEL_OFFSET = 28;
  const LABEL_HEIGHT = 16;
  const SAFE_MARGIN_X = Math.max(20, NODE_RADIUS + 8);
  const SAFE_MARGIN_TOP = Math.max(20, NODE_RADIUS + 8);
  const SAFE_MARGIN_BOTTOM = Math.max(24, NODE_RADIUS + LABEL_OFFSET + LABEL_HEIGHT + 8);
    currentMargins = { SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM };

    // Compute fit transform to preserve main-canvas layout inside modal
    const bounds = computeDeviceBounds(devices);
    const srcW = Math.max(1, bounds.maxX - bounds.minX);
    const srcH = Math.max(1, bounds.maxY - bounds.minY);
    const dstW = Math.max(1, w - SAFE_MARGIN_X * 2);
    const dstH = Math.max(1, h - SAFE_MARGIN_TOP - SAFE_MARGIN_BOTTOM);
    const fitScale = Math.min(dstW / srcW, dstH / srcH);
    const shrinkFactor = 0.86; // Shrink a bit to add whitespace and nicer style
    const finalScale = fitScale * shrinkFactor;
    const innerW = srcW * finalScale;
    const innerH = srcH * finalScale;
    const offsetX = SAFE_MARGIN_X + (dstW - innerW) / 2;
    const offsetY = SAFE_MARGIN_TOP + (dstH - innerH) / 2;

    toModalPoint = (pt) => ({
      x: offsetX + (pt.x - bounds.minX) * finalScale,
      y: offsetY + (pt.y - bounds.minY) * finalScale,
    });

    // Place clones using transformed original positions
    devices.forEach((dev) => {
      const id = getStableId(dev);
      const c = dev.getCenterPoint ? dev.getCenterPoint() : { x: dev.left, y: dev.top };
      const pos = clampToCanvas(toModalPoint(c), SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM);
      const clone = makeNodeClone(dev, pos.x, pos.y, { SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM });
      topoCanvas.add(clone);
      if (clone.textObject) topoCanvas.add(clone.textObject);
      nodeMap.set(id, clone);
      initialNodePositions.set(id, { x: pos.x, y: pos.y });
    });

  // Pull connections from topologyManager into working state
    const tm = window.topologyManager;
    if (tm) {
      const data = tm.getConnectionsData();
      data.forEach(conn => {
        const id = normalizeId(conn.device1Id, conn.device2Id);
        workingConnections.set(id, {
          id,
          device1Id: conn.device1Id,
          device2Id: conn.device2Id,
          nodes: (conn.splitPoints || []).map(p => {
            const tp = toModalPoint(p);
            return clampToCanvas(tp, SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM);
          })  // Bring existing split points from main canvas, transform and clamp
        });
        // Capture initial split node positions for reset
        const wc = workingConnections.get(id);
        initialConnectionNodes.set(id, (wc.nodes || []).map(n => ({ x: n.x, y: n.y })));
      });
    }

  // Initial render from working state
  renderAllFromWorking();
  enforceZOrder();

    topoCanvas.on("object:moving", () => {
      // Re-render all connections when any node moves
      rerenderAllConnections();
    });

    // Double-click on a segment to add a split point (like main canvas)
    topoCanvas.on('mouse:down', (e) => {
      // Empty-canvas click clears highlights and hides split handles
      if (!e.target) {
        activeHighlight = null;
        topoCanvas.discardActiveObject();
        clearAllSegmentHighlights();
        updateSplitVisibility();
        topoCanvas.requestRenderAll();
        return;
      }
      if (!e.e) return;
      if (e.target._isTopoSegment && e.e.detail === 2) {
        const pointer = topoCanvas.getPointer(e.e);
        const safe = clampToCanvas(pointer, SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM);
        const seg = e.target;
        const idx = typeof seg.segmentIndex === 'number' ? seg.segmentIndex : 0;
        const wc = workingConnections.get(seg.connectionId);
        if (wc) {
          wc.nodes.splice(idx, 0, { x: safe.x, y: safe.y });
          rerenderAllConnections();
          // Keep this connection active so its split handles remain visible
          lastSelectedSegment = { connectionId: seg.connectionId, segmentIndex: idx };
          activeHighlight = { type: 'connection', id: seg.connectionId };
          reapplyActiveSegmentHighlight();
          updateSplitVisibility();
        }
      }
    });

    // Also support Fabric's dblclick event for reliability
    topoCanvas.on('mouse:dblclick', (e) => {
      if (!e.target) return;
      if (e.target._isTopoSegment) {
        const pointer = topoCanvas.getPointer(e.e);
        const safe = clampToCanvas(pointer, SAFE_MARGIN_X, SAFE_MARGIN_TOP, SAFE_MARGIN_BOTTOM);
        const seg = e.target;
        const idx = typeof seg.segmentIndex === 'number' ? seg.segmentIndex : 0;
        const wc = workingConnections.get(seg.connectionId);
        if (wc) {
          wc.nodes.splice(idx, 0, { x: safe.x, y: safe.y });
          rerenderAllConnections();
          // Keep connection highlighted and splits visible
          lastSelectedSegment = { connectionId: seg.connectionId, segmentIndex: idx };
          activeHighlight = { type: 'connection', id: seg.connectionId };
          reapplyActiveSegmentHighlight();
          updateSplitVisibility();
        }
      }
    });

    // Selection: when device is selected/dragging, highlight attached lines; when line is selected, highlight only that line
    const onSelectionChange = (e) => {
      const sel = e && e.selected ? e.selected[0] : topoCanvas.getActiveObject();
      if (sel && sel._isTopoSegment) {
        lastSelectedSegment = { connectionId: sel.connectionId, segmentIndex: sel.segmentIndex };
        activeHighlight = { type: 'connection', id: sel.connectionId };
        applyActiveSegmentHighlight(sel);
        updateSplitVisibility();
      } else if (sel && sel._deviceId) {
        lastSelectedSegment = null;
        activeHighlight = { type: 'device', id: sel._deviceId };
        highlightConnectionsForDevice(sel);
        updateSplitVisibility();
      } else {
        lastSelectedSegment = null;
        clearAllSegmentHighlights();
        activeHighlight = null;
        updateSplitVisibility();
        topoCanvas.requestRenderAll();
      }
    };
    topoCanvas.on('selection:created', onSelectionChange);
    topoCanvas.on('selection:updated', onSelectionChange);
    topoCanvas.on('selection:cleared', () => {
      lastSelectedSegment = null;
      activeHighlight = null;
      clearAllSegmentHighlights();
      updateSplitVisibility();
      topoCanvas.requestRenderAll();
    });
    // While dragging a device, keep its connections highlighted
    topoCanvas.on('object:moving', (e) => {
      const target = e ? e.target : null;
      if (target && target._deviceId) {
        // While dragging a device, show ALL splits and keep this device's connections highlighted
        activeHighlight = { type: 'all' };
        showAllSplits(target);
      }
    });

    // Initialize: hide splits until something is selected
    updateSplitVisibility();
    // Keep hint on top
    setTimeout(() => topoCanvas.requestRenderAll(), 50);
  }

  function rerenderAllConnections() {
    // Remove existing connection visuals
    const toRemove = topoCanvas.getObjects().filter(o => o._isTopoSegment || o._isTopoSplit);
    toRemove.forEach(o => topoCanvas.remove(o));
    tempConnections.length = 0;

    renderAllFromWorking();
    enforceZOrder();
    updateSplitVisibility();
    // Re-apply highlights depending on current selection
    const active = topoCanvas.getActiveObject();
    if (active && active._deviceId) {
      highlightConnectionsForDevice(active);
    } else {
      reapplyActiveSegmentHighlight();
    }
    topoCanvas.requestRenderAll();
  }

  function renderAllFromWorking() {
    workingConnections.forEach((wc) => {
      const n1 = nodeMap.get(wc.device1Id);
      const n2 = nodeMap.get(wc.device2Id);
      if (!n1 || !n2) return;
      const connection = {
        id: wc.id,
        device1: n1,
        device2: n2,
        device1Id: wc.device1Id,
        device2Id: wc.device2Id,
        nodes: wc.nodes
      };
      renderConnectionStandalone(topoCanvas, connection, tempConnections, wc);
    });
  }

  // Keep desired stacking: lines at back, then devices+labels, then split handles on top for easy dragging
  function enforceZOrder() {
    if (!topoCanvas) return;
    const objs = topoCanvas.getObjects();
    const lines = objs.filter(o => o._isTopoSegment);
    const handles = objs.filter(o => o._isTopoSplit);
    const devices = objs.filter(o => o.type === 'group' && o._deviceId);
    const labels = objs.filter(o => o.type === 'text' && o.isDeviceLabel !== true && !o._isTopoSplit && !o._isTopoSegment);

    // Send connection lines to back
    lines.forEach(l => topoCanvas.sendToBack(l));

    // Bring devices and labels above lines
    devices.forEach(d => topoCanvas.bringToFront(d));
    labels.forEach(t => topoCanvas.bringToFront(t));

    // Finally, bring split handles to top for visibility and interaction
    handles.forEach(h => topoCanvas.bringToFront(h));
  }

  function makeNodeClone(device, x, y, margins) {
    const circle = new fabric.Circle({ radius: 18, fill: "#f8794b", originX: "center", originY: "center" });
    const img = getGroupImage(device);
    const groupChildren = [circle];
    if (img) groupChildren.push(img);
    const g = new fabric.Group(groupChildren, {
      left: x,
      top: y,
      originX: "center",
      originY: "center",
      hasControls: false,
      selectable: true,
      hoverCursor: "move",
      _deviceId: getStableId(device)
    });

    // Label clone
    const text = new fabric.Text(getGroupLabel(device) || "Device", {
      fontFamily: "Poppins, sans-serif",
      fontSize: 12,
      fill: "#FFFFFF",
      backgroundColor: "rgba(20,18,18,0.8)",
      originX: "center",
      originY: "top",
      left: x,
      top: y + 28,
      selectable: false,
      _isDeviceLabel: true,
    });
    g.textObject = text;

    g.on("moving", () => {
      // Keep the node within the canvas safe area while dragging
      const clamped = clampToCanvas(g.getCenterPoint(), margins?.SAFE_MARGIN_X || 24, margins?.SAFE_MARGIN_TOP || 24, margins?.SAFE_MARGIN_BOTTOM || 48);
      g.set({ left: clamped.x, top: clamped.y });
      const c = g.getCenterPoint();
      text.set({ left: c.x, top: c.y + 28 });
      text.setCoords();
      // Maintain z-order: device above lines, label above device, handles above all
      g.bringToFront();
      text.bringToFront();
    });
    g.on("removed", () => { if (text) topoCanvas.remove(text); });

    return g;
  }

  function getGroupImage(group) {
    try {
      const childImg = (group._objects || []).find(o => o.type === 'image');
      if (childImg && childImg._element) {
        // Prefer cloning the existing element to preserve icon
        const el = childImg._element.cloneNode(true);
        const img = new fabric.Image(el, { originX: 'center', originY: 'center' });
        // Scale to a reasonable size for topology view
        const target = 24;
        const scaleX = target / img.width;
        const scaleY = target / img.height;
        img.set({ scaleX, scaleY });
        return img;
      }
      // Fallback: rebuild from filename if available
      if (group.deviceType && group.deviceType.endsWith('.png')) {
        const src = `./images/devices/${group.deviceType}`;
        const imgObj = new fabric.Image(document.createElement('img'), { originX: 'center', originY: 'center' });
        imgObj._element.src = src;
        imgObj._element.onload = () => {
          const target = 24;
          const scaleX = target / imgObj._element.naturalWidth;
          const scaleY = target / imgObj._element.naturalHeight;
          imgObj.set({ scaleX, scaleY });
          topoCanvas && topoCanvas.requestRenderAll();
        };
        return imgObj;
      }
    } catch (_) {}
    // Last resort fallback
    const size = 24;
    return new fabric.Rect({ width: size, height: size, fill: "#fff", originX: "center", originY: "center" });
  }

  function getCenter(device) {
    const c = device.getCenterPoint ? device.getCenterPoint() : { x: device.left, y: device.top };
    return { x: c.x, y: c.y };
  }

  function computeDeviceBounds(devices) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    devices.forEach((d) => {
      const c = getCenter(d);
      if (typeof c.x === 'number' && typeof c.y === 'number') {
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x > maxX) maxX = c.x;
        if (c.y > maxY) maxY = c.y;
      }
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      // Fallback bounds to avoid NaN scaling when there are no devices
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }
    return { minX, minY, maxX, maxY };
  }

  function clampToCanvas(point, marginX, marginTop, marginBottom) {
    const w = topoCanvas ? topoCanvas.getWidth() : (wrapper ? wrapper.clientWidth : 0);
    const h = topoCanvas ? topoCanvas.getHeight() : (wrapper ? wrapper.clientHeight : 0);
    const x = Math.max(marginX, Math.min(w - marginX, point.x));
    const y = Math.max(marginTop, Math.min(h - marginBottom, point.y));
    return { x, y };
  }

  function getGroupLabel(group) {
    return group?.textObject?.text || group?.initialLabelText || "";
  }

  function getStableId(group) {
    return group?.id || group?._topologyId || (group.id = `device_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  }

  function gridPos(i, cols, cellW, cellH, w, h) {
    const rows = Math.ceil((i + 1) / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col + 0.5) * cellW;
    const y = (row + 0.5) * cellH + 20;
    return { x: Math.min(x, w - 40), y: Math.min(y, h - 60) };
  }

  // Renders a connection with draggable split points for the standalone canvas
  function renderConnectionStandalone(canvas, connection, registry, workingRef) {
  const getCenter = (dev) => (dev.getCenterPoint ? dev.getCenterPoint() : { x: dev.left, y: dev.top });
  const d1 = getCenter(connection.device1);
  const d2 = getCenter(connection.device2);
    const points = [d1, ...(connection.nodes || []), d2];

    for (let i = 0; i < points.length - 1; i++) {
      const seg = new fabric.Line([points[i].x, points[i].y, points[i+1].x, points[i+1].y], {
        ...styles.line,
        selectable: true,
        hasControls: false,
        hasBorders: false,
        evented: true,
        perPixelTargetFind: true,
        targetFindTolerance: 0,
        _isTopoSegment: true,
        connectionId: connection.id,
        segmentIndex: i,
      });
      canvas.add(seg);
      registry.push(seg);
    }

    const ref = workingRef || getWorkingRef(connection);
    (ref.nodes || []).forEach((node, idx) => {
      const handle = new fabric.Circle({
        left: node.x, top: node.y, originX: "center", originY: "center",
        ...styles.split,
        hasControls: false, hoverCursor: "move", _isTopoSplit: true,
        connectionId: connection.id, nodeIndex: idx
      });
      handle.on("moving", () => {
        const safe = clampToCanvas({ x: handle.left, y: handle.top }, currentMargins.SAFE_MARGIN_X, currentMargins.SAFE_MARGIN_TOP, currentMargins.SAFE_MARGIN_BOTTOM);
        handle.set({ left: safe.x, top: safe.y });
        node.x = safe.x; node.y = safe.y; rerenderAllConnections();
      });
      // Delete key removes split
      handle.on("removed", () => {});
      canvas.add(handle);
      registry.push(handle);
    });
  }

  function clearAllSegmentHighlights() {
    const segs = topoCanvas.getObjects().filter(o => o._isTopoSegment);
    segs.forEach(s => s.set({ ...styles.line }));
  }

  function highlightConnectionsForDevice(deviceGroup) {
    clearAllSegmentHighlights();
    const deviceId = deviceGroup && deviceGroup._deviceId;
    if (!deviceId) return;
    workingConnections.forEach((wc) => {
      if (wc.device1Id === deviceId || wc.device2Id === deviceId) {
        const segs = topoCanvas.getObjects().filter(o => o._isTopoSegment && o.connectionId === wc.id);
        segs.forEach(s => s.set({ ...styles.lineHighlight }));
      }
    });
    topoCanvas.requestRenderAll();
  }

  function applyActiveSegmentHighlight(seg) {
    clearAllSegmentHighlights();
    if (seg && seg._isTopoSegment) {
      seg.set({ ...styles.lineHighlight });
    }
    topoCanvas.requestRenderAll();
  }

  // Update split-handle visibility based on activeHighlight
  function updateSplitVisibility() {
    if (!topoCanvas) return;
    const handles = topoCanvas.getObjects().filter(o => o._isTopoSplit);
    if (!activeHighlight) {
      handles.forEach(h => h.set({ visible: false, ...styles.split }));
      return;
    }
    if (activeHighlight.type === 'all') {
      handles.forEach(h => h.set({ visible: true, ...styles.split }));
      return;
    }
    if (activeHighlight.type === 'connection') {
      handles.forEach(h => h.set({ visible: h.connectionId === activeHighlight.id, ...styles.split }));
      return;
    }
    if (activeHighlight.type === 'device') {
      const did = activeHighlight.id;
      handles.forEach(h => {
        const wc = workingConnections.get(h.connectionId);
        const vis = !!wc && (wc.device1Id === did || wc.device2Id === did);
        h.set({ visible: vis, ...styles.split });
      });
      return;
    }
    // Fallback
    handles.forEach(h => h.set({ visible: false, ...styles.split }));
  }

  // Show all split handles; optionally highlight the dragged device's connections
  function showAllSplits(draggedDeviceGroup = null) {
    if (!topoCanvas) return;
    const handles = topoCanvas.getObjects().filter(o => o._isTopoSplit);
    handles.forEach(h => h.set({ visible: true, ...styles.split }));
    clearAllSegmentHighlights();
    if (draggedDeviceGroup && draggedDeviceGroup._deviceId) {
      highlightConnectionsForDevice(draggedDeviceGroup);
    }
    topoCanvas.requestRenderAll();
  }

  function reapplyActiveSegmentHighlight() {
    if (!lastSelectedSegment) return;
    const seg = topoCanvas.getObjects().find(o => o._isTopoSegment && o.connectionId === lastSelectedSegment.connectionId && o.segmentIndex === lastSelectedSegment.segmentIndex);
    applyActiveSegmentHighlight(seg);
  }

  function getWorkingRef(connection) {
    const id = normalizeId(connection.device1Id, connection.device2Id);
    return workingConnections.get(id);
  }

  function normalizeId(d1, d2) {
    return d1 < d2 ? `${d1}_${d2}` : `${d2}_${d1}`;
  }

  // Export helpers
  function toPngDataUrl(multiplier = 2) {
    topoCanvas.discardActiveObject();
    topoCanvas.requestRenderAll();
    return topoCanvas.toDataURL({ format: "png", multiplier, quality: 1.0 });
  }

  // Wire up buttons
  openBtn.addEventListener("click", () => {
    ensureModal();
    if (!modal) return;
    modal.show();
    setTimeout(buildTopology, 200);
  });

  autolayoutBtn?.addEventListener("click", () => {
    // Restore nodes and split points to initial modal positions
    if (!topoCanvas) return;
    // Restore node positions
    nodeMap.forEach((node, id) => {
      const init = initialNodePositions.get(id);
      if (!init) return;
      node.set({ left: init.x, top: init.y });
      if (node.textObject) {
        node.textObject.set({ left: init.x, top: init.y + 28 });
        node.textObject.setCoords();
      }
      node.setCoords();
    });
    // Restore split nodes
    workingConnections.forEach((wc, cid) => {
      const initNodes = initialConnectionNodes.get(cid);
      if (initNodes) {
        wc.nodes = initNodes.map(n => ({ x: n.x, y: n.y }));
      }
    });
    rerenderAllConnections();
    enforceZOrder();
  });


  dlBtn?.addEventListener("click", () => {
    if (!topoCanvas) return;
    const url = toPngDataUrl(3);
    const a = document.createElement("a");
    a.href = url; a.download = "topology-map.png"; a.click();
  });

  addShotBtn?.addEventListener("click", () => {
    if (!topoCanvas) return;
    const url = toPngDataUrl(3);
    // Reuse screenshot UI list
    const screenshot = { dataURL: url, includeInPrint: false, id: Date.now() + Math.random(), title: "Topology Map" };
    try {
      // Try to add via crop module's preview creation if available
      if (window.canvasCrop && typeof window.canvasCrop.getScreenshots === "function") {
        const shots = window.canvasCrop.getScreenshots();
        shots.push(screenshot);
        // Manually build preview UI
        const previews = document.getElementById("screenshot-previews");
        if (previews) {
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
          // Wire delete and checkbox
          const checkbox = item.querySelector(".screenshot-checkbox");
          if (checkbox) checkbox.addEventListener("change", () => { screenshot.includeInPrint = checkbox.checked; });
          const del = item.querySelector(".screenshot-delete-btn");
          if (del) del.addEventListener("click", () => {
            const list = window.canvasCrop.getScreenshots();
            const i = list.indexOf(screenshot); if (i > -1) list.splice(i, 1);
            item.remove();
            if (window.updateScreenshotStatus) window.updateScreenshotStatus();
          });
          previews.appendChild(item);
          if (window.updateScreenshotStatus) window.updateScreenshotStatus();
        }
      } else {
        // Fallback collection
        window.loadedScreenshots = window.loadedScreenshots || [];
        window.loadedScreenshots.push(screenshot);
        if (window.updateScreenshotStatus) window.updateScreenshotStatus();
      }
    } catch (e) {
      console.warn("Could not add screenshot to list", e);
    }
  });

  printBtn?.addEventListener("click", () => {
    if (!topoCanvas) return;
    const url = toPngDataUrl(3);
    // Create a temporary screenshot that is included in print
    const screenshot = { dataURL: url, includeInPrint: true, id: Date.now(), title: "Topology Map" };

    const canvasContainer = document.querySelector(".canvas-container");
    const subSidebar = document.getElementById("sub-sidebar");

    // Use existing print flow with this single image
    proceedWithPrint(canvasContainer, subSidebar, mainCanvas, getPrintInputs(), [screenshot]);
  });

  // Resize handling on modal shown
  modalEl.addEventListener("shown.bs.modal", () => {
    if (topoCanvas) {
      const w = wrapper.clientWidth; const h = wrapper.clientHeight;
      topoCanvas.setDimensions({ width: w, height: h });
      topoCanvas.calcOffset();
      topoCanvas.requestRenderAll();
    }
  });

  // Keyboard delete to remove selected split points
  document.addEventListener("keydown", (e) => {
    if (!topoCanvas || (e.key !== "Delete" && e.key !== "Backspace")) return;
    const obj = topoCanvas.getActiveObject();
    if (obj && obj._isTopoSplit) {
      // Update working state
      const wc = workingConnections.get(obj.connectionId);
      if (!wc) return;
      if (Array.isArray(wc.nodes) && typeof obj.nodeIndex === "number") {
        wc.nodes.splice(obj.nodeIndex, 1);
      }
      rerenderAllConnections();
    }
  });

  return { rebuild: buildTopology };
}
