document.addEventListener("DOMContentLoaded", function () {
  const subSidebar = document.getElementById("sub-sidebar");
  const subSidebarTitle = document.getElementById("sub-sidebar-title");
  const closeSidebarBtn = document.getElementById("close-sub-sidebar");
  const loadProjectBtn = document.getElementById("load-project-btn");
  const mainSidebarBtns = document.querySelectorAll(".sidebar-btn[data-menu]");
  const allSubmenus = document.querySelectorAll(".submenu");

  // Drawing Tools Grid Functionality
  let selectedTool = null;
  let selectedColor = "#f8794b";

  // Tool selection functionality
  function selectTool(element, toolId) {
    // Just log the selection without visual changes
    selectedTool = toolId;
    console.log(`Selected tool: ${toolId}`);
  }

  // Color selection functionality for Drawing Tools main colour (icons + mini picker)
  function selectColor(element, color) {
    document.querySelectorAll(".drawing-main-colour .colour-icon").forEach((icon) => {
      icon.classList.remove("selected");
      icon.style.outline = "none";
    });

    if (element) {
      element.classList.add("selected");
      element.style.outline = "2px solid #f8794b";
    }

    selectedColor = color;

    // Update hidden/compact color input and trigger the input event drawing tools listen for
    const colorPicker = document.querySelector("#shapes-text-color-picker");
    if (colorPicker) {
      colorPicker.value = color;
      const inputEvent = new Event("input", { bubbles: true });
      colorPicker.dispatchEvent(inputEvent);
    }
  }

  // Initialize drawing tools functionality
  function initializeDrawingTools() {
    // Add hover effects for tool items
    document.querySelectorAll(".tool-item").forEach((item) => {
      item.addEventListener("mouseenter", function () {
        // Apply active/selected styling on hover
        this.style.background = "#fff3f0";
        this.style.borderColor = "#f8794b";
        this.style.color = "#f8794b";
        this.style.transform = "translateY(-1px)";
        this.style.boxShadow = "0 2px 12px rgba(255, 107, 61, 0.15)";

        const icon = this.querySelector(".tool-icon");
        const label = this.querySelector(".tool-label");
        if (icon) {
          icon.style.background = "#f8794b";
          icon.style.borderColor = "#f8794b";
          icon.style.color = "white";
        }
        if (label) {
          label.style.color = "#f8794b";
          label.style.fontWeight = "600";
        }
      });

      item.addEventListener("mouseleave", function () {
        // Reset to default styling when not hovering
        this.style.background = "#f8f9fa";
        this.style.borderColor = "#e9ecef";
        this.style.color = "#495057";
        this.style.transform = "translateY(0)";
        this.style.boxShadow = "none";

        const icon = this.querySelector(".tool-icon");
        const label = this.querySelector(".tool-label");
        if (icon) {
          icon.style.background = "#f8794b";
          icon.style.borderColor = "#f8794b";
          icon.style.color = "white";
        }
        if (label) {
          label.style.color = "#495057";
          label.style.fontWeight = "500";
        }
      });

      // Add click handler
      item.addEventListener("click", function () {
        const toolType = this.getAttribute("data-tool") || this.id.replace("-btn", "").replace("add-", "").replace("create-", "");
        selectTool(this, toolType);
      });
    });

    // Hook main drawing colour icons
    document.querySelectorAll(".drawing-main-colour .colour-icon").forEach((icon) => {
      icon.addEventListener("click", function (e) {
        e.preventDefault();
        const color = this.getAttribute("data-color");
        if (color) selectColor(this, color);
      });
    });

    // Hook mini color input for main drawing colour
    const colorPicker = document.querySelector("#shapes-text-color-picker");
    if (colorPicker) {
      colorPicker.addEventListener("input", function () {
        selectedColor = this.value;
        // Clear icon highlight; user picked a custom colour
        document.querySelectorAll(".drawing-main-colour .colour-icon").forEach((icon) => {
          icon.classList.remove("selected");
          icon.style.outline = "none";
        });
      });
    }

    // Initialize with first tool selected (Wall Boundaries) - just set the variable, no visual changes
    selectedTool = "wall-boundaries";
    console.log(`Initialized with tool: ${selectedTool}`);
  }

  // Title mapping for each submenu
  const titleMap = {
    "project-options-submenu": "Project Options",
    "add-devices-submenu": "Add Devices",
    "layer-controls-submenu": "Layer Controls",
    "drawing-tools-submenu": "Drawing Tools",
    "client-details-submenu": "Client Details",
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

  // Handle replace background button
  const replaceBackgroundBtn = document.getElementById("replace-background-btn");
  if (replaceBackgroundBtn) {
    replaceBackgroundBtn.addEventListener("click", function () {
      const fabricCanvas = window.fabricCanvas;
      if (!fabricCanvas) return;

      const existingBg = fabricCanvas.getObjects().find((o) => o.type === "image" && (o.isBackground || (!o.selectable && !o.evented)));
      if (!existingBg) {
        alert("No background found. Please add a background first.");
        return;
      }

      window.__replaceBackgroundMode = true;
      const customModal = document.getElementById("customModal");
      (bootstrap.Modal.getInstance(customModal) || new bootstrap.Modal(customModal)).show();
    });
  }

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
});
