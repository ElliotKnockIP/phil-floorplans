// File Source Handler handles file uploads and PDF conversion

export class FileSourceHandler {
  constructor(manager) {
    this.manager = manager;

    // File input elements
    this.fileInputs = {
      image: null,
      pdf: null,
    };
  }

  // Setup file input elements for images and PDFs
  setupFileInputs() {
    this.fileInputs.image = this.createFileInput("image/*", (event) => this.handleImageFile(event));
    this.fileInputs.pdf = this.createFileInput(".pdf", (event) => this.handlePdfFile(event));
  }

  // Create a hidden file input element
  createFileInput(accept, handler) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", handler);
    document.body.appendChild(input);
    return input;
  }

  // Reset file input values
  resetFileInputs() {
    if (this.fileInputs.image) this.fileInputs.image.value = "";
    if (this.fileInputs.pdf) this.fileInputs.pdf.value = "";
  }

  // Handle image file selection and pass to manager
  handleImageFile(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      if (file) alert("Please select a valid image file (JPG, PNG, etc.)");
      return;
    }

    const url = URL.createObjectURL(file);
    this.manager.processFile("file", url);
  }

  // Handle PDF file selection and start conversion
  async handlePdfFile(event) {
    const file = event.target.files[0];
    if (!file || file.type !== "application/pdf") {
      if (file) alert("Please select a valid PDF file");
      return;
    }

    bootstrap.Modal.getInstance(document.getElementById("customModal"))?.hide();
    await this.convertPdfToImage(file);
  }

  // Convert first page of PDF to image using PDF.js
  async convertPdfToImage(file) {
    try {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js library not loaded");
      }

      // Configure PDF.js worker
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageUrl = canvas.toDataURL("image/png");
      this.manager.processFile("pdf", imageUrl);

      pdf.destroy();
    } catch (error) {
      console.error("PDF conversion error:", error);
      alert("Error converting PDF to image. Please try again or use an image file instead.");
    }
  }
}
