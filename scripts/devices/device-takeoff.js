export class DeviceTakeoffGenerator {
  constructor(fabricCanvas, floorManager) {
    this.fabricCanvas = fabricCanvas;
    this.floorManager = floorManager;
    // Active filter state
    this.filters = {
      floors: [], // array of floor names
      deviceTypes: [],
      zones: [],
      rooms: [],
    };
    // Survey information
    this.surveyInfo = {
      grading: "",
      monitoring: "",
      generalDescription: "",
      equipmentRequired: "",
    };
  }

  // Internal mapping for system categories (mirrors canvas-layers.js)
  static DEVICE_CATEGORY_MAP = {
    cctv: [
      "fixed-camera.png",
      "box-camera.png",
      "dome-camera.png",
      "ptz-camera.png",
      "bullet-camera.png",
      "thermal-camera.png",
      "custom-camera-icon.png",
    ],
    access: ["access-system.png", "door-entry.png", "gates.png", "vehicle-entry.png", "turnstiles.png", "mobile-entry.png"],
    intruder: ["intruder-alarm.png", "panic-alarm.png", "motion-detector.png", "infrared-sensors.png", "pressure-mat.png", "glass-contact.png"],
    fire: ["fire-alarm.png", "fire-extinguisher.png", "fire-blanket.png", "emergency-exit.png", "assembly-point.png", "emergency-telephone.png"],
    custom: ["custom-device-icon.png"],
  };

  static CATEGORY_LABELS = {
    cctv: "CCTV",
    access: "Access Control",
    intruder: "Intruder Detection",
    fire: "Fire Evacuation",
    custom: "Custom",
  };

  static getCategoryForDevice(deviceType, isCameraLike = false) {
    if (isCameraLike) return "cctv";
    for (const [cat, list] of Object.entries(DeviceTakeoffGenerator.DEVICE_CATEGORY_MAP)) {
      if (list.includes(deviceType)) return cat;
    }
    // Fallback: treat unknowns as custom
    return "custom";
  }

  // Check if a point is inside a polygon
  isPointInPolygon(point, polygon) {
    const vertices = polygon.points;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (vertices[i].y > point.y !== vertices[j].y > point.y && point.x < ((vertices[j].x - vertices[i].x) * (point.y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Get zone and room information for a device position
  getLocationInfo(deviceCenter, canvas) {
    let zoneInfo = "";
    let roomInfo = "";

    // Check for zone
    if (window.zones && window.zones.length > 0) {
      const deviceInZone = window.zones.find((zone) => zone.polygon && this.isPointInPolygon(deviceCenter, zone.polygon));
      if (deviceInZone) {
        zoneInfo = deviceInZone.polygon.zoneName || "Zone";
      }
    }

    // Check for room
    if (window.rooms && window.rooms.length > 0) {
      const deviceInRoom = window.rooms.find((room) => room.polygon && this.isPointInPolygon(deviceCenter, room.polygon));
      if (deviceInRoom) {
        roomInfo = deviceInRoom.polygon.roomName || deviceInRoom.roomName || "Room";
      }
    }

    return { zoneInfo, roomInfo };
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
    const deviceCenter = obj.getCenterPoint();
    const locationInfo = this.getLocationInfo(deviceCenter, this.fabricCanvas);
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
      floorName: floorName,
      position: { x: Math.round(obj.left), y: Math.round(obj.top) },
      zoneInfo: locationInfo.zoneInfo,
      roomInfo: locationInfo.roomInfo,
    };
  }

  createDeviceInfoFromData(deviceData, floorNumber, floorName) {
    // For stored floor data, we need to reconstruct location info if available
    let zoneInfo = "";
    let roomInfo = "";

    // Try to get zone/room info from stored device data
    if (deviceData.zoneInfo) {
      zoneInfo = deviceData.zoneInfo;
    }
    if (deviceData.roomInfo) {
      roomInfo = deviceData.roomInfo;
    }

    const category = DeviceTakeoffGenerator.getCategoryForDevice(deviceData.deviceType, !!deviceData.coverageConfig || !!deviceData.isCamera);

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
      zoneInfo: zoneInfo,
      roomInfo: roomInfo,
    };
  }

  extractAllFloorsDeviceData() {
    if (!this.floorManager) {
      console.warn("No floor manager available");
      return this.extractFromCanvas(1, "Floor 1");
    }

    const currentFloor = this.floorManager.getCurrentFloor();
    const allFloors = this.floorManager.getFloorList();

    // Save current floor state
    this.floorManager.saveCurrentFloorState();

    const allDevices = [];

    allFloors.forEach((floorNumber) => {
      const devices = floorNumber === currentFloor ? this.extractDeviceData("canvas", floorNumber, this.getFloorName(floorNumber)) : this.extractDeviceData(this.floorManager.floors.get(floorNumber), floorNumber);

      allDevices.push(...devices);
    });
    return allDevices;
  }

  getFloorName(floorNumber) {
    const floorData = this.floorManager.floors.get(floorNumber);
    return floorData?.name || `Floor ${floorNumber}`;
  }

  consolidateDevicesByFloor(devices) {
    // Create consolidation map - include location, zone, and room in the key for proper consolidation
    const globalConsolidationMap = new Map();

    devices.forEach((device) => {
      const key = `${device.name}|${device.location}|${device.fittingPosition}|${device.partNumber}|${device.stockNumber}|${device.zoneInfo}|${device.roomInfo}`;

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

  // ============== Filter helpers ==============
  setFilters(filters) {
    // Expect shape: { floors: string[], deviceTypes: string[], zones: string[], rooms: string[] }
    this.filters = {
      floors: Array.isArray(filters?.floors) ? filters.floors : [],
      deviceTypes: Array.isArray(filters?.deviceTypes) ? filters.deviceTypes : [],
      zones: Array.isArray(filters?.zones) ? filters.zones : [],
      rooms: Array.isArray(filters?.rooms) ? filters.rooms : [],
    };
  }

  getFilters() {
    return { ...this.filters };
  }

  // ============== Survey Info helpers ==============
  setSurveyInfo(info) {
    this.surveyInfo = {
      grading: info?.grading || "",
      monitoring: info?.monitoring || "",
      generalDescription: info?.generalDescription || "",
      equipmentRequired: info?.equipmentRequired || "",
    };
  }

  getSurveyInfo() {
    return { ...this.surveyInfo };
  }

  captureSurveyInfo() {
    const grading = document.getElementById("takeoff-grading")?.value || "";
    const monitoring = document.getElementById("takeoff-monitoring")?.value || "";
    const generalDescription = document.getElementById("takeoff-general-description")?.value || "";
    const equipmentRequired = document.getElementById("takeoff-equipment-required")?.value || "";
    
    this.setSurveyInfo({
      grading,
      monitoring,
      generalDescription,
      equipmentRequired,
    });
  }

  getFilterOptions() {
    const devices = this.extractAllFloorsDeviceData();

    const floors = new Set();
    const systemCategories = new Set();
    const zones = new Set();
    const rooms = new Set();

    devices.forEach((d) => {
      if (d.floorName) floors.add(d.floorName);
      if (d.systemCategory) systemCategories.add(d.systemCategory);
      // Normalise blanks for UI as (None)
      zones.add(d.zoneInfo && d.zoneInfo.trim() ? d.zoneInfo.trim() : "(None)");
      rooms.add(d.roomInfo && d.roomInfo.trim() ? d.roomInfo.trim() : "(None)");
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

  generateTakeoffData() {
    const devices = this.extractAllFloorsDeviceData();
    const filtered = this.applyFilters(devices);
    return this.consolidateDevicesByFloor(filtered);
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
              <th scope="col" style="width: 10%;">Floor</th>
              <th scope="col">Device Name</th>
              <th scope="col" style="width: 12%;">Location</th>
              <th scope="col" style="width: 12%;">Mounted</th>
              <th scope="col" style="width: 12%;">Zone</th>
              <th scope="col" style="width: 12%;">Room</th>
              <th scope="col" style="width: 12%;">Part No.</th>
              <th scope="col" style="width: 12%;">Stock No.</th>
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

        // Format zone and room info for display
        const zoneDisplay = device.zoneInfo ? this.escapeHtml(device.zoneInfo) : "-";
        const roomDisplay = device.roomInfo ? this.escapeHtml(device.roomInfo) : "-";

        rows += `
          <tr class="${rowClass} takeoff-row">
            <td style="font-weight: bold; color: var(--orange-ip2);">${deviceCounter++}</td>
            <td>
              <span class="badge floor-badge" style="background-color: var(--orange-ip2); color: white; font-size: 11px;">
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

    const surveyInfo = this.getSurveyInfo();
    let csv = "";
    
    // Add survey information at the top
    if (surveyInfo.grading || surveyInfo.monitoring || surveyInfo.generalDescription || surveyInfo.equipmentRequired) {
      csv += "Survey Information\n";
      if (surveyInfo.grading) csv += `Grading,${surveyInfo.grading}\n`;
      if (surveyInfo.monitoring) csv += `Monitoring,${surveyInfo.monitoring}\n`;
      if (surveyInfo.generalDescription) csv += `General Description,"${surveyInfo.generalDescription.replace(/"/g, '""')}"\n`;
      if (surveyInfo.equipmentRequired) csv += `Equipment Required,"${surveyInfo.equipmentRequired.replace(/"/g, '""')}"\n`;
      csv += "\n";
    }
    
    csv += "#,Floor,Device Name,Location,Mounted,Zone,Room,Part No.,Stock No.,Qty\n";
    let deviceCounter = 1;

    takeoffData.forEach((floorGroup) => {
      floorGroup.devices.forEach((device) => {
        const floorNames = device.multiFloor ? device.allFloorNames : floorGroup.floorName;
        const zoneInfo = device.zoneInfo || "";
        const roomInfo = device.roomInfo || "";
        csv += `${deviceCounter++},"${floorNames}","${device.name}","${device.location}","${device.fittingPosition}","${zoneInfo}","${roomInfo}","${device.partNumber}","${device.stockNumber}",${device.quantity}\n`;
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
          acc.deviceTypes.add(device.systemCategory || device.deviceType);
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
    console.warn("Takeoff button not found");
  }

  window.takeoffGenerator = takeoffGenerator;
  return takeoffGenerator;
}

function showTakeoffModal(takeoffGenerator) {
  const modalEl = document.getElementById("takeoff-modal");
  if (!modalEl) {
    console.warn("Takeoff modal element not found in DOM");
    return;
  }

  // Populate filters panel & table containers
  const summaryContainer = document.getElementById("takeoff-summary-cards");
  if (summaryContainer) {
    summaryContainer.innerHTML = createFiltersPanel(takeoffGenerator);
  }

  const tableContainer = document.getElementById("takeoff-table-container");
  if (tableContainer) {
    tableContainer.innerHTML = takeoffGenerator.generateTakeoffTable();
  }

  // Restore survey info if it exists
  const surveyInfo = takeoffGenerator.getSurveyInfo();
  const gradingEl = document.getElementById("takeoff-grading");
  const monitoringEl = document.getElementById("takeoff-monitoring");
  const descriptionEl = document.getElementById("takeoff-general-description");
  const equipmentEl = document.getElementById("takeoff-equipment-required");
  
  if (gradingEl) gradingEl.value = surveyInfo.grading || "";
  if (monitoringEl) monitoringEl.value = surveyInfo.monitoring || "";
  if (descriptionEl) descriptionEl.value = surveyInfo.generalDescription || "";
  if (equipmentEl) equipmentEl.value = surveyInfo.equipmentRequired || "";

  // Ensure listeners are bound only once (idempotent binding pattern)
  setupModalEventListeners(takeoffGenerator, { rebind: true });
  bindFilterEvents(takeoffGenerator);

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

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

// Small HTML escape helpers for UI rendering in this module scope
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text ?? '').replace(/[&<>"']/g, (m) => map[m]);
}

function escapeAttr(text) {
  // For attribute values inside double quotes
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function setupModalEventListeners(takeoffGenerator, { rebind = false } = {}) {
  const exportBtn = document.getElementById("export-takeoff-csv");
  const printBtn = document.getElementById("print-takeoff");
  const modalEl = document.getElementById("takeoff-modal");

  if (!exportBtn || !printBtn || !modalEl) return;

  if (rebind) {
    // Clone to remove previous listeners if any
    const newExportBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
    const newPrintBtn = printBtn.cloneNode(true);
    printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
  }

  document.getElementById("export-takeoff-csv").addEventListener("click", () => {
    // Capture survey info before export
    takeoffGenerator.captureSurveyInfo();
    
    const csv = takeoffGenerator.generateCSV();
    if (!csv || csv.trim() === "" || csv.trim() === "#,Floor,Device Name,Location,Mounted,Zone,Room,Part No.,Stock No.,Qty") {
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
    // Capture survey info before print
    takeoffGenerator.captureSurveyInfo();
    
    const takeoffData = takeoffGenerator.generateTakeoffData();
    if (takeoffData.length === 0 || takeoffData.every((floor) => floor.devices.length === 0)) {
      alert("No devices found to print");
      return;
    }
    printTakeoffList(takeoffGenerator);
  });
}

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

  const applyBtn = document.getElementById("apply-takeoff-filters");
  const resetBtn = document.getElementById("reset-takeoff-filters");

  // Removed manual apply/reset buttons - filters now auto-apply on change

  // Auto-apply on change for quicker UX
  ["filter-systems", "filter-floors", "filter-zones", "filter-rooms"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", apply);
  });
}

function printTakeoffList(takeoffGenerator) {
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

  // Add survey information to print container
  addSurveyInfoToPrint(takeoffGenerator, printContainer);

  setupClientLogo(printContainer, takeoffGenerator);
}

function addSurveyInfoToPrint(takeoffGenerator, printContainer) {
  const surveyInfo = takeoffGenerator.getSurveyInfo();
  
  // Find or create survey info section in print container
  let surveySection = printContainer.querySelector('.survey-info-print-section');
  
  if (!surveySection) {
    surveySection = document.createElement('div');
    surveySection.className = 'survey-info-print-section';
    
    // Insert after header but before canvas section
    const canvasSection = printContainer.querySelector('.canvas-section');
    if (canvasSection) {
      printContainer.insertBefore(surveySection, canvasSection);
    } else {
      printContainer.appendChild(surveySection);
    }
  }
  
  // Build survey info HTML
  let surveyHTML = '<div style="padding: 10px 30px; margin: 10px 0; page-break-inside: avoid;">';
  surveyHTML += '<h3 style="margin-bottom: 10px; color: #333; border-bottom: 2px solid #f8794b; padding-bottom: 5px;">Survey Information</h3>';
  surveyHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">';
  
  // Grading - with box
  surveyHTML += '<div>';
  surveyHTML += '<strong style="display: block; margin-bottom: 5px;">Grading:</strong>';
  surveyHTML += `<div style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; min-height: 40px;">${surveyInfo.grading ? escapeHtml(surveyInfo.grading) : '&nbsp;'}</div>`;
  surveyHTML += '</div>';
  
  // Monitoring - with box
  surveyHTML += '<div>';
  surveyHTML += '<strong style="display: block; margin-bottom: 5px;">Monitoring:</strong>';
  surveyHTML += `<div style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; min-height: 40px;">${surveyInfo.monitoring ? escapeHtml(surveyInfo.monitoring) : '&nbsp;'}</div>`;
  surveyHTML += '</div>';
  
  // General Description - with box
  surveyHTML += '<div>';
  surveyHTML += '<strong style="display: block; margin-bottom: 5px;">General Description:</strong>';
  surveyHTML += `<div style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; min-height: 40px;">${surveyInfo.generalDescription ? escapeHtml(surveyInfo.generalDescription) : '&nbsp;'}</div>`;
  surveyHTML += '</div>';
  
  // Equipment Required - with box
  surveyHTML += '<div>';
  surveyHTML += '<strong style="display: block; margin-bottom: 5px;">Equipment Required:</strong>';
  surveyHTML += `<div style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; min-height: 40px;">${surveyInfo.equipmentRequired ? escapeHtml(surveyInfo.equipmentRequired) : '&nbsp;'}</div>`;
  surveyHTML += '</div>';
  
  surveyHTML += '</div>'; // Close grid
  surveyHTML += '</div>';
  
  surveySection.innerHTML = surveyHTML;
}

function setupClientLogo(printContainer, takeoffGenerator) {
  const printLogo = document.getElementById("print-logo");
  const clientLogoInput = document.getElementById("client-logo-upload");

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

function proceedWithPrint(takeoffGenerator) {
  // Close modals and clean up
  closeAllModalsAndBackdrops();

  // Setup print content
  const tableContent = setupPrintTable();
  const canvasSection = document.querySelector("#print-container .canvas-section");

  if (canvasSection && tableContent) {
    setupCanvasSection(canvasSection, tableContent);

    const reportTitleElement = document.getElementById("print-report-title");
    if (reportTitleElement) {
      const filters = (window.takeoffGenerator && window.takeoffGenerator.getFilters) ? window.takeoffGenerator.getFilters() : null;
      const hasFilters = filters && (filters.floors?.length || filters.deviceTypes?.length || filters.zones?.length || filters.rooms?.length);
      reportTitleElement.textContent = hasFilters ? "Device Takeoff List - Filtered" : "Device Takeoff List - All Floors";
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
          // Ensure coverage is beneath the camera but above the background.
          if (device.coverageArea) {
            try {
              // Remove existing coverage if present to avoid index confusion
              if (fabricCanvas.getObjects().includes(device.coverageArea)) {
                fabricCanvas.remove(device.coverageArea);
              }

              // Insert coverage immediately before the device so it stays under it
              const currentDeviceIndex = fabricCanvas.getObjects().indexOf(device);
              if (currentDeviceIndex !== -1) {
                fabricCanvas.insertAt(device.coverageArea, currentDeviceIndex);
              } else {
                // Fallback: add coverage and send to back (then device will be brought
                // to front below) — this should be rare but keeps behavior safe.
                fabricCanvas.add(device.coverageArea);
                device.coverageArea.sendToBack();
              }
            } catch (err) {
              console.warn("Failed to reposition coverage area:", err);
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

  // Set column widths - updated to include Zone and Room columns
  const columnWidths = ["40px", "10%", "auto", "10%", "10%", "10%", "10%", "10%", "10%", "40px"];

  table.querySelectorAll("tr").forEach((row) => {
    const rowCells = row.querySelectorAll("th, td");
    rowCells.forEach((cell, index) => {
      if (columnWidths[index]) {
        cell.style.cssText += `width: ${columnWidths[index]} !important;`;
        if (index === 0 || index === 9) {
          // # and Qty columns
          cell.style.cssText += "max-width: 40px !important;";
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

  // Fix quantity column - now column 10 instead of 8
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
