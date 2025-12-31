import { setupColorControls, getHexFromFill } from "../sidebar-utils.js";

// Manages color picker and preset color icons
export class ColorControl {
  // Store elements and callback for color changes
  constructor(pickerId, iconClass, callback) {
    this.picker = document.getElementById(pickerId);
    this.icons = document.querySelectorAll(`.${iconClass} .colour-icon`);
    this.callback = callback;

    this.init();
  }

  // Initializes the color controls
  init() {
    if (this.picker || this.icons.length > 0) {
      setupColorControls(this.picker, this.icons, (color) => {
        if (this.callback) this.callback(color);
      });
    }
  }

  // Updates the picker value from a fill color
  setValue(fill) {
    if (this.picker) {
      this.picker.value = getHexFromFill(fill);
    }
  }
}
