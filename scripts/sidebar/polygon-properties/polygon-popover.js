import { createPopoverBase } from "../popover-utils.js";
import "../device-properties/details-panel.js";
import "./details-panel.js";

// Sets up the polygon popover that shows when a zone, room, risk, or safety zone is selected
(function () {
  const popover = document.getElementById("polygon-popover");
  if (!popover) return;

  const titleEl = document.getElementById("polygon-popover-title");
  let currentPolygonType = "zone";

  // Shows zone, room, risk, or safety properties section based on type
  function showPropertiesForType(type) {
    currentPolygonType = type;
    const zoneProps = document.getElementById("zone-properties");
    const roomProps = document.getElementById("room-properties");
    const riskProps = document.getElementById("risk-properties");
    const safetyProps = document.getElementById("safety-properties");
    const zoneAppearanceProps = document.getElementById("zone-appearance-properties");
    const roomAppearanceProps = document.getElementById("room-appearance-properties");
    const riskAppearanceProps = document.getElementById("risk-appearance-properties");
    const safetyAppearanceProps = document.getElementById("safety-appearance-properties");

    // Hide all first
    if (zoneProps) zoneProps.style.display = "none";
    if (roomProps) roomProps.style.display = "none";
    if (riskProps) riskProps.style.display = "none";
    if (safetyProps) safetyProps.style.display = "none";
    if (zoneAppearanceProps) zoneAppearanceProps.style.display = "none";
    if (roomAppearanceProps) roomAppearanceProps.style.display = "none";
    if (riskAppearanceProps) riskAppearanceProps.style.display = "none";
    if (safetyAppearanceProps) safetyAppearanceProps.style.display = "none";

    // Show the appropriate one
    if (type === "zone") {
      if (zoneProps) zoneProps.style.display = "block";
      if (zoneAppearanceProps) zoneAppearanceProps.style.display = "block";
    } else if (type === "room") {
      if (roomProps) roomProps.style.display = "block";
      if (roomAppearanceProps) roomAppearanceProps.style.display = "block";
    } else if (type === "risk") {
      if (riskProps) riskProps.style.display = "block";
      if (riskAppearanceProps) riskAppearanceProps.style.display = "block";
    } else if (type === "safety") {
      if (safetyProps) safetyProps.style.display = "block";
      if (safetyAppearanceProps) safetyAppearanceProps.style.display = "block";
    }
  }

  // Creates the popover with custom behavior
  const basePopover = createPopoverBase("polygon-popover", {
    onClose: () => {
      basePopover.currentTarget = null;
    },
    customOpenPopover: function (kind, polygon, baseOpen) {
      if (this.isDragging) return;

      const titles = { zone: "Zone Properties", room: "Room Properties", risk: "Risk Properties", safety: "Safety Properties" };
      if (titleEl) titleEl.textContent = titles[kind] || "Zone Properties";
      this.setActivePanel("details");
      showPropertiesForType(kind);

      baseOpen.call(this, polygon);

      requestAnimationFrame(() => this.positionPopover());
    },
    installIntercepts: {
      installKey: "__polygonPopoverInterceptInstalled",
      maxAttempts: 100, // Wait up to 5 seconds for initialization
      shouldIntercept: (deviceType) => {
        return deviceType === "zone-polygon" || deviceType === "room-polygon" || deviceType === "risk-polygon" || deviceType === "safety-polygon";
      },
      waitFor: () => {
        // Wait for polygon properties to finish setting up
        return window.__polygonPropertiesInitialized || false;
      },
      onShowDeviceProperties: function (deviceType, textObject, polygon, fourth, originalShow) {
        if (deviceType === "zone-polygon" || deviceType === "room-polygon" || deviceType === "risk-polygon" || deviceType === "safety-polygon") {
          // Call original first (which includes polygon-sidebar handlers)
          if (typeof originalShow === "function") {
            try {
              originalShow.apply(this, arguments);
            } catch (e) {
              console.error("Error in polygon showDeviceProperties:", e);
            }
          }
          // Then open the popover
          const kind = deviceType === "room-polygon" ? "room" : deviceType === "risk-polygon" ? "risk" : deviceType === "safety-polygon" ? "safety" : "zone";
          basePopover.openPopover(kind, polygon);
          return;
        }
      },
      onHideDeviceProperties: () => {
        basePopover.closePopover();
      },
    },
  });

  if (!basePopover) return;
})();
