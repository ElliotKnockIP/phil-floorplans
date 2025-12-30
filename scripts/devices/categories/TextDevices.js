// TextDevices class manages custom text device creation and management
export class TextDevices {
  constructor() {
    this.storageKey = "textDevicesV1";
    this.textDevices = this.loadTextDevices();
    this.init();
  }

  // Load text devices from local storage
  loadTextDevices() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .filter((x) => x?.id && x?.text)
            .map((x) => ({
              ...x,
              name: x.name || x.text, // Backward compatibility
            }))
        : [];
    } catch (e) {
      console.error("Failed to load text devices:", e);
      return [];
    }
  }

  // Save text devices to local storage
  saveTextDevices(list) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch (e) {
      console.error("Failed to save text devices:", e);
    }
  }

  // Generate unique ID
  generateId() {
    return "td_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Create preview element for text device
  createTextDevicePreview(text, shape, bgColor, textColor) {
    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.display = "inline-block";

    if (shape === "rectangle") {
      Object.assign(container.style, {
        backgroundColor: bgColor,
        padding: "4px 8px",
        borderRadius: "4px",
      });
    } else if (shape === "circle") {
      Object.assign(container.style, {
        backgroundColor: bgColor,
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
    }

    const textEl = document.createElement("span");
    Object.assign(textEl.style, {
      color: textColor,
      fontSize: "12px",
      fontWeight: "bold",
      fontFamily: "Poppins, sans-serif",
    });
    textEl.textContent = text;
    container.appendChild(textEl);
    return container;
  }

  // Create device item element for list
  createDeviceItem(device) {
    const wrapper = document.createElement("div");
    wrapper.className = "device-wrapper";

    const item = document.createElement("div");
    item.className = "device-item text-device-item";
    item.setAttribute("draggable", "true");
    item.dataset.device = device.id;
    item.dataset.text = device.text;
    item.dataset.name = device.name;
    item.dataset.shape = device.shape;
    item.dataset.bgColor = device.bgColor;
    item.dataset.textColor = device.textColor;
    item.title = device.name;

    const iconBox = document.createElement("div");
    Object.assign(iconBox.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "50px",
    });
    iconBox.className = "device-icon";
    iconBox.appendChild(this.createTextDevicePreview(device.text, device.shape, device.bgColor, device.textColor));
    item.appendChild(iconBox);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "device-delete-btn";
    delBtn.innerHTML = "&times;";
    delBtn.title = "Delete";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.textDevices = this.textDevices.filter((d) => d.id !== device.id);
      this.saveTextDevices(this.textDevices);
      this.renderList();
    });
    item.appendChild(delBtn);

    const deviceLabel = document.createElement("div");
    deviceLabel.className = "device-label";
    deviceLabel.textContent = device.name;
    wrapper.appendChild(item);
    wrapper.appendChild(deviceLabel);
    return wrapper;
  }

  // Render text devices list
  renderList() {
    const listEl = document.getElementById("text-devices-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!this.textDevices.length) {
      const empty = document.createElement("div");
      empty.className = "text-muted p-2";
      empty.textContent = "No text devices yet";
      listEl.appendChild(empty);
      return;
    }

    let rowEl = null;
    this.textDevices.forEach((device, idx) => {
      if (idx % 3 === 0) {
        rowEl = document.createElement("div");
        rowEl.className = "device-row";
        listEl.appendChild(rowEl);
      }
      rowEl.appendChild(this.createDeviceItem(device));
    });
    this.setupDragHandlers();
  }

  // Setup modal buttons
  setupButtons() {
    const addBtn = document.getElementById("add-text-device-btn");
    const saveBtn = document.getElementById("save-text-device-btn");

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("text-device-modal"));
        // Reset form
        const inputs = {
          "text-device-text": "",
          "text-device-name": "",
          "text-device-shape": "rectangle",
          "text-device-bg-color": "#f8794b",
          "text-device-text-color": "#ffffff",
        };
        Object.entries(inputs).forEach(([id, value]) => {
          const el = document.getElementById(id);
          if (el) el.value = value;
        });
        modal.show();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const textInput = document.getElementById("text-device-text");
        const nameInput = document.getElementById("text-device-name");
        const shapeSelect = document.getElementById("text-device-shape");
        const bgColorInput = document.getElementById("text-device-bg-color");
        const textColorInput = document.getElementById("text-device-text-color");

        if (!textInput?.value.trim()) {
          alert("Please enter device text");
          return;
        }

        const entry = {
          id: this.generateId(),
          text: textInput.value.trim(),
          name: nameInput?.value.trim() || textInput.value.trim(),
          shape: shapeSelect?.value || "rectangle",
          bgColor: bgColorInput?.value || "#f8794b",
          textColor: textColorInput?.value || "#ffffff",
          createdAt: Date.now(),
        };

        this.textDevices.push(entry);
        this.saveTextDevices(this.textDevices);
        this.renderList();

        const modalEl = document.getElementById("text-device-modal");
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      });
    }
  }

  // Setup drag handlers
  setupDragHandlers() {
    const items = document.querySelectorAll(".text-device-item");
    items.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        const payload = {
          type: "text-device",
          text: item.dataset.text,
          name: item.dataset.name,
          shape: item.dataset.shape,
          bgColor: item.dataset.bgColor,
          textColor: item.dataset.textColor,
        };

        try {
          e.dataTransfer.setData("application/json", JSON.stringify(payload));
        } catch (_) {}
        e.dataTransfer.effectAllowed = "copy";
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", () => item.classList.remove("dragging"));
    });
  }

  // Create text device on canvas
  createTextDeviceOnCanvas(fabricCanvas, canvasX, canvasY, payload) {
    if (!payload || payload.type !== "text-device") return false;

    const { text, shape, bgColor, textColor } = payload;
    const scaleFactor = Math.max(1, Math.min(100, window.defaultDeviceIconSize || 30)) / 30;
    const fontSize = 14 * scaleFactor;

    // Create shape object
    let shapeObj = null;
    if (shape === "rectangle") {
      const tempText = new fabric.Text(text, {
        fontSize,
        fontFamily: "Poppins, sans-serif",
        fontWeight: "normal",
      });
      const padding = 8 * scaleFactor;
      shapeObj = new fabric.Rect({
        width: tempText.width + padding * 2,
        height: tempText.height + padding * 2,
        fill: bgColor,
        rx: 4 * scaleFactor,
        ry: 4 * scaleFactor,
        originX: "center",
        originY: "center",
      });
    } else if (shape === "circle") {
      const radius = 20 * scaleFactor;
      shapeObj = new fabric.Circle({
        radius,
        fill: bgColor,
        originX: "center",
        originY: "center",
      });
    }

    // Create text object
    const textObj = new fabric.Text(text, {
      fontSize,
      fontFamily: "Poppins, sans-serif",
      fontWeight: "normal",
      fill: textColor,
      originX: "center",
      originY: "center",
    });

    // Create group
    const groupItems = shape === "none" ? [textObj] : [shapeObj, textObj];
    const group = new fabric.Group(groupItems, {
      left: canvasX,
      top: canvasY,
      originX: "center",
      originY: "center",
      selectable: true,
      hasControls: false,
      borderColor: "#000000",
      borderScaleFactor: 2,
      scaleFactor,
    });

    // Set properties
    if (!group.id) {
      group.id = `text_device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    group.deviceType = "text-device";
    group.textDeviceConfig = { text, shape, bgColor, textColor };
    group.initialLabelText = text;

    // Initialize device properties
    ["location", "mountedPosition", "partNumber", "stockNumber", "ipAddress", "subnetMask", "gatewayAddress", "macAddress"].forEach((prop) => (group[prop] = ""));

    // Create label (hidden by default)
    const labelText = new fabric.Text(text, {
      left: canvasX,
      top: canvasY + (shape === "circle" ? 20 * scaleFactor : 30 * scaleFactor) + 10,
      fontFamily: window.globalFont || "Poppins, sans-serif",
      fontSize: 12 * scaleFactor,
      fontWeight: window.globalBoldText ? "bold" : "normal",
      fill: window.globalTextColor || "#FFFFFF",
      selectable: false,
      backgroundColor: window.globalTextBackground !== false ? "rgba(20, 18, 18, 0.8)" : "transparent",
      originX: "center",
      originY: "top",
      isDeviceLabel: true,
      visible: false,
      _isHidden: true,
    });

    labelText._parentGroup = group;
    group.textObject = labelText;
    group.labelHidden = true;

    // Event handlers
    group.on("moving", () => {
      const groupCenter = group.getCenterPoint();
      const currentScaleFactor = group.scaleFactor || 1;
      labelText.set({
        left: groupCenter.x,
        top: groupCenter.y + (shape === "circle" ? 20 * currentScaleFactor : 30 * currentScaleFactor) + 10,
      });
      labelText.setCoords();
      group.bringToFront();
      fabricCanvas.requestRenderAll();
    });

    group.isFirstSelectionAfterDrop = true;
    group.on("selected", () => {
      if (window.suppressDeviceProperties) return;
      if (group.isFirstSelectionAfterDrop) {
        group.isFirstSelectionAfterDrop = false;
        return;
      }
      if (window.showDeviceProperties) {
        window.showDeviceProperties(group.deviceType, group.textObject, group);
      }
      group.bringToFront();
      fabricCanvas.renderAll();
    });

    group.on("deselected", () => window.hideDeviceProperties?.());
    group.on("removed", () => {
      if (labelText) fabricCanvas.remove(labelText);
      fabricCanvas.renderAll();
    });

    // Add to canvas
    fabricCanvas.add(group);
    group.bringToFront();
    fabricCanvas.setActiveObject(group);

    // Update device complete indicator
    setTimeout(() => {
      if (typeof window.updateDeviceCompleteIndicator === "function") {
        window.updateDeviceCompleteIndicator(group);
      }
    }, 100);

    fabricCanvas.renderAll();
    return true;
  }

  // Patch drop handler to support text devices
  patchDropHandler() {
    const originalHandler = window.__getCustomDropPayload;
    window.__getCustomDropPayload = function (dataTransfer) {
      try {
        const json = dataTransfer.getData("application/json");
        if (!json) return originalHandler ? originalHandler(dataTransfer) : null;
        const parsed = JSON.parse(json);
        if (parsed?.type === "text-device") return parsed;
      } catch (e) {}
      return originalHandler ? originalHandler(dataTransfer) : null;
    };
  }

  // Patch device creation function
  patchDeviceCreation() {
    window.createTextDeviceOnCanvas = (fabricCanvas, canvasX, canvasY, payload) => this.createTextDeviceOnCanvas(fabricCanvas, canvasX, canvasY, payload);
  }

  // Initialize the text devices system
  init() {
    const initialize = () => {
      this.renderList();
      this.setupButtons();
      this.patchDropHandler();
      this.patchDeviceCreation();
    };

    if (document.getElementById("save-text-device-btn")) {
      initialize();
    } else {
      document.addEventListener("htmlIncludesLoaded", initialize);
    }

    // Add canvas drop listener
    document.addEventListener("canvas:initialized", (e) => {
      const fabricCanvas = e.detail.canvas;
      if (!fabricCanvas) return;

      const canvasElement = fabricCanvas.getElement();
      const canvasContainer = canvasElement.parentElement;

      canvasContainer.addEventListener(
        "drop",
        (e) => {
          const customPayload = typeof window.__getCustomDropPayload === "function" ? window.__getCustomDropPayload(e.dataTransfer) : null;

          if (customPayload?.type === "text-device") {
            e.preventDefault();
            e.stopPropagation();

            const rect = canvasElement.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            const vpt = fabricCanvas.viewportTransform;
            const zoom = fabricCanvas.getZoom();

            const canvasX = (clientX - vpt[4]) / zoom;
            const canvasY = (clientY - vpt[5]) / zoom;

            if (window.createTextDeviceOnCanvas) {
              window.createTextDeviceOnCanvas(fabricCanvas, canvasX, canvasY, customPayload);
            }
          }
        },
        true
      );
    });
  }
}

// Initialize text devices
new TextDevices();
