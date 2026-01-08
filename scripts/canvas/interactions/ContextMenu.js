// Handles right-click context menu for canvas objects
import { handleObjectDeletion } from "../../drawing/drawing-utils.js";
import { isCameraType } from "../../devices/categories/device-types.js";
import { attachLabelBehavior, getNextAvailableDeviceNumber } from "../../devices/device-label-utils.js";
import { ratioOnPath } from "../../network/network-utils.js";

export class ContextMenu {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.canvasEl = fabricCanvas.getElement();
    this.container = this.canvasEl.parentElement || document.body;
    this.currentTarget = null;

    this.createMenu();
    this.setupEventHandlers();
  }

  // Create the context menu DOM elements and styling
  createMenu() {
    this.menu = document.createElement("div");
    this.menu.id = "fabric-context-menu";
    this.menu.className = "fabric-context-menu";

    // Initialize menu buttons
    this.copyBtn = document.createElement("button");
    this.copyBtn.innerText = "Clone";
    this.copyBtn.className = "context-menu-button";

    this.deleteBtn = document.createElement("button");
    this.deleteBtn.innerText = "Delete";
    this.deleteBtn.className = "context-menu-button delete";

    this.splitBtn = document.createElement("button");
    this.splitBtn.innerText = "Split Connection";
    this.splitBtn.className = "context-menu-button";

    this.addTextBtn = document.createElement("button");
    this.addTextBtn.innerText = "Add Text";
    this.addTextBtn.className = "context-menu-button";

    this.addControlPointBtn = document.createElement("button");
    this.addControlPointBtn.innerText = "Add Control Point";
    this.addControlPointBtn.className = "context-menu-button";

    this.deleteControlPointBtn = document.createElement("button");
    this.deleteControlPointBtn.innerText = "Delete Control Point";
    this.deleteControlPointBtn.className = "context-menu-button delete";

    this.menu.appendChild(this.copyBtn);
    this.menu.appendChild(this.splitBtn);
    this.menu.appendChild(this.addTextBtn);
    this.menu.appendChild(this.addControlPointBtn);
    this.menu.appendChild(this.deleteControlPointBtn);
    this.menu.appendChild(this.deleteBtn);
    document.body.appendChild(this.menu);
  }

  // Hide the context menu
  hideMenu() {
    this.menu.style.display = "none";
    this.currentTarget = null;
  }

  // Check if target is an editable polygon type
  isEditablePolygon(target) {
    if (target?.type !== "polygon") return false;
    const editableClasses = ["zone-polygon", "room-polygon", "risk-polygon", "safety-polygon"];
    return editableClasses.includes(target.class);
  }

  // Check if target is a polygon control point
  isPolygonControlPoint(target) {
    return target?.type === "circle" && target?.data?.polygon && target?.data?.index !== undefined;
  }

  // Show the context menu at specific coordinates for a target object
  showMenuForTarget(target, x, y) {
    if (!target) return;

    // Toggle button visibility based on the type of object clicked
    if (target.type === "group" && target.deviceType && target.deviceType !== "title-block") {
      this.copyBtn.style.display = "block";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
      this.addControlPointBtn.style.display = "none";
      this.deleteControlPointBtn.style.display = "none";
    } else if (target.type === "line" && (target.isNetworkConnection || target.isConnectionSegment)) {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "block";
      this.addTextBtn.style.display = "block";
      this.addControlPointBtn.style.display = "none";
      this.deleteControlPointBtn.style.display = "none";
    } else if (this.isEditablePolygon(target)) {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
      this.addControlPointBtn.style.display = target.editControlPoints ? "block" : "none";
      this.deleteControlPointBtn.style.display = "none";
    } else if (this.isPolygonControlPoint(target)) {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
      this.addControlPointBtn.style.display = "none";
      this.deleteControlPointBtn.style.display = "block";
    } else {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
      this.addControlPointBtn.style.display = "none";
      this.deleteControlPointBtn.style.display = "none";
    }

    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.display = "block";
  }

  // Handle deletion of various canvas object types
  deleteObject(target) {
    if (!target) return;

    // Use centralized deletion logic if available
    if (typeof handleObjectDeletion === "function") {
      try {
        const handled = handleObjectDeletion(this.fabricCanvas, target);
        if (handled) return;
      } catch (e) {
        // Fallback to manual deletion if handler fails
      }
    }

    // Delete device groups and their associated UI elements
    if (target.type === "group" && target.deviceType) {
      if (target.textObject) this.fabricCanvas.remove(target.textObject);
      if (target.coverageArea) this.fabricCanvas.remove(target.coverageArea);
      this.fabricCanvas.remove(target);
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Delete zone or room polygons and update global state
    if (target.type === "polygon" && (target.class === "zone-polygon" || target.class === "room-polygon")) {
      if (target.class === "zone-polygon" && window.deleteZone) {
        window.deleteZone(target);
        return;
      }
      if (target.class === "room-polygon" && window.deleteRoom) {
        window.deleteRoom(target);
        return;
      }

      if (target.associatedText) this.fabricCanvas.remove(target.associatedText);
      this.fabricCanvas.remove(target);
      try {
        if (target.class === "zone-polygon" && Array.isArray(window.zones)) {
          window.zones = window.zones.filter((z) => z.polygon !== target);
        }
        if (target.class === "room-polygon" && Array.isArray(window.rooms)) {
          window.rooms = window.rooms.filter((r) => r.polygon !== target);
        }
        document.dispatchEvent(new Event("layers:items-changed"));
      } catch (e) {}
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Delete text labels associated with zones or rooms
    if (target.type === "i-text" && (target.class === "zone-text" || target.class === "room-text")) {
      if (target.associatedPolygon) {
        this.fabricCanvas.remove(target.associatedPolygon);
        try {
          if (target.class === "zone-text" && Array.isArray(window.zones)) {
            window.zones = window.zones.filter((z) => z.text !== target);
          }
          if (target.class === "room-text" && Array.isArray(window.rooms)) {
            window.rooms = window.rooms.filter((r) => r.text !== target);
          }
          document.dispatchEvent(new Event("layers:items-changed"));
        } catch (e) {}
      }
      this.fabricCanvas.remove(target);
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Delete network connection lines
    if (target.type === "line" && target.isNetworkConnection) {
      if (target.connectionLabel) this.fabricCanvas.remove(target.connectionLabel);
      this.fabricCanvas.remove(target);
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Split connection at segment before deletion
    if (target.type === "line" && target.isConnectionSegment) {
      if (window.topologyManager && typeof window.topologyManager.splitConnectionAtSegment === "function") {
        window.topologyManager.splitConnectionAtSegment(target);
      }
      return;
    }

    // Default object removal
    this.fabricCanvas.remove(target);
    this.fabricCanvas.requestRenderAll();
  }

  // Create a copy of a device group with a new label and number
  cloneObject(target) {
    if (!target || target.type !== "group" || !target.deviceType || target.deviceType === "title-block") return;

    try {
      const isCamera = isCameraType(target.deviceType);
      const nextNumber = getNextAvailableDeviceNumber(this.fabricCanvas, isCamera);
      const labelText = isCamera ? `Camera ${nextNumber}` : `Device ${nextNumber}`;

      target.clone((cloned) => {
        const selectable = typeof target.selectable !== "undefined" ? target.selectable : true;
        const evented = typeof target.evented !== "undefined" ? target.evented : true;

        cloned.set({
          left: (target.left || 0) + 20,
          top: (target.top || 0) + 20,
          selectable,
          hasControls: false,
          hasBorders: true,
          evented,
          originX: target.originX || "center",
          originY: target.originY || "center",
        });

        // Copy device-specific properties and metadata
        cloned.deviceType = target.deviceType;
        cloned.coverageConfig = target.coverageConfig ? JSON.parse(JSON.stringify(target.coverageConfig)) : null;
        cloned.labelHidden = target.labelHidden !== undefined ? target.labelHidden : undefined;
        cloned.borderColor = target.borderColor || "#000000";
        cloned.borderScaleFactor = target.borderScaleFactor || 2;
        cloned.scaleFactor = target.scaleFactor || 1;
        cloned.initialLabelText = labelText;
        cloned.hoverCursor = target.hoverCursor;
        cloned.deviceNumber = nextNumber;

        const deviceProps = ["location", "mountedPosition", "partNumber", "stockNumber", "ipAddress", "subnetMask", "gatewayAddress", "macAddress", "focalLength", "sensorSize", "resolution"];

        deviceProps.forEach((prop) => {
          cloned[prop] = target[prop] || "";
        });

        if (!cloned.id) {
          cloned.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        this.fabricCanvas.add(cloned);

        // Clone and update the device label
        if (target.textObject) {
          const textClone = fabric.util.object.clone(target.textObject);
          const dx = (target.textObject.left || 0) - (target.left || 0);
          const dy = (target.textObject.top || 0) - (target.top || 0);

          textClone.set({
            text: labelText,
            deviceNumber: nextNumber,
            left: (cloned.left || 0) + dx,
            top: (cloned.top || 0) + dy,
            selectable: false,
            evented: false,
            isDeviceLabel: true,
          });

          textClone.deviceType = target.deviceType;
          textClone.deviceNumber = nextNumber;

          this.fabricCanvas.add(textClone);
          cloned.textObject = textClone;

          if (typeof attachLabelBehavior === "function") {
            attachLabelBehavior(cloned, textClone, this.fabricCanvas);
          }
        }

        // Ensure cleanup of associated objects when cloned device is removed
        cloned.on("removed", () => {
          if (cloned.textObject) this.fabricCanvas.remove(cloned.textObject);
          if (cloned.coverageArea) this.fabricCanvas.remove(cloned.coverageArea);
          if (cloned.leftResizeIcon) this.fabricCanvas.remove(cloned.leftResizeIcon);
          if (cloned.rightResizeIcon) this.fabricCanvas.remove(cloned.rightResizeIcon);
          if (cloned.rotateResizeIcon) this.fabricCanvas.remove(cloned.rotateResizeIcon);
        });

        // Add camera coverage visualization if applicable
        if (isCamera && typeof addCameraCoverage === "function") {
          addCameraCoverage(this.fabricCanvas, cloned);
        }

        cloned.bringToFront();
        if (cloned.textObject && cloned.textObject.visible !== false) {
          cloned.textObject.bringToFront();
        }

        this.fabricCanvas.setActiveObject(cloned);
        this.fabricCanvas.requestRenderAll();
      });
    } catch (error) {
      console.error("Error cloning object:", error);
    }
  }

  // Split a network connection at the clicked point
  splitConnection(target) {
    if (!target || target.type !== "line" || !target.isConnectionSegment) return;
    const manager = window.topologyManager;
    if (!manager || typeof manager.splitConnection !== "function") return;

    let pointer = target.getCenterPoint();
    if (window.lastContextMenuEvent) {
      pointer = this.fabricCanvas.getPointer(window.lastContextMenuEvent);
    }

    manager.splitConnection(target, pointer);
  }

  // Add a custom text label to a network connection
  addTextToConnection(target) {
    if (!target || target.type !== "line" || (!target.isNetworkConnection && !target.isConnectionSegment)) return;

    const manager = window.topologyManager;
    if (!manager || !target.connectionId) return;

    const conn = manager.connections?.get(target.connectionId);
    if (!conn) return;

    const initialText = conn.properties.label || "";
    const newText = window.prompt("Enter connection label:", initialText || "Text");
    if (newText === null) return;

    const path = conn.getPath((d) => manager.getDeviceCenter(d));
    let pointer = target.getCenterPoint();
    if (window.lastContextMenuEvent) {
      pointer = this.fabricCanvas.getPointer(window.lastContextMenuEvent);
    }
    const ratio = ratioOnPath(path, pointer) || 0.5;
    const id = `txt_${Date.now()}`;

    conn.properties.customTextLabels = conn.properties.customTextLabels || [];
    conn.properties.customTextLabels.push({ id, text: newText, pathRatio: ratio });

    manager.renderConnection(conn);

    const created = this.fabricCanvas.getObjects().find((o) => {
      return o.isConnectionCustomLabel && o.customTextId === id && o.connectionId === conn.id;
    });

    if (created && typeof created.enterEditing === "function") {
      created.enterEditing();
      created.selectAll();
    }
  }

  // Setup event listeners for right-click and menu interactions
  setupEventHandlers() {
    this.canvasEl.addEventListener("contextmenu", (evt) => evt.preventDefault());

    // Handle right-click on canvas to show menu
    this.fabricCanvas.on("mouse:down", (e) => {
      if (e.e.button === 2) {
        e.e.preventDefault();
        e.e.stopPropagation();

        window.lastContextMenuEvent = e.e;

        const { clientX, clientY } = e.e;
        const target = this.fabricCanvas.findTarget(e.e);

        if (target) {
          this.currentTarget = target;
          this.showMenuForTarget(target, clientX + 10, clientY + 10);
        }
      }
    });

    // Hide menu on left-click or selection clear
    this.fabricCanvas.on("mouse:down", (e) => {
      if (e.e.button !== 2) {
        this.hideMenu();
      }
    });

    this.fabricCanvas.on("selection:cleared", () => this.hideMenu());

    // Setup button click handlers
    this.copyBtn.addEventListener("click", () => {
      if (!this.currentTarget) return;
      this.cloneObject(this.currentTarget);
      this.hideMenu();
    });

    this.splitBtn.addEventListener("click", () => {
      if (!this.currentTarget) return;
      this.splitConnection(this.currentTarget);
      this.hideMenu();
    });

    this.addTextBtn.addEventListener("click", () => {
      if (!this.currentTarget) return;
      this.addTextToConnection(this.currentTarget);
      this.hideMenu();
    });

    this.addControlPointBtn.addEventListener("click", () => {
      if (!this.currentTarget || !this.isEditablePolygon(this.currentTarget)) return;
      this.addControlPointToPolygon(this.currentTarget);
      this.hideMenu();
    });

    this.deleteControlPointBtn.addEventListener("click", () => {
      if (!this.currentTarget || !this.isPolygonControlPoint(this.currentTarget)) return;
      this.deleteControlPointFromPolygon(this.currentTarget);
      this.hideMenu();
    });
    this.deleteControlPointBtn.addEventListener("click", () => {
      if (!this.currentTarget || !this.isPolygonControlPoint(this.currentTarget)) return;
      this.deleteControlPointFromPolygon(this.currentTarget);
      this.hideMenu();
    });
    this.deleteBtn.addEventListener("click", () => {
      if (!this.currentTarget) return;
      this.deleteObject(this.currentTarget);
      this.hideMenu();
    });

    // Expose context menu globally
    window.fabricContextMenu = {
      showMenu: (t, x, y) => {
        this.currentTarget = t;
        this.showMenuForTarget(t, x, y);
      },
      hideMenu: () => this.hideMenu(),
    };
  }

  // Adds a control point to a polygon at the right-click location
  addControlPointToPolygon(target) {
    if (!target || !this.isEditablePolygon(target)) return;
    if (!target.editControlPoints) return; // Polygon must be in edit mode

    let pointer = target.getCenterPoint();
    if (window.lastContextMenuEvent) {
      pointer = this.fabricCanvas.getPointer(window.lastContextMenuEvent);
    }

    if (typeof window.addPolygonControlPoint === "function") {
      window.addPolygonControlPoint(this.fabricCanvas, target, pointer);
    }
  }

  // Deletes a control point from a polygon
  deleteControlPointFromPolygon(controlPoint) {
    if (!controlPoint || !this.isPolygonControlPoint(controlPoint)) return;

    const polygon = controlPoint.data.polygon;
    const index = controlPoint.data.index;

    if (!polygon || index === undefined) return;

    // Ensure polygon has at least 3 points after deletion
    if (polygon.points && polygon.points.length <= 3) {
      return;
    }

    if (typeof window.removePolygonControlPoint === "function") {
      window.removePolygonControlPoint(this.fabricCanvas, polygon, index);
    }
  }
}
