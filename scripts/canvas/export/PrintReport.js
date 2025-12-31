// Handles print functionality with screenshot integration
import { initCanvasCrop } from "./Screenshot.js";

export class PrintReporter {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
    this.elements = {
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

    // Initialize cropping tool for screenshots
    this.canvasCrop = initCanvasCrop(fabricCanvas, this.elements.subSidebar, this.elements.canvasContainer);
    window.canvasCrop = this.canvasCrop;

    this.init();
  }

  // Setup event listeners for print and screenshot UI
  init() {
    // Handle print button click
    this.elements.printButton.addEventListener("click", () => {
      this.fabricCanvas.renderAll();
      const screenshots = PrintReporter.getAllScreenshots();
      PrintReporter.proceedWithPrint(this.elements.canvasContainer, this.elements.subSidebar, this.fabricCanvas, PrintReporter.getPrintInputs(), screenshots);
    });

    // Handle screenshot capture button click
    this.elements.captureScreenshotButton.addEventListener("click", () => {
      this.canvasCrop.startCropForScreenshot();
      setTimeout(PrintReporter.updateScreenshotStatus, 100);
    });

    // Trigger file input when logo button is clicked
    this.elements.clientLogoButton.addEventListener("click", () => this.elements.clientLogoInput.click());

    // Handle client logo file selection
    this.elements.clientLogoInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file?.type.startsWith("image/")) {
        alert("Please select a valid image file (JPG, PNG, etc.).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.elements.logoPreview.innerHTML = `<img src="${e.target.result}" alt="Uploaded Client Logo">`;
      };
      reader.readAsDataURL(file);
    });

    // Handle clearing all captured screenshots
    this.elements.clearScreenshotsBtn?.addEventListener("click", () => {
      this.canvasCrop.clearScreenshots();
      if (window.loadedScreenshots) window.loadedScreenshots = [];
      PrintReporter.updateScreenshotStatus();
    });

    // Update status when screenshot preview list changes
    if (this.elements.screenshotPreviews) {
      new MutationObserver(() => PrintReporter.updateScreenshotStatus()).observe(this.elements.screenshotPreviews, {
        childList: true,
        subtree: true,
      });
    }

    // Expose utility functions globally
    window.getAllScreenshots = PrintReporter.getAllScreenshots;
    window.updateScreenshotStatus = PrintReporter.updateScreenshotStatus;

    PrintReporter.updateScreenshotStatus();
    return { updateScreenshotStatus: PrintReporter.updateScreenshotStatus };
  }

  // Collect all screenshots from memory and DOM
  static getAllScreenshots() {
    let screenshots = [];

    // Get screenshots from the cropper module
    if (window.canvasCrop?.getScreenshots) {
      screenshots = window.canvasCrop.getScreenshots();
    }

    // Fallback to globally loaded screenshots
    if (screenshots.length === 0 && window.loadedScreenshots) {
      screenshots = window.loadedScreenshots;
    }

    // Extract screenshots from the preview UI if other sources are empty
    if (screenshots.length === 0) {
      const screenshotPreviews = document.querySelectorAll(".screenshot-preview-item");
      screenshots = Array.from(screenshotPreviews)
        .map((preview, index) => {
          const img = preview.querySelector(".screenshot-image");
          const checkbox = preview.querySelector(".screenshot-checkbox");
          const titleTextarea = preview.querySelector(".screenshot-title");

          return img?.src
            ? {
                dataURL: img.src,
                includeInPrint: checkbox?.checked || false,
                id: Date.now() + index,
                title: titleTextarea?.value.trim() || `Screenshot ${index + 1}`,
              }
            : null;
        })
        .filter(Boolean);
    }

    return screenshots;
  }

  // Toggle visibility of "no screenshots" message
  static updateScreenshotStatus() {
    const screenshots = PrintReporter.getAllScreenshots();
    const noScreenshotElement = document.getElementById("no-screenshot-taken");
    if (noScreenshotElement) {
      noScreenshotElement.style.display = screenshots.length > 0 ? "none" : "block";
    }
  }

  // Retrieve values from report input fields
  static getPrintInputs() {
    const getValue = (id, defaultValue = "") => document.getElementById(id)?.value.trim() || defaultValue;

    return {
      clientLogoInput: document.getElementById("client-logo-upload"),
      clientName: getValue("client-name-test-input", "Client Name"),
      address: getValue("address-input", "Address"),
      date: getValue("client-date-input") || new Date().toLocaleDateString(),
      reportTitle: getValue("report-title-input", "Report"),
    };
  }

  // Prepare and trigger the browser print dialog
  static proceedWithPrint(canvasContainer, subSidebar, fabricCanvas, printInputs, screenshots) {
    const { clientName, address, date, reportTitle, clientLogoInput } = printInputs;
    const originalContainerStyle = canvasContainer.style.cssText;

    // Reset container styles for printing
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

    // Update text content in the print layout
    const updateElement = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    updateElement("print-client-name", clientName);
    updateElement("print-address", address);
    updateElement("print-date", date);
    updateElement("print-report-title", reportTitle);

    // Populate the print layout with selected screenshots
    const canvasSection = printContainer.querySelector(".canvas-section");
    if (canvasSection) {
      canvasSection.innerHTML = "";

      const allScreenshots = screenshots?.length > 0 ? screenshots : PrintReporter.getAllScreenshots();
      const selectedScreenshots = allScreenshots.filter((s) => s.includeInPrint);

      if (selectedScreenshots.length > 0) {
        const screenshotPreviews = document.querySelectorAll(".screenshot-preview-item");

        selectedScreenshots.forEach((screenshot, index) => {
          let screenshotTitleText = screenshot.title || `Screenshot ${index + 1}`;

          // Match screenshot with its title from the UI
          if (!screenshot.title) {
            for (const preview of screenshotPreviews) {
              const previewImg = preview.querySelector(".screenshot-image");
              const titleTextarea = preview.querySelector(".screenshot-title");
              if (previewImg?.src === screenshot.dataURL && titleTextarea?.value.trim()) {
                screenshotTitleText = titleTextarea.value.trim();
                break;
              }
            }
          }

          // Create title and image elements for the report
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
        // Show message if no screenshots are selected
        const message = Object.assign(document.createElement("p"), {
          textContent: "No screenshots selected for printing.",
        });
        message.style.marginTop = "20px";
        canvasSection.appendChild(message);
      }
    }

    // Show print container and trigger print after images load
    const proceedToPrint = () => {
      printContainer.style.display = "block";
      PrintReporter.waitForImagesAndPrint(printContainer, () => {
        PrintReporter.cleanupAfterPrint(subSidebar, canvasContainer, originalContainerStyle, fabricCanvas);
      });
    };

    // Handle client logo loading
    const printLogo = document.getElementById("print-logo");

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
        PrintReporter.tryLogoFromPreview(printLogo, proceedToPrint);
      };
      reader.readAsDataURL(clientLogoInput.files[0]);
    } else {
      PrintReporter.tryLogoFromPreview(printLogo, proceedToPrint);
    }
  }

  // Attempt to use the logo from the preview area if no file is selected
  static tryLogoFromPreview(printLogo, proceedToPrint) {
    const logoPreview = document.getElementById("client-logo-preview");
    const logoImg = logoPreview?.querySelector("img");

    if (logoImg?.src && !logoImg.src.includes("data:image/svg")) {
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

  // Wait for all images in the print container to load before printing
  static waitForImagesAndPrint(printContainer, afterPrintCallback) {
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

  // Restore UI state and clean up temporary print elements
  static cleanupAfterPrint(subSidebar, canvasContainer, originalContainerStyle, fabricCanvas) {
    subSidebar?.classList.remove("hidden");
    if (canvasContainer) canvasContainer.style.cssText = originalContainerStyle;
    fabricCanvas?.requestRenderAll();

    const printContainer = document.getElementById("print-container");
    printContainer && (printContainer.style.display = "none");

    ["print-canvas-image", "print-logo"].forEach((id) => {
      document.getElementById(id)?.removeAttribute("src");
    });
  }
}

// Initialize the print reporter module
export function initCanvasPrint(fabricCanvas) {
  return new PrintReporter(fabricCanvas);
}

export const getPrintInputs = PrintReporter.getPrintInputs;
export const proceedWithPrint = PrintReporter.proceedWithPrint;
