export function initMapBackground(fabricCanvas, mainModal, updateStepIndicators, handleCrop, setBackgroundSource) {
  const mapModal = document.getElementById("mapModal");
  const mapBackBtn = document.getElementById("map-back-btn");
  const mapNextBtn = document.getElementById("map-next-btn");
  const addressInput = document.getElementById("maps-address-input");
  const mapTypeSelect = document.getElementById("map-type-select");

  let map;

  // Handle map background selection
  function handleMapBackgroundSelection() {
    bootstrap.Modal.getInstance(mainModal)?.hide();

    setTimeout(() => {
      (bootstrap.Modal.getInstance(mapModal) || new bootstrap.Modal(mapModal)).show();
      updateStepIndicators(1);

      setTimeout(() => {
        if (!map) initMap();
      }, 300);
    }, 200);
  }

  // Handle back navigation
  function handleMapBack() {
    bootstrap.Modal.getInstance(mapModal)?.hide();
    (bootstrap.Modal.getInstance(mainModal) || new bootstrap.Modal(mainModal)).show();
    updateStepIndicators(1);
  }

  // Initialize Google Map
  async function initMap() {
    try {
      const mapContainer = document.getElementById("map");
      if (!mapContainer) return;

      const { Map } = await google.maps.importLibrary("maps");
      const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

      map = new Map(mapContainer, {
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

      mapTypeSelect?.addEventListener("change", () => {
        map.setMapTypeId(mapTypeSelect.value);
      });

      if (addressInput) {
        const addressForm = document.getElementById("address-form");
        const placeAutocomplete = new PlaceAutocompleteElement({
          locationRestriction: { north: 85, south: -85, east: 180, west: -180 },
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

        addressInput.parentNode.replaceChild(placeAutocomplete, addressInput);

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
        `;
        document.head.appendChild(style);

        placeAutocomplete.addEventListener("gmp-select", async (event) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "location"] });

            if (!place.location) {
              alert("No details available for the selected place. Please try another.");
              return;
            }

            map.setCenter(place.location);
            map.setZoom(19);
            placeAutocomplete.value = place.formattedAddress;
          } catch (error) {
            alert("Error selecting location. Please try again.");
          }
        });
      }
    } catch (error) {
      alert("Error loading Google Maps. Please check your internet connection and try again.");
    }
  }

  // Preload map image
  function preloadMapImage(url, timeout = 15000) {
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

  // Handle next step with map image
  function handleMapNext() {
    if (!map) {
      alert("Map not initialized. Please try again.");
      return;
    }

    if (mapNextBtn) {
      mapNextBtn.disabled = true;
      mapNextBtn.innerHTML = `
        <div class="icon-label">
          <span>Loading...</span>
          <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>
      `;
    }

    const center = map.getCenter();
    const zoom = map.getZoom();
    const mapType = mapTypeSelect?.value || "satellite";

    const apiKey = "AIzaSyAx4DsAED53aflbG2KqEirKkFE4jMa6qGQ";
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat()},${center.lng()}&zoom=${zoom}&size=1024x1024&scale=2&maptype=${mapType}&key=${apiKey}&format=jpg&quality=90`;

    preloadMapImage(staticMapUrl)
      .then(() => {
        bootstrap.Modal.getInstance(mapModal)?.hide();
        setBackgroundSource("map");
        handleCrop(staticMapUrl);
        updateStepIndicators(2);
      })
      .catch(() => {
        const fallbackUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat()},${center.lng()}&zoom=${zoom}&size=800x800&scale=1&maptype=${mapType}&key=${apiKey}&format=jpg&quality=70`;

        preloadMapImage(fallbackUrl, 10000)
          .then(() => {
            bootstrap.Modal.getInstance(mapModal)?.hide();
            setBackgroundSource("map");
            handleCrop(fallbackUrl);
            updateStepIndicators(2);
          })
          .catch(() => {
            alert("Unable to load satellite image. Please try again later.");
          });
      })
      .finally(() => {
        if (mapNextBtn) {
          mapNextBtn.disabled = false;
          mapNextBtn.innerHTML = `
            <div class="icon-label">
              <span>Next</span>
              <img src="images/icons/next-arrow.svg" alt="Next Arrow Icon" />
            </div>
          `;
        }
      });
  }

  mapBackBtn?.addEventListener("click", handleMapBack);
  mapNextBtn?.addEventListener("click", handleMapNext);

  mapModal?.addEventListener("shown.bs.modal", () => {
    setTimeout(() => {
      if (!map) initMap();
    }, 300);
  });

  return { handleMapBackgroundSelection };
}
