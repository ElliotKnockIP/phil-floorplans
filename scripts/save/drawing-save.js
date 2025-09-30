import { ObjectTypeUtils, SerializationUtils, StyleConfig } from "./save-utils.js";

// Optimized DrawingObjectSerializer with reduced code duplication
class OptimizedDrawingObjectSerializer {
  constructor(fabricCanvas) {
    this.fabricCanvas = fabricCanvas;
  }

  // Use centralized utilities
  isDrawingObject = ObjectTypeUtils.isDrawingObject;
  isZoneObject = ObjectTypeUtils.isZoneObject;
  isRoomObject = ObjectTypeUtils.isRoomObject;
  isWallObject = ObjectTypeUtils.isWallObject;
  isTitleBlockObject = ObjectTypeUtils.isTitleBlockObject;

  // Centralized styling application
  applyStandardStyling(obj, customControls = null) {
    const standardStyle = StyleConfig.standard;
    obj.set(standardStyle);
    if (customControls !== null) {
      obj.set({ hasControls: customControls });
    }
    return obj;
  }

  // Optimized serialization with reduced duplication
  serializeDrawingObjects() {
    const drawingObjects = this.fabricCanvas
      .getObjects()
      .filter((obj) => this.isDrawingObject(obj))
      .map((obj) => this.serializeDrawingObject(obj))
      .filter(Boolean);

    return {
      drawingObjects,
      zones: this.serializeZones(),
      rooms: this.serializeRooms(),
      walls: this.serializeWalls(),
      titleblocks: this.serializeTitleBlocks(),
      canvasSettings: this.getCanvasSettings(),
      globalState: {
        zonesArray: window.zones || [],
        roomsArray: window.rooms || [],
      },
    };
  }

  // Streamlined object serialization
  serializeDrawingObject(obj) {
    try {
      // Skip objects handled separately
      if (this.isZoneObject(obj) || this.isRoomObject(obj) || this.isWallObject(obj) || this.isTitleBlockObject(obj)) {
        return null;
      }

      const baseData = SerializationUtils.extractBaseData(obj);

      // Handle special object types
      if (obj.type === "image" && obj.isUploadedImage) {
        return this.serializeUploadedImage(obj, baseData);
      }

      // Use object type mapping for cleaner code
      const typeHandlers = {
        circle: () => this.serializeCircle(obj, baseData),
        rect: () => this.serializeRectangle(obj, baseData),
        "i-text": () => this.serializeText(obj, baseData),
        textbox: () => this.serializeText(obj, baseData),
        line: () => this.serializeLine(obj, baseData),
        triangle: () => this.serializeTriangle(obj, baseData),
        group: () => this.serializeGroup(obj, baseData),
        image: () => this.serializeImage(obj, baseData),
      };

      const handler = typeHandlers[obj.type];
      return handler ? handler() : { ...baseData, drawingType: "generic", fabricObject: obj.toObject() };
    } catch (error) {
      console.error("Error serializing drawing object:", error, obj);
      return null;
    }
  }

  // Specialized serializers for each object type
  serializeUploadedImage(obj, baseData) {
    return {
      ...baseData,
      drawingType: "uploadedImage",
      properties: {
        width: obj.width,
        height: obj.height,
        src: obj._element ? obj._element.src : null,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
      },
      lockState: {
        isLocked: obj.isLocked || false,
        lockMovementX: obj.lockMovementX || false,
        lockMovementY: obj.lockMovementY || false,
        lockRotation: obj.lockRotation || false,
        lockScalingX: obj.lockScalingX || false,
        lockScalingY: obj.lockScalingY || false,
      },
      isUploadedImage: true,
    };
  }

  serializeCircle(obj, baseData) {
    return {
      ...baseData,
      drawingType: "circle",
      properties: {
        radius: obj.radius,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        strokeDashArray: obj.strokeDashArray,
        strokeUniform: obj.strokeUniform,
      },
    };
  }

  serializeRectangle(obj, baseData) {
    return {
      ...baseData,
      drawingType: "rectangle",
      properties: {
        width: obj.width,
        height: obj.height,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        strokeDashArray: obj.strokeDashArray,
        strokeUniform: obj.strokeUniform,
      },
    };
  }

  serializeText(obj, baseData) {
    return {
      ...baseData,
      drawingType: "text",
      properties: {
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fill: obj.fill,
        backgroundColor: obj.backgroundColor,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        width: obj.width,
        height: obj.height,
        textAlign: obj.textAlign,
        lineHeight: obj.lineHeight,
        charSpacing: obj.charSpacing,
        cursorColor: obj.cursorColor,
      },
    };
  }

  serializeLine(obj, baseData) {
    return {
      ...baseData,
      drawingType: "line",
      properties: {
        x1: obj.x1,
        y1: obj.y1,
        x2: obj.x2,
        y2: obj.y2,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        strokeDashArray: obj.strokeDashArray,
      },
    };
  }

  serializeTriangle(obj, baseData) {
    return {
      ...baseData,
      drawingType: "triangle",
      properties: {
        width: obj.width,
        height: obj.height,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
      },
    };
  }

  serializeGroup(obj, baseData) {
    const groupType = this.determineGroupType(obj);

    if (groupType === "buildingFront") {
      return this.serializeBuildingFront(obj, baseData);
    }

    if (groupType === "arrow") {
      return this.serializeArrow(obj, baseData);
    }

    if (groupType === "measurement") {
      return this.serializeMeasurement(obj, baseData);
    }

    return {
      ...baseData,
      drawingType: "group",
      groupType,
      properties: {
        width: obj.width,
        height: obj.height,
      },
      objects: obj.getObjects().map((subObj) => this.serializeDrawingObject(subObj)),
    };
  }

  serializeImage(obj, baseData) {
    return {
      ...baseData,
      drawingType: "image",
      properties: {
        width: obj.width,
        height: obj.height,
        src: obj._element ? obj._element.src : null,
      },
    };
  }

  // Specialized group serializers
  serializeBuildingFront(obj, baseData) {
    const objects = obj.getObjects();
    const triangleObj = objects.find((o) => o.type === "triangle");
    const textObj = objects.find((o) => o.type === "text");

    return {
      ...baseData,
      drawingType: "group",
      groupType: "buildingFront",
      properties: {
        width: obj.width,
        height: obj.height,
      },
      buildingFrontData: {
        triangle: triangleObj ? this.serializeTriangleData(triangleObj, obj) : null,
        text: textObj ? this.serializeTextData(textObj, obj) : null,
      },
      isBuildingFront: true,
    };
  }

  serializeArrow(obj, baseData) {
    const objects = obj.getObjects();
    const lineObj = objects.find((o) => o.type === "line");
    const triangleObj = objects.find((o) => o.type === "triangle");

    return {
      ...baseData,
      drawingType: "arrow",
      properties: {
        width: obj.width,
        height: obj.height,
      },
      arrowData: {
        line: this.serializeLineData(lineObj),
        triangle: this.serializeTriangleData(triangleObj, obj),
        endPoint: { x: lineObj.x2, y: lineObj.y2 },
      },
    };
  }

  serializeMeasurement(obj, baseData) {
    const [lineObj, textObj] = obj.getObjects();
    const groupCenter = obj.getCenterPoint();

    return {
      ...baseData,
      drawingType: "group",
      groupType: "measurement",
      properties: {
        width: obj.width,
        height: obj.height,
      },
      measurementData: {
        line: this.serializeLineData(lineObj),
        text: this.serializeTextData(textObj, obj),
        groupCenter: { x: groupCenter.x, y: groupCenter.y },
      },
    };
  }

  // Helper methods for data extraction
  serializeTriangleData(triangleObj, group = null) {
    let absoluteLeft = triangleObj.left;
    let absoluteTop = triangleObj.top;

    // If part of a group, convert relative position to absolute
    if (group) {
      const groupCenter = group.getCenterPoint();
      absoluteLeft = groupCenter.x + triangleObj.left;
      absoluteTop = groupCenter.y + triangleObj.top;
    }

    return {
      width: triangleObj.width,
      height: triangleObj.height,
      fill: triangleObj.fill,
      angle: triangleObj.angle,
      left: triangleObj.left, // Keep relative position for group reconstruction
      top: triangleObj.top,
      absoluteLeft: absoluteLeft, // Store absolute position for loading
      absoluteTop: absoluteTop,
      originX: triangleObj.originX,
      originY: triangleObj.originY,
    };
  }

  serializeTextData(textObj, group = null) {
    let absoluteLeft = textObj.left;
    let absoluteTop = textObj.top;

    // If part of a group, convert relative position to absolute
    if (group) {
      const groupCenter = group.getCenterPoint();
      absoluteLeft = groupCenter.x + textObj.left;
      absoluteTop = groupCenter.y + textObj.top;
    }

    return {
      text: textObj.text,
      fontSize: textObj.fontSize,
      fontFamily: textObj.fontFamily,
      fontWeight: textObj.fontWeight,
      fill: textObj.fill,
      stroke: textObj.stroke,
      strokeWidth: textObj.strokeWidth,
      left: textObj.left, // Keep relative position for group reconstruction
      top: textObj.top,
      absoluteLeft: absoluteLeft, // Store absolute position for loading
      absoluteTop: absoluteTop,
      angle: textObj.angle,
      originX: textObj.originX,
      originY: textObj.originY,
      selectable: textObj.selectable,
      evented: textObj.evented,
    };
  }

  serializeLineData(lineObj) {
    return {
      x1: lineObj.x1,
      y1: lineObj.y1,
      x2: lineObj.x2,
      y2: lineObj.y2,
      stroke: lineObj.stroke,
      strokeWidth: lineObj.strokeWidth,
      strokeDashArray: lineObj.strokeDashArray,
      selectable: lineObj.selectable,
      evented: lineObj.evented,
      hasControls: lineObj.hasControls,
      hasBorders: lineObj.hasBorders,
    };
  }

  // Optimized group type determination
  determineGroupType(group) {
    if (group.isBuildingFront || group.groupType === "buildingFront") return "buildingFront";
    if (group.isArrow) return "arrow";

    const objects = group.getObjects();

    if (objects.length === 2) {
      if (objects.some((obj) => obj.type === "triangle") && objects.some((obj) => obj.type === "text")) {
        return "buildingFront";
      }
      if (objects.some((obj) => obj.type === "line") && objects.some((obj) => obj.type === "triangle")) {
        return "arrow";
      }
      if (objects.some((obj) => obj.type === "line") && objects.some((obj) => obj.type === "i-text" || obj.type === "text")) {
        return "measurement";
      }
    }

    return "generic";
  }

  // Optimized zone serialization
  serializeZones() {
    if (!window.zones?.length) return [];

    return window.zones
      .filter((zone) => this.validateZoneObjects(zone))
      .map((zone, index) => this.serializeZone(zone, index))
      .filter(Boolean);
  }

  validateZoneObjects(zone) {
    return zone.polygon && this.fabricCanvas.getObjects().includes(zone.polygon) && zone.text && this.fabricCanvas.getObjects().includes(zone.text);
  }

  serializeZone(zone, index) {
    try {
      return {
        id: `zone_${index}`,
        zoneName: zone.polygon.zoneName || `Zone ${index + 1}`,
        zoneNotes: zone.polygon.zoneNotes || "",
        area: zone.polygon.area || 0,
        height: zone.polygon.height || 2.4,
        volume: zone.polygon.volume || 0,
        polygon: this.serializePolygonData(zone.polygon),
        text: this.serializeTextObjectData(zone.text),
      };
    } catch (error) {
      console.error("Error serializing zone:", error, zone);
      return null;
    }
  }

  // Optimized room serialization
  serializeRooms() {
    if (!window.rooms?.length) return [];

    return window.rooms
      .filter((room) => this.validateRoomObjects(room))
      .map((room, index) => this.serializeRoom(room, index))
      .filter(Boolean);
  }

  validateRoomObjects(room) {
    return room.polygon && this.fabricCanvas.getObjects().includes(room.polygon) && room.text && this.fabricCanvas.getObjects().includes(room.text);
  }

  serializeRoom(room, index) {
    try {
      return {
        id: `room_${index}`,
        roomName: room.roomName || room.polygon.roomName || `Room ${index + 1}`,
        roomNotes: room.roomNotes || room.polygon.roomNotes || "",
        roomColor: room.roomColor || room.polygon.stroke || "#0066cc",
        area: room.area || room.polygon.area || 0,
        height: room.height || room.polygon.height || 2.4,
        volume: room.volume || room.polygon.volume || 0,
        devices: room.devices || [],
        polygon: this.serializePolygonData(room.polygon),
        text: this.serializeTextObjectData(room.text),
      };
    } catch (error) {
      console.error("Error serializing room:", error, room);
      return null;
    }
  }

  // Optimized wall serialization
  serializeWalls() {
    const circles = this.fabricCanvas.getObjects().filter((obj) => obj.type === "circle" && obj.isWallCircle);
    const lines = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && !obj.deviceType && !obj.isResizeIcon && obj.stroke !== "grey" && obj.stroke !== "blue");

    return {
      circles: circles.map((circle, index) => this.serializeWallCircle(circle, index)),
      lines: lines.map((line, index) => this.serializeWallLine(line, index, circles)),
    };
  }

  serializeWallCircle(circle, index) {
    return {
      id: `wall_circle_${index}`,
      left: circle.left,
      top: circle.top,
      radius: circle.radius,
      fill: circle.fill,
      stroke: circle.stroke,
      strokeWidth: circle.strokeWidth,
      strokeDashArray: circle.strokeDashArray,
      originX: circle.originX,
      originY: circle.originY,
      selectable: circle.selectable,
      evented: circle.evented,
      hasControls: circle.hasControls,
      hasBorders: circle.hasBorders,
      hoverCursor: circle.hoverCursor,
      isWallCircle: true,
      borderColor: circle.borderColor,
      deletable: circle.deletable,
    };
  }

  serializeWallLine(line, index, circles) {
    const startCircleIndex = this.findCircleIndex(circles, line.x1, line.y1);
    const endCircleIndex = this.findCircleIndex(circles, line.x2, line.y2);

    return {
      id: `wall_line_${index}`,
      x1: line.x1,
      y1: line.y1,
      x2: line.x2,
      y2: line.y2,
      stroke: line.stroke,
      strokeWidth: line.strokeWidth,
      selectable: line.selectable,
      evented: line.evented,
      hasControls: line.hasControls,
      hasBorders: line.hasBorders,
      lockMovementX: line.lockMovementX,
      lockMovementY: line.lockMovementY,
      perPixelTargetFind: line.perPixelTargetFind,
      borderColor: line.borderColor,
      startCircleIndex: startCircleIndex >= 0 ? startCircleIndex : null,
      endCircleIndex: endCircleIndex >= 0 ? endCircleIndex : null,
    };
  }

  findCircleIndex(circles, x, y) {
    return circles.findIndex((circle) => {
      const center = circle.getCenterPoint();
      return Math.abs(center.x - x) < 10 && Math.abs(center.y - y) < 10;
    });
  }

  // Optimized titleblock serialization
  serializeTitleBlocks() {
    const titleblocks = this.fabricCanvas.getObjects().filter((obj) => this.isTitleBlockObject(obj));

    return titleblocks.map((titleblock, index) => this.serializeTitleBlock(titleblock, index)).filter(Boolean);
  }

  serializeTitleBlock(titleblock, index) {
    try {
      const objects = titleblock.getObjects();
      const serializedObjects = objects.map((obj) => this.serializeTitleBlockObject(obj));

      return {
        id: `titleblock_${index}`,
        position: { left: titleblock.left, top: titleblock.top },
        transform: {
          scaleX: titleblock.scaleX || 1,
          scaleY: titleblock.scaleY || 1,
          angle: titleblock.angle || 0,
          originX: titleblock.originX,
          originY: titleblock.originY,
        },
        visual: this.serializeVisualProperties(titleblock),
        objects: serializedObjects,
        deviceType: "title-block",
      };
    } catch (error) {
      console.error("Error serializing titleblock:", error, titleblock);
      return null;
    }
  }

  serializeTitleBlockObject(obj) {
    const baseData = {
      type: obj.type,
      left: obj.left,
      top: obj.top,
      width: obj.width,
      height: obj.height,
      angle: obj.angle || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      originX: obj.originX,
      originY: obj.originY,
      visible: obj.visible !== false,
    };

    if (obj.type === "rect") {
      return {
        ...baseData,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
      };
    }

    if (obj.type === "textbox") {
      return {
        ...baseData,
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fill: obj.fill,
        textAlign: obj.textAlign,
        isHeader: obj.isHeader || false,
        isDateField: obj.isDateField || false,
        isClientName: obj.isClientName || false,
        isClientAddress: obj.isClientAddress || false,
        isReportTitle: obj.isReportTitle || false,
        isRev1: obj.isRev1 || false,
        isRev2: obj.isRev2 || false,
        isRev3: obj.isRev3 || false,
        isClientLogo: obj.isClientLogo || false,
        editable: obj.editable || false,
      };
    }

    if (obj.type === "image" && obj.isClientLogo) {
      return {
        ...baseData,
        src: obj._element ? obj._element.src : null,
        isClientLogo: true,
        containerBounds: obj.containerBounds,
      };
    }

    return baseData;
  }

  // Helper methods for common data extraction
  serializePolygonData(polygon) {
    return {
      points: polygon.points || [],
      fill: polygon.fill,
      stroke: polygon.stroke,
      strokeWidth: polygon.strokeWidth,
      left: polygon.left,
      top: polygon.top,
      scaleX: polygon.scaleX || 1,
      scaleY: polygon.scaleY || 1,
      angle: polygon.angle || 0,
      class: polygon.class,
      selectable: polygon.selectable,
      evented: polygon.evented,
      hasControls: polygon.hasControls,
      hasBorders: polygon.hasBorders,
      hoverCursor: polygon.hoverCursor,
      perPixelTargetFind: polygon.perPixelTargetFind,
    };
  }

  serializeTextObjectData(text) {
    return {
      text: text.text,
      left: text.left,
      top: text.top,
      fontSize: text.fontSize,
      fontFamily: text.fontFamily,
      fill: text.fill,
      class: text.class,
      selectable: text.selectable,
      evented: text.evented,
      editable: text.editable,
      hasControls: text.hasControls,
      hasBorders: text.hasBorders,
      hoverCursor: text.hoverCursor,
      originX: text.originX,
      originY: text.originY,
      cursorColor: text.cursorColor,
      offsetX: text.offsetX || 0,
      offsetY: text.offsetY || 0,
      displayHeight: text.displayHeight || 2.4,
      borderColor: text.borderColor,
      borderScaleFactor: text.borderScaleFactor,
      cornerSize: text.cornerSize,
      cornerColor: text.cornerColor,
      cornerStrokeColor: text.cornerStrokeColor,
      cornerStyle: text.cornerStyle,
      transparentCorners: text.transparentCorners,
      padding: text.padding,
      controlsVisibility: text.__controlsVisibility || {},
    };
  }

  serializeVisualProperties(obj) {
    return {
      selectable: obj.selectable !== false,
      hasControls: obj.hasControls || false,
      hasBorders: obj.hasBorders !== false,
      borderColor: obj.borderColor,
      borderScaleFactor: obj.borderScaleFactor,
      cornerSize: obj.cornerSize,
      cornerColor: obj.cornerColor,
      cornerStrokeColor: obj.cornerStrokeColor,
      cornerStyle: obj.cornerStyle,
      transparentCorners: obj.transparentCorners,
    };
  }

  getCanvasSettings() {
    return {
      pixelsPerMeter: this.fabricCanvas.pixelsPerMeter || 17.5,
      zoom: this.fabricCanvas.getZoom(),
      viewportTransform: [...this.fabricCanvas.viewportTransform],
    };
  }

  // Optimized loading methods would go here...
  // (Keeping the existing loadDrawingObjects method for now to maintain functionality)
  async loadDrawingObjects(serializedData) {
    try {
      if (serializedData.canvasSettings) {
        const { pixelsPerMeter, zoom, viewportTransform } = serializedData.canvasSettings;
        this.fabricCanvas.pixelsPerMeter = pixelsPerMeter || 17.5;
        if (zoom) this.fabricCanvas.setZoom(zoom);
        if (viewportTransform) this.fabricCanvas.setViewportTransform(viewportTransform);
      }

      if (serializedData.globalState) {
        window.zones = serializedData.globalState.zonesArray || [];
        window.rooms = serializedData.globalState.roomsArray || [];
      }

      const existingObjects = this.fabricCanvas.getObjects();
      const potentialConflicts = existingObjects.filter((obj) => (obj.type === "polygon" && obj.fill && obj.fill.includes("165, 155, 155")) || (obj.type === "circle" && obj.fill === "#f8794b" && !obj.isWallCircle && obj.radius < 30));

      if (potentialConflicts.length > 0) {
        potentialConflicts.forEach((obj) => this.fabricCanvas.remove(obj));
      }

      if (serializedData.drawingObjects?.length) {
        for (let i = 0; i < serializedData.drawingObjects.length; i++) {
          try {
            await this.loadDrawingObject(serializedData.drawingObjects[i]);
            if (i < serializedData.drawingObjects.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          } catch (error) {
            console.error(`Failed to load drawing object ${i + 1}:`, error);
          }
        }
      }

      if (serializedData.zones?.length) {
        await this.loadZones(serializedData.zones);
      }

      if (serializedData.rooms?.length) {
        await this.loadRooms(serializedData.rooms);
      }

      if (serializedData.walls && (serializedData.walls.circles?.length || serializedData.walls.lines?.length)) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await this.loadWalls(serializedData.walls);
      }

      if (serializedData.titleblocks?.length) {
        await this.loadTitleBlocks(serializedData.titleblocks);
      }

      this.fabricCanvas.requestRenderAll();

      setTimeout(() => {
        this.reinitializeDrawingTools();
      }, 300);

      return true;
    } catch (error) {
      console.error("Error loading drawing objects:", error);
      return false;
    }
  }

  // Load individual drawing object
  async loadDrawingObject(objectData) {
    return new Promise((resolve, reject) => {
      try {
        const duplicate = this.fabricCanvas.getObjects().find((obj) => obj.id === objectData.id || (obj.type === objectData.type && Math.abs(obj.left - objectData.position.left) < 1 && Math.abs(obj.top - objectData.position.top) < 1));

        if (duplicate) {
          this.applyStandardStyling(duplicate);
          return resolve(duplicate);
        }

        switch (objectData.drawingType) {
          case "circle":
            const circle = new fabric.Circle({
              ...objectData.position,
              ...objectData.transform,
              ...objectData.visual,
              ...objectData.properties,
              ...objectData.customProperties,
            });
            circle.id = objectData.id;
            this.applyStandardStyling(circle);
            this.fabricCanvas.add(circle);
            resolve(circle);
            break;

          case "rectangle":
            const rect = new fabric.Rect({
              ...objectData.position,
              ...objectData.transform,
              ...objectData.visual,
              ...objectData.properties,
              ...objectData.customProperties,
            });
            rect.id = objectData.id;
            this.applyStandardStyling(rect);
            this.fabricCanvas.add(rect);
            resolve(rect);
            break;

          case "text":
            // Respect original Fabric class to avoid accidental wrapping
            const TextClass = objectData.type === "textbox" ? fabric.Textbox : fabric.IText;
            const text = new TextClass(objectData.properties.text, {
              ...objectData.position,
              ...objectData.transform,
              ...objectData.visual,
              ...objectData.properties,
              ...objectData.customProperties,
            });
            text.id = objectData.id;
            this.applyStandardStyling(text);
            this.fabricCanvas.add(text);
            resolve(text);
            break;

          case "line":
            const line = new fabric.Line([objectData.properties.x1, objectData.properties.y1, objectData.properties.x2, objectData.properties.y2], {
              ...objectData.position,
              ...objectData.transform,
              ...objectData.visual,
              stroke: objectData.properties.stroke,
              strokeWidth: objectData.properties.strokeWidth,
              strokeDashArray: objectData.properties.strokeDashArray,
              ...objectData.customProperties,
            });
            line.id = objectData.id;
            this.applyStandardStyling(line, "line");
            this.fabricCanvas.add(line);
            resolve(line);
            break;

          case "triangle":
            const triangle = new fabric.Triangle({
              ...objectData.position,
              ...objectData.transform,
              ...objectData.visual,
              ...objectData.properties,
              ...objectData.customProperties,
            });
            triangle.id = objectData.id;
            this.applyStandardStyling(triangle);
            this.fabricCanvas.add(triangle);
            resolve(triangle);
            break;

          case "image":
            if (!objectData.properties.src) {
              return reject(new Error("No image source provided for image"));
            }
            fabric.Image.fromURL(
              objectData.properties.src,
              (img) => {
                if (!img) return reject(new Error(`Failed to load image: ${objectData.properties.src}`));
                img.set({
                  ...objectData.position,
                  ...objectData.transform,
                  ...objectData.visual,
                  width: objectData.properties.width,
                  height: objectData.properties.height,
                  ...objectData.customProperties,
                });
                img.id = objectData.id;
                this.applyStandardStyling(img);
                this.fabricCanvas.add(img);
                resolve(img);
              },
              { crossOrigin: "anonymous" }
            );
            break;

          case "arrow": {
            try {
              const { arrowData } = objectData;
              if (!arrowData) throw new Error("Missing arrowData");

              const line = new fabric.Line([arrowData.line.x1, arrowData.line.y1, arrowData.line.x2, arrowData.line.y2], {
                stroke: arrowData.line.stroke || "blue",
                strokeWidth: arrowData.line.strokeWidth || 2,
                strokeDashArray: arrowData.line.strokeDashArray || null,
                selectable: arrowData.line.selectable !== undefined ? arrowData.line.selectable : false,
                evented: arrowData.line.evented !== undefined ? arrowData.line.evented : false,
                hasControls: arrowData.line.hasControls !== undefined ? arrowData.line.hasControls : false,
                hasBorders: arrowData.line.hasBorders !== undefined ? arrowData.line.hasBorders : false,
              });

              // Use absolute position if available, otherwise fall back to original logic
              const triangleLeft = arrowData.triangle.absoluteLeft ?? arrowData.triangle.left ?? arrowData.endPoint.x;
              const triangleTop = arrowData.triangle.absoluteTop ?? arrowData.triangle.top ?? arrowData.endPoint.y;

              const triangle = new fabric.Triangle({
                left: triangleLeft,
                top: triangleTop,
                originX: arrowData.triangle.originX || "center",
                originY: arrowData.triangle.originY || "center",
                width: arrowData.triangle.width || 10,
                height: arrowData.triangle.height || 10,
                fill: arrowData.triangle.fill || arrowData.line.stroke || "blue",
                angle: arrowData.triangle.angle || 0,
                selectable: false,
                evented: false,
              });

              const group = new fabric.Group([line, triangle], {
                ...objectData.position,
                ...objectData.transform,
                ...objectData.visual,
                hasControls: false,
                borderColor: "#f8794b",
                cornerColor: "#f8794b",
              });
              group.isArrow = true;
              group.id = objectData.id;
              this.applyStandardStyling(group, false);
              group.set({ borderScaleFactor: 1 });
              this.fabricCanvas.add(group);
              resolve(group);
            } catch (err) {
              reject(err);
            }
            break;
          }

          case "uploadedImage":
            if (!objectData.properties.src) {
              return reject(new Error("No image source provided for uploaded image"));
            }

            fabric.Image.fromURL(
              objectData.properties.src,
              (img) => {
                if (!img) {
                  return reject(new Error(`Failed to load uploaded image: ${objectData.properties.src}`));
                }

                img.set({
                  ...objectData.position,
                  ...objectData.transform,
                  ...objectData.visual,
                  width: objectData.properties.width,
                  height: objectData.properties.height,
                  isUploadedImage: true,
                  ...objectData.customProperties,
                });

                if (objectData.lockState) {
                  img.set({
                    isLocked: objectData.lockState.isLocked,
                    lockMovementX: objectData.lockState.lockMovementX,
                    lockMovementY: objectData.lockState.lockMovementY,
                    lockRotation: objectData.lockState.lockRotation,
                    lockScalingX: objectData.lockState.lockScalingX,
                    lockScalingY: objectData.lockState.lockScalingY,
                  });
                }

                img.id = objectData.id;
                this.applyStandardStyling(img);
                this.fabricCanvas.add(img);
                resolve(img);
              },
              { crossOrigin: "anonymous" }
            );
            break;

          default:
            if (objectData.groupType === "measurement" && objectData.measurementData) {
              try {
                const line = new fabric.Line([objectData.measurementData.line.x1, objectData.measurementData.line.y1, objectData.measurementData.line.x2, objectData.measurementData.line.y2], {
                  stroke: objectData.measurementData.line.stroke || "purple",
                  strokeWidth: objectData.measurementData.line.strokeWidth || 3,
                  strokeDashArray: objectData.measurementData.line.strokeDashArray || null,
                  selectable: objectData.measurementData.line.selectable !== undefined ? objectData.measurementData.line.selectable : false,
                  evented: objectData.measurementData.line.evented !== undefined ? objectData.measurementData.line.evented : false,
                  hasControls: objectData.measurementData.line.hasControls !== undefined ? objectData.measurementData.line.hasControls : false,
                  hasBorders: objectData.measurementData.line.hasBorders !== undefined ? objectData.measurementData.line.hasBorders : false,
                });

                // Use absolute position if available, otherwise fall back to original
                const textLeft = objectData.measurementData.text.absoluteLeft ?? objectData.measurementData.text.left;
                const textTop = objectData.measurementData.text.absoluteTop ?? objectData.measurementData.text.top;

                const text = new fabric.IText(objectData.measurementData.text.text || "", {
                  left: textLeft,
                  top: textTop,
                  fontSize: objectData.measurementData.text.fontSize || 16,
                  fontFamily: objectData.measurementData.text.fontFamily || "Poppins, sans-serif",
                  fontWeight: objectData.measurementData.text.fontWeight,
                  fill: objectData.measurementData.text.fill || "#000000",
                  stroke: objectData.measurementData.text.stroke,
                  strokeWidth: objectData.measurementData.text.strokeWidth,
                  originX: objectData.measurementData.text.originX || "center",
                  originY: objectData.measurementData.text.originY || "center",
                  angle: objectData.measurementData.text.angle || 0,
                  selectable: objectData.measurementData.text.selectable !== undefined ? objectData.measurementData.text.selectable : false,
                  evented: objectData.measurementData.text.evented !== undefined ? objectData.measurementData.text.evented : false,
                });

                const group = new fabric.Group([line, text], {
                  ...objectData.position,
                  ...objectData.transform,
                  ...objectData.visual,
                  hasControls: false,
                });
                group.id = objectData.id;
                this.applyStandardStyling(group, false);
                group.set({ borderScaleFactor: 1 });
                this.fabricCanvas.add(group);
                resolve(group);
              } catch (err) {
                reject(err);
              }
              break;
            }

            if (objectData.groupType === "buildingFront" && objectData.buildingFrontData) {
              try {
                const tri = objectData.buildingFrontData.triangle;
                const txt = objectData.buildingFrontData.text;

                // Use absolute positions if available, otherwise fall back to original
                const triangleLeft = tri.absoluteLeft ?? tri.left;
                const triangleTop = tri.absoluteTop ?? tri.top;
                const textLeft = txt.absoluteLeft ?? txt.left;
                const textTop = txt.absoluteTop ?? txt.top;

                const triangle = new fabric.Triangle({
                  left: triangleLeft,
                  top: triangleTop,
                  width: tri.width || 30,
                  height: tri.height || 50,
                  fill: tri.fill || "grey",
                  originX: tri.originX || "center",
                  originY: tri.originY || "center",
                  angle: tri.angle || 0,
                  selectable: false,
                  evented: false,
                });

                const text = new fabric.Text(txt.text || "Front", {
                  left: textLeft,
                  top: textTop,
                  fontSize: txt.fontSize || 18,
                  fill: txt.fill || "black",
                  originX: txt.originX || "center",
                  originY: txt.originY || "center",
                  angle: txt.angle || 0,
                  selectable: false,
                  evented: false,
                });

                const group = new fabric.Group([triangle, text], {
                  ...objectData.position,
                  ...objectData.transform,
                  ...objectData.visual,
                });
                group.groupType = "buildingFront";
                group.isBuildingFront = true;
                group.id = objectData.id;
                this.applyStandardStyling(group);
                this.fabricCanvas.add(group);
                resolve(group);
              } catch (err) {
                reject(err);
              }
              break;
            }

            fabric.util.enlivenObjects([objectData.fabricObject], (objects) => {
              if (objects && objects[0]) {
                const obj = objects[0];
                obj.id = objectData.id;
                this.applyStandardStyling(obj);
                this.fabricCanvas.add(obj);
                resolve(obj);
              } else {
                reject(new Error("Failed to create generic object"));
              }
            });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Load zones
  async loadZones(zonesData) {
    if (window.zones && window.zones.length > 0) {
      const existingZones = [...window.zones];
      existingZones.forEach((zone) => {
        if (zone.polygon && this.fabricCanvas.getObjects().includes(zone.polygon)) {
          zone.polygon.off();
          this.fabricCanvas.remove(zone.polygon);
        }
        if (zone.text && this.fabricCanvas.getObjects().includes(zone.text)) {
          zone.text.off();
          this.fabricCanvas.remove(zone.text);
        }
      });
    }

    window.zones = [];

    for (const zoneData of zonesData) {
      try {
        const polygon = new fabric.Polygon(zoneData.polygon.points, {
          ...zoneData.polygon,
          zoneName: zoneData.zoneName,
          zoneNotes: zoneData.zoneNotes,
          area: zoneData.area,
          height: zoneData.height,
          volume: zoneData.volume,
        });

        const text = new fabric.IText(zoneData.text.text, {
          ...zoneData.text,
        });

        polygon.associatedText = text;
        text.associatedPolygon = polygon;

        this.fabricCanvas.add(polygon);
        this.fabricCanvas.add(text);

        window.zones.push({ polygon, text });

        this.addZoneEventHandlers(polygon, text);

        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error("Failed to load zone:", error, zoneData);
      }
    }

    setTimeout(() => {
      if (window.maintainZoneLayerOrder) {
        window.maintainZoneLayerOrder();
      }
    }, 100);
  }

  // Load rooms
  async loadRooms(roomsData) {
    if (window.rooms && window.rooms.length > 0) {
      const existingRooms = [...window.rooms];
      existingRooms.forEach((room) => {
        if (room.polygon && this.fabricCanvas.getObjects().includes(room.polygon)) {
          room.polygon.off();
          this.fabricCanvas.remove(room.polygon);
        }
        if (room.text && this.fabricCanvas.getObjects().includes(room.text)) {
          room.text.off();
          this.fabricCanvas.remove(room.text);
        }
      });
    }

    window.rooms = [];

    for (const roomData of roomsData) {
      try {
        const polygon = new fabric.Polygon(roomData.polygon.points, {
          ...roomData.polygon,
          roomName: roomData.roomName,
          roomNotes: roomData.roomNotes,
          area: roomData.area,
          height: roomData.height,
          volume: roomData.volume,
        });

        const text = new fabric.IText(roomData.text.text, {
          ...roomData.text,
        });

        polygon.associatedText = text;
        text.associatedPolygon = polygon;

        this.fabricCanvas.add(polygon);
        this.fabricCanvas.add(text);

        const room = {
          polygon,
          text,
          roomName: roomData.roomName,
          roomNotes: roomData.roomNotes,
          roomColor: roomData.roomColor,
          area: roomData.area,
          height: roomData.height,
          volume: roomData.volume,
          devices: roomData.devices || [],
        };

        window.rooms.push(room);

        this.addRoomEventHandlers(polygon, text);

        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error("Failed to load room:", error, roomData);
      }
    }

    setTimeout(() => {
      if (window.maintainRoomLayerOrder) {
        window.maintainRoomLayerOrder();
      }
    }, 100);
  }

  // Load walls
  async loadWalls(wallsData) {
    if (!wallsData || !wallsData.circles || !wallsData.lines) {
      return;
    }

    const { circles: circleData, lines: lineData } = wallsData;
    const loadedCircles = [];

    const existingWallObjects = this.fabricCanvas.getObjects().filter((obj) => (obj.type === "circle" && obj.isWallCircle) || (obj.type === "line" && !obj.deviceType && !obj.isResizeIcon));

    if (existingWallObjects.length > 0) {
      existingWallObjects.forEach((obj) => {
        if (obj._wallUpdateHandler) {
          obj.off("moving", obj._wallUpdateHandler);
        }
        this.fabricCanvas.remove(obj);
      });
    }

    for (let i = 0; i < circleData.length; i++) {
      try {
        const circleInfo = circleData[i];
        const circle = new fabric.Circle({
          left: circleInfo.left,
          top: circleInfo.top,
          radius: circleInfo.radius || 3,
          fill: circleInfo.fill || "black",
          stroke: circleInfo.stroke,
          strokeWidth: circleInfo.strokeWidth || 0,
          strokeDashArray: circleInfo.strokeDashArray,
          originX: circleInfo.originX || "center",
          originY: circleInfo.originY || "center",
          selectable: circleInfo.selectable !== false,
          evented: circleInfo.evented !== false,
          hasControls: circleInfo.hasControls || false,
          hasBorders: circleInfo.hasBorders || false,
          borderColor: circleInfo.borderColor || "#f8794b",
          hoverCursor: "pointer",
          moveCursor: "move",
          isWallCircle: true,
          deletable: circleInfo.deletable !== undefined ? circleInfo.deletable : false,
        });

        circle._wallUpdateHandler = () => this.updateConnectedWallLines(circle);
        circle.on("moving", circle._wallUpdateHandler);

        this.fabricCanvas.add(circle);
        loadedCircles.push(circle);
      } catch (error) {
        console.error("Failed to load wall circle:", error, circleData[i]);
        loadedCircles.push(null);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const loadedLines = [];
    for (let j = 0; j < lineData.length; j++) {
      try {
        const lineInfo = lineData[j];
        const line = new fabric.Line([lineInfo.x1, lineInfo.y1, lineInfo.x2, lineInfo.y2], {
          stroke: lineInfo.stroke || "red",
          strokeWidth: lineInfo.strokeWidth || 2,
          selectable: lineInfo.selectable !== false,
          evented: lineInfo.evented !== false,
          hasControls: lineInfo.hasControls || false,
          hasBorders: lineInfo.hasBorders !== false,
          lockMovementX: lineInfo.lockMovementX !== false,
          lockMovementY: lineInfo.lockMovementY !== false,
          perPixelTargetFind: lineInfo.perPixelTargetFind !== false,
          borderColor: lineInfo.borderColor || "#f8794b",
        });

        if (lineInfo.startCircleIndex !== null && lineInfo.startCircleIndex >= 0 && loadedCircles[lineInfo.startCircleIndex]) {
          line.startCircle = loadedCircles[lineInfo.startCircleIndex];
        }
        if (lineInfo.endCircleIndex !== null && lineInfo.endCircleIndex >= 0 && loadedCircles[lineInfo.endCircleIndex]) {
          line.endCircle = loadedCircles[lineInfo.endCircleIndex];
        }

        line.on("removed", () => {
          this.handleWallLineDeletion(line);
        });

        this.fabricCanvas.add(line);
        loadedLines.push(line);
      } catch (error) {
        console.error("Failed to load wall line:", error, lineInfo);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    this.organizeWallLayers();

    setTimeout(() => {
      this.ensureCameraResizeIconsOnTop();
      this.fabricCanvas.requestRenderAll();
    }, 200);
  }

  // Load titleblocks
  async loadTitleBlocks(titleblocksData) {
    for (const titleblockData of titleblocksData) {
      try {
        const objects = [];

        for (const objData of titleblockData.objects) {
          if (objData.type === "rect") {
            const rect = new fabric.Rect({
              left: objData.left,
              top: objData.top,
              width: objData.width,
              height: objData.height,
              fill: objData.fill,
              stroke: objData.stroke,
              strokeWidth: objData.strokeWidth,
              angle: objData.angle,
              scaleX: objData.scaleX,
              scaleY: objData.scaleY,
              originX: objData.originX,
              originY: objData.originY,
              visible: objData.visible,
            });
            objects.push(rect);
          } else if (objData.type === "textbox") {
            const textbox = new fabric.Textbox(objData.text, {
              left: objData.left,
              top: objData.top,
              width: objData.width,
              height: objData.height,
              fontSize: objData.fontSize,
              fontFamily: objData.fontFamily,
              fill: objData.fill,
              textAlign: objData.textAlign,
              angle: objData.angle,
              scaleX: objData.scaleX,
              scaleY: objData.scaleY,
              originX: objData.originX,
              originY: objData.originY,
              visible: objData.visible,
              isHeader: objData.isHeader,
              isDateField: objData.isDateField,
              isClientName: objData.isClientName,
              isClientAddress: objData.isClientAddress,
              isReportTitle: objData.isReportTitle,
              isRev1: objData.isRev1,
              isRev2: objData.isRev2,
              isRev3: objData.isRev3,
              isClientLogo: objData.isClientLogo,
              editable: objData.editable,
            });
            objects.push(textbox);
          } else if (objData.type === "image" && objData.isClientLogo && objData.src) {
            await new Promise((resolve, reject) => {
              fabric.Image.fromURL(
                objData.src,
                (img) => {
                  if (img) {
                    img.set({
                      left: objData.left,
                      top: objData.top,
                      width: objData.width,
                      height: objData.height,
                      scaleX: objData.scaleX,
                      scaleY: objData.scaleY,
                      angle: objData.angle,
                      originX: objData.originX,
                      originY: objData.originY,
                      visible: objData.visible,
                      isClientLogo: true,
                      containerBounds: objData.containerBounds,
                    });
                    objects.push(img);
                    resolve();
                  } else {
                    reject(new Error("Failed to load client logo"));
                  }
                },
                { crossOrigin: "anonymous" }
              );
            });
          }
        }

        const titleblockGroup = new fabric.Group(objects, {
          left: titleblockData.position.left,
          top: titleblockData.position.top,
          scaleX: titleblockData.transform.scaleX,
          scaleY: titleblockData.transform.scaleY,
          angle: titleblockData.transform.angle,
          originX: titleblockData.transform.originX,
          originY: titleblockData.transform.originY,
          selectable: titleblockData.visual.selectable,
          hasControls: titleblockData.visual.hasControls,
          hasBorders: titleblockData.visual.hasBorders,
          deviceType: "title-block",
          cursorColor: "#f8794b",
          borderColor: titleblockData.visual.borderColor || "#f8794b",
          borderScaleFactor: titleblockData.visual.borderScaleFactor || 2,
          cornerSize: titleblockData.visual.cornerSize || 8,
          cornerColor: titleblockData.visual.cornerColor || "#f8794b",
          cornerStrokeColor: titleblockData.visual.cornerStrokeColor || "#000000",
          cornerStyle: titleblockData.visual.cornerStyle || "circle",
          transparentCorners: titleblockData.visual.transparentCorners || false,
        });

        titleblockGroup.id = titleblockData.id;
        this.fabricCanvas.add(titleblockGroup);

        if (window.activeTitleBlocks && Array.isArray(window.activeTitleBlocks)) {
          window.activeTitleBlocks.push(titleblockGroup);
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error("Failed to load titleblock:", error, titleblockData);
      }
    }
  }

  // Helper methods for wall management
  updateConnectedWallLines(movedCircle) {
    const center = movedCircle.getCenterPoint();
    const lines = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && !obj.deviceType && !obj.isResizeIcon);

    lines.forEach((line) => {
      let updated = false;
      if (line.startCircle === movedCircle) {
        line.set({ x1: center.x, y1: center.y });
        line.setCoords();
        updated = true;
      }
      if (line.endCircle === movedCircle) {
        line.set({ x2: center.x, y2: center.y });
        line.setCoords();
        updated = true;
      }

      if (updated) {
        const backgroundObjects = this.fabricCanvas.getObjects().filter((obj) => obj.isBackground);
        if (backgroundObjects.length > 0) {
          line.moveTo(backgroundObjects.length);
        }
      }
    });

    movedCircle.bringToFront();
    this.fabricCanvas.requestRenderAll();
  }

  handleWallLineDeletion(deletedLine) {
    const remainingLines = this.fabricCanvas.getObjects().filter((obj) => obj.type === "line" && !obj.deviceType && !obj.isResizeIcon && obj !== deletedLine);

    const circlesToCheck = [];
    if (deletedLine.startCircle) circlesToCheck.push(deletedLine.startCircle);
    if (deletedLine.endCircle) circlesToCheck.push(deletedLine.endCircle);

    circlesToCheck.forEach((circle) => {
      if (!circle || !this.fabricCanvas.getObjects().includes(circle)) return;

      const isStillConnected = remainingLines.some((line) => line.startCircle === circle || line.endCircle === circle);

      if (!isStillConnected) {
        this.fabricCanvas.remove(circle);
      }
    });

    this.fabricCanvas.getObjects("group").forEach((obj) => {
      if (obj.coverageConfig && obj.createOrUpdateCoverageArea) {
        obj.createOrUpdateCoverageArea();
      }
    });

    this.fabricCanvas.renderAll();
  }

  organizeWallLayers() {
    // Placeholder for layer organization logic
  }

  ensureCameraResizeIconsOnTop() {
    // Placeholder for camera icon management logic
  }

  // Event handlers for zones and rooms
  addZoneEventHandlers(polygon, text) {
    polygon.off();
    text.off();

    setTimeout(() => {
      if (polygon && this.fabricCanvas.getObjects().includes(polygon)) {
        polygon.originalCenter = polygon.getCenterPoint();
      }
    }, 100);

    const polygonMovingHandler = () => {
      if (!polygon || !this.fabricCanvas.getObjects().includes(polygon)) return;
      if (text && this.fabricCanvas.getObjects().includes(text)) {
        const newCenter = polygon.getCenterPoint();
        text.set({
          left: newCenter.x + (text.offsetX || 0),
          top: newCenter.y + (text.offsetY || 0),
        });
        text.setCoords();
      }
      this.fabricCanvas.requestRenderAll();
    };

    const textMovingHandler = () => {
      if (!text || !polygon || !this.fabricCanvas.getObjects().includes(text) || !this.fabricCanvas.getObjects().includes(polygon)) return;
      const polygonCenter = polygon.getCenterPoint();
      text.offsetX = text.left - polygonCenter.x;
      text.offsetY = text.top - polygonCenter.y;
      text.setCoords();
      this.fabricCanvas.requestRenderAll();
    };

    const showProperties = () => {
      if (window.showDeviceProperties) {
        window.showDeviceProperties("zone-polygon", text, polygon, polygon.height);
      }
    };

    const hideProperties = () => {
      if (window.hideDeviceProperties) {
        window.hideDeviceProperties();
      }
    };

    const polygonMouseDownHandler = (e) => {
      const pointer = this.fabricCanvas.getPointer(e.e);
      polygon.set("evented", false);
      const devicesUnderneath = this.fabricCanvas.getObjects().filter((obj) => obj !== polygon && obj !== text && obj.type === "group" && obj.deviceType && obj.containsPoint(pointer));
      polygon.set("evented", true);

      e.e.preventDefault();
      e.e.stopPropagation();
      this.fabricCanvas.setActiveObject(devicesUnderneath.length > 0 ? devicesUnderneath[0] : text);
      this.fabricCanvas.requestRenderAll();
    };

    polygon.on("moving", polygonMovingHandler);
    polygon.on("moved", () => {
      setTimeout(() => {
        if (window.maintainZoneLayerOrder) {
          window.maintainZoneLayerOrder();
        }
      }, 10);
    });
    polygon.on("selected", () => {
      showProperties();
      this.fabricCanvas.requestRenderAll();
    });
    polygon.on("deselected", hideProperties);
    polygon.on("mousedown", polygonMouseDownHandler);

    text.on("moving", textMovingHandler);
    text.on("selected", () => {
      showProperties();
      this.fabricCanvas.requestRenderAll();
    });
    text.on("deselected", hideProperties);
  }

  addRoomEventHandlers(polygon, text) {
    polygon.off();
    text.off();

    setTimeout(() => {
      if (polygon && this.fabricCanvas.getObjects().includes(polygon)) {
        polygon.originalCenter = polygon.getCenterPoint();
      }
    }, 100);

    const polygonMovingHandler = () => {
      if (!polygon || !this.fabricCanvas.getObjects().includes(polygon)) return;

      if (polygon.originalCenter) {
        const ROOM_SNAP_THRESHOLD = 25;
        const currentCenter = polygon.getCenterPoint();

        if (this.calculateDistance(currentCenter, polygon.originalCenter) <= ROOM_SNAP_THRESHOLD) {
          const deltaX = polygon.originalCenter.x - currentCenter.x;
          const deltaY = polygon.originalCenter.y - currentCenter.y;

          polygon.set({
            left: polygon.left + deltaX,
            top: polygon.top + deltaY,
          });
          polygon.setCoords();
        }
      }

      if (text && this.fabricCanvas.getObjects().includes(text)) {
        const newCenter = polygon.getCenterPoint();
        text.set({
          left: newCenter.x + (text.offsetX || 0),
          top: newCenter.y + (text.offsetY || 0),
        });
        text.setCoords();
      }
      this.fabricCanvas.requestRenderAll();
    };

    const textMovingHandler = () => {
      if (!text || !polygon || !this.fabricCanvas.getObjects().includes(text) || !this.fabricCanvas.getObjects().includes(polygon)) return;
      const polygonCenter = polygon.getCenterPoint();
      text.offsetX = text.left - polygonCenter.x;
      text.offsetY = text.top - polygonCenter.y;
      text.setCoords();
      this.fabricCanvas.requestRenderAll();
    };

    const showProperties = () => {
      const room = window.rooms.find((r) => r.polygon === polygon);
      if (room && window.showRoomProperties) {
        window.showRoomProperties(polygon, text, room);
      }
    };

    const hideProperties = () => {
      if (window.hideDeviceProperties) {
        window.hideDeviceProperties();
      }
    };

    const polygonMouseDownHandler = (e) => {
      const pointer = this.fabricCanvas.getPointer(e.e);
      polygon.set("evented", false);
      const devicesUnderneath = this.fabricCanvas.getObjects().filter((obj) => obj !== polygon && obj !== text && obj.type === "group" && obj.deviceType && obj.containsPoint(pointer));
      polygon.set("evented", true);

      e.e.preventDefault();
      e.e.stopPropagation();
      this.fabricCanvas.setActiveObject(devicesUnderneath.length > 0 ? devicesUnderneath[0] : polygon);
      this.fabricCanvas.requestRenderAll();
    };

    polygon.on("moving", polygonMovingHandler);
    polygon.on("moved", () => {
      setTimeout(() => {
        if (window.maintainRoomLayerOrder) {
          window.maintainRoomLayerOrder();
        }
      }, 10);
    });
    polygon.on("selected", () => {
      showProperties();
      this.fabricCanvas.requestRenderAll();
    });
    polygon.on("deselected", hideProperties);
    polygon.on("mousedown", polygonMouseDownHandler);

    text.on("moving", textMovingHandler);
    text.on("selected", () => {
      showProperties();
      this.fabricCanvas.requestRenderAll();
    });
    text.on("deselected", hideProperties);
  }

  calculateDistance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  reinitializeDrawingTools() {
    if (typeof setupShapeTools === "function") setupShapeTools(this.fabricCanvas);
    if (typeof setupTextTools === "function") setupTextTools(this.fabricCanvas);
    if (typeof setupLineTools === "function") setupLineTools(this.fabricCanvas);
    if (typeof setupMeasurementTools === "function") setupMeasurementTools(this.fabricCanvas);
    if (typeof setupImageUploadTool === "function") setupImageUploadTool(this.fabricCanvas);
    if (typeof setupNorthArrowTool === "function") setupNorthArrowTool(this.fabricCanvas);
    if (typeof setupColorPicker === "function") setupColorPicker(this.fabricCanvas);
    if (typeof setupTitleBlockTool === "function") setupTitleBlockTool(this.fabricCanvas);

    if (typeof setupDeletion === "function") {
      setupDeletion(this.fabricCanvas, (obj) => this.isDrawingObject(obj));

      this.fabricCanvas.getObjects().forEach((obj) => {
        if (this.isDrawingObject(obj)) {
          if (!obj.borderColor || obj.borderColor !== "#f8794b") {
            this.applyStandardStyling(obj);
          }

          const shouldHaveControls = !(obj.type === "group" && (obj.isArrow || obj.groupType === "measurement"));

          obj.set({
            selectable: true,
            evented: true,
            hasControls: shouldHaveControls,
            hasBorders: true,
          });
        }
      });
    }

    if (window.setupZoneTool) {
      try {
        window.setupZoneTool(this.fabricCanvas);
      } catch (error) {
        console.warn("Could not reinitialize zone tool:", error);
      }
    }

    if (window.setupRoomTool) {
      try {
        window.setupRoomTool(this.fabricCanvas);
      } catch (error) {
        console.warn("Could not reinitialize room tool:", error);
      }
    }

    if (window.setupWallTool) {
      try {
        window.setupWallTool(this.fabricCanvas);
      } catch (error) {
        console.warn("Could not reinitialize wall tool:", error);
      }
    }

    this.fabricCanvas.requestRenderAll();

    setTimeout(() => {
      const wallCircles = this.fabricCanvas.getObjects().filter((obj) => obj.type === "circle" && obj.isWallCircle);

      wallCircles.forEach((circle) => {
        circle.set({
          selectable: true,
          evented: true,
          hoverCursor: "pointer",
          moveCursor: "move",
        });
        circle.bringToFront();

        if (!circle._wallUpdateHandler) {
          circle._wallUpdateHandler = () => this.updateConnectedWallLines(circle);
          circle.on("moving", circle._wallUpdateHandler);
        }
      });

      if (window.maintainZoneLayerOrder) {
        window.maintainZoneLayerOrder();
      }

      if (window.maintainRoomLayerOrder) {
        window.maintainRoomLayerOrder();
      }

      this.fabricCanvas.requestRenderAll();
    }, 200);
  }
}

export { OptimizedDrawingObjectSerializer as DrawingObjectSerializer };
