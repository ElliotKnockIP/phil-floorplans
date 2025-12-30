// Project Library - Handles saving, loading, and managing projects with thumbnails
import { SaveSystem } from "./save-system.js";
import { NotificationSystem } from "./utils-save.js";

class ProjectManager {
  // Configuration constants
  static MAX_ITEMS_PREVIEW = 5; // Number of items to show in preview mode
  static THUMBNAIL_SCALE = 0.2; // Thumbnail scale factor
  static THUMBNAIL_QUALITY = 0.8; // Thumbnail image quality
  static SCROLL_MULTIPLIER = 4; // Mouse wheel scroll speed multiplier
  static PROJECT_VERSION = "4.0"; // Project file format version
  static ID_RANDOM_LENGTH = 9; // Length of random ID suffix

  constructor(fabricCanvas, saveSystem) {
    this.fabricCanvas = fabricCanvas;
    this.saveSystem = saveSystem;
    this.storageKey = "floorplan_projects";
    this.templatesKey = "floorplan_templates";
    this.init();
  }

  init() {
    this.setupLibraryModal();
    this.setupEventListeners();
    this.loadDefaultTemplates();
  }

  // Serializes all project data including cameras, drawings, canvas, and settings
  async serializeProjectData() {
    const cameraData = this.saveSystem.cameraSerializer.serializeCameraDevices();
    const drawingData = this.saveSystem.drawingSerializer.serializeDrawingObjects();
    const clientDetails = this.saveSystem.serializeClientDetails();
    const screenshots = this.saveSystem.serializeScreenshots();
    const topologyData = this.saveSystem.serializeTopologyData();

    // Temporarily remove managed objects to get clean canvas background
    const allObjects = this.fabricCanvas.getObjects();
    const { ObjectTypeUtils } = await import("./utils-save.js");
    const managedObjects = allObjects.filter((obj) => ObjectTypeUtils.isManagedObject(obj));
    const drawingObjects = allObjects.filter((obj) => this.saveSystem.drawingSerializer.isDrawingObject(obj));
    const objectsToRemove = [...new Set([...managedObjects, ...drawingObjects])];
    const coverageStates = new Map();

    // Save and temporarily show all coverage areas for thumbnail
    allObjects.forEach((obj) => {
      if (obj.deviceType && obj.coverageArea) {
        coverageStates.set(obj.id || obj, { visible: obj.coverageArea.visible });
        obj.coverageArea.set({ visible: true });
      }
    });

    // Remove objects, serialize canvas, then restore them
    objectsToRemove.forEach((obj) => this.fabricCanvas.remove(obj));
    const canvasData = this.fabricCanvas.toJSON(["class", "associatedText", "pixelsPerMeter", "isBackground"]);
    objectsToRemove.forEach((obj) => this.fabricCanvas.add(obj));

    // Restore original coverage area visibility states
    allObjects.forEach((obj) => {
      if (obj.deviceType && obj.coverageArea) {
        const saved = coverageStates.get(obj.id || obj);
        if (saved) obj.coverageArea.set({ visible: saved.visible });
      }
    });

    const settings = {
      pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
      zoom: this.fabricCanvas.getZoom(),
      viewportTransform: [...this.fabricCanvas.viewportTransform],
      defaultDeviceIconSize: window.defaultDeviceIconSize || 30,
      globalIconTextVisible: window.globalIconTextVisible !== undefined ? !!window.globalIconTextVisible : true,
      globalDeviceColor: window.globalDeviceColor || "#f8794b",
      globalTextColor: window.globalTextColor || "#FFFFFF",
      globalFont: window.globalFont || "Poppins, sans-serif",
      globalTextBackground: window.globalTextBackground !== undefined ? !!window.globalTextBackground : true,
      globalBoldText: window.globalBoldText !== undefined ? !!window.globalBoldText : false,
      globalCompleteDeviceIndicator: window.globalCompleteDeviceIndicator !== undefined ? !!window.globalCompleteDeviceIndicator : true,
      globalLabelDragEnabled: window.globalLabelDragEnabled !== undefined ? !!window.globalLabelDragEnabled : false,
    };

    return {
      version: ProjectManager.PROJECT_VERSION,
      timestamp: new Date().toISOString(),
      cameras: cameraData,
      drawing: drawingData,
      canvas: canvasData,
      clientDetails,
      screenshots,
      topology: topologyData,
      settings,
    };
  }

  // Sorts items by date (most recent first)
  sortItemsByDate(items, dateField = "modifiedAt", fallbackField = "createdAt") {
    return [...items].sort((a, b) => {
      const dateA = new Date(a[dateField] || a[fallbackField]);
      const dateB = new Date(b[dateField] || b[fallbackField]);
      return dateB - dateA;
    });
  }

  // Formats ISO date string for display
  formatDateDisplay(dateString) {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Safely saves to localStorage
  safeSetItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generates a thumbnail image from the canvas
  async generateThumbnail() {
    return new Promise((resolve, reject) => {
      try {
        const canvas = this.fabricCanvas;
        const scale = ProjectManager.THUMBNAIL_SCALE;
        const width = canvas.width * scale;
        const height = canvas.height * scale;

        // Create temporary canvas for thumbnail
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext("2d");

        // Draw canvas content scaled down
        const dataURL = canvas.toDataURL({
          format: "png",
          quality: ProjectManager.THUMBNAIL_QUALITY,
          multiplier: scale,
        });

        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(tempCanvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = dataURL;
      } catch (error) {
        reject(error);
      }
    });
  }

  // Saves current project to library with metadata and thumbnail
  async saveProjectToLibrary(projectName, description = "") {
    try {
      const projectData = await this.serializeProjectData();
      const thumbnail = await this.generateThumbnail();
      const projectId = `project_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 2 + ProjectManager.ID_RANDOM_LENGTH)}`;
      const now = new Date().toISOString();

      const projectMetadata = {
        id: projectId,
        name: projectName || `Project ${new Date().toLocaleDateString()}`,
        description: description,
        thumbnail: thumbnail,
        createdAt: now,
        modifiedAt: now,
        data: projectData,
      };

      const projects = this.getProjects();
      projects.push(projectMetadata);
      if (!this.safeSetItem(this.storageKey, projects)) {
        NotificationSystem.show("Failed to save project to library", false);
        return null;
      }

      NotificationSystem.show("Project saved to library!", true);
      return projectMetadata;
    } catch (error) {
      NotificationSystem.show("Failed to save project", false);
      return null;
    }
  }

  // Gets all saved projects from storage
  getProjects() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  // Gets all saved templates from storage
  getTemplates() {
    try {
      const stored = localStorage.getItem(this.templatesKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  // Renames a project
  renameProject(projectId, newName) {
    const projects = this.getProjects();
    const project = projects.find((p) => p.id === projectId);

    if (!project) {
      NotificationSystem.show("Project not found", false);
      return false;
    }

    if (!newName || newName.trim() === "") {
      NotificationSystem.show("Project name cannot be empty", false);
      return false;
    }

    project.name = newName.trim();
    project.modifiedAt = new Date().toISOString(); // Update modified timestamp

    if (this.safeSetItem(this.storageKey, projects)) {
      NotificationSystem.show("Project renamed", true);
      return true;
    }
    return false;
  }

  // Renames a template
  renameTemplate(templateId, newName) {
    const templates = this.getTemplates();
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      NotificationSystem.show("Template not found", false);
      return false;
    }

    if (!newName || newName.trim() === "") {
      NotificationSystem.show("Template name cannot be empty", false);
      return false;
    }

    template.name = newName.trim();
    template.modifiedAt = new Date().toISOString(); // Update modified timestamp

    if (this.safeSetItem(this.templatesKey, templates)) {
      NotificationSystem.show("Template renamed", true);
      return true;
    }
    return false;
  }

  // Deletes a project from storage
  deleteProject(projectId) {
    const projects = this.getProjects();
    const filtered = projects.filter((p) => p.id !== projectId);
    if (this.safeSetItem(this.storageKey, filtered)) {
      NotificationSystem.show("Project deleted", true);
    }
  }

  // Deletes a template from storage
  deleteTemplate(templateId) {
    const templates = this.getTemplates();
    const filtered = templates.filter((t) => t.id !== templateId);
    if (this.safeSetItem(this.templatesKey, filtered)) {
      NotificationSystem.show("Template deleted", true);
    }
  }

  // Generates next available copy name (handles "Copy", "Copy 1", "Copy 2", etc.)
  getNextCopyName(baseName, existingItems) {
    // Remove any existing copy suffix to get the base name
    let base = baseName;
    const copySuffix = " (Copy";
    if (baseName.includes(copySuffix)) {
      const index = baseName.lastIndexOf(copySuffix);
      base = baseName.substring(0, index);
    }

    // Find all existing copy numbers for this base name
    const existingCopies = existingItems
      .map((item) => {
        const name = item.name;
        if (name.startsWith(base) && name.includes(" (Copy")) {
          const suffixPart = name.substring(base.length);
          if (suffixPart.startsWith(" (Copy") && suffixPart.endsWith(")")) {
            // Extract number from " (Copy 2)" or " (Copy)"
            const inner = suffixPart.substring(" (Copy".length, suffixPart.length - 1).trim();
            if (inner === "") return 1;
            const num = parseInt(inner, 10);
            if (!isNaN(num)) return num;
          }
        }
        return null;
      })
      .filter((num) => num !== null);

    // Find the next available number
    let nextNumber = 1;
    while (existingCopies.includes(nextNumber)) {
      nextNumber++;
    }

    return nextNumber === 1 ? `${base} (Copy)` : `${base} (Copy ${nextNumber})`;
  }

  // Duplicates a project with new ID and copy name
  duplicateProject(projectId) {
    const projects = this.getProjects();
    const project = projects.find((p) => p.id === projectId);

    if (!project) {
      NotificationSystem.show("Project not found", false);
      return;
    }

    const newProject = {
      ...project,
      id: `project_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 2 + ProjectManager.ID_RANDOM_LENGTH)}`, // Generate new unique ID
      name: this.getNextCopyName(project.name, projects),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    projects.push(newProject);
    if (this.safeSetItem(this.storageKey, projects)) {
      NotificationSystem.show("Project duplicated!", true);
    }
  }

  // Duplicates a template with new ID and copy name
  duplicateTemplate(templateId) {
    const templates = this.getTemplates();
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      NotificationSystem.show("Template not found", false);
      return;
    }

    const newTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 2 + ProjectManager.ID_RANDOM_LENGTH)}`, // Generate new unique ID
      name: this.getNextCopyName(template.name, templates),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    templates.push(newTemplate);
    if (this.safeSetItem(this.templatesKey, templates)) {
      NotificationSystem.show("Template duplicated!", true);
    }
  }

  // Saves current project as a template
  async saveAsTemplate(templateName, description = "") {
    try {
      const projectData = await this.serializeProjectData();
      const thumbnail = await this.generateThumbnail();
      const templateId = `template_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 2 + ProjectManager.ID_RANDOM_LENGTH)}`;
      const now = new Date().toISOString();

      const templateMetadata = {
        id: templateId,
        name: templateName || `Template ${new Date().toLocaleDateString()}`,
        description: description,
        thumbnail: thumbnail,
        createdAt: now,
        modifiedAt: now,
        data: projectData,
      };

      const templates = this.getTemplates();
      templates.push(templateMetadata);
      this.safeSetItem(this.templatesKey, templates);
    } catch (error) {
      NotificationSystem.show("Failed to save template", false);
    }
  }

  // Sets up button event listeners for project/template cards
  setupCardButtons(card, item, isTemplate, containerId) {
    const renameBtn = card.querySelector(".rename-project-btn");
    if (renameBtn) {
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemType = isTemplate ? "template" : "project";
        const newName = prompt(`Enter new ${itemType} name:`, item.name);
        if (newName && newName.trim() !== "" && newName !== item.name) {
          const success = isTemplate ? this.renameTemplate(item.id, newName) : this.renameProject(item.id, newName);
          if (success) {
            // Refresh the view after rename
            const currentContainer = document.getElementById(containerId);
            const isShowingAll = currentContainer && currentContainer.classList.contains("show-all");
            isTemplate ? this.renderTemplates(this.getTemplates(), containerId, isShowingAll) : this.renderProjects(this.getProjects(), containerId, isShowingAll);
          }
        }
      });
    }

    const deleteBtn = card.querySelector(".delete-project-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${isTemplate ? "template" : "project"} "${item.name}"?`)) {
          isTemplate ? this.deleteTemplate(item.id) : this.deleteProject(item.id);
          // Refresh the view after delete
          const currentContainer = document.getElementById(containerId);
          const isShowingAll = currentContainer && currentContainer.classList.contains("show-all");
          isTemplate ? this.renderTemplates(this.getTemplates(), containerId, isShowingAll) : this.renderProjects(this.getProjects(), containerId, isShowingAll);
        }
      });
    }

    const duplicateBtn = card.querySelector(".duplicate-project-btn");
    if (duplicateBtn) {
      duplicateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        isTemplate ? this.duplicateTemplate(item.id) : this.duplicateProject(item.id);
        // Refresh the view after duplicate
        const currentContainer = document.getElementById(containerId);
        const isShowingAll = currentContainer && currentContainer.classList.contains("show-all");
        isTemplate ? this.renderTemplates(this.getTemplates(), containerId, isShowingAll) : this.renderProjects(this.getProjects(), containerId, isShowingAll);
      });
    }
  }

  // Renders projects grid in the specified container
  renderProjects(projects, containerId, showAll = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (projects.length === 0) {
      const emptyState = document.getElementById("projects-empty-state");
      if (emptyState) emptyState.style.display = "block";
      const viewAllBtn = document.getElementById("view-all-projects-btn");
      if (viewAllBtn) viewAllBtn.classList.remove("show");
      return;
    }

    const emptyState = document.getElementById("projects-empty-state");
    if (emptyState) emptyState.style.display = "none";

    const template = document.getElementById("project-card-template");
    if (!template) return;

    // Sort projects by most recent first (newest on left)
    const sortedProjects = this.sortItemsByDate(projects);

    // Toggle layout class based on showAll state
    if (showAll) {
      container.classList.add("show-all");
    } else {
      container.classList.remove("show-all");
    }

    // Show "View All" button if there are more than 5 items
    const viewAllBtn = document.getElementById("view-all-projects-btn");
    const minimizeBtn = document.getElementById("minimize-projects-btn");

    if (viewAllBtn) {
      if (sortedProjects.length > ProjectManager.MAX_ITEMS_PREVIEW && !showAll) {
        viewAllBtn.classList.add("show");
        viewAllBtn.onclick = () => {
          this.renderProjects(projects, containerId, true);
        };
      } else {
        viewAllBtn.classList.remove("show");
      }
    }

    // Show "Show Less" button when showing all projects
    if (minimizeBtn) {
      if (showAll && sortedProjects.length > ProjectManager.MAX_ITEMS_PREVIEW) {
        minimizeBtn.style.display = "inline-block";
        minimizeBtn.onclick = () => {
          this.renderProjects(projects, containerId, false);
        };
      } else {
        minimizeBtn.style.display = "none";
      }
    }

    // Limit to 5 items initially unless showAll is true
    const itemsToShow = showAll ? sortedProjects : sortedProjects.slice(0, ProjectManager.MAX_ITEMS_PREVIEW);
    const cards = [];

    itemsToShow.forEach((project) => {
      const card = template.content.cloneNode(true);
      const cardElement = card.querySelector(".project-card");

      // Set thumbnail
      const thumbnailImg = card.querySelector(".thumbnail-image");
      if (thumbnailImg) thumbnailImg.src = project.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23f0f0f0' width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3ENo Preview%3C/text%3E%3C/svg%3E";

      // Set title
      const title = card.querySelector(".project-card-title");
      if (title) title.textContent = project.name;

      // Set date
      const date = card.querySelector(".project-card-date");
      if (date) {
        date.textContent = this.formatDateDisplay(project.modifiedAt || project.createdAt);
      }

      // Set description
      const description = card.querySelector(".project-card-description");
      if (description) {
        if (project.description) {
          description.textContent = project.description;
        } else {
          description.style.display = "none";
        }
      }

      // Set up buttons
      this.setupCardButtons(card, project, false, containerId);

      // Remove export button
      const exportBtn = card.querySelector(".export-project-btn");
      if (exportBtn) exportBtn.remove();

      cards.push(card);
    });

    // Append all cards
    cards.forEach((card) => container.appendChild(card));
  }

  // Renders templates grid in the specified container
  renderTemplates(templates, containerId, showAll = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (templates.length === 0) {
      const emptyState = document.getElementById("templates-empty-state");
      if (emptyState) emptyState.style.display = "block";
      const viewAllBtn = document.getElementById("view-all-templates-btn");
      if (viewAllBtn) viewAllBtn.classList.remove("show");
      return;
    }

    const emptyState = document.getElementById("templates-empty-state");
    if (emptyState) emptyState.style.display = "none";

    const template = document.getElementById("project-card-template");
    if (!template) return;

    // Sort templates by most recent first (newest on left)
    const sortedTemplates = this.sortItemsByDate(templates, "createdAt", "createdAt");

    // Toggle layout class based on showAll state
    if (showAll) {
      container.classList.add("show-all");
    } else {
      container.classList.remove("show-all");
    }

    // Show "View All" button if there are more than 5 items
    const viewAllBtn = document.getElementById("view-all-templates-btn");
    const minimizeBtn = document.getElementById("minimize-templates-btn");

    if (viewAllBtn) {
      if (sortedTemplates.length > ProjectManager.MAX_ITEMS_PREVIEW && !showAll) {
        viewAllBtn.classList.add("show");
        viewAllBtn.onclick = () => {
          this.renderTemplates(templates, containerId, true);
        };
      } else {
        viewAllBtn.classList.remove("show");
      }
    }

    // Show "Show Less" button when showing all templates
    if (minimizeBtn) {
      if (showAll && sortedTemplates.length > ProjectManager.MAX_ITEMS_PREVIEW) {
        minimizeBtn.style.display = "inline-block";
        minimizeBtn.onclick = () => {
          this.renderTemplates(templates, containerId, false);
        };
      } else {
        minimizeBtn.style.display = "none";
      }
    }

    // Limit to 5 items initially unless showAll is true
    const itemsToShow = showAll ? sortedTemplates : sortedTemplates.slice(0, ProjectManager.MAX_ITEMS_PREVIEW);
    const cards = [];

    itemsToShow.forEach((templateData) => {
      const card = template.content.cloneNode(true);
      const cardElement = card.querySelector(".project-card");

      // Remove export button (not needed for templates)
      const exportBtn = card.querySelector(".export-project-btn");
      if (exportBtn) exportBtn.remove();

      // Set thumbnail
      const thumbnailImg = card.querySelector(".thumbnail-image");
      if (thumbnailImg) thumbnailImg.src = templateData.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23f0f0f0' width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3ETemplate%3C/text%3E%3C/svg%3E";

      // Set title
      const title = card.querySelector(".project-card-title");
      if (title) title.textContent = templateData.name;

      // Set date
      const date = card.querySelector(".project-card-date");
      if (date) {
        date.textContent = this.formatDateDisplay(templateData.createdAt);
      }

      // Hide description for templates
      const description = card.querySelector(".project-card-description");
      if (description) description.style.display = "none";

      // Set up buttons
      this.setupCardButtons(card, templateData, true, containerId);

      cards.push(card);
    });

    // Append all cards
    cards.forEach((card) => container.appendChild(card));
  }

  // Sets up mouse wheel scrolling for horizontal grid scrolling
  setupGridScrolling(gridElement) {
    if (!gridElement) return;

    // Remove existing wheel listener if any
    const existingHandler = gridElement._wheelHandler;
    if (existingHandler) {
      gridElement.removeEventListener("wheel", existingHandler);
    }

    // Add wheel event listener for horizontal scrolling
    const wheelHandler = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        gridElement.scrollLeft += e.deltaY * ProjectManager.SCROLL_MULTIPLIER;
      } else if (e.deltaX !== 0) {
        e.preventDefault();
        gridElement.scrollLeft += e.deltaX * ProjectManager.SCROLL_MULTIPLIER;
      }
    };

    gridElement._wheelHandler = wheelHandler;
    gridElement.addEventListener("wheel", wheelHandler, { passive: false });
  }

  // Sets up library modal to refresh content when opened
  setupLibraryModal() {
    const modal = document.getElementById("projectLibraryModal");
    if (!modal) return;

    modal.addEventListener("show.bs.modal", () => {
      this.renderProjects(this.getProjects(), "projects-grid");
      this.renderTemplates(this.getTemplates(), "templates-grid");
    });
  }

  // Sets up all event listeners for the project library
  setupEventListeners() {
    // Open library button
    const openLibraryBtn = document.getElementById("project-library-btn");
    if (openLibraryBtn) {
      openLibraryBtn.addEventListener("click", () => {
        const modal = new bootstrap.Modal(document.getElementById("projectLibraryModal"));
        modal.show();
      });
    }

    // Save current project button
    const saveCurrentBtn = document.getElementById("save-current-project-btn");
    if (saveCurrentBtn) {
      saveCurrentBtn.addEventListener("click", async () => {
        const name = prompt("Enter project name:", `Project ${new Date().toLocaleDateString()}`);
        if (name) {
          await this.saveProjectToLibrary(name, "");
          this.renderProjects(this.getProjects(), "projects-grid");
        }
      });
    }

    // Search functionality
    const projectSearch = document.getElementById("project-search");
    if (projectSearch) {
      projectSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const projects = this.getProjects();
        const filtered = projects.filter((p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
        this.renderProjects(filtered, "projects-grid");
      });
    }

    const templateSearch = document.getElementById("template-search");
    if (templateSearch) {
      templateSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const templates = this.getTemplates();
        const filtered = templates.filter((t) => t.name.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));
        this.renderTemplates(filtered, "templates-grid");
      });
    }

    // Save as template button
    const saveAsTemplateBtn = document.getElementById("save-as-template-btn");
    if (saveAsTemplateBtn) {
      saveAsTemplateBtn.addEventListener("click", async () => {
        const name = prompt("Enter template name:", `Template ${new Date().toLocaleDateString()}`);
        if (name) {
          await this.saveAsTemplate(name, "");
          this.renderTemplates(this.getTemplates(), "templates-grid");
        }
      });
    }
  }

  // Loads default blank template if no templates exist
  loadDefaultTemplates() {
    const templates = this.getTemplates();
    if (templates.length > 0) return; // Templates already exist

    // Create a blank template
    const blankTemplate = {
      id: "template_blank",
      name: "Blank Template",
      description: "Start with a clean canvas",
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23ffffff' width='200' height='150'/%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EBlank Template%3C/text%3E%3C/svg%3E",
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      data: {
        version: ProjectManager.PROJECT_VERSION,
        timestamp: new Date().toISOString(),
        cameras: { cameraDevices: [], counters: { cameraCounter: 1, deviceCounter: 1 } },
        drawing: { drawingObjects: [], zones: [], rooms: [], walls: { circles: [], lines: [] }, titleblocks: [] },
        canvas: { version: "4.0", objects: [] },
        clientDetails: {},
        screenshots: [],
        topology: { connections: [], mapPositions: {} },
        settings: { pixelsPerMeter: 17.5, zoom: 1, viewportTransform: [1, 0, 0, 1, 0, 0] },
      },
    };

    templates.push(blankTemplate);
    this.safeSetItem(this.templatesKey, templates);
  }
}

export { ProjectManager };
