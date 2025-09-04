export class DeviceTakeoffGenerator {
  constructor(fabricCanvas, floorManager) {
    this.fabricCanvas = fabricCanvas;
    this.floorManager = floorManager;
  }

  // Extract device data from floor data or canvas
  extractDeviceData(source, floorNumber, floorName) {
    if (source === "canvas") {
      return this.extractFromCanvas(floorNumber, floorName);
    }
    return this.extractFromFloorData(source, floorNumber);
  }

  extractFromCanvas(floorNumber, floorName) {
    return this.fabricCanvas
      .getObjects()
      .filter((obj) => obj.type === "group" && obj.deviceType && obj.textObject)
      .map((obj) => this.createDeviceInfo(obj, floorNumber, floorName));
  }

  extractFromFloorData(floorData, floorNumber) {
    if (!floorData?.cameras?.cameraDevices) return [];

    return floorData.cameras.cameraDevices.filter((deviceData) => deviceData?.deviceType).map((deviceData) => this.createDeviceInfoFromData(deviceData, floorNumber, floorData.name));
  }

  createDeviceInfo(obj, floorNumber, floorName) {
    return {
      name: obj.textObject.text || "Unnamed Device",
      fittingPosition: obj.fittingPositions || "",
      partNumber: obj.partNumber || "",
      stockNumber: obj.stockNumber || "",
      deviceType: obj.deviceType,
      floor: floorNumber,
      floorName: floorName,
      position: { x: Math.round(obj.left), y: Math.round(obj.top) },
    };
  }

  createDeviceInfoFromData(deviceData, floorNumber, floorName) {
    return {
      name: deviceData.textLabel?.text || "Unnamed Device",
      fittingPosition: deviceData.deviceProperties?.fittingPositions || "",
      partNumber: deviceData.deviceProperties?.partNumber || "",
      stockNumber: deviceData.deviceProperties?.stockNumber || "",
      deviceType: deviceData.deviceType,
      floor: floorNumber,
      floorName: floorName || `Floor ${floorNumber}`,
      position: {
        x: Math.round(deviceData.position?.left || 0),
        y: Math.round(deviceData.position?.top || 0),
      },
    };
  }

  extractAllFloorsDeviceData() {
    if (!this.floorManager) {
      console.warn("No floor manager available");
      return this.extractFromCanvas(1, "Floor 1");
    }

    const currentFloor = this.floorManager.getCurrentFloor();
    const allFloors = this.floorManager.getFloorList();

    console.log(`Processing ${allFloors.length} floors. Current floor: ${currentFloor}`);

    // Save current floor state
    this.floorManager.saveCurrentFloorState();

    const allDevices = [];

    allFloors.forEach((floorNumber) => {
      const devices = floorNumber === currentFloor ? this.extractDeviceData("canvas", floorNumber, this.getFloorName(floorNumber)) : this.extractDeviceData(this.floorManager.floors.get(floorNumber), floorNumber);

      allDevices.push(...devices);
    });

    console.log(`Total devices found across all floors: ${allDevices.length}`);
    return allDevices;
  }

  getFloorName(floorNumber) {
    const floorData = this.floorManager.floors.get(floorNumber);
    return floorData?.name || `Floor ${floorNumber}`;
  }

  consolidateDevicesByFloor(devices) {
    // Create consolidation map
    const globalConsolidationMap = new Map();

    devices.forEach((device) => {
      const key = `${device.name}|${device.fittingPosition}|${device.partNumber}|${device.stockNumber}`;

      if (globalConsolidationMap.has(key)) {
        const existing = globalConsolidationMap.get(key);
        existing.quantity += 1;
        if (!existing.floors.includes(device.floor)) {
          existing.floors.push(device.floor);
          existing.floorNames.push(device.floorName);
        }
      } else {
        globalConsolidationMap.set(key, {
          ...device,
          quantity: 1,
          floors: [device.floor],
          floorNames: [device.floorName],
        });
      }
    });

    // Organize by primary floor
    const floorGroups = {};
    Array.from(globalConsolidationMap.values()).forEach((device) => {
      const primaryFloor = device.floors[0];
      const primaryFloorName = device.floorNames[0];

      if (!floorGroups[primaryFloor]) {
        floorGroups[primaryFloor] = {
          floorNumber: primaryFloor,
          floorName: primaryFloorName,
          devices: [],
        };
      }

      // Mark multi-floor devices
      if (device.floors.length > 1) {
        device.multiFloor = true;
        device.allFloorNames = device.floorNames.join(", ");
      }

      floorGroups[primaryFloor].devices.push(device);
    });

    // Sort devices within each floor
    Object.values(floorGroups).forEach((group) => {
      group.devices.sort((a, b) => a.name.localeCompare(b.name));
    });

    return Object.values(floorGroups).sort((a, b) => a.floorNumber - b.floorNumber);
  }

  generateTakeoffData() {
    const devices = this.extractAllFloorsDeviceData();
    return this.consolidateDevicesByFloor(devices);
  }

  generateTakeoffTable() {
    const takeoffData = this.generateTakeoffData();

    if (takeoffData.length === 0) {
      return '<p class="text-center text-muted">No devices found on any floor</p>';
    }

    const rows = this.generateTableRows(takeoffData);

    return `
      <div class="table-responsive">
        <table class="table table-hover" style="margin: 0;">
          <thead class="table-dark">
            <tr>
              <th scope="col" style="width: 60px;">#</th>
              <th scope="col" style="width: 15%;">Floor</th>
              <th scope="col">Device Name</th>
              <th scope="col" style="width: 18%;">Position</th>
              <th scope="col" style="width: 18%;">Part No.</th>
              <th scope="col" style="width: 18%;">Stock No.</th>
              <th scope="col" style="width: 60px;">Qty</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  generateTableRows(takeoffData) {
    let deviceCounter = 1;
    let rows = "";

    takeoffData.forEach((floorGroup) => {
      if (floorGroup.devices.length === 0) return;

      floorGroup.devices.forEach((device, deviceIndex) => {
        const rowClass = deviceIndex % 2 === 0 ? "table-light" : "";
        const floorNames = device.multiFloor ? device.allFloorNames : this.escapeHtml(floorGroup.floorName);

        rows += `
          <tr class="${rowClass} takeoff-row">
            <td style="font-weight: bold; color: var(--orange-ip2);">${deviceCounter++}</td>
            <td>
              <span class="badge floor-badge" style="background-color: var(--orange-ip2); color: white; font-size: 11px;">
                ${floorNames}
              </span>
            </td>
            <td style="font-weight: 500;">${this.escapeHtml(device.name)}</td>
            <td>${this.escapeHtml(device.fittingPosition)}</td>
            <td>${this.escapeHtml(device.partNumber)}</td>
            <td>${this.escapeHtml(device.stockNumber)}</td>
            <td>
              <span class="badge qty-badge" style="background-color: var(--orange-ip2); color: white; font-size: 12px; padding: 4px 8px;">
                ${device.quantity}
              </span>
            </td>
          </tr>
        `;
      });
    });

    return rows;
  }

  generateCSV() {
    const takeoffData = this.generateTakeoffData();
    if (takeoffData.length === 0) return "";

    let csv = "#,Floor,Device Name,Fitting Position,Part No.,Stock No.,Qty\n";
    let deviceCounter = 1;

    takeoffData.forEach((floorGroup) => {
      floorGroup.devices.forEach((device) => {
        const floorNames = device.multiFloor ? device.allFloorNames : floorGroup.floorName;
        csv += `${deviceCounter++},"${floorNames}","${device.name}","${device.fittingPosition}","${device.partNumber}","${device.stockNumber}",${device.quantity}\n`;
      });
    });

    return csv;
  }

  exportToCSV(filename = "device-takeoff-list.csv") {
    const csv = this.generateCSV();
    if (!csv) {
      alert("No devices found to export");
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      Object.assign(link, {
        href: url,
        download: filename,
        style: { visibility: "hidden" },
      });

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  escapeHtml(text) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  getTakeoffSummary() {
    const takeoffData = this.generateTakeoffData();

    // Get actual floor count from floor manager
    const actualFloorCount = this.floorManager ? this.floorManager.getFloorCount() : 1;

    const summary = takeoffData.reduce(
      (acc, floorGroup) => {
        floorGroup.devices.forEach((device) => {
          acc.totalDevices += device.quantity;
          acc.uniqueItems += 1; // This counts unique consolidated items
          acc.deviceTypes.add(device.deviceType);
        });
        return acc;
      },
      {
        totalDevices: 0,
        uniqueItems: 0, // Changed from uniqueDevices to uniqueItems
        deviceTypes: new Set(),
        floorCount: actualFloorCount, // Use actual floor count
      }
    );

    return {
      ...summary,
      deviceTypes: summary.deviceTypes.size,
    };
  }
}

// Integration functions
export function initTakeoffFeature(fabricCanvas, floorManager = null) {
  console.log("Initializing takeoff feature with floor manager:", !!floorManager);

  if (!floorManager && window.floorManager) {
    floorManager = window.floorManager;
    console.log("Using window.floorManager:", !!floorManager);
  }

  const takeoffGenerator = new DeviceTakeoffGenerator(fabricCanvas, floorManager);

  const takeoffButton = document.getElementById("generate-takeoff-btn");
  if (takeoffButton) {
    takeoffButton.addEventListener("click", () => {
      console.log("Takeoff button clicked, floor manager available:", !!takeoffGenerator.floorManager);
      showTakeoffModal(takeoffGenerator);
    });
  } else {
    console.warn("Takeoff button not found");
  }

  window.takeoffGenerator = takeoffGenerator;
  return takeoffGenerator;
}

function showTakeoffModal(takeoffGenerator) {
  // Remove existing modal
  const existingModal = document.getElementById("takeoff-modal");
  if (existingModal) existingModal.remove();

  const summary = takeoffGenerator.getTakeoffSummary();
  const tableHTML = takeoffGenerator.generateTakeoffTable();

  const modalHTML = createModalHTML(summary, tableHTML);
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = new bootstrap.Modal(document.getElementById("takeoff-modal"));
  modal.show();

  setupModalEventListeners(takeoffGenerator);
}

function createModalHTML(summary, tableHTML) {
  return `
    <div class="modal fade" id="takeoff-modal" tabindex="-1" aria-labelledby="takeoffModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header bg-secondary text-white">
            <h5 class="modal-title" id="takeoffModalLabel">Device Takeoff List - All Floors</h5>
            <div class="ms-auto d-flex gap-2 align-items-center">
              <button type="button" class="btn btn-success" id="export-takeoff-csv">
                <img src="images/icons/download.svg" alt="Download Icon" />
                <span>Export CSV</span>
              </button>
              <button type="button" class="btn btn-primary" id="print-takeoff">
                <img src="images/icons/print.svg" alt="Print Icon" />
                <span>Print List</span>
              </button>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div class="modal-body">
            ${createSummaryCards(summary)}
            ${tableHTML}
          </div>
        </div>
      </div>
    </div>
  `;
}

function createSummaryCards(summary) {
  const cards = [
    { title: summary.totalDevices, text: "Total Devices" },
    { title: summary.uniqueItems, text: "Unique Items" },
    { title: summary.deviceTypes, text: "Device Types" },
    { title: summary.floorCount, text: "Floors" },
  ];

  return `
    <div class="row mb-3">
      ${cards
        .map(
          (card) => `
        <div class="col-md-3">
          <div class="card card-orange">
            <div class="card-body text-center">
              <h5 class="card-title text-orange">${card.title}</h5>
              <p class="card-text">${card.text}</p>
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function setupModalEventListeners(takeoffGenerator) {
  document.getElementById("export-takeoff-csv").addEventListener("click", () => {
    const csv = takeoffGenerator.generateCSV();
    if (!csv || csv.trim() === "" || csv.trim() === "#,Floor,Device Name,Fitting Position,Part No.,Stock No.,Qty") {
      alert("No devices found to export");
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    takeoffGenerator.exportToCSV(`device-takeoff-all-floors-${timestamp}.csv`);
  });

  document.getElementById("print-takeoff").addEventListener("click", () => {
    const takeoffData = takeoffGenerator.generateTakeoffData();
    if (takeoffData.length === 0 || takeoffData.every((floor) => floor.devices.length === 0)) {
      alert("No devices found to print");
      return;
    }
    printTakeoffList();
  });

  document.getElementById("takeoff-modal").addEventListener("hidden.bs.modal", () => {
    document.getElementById("takeoff-modal").remove();
  });
}

function printTakeoffList() {
  const printContainer = document.getElementById("print-container");
  if (!printContainer) {
    alert("Print container not found");
    return;
  }

  // Setup client details
  const getValue = (id, defaultValue = "") => document.getElementById(id)?.value.trim() || defaultValue;

  const updateElement = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateElement("print-client-name", getValue("client-name-test-input", "Client Name"));
  updateElement("print-address", getValue("address-input", "Address"));
  updateElement("print-date", getValue("client-date-input") || new Date().toLocaleDateString());

  setupClientLogo(printContainer);
}

function setupClientLogo(printContainer) {
  const printLogo = document.getElementById("print-logo");
  const clientLogoInput = document.getElementById("client-logo-upload");

  if (clientLogoInput?.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (printLogo) {
        Object.assign(printLogo, { src: e.target.result });
        Object.assign(printLogo.style, { maxWidth: "150px", maxHeight: "100px", display: "block" });
      }
      proceedWithPrint();
    };
    reader.readAsDataURL(clientLogoInput.files[0]);
  } else {
    const logoPreview = document.getElementById("client-logo-preview");
    const logoImg = logoPreview?.querySelector("img");

    if (logoImg?.src && !logoImg.src.includes("data:image/svg")) {
      if (printLogo) {
        Object.assign(printLogo, { src: logoImg.src });
        Object.assign(printLogo.style, { maxWidth: "150px", maxHeight: "100px", display: "block" });
      }
    } else if (printLogo) {
      printLogo.removeAttribute("src");
      printLogo.style.display = "none";
    }
    proceedWithPrint();
  }
}

function proceedWithPrint() {
  // Close modals and clean up
  closeAllModalsAndBackdrops();

  // Setup print content
  const tableContent = setupPrintTable();
  const canvasSection = document.querySelector("#print-container .canvas-section");

  if (canvasSection && tableContent) {
    setupCanvasSection(canvasSection, tableContent);

    const reportTitleElement = document.getElementById("print-report-title");
    if (reportTitleElement) {
      reportTitleElement.textContent = "Device Takeoff List - All Floors";
    }

    // Show print container and print
    const printContainer = document.getElementById("print-container");
    printContainer.style.display = "block";

    setTimeout(() => {
      window.print();
      setupPrintCleanup(canvasSection, reportTitleElement);
    }, 500);
  }
}

function closeAllModalsAndBackdrops() {
  // Store current layer state before closing modals
  const layerState = window.layers ? { ...window.layers } : null;

  const allModals = document.querySelectorAll(".modal");
  allModals.forEach((modal) => {
    const modalInstance = bootstrap.Modal.getInstance(modal);
    if (modalInstance) modalInstance.hide();
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.remove());

  Object.assign(document.body, {
    className: document.body.className.replace("modal-open", ""),
    style: { overflow: "", paddingRight: "" },
  });

  // Restore layer visibility and ensure proper z-ordering after modal closure
  setTimeout(() => {
    if (window.refreshLayers) {
      window.refreshLayers();
    }

    // Ensure camera coverage areas are properly positioned
    const fabricCanvas = window.floorManager?.fabricCanvas;
    if (fabricCanvas) {
      const cameraDevices = fabricCanvas.getObjects().filter((obj) => obj.type === "group" && obj.deviceType && obj.coverageArea);

      cameraDevices.forEach((device) => {
        if (device.coverageArea && device.coverageConfig?.visible) {
          // Ensure coverage is behind the camera but above background
          const backgroundObjects = fabricCanvas.getObjects().filter((obj) => obj.isBackground);
          if (backgroundObjects.length > 0) {
            const bgIndex = fabricCanvas.getObjects().indexOf(backgroundObjects[0]);
            const coverageIndex = fabricCanvas.getObjects().indexOf(device.coverageArea);
            const deviceIndex = fabricCanvas.getObjects().indexOf(device);

            // Move coverage area to be right after background but before device
            if (coverageIndex > deviceIndex || coverageIndex <= bgIndex) {
              fabricCanvas.remove(device.coverageArea);
              fabricCanvas.insertAt(device.coverageArea, bgIndex + 1);
            }
          }

          // Ensure device and its text are on top
          device.bringToFront();
          if (device.textObject && !device.textObject._isHidden) {
            device.textObject.bringToFront();
          }
        }
      });

      fabricCanvas.requestRenderAll();
    }
  }, 100);
}

function setupPrintTable() {
  const tableContent = document.querySelector("#takeoff-modal .table-responsive")?.cloneNode(true);
  if (!tableContent) return null;

  // Remove Bootstrap classes and apply print styles
  tableContent.className = "";
  const table = tableContent.querySelector("table");
  if (table) {
    table.className = "";
    applyPrintTableStyles(table);
  }

  return tableContent;
}

function applyPrintTableStyles(table) {
  const fullWidthStyles = `
    width: 100% !important; max-width: 100% !important; min-width: 100% !important;
    margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
    border-collapse: collapse !important; table-layout: fixed !important;
  `;

  table.style.cssText = fullWidthStyles;

  // Style all cells
  const cells = table.querySelectorAll("th, td");
  cells.forEach((cell) => {
    cell.style.cssText = `
      padding: 8px !important; border: 1px solid #ddd !important; text-align: center !important;
      word-wrap: break-word !important; color: #333 !important; background-color: transparent !important;
      vertical-align: middle !important;
    `;
  });

  // Set column widths
  const columnWidths = ["50px", "15%", "auto", "18%", "18%", "18%", "50px"];

  table.querySelectorAll("tr").forEach((row) => {
    const rowCells = row.querySelectorAll("th, td");
    rowCells.forEach((cell, index) => {
      if (columnWidths[index]) {
        cell.style.cssText += `width: ${columnWidths[index]} !important;`;
        if (index === 0 || index === 6) {
          // # and Qty columns
          cell.style.cssText += "max-width: 50px !important;";
        }
        cell.style.cssText += "white-space: normal !important; word-wrap: break-word !important; vertical-align: top !important;";
      }
    });
  });

  // Style badges for print
  const badges = table.querySelectorAll(".badge");
  badges.forEach((badge) => {
    badge.style.cssText = `
      background: none !important; color: #333 !important; border: 1px solid #ccc !important;
      padding: 2px 6px !important; border-radius: 3px !important; font-size: 10px !important;
      display: inline-block !important; white-space: normal !important; word-wrap: break-word !important;
      max-width: 100% !important;
    `;
  });

  // Fix quantity column
  const qtyColumns = table.querySelectorAll("td:nth-child(7)");
  qtyColumns.forEach((cell) => {
    const badge = cell.querySelector(".badge");
    if (badge) {
      cell.innerHTML = badge.textContent;
      cell.style.cssText += `
        color: #333 !important; text-align: center !important; font-weight: bold !important;
        background-color: var(--orange-ip2) !important; border-radius: 4px !important;
      `;
    }
  });
}

function setupCanvasSection(canvasSection, tableContent) {
  canvasSection.innerHTML = "";
  canvasSection.style.cssText = `
    padding: 5px 30px !important; margin: 0 !important; width: 100% !important;
    max-width: 100% !important; box-sizing: border-box !important; page-break-before: auto !important;
  `;
  canvasSection.appendChild(tableContent);
}

function setupPrintCleanup(canvasSection, reportTitleElement) {
  const cleanup = () => {
    const printContainer = document.getElementById("print-container");
    if (printContainer) printContainer.style.display = "none";

    if (canvasSection) {
      canvasSection.innerHTML = "";
      canvasSection.style.cssText = "";
    }

    if (reportTitleElement) {
      const getValue = (id, defaultValue = "") => document.getElementById(id)?.value || defaultValue;
      reportTitleElement.textContent = getValue("report-title-input", "Report");
    }
  };

  if (window.onafterprint !== undefined) {
    window.onafterprint = cleanup;
  } else {
    setTimeout(cleanup, 2000);
  }
}
