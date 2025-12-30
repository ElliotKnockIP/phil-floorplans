// Context Menu - Handles right-click context menu for canvas objects
import { handleObjectDeletion } from "../../drawing/drawing-utils.js";
import { isCameraType } from "../../devices/categories/device-types.js";
import {
  attachLabelBehavior,
  getNextAvailableDeviceNumber,
} from "../../devices/device-label-utils.js";
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

  createMenu() {
    // Create context menu
    this.menu = document.createElement("div");
    this.menu.id = "fabric-context-menu";
    Object.assign(this.menu.style, {
      position: "fixed",
      background: "#e0e0e0",
      color: "#000",
      border: "1px solid rgba(0,0,0,0.2)",
      borderRadius: "6px",
      padding: "6px",
      display: "none",
      zIndex: 3000,
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    });

    const btnStyle =
      "display:block;padding:6px 10px;cursor:pointer;border-radius:4px;margin:2px 0;text-align:left;background:transparent;color:inherit;font-size:13px;border:none;";

    // Create buttons
    this.copyBtn = document.createElement("button");
    this.copyBtn.innerText = "Clone";
    this.copyBtn.setAttribute("style", btnStyle);

    this.deleteBtn = document.createElement("button");
    this.deleteBtn.innerText = "Delete";
    this.deleteBtn.setAttribute("style", btnStyle + "color:#ff6b6b;");

    this.splitBtn = document.createElement("button");
    this.splitBtn.innerText = "Split Connection";
    this.splitBtn.setAttribute("style", btnStyle);

    this.addTextBtn = document.createElement("button");
    this.addTextBtn.innerText = "Add Text";
    this.addTextBtn.setAttribute("style", btnStyle);

    this.menu.appendChild(this.copyBtn);
    this.menu.appendChild(this.splitBtn);
    this.menu.appendChild(this.addTextBtn);
    this.menu.appendChild(this.deleteBtn);
    document.body.appendChild(this.menu);

    // Add hover effects
    this.addHoverEffect(this.copyBtn);
    this.addHoverEffect(this.splitBtn);
    this.addHoverEffect(this.addTextBtn);
    this.addHoverEffect(this.deleteBtn, "#ff6b6b");
  }

  addHoverEffect(btn, defaultColor = "inherit") {
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#f8794b";
      btn.style.color = "white";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
      btn.style.color = defaultColor;
    });
  }

  hideMenu() {
    this.menu.style.display = "none";
    this.currentTarget = null;
  }

  showMenuForTarget(target, x, y) {
    if (!target) return;

    // Show/hide buttons based on target type
    if (target.type === "group" && target.deviceType && target.deviceType !== "title-block") {
      this.copyBtn.style.display = "block";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
    } else if (
      target.type === "line" &&
      (target.isNetworkConnection || target.isConnectionSegment)
    ) {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "block";
      this.addTextBtn.style.display = "block";
    } else {
      this.copyBtn.style.display = "none";
      this.splitBtn.style.display = "none";
      this.addTextBtn.style.display = "none";
    }

    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.display = "block";
  }

  deleteObject(target) {
    if (!target) return;

    // Use centralized deletion handler if available
    if (typeof handleObjectDeletion === "function") {
      try {
        const handled = handleObjectDeletion(this.fabricCanvas, target);
        if (handled) return;
      } catch (e) {
        // fall back to built-in behaviour
      }
    }

    // Device groups
    if (target.type === "group" && target.deviceType) {
      if (target.textObject) this.fabricCanvas.remove(target.textObject);
      if (target.coverageArea) this.fabricCanvas.remove(target.coverageArea);
      this.fabricCanvas.remove(target);
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Zone or room polygons
    if (
      target.type === "polygon" &&
      (target.class === "zone-polygon" || target.class === "room-polygon")
    ) {
      if (target.class === "zone-polygon" && window.deleteZone) {
        window.deleteZone(target);
        return;
      }
      if (target.class === "room-polygon" && window.deleteRoom) {
        window.deleteRoom(target);
        return;
      }

      // Fallback
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

    // IText (zone/room text)
    if (
      target.type === "i-text" &&
      (target.class === "zone-text" || target.class === "room-text")
    ) {
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

    // Network connections
    if (target.type === "line" && target.isNetworkConnection) {
      if (target.connectionLabel) this.fabricCanvas.remove(target.connectionLabel);
      this.fabricCanvas.remove(target);
      this.fabricCanvas.requestRenderAll();
      return;
    }

    // Connection segments
    if (target.type === "line" && target.isConnectionSegment) {
      if (
        window.topologyManager &&
        typeof window.topologyManager.splitConnectionAtSegment === "function"
      ) {
        window.topologyManager.splitConnectionAtSegment(target);
      }
      return;
    }

    // Default deletion
    this.fabricCanvas.remove(target);
    this.fabricCanvas.requestRenderAll();
  }

  cloneObject(target) {
    if (
      !target ||
      target.type !== "group" ||
      !target.deviceType ||
      target.deviceType === "title-block"
    )
      return;

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

        // Preserve and copy key props
        cloned.deviceType = target.deviceType;
        cloned.coverageConfig = target.coverageConfig
          ? JSON.parse(JSON.stringify(target.coverageConfig))
          : null;
        cloned.labelHidden = target.labelHidden !== undefined ? target.labelHidden : undefined;
        cloned.borderColor = target.borderColor || "#000000";
        cloned.borderScaleFactor = target.borderScaleFactor || 2;
        cloned.scaleFactor = target.scaleFactor || 1;
        cloned.initialLabelText = labelText;
        cloned.hoverCursor = target.hoverCursor;
        cloned.deviceNumber = nextNumber;

        // Copy metadata fields commonly used elsewhere
        [
          "location",
          "mountedPosition",
          "partNumber",
          "stockNumber",
          "ipAddress",
          "subnetMask",
          "gatewayAddress",
          "macAddress",
          "focalLength",
          "sensorSize",
          "resolution",
        ].forEach((prop) => {
          cloned[prop] = target[prop] || "";
        });

        if (!cloned.id) {
          cloned.id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        this.fabricCanvas.add(cloned);

        // Clone the label (if any)
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

        cloned.on("removed", () => {
          if (cloned.textObject) this.fabricCanvas.remove(cloned.textObject);
          if (cloned.coverageArea) this.fabricCanvas.remove(cloned.coverageArea);
          if (cloned.leftResizeIcon) this.fabricCanvas.remove(cloned.leftResizeIcon);
          if (cloned.rightResizeIcon) this.fabricCanvas.remove(cloned.rightResizeIcon);
          if (cloned.rotateResizeIcon) this.fabricCanvas.remove(cloned.rotateResizeIcon);
        });

        // Add camera coverage if needed
        if (isCamera && typeof addCameraCoverage === "function") {
          addCameraCoverage(this.fabricCanvas, cloned);
        }

        // Bring to front and select
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

  addTextToConnection(target) {
    if (
      !target ||
      target.type !== "line" ||
      (!target.isNetworkConnection && !target.isConnectionSegment)
    )
      return;

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

    const created = this.fabricCanvas
      .getObjects()
      .find(
        (o) => o.isConnectionCustomLabel && o.customTextId === id && o.connectionId === conn.id
      );

    if (created && typeof created.enterEditing === "function") {
      created.enterEditing();
      created.selectAll();
    }
  }

  setupEventHandlers() {
    // Prevent default browser context menu on the canvas element
    this.canvasEl.addEventListener("contextmenu", (evt) => evt.preventDefault());

    // Right-click handler
    this.fabricCanvas.on("mouse:down", (e) => {
      if (e.e.button === 2) {
        // Right click
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

    // Hide menu on canvas click
    this.fabricCanvas.on("mouse:down", (e) => {
      if (e.e.button !== 2) {
        // Not right click
        this.hideMenu();
      }
    });

    // Hide menu on selection cleared
    this.fabricCanvas.on("selection:cleared", () => this.hideMenu());

    // Button event handlers
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

    this.deleteBtn.addEventListener("click", () => {
      if (!this.currentTarget) return;
      this.deleteObject(this.currentTarget);
      this.hideMenu();
    });

    // Expose helpers for other modules
    window._fabricContextMenu = {
      showMenu: (t, x, y) => {
        this.currentTarget = t;
        this.showMenuForTarget(t, x, y);
      },
      hideMenu: () => this.hideMenu(),
    };
  }
}
