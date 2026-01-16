// OpenStreetMap Source Handler using Leaflet

export class OSMSourceHandler {
  constructor(manager) {
    this.manager = manager;

    // Map related state
    this.map = null;
    this.osmElements = null;
    this.handlersInitialized = false;

    this.captureShape = "square";
    this.mapType = "roadmap";
    this.tileLayer = null;
  }

  // Initialize DOM elements
  initializeElements() {
    this.osmElements = {
      osmModal: document.getElementById("osmModal"),
      osmBackBtn: document.getElementById("osm-back-btn"),
      osmNextBtn: document.getElementById("osm-next-btn"),
      addressInput: document.getElementById("osm-address-input"),
      shapeSquareBtn: document.getElementById("osm-shape-square-btn"),
      shapeRectBtn: document.getElementById("osm-shape-rect-btn"),
      captureOverlay: document.getElementById("osm-capture-overlay"),
    };
  }

  // Setup event handlers for OSM map interactions
  setupOSMHandlers() {
    this.initializeElements();

    if (!this.osmElements.osmModal) {
      console.warn("OSM Modal not found, will retry on show");
      return;
    }

    if (this.handlersInitialized) return;
    this.handlersInitialized = true;

    if (this.osmElements.osmBackBtn) {
      this.osmElements.osmBackBtn.addEventListener("click", () => this.handleOSMBack());
    }

    if (this.osmElements.osmNextBtn) {
      this.osmElements.osmNextBtn.addEventListener("click", () => this.handleOSMNext());
    }

    if (this.osmElements.shapeSquareBtn) {
      this.osmElements.shapeSquareBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setCaptureShape("square");
      });
    }

    if (this.osmElements.shapeRectBtn) {
      this.osmElements.shapeRectBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setCaptureShape("rect");
      });
    }

    if (this.osmElements.osmModal) {
      this.osmElements.osmModal.addEventListener("shown.bs.modal", () => {
        setTimeout(() => {
          if (!this.map) this.initializeOSMMap();
          else {
            this.map.invalidateSize();
            this.updateCaptureFrameShape();
          }
        }, 300);
      });
    }
  }

  // Show OSM map modal and initialize map if needed
  showOSMModal() {
    // Re-initialize elements in case they weren't available before
    if (!this.osmElements || !this.osmElements.osmModal) {
      this.initializeElements();
      this.setupOSMHandlers();
    }

    this.manager.normalizeBackdrops();
    this.manager.showModal(this.osmElements.osmModal);
    this.manager.updateStepIndicators(1);

    if (!this.map) this.initializeOSMMap();
  }

  // Initialize Leaflet map with geocoding search
  async initializeOSMMap() {
    try {
      const mapContainer = document.getElementById("osm-map");
      if (!mapContainer) return;

      // Initialize Leaflet map
      this.map = L.map(mapContainer, {
        center: [51.501414692425151, -0.14187515932683303],
        zoom: 18,
        zoomControl: true,
        attributionControl: true, // Enabled for compliance
        wheelPxPerZoomLevel: 120, // Slower scrolling
        zoomSnap: 0.25, // Smoother zoom steps
        zoomDelta: 0.25
      });

      // Apply initial styles
      this.applyMapStyles();
      this.updateCaptureFrameShape();

      // Setup address search with Nominatim geocoding
      this.setupAddressSearch();

      // Set modal title
      const modalTitle = document.getElementById("osmModalLabel");
      if (modalTitle) {
        modalTitle.textContent = "OpenStreetMap";
      }

      // Add CSS for capture frame
      const existingStyle = document.getElementById("osm-custom-styles");
      if (!existingStyle) {
        const style = document.createElement("style");
        style.id = "osm-custom-styles";
        style.textContent = `
          #osm-map-container .capture-frame.rect {
            width: min(56vh, 56vw, 640px) !important;
            height: calc(min(56vh, 56vw, 640px) * 9 / 16) !important;
          }
        `;
        document.head.appendChild(style);
      }
    } catch (error) {
      console.error("OSM Map initialization error:", error);
      alert("Error loading OpenStreetMap. Please check your internet connection and try again.");
    }
  }

  // Setup address search using Nominatim
  setupAddressSearch() {
    const searchInput = document.getElementById("osm-address-input");
    const searchResults = document.getElementById("osm-search-results");

    if (!searchInput || !searchResults) return;

    let debounceTimer;

    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (query.length < 3) {
        searchResults.innerHTML = "";
        searchResults.style.display = "none";
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
              headers: {
                "Accept-Language": "en",
              },
            }
          );
          const results = await response.json();

          if (results.length > 0) {
            searchResults.innerHTML = results
              .map(
                (result) => `
              <div class="osm-search-result" data-lat="${result.lat}" data-lon="${result.lon}">
                <span class="result-name">${result.display_name}</span>
              </div>
            `
              )
              .join("");
            searchResults.style.display = "block";

            // Add click handlers to results
            searchResults.querySelectorAll(".osm-search-result").forEach((item) => {
              item.addEventListener("click", () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                this.map.setView([lat, lon], 19);
                searchInput.value = item.querySelector(".result-name").textContent;
                searchResults.style.display = "none";
              });
            });
          } else {
            searchResults.innerHTML = '<div class="osm-search-result no-results">No results found</div>';
            searchResults.style.display = "block";
          }
        } catch (error) {
          console.error("Geocoding error:", error);
        }
      }, 300);
    });

    // Hide results when clicking outside
    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = "none";
      }
    });

    // Handle Enter key for search
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query.length >= 3) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
              {
                headers: {
                  "Accept-Language": "en",
                },
              }
            );
            const results = await response.json();
            if (results.length > 0) {
              const lat = parseFloat(results[0].lat);
              const lon = parseFloat(results[0].lon);
              this.map.setView([lat, lon], 19);
              searchResults.style.display = "none";
            }
          } catch (error) {
            console.error("Geocoding error:", error);
          }
        }
      }
    });
  }

  // Update capture frame shape based on selection
  updateCaptureFrameShape() {
    const frame = this.osmElements.captureOverlay?.querySelector(".capture-frame");
    if (!frame) return;

    frame.classList.remove("square", "rect");
    frame.classList.add(this.captureShape === "rect" ? "rect" : "square");
  }

  // Apply visual styles to the map (tile layers)
  applyMapStyles() {
    if (!this.map) return;

    // Remove existing layer
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    // Define free-to-use tile providers
    this.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // OpenStreetMap standard tiles are free for commercial use with attribution
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });

    this.tileLayer.addTo(this.map);
  }

  // Set capture shape and update UI
  setCaptureShape(shape) {
    this.captureShape = shape;
    this.updateCaptureFrameShape();

    if (this.osmElements.shapeSquareBtn) {
      this.osmElements.shapeSquareBtn.classList.toggle("active", this.captureShape === "square");
    }
    if (this.osmElements.shapeRectBtn) {
      this.osmElements.shapeRectBtn.classList.toggle("active", this.captureShape === "rect");
    }
  }

  // Handle back button and return to main selection
  handleOSMBack() {
    bootstrap.Modal.getInstance(this.osmElements.osmModal)?.hide();

    this.manager.normalizeBackdrops();
    this.manager.showModal(document.getElementById("customModal"));
    this.manager.updateStepIndicators(1);
  }

  // Handle OSM next button and capture map as image using html2canvas
  async handleOSMNext() {
    if (!this.map) {
      alert("Map not initialized. Please try again.");
      return;
    }

    // Show loading state on button
    if (this.osmElements.osmNextBtn) {
      this.osmElements.osmNextBtn.disabled = true;
      this.osmElements.osmNextBtn.innerHTML = `
        <div class="icon-label">
          <span>Loading...</span>
          <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>
      `;
    }

    try {
      // Get the capture frame dimensions
      const frame = this.osmElements.captureOverlay?.querySelector(".capture-frame");
      const mapContainer = document.getElementById("osm-map-container");

      if (!frame || !mapContainer) {
        throw new Error("Capture frame not found");
      }

      // Get bounding rectangles
      const frameRect = frame.getBoundingClientRect();
      const containerRect = mapContainer.getBoundingClientRect();

      // Calculate the offset of the frame relative to the map container
      const offsetX = frameRect.left - containerRect.left;
      const offsetY = frameRect.top - containerRect.top;

      // Use leaflet-image or html2canvas to capture the map
      const imageDataUrl = await this.captureMapArea(frameRect, offsetX, offsetY);

      // Hide OSM modal and start cropping
      bootstrap.Modal.getInstance(this.osmElements.osmModal)?.hide();
      this.manager.currentSource = "osm";
      this.manager.cropper.startCropping(imageDataUrl);
      this.manager.updateStepIndicators(2);
    } catch (error) {
      console.error("OSM capture error:", error);
      alert("Unable to capture map image. Please try again.");
    } finally {
      // Reset button state
      if (this.osmElements.osmNextBtn) {
        this.osmElements.osmNextBtn.disabled = false;
        this.osmElements.osmNextBtn.innerHTML = `
          <div class="icon-label">
            <span>Next</span>
            <img src="images/icons/forward-black-arrow.svg" alt="Next Arrow" />
          </div>
        `;
      }
    }
  }

  // Capture the map area by stitching tiles for highest quality
  async captureMapArea(frameRect, offsetX, offsetY) {
    if (!this.map || !this.tileLayer) throw new Error("Map not initialized");

    const mapElement = document.getElementById("osm-map");
    // Convert offsetX/Y pixel coordinates to LatLng
    const topLeftPoint = L.point(offsetX, offsetY);
    const bottomRightPoint = L.point(offsetX + frameRect.width, offsetY + frameRect.height);

    const topLeft = this.map.containerPointToLatLng(topLeftPoint);
    const bottomRight = this.map.containerPointToLatLng(bottomRightPoint);

    // Creates a much sharper image when scaled down to fit the view.
    const currentZoom = this.map.getZoom();
    const z = Math.min(19, Math.floor(currentZoom + 2));

    // Get world pixel coordinates at the target zoom
    const pixelTopLeft = this.latLngToWorldPixel(topLeft.lat, topLeft.lng, z);
    const pixelBottomRight = this.latLngToWorldPixel(bottomRight.lat, bottomRight.lng, z);

    const minX = Math.min(pixelTopLeft.x, pixelBottomRight.x);
    const minY = Math.min(pixelTopLeft.y, pixelBottomRight.y);
    const maxX = Math.max(pixelTopLeft.x, pixelBottomRight.x);
    const maxY = Math.max(pixelTopLeft.y, pixelBottomRight.y);

    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);

    if (width <= 0 || height <= 0) throw new Error("Invalid capture dimensions");

    const tileSize = 256;
    const tileXMin = Math.floor(minX / tileSize);
    const tileXMax = Math.floor((maxX - 0.1) / tileSize);
    const tileYMin = Math.floor(minY / tileSize);
    const tileYMax = Math.floor((maxY - 0.1) / tileSize);

    const numTilesX = tileXMax - tileXMin + 1;
    const numTilesY = tileYMax - tileYMin + 1;
    if (numTilesX > 16 || numTilesY > 16) {
      throw new Error("Capture area too large for high-res stitching. Try zooming in more.");
    }

    const stitchCanvas = document.createElement("canvas");
    stitchCanvas.width = numTilesX * tileSize;
    stitchCanvas.height = numTilesY * tileSize;
    const stitchCtx = stitchCanvas.getContext("2d");
    
    // Fill with white background
    stitchCtx.fillStyle = "#ffffff";
    stitchCtx.fillRect(0, 0, stitchCanvas.width, stitchCanvas.height);
    stitchCtx.imageSmoothingEnabled = false;

    const tileJobs = [];
    const n = Math.pow(2, z);

    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = tileXMin; tx <= tileXMax; tx++) {
        const wrappedX = ((tx % n) + n) % n;
        
        // Use Standard OpenStreetMap (roadmap) - Free for all uses with attribution
        const s = ["a", "b", "c"][(wrappedX + ty) % 3];
        const url = `https://${s}.tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png`;
        
        tileJobs.push({
          url,
          dx: (tx - tileXMin) * tileSize,
          dy: (ty - tileYMin) * tileSize
        });
      }
    }

    // Load all tiles
    const images = await this.loadImagesWithConcurrency(tileJobs.map(j => j.url), 8);
    
    // Draw tiles onto stitch canvas
    let successCount = 0;
    for (let i = 0; i < tileJobs.length; i++) {
      if (images[i]) {
        stitchCtx.drawImage(images[i], tileJobs[i].dx, tileJobs[i].dy, tileSize, tileSize);
        successCount++;
      }
    }

    // Fallback if tiles fail
    if (successCount < tileJobs.length / 2) {
      throw new Error("Failed to load map tiles for high-res capture");
    }

    // Crop the stitch canvas to the exact frame
    const sx = Math.floor(minX - (tileXMin * tileSize));
    const sy = Math.floor(minY - (tileYMin * tileSize));

    // Scale logic to improve display quality
    const targetMin = 2048;
    const currentMax = Math.max(width, height);
    const scale = currentMax < targetMin ? (targetMin / currentMax) : 1;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = Math.floor(width * scale);
    finalCanvas.height = Math.floor(height * scale);
    const finalCtx = finalCanvas.getContext("2d");
    
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';

    finalCtx.drawImage(
      stitchCanvas,
      sx, sy, width, height,
      0, 0, finalCanvas.width, finalCanvas.height
    );

    return finalCanvas.toDataURL("image/png");
  }

  // Calculate world pixel coordinates from LatLng at a specific zoom
  latLngToWorldPixel(lat, lng, zoom) {
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const scale = 256 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  // Helper to load multiple images with concurrency control
  loadImagesWithConcurrency(urls, concurrency = 8) {
    const results = new Array(urls.length).fill(null);
    let index = 0;

    const worker = async () => {
      while (index < urls.length) {
        const currentIndex = index++;
        const url = urls[currentIndex];
        try {
          results[currentIndex] = await this.loadImage(url);
        } catch {
          results[currentIndex] = null;
        }
      }
    };

    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, urls.length)) }, () => worker());
    return Promise.all(workers).then(() => results);
  }

  // Load a single image
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}
