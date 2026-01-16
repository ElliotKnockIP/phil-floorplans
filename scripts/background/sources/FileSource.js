// File Source Handler handles file uploads and PDF conversion

export class FileSourceHandler {
  constructor(manager) {
    this.manager = manager;

    // File input element
    this.fileInput = null;
  }

  // Setup file input elements for images and PDFs
  setupFileInputs() {
    this.fileInput = this.createFileInput(
      "image/jpeg, image/png, image/webp, application/pdf",
      (event) => this.handleFileSelection(event)
    );
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

  // Trigger the file upload dialog
  triggerUpload() {
    if (this.fileInput) {
      this.fileInput.value = "";
      this.fileInput.click();
    }
  }

  // Handle file selection (Image or PDF)
  handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      this.handlePdfFile(file);
    } else if (file.type.startsWith("image/")) {
      this.handleImageFile(file);
    } else {
      alert("Please select a valid image (JPG, PNG) or PDF file.");
    }
  }

  // Handle image file selection and pass to manager
  handleImageFile(file) {
    const url = URL.createObjectURL(file);
    this.manager.processFile("file", url);
  }

  // Handle PDF file selection and start conversion
  async handlePdfFile(file) {
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
