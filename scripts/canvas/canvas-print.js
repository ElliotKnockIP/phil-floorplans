import { initCanvasCrop } from "./canvas-crop.js";

// Enhanced function to get screenshots from multiple sources
function getAllScreenshots() {
  let screenshots = [];

  // Try to get from canvasCrop first
  if (window.canvasCrop && typeof window.canvasCrop.getScreenshots === "function") {
    screenshots = window.canvasCrop.getScreenshots();
  }

  // If no screenshots from canvasCrop, try the fallback
  if (screenshots.length === 0 && window.loadedScreenshots) {
    screenshots = window.loadedScreenshots;
  }

  // If still no screenshots, try to extract from DOM
  if (screenshots.length === 0) {
    const screenshotPreviews = document.querySelectorAll(".screenshot-preview-item");
    screenshots = Array.from(screenshotPreviews)
      .map((preview, index) => {
        const img = preview.querySelector(".screenshot-image");
        const checkbox = preview.querySelector(".screenshot-checkbox");
        const titleTextarea = preview.querySelector(".screenshot-title");

        if (img && img.src) {
          return {
            dataURL: img.src,
            includeInPrint: checkbox ? checkbox.checked : false,
            id: Date.now() + index,
            title: titleTextarea ? titleTextarea.value.trim() : `Screenshot ${index + 1}`,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  return screenshots;
}

function updateScreenshotStatus() {
  const screenshots = getAllScreenshots();
  const noScreenshotElement = document.getElementById("no-screenshot-taken");

  if (noScreenshotElement) {
    noScreenshotElement.style.display = screenshots.length > 0 ? "none" : "block";
  }
}

export function initCanvasPrint(fabricCanvas) {
  const elements = {
    printButton: document.getElementById("print-btn"),
    captureScreenshotButton: document.getElementById("capture-screenshot-btn"),
    subSidebar: document.getElementById("sub-sidebar"),
    canvasContainer: document.querySelector(".canvas-container"),
    noScreenshotTaken: document.getElementById("no-screenshot-taken"),
    clientLogoButton: document.getElementById("client-logo-test-input"),
    clientLogoInput: document.getElementById("client-logo-upload"),
    logoPreview: document.getElementById("client-logo-preview"),
    clearScreenshotsBtn: document.getElementById("clear-screenshots-btn"),
    screenshotPreviews: document.getElementById("screenshot-previews"),
  };

  const canvasCrop = initCanvasCrop(fabricCanvas, elements.subSidebar, elements.canvasContainer);

  // Make canvasCrop globally available
  window.canvasCrop = canvasCrop;

  // Event listeners
  elements.printButton.addEventListener("click", () => {
    fabricCanvas.renderAll();
    // Use enhanced screenshot getter
    const screenshots = getAllScreenshots();
    proceedWithPrint(elements.canvasContainer, elements.subSidebar, fabricCanvas, getPrintInputs(), screenshots);
  });

  elements.captureScreenshotButton.addEventListener("click", () => {
    canvasCrop.startCropForScreenshot();
    setTimeout(updateScreenshotStatus, 100);
  });

  elements.clientLogoButton.addEventListener("click", () => elements.clientLogoInput.click());

  elements.clientLogoInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file?.type.startsWith("image/")) {
      alert("Please select a valid image file (JPG, PNG, etc.).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      elements.logoPreview.innerHTML = `<img src="${e.target.result}" alt="Uploaded Client Logo">`;
    };
    reader.readAsDataURL(file);
  });

  elements.clearScreenshotsBtn?.addEventListener("click", () => {
    canvasCrop.clearScreenshots();
    // Also clear fallback storage
    if (window.loadedScreenshots) {
      window.loadedScreenshots = [];
    }
    updateScreenshotStatus();
  });

  // Observer for screenshot changes
  if (elements.screenshotPreviews) {
    new MutationObserver(() => updateScreenshotStatus()).observe(elements.screenshotPreviews, {
      childList: true,
      subtree: true,
    });
  }

  // Make functions globally available
  window.getAllScreenshots = getAllScreenshots;
  window.updateScreenshotStatus = updateScreenshotStatus;

  updateScreenshotStatus();
  return { updateScreenshotStatus };
}

export function getPrintInputs() {
  const getValue = (id, defaultValue = "") => document.getElementById(id)?.value.trim() || defaultValue;

  return {
    clientLogoInput: document.getElementById("client-logo-upload"),
    clientName: getValue("client-name-test-input", "Client Name"),
    address: getValue("address-input", "Address"),
    date: getValue("client-date-input") || new Date().toLocaleDateString(),
    reportTitle: getValue("report-title-input", "Report"),
  };
}

export function proceedWithPrint(canvasContainer, subSidebar, fabricCanvas, printInputs, screenshots) {
  const { clientName, address, date, reportTitle, clientLogoInput } = printInputs;
  const originalContainerStyle = canvasContainer.style.cssText;

  // Set container styles
  Object.assign(canvasContainer.style, {
    position: "relative",
    left: "0",
    width: "100%",
    height: "100%",
    margin: "0",
    padding: "0",
  });

  const printContainer = document.getElementById("print-container");
  if (!printContainer) {
    alert("Print container not found");
    return;
  }

  // Update print header
  const updateElement = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateElement("print-client-name", clientName);
  updateElement("print-address", address);
  updateElement("print-date", date);
  updateElement("print-report-title", reportTitle);

  // Handle canvas section with enhanced screenshot handling
  const canvasSection = printContainer.querySelector(".canvas-section");
  if (canvasSection) {
    canvasSection.innerHTML = "";

    // Use the provided screenshots or get them using the enhanced getter
    const allScreenshots = screenshots && screenshots.length > 0 ? screenshots : getAllScreenshots();
    const selectedScreenshots = allScreenshots.filter((s) => s.includeInPrint);

    if (selectedScreenshots.length > 0) {
      const screenshotPreviews = document.querySelectorAll(".screenshot-preview-item");

      selectedScreenshots.forEach((screenshot, index) => {
        // Find title from preview or use the saved title
        let screenshotTitleText = screenshot.title || `Screenshot ${index + 1}`;

        // Try to get title from DOM if not in screenshot object
        if (!screenshot.title) {
          for (const preview of screenshotPreviews) {
            const previewImg = preview.querySelector(".screenshot-image");
            const titleTextarea = preview.querySelector(".screenshot-title");
            if (previewImg && previewImg.src === screenshot.dataURL && titleTextarea?.value.trim()) {
              screenshotTitleText = titleTextarea.value.trim();
              break;
            }
          }
        }

        // Create and append elements
        const title = Object.assign(document.createElement("h2"), {
          textContent: screenshotTitleText,
          className: "screenshot-title",
        });

        const img = Object.assign(document.createElement("img"), {
          src: screenshot.dataURL,
          className: "print-canvas-image",
          alt: screenshotTitleText,
        });
        Object.assign(img.style, {
          width: "100%",
          height: "auto",
          marginBottom: "20px",
        });

        canvasSection.append(title, img);
      });
    } else {
      const message = Object.assign(document.createElement("p"), {
        textContent: "No screenshots selected for printing.",
      });
      message.style.marginTop = "20px";
      canvasSection.appendChild(message);
    }
  }

  const proceedToPrint = () => {
    printContainer.style.display = "block";
    waitForImagesAndPrint(printContainer, () => {
      cleanupAfterPrint(subSidebar, canvasContainer, originalContainerStyle, fabricCanvas);
    });
  };

  // Enhanced client logo handling
  const printLogo = document.getElementById("print-logo");

  // First, try to get logo from client logo input file
  if (clientLogoInput?.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (printLogo) {
        printLogo.src = e.target.result;
        Object.assign(printLogo.style, {
          maxWidth: "150px",
          maxHeight: "100px",
          display: "block",
        });
      }
      proceedToPrint();
    };
    reader.onerror = () => {
      console.error("Logo file read failed");
      // Try to get from preview as fallback
      tryLogoFromPreview(printLogo, proceedToPrint);
    };
    reader.readAsDataURL(clientLogoInput.files[0]);
  } else {
    // Try to get logo from the preview area
    tryLogoFromPreview(printLogo, proceedToPrint);
  }
}

// Helper function to get logo from preview area
function tryLogoFromPreview(printLogo, proceedToPrint) {
  const logoPreview = document.getElementById("client-logo-preview");
  const logoImg = logoPreview?.querySelector("img");

  if (logoImg && logoImg.src && !logoImg.src.includes("data:image/svg")) {
    if (printLogo) {
      printLogo.src = logoImg.src;
      Object.assign(printLogo.style, {
        maxWidth: "150px",
        maxHeight: "100px",
        display: "block",
      });
    }
  } else {
    if (printLogo) {
      printLogo.removeAttribute("src");
      printLogo.style.display = "none";
    }
  }
  proceedToPrint();
}

function waitForImagesAndPrint(printContainer, afterPrintCallback) {
  const images = printContainer.querySelectorAll("img[src]");

  if (images.length === 0) {
    setTimeout(() => {
      window.print();
      afterPrintCallback();
    }, 100);
    return;
  }

  let loadedImages = 0;
  const tryPrint = () => {
    if (++loadedImages === images.length) {
      setTimeout(() => {
        window.print();
        afterPrintCallback();
      }, 100);
    }
  };

  images.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
      tryPrint();
    } else {
      img.addEventListener("load", tryPrint, { once: true });
    }
  });
}

function cleanupAfterPrint(subSidebar, canvasContainer, originalContainerStyle, fabricCanvas) {
  subSidebar?.classList.remove("hidden");
  if (canvasContainer) canvasContainer.style.cssText = originalContainerStyle;
  fabricCanvas?.requestRenderAll();

  // Clean up print elements
  const printContainer = document.getElementById("print-container");
  printContainer && (printContainer.style.display = "none");

  ["print-canvas-image", "print-logo"].forEach((id) => {
    document.getElementById(id)?.removeAttribute("src");
  });
}
