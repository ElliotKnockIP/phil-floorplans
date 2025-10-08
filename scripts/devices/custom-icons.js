// Manages the Custom Icons section: upload, list, drag, persistence
// Storage: localStorage key 'customIconsV1'. Each item: { id, name, isCamera, dataUrl, createdAt }

import { addCameraCoverage } from "./camera-coverage.js";

const STORAGE_KEY = "customIconsV1";

function loadIcons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure each icon has sections, default to ["custom"]
    return parsed
      .filter((x) => x && x.id && x.dataUrl)
      .map((icon) => ({
        ...icon,
        sections: icon.sections || ["custom"],
      }));
  } catch (e) {
    console.error("Failed to load custom icons:", e);
    return [];
  }
}

function saveIcons(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save custom icons:", e);
  }
}

function uid() {
  return "ci_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function renderList() {
  const listEl = document.getElementById("custom-icons-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const icons = loadIcons();
  const customIcons = icons.filter((icon) => icon.sections && icon.sections.includes("custom"));
  if (!customIcons.length) {
    const empty = document.createElement("div");
    empty.className = "text-muted p-2";
    empty.textContent = "No custom icons yet";
    listEl.appendChild(empty);
    return;
  }

  let rowEl = null;
  customIcons.forEach((icon, idx) => {
    // Start a new row every 3 items
    if (idx % 3 === 0) {
      rowEl = document.createElement("div");
      rowEl.className = "device-row";
      listEl.appendChild(rowEl);
    }

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    const item = document.createElement("div");
    item.className = "device-item";
    item.setAttribute("draggable", "true");
    item.dataset.device = icon.id; // use id as device key
    item.dataset.isCamera = icon.isCamera ? "1" : "0";
    item.dataset.name = icon.name || "Custom Icon";
    item.dataset.dataUrl = icon.dataUrl;

    const iconBox = document.createElement("div");
    iconBox.className = "device-icon";

    const img = document.createElement("img");
    img.src = icon.dataUrl;
    img.alt = icon.name || "Custom Icon";
    img.style.maxWidth = "100%";

    iconBox.appendChild(img);
    item.appendChild(iconBox);

    // Optional title tooltip
    item.title = `${icon.name || "Custom Icon"}${icon.isCamera ? " (Camera)" : ""}`;

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-sm";
    delBtn.textContent = "Delete";
    delBtn.style.backgroundColor = "var(--orange-ip2)";
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.dataset.section = "custom"; // For custom section
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const sectionToRemove = e.target.dataset.section;
      const iconId = icon.id;
      const current = loadIcons();
      const updated = current
        .map((ic) => {
          if (ic.id === iconId) {
            const newSections = ic.sections.filter((s) => s !== sectionToRemove);
            if (newSections.length === 0) {
              return null; // Mark for removal
            } else {
              return { ...ic, sections: newSections };
            }
          }
          return ic;
        })
        .filter((ic) => ic !== null);
      saveIcons(updated);
      renderAllSections();
    });

    wrapper.appendChild(item);
    wrapper.appendChild(delBtn);
    rowEl.appendChild(wrapper);
  });

  // activate drag
  setupDragHandlers();
}

function renderCustomIconsInSections() {
  const icons = loadIcons();
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
    if (icon.sections) {
      icon.sections.forEach((sec) => {
        if (sec !== "custom") {
          if (!sectionIcons[sec]) sectionIcons[sec] = [];
          sectionIcons[sec].push(icon);
        }
      });
    }
  });

  // Render in each section
  Object.keys(sections).forEach((sec) => {
    const container = sections[sec];
    if (!container || !sectionIcons[sec]) return;

    const iconsForSec = sectionIcons[sec];
    let rowEl = null;
    iconsForSec.forEach((icon, idx) => {
      // Start a new row every 3 items
      if (idx % 3 === 0) {
        rowEl = document.createElement("div");
        rowEl.className = "device-row custom-device-row";
        container.appendChild(rowEl);
      }

      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";

      const item = document.createElement("div");
      item.className = "device-item";
      item.setAttribute("draggable", "true");
      item.dataset.device = icon.id;
      item.dataset.isCamera = icon.isCamera ? "1" : "0";
      item.dataset.name = icon.name || "Custom Icon";
      item.dataset.dataUrl = icon.dataUrl;

      const iconBox = document.createElement("div");
      iconBox.className = "device-icon";

      const img = document.createElement("img");
      img.src = icon.dataUrl;
      img.alt = icon.name || "Custom Icon";
      img.style.maxWidth = "100%";

      iconBox.appendChild(img);
      item.appendChild(iconBox);

      item.title = `${icon.name || "Custom Icon"}${icon.isCamera ? " (Camera)" : ""}`;

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-sm";
      delBtn.textContent = "Delete";
      delBtn.style.backgroundColor = "var(--orange-ip2)";
      delBtn.style.color = "white";
      delBtn.style.border = "none";
      delBtn.dataset.section = sec; // Store the section
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const sectionToRemove = e.target.dataset.section;
        const iconId = icon.id;
        const current = loadIcons();
        const updated = current
          .map((ic) => {
            if (ic.id === iconId) {
              const newSections = ic.sections.filter((s) => s !== sectionToRemove);
              if (newSections.length === 0) {
                return null; // Mark for removal
              } else {
                return { ...ic, sections: newSections };
              }
            }
            return ic;
          })
          .filter((ic) => ic !== null);
        saveIcons(updated);
        renderAllSections();
      });

      wrapper.appendChild(item);
      wrapper.appendChild(delBtn);
      rowEl.appendChild(wrapper);
    });
  });

  // Setup drag for new items
  setupDragHandlers();
}

function renderAllSections() {
  renderList();
  renderCustomIconsInSections();
}

function setupButtons() {
  const addBtn = document.getElementById("add-custom-icon-btn");
  const saveBtn = document.getElementById("save-custom-icon-btn");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("custom-icon-modal"));
      // reset
      const file = document.getElementById("custom-icon-file");
      const name = document.getElementById("custom-icon-name");
      const isCam = document.getElementById("custom-icon-is-camera");
      const cctv = document.getElementById("custom-icon-cctv");
      const access = document.getElementById("custom-icon-access");
      const intruder = document.getElementById("custom-icon-intruder");
      const fire = document.getElementById("custom-icon-fire");
      const custom = document.getElementById("custom-icon-custom");
      if (file) file.value = "";
      if (name) name.value = "";
      if (isCam) isCam.checked = false;
      if (cctv) cctv.checked = false;
      if (access) access.checked = false;
      if (intruder) intruder.checked = false;
      if (fire) fire.checked = false;
      if (custom) custom.checked = true;
      modal.show();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const file = document.getElementById("custom-icon-file");
      const name = document.getElementById("custom-icon-name");
      const isCam = document.getElementById("custom-icon-is-camera");
      const cctv = document.getElementById("custom-icon-cctv");
      const access = document.getElementById("custom-icon-access");
      const intruder = document.getElementById("custom-icon-intruder");
      const fire = document.getElementById("custom-icon-fire");
      const custom = document.getElementById("custom-icon-custom");
      if (!file || !file.files || !file.files[0]) {
        alert("Please choose an image file");
        return;
      }
      const f = file.files[0];
      if (!/^image\/(png|jpeg)$/.test(f.type)) {
        alert("Only PNG or JPG images are supported");
        return;
      }
      const dataUrl = await readFileAsDataUrl(f);
      const sections = [];
      if (cctv && cctv.checked) sections.push("cctv");
      if (access && access.checked) sections.push("access");
      if (intruder && intruder.checked) sections.push("intruder");
      if (fire && fire.checked) sections.push("fire");
      if (custom && custom.checked) sections.push("custom");
      const entry = {
        id: uid(),
        name: (name && name.value.trim()) || f.name.replace(/\.[^.]+$/, ""),
        isCamera: !!(isCam && isCam.checked),
        sections: sections,
        dataUrl,
        createdAt: Date.now(),
      };
      const icons = loadIcons();
      icons.push(entry);
      saveIcons(icons);
      renderAllSections();
      const modalEl = document.getElementById("custom-icon-modal");
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    });
  }

  // Import/Export removed; custom icons persist in browser storage and via project Save/Load
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupDragHandlers() {
  const items = document.querySelectorAll("#custom-icons-list .device-item, .custom-device-row .device-item");
  items.forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      const dataUrl = item.dataset.dataUrl;
      const isCamera = item.dataset.isCamera === "1";
      const payload = {
        type: "custom-icon",
        dataUrl,
        isCamera,
        name: item.dataset.name || "Custom Icon",
      };
      try {
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
      } catch (_) {}
      // Fallback to text/plain with dataUrl (existing drop handler will still work as non-camera unless we extend it)
      e.dataTransfer.setData("text/plain", dataUrl);
      e.dataTransfer.effectAllowed = "copy";
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
  });
}

// Enhance global drop to recognize custom payload for camera coverage
function patchDropHandler() {
  // We will wrap the existing add drop listener if possible
  // The drop logic lives inside initDragDropDevices; we can't rewrite it here,
  // but we can listen for drop on the same container first to set a flag on the dataTransfer
  // Instead, we expose a helper on window for the main handler to detect custom payloads.
  window.__getCustomDropPayload = function (dataTransfer) {
    try {
      const json = dataTransfer.getData("application/json");
      if (!json) return null;
      const parsed = JSON.parse(json);
      if (parsed && parsed.type === "custom-icon" && parsed.dataUrl) return parsed;
    } catch (e) {}
    return null;
  };
}

// Patch save system so custom camera icons are treated like cameras for coverage persistence
function patchSaveSerializer() {
  // camera-device-save.js uses deviceType string detection to decide camera; for custom cameras we rely on coverageConfig presence
  // No patch needed if coverage is attached by drop; we just ensure coverage is added for custom payloads when isCamera=true
}

function init() {
  renderAllSections();
  setupButtons();
  patchDropHandler();
}

document.addEventListener("DOMContentLoaded", init);
