import { wrapGlobalFunction } from "./sidebar-utils.js";

(function () {
  const popover = document.getElementById("device-popover");
  const popoverTitle = document.getElementById("device-popover-title");
  const popoverClose = document.getElementById("device-popover-close");
  const canvasEl = document.getElementById("canvas-layout");

  const navItems = () => Array.from(popover.querySelectorAll(".panel-navigation .nav-item"));
  const panels = () => Array.from(popover.querySelectorAll(".slide-panel"));

  let currentTargetGroup = null;
  let lastOpenedTs = 0;
  let isDragging = false;
  let wasVisibleBeforeDrag = false;

  // Use a shared popover position for all popovers in this session
  function getSharedPopoverPosition() {
    return window.__sharedPopoverPosition || null;
  }
  function setSharedPopoverPosition(pos) {
    window.__sharedPopoverPosition = pos;
  }

  const DEVICE_NAME_MAP = {
    "bullet-camera.png": "Camera Properties",
    "box-camera.png": "Camera Properties",
    "ptz-camera.png": "Camera Properties",
    "dome-camera.png": "Camera Properties",
    "fixed-camera.png": "Camera Properties",
    "thermal-camera.png": "Camera Properties",
    "custom-camera-icon.png": "Camera Properties",
  "text-device": "Placeholder Text Properties",
  };

  function setActivePanel(key) {
    navItems().forEach((item) => item.classList.toggle("active", item.dataset.panel === key));
    panels().forEach((p) => p.classList.toggle("active", p.dataset.panel === key));
  }

  function setTabVisibility(panelKey, visible) {
    const tab = popover.querySelector(`.panel-navigation .nav-item[data-panel="${panelKey}"]`);
    const panel = popover.querySelector(`.slide-panel[data-panel="${panelKey}"]`);
    if (tab) tab.style.display = visible ? "" : "none";
    if (panel) panel.style.display = visible ? "" : "none";
  }

  function initializeSliderAppearance(slider) {
    if (!slider) return;
    const value = parseFloat(slider.value);
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, #e9ecef ${percentage}%)`;
  }

  function initializeAllSliders() {
    popover.querySelectorAll(".form-range, .slider").forEach(initializeSliderAppearance);
  }

  function positionPopoverForGroup(group) {
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

  // Make popover draggable
  let dragOffset = { x: 0, y: 0 };
  let dragActive = false;
  let dragStartPos = { x: 0, y: 0 };

  function onDragStart(e) {
    // Only start drag if clicking on title bar or top area
    const target = e.target;
    if (!popoverTitle || (!target.closest("#device-popover-title") && !target.classList.contains("popover-drag-handle"))) return;
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
  if (popoverTitle) {
    popoverTitle.classList.add("popover-drag-handle");
    popoverTitle.style.cursor = "move";
    popoverTitle.addEventListener("mousedown", onDragStart);
    popoverTitle.addEventListener("touchstart", onDragStart);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
  }

  function openPopover(group, deviceTypeLabel = "Device Properties", deviceType = null) {
    if (isDragging) return;
    currentTargetGroup = group;
    lastOpenedTs = Date.now();
    if (popoverTitle) popoverTitle.textContent = deviceTypeLabel;
    setActivePanel("details");

    ["details", "spec", "label", "icon", "coverage"].forEach((k) => setTabVisibility(k, true));

    const typeString = typeof deviceType === "string" ? deviceType : group && typeof group.deviceType === "string" ? group.deviceType : "";
    const isCamera = !!typeString && typeString.includes("camera");
    const isPlaceholderText = typeString === "text-device";
    
  // Placeholder text entries do not use this popover
    if (isPlaceholderText) {
      setTabVisibility("coverage", false);
      setTabVisibility("label", false);
      setTabVisibility("icon", false);
      setTabVisibility("spec", false);
      setActivePanel("details");
    } else {
      setTabVisibility("coverage", isCamera);
      setTabVisibility("label", true);
      setTabVisibility("icon", true);
      setTabVisibility("spec", true);
      
      if (!isCamera && popover.querySelector('.panel-navigation .nav-item[data-panel="coverage"].active')) {
        setActivePanel("details");
      }
    }

    const cameraIconsSection = popover.querySelector(".camera-icons-section");
    const deviceIconsSection = popover.querySelector(".device-icons-section");

    if (isCamera) {
      if (cameraIconsSection) cameraIconsSection.style.display = "";
      if (deviceIconsSection) deviceIconsSection.style.display = "none";
    } else {
      if (cameraIconsSection) cameraIconsSection.style.display = "none";
      if (deviceIconsSection) deviceIconsSection.style.display = "";
    }

    ["camera-properties", "generic-properties"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "";
    });

    popover.style.display = "block";
    positionPopoverForGroup(group);
    setTimeout(initializeAllSliders, 10);
    window.requestAnimationFrame(() => positionPopoverForGroup(group));
  }

  function closePopover() {
    popover.style.display = "none";
    currentTargetGroup = null;
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
    if (wasVisibleBeforeDrag && currentTargetGroup) {
      popover.style.display = "block";
      positionPopoverForGroup(currentTargetGroup);
      setTimeout(initializeAllSliders, 10);
    }
    wasVisibleBeforeDrag = false;
  }

  popover.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) {
      setActivePanel(item.dataset.panel);
      setTimeout(initializeAllSliders, 10);
    }
  });

  if (popoverClose) {
    popoverClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopover();
    });
  }

  document.addEventListener("click", (e) => {
    if (popover.style.display !== "block") return;
    if (Date.now() - lastOpenedTs < 150) return;
    if (!popover.contains(e.target) && e.target !== popover && !e.target.closest(".device-icon")) {
      closePopover();
    }
  });

  window.addEventListener("resize", () => {
    if (popover.style.display === "block" && currentTargetGroup && !isDragging && !getSharedPopoverPosition()) {
      positionPopoverForGroup(currentTargetGroup);
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
        setTimeout(initializeAllSliders, 10);
      }
    }
  });

  function installIntercepts() {
    const originalShow = window.showDeviceProperties;
    const originalHide = window.hideDeviceProperties;
    if (typeof originalShow !== "function") return false;
    if (window.__devicePopoverInterceptInstalled) return true;

    window.__devicePopoverInterceptInstalled = true;

    window.showDeviceProperties = function (deviceType, textObject, group) {
      if (deviceType === "zone-polygon" || deviceType === "room-polygon") {
        closePopover();
        return originalShow.apply(this, arguments);
      }

      try {
        originalShow.apply(this, arguments);
      } catch (_) {}

      if (group && group.canvas && typeof window.initCameraControls === "function") {
        try {
          window.initCameraControls(group.canvas);
        } catch (_) {}
      }

      const label = DEVICE_NAME_MAP[deviceType] || "Device Properties";
      if (deviceType === "text-device") {
        closePopover();
        return;
      }
      openPopover(group, label, deviceType);
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
      const timer = setInterval(() => {
        attempts++;
        if (installIntercepts() || attempts > 40) {
          clearInterval(timer);
        }
      }, 50);
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    tryInstall();
  } else {
    document.addEventListener("DOMContentLoaded", tryInstall, { once: true });
  }

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
        setTimeout(showPopoverAfterDrag, 50);
      }
    });

    fabricCanvas.on("mouse:up", () => {
      if (isDragging) {
        isDragging = false;
        setTimeout(showPopoverAfterDrag, 50);
      }
    });

    fabricCanvas.on("mouse:wheel", () => {
      if (popover.style.display === "block" && currentTargetGroup && !isDragging) {
        positionPopoverForGroup(currentTargetGroup);
      }
    });

    fabricCanvas.on("after:render", () => {
      if (popover.style.display === "block" && currentTargetGroup && !isDragging) {
        positionPopoverForGroup(currentTargetGroup);
      }
    });
  }

  window.addEventListener("load", () => setTimeout(hookCanvasEvents, 200));
})();
