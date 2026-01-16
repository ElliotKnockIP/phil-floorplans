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
    this.isResizing = false;
    this.lastOwnPosition = null;
    this.wasVisibleBeforeDrag = false;
    this.clickedOnObject = false;
    this.lastClickedTarget = null;

    this.resizeDirection = null;
    this.resizeStart = null;
    this.minWidth = options.minWidth || 280;
    this.minHeight = options.minHeight || 240;

    // Drag state
    this.dragOffset = { x: 0, y: 0 };
    this.dragActive = false;
    this.dragStartPos = { x: 0, y: 0 };

    // Callbacks
    this.options = options;

    this.setupDragHandling();
    this.setupResizeHandling();
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

  // Positions the popover in the top-right corner or at shared position, or centers on mobile
  positionPopover() {
    if (this.isDragging || this.isResizing) return;

    // Check if we're on a mobile device (screen width <= 768px)
    const isMobile = window.innerWidth <= 768;

    if (this.lastOwnPosition && !isMobile) {
      this.popover.style.left = `${this.lastOwnPosition.left}px`;
      this.popover.style.top = `${this.lastOwnPosition.top}px`;
      this.popover.style.right = "auto";
      this.popover.style.transform = "none";
      return;
    }

    if (isMobile) {
      // Center the popover on mobile devices
      this.popover.style.left = "50%";
      this.popover.style.top = "50%";
      this.popover.style.right = "auto";
      this.popover.style.transform = "translate(-50%, -50%)";
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
      this.popover.style.transform = "none";
    } catch (e) {
      // Check if on a mobile device for fallback positioning
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        this.popover.style.left = "50%";
        this.popover.style.top = "50%";
        this.popover.style.right = "auto";
        this.popover.style.transform = "translate(-50%, -50%)";
      } else {
        // Fallback positioning for desktop
        this.popover.style.right = `20px`;
        this.popover.style.top = `20px`;
        this.popover.style.left = `auto`;
        this.popover.style.transform = "none";
      }
    }
  }

  // Adds resize handles and listeners for left, bottom, and bottom-left corner
  setupResizeHandling() {
    if (!this.popover) return;

    const handles = [
      { direction: "left", className: "left", cursor: "ew-resize" },
      { direction: "right", className: "right", cursor: "ew-resize" },
      { direction: "top", className: "top", cursor: "ns-resize" },
      { direction: "bottom", className: "bottom", cursor: "ns-resize" },
      { direction: "top-left", className: "top-left", cursor: "nwse-resize" },
      { direction: "top-right", className: "top-right", cursor: "nesw-resize" },
      { direction: "bottom-left", className: "bottom-left", cursor: "nesw-resize" },
      { direction: "bottom-right", className: "bottom-right", cursor: "nwse-resize" },
    ];

    handles.forEach(({ direction, className, cursor }) => {
      const handle = document.createElement("div");
      handle.className = `popover-resize-handle ${className}`;
      handle.dataset.direction = direction;
      handle.style.cursor = cursor;
      handle.addEventListener("mousedown", (e) => this.onResizeStart(e, direction));
      handle.addEventListener("touchstart", (e) => this.onResizeStart(e, direction));
      this.popover.appendChild(handle);
    });

    document.addEventListener("mousemove", (e) => this.onResizeMove(e));
    document.addEventListener("touchmove", (e) => this.onResizeMove(e));
    document.addEventListener("mouseup", () => this.onResizeEnd());
    document.addEventListener("touchend", () => this.onResizeEnd());
  }

  onResizeStart(e, direction) {
    if (this.isDragging) return;

    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    const rect = this.popover.getBoundingClientRect();

    this.resizeDirection = direction;
    this.isResizing = true;
    this.resizeStart = {
      clientX,
      clientY,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };

    // Allow resizing beyond CSS max-height while keeping viewport bounds enforced manually
    this.popover.style.maxHeight = `${window.innerHeight - 20}px`;

    document.body.style.userSelect = "none";
    e.preventDefault();
    e.stopPropagation();
  }

  onResizeMove(e) {
    if (!this.isResizing || !this.resizeStart || !this.resizeDirection) return;

    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    const dx = clientX - this.resizeStart.clientX;
    const dy = clientY - this.resizeStart.clientY;

    const rightEdge = this.resizeStart.left + this.resizeStart.width;
    const bottomEdge = this.resizeStart.top + this.resizeStart.height;

    let newLeft = this.resizeStart.left;
    let newWidth = this.resizeStart.width;
    let newHeight = this.resizeStart.height;
    let newTop = this.resizeStart.top;

    const resizingLeft = this.resizeDirection.includes("left");
    const resizingRight = this.resizeDirection.includes("right");
    const resizingTop = this.resizeDirection.includes("top");
    const resizingBottom = this.resizeDirection.includes("bottom");

    if (resizingLeft) {
      const proposedLeft = this.resizeStart.left + dx;
      newLeft = Math.min(rightEdge - this.minWidth, Math.max(0, proposedLeft));
      newWidth = rightEdge - newLeft;
      const maxWidth = Math.max(this.minWidth, window.innerWidth - newLeft - 10);
      newWidth = Math.min(newWidth, maxWidth);
    }

    if (resizingRight) {
      const proposedWidth = this.resizeStart.width + dx;
      const maxWidth = Math.max(this.minWidth, window.innerWidth - this.resizeStart.left - 10);
      newWidth = Math.max(this.minWidth, Math.min(proposedWidth, maxWidth));
    }

    if (resizingBottom) {
      const proposedHeight = this.resizeStart.height + dy;
      const maxHeight = Math.max(this.minHeight, window.innerHeight - this.resizeStart.top - 10);
      newHeight = Math.max(this.minHeight, Math.min(proposedHeight, maxHeight));
    }

    if (resizingTop) {
      const proposedTop = this.resizeStart.top + dy;
      newTop = Math.min(bottomEdge - this.minHeight, Math.max(0, proposedTop));
      const maxHeight = Math.max(this.minHeight, window.innerHeight - newTop - 10);
      newHeight = Math.min(bottomEdge - newTop, maxHeight);
    }

    this.popover.style.width = `${newWidth}px`;
    this.popover.style.left = `${newLeft}px`;
    this.popover.style.right = "auto";

    if (resizingTop) {
      this.popover.style.top = `${newTop}px`;
    }

    if (resizingBottom || resizingTop) {
      this.popover.style.height = `${newHeight}px`;
    }
  }

  onResizeEnd() {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.resizeDirection = null;
    this.resizeStart = null;
    document.body.style.userSelect = "";

    const rect = this.popover.getBoundingClientRect();
    this.lastOwnPosition = { left: rect.left, top: rect.top };
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
      this.popover.style.display = "flex";
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
    this.popover.style.display = "flex";
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
    this.lastOwnPosition = { left: rect.left, top: rect.top };
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

    // Reset object click flag when clicking outside canvas
    document.addEventListener("mousedown", (e) => {
      const fabricCanvas = window.fabricCanvas;
      const upperCanvas = fabricCanvas && fabricCanvas.upperCanvasEl;
      if (upperCanvas && e.target !== upperCanvas) {
        this.clickedOnObject = false;
        this.lastClickedTarget = null;
      }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (this.popover.style.display !== "block") return;
      if (Date.now() - this.lastOpenedTs < 150) return;

      // Don't close if clicking on a modal or inside a modal
      const isModalClick = e.target.closest(".modal") || e.target.closest(".modal-backdrop") || 
                          e.target.hasAttribute("data-bs-toggle") && e.target.getAttribute("data-bs-toggle") === "modal";
      if (isModalClick) return;

      const shouldPrevent = this.options.shouldPreventClose ? this.options.shouldPreventClose(e) : false;
      if (!this.popover.contains(e.target) && e.target !== this.popover && !shouldPrevent) {
        // If the click originated on a fabric object, only ignore if it's our current target
        if (this.clickedOnObject) {
          const isSameTarget = this.lastClickedTarget === this.currentTarget;
          this.clickedOnObject = false;
          this.lastClickedTarget = null;
          if (isSameTarget) return;
        }
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
      const noSavedPos = !this.lastOwnPosition;

      if (isVisible && hasTarget && isNotDragging && noSavedPos) {
        this.positionPopover();
      }
    });
  }

  // Hooks into canvas events for hiding during movement
  hookCanvasEvents() {
    const setupEvents = () => {
      const fabricCanvas = window.fabricCanvas;
      if (!fabricCanvas) return false;

      // Prevent attaching listeners multiple times
      if (this._canvasEventsHooked) return true;

      fabricCanvas.on("mouse:down", (e) => {
        this.clickedOnObject = !!e.target;
        this.lastClickedTarget = e.target;
      });

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

      this._canvasEventsHooked = true;
      return true;
    };

    // Try immediately
    if (!setupEvents()) {
      // Retry on window load if not yet loaded
      if (document.readyState !== "complete") {
        window.addEventListener("load", () => setTimeout(setupEvents, 200));
      }

      // Poll until canvas is available (fallback for async init)
      const maxAttempts = 50;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (setupEvents() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 200);
    }
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
