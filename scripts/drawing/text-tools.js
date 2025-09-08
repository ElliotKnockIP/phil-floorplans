import { closeSidebar, startTool, stopCurrentTool, setupDeletion, setupColorPicker, applyStandardStyling } from "./drawing-utils.js";

export function setupTextTools(fabricCanvas) {
  const textBtn = document.getElementById("add-text-btn");
  const descBtn = document.getElementById("add-description-btn");

  // Enable color picker and deletion for text objects
  setupColorPicker(fabricCanvas);
  setupDeletion(fabricCanvas, (obj) => (obj.type === "i-text" || obj.type === "textbox") && !obj.isEditing);

  // Activate Text tool on button click
  textBtn.addEventListener("click", () => {
    closeSidebar();
    startTool(fabricCanvas, "text", handleTextClick);
  });

  // Activate Description tool on button click
  descBtn.addEventListener("click", () => {
    closeSidebar();
    startTool(fabricCanvas, "description", handleDescriptionClick);
  });

  // Handle placing a text object on the canvas
  function handleTextClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const text = new fabric.IText("Enter Text", {
      left: pointer.x,
      top: pointer.y,
      fontSize: 20,
      fill: "#000000",
      fontFamily: "Poppins, sans-serif",
      originX: "center",
      originY: "center",
      cursorColor: "#f8794b",
    });

    applyStandardStyling(text);
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    stopCurrentTool();
  }

  // Handle placing a description object on the canvas
  function handleDescriptionClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const pointer = fabricCanvas.getPointer(e.e);
    const desc = new fabric.IText("Enter Description", {
      left: pointer.x,
      top: pointer.y,
      width: 170,
      fontSize: 20,
      fill: "#000000",
      fontFamily: "Poppins, sans-serif",
      originX: "center",
      originY: "center",
      stroke: "#000000",
      strokeWidth: 1,
      cursorColor: "#f8794b",
    });

    applyStandardStyling(desc);
    fabricCanvas.add(desc);
    fabricCanvas.setActiveObject(desc);
    stopCurrentTool();
  }
}
