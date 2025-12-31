// Handle touch interactions for mobile devices
import { DeviceFactory } from "../devices/DeviceFactory.js";

(function () {
  // Wait for the Fabric canvas to be initialized
  function waitForCanvas(maxWaitMs = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (window.fabricCanvas && window.fabric) return resolve(window.fabricCanvas);
        if (Date.now() - start > maxWaitMs) return reject(new Error("Fabric canvas not ready"));
        requestAnimationFrame(check);
      };
      check();
    });
  }

  // Create a device on the canvas at specific touch coordinates
  function createDeviceOnCanvas(fabricCanvas, imgSrc, clientX, clientY, options = {}) {
    const canvasElement = fabricCanvas.getElement();
    const rect = canvasElement.getBoundingClientRect();

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();
    const canvasX = (localX - vpt[4]) / zoom;
    const canvasY = (localY - vpt[5]) / zoom;

    DeviceFactory.createDevice(fabricCanvas, imgSrc, canvasX, canvasY, options);
  }

  // Enable touch-based drag and drop for devices from the sidebar
  function setupDeviceTouchDrag(fabricCanvas) {
    const deviceItems = document.querySelectorAll("#add-devices-submenu .device-item");
    if (!deviceItems.length) return;

    let dragState = null;

    // Finalize the drag operation and place the device if over the canvas
    function endDrag(commitEvent) {
      if (!dragState) return;
      const { ghost } = dragState;
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

      if (commitEvent) {
        const canvasElement = fabricCanvas.getElement();
        const canvasRect = canvasElement.getBoundingClientRect();
        const x = commitEvent.changedTouches[0].clientX;
        const y = commitEvent.changedTouches[0].clientY;
        const overCanvas = x >= canvasRect.left && x <= canvasRect.right && y >= canvasRect.top && y <= canvasRect.bottom;
        if (overCanvas) {
          createDeviceOnCanvas(fabricCanvas, dragState.imgSrc, x, y, dragState.options || {});
        }
      }
      dragState = null;
      document.removeEventListener("touchmove", onMove, { passive: false });
      document.removeEventListener("touchend", onEnd, { passive: false });
      document.removeEventListener("touchcancel", onEnd, { passive: false });
    }

    // Update the position of the ghost preview during touch movement
    function onMove(e) {
      if (!dragState) return;
      const t = e.touches[0];
      dragState.lastX = t.clientX;
      dragState.lastY = t.clientY;
      const ghost = dragState.ghost;
      if (ghost) {
        const tx = dragState.lastX - dragState.offsetX;
        const ty = dragState.lastY - dragState.offsetY;
        ghost.style.transform = `translate(${tx}px, ${ty}px)`;
      }
      e.preventDefault();
    }

    // Handle the end of a touch drag operation
    function onEnd(e) {
      e.preventDefault();
      endDrag(e);
    }

    deviceItems.forEach((deviceItem) => {
      deviceItem.style.touchAction = "none";
      deviceItem.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length !== 1) return;
          const t = e.touches[0];
          const imgEl = deviceItem.querySelector("img");
          const imgSrc = imgEl ? imgEl.src : "";
          const isCustom = !!deviceItem.closest("#custom-icons-list");
          const dragOptions = isCustom
            ? {
                isCamera: deviceItem.dataset.isCamera === "1",
                deviceType: deviceItem.dataset.isCamera === "1" ? "custom-camera-icon.png" : "custom-device-icon.png",
              }
            : {};

          // Create a floating ghost preview element
          const ghost = document.createElement("div");
          Object.assign(ghost.style, {
            position: "fixed",
            left: "0px",
            top: "0px",
            width: "48px",
            height: "48px",
            pointerEvents: "none",
            zIndex: "10000",
            transform: `translate(${t.clientX - 24}px, ${t.clientY - 24}px)`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            borderRadius: "6px",
            background: `url('${imgSrc}') center/contain no-repeat, rgba(0,0,0,0.05)`,
          });
          document.body.appendChild(ghost);

          dragState = {
            imgSrc,
            ghost,
            lastX: t.clientX,
            lastY: t.clientY,
            offsetX: 24,
            offsetY: 24,
            options: dragOptions,
          };

          document.addEventListener("touchmove", onMove, { passive: false });
          document.addEventListener("touchend", onEnd, { passive: false });
          document.addEventListener("touchcancel", onEnd, { passive: false });
          e.preventDefault();
        },
        { passive: false }
      );
    });
  }

  // Enable pinch-to-zoom and touch panning on the canvas
  function setupCanvasTouchGestures(fabricCanvas) {
    const canvasEl = fabricCanvas.getElement();
    const container = canvasEl.parentElement;
    if (!container) return;

    container.style.touchAction = "none";

    let isTouchPanning = false;
    let startOnObject = false;
    let lastX = 0;
    let lastY = 0;

    let longPressTimer = null;
    let longPressTarget = null;
    let longPressStartX = 0;
    let longPressStartY = 0;
    const LONG_PRESS_DURATION = 250;
    const LONG_PRESS_TOLERANCE = 10;

    let pinchActive = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    // Calculate distance between two touch points
    const getTouchDist = (t1, t2) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.hypot(dx, dy);
    };

    // Start timer to detect a long press for context menus
    const startLongPressTimer = (touch) => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTarget = null;
      longPressStartX = touch.clientX;
      longPressStartY = touch.clientY;

      longPressTimer = setTimeout(() => {
        try {
          const pointer = fabricCanvas.getPointer({ clientX: touch.clientX, clientY: touch.clientY }, true);
          longPressTarget = fabricCanvas.findTarget({
            clientX: touch.clientX,
            clientY: touch.clientY,
          });

          const hasMenu = window._fabricContextMenu && typeof window._fabricContextMenu.showMenu === "function";

          if (longPressTarget && hasMenu) {
            window._fabricContextMenu.showMenu(longPressTarget, touch.clientX, touch.clientY);
          }
        } catch (err) {
          console.warn("Failed to detect long press target:", err);
        }
      }, LONG_PRESS_DURATION);
    };

    // Cancel the long press timer
    const cancelLongPressTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        longPressTarget = null;
      }
    };

    // Check if the touch has moved beyond the tolerance threshold
    const isTouchMoved = (touch) => {
      const dx = Math.abs(touch.clientX - longPressStartX);
      const dy = Math.abs(touch.clientY - longPressStartY);
      return dx > LONG_PRESS_TOLERANCE || dy > LONG_PRESS_TOLERANCE;
    };

    // Handle touch start events for panning, zooming, and long press
    container.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          startOnObject = false;
          try {
            if (typeof fabricCanvas.findTarget === "function") {
              const target = fabricCanvas.findTarget(e);
              startOnObject = !!target;
            }
          } catch (_) {}

          isTouchPanning = !startOnObject;
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;

          if (startOnObject) {
            startLongPressTimer(e.touches[0]);
          }
        } else if (e.touches.length === 2) {
          pinchActive = true;
          pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
          pinchStartZoom = fabricCanvas.getZoom();
          cancelLongPressTimer();
        }
        e.preventDefault();
      },
      { passive: false }
    );

    // Handle touch move events for panning and zooming
    container.addEventListener(
      "touchmove",
      (e) => {
        if (longPressTimer && e.touches.length === 1) {
          if (isTouchMoved(e.touches[0])) {
            cancelLongPressTimer();
          }
        }

        if (pinchActive && e.touches.length === 2) {
          const minZoom = 0.25;
          const maxZoom = 10;
          const dist = getTouchDist(e.touches[0], e.touches[1]);
          let zoom = pinchStartZoom * (dist / pinchStartDist);
          zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const fakeEvt = { clientX: centerX, clientY: centerY };
          const pointer = fabricCanvas.getPointer(fakeEvt, true);
          const zoomPoint = new window.fabric.Point(pointer.x, pointer.y);
          fabricCanvas.zoomToPoint(zoomPoint, zoom);
          fabricCanvas.requestRenderAll();
          e.preventDefault();
          return;
        }

        if (isTouchPanning && e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - lastX;
          const dy = t.clientY - lastY;
          lastX = t.clientX;
          lastY = t.clientY;

          const vpt = fabricCanvas.viewportTransform;
          vpt[4] += dx;
          vpt[5] += dy;
          fabricCanvas.setViewportTransform(vpt);
          fabricCanvas.requestRenderAll();
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Handle touch end events
    container.addEventListener(
      "touchend",
      (e) => {
        cancelLongPressTimer();
        if (e.touches.length === 0) {
          isTouchPanning = false;
          pinchActive = false;
          startOnObject = false;
        }
        e.preventDefault();
      },
      { passive: false }
    );

    // Handle touch cancel events
    container.addEventListener(
      "touchcancel",
      (e) => {
        cancelLongPressTimer();
        isTouchPanning = false;
        pinchActive = false;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  // Initialize mobile compatibility features
  function init() {
    waitForCanvas()
      .then((fabricCanvas) => {
        try {
          setupDeviceTouchDrag(fabricCanvas);
          setupCanvasTouchGestures(fabricCanvas);
        } catch (err) {
          console.error("Failed to initialize mobile compatibility:", err);
        }
      })
      .catch((err) => console.warn("Mobile compatibility skipped:", err));
  }

  // Run initialization when the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
