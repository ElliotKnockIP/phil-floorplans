import { closeSidebar, startTool, stopCurrentTool, setupDeletion, applyStandardStyling } from "./drawing-utils.js";

// Sets up shape drawing tools
export function setupShapeTools(fabricCanvas) {
  const circleBtn = document.getElementById("add-circle-btn");
  const squareBtn = document.getElementById("add-square-btn");
  const accessPointBtn = document.getElementById("add-access-point-btn");
  const hotspotBtn = document.getElementById("create-hotspot-btn");

  setupDeletion(fabricCanvas, (obj) => {
    const isShape = obj.type === "circle" || obj.type === "rect";
    const isSpecial = obj.isAccessPoint === true || obj.isHotspot === true;
    return isShape || isSpecial;
  });

  // Activates circle tool
  if (circleBtn) {
    circleBtn.addEventListener("click", () => {
      closeSidebar();
      startTool(fabricCanvas, "circle", handleCircleClick);
    });
  } else {
    document.addEventListener("htmlIncludesLoaded", () => {
      document.getElementById("add-circle-btn")?.addEventListener("click", () => {
        closeSidebar();
        startTool(fabricCanvas, "circle", handleCircleClick);
      });
    });
  }

  // Activates square tool
  if (squareBtn) {
    squareBtn.addEventListener("click", () => {
      closeSidebar();
      startTool(fabricCanvas, "square", handleSquareClick);
    });
  } else {
    document.addEventListener("htmlIncludesLoaded", () => {
      document.getElementById("add-square-btn")?.addEventListener("click", () => {
        closeSidebar();
        startTool(fabricCanvas, "square", handleSquareClick);
      });
    });
  }

  if (accessPointBtn) {
    accessPointBtn.addEventListener("click", () => {
      closeSidebar();
      startTool(fabricCanvas, "access-point", handleAccessPointClick);
    });
  }

  if (hotspotBtn) {
    hotspotBtn.addEventListener("click", () => {
      closeSidebar();
      startTool(fabricCanvas, "hotspot", handleHotspotClick);
    });
  }

  // Shows popover for access points
  const openAccessPointPopover = (target) => {
    if (target && target.isAccessPoint && typeof window.showAccessPointPopover === "function") {
      window.showAccessPointPopover(target);
    }
  };

  // Shows popover for hotspots
  const openHotspotPopover = (target) => {
    if (target && target.isHotspot && typeof window.showHotspotPopover === "function") {
      window.showHotspotPopover(target);
    }
  };

  // Handles selection events to show popovers
  fabricCanvas.on("selection:created", (e) => {
    const target = e.selected?.[0];
    openAccessPointPopover(target);
    openHotspotPopover(target);
  });

  // Updates popover when selection changes
  fabricCanvas.on("selection:updated", (e) => {
    const target = e.selected?.[0];
    openAccessPointPopover(target);
    openHotspotPopover(target);
  });

  // Hides popovers when selection is cleared
  fabricCanvas.on("selection:cleared", () => {
    if (typeof window.hideAccessPointPopover === "function") {
      window.hideAccessPointPopover();
    }
    if (typeof window.hideHotspotPopover === "function") {
      window.hideHotspotPopover();
    }
  });

  // Places circle on canvas
  function handleCircleClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const circle = new fabric.Circle({
      left: pointer.x,
      top: pointer.y,
      radius: 50,
      fill: "rgba(255, 0, 0, 0.3)",
      stroke: "red",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      strokeUniform: true,
    });

    applyStandardStyling(circle);
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    stopCurrentTool();
  }

  // Places square on canvas
  function handleSquareClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const square = new fabric.Rect({
      left: pointer.x - 50,
      top: pointer.y - 50,
      width: 100,
      height: 100,
      fill: "rgba(0, 0, 255, 0.3)",
      stroke: "blue",
      strokeWidth: 1,
      strokeUniform: true,
    });

    applyStandardStyling(square);
    fabricCanvas.add(square);
    fabricCanvas.setActiveObject(square);
    stopCurrentTool();
  }

  // Places an access point marker (circle with number)
  function handleAccessPointClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const labelNumber = window.accessPointCounter ?? 1;
    window.accessPointCounter = labelNumber + 1;
    const label = String(labelNumber);
    const defaultName = `Access Point ${label}`;

    const circle = new fabric.Circle({
      radius: 16,
      originX: "center",
      originY: "center",
      fill: "#fff200",
      stroke: "#002b45",
      strokeWidth: 4,
      strokeUniform: true,
    });

    const text = new fabric.IText(label, {
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: "700",
      fill: "#002b45",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    const group = new fabric.Group([circle, text], {
      left: pointer.x,
      top: pointer.y,
      originX: "center",
      originY: "center",
      lockUniScaling: true,
      isAccessPoint: true,
      groupType: "accessPoint",
      accessPointLabel: label,
      accessPointName: defaultName,
      accessPointCondition: "",
      accessPointNotes: "",
      accessPointColor: circle.fill,
      subTargetCheck: false,
    });

    applyStandardStyling(group);
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();

    if (typeof window.showAccessPointPopover === "function") {
      window.showAccessPointPopover(group);
    }

    stopCurrentTool();
  }

  // Places a hotspot marker (circle with number) for safety
  function handleHotspotClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const labelNumber = window.hotspotCounter ?? 1;
    window.hotspotCounter = labelNumber + 1;
    const label = String(labelNumber);
    const defaultName = `Hotspot ${label}`;

    const circle = new fabric.Circle({
      radius: 16,
      originX: "center",
      originY: "center",
      fill: "#ff6b35",
      stroke: "#8b0000",
      strokeWidth: 4,
      strokeUniform: true,
    });

    const text = new fabric.IText(label, {
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: "700",
      fill: "#ffffff",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    const group = new fabric.Group([circle, text], {
      left: pointer.x,
      top: pointer.y,
      originX: "center",
      originY: "center",
      lockUniScaling: true,
      isHotspot: true,
      groupType: "hotspot",
      hotspotLabel: label,
      hotspotName: defaultName,
      hotspotSeverity: "",
      hotspotNotes: "",
      hotspotColor: circle.fill,
      hotspotStroke: circle.stroke,
      subTargetCheck: false,
    });

    applyStandardStyling(group);
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();

    if (typeof window.showHotspotPopover === "function") {
      window.showHotspotPopover(group);
    }

    stopCurrentTool();
  }
}
