import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

// Sets up network link drawing tool for connecting devices
export function setupNetworkLinkTool(fabricCanvas) {
  const networkLinkBtn = document.getElementById("network-link-btn");
  
  let sourceDevice = null;
  let tempConnectionLine = null;
  let isConnecting = false;
  let createCooldown = false;

  // Activate network link tool
  networkLinkBtn.addEventListener("click", () => {
    closeSidebar();
    cleanupTempObjects();
    registerToolCleanup(cleanupTempObjects);
    startTool(fabricCanvas, "network-link", handleNetworkLinkClick, handleNetworkLinkMove, handleNetworkLinkKey);
  });

  // Cleanup function for temporary objects
  function cleanupTempObjects() {
    if (tempConnectionLine) {
      fabricCanvas.remove(tempConnectionLine);
      tempConnectionLine = null;
    }
    sourceDevice = null;
    isConnecting = false;
    fabricCanvas.defaultCursor = 'default';
    fabricCanvas.hoverCursor = 'move';
    hideConnectionInstruction();
    fabricCanvas.requestRenderAll();
  }

  // Handle network link click events
  function handleNetworkLinkClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const target = fabricCanvas.findTarget(e.e);
    
    // Only allow clicking on devices (groups with deviceType)
    if (!target || target.type !== 'group' || !target.deviceType) {
      return;
    }

    if (!isConnecting) {
      // First click - select source device
      sourceDevice = target;
      isConnecting = true;
      
      // Change cursor to indicate connection mode
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.hoverCursor = 'crosshair';
      
      // Show instruction
      showConnectionInstruction();
      
    } else {
      // Second click - create connection to target device
      if (target === sourceDevice) {
        // Clicked same device, start new connection from this device
        // Just update the instruction, keep the same source
        updateConnectionInstruction();
        return;
      }
      
      // Create connection between devices using topology manager with a tiny cooldown to avoid double-create
      if (window.topologyManager && !createCooldown) {
        createCooldown = true;
        window.topologyManager.createConnection(sourceDevice, target);
        setTimeout(() => (createCooldown = false), 300);
      }
      
      // Reset for next connection - clear highlights but stay in tool mode
      if (tempConnectionLine) {
        fabricCanvas.remove(tempConnectionLine);
        tempConnectionLine = null;
      }
      
      // Start new connection from the target device
      sourceDevice = target;
      updateConnectionInstruction();
    }
  }

  // Handle mouse movement to show temporary connection line
  function handleNetworkLinkMove(e) {
    if (!isConnecting || !sourceDevice) return;

    const pointer = fabricCanvas.getPointer(e.e);
    const sourceCenter = getDeviceCenter(sourceDevice);

    // Remove existing temp line
    if (tempConnectionLine) {
      fabricCanvas.remove(tempConnectionLine);
    }

    // Create new temp line from source device to mouse pointer
    tempConnectionLine = new fabric.Line([
      sourceCenter.x, sourceCenter.y,
      pointer.x, pointer.y
    ], {
      stroke: '#2196F3',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      opacity: 0.7
    });

    fabricCanvas.add(tempConnectionLine);
    fabricCanvas.requestRenderAll();
  }

  // Handle keyboard events (ESC to cancel)
  function handleNetworkLinkKey(e) {
    if (e.key === 'Escape') {
      cleanupTempObjects();
      stopCurrentTool();
    }
  }

  // Helper function to get device center point
  function getDeviceCenter(device) {
    const center = device.getCenterPoint ? device.getCenterPoint() : {
      x: device.left,
      y: device.top
    };
    
    return {
      x: center.x,
      y: center.y
    };
  }

  // Show connection instruction
  function showConnectionInstruction() {
    let instructionDiv = document.getElementById('network-link-instruction');
    if (!instructionDiv) {
      instructionDiv = document.createElement('div');
      instructionDiv.id = 'network-link-instruction';
      instructionDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(33, 150, 243, 0.95);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 9999;
        font-family: Poppins, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(instructionDiv);
    }
    instructionDiv.textContent = 'Click on another device to create network connection. Press ESC to stop.';
    instructionDiv.style.display = 'block';
  }

  // Update connection instruction for continuous mode
  function updateConnectionInstruction() {
    const instructionDiv = document.getElementById('network-link-instruction');
    if (instructionDiv) {
      instructionDiv.textContent = 'Connection created! Click on another device to continue, or press ESC to stop.';
      // Show success feedback briefly, then return to normal instruction
      setTimeout(() => {
        if (instructionDiv.style.display === 'block') {
          instructionDiv.textContent = 'Click on another device to create network connection. Press ESC to stop.';
        }
      }, 1500);
    }
  }

  // Hide connection instruction
  function hideConnectionInstruction() {
    const instructionDiv = document.getElementById('network-link-instruction');
    if (instructionDiv) {
      instructionDiv.style.display = 'none';
    }
  }

  // Expose cleanup function so it can be called externally if needed
  window.cleanupNetworkLinkTempObjects = cleanupTempObjects;
}