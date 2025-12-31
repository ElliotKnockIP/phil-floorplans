// Background Selector coordinates background source selection

import { FileSourceHandler } from "./sources/FileSource.js";
import { MapSourceHandler } from "./sources/MapSource.js";
import { CustomSourceHandler } from "./sources/CustomSource.js";
import { GOOGLE_MAPS_API_KEY } from "../../config-loader.js";

export class BackgroundSelector {
  constructor(fabricCanvas, manager) {
    this.fabricCanvas = fabricCanvas;
    this.manager = manager;

    // DOM elements
    this.elements = {
      mainModal: document.getElementById("customModal"),
      uploadFileBtn: document.getElementById("upload-file-btn"),
      uploadPdfBtn: document.getElementById("upload-pdf-btn"),
      googleMapsBtn: document.getElementById("google-maps-btn"),
      customStyleBtn: document.getElementById("custom-style-btn"),
      subSidebar: document.getElementById("sub-sidebar"),
    };

    // Initialize source handlers
    this.fileHandler = new FileSourceHandler(manager);
    this.mapHandler = new MapSourceHandler(manager, GOOGLE_MAPS_API_KEY);
    this.customHandler = new CustomSourceHandler(manager);
  }

  // Initialize source handlers and listeners
  initialize() {
    this.fileHandler.setupFileInputs();
    this.setupButtonListeners();
    this.mapHandler.setupMapHandlers();
    this.customHandler.setupCustomHandlers();
    this.setupModalListeners();
  }

  // Setup button event listeners
  setupButtonListeners() {
    if (this.elements.uploadFileBtn) {
      this.elements.uploadFileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.fileHandler.resetFileInputs();
        this.fileHandler.fileInputs.image.click();
      });
    }

    if (this.elements.uploadPdfBtn) {
      this.elements.uploadPdfBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.fileHandler.resetFileInputs();
        this.fileHandler.fileInputs.pdf.click();
      });
    }

    if (this.elements.googleMapsBtn) {
      this.elements.googleMapsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.manager.selectSource("maps");
      });
    }

    if (this.elements.customStyleBtn) {
      this.elements.customStyleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.manager.selectSource("custom");
      });
    }
  }

  // Handle source selection and show appropriate modal
  handleSourceSelection(sourceType) {
    bootstrap.Modal.getInstance(this.elements.mainModal)?.hide();

    switch (sourceType) {
      case "maps":
        this.mapHandler.showMapModal();
        break;
      case "custom":
        this.customHandler.showCustomModal();
        break;
    }
  }

  // Setup modal event listeners
  setupModalListeners() {
    if (this.elements.mainModal) {
      this.elements.mainModal.addEventListener("show.bs.modal", () => {
        if (this.elements.subSidebar) {
          this.elements.subSidebar.classList.add("hidden");
        }
      });
    }
  }
}
