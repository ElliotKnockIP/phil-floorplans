// NetworkLink class handles network connections between devices
import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

export class NetworkLink {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.sourceDevice = null;
    this.sourceDeviceId = null;
    this.tempConnectionLine = null;
    this.isConnecting = false;
    this.isActiveConnecting = false;
    this.createCooldown = false;
    this.restrictionTimeout = null;

    this.init();
  }

  // Initialize the network link tool with event listeners
  init() {
    const networkLinkBtn = document.getElementById("network-link-btn");

    if (!window.__networkLinkRestrictionListener) {
      window.__networkLinkRestrictionListener = (event) => {
        const message = event?.detail?.message;
        this.showRestrictionWarning(message);
      };
      document.addEventListener(
        "topology:connection-blocked",
        window.__networkLinkRestrictionListener
      );
    }

    if (networkLinkBtn) {
      networkLinkBtn.addEventListener("click", () => {
        closeSidebar();
        this.cleanupTempObjects();
        registerToolCleanup(() => this.cleanupTempObjects());
        startTool(
          this.fabricCanvas,
          "network-link",
          (e) => this.handleNetworkLinkClick(e),
          (e) => this.handleNetworkLinkMove(e),
          (e) => this.handleNetworkLinkKey(e)
        );
      });
    }

    window.cleanupNetworkLinkTempObjects = () => this.cleanupTempObjects();
  }

  // Clean up temporary connection objects and reset state
  cleanupTempObjects() {
    if (this.tempConnectionLine) {
      this.fabricCanvas.remove(this.tempConnectionLine);
      this.tempConnectionLine = null;
    }
    if (this.restrictionTimeout) {
      clearTimeout(this.restrictionTimeout);
      this.restrictionTimeout = null;
    }
    this.sourceDevice = null;
    this.sourceDeviceId = null;
    this.isConnecting = false;
    this.isActiveConnecting = false;
    this.fabricCanvas.defaultCursor = "default";
    this.fabricCanvas.hoverCursor = "move";
    this.hideConnectionInstruction();
    this.fabricCanvas.requestRenderAll();
  }

  // Handle click events for network link creation
  handleNetworkLinkClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = this.fabricCanvas.getPointer(e.e);
    let target = this.fabricCanvas.findTarget(e.e);

    if (target && (target.isConnectionSegment || target.isNetworkSplitPoint)) {
      target = this.findDeviceAtPoint(pointer);
    }

    if (!target || target.type !== "group" || !target.deviceType) {
      target = this.findDeviceAtPoint(pointer);
    }

    if (!target || target.type !== "group" || !target.deviceType) {
      return;
    }

    if (!this.isConnecting) {
      this.sourceDevice = target;
      this.sourceDeviceId = this.getDeviceId(target);
      this.isConnecting = true;
      this.isActiveConnecting = true;

      this.fabricCanvas.defaultCursor = "crosshair";
      this.fabricCanvas.hoverCursor = "crosshair";

      this.showConnectionInstruction();
    } else {
      const targetDeviceId = this.getDeviceId(target);
      if (targetDeviceId && targetDeviceId === this.sourceDeviceId) {
        this.sourceDevice = target;
        if (this.tempConnectionLine) {
          this.fabricCanvas.remove(this.tempConnectionLine);
          this.tempConnectionLine = null;
        }
        this.isActiveConnecting = true;
        this.createCooldown = false;
        this.fabricCanvas.defaultCursor = "crosshair";
        this.fabricCanvas.hoverCursor = "crosshair";
        this.showConnectionInstruction();
        return;
      }

      if (!this.isActiveConnecting && targetDeviceId !== this.sourceDeviceId) {
        this.sourceDevice = target;
        this.sourceDeviceId = targetDeviceId;
        this.isActiveConnecting = true;
        this.createCooldown = false;
        this.fabricCanvas.defaultCursor = "crosshair";
        this.fabricCanvas.hoverCursor = "crosshair";
        this.showConnectionInstruction();
        return;
      }

      let connectionCreated = false;
      if (window.topologyManager && !this.createCooldown) {
        const created = window.topologyManager.createConnection(this.sourceDevice, target);
        if (created) {
          connectionCreated = true;
          this.createCooldown = true;
          setTimeout(() => (this.createCooldown = false), 300);
        }
      }

      if (this.tempConnectionLine) {
        this.fabricCanvas.remove(this.tempConnectionLine);
        this.tempConnectionLine = null;
      }

      if (connectionCreated) {
        this.isActiveConnecting = false;
        this.fabricCanvas.defaultCursor = "default";
        this.fabricCanvas.hoverCursor = "move";

        this.updateConnectionInstruction();
      }
    }
  }

  // Handle mouse move events to draw temporary connection lines
  handleNetworkLinkMove(e) {
    if (!this.isConnecting || !this.isActiveConnecting || !this.sourceDevice) return;

    const pointer = this.fabricCanvas.getPointer(e.e);
    const sourceCenter = this.getDeviceCenter(this.sourceDevice);

    if (this.tempConnectionLine) {
      this.fabricCanvas.remove(this.tempConnectionLine);
    }

    this.tempConnectionLine = new fabric.Line(
      [sourceCenter.x, sourceCenter.y, pointer.x, pointer.y],
      {
        stroke: "#2196F3",
        strokeWidth: 2,
        selectable: false,
        evented: false,
        opacity: 0.7,
      }
    );

    this.fabricCanvas.add(this.tempConnectionLine);
    this.fabricCanvas.requestRenderAll();
  }

  // Handle key events for network link tool
  handleNetworkLinkKey(e) {
    if (e.key === "Escape") {
      this.cleanupTempObjects();
      stopCurrentTool();
    }
  }

  // Get the center point of a device
  getDeviceCenter(device) {
    const center = device.getCenterPoint
      ? device.getCenterPoint()
      : {
          x: device.left,
          y: device.top,
        };

    return {
      x: center.x,
      y: center.y,
    };
  }

  // Find a device at the given pointer position
  findDeviceAtPoint(pointer) {
    const devices = this.fabricCanvas
      .getObjects()
      .filter((obj) => obj.type === "group" && obj.deviceType);

    for (const device of devices) {
      try {
        const bounds = device.getBoundingRect();
        if (
          pointer.x >= bounds.left &&
          pointer.x <= bounds.left + bounds.width &&
          pointer.y >= bounds.top &&
          pointer.y <= bounds.top + bounds.height
        ) {
          if (device.containsPoint && device.containsPoint(pointer)) {
            return device;
          }
          const center = device.getCenterPoint
            ? device.getCenterPoint()
            : { x: device.left, y: device.top };
          const distance = Math.hypot(pointer.x - center.x, pointer.y - center.y);
          if (distance < 50) {
            return device;
          }
        }
      } catch (e) {}
    }

    return null;
  }

  // Get the unique ID of a device
  getDeviceId(device) {
    if (!device) return null;
    if (window.topologyManager && typeof window.topologyManager.getDeviceId === "function") {
      return window.topologyManager.getDeviceId(device);
    }
    return device.id || device._topologyId || null;
  }

  // Ensure the instruction div exists in the DOM
  ensureInstructionDiv() {
    let instructionDiv = document.getElementById("network-link-instruction");
    if (!instructionDiv) {
      instructionDiv = document.createElement("div");
      instructionDiv.id = "network-link-instruction";
      instructionDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(33, 150, 243, 0.95);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 9999;
        font-family: Poppins, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(instructionDiv);
    }
    return instructionDiv;
  }

  // Show connection instruction to the user
  showConnectionInstruction() {
    if (this.restrictionTimeout) {
      clearTimeout(this.restrictionTimeout);
      this.restrictionTimeout = null;
    }
    const instructionDiv = this.ensureInstructionDiv();
    instructionDiv.style.background = "rgba(33, 150, 243, 0.95)";
    instructionDiv.textContent =
      "Click on another device to create network connection. Click the source device again to connect it to another device.";
    instructionDiv.style.display = "block";
  }

  // Update the connection instruction after a successful connection
  updateConnectionInstruction() {
    const instructionDiv = this.ensureInstructionDiv();
    if (instructionDiv) {
      instructionDiv.style.background = "rgba(33, 150, 243, 0.95)";
      instructionDiv.textContent =
        "Connection created! Click on another device to continue connecting from the same source, or press ESC to stop.";
      setTimeout(() => {
        if (instructionDiv.style.display === "block") {
          instructionDiv.textContent =
            "Click on another device to create network connection from the same source.";
        }
      }, 2000);
    }
  }

  // Hide the connection instruction
  hideConnectionInstruction() {
    if (this.restrictionTimeout) {
      clearTimeout(this.restrictionTimeout);
      this.restrictionTimeout = null;
    }
    const instructionDiv = document.getElementById("network-link-instruction");
    if (instructionDiv) {
      instructionDiv.style.display = "none";
    }
  }

  // Show a warning for connection restrictions
  showRestrictionWarning(message) {
    const instructionDiv = this.ensureInstructionDiv();
    instructionDiv.style.background = "rgba(220, 53, 69, 0.95)";
    instructionDiv.textContent =
      message ||
      "These devices cannot be linked. Use the same category or connect via Custom/Network devices.";
    instructionDiv.style.display = "block";
    if (this.restrictionTimeout) {
      clearTimeout(this.restrictionTimeout);
    }
    this.restrictionTimeout = setTimeout(() => {
      this.restrictionTimeout = null;
      if (this.isConnecting) {
        this.showConnectionInstruction();
      } else {
        this.hideConnectionInstruction();
      }
    }, 2200);
  }
}

export function setupNetworkLinkTool(fabricCanvas) {
  new NetworkLink(fabricCanvas);
}
