// FloorUI.js - Floor UI controls and notifications
import { NotificationSystem } from "../save/utils-save.js";

export class FloorUI {
  // Initialize floor UI with floor manager reference
  constructor(floorManager) {
    this.floorManager = floorManager;
  }

  // Sets up the floor control buttons
  setupFloorControls() {
    this.setupFloorEventListeners();
    this.updateFloorUI();
  }

  // Sets up click handlers for floor buttons
  setupFloorEventListeners() {
    const handlers = {
      "floor-prev": () => this.navigateFloor(-1),
      "floor-next": () => this.navigateFloor(1),
      "floor-add": () => this.addNewFloor(),
      "floor-delete": () => this.deleteCurrentFloor(),
      "floor-rename": () => this.renameCurrentFloor(),
    };
    Object.entries(handlers).forEach(([id, handler]) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener("click", handler);
    });
  }

  // Moves to the previous or next floor
  navigateFloor(direction) {
    const existingFloors = Array.from(this.floorManager.floors.keys()).sort((a, b) => a - b);
    const currentIndex = existingFloors.indexOf(this.floorManager.currentFloor);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < existingFloors.length) {
      this.floorManager.switchToFloor(existingFloors[newIndex]);
    }
  }

  // Updates the floor display and button states
  updateFloorUI() {
    const floorDisplay = document.getElementById("floor-display");
    if (floorDisplay) {
      const currentFloorData = this.floorManager.floors.get(this.floorManager.currentFloor);
      const displayName = currentFloorData?.name || `Floor ${this.floorManager.currentFloor}`;
      floorDisplay.textContent = displayName;
    }
    const existingFloors = Array.from(this.floorManager.floors.keys()).sort((a, b) => a - b);
    const currentIndex = existingFloors.indexOf(this.floorManager.currentFloor);
    const prevBtn = document.getElementById("floor-prev");
    const nextBtn = document.getElementById("floor-next");
    const deleteBtn = document.getElementById("floor-delete");
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= existingFloors.length - 1;
    if (deleteBtn) deleteBtn.disabled = this.floorManager.floors.size <= 1;
    this.updateQuickJumpButtons();
  }

  // Updates the quick jump buttons for floors
  updateQuickJumpButtons() {
    const quickJumpContainer = document.getElementById("floor-quick-jump");
    if (!quickJumpContainer) return;
    quickJumpContainer.innerHTML = "";
    const existingFloors = Array.from(this.floorManager.floors.keys()).sort((a, b) => a - b);
    // Show at least 5 buttons even if fewer floors exist
    const maxFloor = Math.max(...existingFloors, 5);
    for (let floor = 1; floor <= maxFloor; floor++) {
      const button = document.createElement("button");
      const isCurrent = floor === this.floorManager.currentFloor;
      const hasData = this.floorManager.floors.has(floor);
      button.textContent = floor.toString();
      button.className = "btn btn-sm";
      // Style and enable button if floor exists but is not current
      if (hasData && !isCurrent) {
        button.classList.add("floor-available");
        this.styleFloorButton(button, "available");
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.floorManager.switchToFloor(floor);
        });
      } else if (hasData && isCurrent) {
        button.classList.add("current-floor");
        this.styleFloorButton(button, "current");
      } else {
        // Disable button if floor does not exist
        button.classList.add("floor-unavailable");
        this.styleFloorButton(button, "unavailable");
        button.disabled = true;
        button.title = `Floor ${floor} - Not created`;
      }
      quickJumpContainer.appendChild(button);
    }
  }

  // Styles the floor buttons based on their state
  styleFloorButton(button, type) {
    button.classList.add("floor-btn-base");
    if (type === "available") {
      button.classList.add("floor-btn-available");
    } else if (type === "current") {
      button.classList.add("floor-btn-current");
    } else if (type === "unavailable") {
      button.classList.add("floor-btn-unavailable");
    }
  }

  // Creates a new floor and switches to it
  addNewFloor() {
    let newFloorNumber = 1;
    while (this.floorManager.floors.has(newFloorNumber) && newFloorNumber <= this.floorManager.maxFloors) {
      newFloorNumber++;
    }
    if (newFloorNumber > this.floorManager.maxFloors) {
      this.showNotification(`Maximum ${this.floorManager.maxFloors} floors allowed`, false);
      return;
    }
    this.floorManager.createNewFloor(newFloorNumber);
    this.floorManager.switchToFloor(newFloorNumber);
  }

  // Deletes the current floor and switches to another one
  deleteCurrentFloor() {
    if (this.floorManager.floors.size <= 1) {
      this.showNotification("Cannot delete the last floor", false);
      return;
    }
    const currentFloorData = this.floorManager.floors.get(this.floorManager.currentFloor);
    const floorName = currentFloorData?.name || `Floor ${this.floorManager.currentFloor}`;
    if (!confirm(`Are you sure you want to delete ${floorName}? This action cannot be undone.`)) return;
    const floorToDelete = this.floorManager.currentFloor;
    const availableFloors = Array.from(this.floorManager.floors.keys()).sort((a, b) => a - b);
    const lowerFloors = availableFloors.filter((f) => f < floorToDelete);
    const higherFloors = availableFloors.filter((f) => f > floorToDelete);
    // Find the nearest floor to switch to after deletion
    const targetFloor = lowerFloors.length > 0 ? Math.max(...lowerFloors) : Math.min(...higherFloors);
    this.floorManager.isLoading = true;
    this.floorManager.switchToFloor(targetFloor).then(() => {
      this.floorManager.floors.delete(floorToDelete);
      this.floorManager.isLoading = false;
      setTimeout(() => this.updateFloorUI(), 100);
    });
    this.showNotification(`${floorName} deleted`, true);
  }

  // Renames the current floor
  renameCurrentFloor() {
    const currentFloorData = this.floorManager.floors.get(this.floorManager.currentFloor);
    const currentName = currentFloorData?.name || `Floor ${this.floorManager.currentFloor}`;
    const newName = prompt("Enter new floor name:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      if (currentFloorData) {
        currentFloorData.name = newName.trim();
        this.updateFloorUI();
        this.showNotification(`Floor renamed to "${newName.trim()}"`, true);
      }
    }
  }

  // Delegate to centralized NotificationSystem
  showNotification(message, isSuccess = true) {
    NotificationSystem.show(message, isSuccess);
  }

  // Handles errors and shows error messages
  handleError(message, error) {
    console.error(message, error);
    this.showNotification(`${message}: ${error.message}`, false);
  }
}
