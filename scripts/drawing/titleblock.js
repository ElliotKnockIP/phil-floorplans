import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup, setupColorPicker } from "./drawing-utils.js";

if (!window.activeTitleBlocks) window.activeTitleBlocks = [];

// Initializes title block tool and state
export function setupTitleBlockTool(fabricCanvas) {
  const addTitleBlockBtn = document.getElementById("titleblock-btn");
  let isTitleBlockMode = false;
  const config = {
    width: 950,
    height: 360,
    borderColor: "#000000",
    fontSize: 14,
    fontFamily: "Arial",
    cellPadding: 12,
  };

  // Helper to get active title blocks from global state
  const getActiveTitleBlocks = () => window.activeTitleBlocks || [];

  // Adds a title block to the tracking list
  const addToActiveTitleBlocks = (block) => (window.activeTitleBlocks = window.activeTitleBlocks || []).push(block);

  // Removes a title block from the tracking list
  const removeFromActiveTitleBlocks = (block) => {
    if (window.activeTitleBlocks) {
      window.activeTitleBlocks = window.activeTitleBlocks.filter((b) => b !== block);
    }
  };

  // Gets value from an input element
  const getValue = (id) => document.getElementById(id)?.value || "";

  // Collects all client details from the UI
  const getClientDetails = () => {
    const logoImg = document.querySelector("#client-logo-preview img");
    return {
      date: getValue("client-date-input"),
      name: getValue("client-name-test-input"),
      address: getValue("address-input"),
      title: getValue("report-title-input"),
      logoSrc: logoImg?.src || null,
      revs: ["rev-one-input", "rev-two-input", "rev-three-input"].map(getValue),
    };
  };

  // Creates and adds client logo image to the title block group
  const createLogo = (group, logoSrc, left, top, width, height) => {
    fabric.Image.fromURL(
      logoSrc,
      (img) => {
        const availableW = width - 2 * config.cellPadding;
        const availableH = height - 2 * config.cellPadding;
        const scale = Math.min(availableW / img.width, availableH / img.height);
        const logoX = left + config.cellPadding + (availableW - img.width * scale) / 2;
        const logoY = top + config.cellPadding + (availableH - img.height * scale) / 2;

        img.set({
          left: logoX,
          top: logoY,
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          isClientLogo: true,
        });
        img.containerBounds = {
          left: left,
          top: top,
          right: left + width,
          bottom: top + height,
        };
        group.add(img);
        fabricCanvas.requestRenderAll();
      },
      { crossOrigin: "anonymous" }
    );
  };

  // Updates text and logo in a specific title block group
  const updateTitleBlock = (group, details) => {
    const objects = group.getObjects();
    const containerW = config.width / 3;
    const containerH = config.height * (2 / 3) - 20;

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
        if (!obj.splitByGrapheme) obj.set({ splitByGrapheme: true });
        const key = Object.keys(fieldMap).find((k) => obj[k]);
        if (key) obj.set({ text: fieldMap[key] });
      }
    });

    const placeholder = objects.find((o) => o.isClientLogo && o.type === "textbox");
    const existingLogo = objects.find((o) => o.isClientLogo && o.type === "image");

    const getLogoContainer = (obj) => {
      const x = obj.containerBounds?.left ?? obj.left - config.cellPadding;
      const y = obj.containerBounds?.top ?? obj.top - config.cellPadding;
      return { x, y };
    };

    if (details.logoSrc) {
      const obj = placeholder || (existingLogo?._originalElement?.src !== details.logoSrc ? existingLogo : null);
      if (obj) {
        const { x, y } = getLogoContainer(obj);
        group.remove(obj);
        createLogo(group, details.logoSrc, x, y, containerW, containerH);
      }
    } else if (existingLogo) {
      const { x, y } = getLogoContainer(existingLogo);
      group.remove(existingLogo);
      group.add(
        new fabric.Textbox("", {
          left: x + config.cellPadding,
          top: y + config.cellPadding,
          width: containerW - 2 * config.cellPadding,
          height: containerH - 2 * config.cellPadding,
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          isClientLogo: true,
        })
      );
    }
    fabricCanvas.requestRenderAll();
  };

  // Updates all active title blocks with current client details
  const updateAllTitleBlocks = () => {
    const details = getClientDetails();
    window.activeTitleBlocks = getActiveTitleBlocks().filter((block) => {
      const active = fabricCanvas.getObjects().includes(block);
      if (active) updateTitleBlock(block, details);
      return active;
    });
  };

  // Creates a rectangle for the title block grid
  const createRect = (left, top, width, height, fill = "white") => {
    return new fabric.Rect({
      left,
      top,
      width,
      height,
      fill,
      stroke: config.borderColor,
      strokeWidth: 1,
    });
  };

  // Creates a textbox for the title block grid
  const createText = (text, left, top, width, options = {}) =>
    new fabric.Textbox(text, {
      left,
      top,
      width,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      splitByGrapheme: true,
      ...options,
    });

  // Constructs the full title block group at specified coordinates
  const createTitleBlock = (left, top) => {
    const details = getClientDetails();
    const items = [];
    const colW = config.width / 3;
    const colH = config.height;
    const logoH = (colH * 2) / 3 - 20;

    const columns = [
      {
        x: 0,
        sections: [
          { header: "Client Logo", height: (colH * 2) / 3, content: "", isLogo: true },
          {
            header: "Completed Date",
            height: colH / 3,
            content: details.date,
            field: "isDateField",
          },
        ],
      },
      {
        x: colW,
        sections: [
          { header: "Client Name", height: colH / 3, content: details.name, field: "isClientName" },
          {
            header: "Client Address",
            height: colH / 3,
            content: details.address,
            field: "isClientAddress",
          },
          {
            header: "Report Title",
            height: colH / 3,
            content: details.title,
            field: "isReportTitle",
          },
        ],
      },
      {
        x: colW * 2,
        sections: [
          {
            header: "Rev 1",
            height: colH / 3,
            content: details.revs[0],
            field: "isRev1",
            editable: true,
          },
          {
            header: "Rev 2",
            height: colH / 3,
            content: details.revs[1],
            field: "isRev2",
            editable: true,
          },
          {
            header: "Rev 3",
            height: colH / 3,
            content: details.revs[2],
            field: "isRev3",
            editable: true,
          },
        ],
      },
    ];

    columns.forEach((col) => {
      let y = 0;
      col.sections.forEach((s) => {
        const headerH = 20;
        const contentH = s.height - headerH;
        items.push(createRect(col.x, y, colW, headerH, "#f0f0f0"));
        items.push(
          createText(s.header, col.x + config.cellPadding, y + 3, colW - 2 * config.cellPadding, {
            textAlign: "center",
            isHeader: true,
          })
        );
        items.push(createRect(col.x, y + headerH, colW, contentH));

        const textOpts = s.isLogo ? { isClientLogo: true } : { textAlign: "center", editable: !!s.editable, [s.field]: true };

        const textX = col.x + config.cellPadding;
        const textY = y + headerH + config.cellPadding;
        const textW = colW - 2 * config.cellPadding;

        items.push(createText(s.content, textX, textY, textW, textOpts));
        y += s.height;
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
    group.id = `titleblock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    if (details.logoSrc) {
      setTimeout(() => {
        const placeholder = group.getObjects().find((obj) => obj.isClientLogo);
        if (placeholder) {
          group.remove(placeholder);
          const logoX = placeholder.left - config.cellPadding;
          const logoY = placeholder.top - config.cellPadding;
          createLogo(group, details.logoSrc, logoX, logoY, colW, logoH);
        }
      }, 100);
    }
  };

  // Constrains logo movement within its container
  fabricCanvas.on("object:moving", (e) => {
    const obj = e.target;
    if (obj.type === "image" && obj.isClientLogo && obj.containerBounds) {
      const bounds = obj.containerBounds;
      const rect = obj.getBoundingRect();

      if (rect.left < bounds.left) obj.set("left", obj.left + (bounds.left - rect.left));
      if (rect.left + rect.width > bounds.right) obj.set("left", obj.left - (rect.left + rect.width - bounds.right));
      if (rect.top < bounds.top) obj.set("top", obj.top + (bounds.top - rect.top));
      if (rect.top + rect.height > bounds.bottom) obj.set("top", obj.top - (rect.top + rect.height - bounds.bottom));
    }
  });

  // Updates logo preview in sidebar and saves to local storage
  const updateLogoPreview = (dataUrl) => {
    const preview = document.getElementById("client-logo-preview");
    if (preview) {
      preview.innerHTML = `<img src="${dataUrl}" alt="Client Logo" style="max-width: 100%; max-height: 100px;">`;
      try {
        localStorage.setItem("clientLogoDataUrl", dataUrl);
      } catch (_) {}
      setTimeout(updateAllTitleBlocks, 100);
    }
  };

  // Sets up event listeners for client detail inputs and logo upload
  const setupListeners = () => {
    const inputIds = ["client-date-input", "client-name-test-input", "address-input", "report-title-input", "rev-one-input", "rev-two-input", "rev-three-input"];
    inputIds.forEach((id) => {
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
          reader.onload = (event) => updateLogoPreview(event.target.result);
          reader.readAsDataURL(e.target.files[0]);
        }
      });
    }

    const logoPreview = document.getElementById("client-logo-preview");
    if (logoPreview) {
      new MutationObserver(() => {
        setTimeout(updateAllTitleBlocks, 100);
        try {
          const img = logoPreview.querySelector("img");
          if (img?.src) localStorage.setItem("clientLogoDataUrl", img.src);
          else localStorage.removeItem("clientLogoDataUrl");
        } catch (_) {}
      }).observe(logoPreview, { childList: true, subtree: true });

      try {
        const saved = localStorage.getItem("clientLogoDataUrl");
        if (saved && !logoPreview.querySelector("img")) updateLogoPreview(saved);
      } catch (_) {}
    }
  };

  // Handles mouse down to place title block
  const onMouseDown = (e) => {
    const p = fabricCanvas.getPointer(e.e);
    createTitleBlock(p.x - config.width / 2, p.y - config.height / 2);
  };

  // Activates title block placement mode
  const startTitleBlockMode = () => {
    if (isTitleBlockMode) return;
    isTitleBlockMode = true;
    closeSidebar();
    registerToolCleanup(() => (isTitleBlockMode = false));
    startTool(fabricCanvas, "titleblock", onMouseDown);
  };

  // Sets up title block button with click handler
  if (addTitleBlockBtn) {
    const newBtn = addTitleBlockBtn.cloneNode(true);
    addTitleBlockBtn.parentNode.replaceChild(newBtn, addTitleBlockBtn);
    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startTitleBlockMode();
    });
  }

  // Handles removal of title blocks from tracking
  const removalHandler = (e) => e.target?.deviceType === "title-block" && removeFromActiveTitleBlocks(e.target);
  fabricCanvas.off("object:removed", removalHandler);
  fabricCanvas.on("object:removed", removalHandler);

  setupColorPicker(fabricCanvas);
  setupListeners();

  // Cleanup function for title block tool
  const cleanup = () => {
    fabricCanvas.off("object:moving");
    fabricCanvas.off("object:removed", removalHandler);
  };

  window.titleBlockCleanup = cleanup;
  window.updateAllTitleBlocks = updateAllTitleBlocks;
}
