import { initializeDrawingTools } from "../drawing/drawing-utils.js";
import { DEVICE_TYPE_TO_IMAGE } from "../devices/categories/device-types.js";

// Manages the main sidebar navigation and submenu switching
export class SidebarNavigator {
  // Initialize sidebar elements and title mapping
  constructor() {
    this.subSidebar = document.getElementById("sub-sidebar");
    this.subSidebarTitle = document.getElementById("sub-sidebar-title");
    this.closeSidebarBtn = document.getElementById("close-sub-sidebar");
    this.mainSidebarBtns = document.querySelectorAll(".sidebar-btn[data-menu]");
    this.allSubmenus = document.querySelectorAll(".submenu");

    this.titleMap = {
      "project-options-submenu": "Project Options",
      "add-devices-submenu": "Add Devices",
      "layer-controls-submenu": "Layer Controls",
      "drawing-tools-submenu": "Drawing Tools",
      "client-details-submenu": "Client Details",
      "risk-assessment-submenu": "Risk Assessment",
      "health-safety-submenu": "Health Safety",
      "settings-submenu": "Settings",
    };

    this.init();
  }

  // Initializes event listeners and drag handling
  init() {
    this.setupMainButtons();
    this.setupCloseButton();
    this.setupDeviceItemDrag();
    this.initializeGlobalFunctions();
  }

  // Sets up global functions for external access
  initializeGlobalFunctions() {
    window.showSubmenu = (menuId) => this.showSubmenu(menuId);
    window.hideSidebar = () => this.hideSidebar();
  }

  // Sets up click listeners for main sidebar buttons
  setupMainButtons() {
    this.mainSidebarBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const menuId = btn.dataset.menu;
        this.showSubmenu(menuId);
      });
    });
  }

  // Sets up the close button for the sub-sidebar
  setupCloseButton() {
    if (this.closeSidebarBtn) {
      this.closeSidebarBtn.addEventListener("click", () => this.hideSidebar());
    }
  }

  // Shows a specific submenu and updates the title
  showSubmenu(menuId) {
    this.allSubmenus.forEach((menu) => {
      menu.style.display = "none";
    });

    const targetSubmenu = document.getElementById(menuId);
    if (targetSubmenu) {
      targetSubmenu.style.display = "block";
      this.subSidebarTitle.textContent = this.titleMap[menuId] || "Menu";
      this.subSidebar.classList.remove("hidden");

      if (menuId === "drawing-tools-submenu") {
        setTimeout(() => initializeDrawingTools(), 100);
      }
    }
  }

  // Hides the sub-sidebar
  hideSidebar() {
    if (this.subSidebar) {
      this.subSidebar.classList.add("hidden");
      this.subSidebarTitle.textContent = "Menu";
      this.allSubmenus.forEach((menu) => {
        menu.style.display = "none";
      });
    }
  }

  // Sets up drag event listeners for device items
  setupDeviceItemDrag() {
    document.querySelectorAll(".device-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        const deviceType = item.dataset.device;
        const imagePath = DEVICE_TYPE_TO_IMAGE[deviceType];

        if (imagePath) {
          e.dataTransfer.setData("text/plain", imagePath);
          e.dataTransfer.effectAllowed = "copy";
          item.classList.add("dragging");
          document.body.classList.add("dragging");
        }
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        document.body.classList.remove("dragging");
      });
    });
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector("[data-include]")) {
    document.addEventListener("htmlIncludesLoaded", () => new SidebarNavigator());
  } else {
    new SidebarNavigator();
  }
});
