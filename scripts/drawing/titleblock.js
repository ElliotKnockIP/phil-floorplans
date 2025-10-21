import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup, setupColorPicker } from "./drawing-utils.js";

if (!window.activeTitleBlocks) window.activeTitleBlocks = [];

// Sets up the title block tool for creating and managing title blocks
export function setupTitleBlockTool(fabricCanvas) {
  const addTitleBlockBtn = document.getElementById("titleblock-btn");
  let isTitleBlockMode = false;

  const config = { width: 950, height: 360, borderColor: "#000000", fontSize: 14, fontFamily: "Arial", cellPadding: 12 };

  // Gets all active title blocks from the global array
  const getActiveTitleBlocks = () => window.activeTitleBlocks || [];
  
  // Adds a new title block to the active list
  const addToActiveTitleBlocks = (block) => (window.activeTitleBlocks = window.activeTitleBlocks || []).push(block);
  
  // Removes a title block from the active list
  const removeFromActiveTitleBlocks = (block) => window.activeTitleBlocks && (window.activeTitleBlocks = window.activeTitleBlocks.filter((b) => b !== block));

  // Turns off title block mode
  const cleanupTitleBlockMode = () => (isTitleBlockMode = false);

  // Gets all client details from form inputs
  const getClientDetails = () => {
    const getValue = (id) => document.getElementById(id)?.value || "";
    const logoImg = document.querySelector("#client-logo-preview img");
    return {
      date: getValue("client-date-input"),
      name: getValue("client-name-test-input"),
      address: getValue("address-input"),
      title: getValue("report-title-input"),
      logoSrc: logoImg?.src || null,
      revs: ["rev-one-input", "rev-two-input", "rev-three-input"].map((id) => getValue(id)),
    };
  };

  // Creates and adds a client logo to a title block
  const createLogo = (group, logoSrc, containerLeft, containerTop, containerWidth, containerHeight) => {
    fabric.Image.fromURL(
      logoSrc,
      (logoImg) => {
        const availableWidth = containerWidth - 2 * config.cellPadding;
        const availableHeight = containerHeight - 2 * config.cellPadding;
        const scale = Math.min(availableWidth / logoImg.width, availableHeight / logoImg.height);
        const scaledWidth = logoImg.width * scale;
        const scaledHeight = logoImg.height * scale;
        const logoLeft = containerLeft + config.cellPadding + (availableWidth - scaledWidth) / 2;
        const logoTop = containerTop + config.cellPadding + (availableHeight - scaledHeight) / 2;
        logoImg.set({ left: logoLeft, top: logoTop, scaleX: scale, scaleY: scale, selectable: true, isClientLogo: true });
        logoImg.containerBounds = { left: containerLeft + config.cellPadding, top: containerTop + config.cellPadding, right: containerLeft + containerWidth - config.cellPadding, bottom: containerTop + containerHeight - config.cellPadding };
        group.add(logoImg);
        fabricCanvas.requestRenderAll();
      },
      { crossOrigin: "anonymous" }
    );
  };

  // Updates the content of an existing title block
  const updateTitleBlock = (group, details) => {
    const objects = group.getObjects();
    const colWidth = config.width / 3;
    const logoHeight = config.height * (2 / 3) - 20;
    const containerWidth = colWidth;
    const containerHeight = logoHeight;

    const fieldMap = {
      isDateField: details.date,
      isClientName: details.name,
      isClientAddress: details.address,
      isReportTitle: details.title,
      isRev1: details.revs[0],
      isRev2: details.revs[1],
      isRev3: details.revs[2],
    };

    objects.forEach((obj) => {
      if (obj.type === "textbox" && !obj.isHeader) {
        // Enable text wrapping for long words
        if (!obj.splitByGrapheme) obj.set({ splitByGrapheme: true });
        const key = Object.keys(fieldMap).find((k) => obj[k]);
        if (key) obj.set({ text: fieldMap[key] });
      }
    });

    const placeholder = objects.find((obj) => obj.isClientLogo && obj.type === "textbox");
    const existingLogo = objects.find((obj) => obj.isClientLogo && obj.type === "image");

    if (details.logoSrc) {
      if (placeholder) {
        const containerLeft = placeholder.left - config.cellPadding;
        const containerTop = placeholder.top - config.cellPadding;
        group.remove(placeholder);
        createLogo(group, details.logoSrc, containerLeft, containerTop, containerWidth, containerHeight);
      } else if (existingLogo && existingLogo._originalElement?.src !== details.logoSrc) {
        const containerLeft = existingLogo.containerBounds?.left - config.cellPadding || existingLogo.left - config.cellPadding;
        const containerTop = existingLogo.containerBounds?.top - config.cellPadding || existingLogo.top - config.cellPadding;
        group.remove(existingLogo);
        createLogo(group, details.logoSrc, containerLeft, containerTop, containerWidth, containerHeight);
      }
    } else if (existingLogo) {
      const containerLeft = existingLogo.containerBounds?.left - config.cellPadding || existingLogo.left - config.cellPadding;
      const containerTop = existingLogo.containerBounds?.top - config.cellPadding || existingLogo.top - config.cellPadding;
      const newPlaceholder = new fabric.Textbox("", { left: containerLeft + config.cellPadding, top: containerTop + config.cellPadding, width: containerWidth - 2 * config.cellPadding, height: containerHeight - 2 * config.cellPadding, fontSize: config.fontSize, fontFamily: config.fontFamily, isClientLogo: true });
      group.remove(existingLogo);
      group.add(newPlaceholder);
    }
    fabricCanvas.requestRenderAll();
  };

  // Updates all active title blocks with current form data
  const updateAllTitleBlocks = () => {
    const details = getClientDetails();
    window.activeTitleBlocks = getActiveTitleBlocks().filter((block) => {
      if (fabricCanvas.getObjects().includes(block)) {
        updateTitleBlock(block, details);
        return true;
      }
      return false;
    });
  };

  // Creates a rectangle shape for the title block
  const createRect = (left, top, width, height, fill = "white") => new fabric.Rect({ left, top, width, height, fill, stroke: config.borderColor, strokeWidth: 1 });
  
  // Creates a text box with proper wrapping
  const createText = (text, left, top, width, options = {}) =>
    new fabric.Textbox(text, {
      left,
      top,
      width,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      splitByGrapheme: true, // Handles long words without spaces
      ...options,
    });

  // Creates a new title block at the specified position
  const createTitleBlock = (left, top) => {
    const details = getClientDetails();
    const items = [];
    const colWidth = config.width / 3;
    const colHeight = config.height;
    const logoHeight = (colHeight * 2) / 3 - 20; // Height for logo section

    const columns = [
      {
        x: 0,
        sections: [
          { header: "Client Logo", height: (colHeight * 2) / 3, content: "", isLogo: true },
          { header: "Completed Date", height: colHeight / 3, content: details.date, field: "isDateField" },
        ],
      },
      {
        x: colWidth,
        sections: [
          { header: "Client Name", height: colHeight / 3, content: details.name, field: "isClientName" },
          { header: "Client Address", height: colHeight / 3, content: details.address, field: "isClientAddress" },
          { header: "Report Title", height: colHeight / 3, content: details.title, field: "isReportTitle" },
        ],
      },
      {
        x: colWidth * 2,
        sections: [
          { header: "Rev 1", height: colHeight / 3, content: details.revs[0], field: "isRev1", editable: true },
          { header: "Rev 2", height: colHeight / 3, content: details.revs[1], field: "isRev2", editable: true },
          { header: "Rev 3", height: colHeight / 3, content: details.revs[2], field: "isRev3", editable: true },
        ],
      },
    ];

    columns.forEach((col) => {
      let yOffset = 0;
      col.sections.forEach((section) => {
        const headerHeight = 20;
        const contentHeight = section.height - headerHeight;
        items.push(createRect(col.x, yOffset, colWidth, headerHeight, "#f0f0f0"));
        items.push(createText(section.header, col.x + config.cellPadding, yOffset + 3, colWidth - 2 * config.cellPadding, { textAlign: "center", isHeader: true }));
        items.push(createRect(col.x, yOffset + headerHeight, colWidth, contentHeight));
        if (section.isLogo)
          items.push(
            createText("", col.x + config.cellPadding, yOffset + headerHeight + config.cellPadding, colWidth - 2 * config.cellPadding, {
              isClientLogo: true,
            })
          );
        else items.push(createText(section.content, col.x + config.cellPadding, yOffset + headerHeight + config.cellPadding, colWidth - 2 * config.cellPadding, { textAlign: "center", editable: !!section.editable, [section.field]: true }));
        yOffset += section.height;
      });
    });

    // Create the title block group with styling
    const groupOptions = {
      left, top, selectable: true, hasControls: true, hasBorders: true,
      deviceType: "title-block", cursorColor: "#f8794b", borderColor: "#f8794b",
      borderScaleFactor: 2, cornerSize: 8, cornerColor: "#f8794b",
      cornerStrokeColor: "#000000", cornerStyle: "circle", transparentCorners: false
    };
    const group = new fabric.Group(items, groupOptions);
    group.id = `titleblock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add to canvas and undo system
    const wasExecuting = window.undoSystem?.isExecutingCommand;
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    addToActiveTitleBlocks(group);
    if (window.undoSystem) {
      window.undoSystem.isExecutingCommand = wasExecuting;
      window.undoSystem.addToStack(new window.UndoCommands.AddCommand(fabricCanvas, group, []));
    }
    fabricCanvas.requestRenderAll();
    stopCurrentTool();

    // Add logo if available
    if (details.logoSrc) {
      setTimeout(() => {
        const placeholder = group.getObjects().find((obj) => obj.isClientLogo);
        if (placeholder) {
          const containerLeft = placeholder.left - config.cellPadding;
          const containerTop = placeholder.top - config.cellPadding;
          group.remove(placeholder);
          createLogo(group, details.logoSrc, containerLeft, containerTop, colWidth, logoHeight);
        }
      }, 100);
    }
  };

  // Keeps client logos within their container bounds when moving
  fabricCanvas.on("object:moving", (e) => {
    const obj = e.target;
    if (obj.type === "image" && obj.isClientLogo && obj.containerBounds) {
      const bounds = obj.containerBounds;
      const objBounds = obj.getBoundingRect();
      
      // Keep logo within left and right bounds
      if (objBounds.left < bounds.left) {
        obj.set("left", obj.left + (bounds.left - objBounds.left));
      }
      if (objBounds.left + objBounds.width > bounds.right) {
        obj.set("left", obj.left - (objBounds.left + objBounds.width - bounds.right));
      }
      
      // Keep logo within top and bottom bounds
      if (objBounds.top < bounds.top) {
        obj.set("top", obj.top + (bounds.top - objBounds.top));
      }
      if (objBounds.top + objBounds.height > bounds.bottom) {
        obj.set("top", obj.top - (objBounds.top + objBounds.height - bounds.bottom));
      }
    }
  });

  // Sets up event listeners for form inputs and logo upload
  const setupListeners = () => {
    // Listen to all form inputs
    const inputIds = ["client-date-input", "client-name-test-input", "address-input", "report-title-input", "rev-one-input", "rev-two-input", "rev-three-input"];
    inputIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", updateAllTitleBlocks);
        input.addEventListener("change", updateAllTitleBlocks);
      }
    });

    // Handle logo upload
    const logoUpload = document.getElementById("client-logo-upload");
    if (logoUpload) {
      logoUpload.addEventListener("change", (e) => {
        if (e.target.files?.[0]) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const preview = document.getElementById("client-logo-preview");
            if (preview) {
              const dataUrl = event.target.result;
              preview.innerHTML = `<img src="${dataUrl}" alt="Client Logo" style="max-width: 100%; max-height: 100px;">`;
              try {
                localStorage.setItem("clientLogoDataUrl", dataUrl);
              } catch (_) {}
              setTimeout(updateAllTitleBlocks, 100);
            }
          };
          reader.readAsDataURL(e.target.files[0]);
        }
      });
    }

    // Watch logo preview for changes
    const logoPreview = document.getElementById("client-logo-preview");
    if (logoPreview) {
      // Watch for changes to keep title blocks in sync
      new MutationObserver(() => {
        setTimeout(updateAllTitleBlocks, 100);
        try {
          const img = logoPreview.querySelector("img");
          if (img?.src) localStorage.setItem("clientLogoDataUrl", img.src);
          else localStorage.removeItem("clientLogoDataUrl");
        } catch (_) {}
      }).observe(logoPreview, { childList: true, subtree: true });

      // Restore saved logo on page load
      try {
        const savedLogo = localStorage.getItem("clientLogoDataUrl");
        if (savedLogo && !logoPreview.querySelector("img")) {
          logoPreview.innerHTML = `<img src="${savedLogo}" alt="Client Logo" style="max-width: 100%; max-height: 100px;">`;
          setTimeout(updateAllTitleBlocks, 100);
        }
      } catch (_) {}
    }
  };

  // Handles mouse click to create a title block
  const onMouseDown = (event) => {
    const pointer = fabricCanvas.getPointer(event.e);
    createTitleBlock(pointer.x - config.width / 2, pointer.y - config.height / 2);
  };

  // Starts title block creation mode
  const startTitleBlockMode = () => {
    if (isTitleBlockMode) return;
    isTitleBlockMode = true;
    closeSidebar();
    cleanupTitleBlockMode();
    registerToolCleanup(cleanupTitleBlockMode);
    startTool(fabricCanvas, "titleblock", onMouseDown);
  };

  if (addTitleBlockBtn) {
    const newButton = addTitleBlockBtn.cloneNode(true);
    addTitleBlockBtn.parentNode.replaceChild(newButton, addTitleBlockBtn);
    newButton.addEventListener("click", (e) => {
      e.preventDefault();
      startTitleBlockMode();
    });
  }

  // Removes title blocks from active list when deleted
  const removalHandler = (e) => e.target?.deviceType === "title-block" && removeFromActiveTitleBlocks(e.target);
  fabricCanvas.off("object:removed", removalHandler);
  fabricCanvas.on("object:removed", removalHandler);

  setupColorPicker(fabricCanvas);
  setupListeners();

  // Cleans up event listeners
  const cleanup = () => {
    fabricCanvas.off("object:moving");
    fabricCanvas.off("object:removed", removalHandler);
  };

  window.titleBlockCleanup = cleanup;
  window.updateAllTitleBlocks = updateAllTitleBlocks;
}
