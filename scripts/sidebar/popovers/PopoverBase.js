import { updateSliderTrack } from "../sidebar-utils.js";

// Base class for all popovers in the system
export class PopoverBase {
  // Initialize popover elements, state, and event listeners
  constructor(popoverId, options = {}) {
    this.popover = document.getElementById(popoverId);
    if (!this.popover) {
      console.error(`Popover element not found: ${popoverId}`);
      return;
    }

    this.popoverId = popoverId;
    this.titleEl = this.popover.querySelector(`#${popoverId}-title`);
    this.closeBtn = this.popover.querySelector(`#${popoverId}-close`);

    this.currentTarget = null;
    this.lastOpenedTs = 0;
    this.isDragging = false;
    this.wasVisibleBeforeDrag = false;

    // Drag state
    this.dragOffset = { x: 0, y: 0 };
    this.dragActive = false;
    this.dragStartPos = { x: 0, y: 0 };

    // Callbacks
    this.options = options;

    this.setupDragHandling();
    this.setupEventListeners();
    this.hookCanvasEvents();
  }

  // Updates the visual appearance of slider tracks
  initializeSliderAppearance(slider) {
    if (!slider) return;
    const value = parseFloat(slider.value);
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    updateSliderTrack(slider, value, min, max);
  }

  // Initializes all sliders in the popover
  initializeAllSliders() {
    this.popover.querySelectorAll(".form-range, .slider").forEach((s) => this.initializeSliderAppearance(s));
  }

  // Shared position for all popovers in this session
  getSharedPopoverPosition() {
    return window.__sharedPopoverPosition || null;
  }

  // Sets the shared position for all popovers
  setSharedPopoverPosition(pos) {
    window.__sharedPopoverPosition = pos;
  }

  // Gets all navigation tab items
  getNavItems() {
    return Array.from(this.popover.querySelectorAll(".panel-navigation .nav-item"));
  }

  // Gets all panel sections
  getPanels() {
    return Array.from(this.popover.querySelectorAll(".slide-panel"));
  }

  // Switches to a different panel tab
  setActivePanel(key) {
    this.getNavItems().forEach((item) => item.classList.toggle("active", item.dataset.panel === key));
    this.getPanels().forEach((p) => p.classList.toggle("active", p.dataset.panel === key));

    setTimeout(() => this.initializeAllSliders(), 10);
    if (this.options.onPanelChanged) this.options.onPanelChanged(key);
  }

  // Positions the popover in the top-right corner or at shared position
  positionPopover() {
    if (this.isDragging) return;

    const sharedPos = this.getSharedPopoverPosition();
    if (sharedPos) {
      this.popover.style.left = `${sharedPos.left}px`;
      this.popover.style.top = `${sharedPos.top}px`;
      this.popover.style.right = "auto";
      return;
    }

    try {
      // Position in top-right corner to avoid blocking canvas
      const popoverWidth = this.popover.offsetWidth || 360;
      const padding = 20;
      const left = window.innerWidth - popoverWidth - padding;
      const top = padding;
      this.popover.style.left = `${left}px`;
      this.popover.style.top = `${top}px`;
      this.popover.style.right = "auto";
    } catch (e) {
      // Fallback positioning
      this.popover.style.right = `20px`;
      this.popover.style.top = `20px`;
      this.popover.style.left = `auto`;
    }
  }

  // Hides popover temporarily during drag
  hidePopoverForDrag() {
    if (this.popover.style.display === "block") {
      this.wasVisibleBeforeDrag = true;
      this.popover.style.display = "none";
    } else {
      this.wasVisibleBeforeDrag = false;
    }
  }

  // Shows popover after drag if it was visible
  showPopoverAfterDrag() {
    if (this.wasVisibleBeforeDrag && this.currentTarget) {
      this.popover.style.display = "block";
      this.positionPopover();
      this.onOpened();
    }
    this.wasVisibleBeforeDrag = false;
  }

  // Opens the popover and shows it
  openPopover(target, ...args) {
    if (this.isDragging) return;

    // If custom open handler exists, use it; otherwise use default
    if (this.options.customOpenPopover) {
      return this.options.customOpenPopover.call(this, target, ...args);
    }

    this.baseOpenPopover(target, ...args);
  }

  // Internal base implementation for opening
  baseOpenPopover(target, ...args) {
    this.currentTarget = target;
    this.lastOpenedTs = Date.now();
    this.popover.style.display = "block";
    this.positionPopover();
    this.onOpened(...args);
  }

  // Called when popover is opened
  onOpened(...args) {
    setTimeout(() => this.initializeAllSliders(), 10);
    if (this.options.onOpened) this.options.onOpened(...args);
  }

  // Closes the popover
  closePopover() {
    this.popover.style.display = "none";
    if (this.options.onClose) this.options.onClose();
    this.currentTarget = null;
  }

  // Sets up drag handling on the title bar
  setupDragHandling() {
    if (!this.titleEl) return;

    this.titleEl.classList.add("popover-drag-handle");
    this.titleEl.style.cursor = "move";

    this.titleEl.addEventListener("mousedown", (e) => this.onDragStart(e));
    this.titleEl.addEventListener("touchstart", (e) => this.onDragStart(e));
    document.addEventListener("mousemove", (e) => this.onDragMove(e));
    document.addEventListener("touchmove", (e) => this.onDragMove(e));
    document.addEventListener("mouseup", (e) => this.onDragEnd(e));
    document.addEventListener("touchend", (e) => this.onDragEnd(e));
  }

  // Drag start handler
  onDragStart(e) {
    const target = e.target;
    const titleId = this.titleEl?.id;
    if (!titleId || (!target.closest(`#${titleId}`) && !target.classList.contains("popover-drag-handle"))) {
      return;
    }

    this.dragActive = true;
    this.isDragging = true;
    this.dragStartPos = {
      x: e.type === "touchstart" ? e.touches[0].clientX : e.clientX,
      y: e.type === "touchstart" ? e.touches[0].clientY : e.clientY,
    };

    const rect = this.popover.getBoundingClientRect();
    this.dragOffset = {
      x: this.dragStartPos.x - rect.left,
      y: this.dragStartPos.y - rect.top,
    };

    document.body.style.userSelect = "none";
  }

  // Drag move handler
  onDragMove(e) {
    if (!this.dragActive) return;

    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    let left = clientX - this.dragOffset.x;
    let top = clientY - this.dragOffset.y;

    // Keep within window bounds
    left = Math.max(0, Math.min(window.innerWidth - this.popover.offsetWidth, left));
    top = Math.max(0, Math.min(window.innerHeight - this.popover.offsetHeight, top));

    this.popover.style.left = `${left}px`;
    this.popover.style.top = `${top}px`;
    this.popover.style.right = "auto";
  }

  // Drag end handler
  onDragEnd() {
    if (!this.dragActive) return;

    this.dragActive = false;
    this.isDragging = false;
    document.body.style.userSelect = "";

    const rect = this.popover.getBoundingClientRect();
    this.setSharedPopoverPosition({ left: rect.left, top: rect.top });
  }

  // Sets up event listeners for navigation and closing
  setupEventListeners() {
    // Panel navigation
    this.popover.addEventListener("click", (e) => {
      const item = e.target.closest(".nav-item");
      if (item) {
        this.setActivePanel(item.dataset.panel);
      }
    });

    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closePopover();
      });
    }

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (this.popover.style.display !== "block") return;
      if (Date.now() - this.lastOpenedTs < 150) return;

      const shouldPrevent = this.options.shouldPreventClose ? this.options.shouldPreventClose(e) : false;
      if (!this.popover.contains(e.target) && e.target !== this.popover && !shouldPrevent) {
        this.closePopover();
      }
    });

    // Disable Tab key globally when open
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Tab" && this.popover.style.display === "block") {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    // Reposition on resize
    window.addEventListener("resize", () => {
      const isVisible = this.popover.style.display === "block";
      const hasTarget = !!this.currentTarget;
      const isNotDragging = !this.isDragging;
      const noSharedPos = !this.getSharedPopoverPosition();

      if (isVisible && hasTarget && isNotDragging && noSharedPos) {
        this.positionPopover();
      }
    });
  }

  // Hooks into canvas events for hiding during movement
  hookCanvasEvents() {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const fabricCanvas = window.fabricCanvas;
        if (!fabricCanvas) return;

        fabricCanvas.on("object:moving", () => {
          if (!this.isDragging) {
            this.isDragging = true;
            this.hidePopoverForDrag();
          }
        });

        fabricCanvas.on("object:modified", () => {
          if (this.isDragging) {
            this.isDragging = false;
            setTimeout(() => this.showPopoverAfterDrag(), 50);
          }
        });

        fabricCanvas.on("mouse:up", () => {
          if (this.isDragging) {
            this.isDragging = false;
            setTimeout(() => this.showPopoverAfterDrag(), 50);
          }
        });

        fabricCanvas.on("mouse:wheel", () => {
          if (this.popover.style.display === "block" && this.currentTarget && !this.isDragging) {
            this.positionPopover();
          }
        });

        fabricCanvas.on("after:render", () => {
          if (this.popover.style.display === "block" && this.currentTarget && !this.isDragging) {
            this.positionPopover();
          }
        });
      }, 200);
    });
  }

  // Installs intercepts for global property functions
  installIntercepts(interceptConfig = {}) {
    const { installKey, shouldIntercept, onShowDeviceProperties, onHideDeviceProperties, waitFor = () => true, maxAttempts = 40, attemptInterval = 50 } = interceptConfig;

    if (!installKey || !shouldIntercept || !onShowDeviceProperties) return;

    const tryInstall = () => {
      const currentShow = window.showDeviceProperties;
      const currentHide = window.hideDeviceProperties;

      if (!currentShow) return false;
      if (window[installKey]) return true;
      if (!waitFor()) return false;

      window[installKey] = true;

      window.showDeviceProperties = (deviceType, textObject, target, fourth) => {
        if (shouldIntercept(deviceType, textObject, target, fourth)) {
          return onShowDeviceProperties.call(this, deviceType, textObject, target, fourth, currentShow);
        }
        if (typeof currentShow === "function") {
          return currentShow(deviceType, textObject, target, fourth);
        }
      };

      window.hideDeviceProperties = () => {
        if (onHideDeviceProperties) onHideDeviceProperties.call(this);
        if (typeof currentHide === "function") currentHide();
      };

      return true;
    };

    if (tryInstall()) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (tryInstall() || attempts > maxAttempts) {
        clearInterval(timer);
      }
    }, attemptInterval);
  }
}
