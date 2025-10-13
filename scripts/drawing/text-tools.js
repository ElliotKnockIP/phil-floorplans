import { closeSidebar, startTool, stopCurrentTool, setupDeletion, setupColorPicker, setupTextColorPicker, applyStandardStyling } from "./drawing-utils.js";

export function setupTextTools(fabricCanvas) {
  const textBtn = document.getElementById("add-text-btn");

  // Enable color picker and deletion for text objects
  setupColorPicker(fabricCanvas);
  setupTextColorPicker(fabricCanvas);
  setupDeletion(fabricCanvas, (obj) => (obj.type === "i-text" || obj.type === "textbox") && !obj.isEditing);

  // Setup text size dropdown
  setupTextSizeDropdown(fabricCanvas);
  
  // Setup bold toggle
  setupBoldToggle(fabricCanvas);
  
  // Setup italic toggle
  setupItalicToggle(fabricCanvas);

  // Activate Text tool on button click
  textBtn.addEventListener("click", () => {
    closeSidebar();
    startTool(fabricCanvas, "text", handleTextClick);
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
}

// Setup text size dropdown
function setupTextSizeDropdown(fabricCanvas) {
  const dropdown = document.getElementById("text-size-dropdown");
  
  dropdown.addEventListener("change", () => {
    const fontSize = parseInt(dropdown.value);
    const activeObject = fabricCanvas.getActiveObject();
    
    if (activeObject) {
      // Handle text objects directly
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        activeObject.set("fontSize", fontSize);
        fabricCanvas.renderAll();
      }
      // Handle groups (like measurements, building front, etc.) that contain text
      else if (activeObject.type === "group" && activeObject._objects) {
        activeObject._objects.forEach((obj) => {
          if (obj.type === "i-text" || obj.type === "textbox" || obj.type === "text") {
            obj.set("fontSize", fontSize);
          }
        });
        fabricCanvas.renderAll();
      }
    }
  });
  
  // Update dropdown when selection changes
  fabricCanvas.on("selection:created", updateDropdownValue);
  fabricCanvas.on("selection:updated", updateDropdownValue);
  fabricCanvas.on("selection:cleared", () => {
    dropdown.value = "";
  });
  
  function updateDropdownValue() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      let textSize = null;
      
      // Get font size from text objects or groups containing text
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        textSize = activeObject.fontSize;
      } else if (activeObject.type === "group" && activeObject._objects) {
        const textObj = activeObject._objects.find((obj) => obj.type === "i-text" || obj.type === "textbox" || obj.type === "text");
        if (textObj) textSize = textObj.fontSize;
      }
      
      // Update dropdown to match current size, or reset to "Current" if size doesn't match options
      if (textSize && (textSize === 14 || textSize === 18 || textSize === 24 || textSize === 32)) {
        dropdown.value = textSize;
      } else {
        dropdown.value = "";
      }
    }
  }
}

// Setup bold toggle
function setupBoldToggle(fabricCanvas) {
  const boldBtn = document.getElementById("bold-toggle-btn");
  
  boldBtn.addEventListener("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    
    if (activeObject) {
      let isBold = false;
      
      // Handle text objects directly
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        isBold = activeObject.fontWeight === "bold";
        activeObject.set("fontWeight", isBold ? "normal" : "bold");
        fabricCanvas.renderAll();
        boldBtn.style.background = isBold ? "white" : "#f8794b";
      }
      // Handle groups (like measurements, building front, etc.) that contain text
      else if (activeObject.type === "group" && activeObject._objects) {
        const textObj = activeObject._objects.find((obj) => obj.type === "i-text" || obj.type === "textbox" || obj.type === "text");
        if (textObj) {
          isBold = textObj.fontWeight === "bold";
          // Apply to all text objects in the group
          activeObject._objects.forEach((obj) => {
            if (obj.type === "i-text" || obj.type === "textbox" || obj.type === "text") {
              obj.set("fontWeight", isBold ? "normal" : "bold");
            }
          });
          fabricCanvas.renderAll();
          boldBtn.style.background = isBold ? "white" : "#f8794b";
        }
      }
    }
  });
  
  // Update button state when selection changes
  fabricCanvas.on("selection:created", updateBoldButton);
  fabricCanvas.on("selection:updated", updateBoldButton);
  fabricCanvas.on("selection:cleared", () => {
    boldBtn.style.background = "white";
  });
  
  function updateBoldButton() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      let isBold = false;
      
      // Check if text is bold (for text objects or groups containing text)
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        isBold = activeObject.fontWeight === "bold";
      } else if (activeObject.type === "group" && activeObject._objects) {
        const textObj = activeObject._objects.find((obj) => obj.type === "i-text" || obj.type === "textbox" || obj.type === "text");
        if (textObj) isBold = textObj.fontWeight === "bold";
      }
      
      boldBtn.style.background = isBold ? "#f8794b" : "white";
    }
  }
}

// Setup italic toggle
function setupItalicToggle(fabricCanvas) {
  const italicBtn = document.getElementById("italic-toggle-btn");
  
  italicBtn.addEventListener("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    
    if (activeObject) {
      let isItalic = false;
      
      // Handle text objects directly
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        isItalic = activeObject.fontStyle === "italic";
        activeObject.set("fontStyle", isItalic ? "normal" : "italic");
        fabricCanvas.renderAll();
        italicBtn.style.background = isItalic ? "white" : "#f8794b";
      }
      // Handle groups (like measurements, building front, etc.) that contain text
      else if (activeObject.type === "group" && activeObject._objects) {
        const textObj = activeObject._objects.find((obj) => obj.type === "i-text" || obj.type === "textbox" || obj.type === "text");
        if (textObj) {
          isItalic = textObj.fontStyle === "italic";
          // Apply to all text objects in the group
          activeObject._objects.forEach((obj) => {
            if (obj.type === "i-text" || obj.type === "textbox" || obj.type === "text") {
              obj.set("fontStyle", isItalic ? "normal" : "italic");
            }
          });
          fabricCanvas.renderAll();
          italicBtn.style.background = isItalic ? "white" : "#f8794b";
        }
      }
    }
  });
  
  // Update button state when selection changes
  fabricCanvas.on("selection:created", updateItalicButton);
  fabricCanvas.on("selection:updated", updateItalicButton);
  fabricCanvas.on("selection:cleared", () => {
    italicBtn.style.background = "white";
  });
  
  function updateItalicButton() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      let isItalic = false;
      
      // Check if text is italic (for text objects or groups containing text)
      if (activeObject.type === "i-text" || activeObject.type === "textbox" || activeObject.type === "text") {
        isItalic = activeObject.fontStyle === "italic";
      } else if (activeObject.type === "group" && activeObject._objects) {
        const textObj = activeObject._objects.find((obj) => obj.type === "i-text" || obj.type === "textbox" || obj.type === "text");
        if (textObj) isItalic = textObj.fontStyle === "italic";
      }
      
      italicBtn.style.background = isItalic ? "#f8794b" : "white";
    }
  }
}
