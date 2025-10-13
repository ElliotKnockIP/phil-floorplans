import { initCropBackground } from "./crop-background.js";
import { initCustomBackground } from "./custom-background.js";
import { initMapBackground } from "./map-background.js";
import { initScaleBackground } from "./scale-background.js";

export function initSelectBackground(fabricCanvas) {
  const customModal = document.getElementById("customModal");
  const uploadFileBtn = document.getElementById("upload-file-btn");
  const uploadPdfBtn = document.getElementById("upload-pdf-btn");
  const googleMapsBtn = document.getElementById("google-maps-btn");
  const customStyleBtn = document.getElementById("custom-style-btn");
  const subSidebar = document.getElementById("sub-sidebar");

  let modalImageInput,
    modalPdfInput,
    isFileUpload = false,
    selectedBackground = null;

  function createFileInputs() {
    if (!modalImageInput) {
      modalImageInput = document.createElement("input");
      modalImageInput.type = "file";
      modalImageInput.accept = "image/*";
      modalImageInput.style.display = "none";
      document.body.appendChild(modalImageInput);
      modalImageInput.addEventListener("change", handleFileChange);
    }
    if (!modalPdfInput) {
      modalPdfInput = document.createElement("input");
      modalPdfInput.type = "file";
      modalPdfInput.accept = ".pdf";
      modalPdfInput.style.display = "none";
      document.body.appendChild(modalPdfInput);
      modalPdfInput.addEventListener("change", handlePdfChange);
    }
  }

  createFileInputs();

  function resetFileInput() {
    if (modalImageInput) modalImageInput.value = "";
    if (modalPdfInput) modalPdfInput.value = "";
  }

  function handleFileChange() {
    const file = modalImageInput.files[0];
    if (!file || !file.type.startsWith("image/")) {
      if (file) alert("Please select a valid image file (JPG, PNG, etc.)");
      return;
    }
    setIsFileUpload(true);
    setBackgroundSource("file");
    const url = URL.createObjectURL(file);
    bootstrap.Modal.getInstance(customModal)?.hide();
    cropHandler.handleCrop(url);
    updateStepIndicators(2);
    resetFileInput();
  }

  async function handlePdfChange() {
    const file = modalPdfInput.files[0];
    if (!file || file.type !== "application/pdf") {
      if (file) alert("Please select a valid PDF file");
      return;
    }
    bootstrap.Modal.getInstance(customModal)?.hide();
    convertPdfToImage(file);
  }

  async function convertPdfToImage(file) {
    try {
      if (!window.pdfjsLib) throw new Error("PDF.js library not loaded");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      setIsFileUpload(true);
      setBackgroundSource("pdf");
      cropHandler.handleCrop(dataUrl);
      updateStepIndicators(2);
      pdf.destroy();
    } catch {
      alert("Error converting PDF to image. Please try again or use an image file instead.");
    }
  }

  function getVisibleModal() {
    const modals = ["customModal", "mapModal", "cropModal", "customBackgroundModal", "scaleModal"];
    return modals.find((id) => document.getElementById(id)?.classList.contains("show"));
  }

  function updateStepIndicators(activeStep) {
    const visibleModalId = getVisibleModal();
    if (!visibleModalId) return;
    const steps = document.getElementById(visibleModalId)?.querySelectorAll(".modal-header-center .step");
    steps?.forEach((step, index) => {
      step.classList.remove("active", "finish");
      if (index + 1 === activeStep) step.classList.add("active");
      else if (index + 1 < activeStep) step.classList.add("finish");
    });
  }

  function closeAllPopups() {
    const modals = ["customModal", "mapModal", "cropModal", "customBackgroundModal", "scaleModal"];
    modals.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal?.classList.contains("show")) bootstrap.Modal.getInstance(modal)?.hide();
    });
    subSidebar?.classList.add("hidden");
    document.querySelectorAll(".submenu").forEach((submenu) => {
      submenu.classList.add("hidden");
      submenu.classList.remove("show");
    });
    resetFileInput();
    isFileUpload = false;
    selectedBackground = null;
    updateStepIndicators(1);
  }

  customModal?.addEventListener("show.bs.modal", () => {
    if (subSidebar) subSidebar.classList.add("hidden");
  });

  function setIsFileUpload(value) {
    isFileUpload = value;
  }
  function getIsFileUpload() {
    return isFileUpload;
  }
  function setBackgroundSource(source) {
    selectedBackground = source;
  }
  function getBackgroundSource() {
    return selectedBackground;
  }

  const scaleHandler = initScaleBackground(fabricCanvas, null, updateStepIndicators, closeAllPopups);
  const cropHandler = initCropBackground(fabricCanvas, customModal, updateStepIndicators, getIsFileUpload, setIsFileUpload, getBackgroundSource, closeAllPopups);
  cropHandler.setScaleHandler(scaleHandler);
  window.cropHandlerInstance = cropHandler;
  initCustomBackground(fabricCanvas, customModal, updateStepIndicators, cropHandler.handleCrop, setBackgroundSource);
  initMapBackground(fabricCanvas, customModal, updateStepIndicators, cropHandler.handleCrop, setBackgroundSource);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    },
    true
  );

  uploadFileBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetFileInput();
    modalImageInput.click();
  });

  uploadPdfBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetFileInput();
    modalPdfInput.click();
  });

  googleMapsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBackgroundSource("maps");
    bootstrap.Modal.getInstance(customModal)?.hide();
    const mapModal = document.getElementById("mapModal");
    (bootstrap.Modal.getInstance(mapModal) || new bootstrap.Modal(mapModal)).show();
  });

  customStyleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBackgroundSource("custom");
    bootstrap.Modal.getInstance(customModal)?.hide();
    const customBackgroundModal = document.getElementById("customBackgroundModal");
    (bootstrap.Modal.getInstance(customBackgroundModal) || new bootstrap.Modal(customBackgroundModal)).show();
  });

  return { closeAllPopups, updateStepIndicators, setIsFileUpload, getIsFileUpload, setBackgroundSource, getBackgroundSource };
}
