// CustomIcons class manages custom icon creation and management
export class CustomIcons {
  constructor() {
    this.storageKey = "customIconsV1";
    this.init();
  }

  // Load custom icons from local storage
  loadIcons() {
    try {
      const raw = localStorage.getItem(this.storageKey);
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

  // Save custom icons to local storage
  saveIcons(list) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch (e) {
      console.error("Failed to save custom icons:", e);
    }
  }

  // Generate unique ID
  generateId() {
    return "ci_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Convert file to data URL
  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Create device item element for icon list
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

    // Delete button
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

  // Render icons in rows
  renderIconsInRows(icons, containerId, className = "device-row", section = "custom") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing rows
    const existingRows = container.querySelectorAll(`.${className}`);
    existingRows.forEach((row) => row.remove());

    if (!icons.length) {
      // Show empty message for custom section only
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
      if (idx % 3 === 0) {
        rowEl = document.createElement("div");
        rowEl.className = className;
        container.appendChild(rowEl);
      }
      rowEl.appendChild(this.createDeviceItem(icon, section));
    });
  }

  // Render custom icons list
  renderList() {
    const icons = this.loadIcons();
    const customIcons = icons.filter((icon) => icon.sections?.includes("custom"));
    this.renderIconsInRows(customIcons, "custom-icons-list");
    this.setupDragHandlers();
  }

  // Render custom icons in device sections
  renderCustomIconsInSections() {
    const icons = this.loadIcons();
    const sections = {
      cctv: document.getElementById("cctv-collapse"),
      access: document.getElementById("access-collapse"),
      intruder: document.getElementById("intruder-collapse"),
      fire: document.getElementById("fire-collapse"),
    };

    // Clear existing custom icons from sections
    Object.values(sections).forEach((container) => {
      if (container) {
        const customRows = container.querySelectorAll(".custom-device-row");
        customRows.forEach((row) => row.remove());
      }
    });

    // Group icons by section
    const sectionIcons = {};
    icons.forEach((icon) => {
      icon.sections?.forEach((sec) => {
        if (sec !== "custom") {
          if (!sectionIcons[sec]) sectionIcons[sec] = [];
          sectionIcons[sec].push(icon);
        }
      });
    });

    // Render in each section
    Object.entries(sections).forEach(([sec, container]) => {
      if (container && sectionIcons[sec]) {
        this.renderIconsInRows(sectionIcons[sec], container.id, "device-row custom-device-row", sec);
      }
    });
    this.setupDragHandlers();
  }

  // Render all sections
  renderAllSections() {
    this.renderList();
    this.renderCustomIconsInSections();
  }

  // Setup modal buttons
  setupButtons() {
    const addBtn = document.getElementById("add-custom-icon-btn");
    const saveBtn = document.getElementById("save-custom-icon-btn");

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("custom-icon-modal"));
        // Reset form
        const inputs = ["custom-icon-file", "custom-icon-name", "custom-icon-is-camera", "custom-icon-cctv", "custom-icon-access", "custom-icon-intruder", "custom-icon-fire"];
        inputs.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === "checkbox") el.checked = id === "custom-icon-custom";
            else el.value = "";
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

        if (!file?.files?.[0]) {
          alert("Please choose an image file");
          return;
        }

        const f = file.files[0];
        if (!/^image\/(png|jpeg)$/.test(f.type)) {
          alert("Only PNG or JPG images are supported");
          return;
        }

        const dataUrl = await this.readFileAsDataUrl(f);
        const sections = [];
        ["custom-icon-cctv", "custom-icon-access", "custom-icon-intruder", "custom-icon-fire", "custom-icon-custom"].forEach((id) => {
          const el = document.getElementById(id);
          if (el?.checked) sections.push(id.replace("custom-icon-", ""));
        });

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

  // Setup drag handlers
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

  // Patch drop handler to support custom icons
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

  // Initialize the custom icons system
  init() {
    const initialize = () => {
      this.renderAllSections();
      this.setupButtons();
      this.patchDropHandler();
    };

    if (document.getElementById("save-custom-icon-btn")) {
      initialize();
    } else {
      document.addEventListener("htmlIncludesLoaded", initialize);
    }
  }
}

// Initialize custom icons
new CustomIcons();
