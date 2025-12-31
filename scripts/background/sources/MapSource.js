// Map Source Handler handles Google Maps integration

export class MapSourceHandler {
  constructor(manager, googleMapsApiKey) {
    this.manager = manager;
    this.googleMapsApiKey = googleMapsApiKey;

    // Map related elements and state
    this.map = null;
    this.mapElements = {
      mapModal: document.getElementById("mapModal"),
      mapBackBtn: document.getElementById("map-back-btn"),
      mapNextBtn: document.getElementById("map-next-btn"),
      addressInput: document.getElementById("maps-address-input"),
      mapTypeSelect: document.getElementById("map-type-select"),
      shapeSquareBtn: document.getElementById("shape-square-btn"),
      shapeRectBtn: document.getElementById("shape-rect-btn"),
      captureOverlay: document.getElementById("map-capture-overlay"),
    };

    this.captureShape = "square";
  }

  // Setup event handlers for map interactions
  setupMapHandlers() {
    if (this.mapElements.mapBackBtn) {
      this.mapElements.mapBackBtn.addEventListener("click", () => this.handleMapBack());
    }

    if (this.mapElements.mapNextBtn) {
      this.mapElements.mapNextBtn.addEventListener("click", () => this.handleMapNext());
    }

    if (this.mapElements.mapTypeSelect) {
      this.mapElements.mapTypeSelect.addEventListener("change", () => {
        if (this.map) this.map.setMapTypeId(this.mapElements.mapTypeSelect.value);
      });
    }

    if (this.mapElements.shapeSquareBtn) {
      this.mapElements.shapeSquareBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setCaptureShape("square");
      });
    }

    if (this.mapElements.shapeRectBtn) {
      this.mapElements.shapeRectBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setCaptureShape("rect");
      });
    }

    if (this.mapElements.mapModal) {
      this.mapElements.mapModal.addEventListener("shown.bs.modal", () => {
        setTimeout(() => {
          if (!this.map) this.initializeMap();
          else this.updateCaptureFrameShape();
        }, 300);
      });
    }
  }

  // Show map modal and initialize map if needed
  showMapModal() {
    this.manager.normalizeBackdrops();
    this.manager.showModal(this.mapElements.mapModal);
    this.manager.updateStepIndicators(1);

    if (!this.map) this.initializeMap();
  }

  // Initialize Google Map with autocomplete
  async initializeMap() {
    try {
      const mapContainer = document.getElementById("map");
      if (!mapContainer) return;

      const { Map } = await google.maps.importLibrary("maps");
      const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

      this.map = new Map(mapContainer, {
        center: { lat: 51.501414692425151, lng: -0.14187515932683303 },
        zoom: 18,
        mapTypeId: "satellite",
        tilt: 0,
        gestureHandling: "greedy",
        scaleControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
      });

      this.updateCaptureFrameShape();

      // Add CSS for autocomplete and capture frame
      const style = document.createElement("style");
      style.textContent = `
                gmp-place-autocomplete {
                    width: 100% !important;
                    height: 50px !important;
                    display: block !important;
                    box-sizing: border-box !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .capture-frame.rect {
                    width: min(56vh, 56vw, 640px) !important;
                    height: calc(min(56vh, 56vw, 640px) * 9 / 16) !important;
                }
            `;
      document.head.appendChild(style);

      if (this.mapElements.addressInput) {
        const placeAutocomplete = new PlaceAutocompleteElement({
          locationRestriction: {
            north: 85,
            south: -85,
            east: 180,
            west: -180,
          },
        });
        placeAutocomplete.id = "maps-address-input";
        placeAutocomplete.placeholder = "Enter address, building name or postcode...";

        Object.assign(placeAutocomplete.style, {
          width: "100%",
          height: "50px",
          padding: "0 1rem",
          border: "none",
          outline: "none",
          borderRadius: "0.5rem",
          fontSize: "1rem",
          boxSizing: "border-box",
        });

        this.mapElements.addressInput.parentNode.replaceChild(placeAutocomplete, this.mapElements.addressInput);

        placeAutocomplete.addEventListener("gmp-select", async (event) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "location"] });

            if (!place.location) {
              alert("No details available for the selected place. Please try another.");
              return;
            }

            this.map.setCenter(place.location);
            this.map.setZoom(19);
            placeAutocomplete.value = place.formattedAddress;
          } catch (error) {
            console.error("Place selection error:", error);
            alert("Error selecting location. Please try again.");
          }
        });
      }
    } catch (error) {
      console.error("Map initialization error:", error);
      alert("Error loading Google Maps. Please check your internet connection and try again.");
    }
  }

  // Update capture frame shape based on selection
  updateCaptureFrameShape() {
    const frame = this.mapElements.captureOverlay?.querySelector(".capture-frame");
    if (!frame) return;

    frame.classList.remove("square", "rect");
    frame.classList.add(this.captureShape === "rect" ? "rect" : "square");
  }

  // Set capture shape and update UI
  setCaptureShape(shape) {
    this.captureShape = shape;
    this.updateCaptureFrameShape();

    if (this.mapElements.shapeSquareBtn) {
      this.mapElements.shapeSquareBtn.classList.toggle("active", this.captureShape === "square");
    }
    if (this.mapElements.shapeRectBtn) {
      this.mapElements.shapeRectBtn.classList.toggle("active", this.captureShape === "rect");
    }
  }

  // Handle back button and return to main selection
  handleMapBack() {
    bootstrap.Modal.getInstance(this.mapElements.mapModal)?.hide();

    this.manager.normalizeBackdrops();
    this.manager.showModal(document.getElementById("customModal"));
    this.manager.updateStepIndicators(1);
  }

  // Handle map next button and capture static map image
  async handleMapNext() {
    if (!this.map) {
      alert("Map not initialized. Please try again.");
      return;
    }

    // Show loading state on button
    if (this.mapElements.mapNextBtn) {
      this.mapElements.mapNextBtn.disabled = true;
      this.mapElements.mapNextBtn.innerHTML = `
                <div class="icon-label">
                    <span>Loading...</span>
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                </div>
            `;
    }

    try {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const mapType = this.mapElements.mapTypeSelect?.value || "satellite";

      let width = 640;
      let height = 640;

      // Calculate dimensions based on capture frame
      const frame = this.mapElements.captureOverlay?.querySelector(".capture-frame");
      if (frame) {
        const rect = frame.getBoundingClientRect();
        const maxSide = 640;

        const aspectRatio = rect.width / rect.height;
        if (aspectRatio > 1) {
          width = maxSide;
          height = Math.round(maxSide / aspectRatio);
        } else {
          height = maxSide;
          width = Math.round(maxSide * aspectRatio);
        }

        // Adjust zoom for precise capture
        const pixelRatio = width / rect.width;
        const zoomOffset = Math.log2(pixelRatio);
        const currentZoom = this.map.getZoom();
        const adjustedZoom = Math.round(Math.min(currentZoom + zoomOffset, 21) * 100) / 100;
        this.map.setZoom(adjustedZoom);
      } else if (this.captureShape === "rect") {
        width = 640;
        height = Math.round((640 * 9) / 16);
      }

      const apiKey = this.googleMapsApiKey;
      const baseUrl = "https://maps.googleapis.com/maps/api/staticmap";
      const params = [`center=${center.lat()},${center.lng()}`, `zoom=${zoom}`, `size=${width}x${height}`, "scale=2", `maptype=${mapType}`, `key=${apiKey}`, "format=jpg", "quality=95"];
      const staticMapUrl = `${baseUrl}?${params.join("&")}`;

      // Preload image to ensure it's available
      await this.preloadImage(staticMapUrl);

      // Hide map modal and start cropping
      bootstrap.Modal.getInstance(this.mapElements.mapModal)?.hide();
      this.manager.selectSource("map");
      this.manager.cropper.startCropping(staticMapUrl);
      this.manager.updateStepIndicators(2);
    } catch (error) {
      console.error("Map capture error:", error);
      alert("Unable to load satellite image. Please try again later.");
    } finally {
      // Reset button state
      if (this.mapElements.mapNextBtn) {
        this.mapElements.mapNextBtn.disabled = false;
        this.mapElements.mapNextBtn.innerHTML = `
                    <div class="icon-label">
                        <span>Next</span>
                        <img src="images/icons/forward-black-arrow.svg" alt="Next Arrow" />
                    </div>
                `;
      }
    }
  }

  // Preload image with timeout
  preloadImage(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeoutId = setTimeout(() => reject(new Error("Image loading timeout")), timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Image loading failed"));
      };
      img.crossOrigin = "anonymous";
      img.src = url;
    });
  }
}
