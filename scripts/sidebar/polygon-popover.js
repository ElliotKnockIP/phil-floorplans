// Popover controller for zone and room properties, mirroring device popover behavior
(function () {
  const popover = document.getElementById("polygon-popover");
  if (!popover) return;

  const titleEl = document.getElementById("polygon-popover-title");
  const closeBtn = document.getElementById("polygon-popover-close");

  let currentTarget = null;
  let lastOpenedTs = 0;
  let currentPolygonType = "zone"; // Track whether we're showing zone or room
  let isDragging = false;
  let wasVisibleBeforeDrag = false;

  const navItems = () => Array.from(popover.querySelectorAll(".panel-navigation .nav-item"));
  const panels = () => Array.from(popover.querySelectorAll(".slide-panel"));

  function setActivePanel(key) {
    navItems().forEach((item) => item.classList.toggle("active", item.dataset.panel === key));
    panels().forEach((p) => p.classList.toggle("active", p.dataset.panel === key));
  }

  function positionForPolygon(poly) {
    if (!poly || !poly.canvas || isDragging) return;
    try {
      const canvasRect = poly.canvas.getElement().getBoundingClientRect();
      const bounds = poly.getBoundingRect();
      const left = Math.min(canvasRect.left + bounds.left + bounds.width + 10, window.innerWidth - (popover.offsetWidth || 360) - 10);
      const top = Math.max(canvasRect.top + bounds.top - 10, 10);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    } catch (_) {
      popover.style.left = `calc(50% - 180px)`;
      popover.style.top = `80px`;
    }
  }

  function showPropertiesForType(type) {
    currentPolygonType = type;

    // Show/hide appropriate property panels
    const zoneProps = document.getElementById("zone-properties");
    const roomProps = document.getElementById("room-properties");
    const zoneAppearanceProps = document.getElementById("zone-appearance-properties");
    const roomAppearanceProps = document.getElementById("room-appearance-properties");

    if (type === "zone") {
      if (zoneProps) zoneProps.style.display = "block";
      if (roomProps) roomProps.style.display = "none";
      if (zoneAppearanceProps) zoneAppearanceProps.style.display = "block";
      if (roomAppearanceProps) roomAppearanceProps.style.display = "none";
    } else {
      if (zoneProps) zoneProps.style.display = "none";
      if (roomProps) roomProps.style.display = "block";
      if (zoneAppearanceProps) zoneAppearanceProps.style.display = "none";
      if (roomAppearanceProps) roomAppearanceProps.style.display = "block";
    }
  }

  function openPopover(kind, polygon) {
    if (isDragging) return; // Don't open during drag

    currentTarget = polygon;
    lastOpenedTs = Date.now();
    if (titleEl) titleEl.textContent = kind === "room" ? "Room Properties" : "Zone Properties";

    // Default to Details tab
    setActivePanel("details");

    // Show appropriate properties based on type
    showPropertiesForType(kind);

    popover.style.display = "block";
    positionForPolygon(polygon);
    requestAnimationFrame(() => positionForPolygon(polygon));
  }

  function closePopover() {
    popover.style.display = "none";
    currentTarget = null;
  }

  function hidePopoverForDrag() {
    if (popover.style.display === "block") {
      wasVisibleBeforeDrag = true;
      popover.style.display = "none";
    } else {
      wasVisibleBeforeDrag = false;
    }
  }

  function showPopoverAfterDrag() {
    if (wasVisibleBeforeDrag && currentTarget) {
      popover.style.display = "block";
      positionForPolygon(currentTarget);
    }
    wasVisibleBeforeDrag = false;
  }

  // Handle navigation panel clicks
  popover.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) {
      setActivePanel(item.dataset.panel);
    }
  });

  if (closeBtn)
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopover();
    });

  document.addEventListener("click", (e) => {
    if (popover.style.display !== "block") return;
    if (Date.now() - lastOpenedTs < 150) return;
    if (!popover.contains(e.target)) closePopover();
  });

  window.addEventListener("resize", () => {
    if (popover.style.display === "block" && currentTarget && !isDragging) {
      positionForPolygon(currentTarget);
    }
  });

  // Keyboard support: ESC to close, arrows to switch panels
  document.addEventListener("keydown", (e) => {
    if (popover.style.display !== "block") return;
    if (e.key === "Escape") closePopover();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const items = navItems().filter((n) => n.style.display !== "none");
      const activeIndex = items.findIndex((n) => n.classList.contains("active"));
      if (activeIndex >= 0) {
        const nextIndex = e.key === "ArrowLeft" ? Math.max(0, activeIndex - 1) : Math.min(items.length - 1, activeIndex + 1);
        setActivePanel(items[nextIndex].dataset.panel);
      }
    }
  });

  function installIntercepts() {
    const originalShow = window.showDeviceProperties;
    const originalHide = window.hideDeviceProperties;
    if (typeof originalShow !== "function") return false;
    if (window.__polygonPopoverInterceptInstalled) return true;
    window.__polygonPopoverInterceptInstalled = true;

    window.showDeviceProperties = function (deviceType, textObject, polygon, fourth) {
      // Zones/rooms -> popover; devices handled by device popover
      if (deviceType === "zone-polygon" || deviceType === "room-polygon") {
        try {
          originalShow.apply(this, arguments); // keep existing init/bindings in sync
        } catch (_) {}

        openPopover(deviceType === "room-polygon" ? "room" : "zone", polygon);
        return;
      }
      return originalShow.apply(this, arguments);
    };

    window.hideDeviceProperties = function () {
      closePopover();
      if (typeof originalHide === "function") return originalHide.apply(this, arguments);
    };
    return true;
  }

  const tryInstall = () => {
    if (!installIntercepts()) {
      let attempts = 0;
      const t = setInterval(() => {
        attempts++;
        if (installIntercepts() || attempts > 40) clearInterval(t);
      }, 50);
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") tryInstall();
  else document.addEventListener("DOMContentLoaded", tryInstall, { once: true });

  // Handle canvas events for dragging and positioning
  function hookCanvasEvents() {
    const fabricCanvas = window.fabricCanvas;
    if (!fabricCanvas) return;

    // Handle drag start - hide popover
    fabricCanvas.on("object:moving", (opt) => {
      if (!isDragging) {
        isDragging = true;
        hidePopoverForDrag();
      }
    });

    // Handle drag end - show popover again
    fabricCanvas.on("object:modified", (opt) => {
      if (isDragging) {
        isDragging = false;
        // Small delay to ensure drag is completely finished
        setTimeout(() => {
          showPopoverAfterDrag();
        }, 50);
      }
    });

    // Handle mouse up in case object:modified doesn't fire
    fabricCanvas.on("mouse:up", () => {
      if (isDragging) {
        isDragging = false;
        setTimeout(() => {
          showPopoverAfterDrag();
        }, 50);
      }
    });

    // Reposition popover when canvas zooms or pans
    fabricCanvas.on("mouse:wheel", () => {
      if (popover.style.display === "block" && currentTarget && !isDragging) {
        positionForPolygon(currentTarget);
      }
    });

    fabricCanvas.on("after:render", () => {
      if (popover.style.display === "block" && currentTarget && !isDragging) {
        positionForPolygon(currentTarget);
      }
    });
  }

  window.addEventListener("load", () => setTimeout(hookCanvasEvents, 200));
})();
