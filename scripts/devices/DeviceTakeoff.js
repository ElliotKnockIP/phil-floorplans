// Generates and manages the device takeoff list for project reports
import { DEVICE_TYPES_BY_CATEGORY, getDeviceCategory } from "./categories/device-types.js";

export class DeviceTakeoffGenerator {
  // Initialize the generator with canvas and floor manager references
  constructor(fabricCanvas, floorManager) {
    this.fabricCanvas = fabricCanvas;
    this.floorManager = floorManager;
    this.filters = { floors: [], deviceTypes: [], zones: [], rooms: [] };
    this.surveyInfo = {
      grading: "",
      monitoring: "",
      generalDescription: "",
      equipmentRequired: "",
    };
  }

  // Reference to the shared device category mapping
  static DEVICE_CATEGORY_MAP = DEVICE_TYPES_BY_CATEGORY;

  // Human-readable labels for device categories in reports
  static CATEGORY_LABELS = {
    cctv: "CCTV",
    access: "Access Control",
    intruder: "Intruder Detection",
    fire: "Fire Evacuation",
    networks: "Networks",
    custom: "Custom",
  };

  // Determine which system category a device belongs to
  static getCategoryForDevice(deviceType, isCameraLike = false) {
    if (isCameraLike) return "cctv";
    // Look up the device type in the category map
    for (const [cat, list] of Object.entries(DeviceTakeoffGenerator.DEVICE_CATEGORY_MAP)) {
      if (list.includes(deviceType)) return cat;
    }
    return "custom";
  }

  // Check if a coordinate point falls within a polygon's boundaries
  isPointInPolygon(point, polygon) {
    const vertices = polygon.points;
    let inside = false;
    // Ray casting algorithm for point-in-polygon detection
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const intersect = vertices[i].y > point.y !== vertices[j].y > point.y && point.x < ((vertices[j].x - vertices[i].x) * (point.y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Identify which zone and room a device is located in based on its coordinates
  getLocationInfo(deviceCenter) {
    let zoneInfo = "",
      roomInfo = "";

    // Check if device is inside any defined zone
    if (window.zones?.length > 0) {
      const deviceInZone = window.zones.find((zone) => zone.polygon && this.isPointInPolygon(deviceCenter, zone.polygon));
      if (deviceInZone) zoneInfo = deviceInZone.polygon.zoneName || "Zone";
    }

    // Check if device is inside any defined room
    if (window.rooms?.length > 0) {
      const deviceInRoom = window.rooms.find((room) => room.polygon && this.isPointInPolygon(deviceCenter, room.polygon));
      if (deviceInRoom) roomInfo = deviceInRoom.polygon.roomName || deviceInRoom.roomName || "Room";
    }

    return { zoneInfo, roomInfo };
  }

  // Pull device data from either the active canvas or a saved floor data object
  extractDeviceData(source, floorNumber, floorName) {
    if (source === "canvas") {
      return this.extractFromCanvas(floorNumber, floorName);
    }
    return this.extractFromFloorData(source, floorNumber);
  }

  // Collect all device information from the current active canvas
  extractFromCanvas(floorNumber, floorName) {
    return this.fabricCanvas
      .getObjects()
      .filter((obj) => obj.type === "group" && obj.deviceType && obj.textObject)
      .map((obj) => this.createDeviceInfo(obj, floorNumber, floorName));
  }

  // Collect device information from a serialized floor data object
  extractFromFloorData(floorData, floorNumber) {
    if (!floorData?.cameras?.cameraDevices) return [];
    return floorData.cameras.cameraDevices
      .filter((deviceData) => deviceData?.deviceType)
      .map((deviceData) => {
        return this.createDeviceInfoFromData(deviceData, floorNumber, floorData.name);
      });
  }

  // Convert a canvas group object into a standardized device info object
  createDeviceInfo(obj, floorNumber, floorName) {
    const deviceCenter = obj.getCenterPoint();
    const locationInfo = this.getLocationInfo(deviceCenter);
    const category = DeviceTakeoffGenerator.getCategoryForDevice(obj.deviceType, !!obj.coverageConfig);

    return {
      name: obj.textObject.text || "Unnamed Device",
      location: obj.location || "",
      fittingPosition: obj.mountedPosition || "",
      partNumber: obj.partNumber || "",
      stockNumber: obj.stockNumber || "",
      deviceType: obj.deviceType,
      systemCategory: category,
      systemCategoryLabel: DeviceTakeoffGenerator.CATEGORY_LABELS[category] || category,
      floor: floorNumber,
      floorName,
      position: { x: Math.round(obj.left), y: Math.round(obj.top) },
      zoneInfo: locationInfo.zoneInfo,
      roomInfo: locationInfo.roomInfo,
    };
  }

  // Convert serialized device data into a standardized device info object
  createDeviceInfoFromData(deviceData, floorNumber, floorName) {
    const isCamera = !!deviceData.coverageConfig || !!deviceData.isCamera;
    const category = DeviceTakeoffGenerator.getCategoryForDevice(deviceData.deviceType, isCamera);

    return {
      name: deviceData.textLabel?.text || "Unnamed Device",
      location: deviceData.deviceProperties?.location || "",
      fittingPosition: deviceData.deviceProperties?.mountedPosition || "",
      partNumber: deviceData.deviceProperties?.partNumber || "",
      stockNumber: deviceData.deviceProperties?.stockNumber || "",
      deviceType: deviceData.deviceType,
      systemCategory: category,
      systemCategoryLabel: DeviceTakeoffGenerator.CATEGORY_LABELS[category] || category,
      floor: floorNumber,
      floorName: floorName || `Floor ${floorNumber}`,
      position: {
        x: Math.round(deviceData.position?.left || 0),
        y: Math.round(deviceData.position?.top || 0),
      },
      zoneInfo: deviceData.zoneInfo || "",
      roomInfo: deviceData.roomInfo || "",
    };
  }

  // Iterate through all floors to collect device data from each
  extractAllFloorsDeviceData() {
    if (!this.floorManager) {
      console.warn("No floor manager available");
      return this.extractFromCanvas(1, "Floor 1");
    }

    const currentFloor = this.floorManager.getCurrentFloor();
    const allFloors = this.floorManager.getFloorList();
    // Save current state to ensure data is up to date before extraction
    this.floorManager.saveCurrentFloorState();

    const allDevices = [];
    allFloors.forEach((floorNumber) => {
      let devices;
      if (floorNumber === currentFloor) {
        devices = this.extractDeviceData("canvas", floorNumber, this.getFloorName(floorNumber));
      } else {
        devices = this.extractDeviceData(this.floorManager.floors.get(floorNumber), floorNumber);
      }
      allDevices.push(...devices);
    });
    return allDevices;
  }

  // Retrieve the name of a floor based on its index
  getFloorName(floorNumber) {
    const floorData = this.floorManager.floors.get(floorNumber);
    return floorData?.name || `Floor ${floorNumber}`;
  }

  // Group identical devices together and count quantities per floor
  consolidateDevicesByFloor(devices) {
    const globalConsolidationMap = new Map();

    devices.forEach((device) => {
      // Create a unique key based on device properties to identify duplicates
      const keyParts = [device.name, device.location, device.fittingPosition, device.partNumber, device.stockNumber, device.zoneInfo, device.roomInfo];
      const key = keyParts.join("|");

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

    // Organize consolidated devices back into floor-based groups
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

      // Mark devices that appear on multiple floors
      if (device.floors.length > 1) {
        device.multiFloor = true;
        device.allFloorNames = device.floorNames.join(", ");
      }

      floorGroups[primaryFloor].devices.push(device);
    });

    // Sort devices alphabetically within each floor group
    Object.values(floorGroups).forEach((group) => {
      group.devices.sort((a, b) => a.name.localeCompare(b.name));
    });

    return Object.values(floorGroups).sort((a, b) => a.floorNumber - b.floorNumber);
  }

  // Update the active filters for the takeoff list
  setFilters(filters) {
    this.filters = {
      floors: Array.isArray(filters?.floors) ? filters.floors : [],
      deviceTypes: Array.isArray(filters?.deviceTypes) ? filters.deviceTypes : [],
      zones: Array.isArray(filters?.zones) ? filters.zones : [],
      rooms: Array.isArray(filters?.rooms) ? filters.rooms : [],
    };
  }

  // Retrieve the current filter configuration
  getFilters() {
    return { ...this.filters };
  }

  // Update the survey metadata for the project
  setSurveyInfo(info) {
    this.surveyInfo = {
      grading: info?.grading || "",
      monitoring: info?.monitoring || "",
      generalDescription: info?.generalDescription || "",
      equipmentRequired: info?.equipmentRequired || "",
    };
  }

  // Retrieve the current survey metadata
  getSurveyInfo() {
    return { ...this.surveyInfo };
  }

  // Read survey information from the UI form inputs
  captureSurveyInfo() {
    const getValue = (id) => document.getElementById(id)?.value || "";
    this.setSurveyInfo({
      grading: getValue("takeoff-grading"),
      monitoring: getValue("takeoff-monitoring"),
      generalDescription: getValue("takeoff-general-description"),
      equipmentRequired: getValue("takeoff-equipment-required"),
    });
  }

  // Scan all devices to find unique values for filter dropdowns
  getFilterOptions() {
    const devices = this.extractAllFloorsDeviceData();
    const floors = new Set();
    const systemCategories = new Set();
    const zones = new Set();
    const rooms = new Set();

    devices.forEach((d) => {
      if (d.floorName) floors.add(d.floorName);
      if (d.systemCategory) systemCategories.add(d.systemCategory);
      zones.add(d.zoneInfo?.trim() || "(None)");
      rooms.add(d.roomInfo?.trim() || "(None)");
    });

    return {
      floors: Array.from(floors).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      deviceTypes: Array.from(systemCategories)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({ value: key, label: DeviceTakeoffGenerator.CATEGORY_LABELS[key] || key })),
      zones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      rooms: Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
  }

  // Filter the device list based on current user selections
  applyFilters(devices) {
    const f = this.filters || {};
    const floors = f.floors || [];
    const deviceTypes = f.deviceTypes || [];
    const zones = (f.zones || []).map((z) => (z === "(None)" ? "" : z));
    const rooms = (f.rooms || []).map((r) => (r === "(None)" ? "" : r));

    if (!floors.length && !deviceTypes.length && !zones.length && !rooms.length) return devices;

    return devices.filter((d) => {
      if (floors.length && !floors.includes(d.floorName)) return false;
      if (deviceTypes.length && !deviceTypes.includes(d.systemCategory)) return false;
      if (zones.length) {
        const zi = d.zoneInfo?.trim() || "";
        if (!zones.includes(zi)) return false;
      }
      if (rooms.length) {
        const ri = d.roomInfo?.trim() || "";
        if (!rooms.includes(ri)) return false;
      }
      return true;
    });
  }

  // Generate the final consolidated and filtered device list
  generateTakeoffData() {
    const devices = this.extractAllFloorsDeviceData();
    const filtered = this.applyFilters(devices);
    return this.consolidateDevicesByFloor(filtered);
  }

  // Create the HTML structure for the takeoff table
  generateTakeoffTable() {
    const takeoffData = this.generateTakeoffData();
    if (takeoffData.length === 0) {
      return '<p class="text-center text-muted">No devices found on any floor</p>';
    }

    const rows = this.generateTableRows(takeoffData);
    return `
      <div class="table-responsive">
        <table class="table table-hover takeoff-table" style="margin: 0;">
          <thead class="table-dark">
            <tr>
              <th scope="col" class="col-counter">#</th>
              <th scope="col" class="col-floor">Floor</th>
              <th scope="col">Device Name</th>
              <th scope="col" class="col-location">Location</th>
              <th scope="col" class="col-mounted">Mounted</th>
              <th scope="col" class="col-zone">Zone</th>
              <th scope="col" class="col-room">Room</th>
              <th scope="col" class="col-part">Part No.</th>
              <th scope="col" class="col-stock">Stock No.</th>
              <th scope="col" class="col-qty">Qty</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Generate individual table rows for each device in the takeoff list
  generateTableRows(takeoffData) {
    let deviceCounter = 1;
    let rows = "";

    takeoffData.forEach((floorGroup) => {
      if (floorGroup.devices.length === 0) return;

      floorGroup.devices.forEach((device, deviceIndex) => {
        const rowClass = deviceIndex % 2 === 0 ? "table-light" : "";
        const floorNames = device.multiFloor ? device.allFloorNames : this.escapeHtml(floorGroup.floorName);
        const zoneDisplay = device.zoneInfo ? this.escapeHtml(device.zoneInfo) : "-";
        const roomDisplay = device.roomInfo ? this.escapeHtml(device.roomInfo) : "-";

        rows += `
          <tr class="${rowClass} takeoff-row">
            <td class="takeoff-counter">${deviceCounter++}</td>
            <td>
              <span class="badge floor-badge takeoff-floor-badge">
                ${floorNames}
              </span>
            </td>
            <td style="font-weight: 500;">${this.escapeHtml(device.name)}</td>
            <td>${this.escapeHtml(device.location)}</td>
            <td>${this.escapeHtml(device.fittingPosition)}</td>
            <td>${zoneDisplay}</td>
            <td>${roomDisplay}</td>
            <td>${this.escapeHtml(device.partNumber)}</td>
            <td>${this.escapeHtml(device.stockNumber)}</td>
            <td>
              <span class="badge qty-badge takeoff-qty-badge">
                ${device.quantity}
              </span>
            </td>
          </tr>
        `;
      });
    });

    return rows;
  }

  // Format the takeoff data as a CSV string
  generateCSV() {
    const takeoffData = this.generateTakeoffData();
    if (takeoffData.length === 0) return "";

    const surveyInfo = this.getSurveyInfo();
    let csv = "";

    // Add survey metadata to the top of the CSV
    if (surveyInfo.grading || surveyInfo.monitoring || surveyInfo.generalDescription || surveyInfo.equipmentRequired) {
      csv += "Survey Information\n";
      if (surveyInfo.grading) csv += `Grading,${surveyInfo.grading}\n`;
      if (surveyInfo.monitoring) csv += `Monitoring,${surveyInfo.monitoring}\n`;
      if (surveyInfo.generalDescription) {
        const desc = surveyInfo.generalDescription.replace(/"/g, '""');
        csv += `General Description,"${desc}"\n`;
      }
      if (surveyInfo.equipmentRequired) {
        const equip = surveyInfo.equipmentRequired.replace(/"/g, '""');
        csv += `Equipment Required,"${equip}"\n`;
      }
      csv += "\n";
    }

    csv += "#,Floor,Device Name,Location,Mounted,Zone,Room,Part No.,Stock No.,Qty\n";
    let deviceCounter = 1;

    takeoffData.forEach((floorGroup) => {
      floorGroup.devices.forEach((device) => {
        const floorNames = device.multiFloor ? device.allFloorNames : floorGroup.floorName;
        const zoneInfo = device.zoneInfo || "";
        const roomInfo = device.roomInfo || "";

        const row = [deviceCounter++, `"${floorNames}"`, `"${device.name}"`, `"${device.location}"`, `"${device.fittingPosition}"`, `"${zoneInfo}"`, `"${roomInfo}"`, `"${device.partNumber}"`, `"${device.stockNumber}"`, device.quantity];

        csv += row.join(",") + "\n";
      });
    });

    return csv;
  }

  // Trigger a browser download of the takeoff data in CSV format
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

  // Sanitize text for safe HTML insertion
  escapeHtml(text) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  // Calculate summary statistics for the current takeoff list
  getTakeoffSummary() {
    const takeoffData = this.generateTakeoffData();
    const actualFloorCount = this.floorManager ? this.floorManager.getFloorCount() : 1;

    const summary = takeoffData.reduce(
      (acc, floorGroup) => {
        floorGroup.devices.forEach((device) => {
          acc.totalDevices += device.quantity;
          acc.uniqueItems += 1;
          acc.deviceTypes.add(device.systemCategory || device.deviceType);
        });
        return acc;
      },
      {
        totalDevices: 0,
        uniqueItems: 0,
        deviceTypes: new Set(),
        floorCount: actualFloorCount,
      }
    );

    return {
      ...summary,
      deviceTypes: summary.deviceTypes.size,
    };
  }
}

// Initialize the takeoff feature and bind it to the UI
export function initTakeoffFeature(fabricCanvas, floorManager = null) {
  if (!floorManager && window.floorManager) {
    floorManager = window.floorManager;
  }

  const takeoffGenerator = new DeviceTakeoffGenerator(fabricCanvas, floorManager);

  const takeoffButton = document.getElementById("generate-takeoff-btn");
  if (takeoffButton) {
    takeoffButton.addEventListener("click", () => {
      showTakeoffModal(takeoffGenerator);
    });
  } else {
    // Wait for HTML includes to load if button isn't immediately available
    document.addEventListener("htmlIncludesLoaded", () => {
      const btn = document.getElementById("generate-takeoff-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          showTakeoffModal(takeoffGenerator);
        });
      }
    });
  }

  window.takeoffGenerator = takeoffGenerator;
  return takeoffGenerator;
}

// Populate and display the takeoff modal
function showTakeoffModal(takeoffGenerator) {
  const modalEl = document.getElementById("takeoff-modal");
  if (!modalEl) {
    console.warn("Takeoff modal element not found in DOM");
    return;
  }

  const summaryContainer = document.getElementById("takeoff-summary-cards");
  if (summaryContainer) {
    summaryContainer.innerHTML = createFiltersPanel(takeoffGenerator);
  }

  const tableContainer = document.getElementById("takeoff-table-container");
  if (tableContainer) {
    tableContainer.innerHTML = takeoffGenerator.generateTakeoffTable();
  }

  // Restore previously entered survey info into the form
  const surveyInfo = takeoffGenerator.getSurveyInfo();
  const inputs = {
    "takeoff-grading": surveyInfo.grading,
    "takeoff-monitoring": surveyInfo.monitoring,
    "takeoff-general-description": surveyInfo.generalDescription,
    "takeoff-equipment-required": surveyInfo.equipmentRequired,
  };

  Object.entries(inputs).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  });

  setupModalEventListeners(takeoffGenerator, { rebind: true });
  bindFilterEvents(takeoffGenerator);

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// Generate the HTML for the filter selection panel
function createFiltersPanel(takeoffGenerator) {
  const options = takeoffGenerator.getFilterOptions();
  const active = takeoffGenerator.getFilters();

  const renderStringOptions = (list, selected) =>
    list
      .map((opt) => {
        const isSelected = selected?.length === 1 && selected[0] === opt;
        return `<option value="${escapeAttr(opt)}" ${isSelected ? "selected" : ""}>${escapeHtml(opt)}</option>`;
      })
      .join("");

  const renderCategoryOptions = (list, selected) =>
    list
      .map(({ value, label }) => {
        const isSelected = selected?.length === 1 && selected[0] === value;
        return `<option value="${escapeAttr(value)}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");

  return `
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label mb-1">Filter by System Types</label>
            <select id="filter-systems" class="form-select form-select-sm">
              <option value="">All System Types</option>
              ${renderCategoryOptions(options.deviceTypes, active.deviceTypes)}
            </select>
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label mb-1">Filter by Floors</label>
            <select id="filter-floors" class="form-select form-select-sm">
              <option value="">All Floors</option>
              ${renderStringOptions(options.floors, active.floors)}
            </select>
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label mb-1">Filter by Zones</label>
            <select id="filter-zones" class="form-select form-select-sm">
              <option value="">All Zones</option>
              ${renderStringOptions(options.zones, active.zones)}
            </select>
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label mb-1">Filter by Rooms</label>
            <select id="filter-rooms" class="form-select form-select-sm">
              <option value="">All Rooms</option>
              ${renderStringOptions(options.rooms, active.rooms)}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Sanitize text for safe HTML display
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text ?? "").replace(/[&<>"']/g, (m) => map[m]);
}

// Sanitize text for safe use in HTML attributes
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

// Bind export and print buttons within the takeoff modal
function setupModalEventListeners(takeoffGenerator, { rebind = false } = {}) {
  const exportBtn = document.getElementById("export-takeoff-csv");
  const printBtn = document.getElementById("print-takeoff");
  const modalEl = document.getElementById("takeoff-modal");

  if (!exportBtn || !printBtn || !modalEl) return;

  // Re-bind listeners by cloning nodes to avoid duplicate event handlers
  if (rebind) {
    const newExportBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
    const newPrintBtn = printBtn.cloneNode(true);
    printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
  }

  document.getElementById("export-takeoff-csv").addEventListener("click", () => {
    takeoffGenerator.captureSurveyInfo();

    const csv = takeoffGenerator.generateCSV();
    const header = "#,Floor,Device Name,Location,Mounted,Zone,Room,Part No.,Stock No.,Qty";
    if (!csv || csv.trim() === "" || csv.trim() === header) {
      alert("No devices found to export");
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const f = takeoffGenerator.getFilters ? takeoffGenerator.getFilters() : null;
    const hasFilters = f && (f.floors?.length || f.deviceTypes?.length || f.zones?.length || f.rooms?.length);
    const name = hasFilters ? `device-takeoff-filtered-${timestamp}.csv` : `device-takeoff-all-floors-${timestamp}.csv`;
    takeoffGenerator.exportToCSV(name);
  });

  document.getElementById("print-takeoff").addEventListener("click", () => {
    takeoffGenerator.captureSurveyInfo();

    const takeoffData = takeoffGenerator.generateTakeoffData();
    if (takeoffData.length === 0 || takeoffData.every((floor) => floor.devices.length === 0)) {
      alert("No devices found to print");
      return;
    }
    printTakeoffList(takeoffGenerator);
  });
}

// Bind change events for filter dropdowns to refresh the table
function bindFilterEvents(takeoffGenerator) {
  const tableContainer = document.getElementById("takeoff-table-container");
  const getSelected = (sel) => {
    const value = sel?.value;
    return value && value !== "" ? [value] : [];
  };

  const apply = () => {
    const systemsSel = document.getElementById("filter-systems");
    const floorsSel = document.getElementById("filter-floors");
    const zonesSel = document.getElementById("filter-zones");
    const roomsSel = document.getElementById("filter-rooms");

    const filters = {
      deviceTypes: systemsSel ? getSelected(systemsSel) : [],
      floors: floorsSel ? getSelected(floorsSel) : [],
      zones: zonesSel ? getSelected(zonesSel) : [],
      rooms: roomsSel ? getSelected(roomsSel) : [],
    };
    takeoffGenerator.setFilters(filters);
    if (tableContainer) tableContainer.innerHTML = takeoffGenerator.generateTakeoffTable();
  };

  ["filter-systems", "filter-floors", "filter-zones", "filter-rooms"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", apply);
  });
}

// Prepare the project data and trigger the browser print dialog
function printTakeoffList(takeoffGenerator) {
  const printContainer = document.getElementById("print-container");
  if (!printContainer) {
    alert("Print container not found");
    return;
  }

  const getValue = (id, defaultValue = "") => document.getElementById(id)?.value.trim() || defaultValue;
  const updateElement = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Update project details in the print layout
  updateElement("print-client-name", getValue("client-name-test-input", "Client Name"));
  updateElement("print-address", getValue("address-input", "Address"));
  updateElement("print-date", getValue("client-date-input") || new Date().toLocaleDateString());

  addSurveyInfoToPrint(takeoffGenerator, printContainer);
  setupClientLogo(printContainer, takeoffGenerator);
}

// Insert survey metadata into the print layout
function addSurveyInfoToPrint(takeoffGenerator, printContainer) {
  const surveyInfo = takeoffGenerator.getSurveyInfo();

  let surveySection = printContainer.querySelector(".survey-info-print-section");

  // Create survey section if it doesn't exist
  if (!surveySection) {
    surveySection = document.createElement("div");
    surveySection.className = "survey-info-print-section";

    const canvasSection = printContainer.querySelector(".canvas-section");
    if (canvasSection) {
      printContainer.insertBefore(surveySection, canvasSection);
    } else {
      printContainer.appendChild(surveySection);
    }
  }

  let surveyHTML = '<div style="padding: 10px 30px; margin: 10px 0; page-break-inside: avoid;">';
  surveyHTML += '<h3 class="survey-info-header">Survey Information</h3>';
  surveyHTML += '<div class="survey-info-grid">';

  const fields = [
    { key: "grading", label: "Grading:" },
    { key: "monitoring", label: "Monitoring:" },
    { key: "generalDescription", label: "General Description:" },
    { key: "equipmentRequired", label: "Equipment Required:" },
  ];

  fields.forEach((field) => {
    const value = surveyInfo[field.key] ? escapeHtml(surveyInfo[field.key]) : "&nbsp;";
    surveyHTML += "<div>";
    surveyHTML += `<strong class="survey-info-label">${field.label}</strong>`;
    surveyHTML += `<div class="survey-info-value">${value}</div>`;
    surveyHTML += "</div>";
  });

  surveyHTML += "</div></div>";
  surveySection.innerHTML = surveyHTML;
}

// Load and display the client logo in the print layout
function setupClientLogo(printContainer, takeoffGenerator) {
  const printLogo = document.getElementById("print-logo");
  const clientLogoInput = document.getElementById("client-logo-upload");

  // Handle newly uploaded logo file
  if (clientLogoInput?.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (printLogo) {
        Object.assign(printLogo, { src: e.target.result });
        Object.assign(printLogo.style, { maxWidth: "150px", maxHeight: "100px", display: "block" });
      }
      proceedWithPrint(takeoffGenerator);
    };
    reader.readAsDataURL(clientLogoInput.files[0]);
  } else {
    // Use existing logo preview if available
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
    proceedWithPrint(takeoffGenerator);
  }
}

// Finalize the print layout and open the print dialog
function proceedWithPrint(takeoffGenerator) {
  closeAllModalsAndBackdrops();

  const tableContent = setupPrintTable();
  const canvasSection = document.querySelector("#print-container .canvas-section");

  if (canvasSection && tableContent) {
    setupCanvasSection(canvasSection, tableContent);

    const reportTitleElement = document.getElementById("print-report-title");
    if (reportTitleElement) {
      const gen = window.takeoffGenerator;
      const filters = gen && gen.getFilters ? gen.getFilters() : null;
      const hasFilters = filters && (filters.floors?.length || filters.deviceTypes?.length || filters.zones?.length || filters.rooms?.length);
      reportTitleElement.textContent = hasFilters ? "Device Takeoff List - Filtered" : "Device Takeoff List - All Floors";
    }

    const printContainer = document.getElementById("print-container");
    printContainer.style.display = "block";

    // Delay print to allow layout to stabilize
    setTimeout(() => {
      window.print();
      setupPrintCleanup(canvasSection, reportTitleElement);
    }, 500);
  }
}

// Hide all active modals and clean up the UI for a clean print
function closeAllModalsAndBackdrops() {
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

  // Restore canvas object layering after modal closure
  setTimeout(() => {
    if (window.refreshLayers) {
      window.refreshLayers();
    }

    const fabricCanvas = window.floorManager?.fabricCanvas;
    if (fabricCanvas) {
      const cameraDevices = fabricCanvas.getObjects().filter((obj) => {
        return obj.type === "group" && obj.deviceType && obj.coverageArea;
      });

      cameraDevices.forEach((device) => {
        if (device.coverageArea && device.coverageConfig?.visible) {
          try {
            if (fabricCanvas.getObjects().includes(device.coverageArea)) {
              fabricCanvas.remove(device.coverageArea);
            }

            const currentDeviceIndex = fabricCanvas.getObjects().indexOf(device);
            if (currentDeviceIndex !== -1) {
              fabricCanvas.insertAt(device.coverageArea, currentDeviceIndex);
            } else {
              fabricCanvas.add(device.coverageArea);
              device.coverageArea.sendToBack();
            }
          } catch (err) {
            console.warn("Failed to reposition coverage area:", err);
          }

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

// Clone and style the takeoff table for the print layout
function setupPrintTable() {
  const tableContent = document.querySelector("#takeoff-modal .table-responsive")?.cloneNode(true);
  if (!tableContent) return null;

  tableContent.className = "";
  const table = tableContent.querySelector("table");
  if (table) {
    table.className = "";
    applyPrintTableStyles(table);
  }

  return tableContent;
}

// Apply specific CSS styles to the table for high-quality printing
function applyPrintTableStyles(table) {
  table.classList.add("print-table");

  const cells = table.querySelectorAll("th, td");
  cells.forEach((cell) => {
    cell.classList.add("print-table-cell");
  });

  const columnWidths = ["40px", "10%", "auto", "10%", "10%", "10%", "10%", "10%", "10%", "40px"];

  table.querySelectorAll("tr").forEach((row) => {
    const rowCells = row.querySelectorAll("th, td");
    rowCells.forEach((cell, index) => {
      if (columnWidths[index]) {
        cell.style.width = columnWidths[index];
        if (index === 0 || index === 9) {
          cell.style.maxWidth = "40px";
        }
        cell.classList.add("print-table-cell-wrap");
      }
    });
  });

  const badges = table.querySelectorAll(".badge");
  badges.forEach((badge) => {
    badge.style.cssText = `
      background: none !important; color: #333 !important; border: 1px solid #ccc !important;
      padding: 2px 6px !important; border-radius: 3px !important; font-size: 10px !important;
      display: inline-block !important; white-space: normal !important; word-wrap: break-word !important;
      max-width: 100% !important;
    `;
  });

  const qtyColumns = table.querySelectorAll("td:nth-child(10)");
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

// Inject the styled table into the print container
function setupCanvasSection(canvasSection, tableContent) {
  canvasSection.innerHTML = "";
  canvasSection.style.cssText = `
    padding: 5px 30px !important; margin: 0 !important; width: 100% !important;
    max-width: 100% !important; box-sizing: border-box !important; page-break-before: auto !important;
  `;
  canvasSection.appendChild(tableContent);
}

// Clean up the print layout after the print dialog is closed
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
