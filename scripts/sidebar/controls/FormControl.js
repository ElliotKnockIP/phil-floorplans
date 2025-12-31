import { bindInputToProperty, bindSelectToProperty, preventEventPropagation } from "../sidebar-utils.js";

// Utilities for binding form elements to object properties
export class FormControl {
  // Binds a text input to an object property
  static bindInput(elementId, propName, getTarget, options = {}) {
    const el = document.getElementById(elementId);
    if (el) {
      bindInputToProperty(el, propName, getTarget, options);
      return el;
    }
    return null;
  }

  // Binds a select dropdown to an object property
  static bindSelect(elementId, propName, getTarget, options = {}) {
    const el = document.getElementById(elementId);
    if (el) {
      bindSelectToProperty(el, propName, getTarget, options);
      return el;
    }
    return null;
  }

  // Prevents events from bubbling up to the canvas
  static preventCanvasInterference(elementId, events = ["click", "keydown", "mousedown"]) {
    const el = document.getElementById(elementId);
    if (el) {
      preventEventPropagation(el, events);
    }
  }
}
