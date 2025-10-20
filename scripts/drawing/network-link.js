import { closeSidebar, startTool, stopCurrentTool, registerToolCleanup } from "./drawing-utils.js";

// Sets up network link drawing tool for connecting devices
export function setupNetworkLinkTool(fabricCanvas) {
  const networkLinkBtn = document.getElementById("network-link-btn");
  
  let sourceDevice = null;
  let tempConnectionLine = null;
  let isConnecting = false;
  let createCooldown = false;
  let restrictionTimeout = null;

  if (!window.__networkLinkRestrictionListener) {
    window.__networkLinkRestrictionListener = (event) => {
      const message = event?.detail?.message;
      showRestrictionWarning(message);
    };
    document.addEventListener('topology:connection-blocked', window.__networkLinkRestrictionListener);
  }

  // Activates network link tool
  networkLinkBtn.addEventListener("click", () => {
    closeSidebar();
    cleanupTempObjects();
    registerToolCleanup(cleanupTempObjects);
    startTool(fabricCanvas, "network-link", handleNetworkLinkClick, handleNetworkLinkMove, handleNetworkLinkKey);
  });

  // Cleans up temporary objects
  function cleanupTempObjects() {
    if (tempConnectionLine) {
      fabricCanvas.remove(tempConnectionLine);
      tempConnectionLine = null;
    }
    if (restrictionTimeout) {
      clearTimeout(restrictionTimeout);
      restrictionTimeout = null;
    }
    sourceDevice = null;
    isConnecting = false;
    fabricCanvas.defaultCursor = 'default';
    fabricCanvas.hoverCursor = 'move';
    hideConnectionInstruction();
    fabricCanvas.requestRenderAll();
  }

  // Handles network link click events
  function handleNetworkLinkClick(e) {
    e.e.preventDefault();
    e.e.stopPropagation();

    const target = fabricCanvas.findTarget(e.e);
    
    if (!target || target.type !== 'group' || !target.deviceType) {
      return;
    }

    if (!isConnecting) {
      sourceDevice = target;
      isConnecting = true;
      
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.hoverCursor = 'crosshair';
      
      showConnectionInstruction();
      
    } else {
      if (target === sourceDevice) {
        updateConnectionInstruction();
        return;
      }
      
      let connectionCreated = false;
      if (window.topologyManager && !createCooldown) {
        const created = window.topologyManager.createConnection(sourceDevice, target);
        if (created) {
          connectionCreated = true;
          createCooldown = true;
          setTimeout(() => (createCooldown = false), 300);
        }
      }
      
      if (tempConnectionLine) {
        fabricCanvas.remove(tempConnectionLine);
        tempConnectionLine = null;
      }
      
      if (connectionCreated) {
        sourceDevice = target;
        updateConnectionInstruction();
      }
    }
  }

  // Shows temporary connection line during movement
  function handleNetworkLinkMove(e) {
    if (!isConnecting || !sourceDevice) return;

    const pointer = fabricCanvas.getPointer(e.e);
    const sourceCenter = getDeviceCenter(sourceDevice);

    if (tempConnectionLine) {
      fabricCanvas.remove(tempConnectionLine);
    }

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

  // Handles keyboard events (ESC to cancel)
  function handleNetworkLinkKey(e) {
    if (e.key === 'Escape') {
      cleanupTempObjects();
      stopCurrentTool();
    }
  }

  // Gets device center point
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

  function ensureInstructionDiv() {
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
    return instructionDiv;
  }

  // Shows connection instruction
  function showConnectionInstruction() {
    if (restrictionTimeout) {
      clearTimeout(restrictionTimeout);
      restrictionTimeout = null;
    }
    const instructionDiv = ensureInstructionDiv();
    instructionDiv.style.background = 'rgba(33, 150, 243, 0.95)';
    instructionDiv.textContent = 'Click on another device to create network connection.';
    instructionDiv.style.display = 'block';
  }

  // Updates connection instruction for continuous mode
  function updateConnectionInstruction() {
    const instructionDiv = ensureInstructionDiv();
    if (instructionDiv) {
      instructionDiv.style.background = 'rgba(33, 150, 243, 0.95)';
      instructionDiv.textContent = 'Connection created! Click on another device to continue, or press ESC to stop.';
      setTimeout(() => {
        if (instructionDiv.style.display === 'block') {
          instructionDiv.textContent = 'Click on another device to create network connection.';
        }
      }, 1500);
    }
  }

  // Hides connection instruction
  function hideConnectionInstruction() {
    if (restrictionTimeout) {
      clearTimeout(restrictionTimeout);
      restrictionTimeout = null;
    }
    const instructionDiv = document.getElementById('network-link-instruction');
    if (instructionDiv) {
      instructionDiv.style.display = 'none';
    }
  }

  function showRestrictionWarning(message) {
    const instructionDiv = ensureInstructionDiv();
    instructionDiv.style.background = 'rgba(220, 53, 69, 0.95)';
    instructionDiv.textContent = message || 'These devices cannot be linked. Use the same category or connect via Custom/Network devices.';
    instructionDiv.style.display = 'block';
    if (restrictionTimeout) {
      clearTimeout(restrictionTimeout);
    }
    restrictionTimeout = setTimeout(() => {
      restrictionTimeout = null;
      if (isConnecting) {
        showConnectionInstruction();
      } else {
        hideConnectionInstruction();
      }
    }, 2200);
  }

  // Exposes cleanup function for external use
  window.cleanupNetworkLinkTempObjects = cleanupTempObjects;
}