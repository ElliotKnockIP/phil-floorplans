import { wrapGlobalFunction } from "./sidebar-utils.js";

// This module replaces the right sidebar for device groups with a compact popover UI.
// It reuses the existing input IDs so the current sidebar logic (device-sidebar.js & camera-sidebar.js)
// continues to wire into the same controls without changes.

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

  function setActivePanel(key) {
    navItems().forEach((item) => item.classList.toggle("active", item.dataset.panel === key));
    panels().forEach((p) => p.classList.toggle("active", p.dataset.panel === key));
  }

  // Ensure a specific tab/panel pair is visible or hidden
  function setTabVisibility(panelKey, visible) {
    const tab = popover.querySelector(`.panel-navigation .nav-item[data-panel="${panelKey}"]`);
    const panel = popover.querySelector(`.slide-panel[data-panel="${panelKey}"]`);
    if (tab) tab.style.display = visible ? "" : "none"; // remove inline style when visible
    if (panel) panel.style.display = visible ? "" : "none";
  }

  // Initialize slider visual appearance
  function initializeSliderAppearance(slider) {
    if (!slider) return;

    const value = parseFloat(slider.value);
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const percentage = ((value - min) / (max - min)) * 100;

    slider.style.background = `linear-gradient(to right, var(--orange-ip2, #f8794b) ${percentage}%, #e9ecef ${percentage}%)`;
  }

  // Initialize all sliders in the popover
  function initializeAllSliders() {
    const sliders = popover.querySelectorAll(".form-range, .slider");
    sliders.forEach((slider) => {
      initializeSliderAppearance(slider);
    });
  }

  function positionPopoverForGroup(group) {
    if (!group || !group.canvas || isDragging) return;

    try {
      const canvas = group.canvas;
      const bounds = group.getBoundingRect();
      const canvasRect = canvas.getElement().getBoundingClientRect();

      // Prefer placing the popover to the right of the device, with bounds checking
      const left = Math.min(canvasRect.left + bounds.left + bounds.width + 10, window.innerWidth - (popover.offsetWidth || 360) - 10);
      const top = Math.max(canvasRect.top + bounds.top - 10, 10);

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    } catch (e) {
      // Fallback to center
      popover.style.left = `calc(50% - 180px)`;
      popover.style.top = `80px`;
    }
  }

  // Open the device popover. Accept deviceType so we can reliably determine camera even if group.deviceType is unset.
  function openPopover(group, deviceTypeLabel = "Device Properties", deviceType = null) {
    if (isDragging) return; // Don't open during drag

    currentTargetGroup = group;
    lastOpenedTs = Date.now();
    if (popoverTitle) popoverTitle.textContent = deviceTypeLabel;

    // Default to Details tab
    setActivePanel("details");

    // Reset ALL tabs/panels first to a known visible state
    ["details", "label", "icon", "coverage"].forEach((k) => setTabVisibility(k, true));

    // Show/hide the Coverage tab depending on if it's a camera
    const typeString = typeof deviceType === "string" ? deviceType : group && typeof group.deviceType === "string" ? group.deviceType : "";
    const isCamera = !!typeString && typeString.includes("camera");
    setTabVisibility("coverage", isCamera);
    // If previously on coverage and switching to non-camera, move to details
    const coverageTab = popover.querySelector('.panel-navigation .nav-item[data-panel="coverage"]');
    if (!isCamera && coverageTab && coverageTab.classList.contains("active")) {
      setActivePanel("details");
    }

    // Show/hide camera vs device icons in the icon panel
    const cameraIconsSection = popover.querySelector(".camera-icons-section");
    const deviceIconsSection = popover.querySelector(".device-icons-section");

    if (isCamera) {
      if (cameraIconsSection) cameraIconsSection.style.display = "";
      if (deviceIconsSection) deviceIconsSection.style.display = "none";
    } else {
      if (cameraIconsSection) cameraIconsSection.style.display = "none";
      if (deviceIconsSection) deviceIconsSection.style.display = "";
    }

    // Some polygon flows hide inner sections (#camera-properties, #generic-properties) via inline styles; restore them here
    const cameraProps = document.getElementById("camera-properties");
    if (cameraProps) cameraProps.style.display = ""; // clear any inline none
    const genericProps = document.getElementById("generic-properties");
    if (genericProps) genericProps.style.display = "";

    popover.style.display = "block";
    positionPopoverForGroup(group);

    // Initialize slider appearances after popover is shown
    setTimeout(() => {
      initializeAllSliders();
    }, 10);

    // Ensure popover stays within viewport on resize
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
      // Re-initialize slider appearances after showing
      setTimeout(() => {
        initializeAllSliders();
      }, 10);
    }
    wasVisibleBeforeDrag = false;
  }

  // Nav interactions
  popover.addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) {
      setActivePanel(item.dataset.panel);
      // Re-initialize sliders when switching panels
      setTimeout(() => {
        initializeAllSliders();
      }, 10);
    }
  });

  if (popoverClose) {
    popoverClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopover();
    });
  }

  // Dismiss when clicking outside (avoid closing immediately on the same click that opened it)
  document.addEventListener("click", (e) => {
    if (popover.style.display !== "block") return;
    // Small grace period to avoid closing from the selection click
    if (Date.now() - lastOpenedTs < 150) return;
    if (!popover.contains(e.target) && e.target !== popover && !e.target.closest(".device-icon")) {
      closePopover();
    }
  });

  // Keep popover in place when the canvas resizes
  window.addEventListener("resize", () => {
    if (popover.style.display === "block" && currentTargetGroup && !isDragging) {
      positionPopoverForGroup(currentTargetGroup);
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
        // Re-initialize sliders when switching panels
        setTimeout(() => {
          initializeAllSliders();
        }, 10);
      }
    }
  });

  // Intercept global show/hide of device properties and route to popover
  const DEVICE_NAME_MAP = {
    "bullet-camera.png": "Camera Properties",
    "box-camera.png": "Camera Properties",
    "ptz-camera.png": "Camera Properties",
    "dome-camera.png": "Camera Properties",
    "fixed-camera.png": "Camera Properties",
    "thermal-camera.png": "Camera Properties",
    "custom-camera-icon.png": "Camera Properties",
    "zone-polygon": "Zone Properties",
    "room-polygon": "Room Properties",
  };

  // Install our intercepts AFTER other scripts (device-sidebar.js) define the globals,
  // because they assign inside DOMContentLoaded and would otherwise overwrite our wrap.
  function installIntercepts() {
    const originalShow = window.showDeviceProperties;
    const originalHide = window.hideDeviceProperties;
    if (typeof originalShow !== "function") return false;
    if (window.__devicePopoverInterceptInstalled) return true;

    window.__devicePopoverInterceptInstalled = true;

    window.showDeviceProperties = function (deviceType, textObject, group) {
      // Zones/rooms: defer to original behavior (will be handled by polygon popover)
      if (deviceType === "zone-polygon" || deviceType === "room-polygon") {
        closePopover();
        return originalShow.apply(this, arguments);
      }

      // Devices: open popover and call original for data handling
      try {
        originalShow.apply(this, arguments);
      } catch (_) {}

      // Initialize camera controls if needed
      if (group && group.canvas && typeof window.initCameraControls === "function") {
        try {
          window.initCameraControls(group.canvas);
        } catch (_) {}
      }

      // Show our popover
      const label = DEVICE_NAME_MAP[deviceType] || "Device Properties";
      openPopover(group, label, deviceType);
    };

    window.hideDeviceProperties = function () {
      closePopover();
      if (typeof originalHide === "function") return originalHide.apply(this, arguments);
    };

    return true;
  }

  // Defer installation until DOM is ready and try a few times in case scripts attach late
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

  // Wait a tick for canvas to be ready
  window.addEventListener("load", () => setTimeout(hookCanvasEvents, 200));
})();
