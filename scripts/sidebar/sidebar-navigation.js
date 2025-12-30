import { initializeDrawingTools } from "../drawing/drawing-utils.js";
import { BackgroundManager } from "../background/BackgroundManager.js";
import { DEVICE_TYPE_TO_IMAGE } from "../devices/categories/device-types.js";

/**
 * Sets up drag event listeners for device items in the sidebar.
 */
export function setupDeviceItemDrag() {
  // Add drag event listeners to all device items
  document.querySelectorAll(".device-item").forEach((item) => {
    item.addEventListener("dragstart", function (e) {
      const deviceType = this.dataset.device;
      const imagePath = DEVICE_TYPE_TO_IMAGE[deviceType];

      if (imagePath) {
        // Set the image path as drag data to maintain compatibility with existing drop handler
        e.dataTransfer.setData("text/plain", imagePath);
        e.dataTransfer.effectAllowed = "copy";

        // Add dragging class for visual feedback
        this.classList.add("dragging");
        document.body.classList.add("dragging");
      }
    });

    item.addEventListener("dragend", function (e) {
      // Remove dragging class
      this.classList.remove("dragging");
      document.body.classList.remove("dragging");
    });
  });
}

/**
 * Initialize sidebar navigation functionality
 * This is called after HTML includes are loaded
 */
export function initSidebarNavigation() {
  const subSidebar = document.getElementById("sub-sidebar");
  const subSidebarTitle = document.getElementById("sub-sidebar-title");
  const closeSidebarBtn = document.getElementById("close-sub-sidebar");
  const loadProjectBtn = document.getElementById("load-project-btn");
  const mainSidebarBtns = document.querySelectorAll(".sidebar-btn[data-menu]");
  const allSubmenus = document.querySelectorAll(".submenu");

  // Title mapping for each submenu
  const titleMap = {
    "project-options-submenu": "Project Options",
    "add-devices-submenu": "Add Devices",
    "layer-controls-submenu": "Layer Controls",
    "drawing-tools-submenu": "Drawing Tools",
    "client-details-submenu": "Client Details",
    "risk-assessment-submenu": "Risk Assessment",
    "health-safety-submenu": "Health Safety",
    "settings-submenu": "Settings",
  };

  // Function to show specific submenu and update title
  function showSubmenu(menuId) {
    // Hide all submenus first
    allSubmenus.forEach((menu) => {
      menu.style.display = "none";
    });

    // Show the target submenu
    const targetSubmenu = document.getElementById(menuId);
    if (targetSubmenu) {
      targetSubmenu.style.display = "block";

      // Update the title
      const newTitle = titleMap[menuId] || "Menu";
      subSidebarTitle.textContent = newTitle;

      // Show the sidebar
      subSidebar.classList.remove("hidden");

      // Initialize drawing tools functionality if showing drawing tools menu
      if (menuId === "drawing-tools-submenu") {
        setTimeout(() => {
          initializeDrawingTools();
        }, 100);
      }
    }
  }

  // Function to hide sidebar
  function hideSidebar() {
    subSidebar.classList.add("hidden");

    // Reset title to default
    subSidebarTitle.textContent = "Menu";

    // Hide all submenus
    allSubmenus.forEach((menu) => {
      menu.style.display = "none";
    });
  }

  // Add click event listeners to main sidebar buttons
  mainSidebarBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const menuId = this.getAttribute("data-menu");
      if (menuId) {
        showSubmenu(menuId);
      }
    });
  });

  // Add click event listener to close button
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", function () {
      hideSidebar();
    });
  }

  // Add click event listener to close button
  if (loadProjectBtn) {
    loadProjectBtn.addEventListener("click", function () {
      hideSidebar();
    });
  }

  // Background handlers are now set up in canvas-init.js

  // Close sidebar when clicking outside of it
  document.addEventListener("click", function (event) {
    // Check if the click was outside the sidebar and main sidebar
    const isClickInsideSidebar = subSidebar.contains(event.target);
    const isClickInsideMainSidebar = document.getElementById("sidebar").contains(event.target);

    // If sidebar is visible and click is outside both sidebars
    if (!subSidebar.classList.contains("hidden") && !isClickInsideSidebar && !isClickInsideMainSidebar) {
      hideSidebar();
    }
  });

  // Device submenu navigation (for add-devices-submenu)
  const closeSubSidebarBtn = document.getElementById("close-sub-sidebar");

  // Hides all submenus (for device submenus)
  function hideAllDeviceSubmenus() {
    document.querySelectorAll(".submenu").forEach((submenu) => {
      submenu.classList.add("hidden");
      submenu.classList.remove("show");
    });
  }

  // Shows a specific device submenu
  function showDeviceSubmenu(menuId) {
    hideAllDeviceSubmenus();
    const submenu = document.getElementById(menuId);
    if (submenu) {
      submenu.classList.remove("hidden");
      submenu.classList.add("show");
      subSidebar.classList.remove("hidden");
    }
  }

  // Sets up sidebar navigation event listeners for device submenus
  document.querySelectorAll(".sidebar-btn").forEach((button) => {
    const menuType = button.getAttribute("data-menu");
    if (menuType && menuType !== "project-options-submenu" && menuType !== "drawing-tools-submenu" && menuType !== "layer-controls-submenu" && menuType !== "client-details-submenu" && menuType !== "settings-submenu") {
      button.addEventListener("click", () => {
        showDeviceSubmenu(menuType);
      });
    }
  });

  document.querySelectorAll(".toggle-device-dropdown").forEach((button) => {
    button.addEventListener("click", () => {
      window.toggleSubMenu(button);
    });
  });

  if (closeSubSidebarBtn) {
    closeSubSidebarBtn.addEventListener("click", () => {
      subSidebar.classList.add("hidden");
      hideAllDeviceSubmenus();
    });
  }

  // Defines global toggle submenu function for device dropdowns
  window.toggleSubMenu = function (button) {
    const container = button.parentElement;
    const deviceRows = container.querySelectorAll(".device-row");
    const icon = button.querySelector(".dropdown-icon");

    deviceRows.forEach((row) => row.classList.toggle("show"));
    if (icon) icon.classList.toggle("rotate");
  };

  // Setup drag functionality for device items
  setupDeviceItemDrag();

  // Setup intruder risk assessment modal button
  const openIntruderRiskModalBtn = document.getElementById("open-intruder-risk-modal");
  if (openIntruderRiskModalBtn) {
    openIntruderRiskModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("intruder-risk-assessment-modal");
      if (modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        modalInstance.show();
      }
    });
  }

  // Setup CCTV risk assessment modal button
  const openCctvRiskModalBtn = document.getElementById("open-cctv-risk-modal");
  if (openCctvRiskModalBtn) {
    openCctvRiskModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("cctv-risk-assessment-modal");
      if (modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        modalInstance.show();
      }
    });
  }

  // Setup Access Control risk assessment modal button
  const openAccessControlRiskModalBtn = document.getElementById("open-access-control-risk-modal");
  if (openAccessControlRiskModalBtn) {
    openAccessControlRiskModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("access-control-risk-assessment-modal");
      if (modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        modalInstance.show();
      }
    });
  }

  // Setup Safety risk assessment modal button
  const openSafetyRiskModalBtn = document.getElementById("open-safety-risk-modal");
  if (openSafetyRiskModalBtn) {
    openSafetyRiskModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("safety-assessment-modal");
      if (modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        modalInstance.show();
      }
    });
  }
}

// Initialize on DOMContentLoaded for backwards compatibility when HTML is inline
// When using HTML includes, call initSidebarNavigation() after includes are loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check if sidebar is already loaded (inline HTML)
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.children.length > 0 && !sidebar.hasAttribute("data-include")) {
    initSidebarNavigation();
  }
});

// Also listen for htmlIncludesLoaded event when using the HTML loader
document.addEventListener("htmlIncludesLoaded", function () {
  initSidebarNavigation();
});
