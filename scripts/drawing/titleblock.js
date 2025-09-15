import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup, setupColorPicker } from "./drawing-utils.js";

// Initialize global activeTitleBlocks array for save system integration
if (typeof window.activeTitleBlocks === "undefined") {
  window.activeTitleBlocks = [];
}

export function setupTitleBlockTool(fabricCanvas) {
  const addTitleBlockBtn = document.getElementById("titleblock-btn");
  let isTitleBlockMode = false;

  const config = {
    width: 950,
    height: 300,
    borderColor: "#000000",
    fontSize: 14,
    fontFamily: "Arial",
    cellPadding: 10,
    maxChars: 37,
  };

  // Use global activeTitleBlocks for save system integration
  const getActiveTitleBlocks = () => window.activeTitleBlocks || [];
  const addToActiveTitleBlocks = (block) => {
    if (!window.activeTitleBlocks) window.activeTitleBlocks = [];
    window.activeTitleBlocks.push(block);
  };
  const removeFromActiveTitleBlocks = (block) => {
    if (window.activeTitleBlocks) {
      window.activeTitleBlocks = window.activeTitleBlocks.filter((b) => b !== block);
    }
  };

  // Cleanup function for titleblock mode
  function cleanupTitleBlockMode() {
    isTitleBlockMode = false;
    // No temporary objects to clean up for titleblock tool
  }

  // Wrap text to fit within max character limit
  const wrapText = (text) => {
    if (!text) return "";

    return text
      .split("\n")
      .map((paragraph) => {
        if (paragraph.length <= config.maxChars) {
          return paragraph;
        }

        const words = paragraph.split(" ");
        const lines = [];
        let currentLine = "";

        for (const word of words) {
          if (word.length > config.maxChars) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = "";
            }

            for (let i = 0; i < word.length; i += config.maxChars) {
              const chunk = word.slice(i, i + config.maxChars);
              if (i === 0 && word.length > config.maxChars) {
                lines.push(chunk);
              } else if (i + config.maxChars >= word.length) {
                currentLine = chunk;
              } else {
                lines.push(chunk);
              }
            }
            continue;
          }

          const testLine = currentLine ? `${currentLine} ${word}` : word;

          if (testLine.length <= config.maxChars) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
            }
            currentLine = word;
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines.join("\n");
      })
      .join("\n");
  };

  // Get client details from input fields
  const getClientDetails = () => {
    const getValue = (id) => document.getElementById(id)?.value || "";
    const logoImg = document.querySelector("#client-logo-preview img");

    return {
      date: getValue("client-date-input"),
      name: wrapText(getValue("client-name-test-input")),
      address: wrapText(getValue("address-input")),
      title: wrapText(getValue("report-title-input")),
      logoSrc: logoImg?.src || null,
      revs: ["rev-one-input", "rev-two-input", "rev-three-input"].map((id) => wrapText(getValue(id))),
    };
  };

  // Create logo image
  const createLogo = (group, logoSrc, containerLeft, containerTop, containerWidth, containerHeight) => {
    fabric.Image.fromURL(
      logoSrc,
      (logoImg) => {
        const availableWidth = containerWidth - 2 * config.cellPadding;
        const availableHeight = containerHeight - 2 * config.cellPadding;

        const scaleX = availableWidth / logoImg.width;
        const scaleY = availableHeight / logoImg.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = logoImg.width * scale;
        const scaledHeight = logoImg.height * scale;

        const logoLeft = containerLeft + config.cellPadding + (availableWidth - scaledWidth) / 2;
        const logoTop = containerTop + config.cellPadding + (availableHeight - scaledHeight) / 2;

        logoImg.set({
          left: logoLeft,
          top: logoTop,
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          isClientLogo: true,
          lockMovementX: false,
          lockMovementY: false,
        });

        logoImg.containerBounds = {
          left: containerLeft + config.cellPadding,
          top: containerTop + config.cellPadding,
          right: containerLeft + containerWidth - config.cellPadding,
          bottom: containerTop + containerHeight - config.cellPadding,
        };

        group.add(logoImg);
        fabricCanvas.requestRenderAll();
      },
      { crossOrigin: "anonymous" }
    );
  };

  // Update title block content
  const updateTitleBlock = (group, details) => {
    const objects = group.getObjects();
    const colWidth = config.width / 3;
    const logoHeight = config.height * (2 / 3) - 20;
    const containerWidth = colWidth;
    const containerHeight = logoHeight;

    objects.forEach((obj) => {
      if (obj.type === "textbox" && !obj.isHeader) {
        if (obj.isDateField) obj.set({ text: details.date });
        else if (obj.isClientName) obj.set({ text: details.name });
        else if (obj.isClientAddress) obj.set({ text: details.address });
        else if (obj.isReportTitle) obj.set({ text: details.title });
        else if (obj.isRev1) obj.set({ text: details.revs[0] });
        else if (obj.isRev2) obj.set({ text: details.revs[1] });
        else if (obj.isRev3) obj.set({ text: details.revs[2] });
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
        const containerLeft = existingLogo.containerBounds ? existingLogo.containerBounds.left - config.cellPadding : existingLogo.left - config.cellPadding;
        const containerTop = existingLogo.containerBounds ? existingLogo.containerBounds.top - config.cellPadding : existingLogo.top - config.cellPadding;
        group.remove(existingLogo);
        createLogo(group, details.logoSrc, containerLeft, containerTop, containerWidth, containerHeight);
      }
    } else if (existingLogo) {
      const containerLeft = existingLogo.containerBounds ? existingLogo.containerBounds.left - config.cellPadding : existingLogo.left - config.cellPadding;
      const containerTop = existingLogo.containerBounds ? existingLogo.containerBounds.top - config.cellPadding : existingLogo.top - config.cellPadding;

      const newPlaceholder = new fabric.Textbox("", {
        left: containerLeft + config.cellPadding,
        top: containerTop + config.cellPadding,
        width: containerWidth - 2 * config.cellPadding,
        height: containerHeight - 2 * config.cellPadding,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        isClientLogo: true,
      });
      group.remove(existingLogo);
      group.add(newPlaceholder);
    }

    fabricCanvas.requestRenderAll();
  };

  // Update all title blocks
  const updateAllTitleBlocks = () => {
    const details = getClientDetails();
    const activeTitleBlocks = getActiveTitleBlocks();

    // Filter out titleblocks that are no longer on canvas and update the rest
    window.activeTitleBlocks = activeTitleBlocks.filter((block) => {
      if (fabricCanvas.getObjects().includes(block)) {
        updateTitleBlock(block, details);
        return true;
      }
      return false;
    });
  };

  // Create rectangle for title block
  const createRect = (left, top, width, height, fill = "white") => new fabric.Rect({ left, top, width, height, fill, stroke: config.borderColor, strokeWidth: 1 });

  // Create text box for title block
  const createText = (text, left, top, width, options = {}) => new fabric.Textbox(text, { left, top, width, fontSize: config.fontSize, fontFamily: config.fontFamily, ...options });

  // Create title block group
  const createTitleBlock = (left, top) => {
    const details = getClientDetails();
    const items = [];
    const colWidth = config.width / 3;
    const colHeight = config.height;

    const columns = [
      {
        x: 0,
        sections: [
          { header: "Client Logo", height: (colHeight * 2) / 3, content: "", isLogo: true },
          { header: "Completed Date", height: (colHeight * 1) / 3, content: details.date, field: "isDateField" },
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

        if (section.isLogo) {
          const placeholder = createText("", col.x + config.cellPadding, yOffset + headerHeight + config.cellPadding, colWidth - 2 * config.cellPadding, { isClientLogo: true });
          items.push(placeholder);
        } else {
          const textObj = createText(section.content, col.x + config.cellPadding, yOffset + headerHeight + config.cellPadding, colWidth - 2 * config.cellPadding, { editable: !!section.editable, [section.field]: true });
          items.push(textObj);
        }

        yOffset += section.height;
      });
    });

    const group = new fabric.Group(items, {
      left,
      top,
      selectable: true,
      hasControls: true,
      hasBorders: true,
      deviceType: "title-block",
      cursorColor: "#f8794b",
      borderColor: "#f8794b",
      borderScaleFactor: 2,
      cornerSize: 8,
      cornerColor: "#f8794b",
      cornerStrokeColor: "#000000",
      cornerStyle: "circle",
      transparentCorners: false,
    });

    // Generate unique ID for save system
    group.id = `titleblock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Temporarily disable undo tracking for individual objects
    const wasExecuting = window.undoSystem ? window.undoSystem.isExecutingCommand : false;
    if (window.undoSystem) window.undoSystem.isExecutingCommand = true;

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    addToActiveTitleBlocks(group);

    // Re-enable undo tracking and create a single command for the titleblock
    if (window.undoSystem) {
      window.undoSystem.isExecutingCommand = wasExecuting;
      const command = new window.UndoCommands.AddCommand(fabricCanvas, group, []);
      window.undoSystem.addToStack(command);
    }

    fabricCanvas.requestRenderAll();
    stopCurrentTool();

    if (details.logoSrc) {
      setTimeout(() => {
        const placeholder = group.getObjects().find((obj) => obj.isClientLogo);
        if (placeholder) {
          const containerLeft = placeholder.left - config.cellPadding;
          const containerTop = placeholder.top - config.cellPadding;
          const containerWidth = colWidth;
          const containerHeight = (colHeight * 2) / 3 - 20;

          group.remove(placeholder);
          createLogo(group, details.logoSrc, containerLeft, containerTop, containerWidth, containerHeight);
        }
      }, 100);
    }
  };

  // Constrain logo movement within its container
  fabricCanvas.on("object:moving", function (e) {
    const obj = e.target;

    if (obj.type === "image" && obj.isClientLogo && obj.containerBounds) {
      const bounds = obj.containerBounds;
      const objBounds = obj.getBoundingRect();

      if (objBounds.left < bounds.left) {
        obj.set("left", obj.left + (bounds.left - objBounds.left));
      }
      if (objBounds.left + objBounds.width > bounds.right) {
        obj.set("left", obj.left - (objBounds.left + objBounds.width - bounds.right));
      }

      if (objBounds.top < bounds.top) {
        obj.set("top", obj.top + (bounds.top - objBounds.top));
      }
      if (objBounds.top + objBounds.height > bounds.bottom) {
        obj.set("top", obj.top - (objBounds.top + objBounds.height - bounds.bottom));
      }
    }
  });

  // Set up input listeners for title block updates
  const setupListeners = () => {
    ["client-date-input", "client-name-test-input", "address-input", "report-title-input", "rev-one-input", "rev-two-input", "rev-three-input"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", updateAllTitleBlocks);
        input.addEventListener("change", updateAllTitleBlocks);
      }
    });

    const logoUpload = document.getElementById("client-logo-upload");
    if (logoUpload) {
      logoUpload.addEventListener("change", (e) => {
        if (e.target.files?.[0]) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const preview = document.getElementById("client-logo-preview");
            if (preview) {
              preview.innerHTML = `<img src="${event.target.result}" alt="Client Logo" style="max-width: 100%; max-height: 100px;">`;
              setTimeout(updateAllTitleBlocks, 100);
            }
          };
          reader.readAsDataURL(e.target.files[0]);
        }
      });
    }

    const logoPreview = document.getElementById("client-logo-preview");
    if (logoPreview) {
      new MutationObserver(() => setTimeout(updateAllTitleBlocks, 100)).observe(logoPreview, { childList: true, subtree: true });
    }
  };

  // Handle mouse down to place title block
  const onMouseDown = (event) => {
    const pointer = fabricCanvas.getPointer(event.e);
    createTitleBlock(pointer.x - config.width / 2, pointer.y - config.height / 2);
  };

  // Start title block mode
  const startTitleBlockMode = () => {
    if (isTitleBlockMode) return;
    isTitleBlockMode = true;
    closeSidebar();
    cleanupTitleBlockMode(); // Clean up any existing state
    registerToolCleanup(cleanupTitleBlockMode); // Register cleanup with drawing utils
    startTool(fabricCanvas, "titleblock", onMouseDown);
  };

  // Activate tool on button click
  if (addTitleBlockBtn) {
    // Remove existing event listeners to prevent duplicates
    const newButton = addTitleBlockBtn.cloneNode(true);
    addTitleBlockBtn.parentNode.replaceChild(newButton, addTitleBlockBtn);

    newButton.addEventListener("click", (e) => {
      e.preventDefault();
      startTitleBlockMode();
    });
  }

  // Track title block removal
  const removalHandler = (e) => {
    if (e.target && e.target.deviceType === "title-block") {
      removeFromActiveTitleBlocks(e.target);
    }
  };

  // Remove existing handler and add new one
  fabricCanvas.off("object:removed", removalHandler);
  fabricCanvas.on("object:removed", removalHandler);

  // Setup color picker and listeners
  setupColorPicker(fabricCanvas);
  setupListeners();

  // Clean up function for save system integration
  const cleanup = () => {
    fabricCanvas.off("object:moving");
    fabricCanvas.off("object:removed", removalHandler);
  };

  // Expose cleanup function globally for save system
  window.titleBlockCleanup = cleanup;
  window.updateAllTitleBlocks = updateAllTitleBlocks;
}
