class AnnotationLayer {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.canvas = document.getElementById('annotation-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.currentPage = 1;
    this.pageAnnotations = {};
    this.currentTool = 'select';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;

    this.strokeColor = '#ff0000';
    this.strokeWidth = 3;
    this.fillColor = '#ffff00';
    this.brushSize = 3;
    this.fontFamily = 'Inter';
    this.fontSize = 16;
    this.fontBold = false;
    this.fontItalic = false;
    this.fontUnderline = false;
    this.shapeType = 'rect';

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 50;

    this.objects = [];
    this.selectedObject = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentPath = null;

    this.setupCanvasEvents();
  }

  init(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.renderAll();
  }

  syncCanvasSize(displayW, displayH, realW, realH) {
    this.canvas.width = realW || displayW;
    this.canvas.height = realH || displayH;
    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';
    this.scaleX = (realW || displayW) / displayW;
    this.scaleY = (realH || displayH) / displayH;
  }

  setupCanvasEvents() {
    var self = this;
    this.canvas.addEventListener('mousedown', function(e) { self.onMouseDown(e); });
    this.canvas.addEventListener('mousemove', function(e) { self.onMouseMove(e); });
    this.canvas.addEventListener('mouseup', function(e) { self.onMouseUp(e); });
    this.canvas.addEventListener('dblclick', function(e) { self.onDoubleClick(e); });
  }

  getMousePos(e) {
    var rect = this.canvas.getBoundingClientRect();
    var sx = this.scaleX || 1;
    var sy = this.scaleY || 1;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy
    };
  }

  onMouseDown(e) {
    if (window.app && window.app.textEditMode && window.app.textEditMode.active) return;
    var pos = this.getMousePos(e);

    switch (this.currentTool) {
      case 'select':
        this.startDrag(pos);
        break;
      case 'text':
        this.addText(pos);
        break;
      case 'draw':
        this.startDrawing(pos);
        break;
      case 'shapes':
        this.startShape(pos);
        break;
      case 'highlight':
        this.startHighlight(pos);
        break;
      case 'eraser':
        this.eraseAt(pos);
        break;
    }
  }

  onMouseMove(e) {
    if (window.app && window.app.textEditMode && window.app.textEditMode.active) return;
    var pos = this.getMousePos(e);

    if (this.currentTool === 'select' && this.isDragging) {
      this.doDrag(pos);
    } else if (this.currentTool === 'draw' && this.isDrawing) {
      this.continueDrawing(pos);
    } else if (this.currentTool === 'shapes' && this.isDrawing) {
      this.previewShape(pos);
    } else if (this.currentTool === 'highlight' && this.isDrawing) {
      this.continueHighlight(pos);
    } else if (this.currentTool === 'eraser' && this.isDrawing) {
      this.eraseAt(pos);
    }
  }

  onMouseUp(e) {
    var pos = this.getMousePos(e);

    if (this.currentTool === 'select') {
      this.endDrag();
    } else if (this.currentTool === 'draw') {
      this.endDrawing();
    } else if (this.currentTool === 'shapes') {
      this.endShape(pos);
    } else if (this.currentTool === 'highlight') {
      this.endHighlight();
    }
  }

  onDoubleClick(e) {
    if (this.currentTool === 'select') {
      var pos = this.getMousePos(e);
      var obj = this.getObjectAt(pos);
      if (obj && obj.type === 'textbox') {
        obj.enterEditing();
        obj.selectAll();
      }
    }
  }

  // Selection & Drag
  startDrag(pos) {
    var obj = this.getObjectAt(pos);
    this.deselectAll();

    if (obj) {
      this.selectedObject = obj;
      this.isDragging = true;
      this.dragOffset = { x: pos.x - obj.left, y: pos.y - obj.top };
      this.canvas.style.cursor = 'move';
    }
  }

  doDrag(pos) {
    if (!this.selectedObject) return;
    this.selectedObject.set({
      left: pos.x - this.dragOffset.x,
      top: pos.y - this.dragOffset.y
    });
    this.renderAll();
  }

  endDrag() {
    this.isDragging = false;
    this.canvas.style.cursor = this.getCursor();
    if (this.selectedObject) {
      this.saveState();
    }
  }

  getObjectAt(pos) {
    for (var i = this.objects.length - 1; i >= 0; i--) {
      var obj = this.objects[i];
      var bounds;
      if (obj.getBoundingRect) {
        bounds = obj.getBoundingRect();
      } else {
        bounds = { left: obj.left || 0, top: obj.top || 0, width: obj.width || 100, height: obj.height || 50 };
      }
      if (pos.x >= bounds.left && pos.x <= bounds.left + (bounds.width || 100) &&
          pos.y >= bounds.top && pos.y <= bounds.top + (bounds.height || 50)) {
        return obj;
      }
    }
    return null;
  }

  // Text tool
  addText(pos) {
    var text = new fabric.Textbox('Escribe aqui', {
      left: pos.x,
      top: pos.y,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.strokeColor,
      fontWeight: this.fontBold ? 'bold' : 'normal',
      fontStyle: this.fontItalic ? 'italic' : 'normal',
      underline: this.fontUnderline,
      width: 200,
      editable: true
    });

    this.objects.push(text);
    this.renderAll();
    this.saveState();
  }

  addTextWithContent(pos, content) {
    var text = new fabric.Textbox(content || '', {
      left: pos.x,
      top: pos.y,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.strokeColor,
      fontWeight: this.fontBold ? 'bold' : 'normal',
      fontStyle: this.fontItalic ? 'italic' : 'normal',
      underline: this.fontUnderline,
      width: 200,
      editable: true
    });

    this.objects.push(text);
    this.renderAll();
    this.saveState();
  }

  // Drawing (freehand)
  startDrawing(pos) {
    this.isDrawing = true;
    this.currentPath = [{ x: pos.x, y: pos.y, type: 'M' }];
  }

  continueDrawing(pos) {
    this.currentPath.push({ x: pos.x, y: pos.y, type: 'L' });
    this.renderAll();
    this.drawTempPath();
  }

  drawTempPath() {
    this.ctx.save();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    for (var i = 0; i < this.currentPath.length; i++) {
      var pt = this.currentPath[i];
      if (pt.type === 'M') {
        this.ctx.moveTo(pt.x, pt.y);
      } else {
        this.ctx.lineTo(pt.x, pt.y);
      }
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  endDrawing() {
    if (!this.isDrawing || !this.currentPath) return;
    this.isDrawing = false;

    if (this.currentPath.length > 1) {
      var pathData = 'M ' + this.currentPath[0].x + ' ' + this.currentPath[0].y;
      for (var i = 1; i < this.currentPath.length; i++) {
        pathData += ' L ' + this.currentPath[i].x + ' ' + this.currentPath[i].y;
      }

      var path = new fabric.Path(pathData, {
        stroke: this.strokeColor,
        strokeWidth: this.brushSize,
        fill: 'transparent',
        selectable: true,
        objectCaching: false
      });

      this.objects.push(path);
      this.saveState();
    }

    this.currentPath = null;
    this.renderAll();
  }

  // Shapes
  startShape(pos) {
    this.isDrawing = true;
    this.startX = pos.x;
    this.startY = pos.y;
  }

  previewShape(pos) {
    this.renderAll();
    this.ctx.save();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.setLineDash([5, 5]);

    var x = Math.min(this.startX, pos.x);
    var y = Math.min(this.startY, pos.y);
    var w = Math.abs(pos.x - this.startX);
    var h = Math.abs(pos.y - this.startY);

    this.drawShapePreview(this.ctx, x, y, w, h, pos);
    this.ctx.restore();
  }

  drawShapePreview(ctx, x, y, w, h, endPos) {
    switch (this.shapeType) {
      case 'rect':
        ctx.strokeRect(x, y, w, h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
        break;
      case 'arrow':
        this.drawArrow(ctx, this.startX, this.startY, endPos.x, endPos.y);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.stroke();
        break;
    }
  }

  drawArrow(ctx, fromX, fromY, toX, toY) {
    var headLength = 15;
    var angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  endShape(pos) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    var x = Math.min(this.startX, pos.x);
    var y = Math.min(this.startY, pos.y);
    var w = Math.abs(pos.x - this.startX);
    var h = Math.abs(pos.y - this.startY);

    if (w < 5 && h < 5) {
      this.renderAll();
      return;
    }

    var fabricObj;

    switch (this.shapeType) {
      case 'rect':
        fabricObj = new fabric.Rect({
          left: x, top: y, width: w, height: h,
          stroke: this.strokeColor, strokeWidth: this.strokeWidth,
          fill: this.fillColor + '33', selectable: true
        });
        break;
      case 'circle':
        fabricObj = new fabric.Ellipse({
          left: x, top: y, rx: w / 2, ry: h / 2,
          stroke: this.strokeColor, strokeWidth: this.strokeWidth,
          fill: this.fillColor + '33', selectable: true
        });
        break;
      case 'line':
        fabricObj = new fabric.Line([this.startX, this.startY, pos.x, pos.y], {
          stroke: this.strokeColor, strokeWidth: this.strokeWidth,
          selectable: true
        });
        break;
      case 'arrow':
        fabricObj = this.createArrowObject(this.startX, this.startY, pos.x, pos.y);
        break;
      case 'triangle':
        fabricObj = new fabric.Triangle({
          left: x, top: y, width: w, height: h,
          stroke: this.strokeColor, strokeWidth: this.strokeWidth,
          fill: this.fillColor + '33', selectable: true
        });
        break;
    }

    if (fabricObj) {
      this.objects.push(fabricObj);
      this.saveState();
    }

    this.renderAll();
  }

  createArrowObject(fromX, fromY, toX, toY) {
    var headLength = 15;
    var angle = Math.atan2(toY - fromY, toX - fromX);

    var line = new fabric.Line([fromX, fromY, toX, toY], {
      stroke: this.strokeColor, strokeWidth: this.strokeWidth
    });

    var head1 = new fabric.Line([
      toX, toY,
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    ], { stroke: this.strokeColor, strokeWidth: this.strokeWidth });

    var head2 = new fabric.Line([
      toX, toY,
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    ], { stroke: this.strokeColor, strokeWidth: this.strokeWidth });

    return new fabric.Group([line, head1, head2], { selectable: true });
  }

  // Highlight
  startHighlight(pos) {
    this.isDrawing = true;
    this.startX = pos.x;
    this.startY = pos.y;
  }

  continueHighlight(pos) {
    this.renderAll();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    var x = Math.min(this.startX, pos.x);
    var y = Math.min(this.startY, pos.y);
    var w = Math.abs(pos.x - this.startX);
    var h = Math.abs(pos.y - this.startY);
    this.ctx.fillRect(x, y, w, h);
    this.ctx.restore();
  }

  endHighlight() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.renderAll();
  }

  // Image
  addImage(dataUrl) {
    var self = this;
    fabric.Image.fromURL(dataUrl, function(img) {
      var maxSize = Math.min(self.canvas.width, self.canvas.height) * 0.4;
      if (img.width > maxSize || img.height > maxSize) {
        var scale = maxSize / Math.max(img.width, img.height);
        img.scale(scale);
      }

      img.set({
        left: self.canvas.width / 2 - img.getScaledWidth() / 2,
        top: self.canvas.height / 2 - img.getScaledHeight() / 2
      });

      self.objects.push(img);
      self.renderAll();
      self.saveState();
    });
  }

  addSignatureImage(dataUrl) {
    var self = this;
    fabric.Image.fromURL(dataUrl, function(img) {
      var maxSize = self.canvas.width * 0.3;
      if (img.width > maxSize || img.height > maxSize) {
        var scale = maxSize / Math.max(img.width, img.height);
        img.scale(scale);
      }

      img.set({
        left: self.canvas.width / 2 - img.getScaledWidth() / 2,
        top: self.canvas.height * 0.7
      });

      self.objects.push(img);
      self.renderAll();
      self.saveState();
    });
  }

  // Eraser
  eraseAt(pos) {
    var obj = this.getObjectAt(pos);
    if (obj) {
      this.objects = this.objects.filter(function(o) { return o !== obj; });
      this.renderAll();
      this.saveState();
    }
  }

  // Selection helpers
  deselectAll() {
    this.selectedObject = null;
    this.isDragging = false;
    this.canvas.style.cursor = this.getCursor();
    this.renderAll();
  }

  selectAll() {
    if (this.objects.length > 0) {
      this.selectedObject = this.objects[this.objects.length - 1];
      this.renderAll();
    }
  }

  deleteSelected() {
    if (this.selectedObject) {
      this.objects = this.objects.filter(function(o) { return o !== this.selectedObject; }.bind(this));
      this.selectedObject = null;
      this.renderAll();
      this.saveState();
    }
  }

  // Tool setters
  setTool(tool) {
    this.currentTool = tool;
    this.deselectAll();
    this.canvas.style.cursor = this.getCursor();
  }

  getCursor() {
    switch (this.currentTool) {
      case 'select': return 'default';
      case 'text': return 'text';
      case 'draw': return 'crosshair';
      case 'shapes': return 'crosshair';
      case 'highlight': return 'crosshair';
      case 'eraser': return 'pointer';
      default: return 'default';
    }
  }

  // Properties
  setStrokeColor(color) { this.strokeColor = color; }
  setStrokeWidth(width) { this.strokeWidth = width; }
  setFillColor(color) { this.fillColor = color; }
  setBrushSize(size) { this.brushSize = size; }
  setFontFamily(family) { this.fontFamily = family; }
  setFontSize(size) { this.fontSize = size; }
  setShapeType(type) { this.shapeType = type; }

  setTextStyle(style, active) {
    switch (style) {
      case 'bold': this.fontBold = active; break;
      case 'italic': this.fontItalic = active; break;
      case 'underline': this.fontUnderline = active; break;
    }
  }

  // Rendering
  renderAll() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (var i = 0; i < this.objects.length; i++) {
      this.drawFabricObject(this.objects[i]);
    }

    if (this.selectedObject) {
      this.drawSelectionBorder(this.selectedObject);
    }
  }

  drawFabricObject(obj) {
    this.ctx.save();

    if (obj.type === 'textbox' || obj.type === 'i-text') {
      this.ctx.font = (obj.fontStyle === 'italic' ? 'italic ' : '') + (obj.fontWeight === 'bold' ? 'bold ' : '') + obj.fontSize + 'px ' + obj.fontFamily;
      this.ctx.fillStyle = obj.fill || '#000000';
      this.ctx.textBaseline = 'top';

      var text = obj.text || '';
      var lines = text.split('\n');
      var lineHeight = obj.fontSize * 1.2;

      for (var i = 0; i < lines.length; i++) {
        this.ctx.fillText(lines[i], obj.left, obj.top + i * lineHeight);
        if (obj.underline) {
          var textWidth = this.ctx.measureText(lines[i]).width;
          this.ctx.beginPath();
          this.ctx.moveTo(obj.left, obj.top + i * lineHeight + obj.fontSize + 2);
          this.ctx.lineTo(obj.left + textWidth, obj.top + i * lineHeight + obj.fontSize + 2);
          this.ctx.strokeStyle = obj.fill;
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    } else if (obj.type === 'rect') {
      var rw = obj.width * (obj.scaleX || 1);
      var rh = obj.height * (obj.scaleY || 1);
      this.ctx.fillStyle = obj.fill || 'transparent';
      this.ctx.fillRect(obj.left, obj.top, rw, rh);
      if (obj.stroke) {
        this.ctx.strokeStyle = obj.stroke;
        this.ctx.lineWidth = obj.strokeWidth || 1;
        this.ctx.strokeRect(obj.left, obj.top, rw, rh);
      }
    } else if (obj.type === 'ellipse') {
      this.ctx.beginPath();
      this.ctx.ellipse(
        obj.left + (obj.rx || 0),
        obj.top + (obj.ry || 0),
        obj.rx * (obj.scaleX || 1),
        obj.ry * (obj.scaleY || 1),
        0, 0, Math.PI * 2
      );
      this.ctx.fillStyle = obj.fill || 'transparent';
      this.ctx.fill();
      if (obj.stroke) {
        this.ctx.strokeStyle = obj.stroke;
        this.ctx.lineWidth = obj.strokeWidth || 1;
        this.ctx.stroke();
      }
    } else if (obj.type === 'line') {
      this.ctx.strokeStyle = obj.stroke || '#000000';
      this.ctx.lineWidth = obj.strokeWidth || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(obj.x1, obj.y1);
      this.ctx.lineTo(obj.x2, obj.y2);
      this.ctx.stroke();
    } else if (obj.type === 'path') {
      this.ctx.strokeStyle = obj.stroke || '#000000';
      this.ctx.lineWidth = obj.strokeWidth || 1;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      if (obj.path) {
        this.ctx.beginPath();
        for (var j = 0; j < obj.path.length; j++) {
          var seg = obj.path[j];
          if (seg[0] === 'M') this.ctx.moveTo(seg[1], seg[2]);
          else if (seg[0] === 'L') this.ctx.lineTo(seg[1], seg[2]);
        }
        this.ctx.stroke();
      }
    } else if (obj.type === 'triangle') {
      var tw = obj.width * (obj.scaleX || 1);
      var th = obj.height * (obj.scaleY || 1);
      this.ctx.beginPath();
      this.ctx.moveTo(obj.left + tw / 2, obj.top);
      this.ctx.lineTo(obj.left + tw, obj.top + th);
      this.ctx.lineTo(obj.left, obj.top + th);
      this.ctx.closePath();
      this.ctx.fillStyle = obj.fill || 'transparent';
      this.ctx.fill();
      if (obj.stroke) {
        this.ctx.strokeStyle = obj.stroke;
        this.ctx.lineWidth = obj.strokeWidth || 1;
        this.ctx.stroke();
      }
    } else if (obj.type === 'group') {
      var children = obj._objects || [];
      for (var k = 0; k < children.length; k++) {
        this.drawFabricObject(children[k]);
      }
    } else if (obj.type === 'image') {
      if (obj._element) {
        var sx = obj.scaleX || 1;
        var sy = obj.scaleY || 1;
        this.ctx.drawImage(obj._element, obj.left, obj.top, obj._element.width * sx, obj._element.height * sy);
      }
    }

    this.ctx.restore();
  }

  drawSelectionBorder(obj) {
    this.ctx.save();
    var bounds;
    if (obj.getBoundingRect) {
      bounds = obj.getBoundingRect();
    } else {
      bounds = { left: obj.left || 0, top: obj.top || 0, width: 100, height: 50 };
    }

    this.ctx.strokeStyle = '#6c63ff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(bounds.left - 2, bounds.top - 2, (bounds.width || 100) + 4, (bounds.height || 50) + 4);

    var corners = [
      { x: bounds.left - 4, y: bounds.top - 4 },
      { x: bounds.left + (bounds.width || 100), y: bounds.top - 4 },
      { x: bounds.left - 4, y: bounds.top + (bounds.height || 50) },
      { x: bounds.left + (bounds.width || 100), y: bounds.top + (bounds.height || 50) }
    ];

    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#6c63ff';
    for (var i = 0; i < corners.length; i++) {
      this.ctx.fillRect(corners[i].x, corners[i].y, 8, 8);
    }

    this.ctx.restore();
  }

  // State management
  saveState() {
    var state = this.objects.map(function(obj) {
      return JSON.parse(JSON.stringify({
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        fill: obj.fill,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        underline: obj.underline,
        text: obj.text,
        rx: obj.rx,
        ry: obj.ry,
        x1: obj.x1, y1: obj.y1,
        x2: obj.x2, y2: obj.y2,
        path: obj.path,
        src: obj.src
      }));
    });

    this.undoStack.push(state);
    if (this.undoStack.length > this.maxUndo) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 0) return;

    var currentState = this.objects.map(function(obj) {
      return JSON.parse(JSON.stringify({
        type: obj.type, left: obj.left, top: obj.top,
        width: obj.width, height: obj.height,
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        stroke: obj.stroke, strokeWidth: obj.strokeWidth,
        fill: obj.fill, fontSize: obj.fontSize,
        fontFamily: obj.fontFamily, fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle, underline: obj.underline,
        text: obj.text, rx: obj.rx, ry: obj.ry,
        x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2,
        path: obj.path, src: obj.src
      }));
    });
    this.redoStack.push(currentState);

    var prevState = this.undoStack.pop();
    this.restoreState(prevState);
  }

  redo() {
    if (this.redoStack.length <= 0) return;

    var currentState = this.objects.map(function(obj) {
      return JSON.parse(JSON.stringify({
        type: obj.type, left: obj.left, top: obj.top,
        width: obj.width, height: obj.height,
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        stroke: obj.stroke, strokeWidth: obj.strokeWidth,
        fill: obj.fill, fontSize: obj.fontSize,
        fontFamily: obj.fontFamily, fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle, underline: obj.underline,
        text: obj.text, rx: obj.rx, ry: obj.ry,
        x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2,
        path: obj.path, src: obj.src
      }));
    });
    this.undoStack.push(currentState);

    var nextState = this.redoStack.pop();
    this.restoreState(nextState);
  }

  restoreState(stateData) {
    this.objects = [];
    this.selectedObject = null;

    for (var i = 0; i < stateData.length; i++) {
      var data = stateData[i];
      var obj;
      switch (data.type) {
        case 'textbox':
          obj = new fabric.Textbox(data.text || '', {
            left: data.left, top: data.top,
            fontSize: data.fontSize, fontFamily: data.fontFamily,
            fill: data.fill, fontWeight: data.fontWeight,
            fontStyle: data.fontStyle, underline: data.underline,
            width: data.width || 200,
            editable: true
          });
          break;
        case 'rect':
          obj = new fabric.Rect({
            left: data.left, top: data.top,
            width: data.width, height: data.height,
            scaleX: data.scaleX, scaleY: data.scaleY,
            stroke: data.stroke, strokeWidth: data.strokeWidth,
            fill: data.fill
          });
          break;
        case 'ellipse':
          obj = new fabric.Ellipse({
            left: data.left, top: data.top,
            rx: data.rx, ry: data.ry,
            scaleX: data.scaleX, scaleY: data.scaleY,
            stroke: data.stroke, strokeWidth: data.strokeWidth,
            fill: data.fill
          });
          break;
        case 'line':
          obj = new fabric.Line([data.x1, data.y1, data.x2, data.y2], {
            stroke: data.stroke, strokeWidth: data.strokeWidth
          });
          break;
        case 'path':
          if (data.path) {
            var pathStr = '';
            for (var j = 0; j < data.path.length; j++) {
              var seg = data.path[j];
              pathStr += seg[0] + ' ' + seg[1] + ' ' + seg[2] + ' ';
            }
            obj = new fabric.Path(pathStr.trim(), {
              stroke: data.stroke, strokeWidth: data.strokeWidth,
              fill: 'transparent'
            });
          }
          break;
        case 'triangle':
          obj = new fabric.Triangle({
            left: data.left, top: data.top,
            width: data.width, height: data.height,
            stroke: data.stroke, strokeWidth: data.strokeWidth,
            fill: data.fill
          });
          break;
        default:
          continue;
      }
      if (obj) this.objects.push(obj);
    }

    this.renderAll();
  }

  loadPageAnnotations(pageNum) {
    this.currentPage = pageNum;
    this.renderAll();
  }

  // Save annotations into PDF
  async saveToPdf() {
    var PDFDocument = PDFLib.PDFDocument;
    var rgb = PDFLib.rgb;

    if (!window.app || !window.app.pdfViewer || !window.app.pdfViewer.pdfDoc) {
      throw new Error('No hay PDF cargado');
    }

    var pdfData = await window.app.pdfViewer.pdfDoc.getData();
    var pdfBytes = new Uint8Array(pdfData);
    var pdfDoc = await PDFDocument.load(pdfBytes);
    var pages = pdfDoc.getPages();

    for (var i = 0; i < this.objects.length; i++) {
      var obj = this.objects[i];
      var page = pages[this.currentPage - 1];
      if (!page) continue;

      if (obj.type === 'textbox' || obj.type === 'i-text') {
        try {
          var font = await pdfDoc.embedFont('Helvetica');
          page.drawText(obj.text || '', {
            x: obj.left,
            y: page.getHeight() - obj.top - (obj.fontSize || 16),
            size: obj.fontSize || 16,
            font: font,
            color: rgb(0, 0, 0)
          });
        } catch (e) {
          console.warn('Could not embed text:', e);
        }
      } else if (obj.type === 'rect') {
        try {
          page.drawRectangle({
            x: obj.left,
            y: page.getHeight() - obj.top - (obj.height || 0),
            width: obj.width || 0,
            height: obj.height || 0,
            borderColor: rgb(0, 0, 0),
            borderWidth: obj.strokeWidth || 1
          });
        } catch (e) {
          console.warn('Could not embed rect:', e);
        }
      } else if (obj.type === 'line') {
        try {
          page.drawLine({
            start: { x: obj.x1, y: page.getHeight() - obj.y1 },
            end: { x: obj.x2, y: page.getHeight() - obj.y2 },
            thickness: obj.strokeWidth || 1,
            color: rgb(0, 0, 0)
          });
        } catch (e) {
          console.warn('Could not embed line:', e);
        }
      }
    }

    return pdfDoc.save();
  }
}

window.AnnotationLayer = AnnotationLayer;
