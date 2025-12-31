import { createSliderInputSync, updateSliderTrack } from "../sidebar-utils.js";

// Manages synchronized slider and number input controls
export class SliderControl {
  // Store elements and options for slider synchronization
  constructor(sliderId, inputId, callback, options = {}) {
    this.slider = document.getElementById(sliderId);
    this.input = document.getElementById(inputId);
    this.callback = callback;
    this.options = options;

    this.init();
  }

  // Initializes the slider and input synchronization
  init() {
    if (this.slider || this.input) {
      createSliderInputSync(
        this.slider,
        this.input,
        (value) => {
          if (this.callback) this.callback(value);
        },
        this.options
      );
    }
  }

  // Updates the visual value of the controls
  setValue(value) {
    if (this.slider) {
      this.slider.value = value;
      const min = parseFloat(this.slider.min) || this.options.min || 0;
      const max = parseFloat(this.slider.max) || this.options.max || 100;
      updateSliderTrack(this.slider, value, min, max);
    }
    if (this.input) {
      this.input.value = this.options.precision > 0 ? value.toFixed(this.options.precision) : Math.round(value);
    }
  }
}
