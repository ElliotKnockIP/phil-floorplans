// Popover controller for zone and room properties, mirroring device popover behavior
(function () {
  const popover = document.getElementById("polygon-popover");
  if (!popover) return;

  const titleEl = document.getElementById("polygon-popover-title");
  const closeBtn = document.getElementById("polygon-popover-close");

  let currentTarget = null;
  let lastOpenedTs = 0;
  let currentPolygonType = "zone";
  let isDragging = false;
  let wasVisibleBeforeDrag = false;

  // Use a shared popover position for all popovers in this session
  function getSharedPopoverPosition() {
    return window.__sharedPopoverPosition || null;
  }
  function setSharedPopoverPosition(pos) {
    window.__sharedPopoverPosition = pos;
  }

  const navItems = () => Array.from(popover.querySelectorAll(".panel-navigation .nav-item"));
  const panels = () => Array.from(popover.querySelectorAll(".slide-panel"));

  function setActivePanel(key) {
    navItems().forEach((item) => item.classList.toggle("active", item.dataset.panel === key));
    panels().forEach((p) => p.classList.toggle("active", p.dataset.panel === key));
  }

  // Show/hide navigation items based on polygon type (zones vs rooms)
  function updateNavigationForType(type) {
    const setupNav = popover.querySelector('.panel-navigation .nav-item[data-panel="setup"]');
    const setupPanel = popover.querySelector('.slide-panel[data-panel="setup"]');
    if (!setupNav || !setupPanel) return;
    if (type === 'zone') {
      setupNav.style.display = '';
      setupPanel.style.display = '';
    } else {
      // hide setup for rooms
      setupNav.style.display = 'none';
      setupPanel.style.display = 'none';
      // if setup was active, fall back to details
      if (setupNav.classList.contains('active')) {
        setActivePanel('details');
      }
    }
  }

  function positionForPolygon(poly) {
    if (isDragging) return;
    const sharedPos = getSharedPopoverPosition();
    if (sharedPos) {
      popover.style.left = `${sharedPos.left}px`;
      popover.style.top = `${sharedPos.top}px`;
      popover.style.right = "auto";
      return;
    }
    try {
      // Position popover in top-right corner to avoid blocking canvas content
      const popoverWidth = popover.offsetWidth || 360;
      const padding = 20;
      const left = window.innerWidth - popoverWidth - padding;
      const top = padding;
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.style.right = "auto";
    } catch (e) {
      // Fallback positioning
      popover.style.right = `20px`;
      popover.style.top = `20px`;
      popover.style.left = `auto`;
    }
  }

  // Make polygon popover draggable
  let dragOffset = { x: 0, y: 0 };
  let dragActive = false;
  let dragStartPos = { x: 0, y: 0 };

  function onDragStart(e) {
    // Only start drag if clicking on title bar or top area
    const target = e.target;
    if (!titleEl || (!target.closest("#polygon-popover-title") && !target.classList.contains("popover-drag-handle"))) return;
    dragActive = true;
    isDragging = true;
    dragStartPos = {
      x: e.type === "touchstart" ? e.touches[0].clientX : e.clientX,
      y: e.type === "touchstart" ? e.touches[0].clientY : e.clientY,
    };
    const rect = popover.getBoundingClientRect();
    dragOffset = {
      x: dragStartPos.x - rect.left,
      y: dragStartPos.y - rect.top,
    };
    document.body.style.userSelect = "none";
  }

  function onDragMove(e) {
    if (!dragActive) return;
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
    let left = clientX - dragOffset.x;
    let top = clientY - dragOffset.y;
    // Clamp to window
    left = Math.max(0, Math.min(window.innerWidth - popover.offsetWidth, left));
    top = Math.max(0, Math.min(window.innerHeight - popover.offsetHeight, top));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.right = "auto";
  }

  function onDragEnd(e) {
    if (!dragActive) return;
    dragActive = false;
    isDragging = false;
    document.body.style.userSelect = "";
    // Save position for all popovers in session (shared)
    const rect = popover.getBoundingClientRect();
    setSharedPopoverPosition({ left: rect.left, top: rect.top });
  }

  // Attach drag events
  if (titleEl) {
    titleEl.classList.add("popover-drag-handle");
    titleEl.style.cursor = "move";
    titleEl.addEventListener("mousedown", onDragStart);
    titleEl.addEventListener("touchstart", onDragStart);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
  }

  function showPropertiesForType(type) {
    currentPolygonType = type;
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
    // Update navigation visibility (hide setup when showing room properties)
    updateNavigationForType(type);
  }

  function openPopover(kind, polygon) {
    if (isDragging) return;
    currentTarget = polygon;
    lastOpenedTs = Date.now();
    if (titleEl) titleEl.textContent = kind === "room" ? "Room Properties" : "Zone Properties";
    setActivePanel("details");
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

  popover.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) setActivePanel(item.dataset.panel);
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
    if (popover.style.display === "block" && currentTarget && !isDragging && !getSharedPopoverPosition()) {
      positionForPolygon(currentTarget);
    }
  });

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
      if (deviceType === "zone-polygon" || deviceType === "room-polygon") {
        try {
          originalShow.apply(this, arguments);
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

  function hookCanvasEvents() {
    const fabricCanvas = window.fabricCanvas;
    if (!fabricCanvas) return;

    fabricCanvas.on("object:moving", (opt) => {
      if (!isDragging) {
        isDragging = true;
        hidePopoverForDrag();
      }
    });

    fabricCanvas.on("object:modified", (opt) => {
      if (isDragging) {
        isDragging = false;
        setTimeout(() => showPopoverAfterDrag(), 50);
      }
    });

    fabricCanvas.on("mouse:up", () => {
      if (isDragging) {
        isDragging = false;
        setTimeout(() => showPopoverAfterDrag(), 50);
      }
    });

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
