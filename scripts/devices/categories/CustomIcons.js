// Manages custom icon creation and storage
export class CustomIcons {
  constructor() {
    this.storageKey = "customIconsV1";
    this.init();
  }

  // Load custom icons from storage
  // NEED TO DO: Replace with database
  loadIcons() {
    try {
      if (!this._memoryStore) this._memoryStore = {};
      const raw = this._memoryStore[this.storageKey];
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .filter((x) => x?.id && x?.dataUrl)
            .map((icon) => ({
              ...icon,
              sections: icon.sections || ["custom"],
            }))
        : [];
    } catch (e) {
      console.error("Failed to load custom icons:", e);
      return [];
    }
  }

  // Save custom icons list to storage
  // NEED TO DO: Replace with database
  saveIcons(list) {
    try {
      if (!this._memoryStore) this._memoryStore = {};
      this._memoryStore[this.storageKey] = JSON.stringify(list);
      console.log("[DB Placeholder] Would save custom icons");
    } catch (e) {
      console.error("Failed to save custom icons:", e);
    }
  }

  // Generate a unique ID for a new icon
  generateId() {
    return "ci_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Convert a file object to a data URL string
  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Create the HTML element for a device icon in the sidebar
  createDeviceItem(icon, section = "custom") {
    const wrapper = document.createElement("div");
    wrapper.className = "device-wrapper";

    const item = document.createElement("div");
    item.className = "device-item";
    item.setAttribute("draggable", "true");
    item.dataset.device = icon.id;
    item.dataset.isCamera = icon.isCamera ? "1" : "0";
    item.dataset.name = icon.name || "Custom Icon";
    item.dataset.dataUrl = icon.dataUrl;
    item.title = `${icon.name || "Custom Icon"}${icon.isCamera ? " (Camera)" : ""}`;

    const iconBox = document.createElement("div");
    iconBox.className = "device-icon";
    const img = document.createElement("img");
    img.src = icon.dataUrl;
    img.alt = icon.name || "Custom Icon";
    img.style.maxWidth = "100%";
    iconBox.appendChild(img);
    item.appendChild(iconBox);

    // Create and setup the delete button for the icon
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "device-delete-btn";
    delBtn.innerHTML = "&times;";
    delBtn.title = "Delete";
    delBtn.dataset.section = section;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const current = this.loadIcons();
      const updated = current
        .map((ic) => {
          if (ic.id === icon.id) {
            const newSections = ic.sections.filter((s) => s !== section);
            return newSections.length === 0 ? null : { ...ic, sections: newSections };
          }
          return ic;
        })
        .filter((ic) => ic !== null);
      this.saveIcons(updated);
      this.renderAllSections();
    });
    item.appendChild(delBtn);

    const label = document.createElement("div");
    label.className = "device-label";
    label.textContent = icon.name || "Custom Icon";
    wrapper.appendChild(item);
    wrapper.appendChild(label);
    return wrapper;
  }

  // Render a list of icons into rows within a container
  renderIconsInRows(icons, containerId, className = "device-row", section = "custom") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove existing rows before re-rendering
    const existingRows = container.querySelectorAll(`.${className}`);
    existingRows.forEach((row) => row.remove());

    if (!icons.length) {
      // Show empty message if no icons exist in the custom section
      if (section === "custom") {
        const empty = document.createElement("div");
        empty.className = "text-muted p-2";
        empty.textContent = "No custom icons yet";
        container.appendChild(empty);
      }
      return;
    }

    let rowEl = null;
    icons.forEach((icon, idx) => {
      // Create a new row every 3 items
      if (idx % 3 === 0) {
        rowEl = document.createElement("div");
        rowEl.className = className;
        container.appendChild(rowEl);
      }
      rowEl.appendChild(this.createDeviceItem(icon, section));
    });
  }

  // Render the main custom icons list
  renderList() {
    const icons = this.loadIcons();
    const customIcons = icons.filter((icon) => icon.sections?.includes("custom"));
    this.renderIconsInRows(customIcons, "custom-icons-list");
    this.setupDragHandlers();
  }

  // Render custom icons into their respective category sections
  renderCustomIconsInSections() {
    const icons = this.loadIcons();
    const sections = {
      cctv: document.getElementById("cctv-collapse"),
      access: document.getElementById("access-collapse"),
      intruder: document.getElementById("intruder-collapse"),
      fire: document.getElementById("fire-collapse"),
    };

    // Clear existing custom rows from category containers
    Object.values(sections).forEach((container) => {
      if (container) {
        const customRows = container.querySelectorAll(".custom-device-row");
        customRows.forEach((row) => row.remove());
      }
    });

    // Group icons by their assigned sections
    const sectionIcons = {};
    icons.forEach((icon) => {
      icon.sections?.forEach((sec) => {
        if (sec !== "custom") {
          if (!sectionIcons[sec]) sectionIcons[sec] = [];
          sectionIcons[sec].push(icon);
        }
      });
    });

    // Render icons into each category container
    Object.entries(sections).forEach(([sec, container]) => {
      if (container && sectionIcons[sec]) {
        this.renderIconsInRows(sectionIcons[sec], container.id, "device-row custom-device-row", sec);
      }
    });
    this.setupDragHandlers();
  }

  // Render all icon sections and categories
  renderAllSections() {
    this.renderList();
    this.renderCustomIconsInSections();
  }

  // Setup event listeners for modal buttons
  setupButtons() {
    const addBtn = document.getElementById("add-custom-icon-btn");
    const saveBtn = document.getElementById("save-custom-icon-btn");

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("custom-icon-modal"));
        // Reset all form inputs to default state
        const inputs = ["custom-icon-file", "custom-icon-name", "custom-icon-is-camera", "custom-icon-cctv", "custom-icon-access", "custom-icon-intruder", "custom-icon-fire"];
        inputs.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === "checkbox") {
              el.checked = id === "custom-icon-custom";
            } else {
              el.value = "";
            }
          }
        });
        modal.show();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const file = document.getElementById("custom-icon-file");
        const name = document.getElementById("custom-icon-name");
        const isCam = document.getElementById("custom-icon-is-camera");

        // Validate that a file was selected
        if (!file?.files?.[0]) {
          alert("Please choose an image file");
          return;
        }

        const f = file.files[0];
        // Ensure file is a supported image type
        if (!/^image\/(png|jpeg)$/.test(f.type)) {
          alert("Only PNG or JPG images are supported");
          return;
        }

        const dataUrl = await this.readFileAsDataUrl(f);
        const sections = [];
        // Collect selected categories for the new icon
        const iconIds = ["custom-icon-cctv", "custom-icon-access", "custom-icon-intruder", "custom-icon-fire", "custom-icon-custom"];
        iconIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el?.checked) sections.push(id.replace("custom-icon-", ""));
        });

        // Create the new icon entry object
        const entry = {
          id: this.generateId(),
          name: name?.value.trim() || f.name.replace(/\.[^.]+$/, ""),
          isCamera: !!isCam?.checked,
          sections,
          dataUrl,
          createdAt: Date.now(),
        };

        const icons = this.loadIcons();
        icons.push(entry);
        this.saveIcons(icons);
        this.renderAllSections();

        const modalEl = document.getElementById("custom-icon-modal");
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      });
    }
  }

  // Setup drag and drop event listeners for icons
  setupDragHandlers() {
    const items = document.querySelectorAll("#custom-icons-list .device-item, .custom-device-row .device-item");
    items.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        const payload = {
          type: "custom-icon",
          dataUrl: item.dataset.dataUrl,
          isCamera: item.dataset.isCamera === "1",
          name: item.dataset.name || "Custom Icon",
        };

        // Set drag data payload
        try {
          e.dataTransfer.setData("application/json", JSON.stringify(payload));
        } catch (_) {}
        e.dataTransfer.setData("text/plain", item.dataset.dataUrl);
        e.dataTransfer.effectAllowed = "copy";
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", () => item.classList.remove("dragging"));
    });
  }

  // Patch the global drop handler to support custom icon data
  patchDropHandler() {
    window.__getCustomDropPayload = function (dataTransfer) {
      try {
        const json = dataTransfer.getData("application/json");
        if (!json) return null;
        const parsed = JSON.parse(json);
        if (parsed?.type === "custom-icon" && parsed.dataUrl) return parsed;
      } catch (e) {}
      return null;
    };
  }

  // Initialize the custom icons system and setup listeners
  init() {
    const initialize = () => {
      this.renderAllSections();
      this.setupButtons();
      this.patchDropHandler();
    };

    // Wait for HTML includes to load if necessary
    if (document.getElementById("save-custom-icon-btn")) {
      initialize();
    } else {
      document.addEventListener("htmlIncludesLoaded", initialize);
    }
  }
}

// Create instance of CustomIcons
new CustomIcons();
