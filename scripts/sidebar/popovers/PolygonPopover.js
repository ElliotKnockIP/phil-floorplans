import { PopoverBase } from "./PopoverBase.js";

// Manages the Polygon properties popover (Zones, Rooms, Risks, Safety)
export class PolygonPopover extends PopoverBase {
  // Initialize popover and setup intercepts
  constructor() {
    super("polygon-popover", {
      onClose: () => {
        this.currentTarget = null;
      },
    });

    if (!this.popover) return;

    this.currentPolygonType = "zone";
    window.__polygonPropertiesInitialized = true; // Ensure intercepts can install
    this.setupIntercepts();
    this.initializeGlobalFunctions();
  }

  // Sets up global functions for rooms, risks, and safety
  initializeGlobalFunctions() {
    window.showRoomProperties = (polygon, text, room) => {
      this.open("room", polygon, room);
    };
    window.showRiskProperties = (polygon, text, risk) => {
      this.open("risk", polygon, risk);
    };
    window.showSafetyProperties = (polygon, text, safety) => {
      this.open("safety", polygon, safety);
    };
  }

  // Sets up intercepts for global polygon property functions
  setupIntercepts() {
    this.installIntercepts({
      installKey: "__polygonPopoverInterceptInstalled",
      maxAttempts: 100,
      shouldIntercept: (deviceType) => {
        const polygonTypes = ["zone-polygon", "room-polygon", "risk-polygon", "safety-polygon"];
        return polygonTypes.includes(deviceType);
      },
      onShowDeviceProperties: (deviceType, textObject, polygon, fourth, originalShow) => {
        const polygonTypes = ["zone-polygon", "room-polygon", "risk-polygon", "safety-polygon"];

        if (polygonTypes.includes(deviceType)) {
          let kind = "zone";
          if (deviceType === "room-polygon") kind = "room";
          else if (deviceType === "risk-polygon") kind = "risk";
          else if (deviceType === "safety-polygon") kind = "safety";

          this.open(kind, polygon, fourth);
          return;
        }

        if (typeof originalShow === "function") {
          return originalShow(deviceType, textObject, polygon, fourth);
        }
      },
      onHideDeviceProperties: () => {
        this.closePopover();
      },
    });
  }

  // Shows zone, room, risk, or safety properties section based on type
  showPropertiesForType(type) {
    this.currentPolygonType = type;
    const sections = ["zone", "room", "risk", "safety"];

    // Toggle horizontal layout for safety properties
    if (type === "safety") {
      this.popover.classList.add("horizontal");
    } else {
      this.popover.classList.remove("horizontal");
    }

    sections.forEach((s) => {
      const props = document.getElementById(`${s}-properties`);
      const appearance = document.getElementById(`${s}-appearance-properties`);

      if (props) props.style.display = s === type ? "block" : "none";
      if (appearance) appearance.style.display = s === type ? "block" : "none";
    });
  }

  // Opens the popover for a specific polygon type
  open(kind, polygon, extraData) {
    if (this.isDragging) return;

    const titleEl = document.getElementById("polygon-popover-title");
    const titles = {
      zone: "Zone Properties",
      room: "Room Properties",
      risk: "Risk Properties",
      safety: "Safety Properties",
    };

    if (titleEl) titleEl.textContent = titles[kind] || "Zone Properties";

    this.setActivePanel("details");
    this.showPropertiesForType(kind);

    if (window.updatePolygonPanels) {
      window.updatePolygonPanels(kind, polygon, polygon.associatedText || polygon.textObject, extraData);
    }

    this.baseOpenPopover(polygon);

    requestAnimationFrame(() => this.positionPopover());
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("polygon-popover")) {
    new PolygonPopover();
  } else {
    document.addEventListener("htmlIncludesLoaded", () => new PolygonPopover());
  }
});
