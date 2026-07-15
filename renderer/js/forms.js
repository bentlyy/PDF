class FormsTool {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.fields = [];
    this.active = false;
    this.currentType = 'text';
    this.canvas = null;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
  }

  activate(type) {
    this.active = true;
    this.currentType = type || 'text';
    this.canvas = document.getElementById('annotation-canvas');
    this.setupEvents();
  }

  deactivate() {
    this.active = false;
  }

  setupEvents() {
    var self = this;
    if (this._bound) return;
    this._bound = true;

    this.canvas.addEventListener('mousedown', function(e) {
      if (!self.active) return;
      self.isDrawing = true;
      var rect = self.canvas.getBoundingClientRect();
      var sx = self.canvas.width / rect.width;
      var sy = self.canvas.height / rect.height;
      self.startX = (e.clientX - rect.left) * sx;
      self.startY = (e.clientY - rect.top) * sy;
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (!self.active || !self.isDrawing) return;
      var rect = self.canvas.getBoundingClientRect();
      var sx = self.canvas.width / rect.width;
      var sy = self.canvas.height / rect.height;
      var x = (e.clientX - rect.left) * sx;
      var y = (e.clientY - rect.top) * sy;

      if (window.app && window.app.annotationLayer) {
        window.app.annotationLayer.renderAll();
      }

      var ctx = self.canvas.getContext('2d');
      ctx.save();
      ctx.strokeStyle = '#6c63ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        Math.min(self.startX, x),
        Math.min(self.startY, y),
        Math.abs(x - self.startX),
        Math.abs(y - self.startY)
      );
      ctx.restore();
    });

    this.canvas.addEventListener('mouseup', function(e) {
      if (!self.active || !self.isDrawing) return;
      self.isDrawing = false;
      var rect = self.canvas.getBoundingClientRect();
      var sx = self.canvas.width / rect.width;
      var sy = self.canvas.height / rect.height;
      var endX = (e.clientX - rect.left) * sx;
      var endY = (e.clientY - rect.top) * sy;

      var x = Math.min(self.startX, endX);
      var y = Math.min(self.startY, endY);
      var w = Math.abs(endX - self.startX);
      var h = Math.abs(endY - self.startY);

      if (w > 10 && h > 10) {
        self.addField(x, y, w, h, self.currentType);
      }

      if (window.app && window.app.annotationLayer) {
        window.app.annotationLayer.renderAll();
      }
      self.drawFormFields();
    });
  }

  addField(x, y, w, h, type) {
    var field = {
      x: x, y: y, w: w, h: h,
      type: type,
      name: type + '_' + (this.fields.length + 1),
      value: ''
    };
    this.fields.push(field);
    if (window.app) window.app.showToast('Campo de formulario agregado', 'info');
    this.drawFormFields();
  }

  drawFormFields() {
    if (!this.canvas) return;
    var ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    for (var i = 0; i < this.fields.length; i++) {
      var f = this.fields[i];

      ctx.strokeStyle = '#6c63ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(f.x, f.y, f.w, f.h);

      ctx.fillStyle = 'rgba(108, 99, 255, 0.08)';
      ctx.fillRect(f.x, f.y, f.w, f.h);

      if (f.type === 'checkbox') {
        var size = Math.min(f.w, f.h) * 0.4;
        var cx = f.x + (f.w - size) / 2;
        var cy = f.y + (f.h - size) / 2;
        ctx.strokeStyle = '#6c63ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy + size / 2);
        ctx.lineTo(cx + size / 3, cy + size);
        ctx.lineTo(cx + size, cy);
        ctx.stroke();
      }

      ctx.fillStyle = '#6c63ff';
      ctx.font = '10px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(f.name, f.x + 3, f.y + 3);
    }
    ctx.restore();
  }

  async applyFormFields(pdfDoc) {
    if (this.fields.length === 0) return pdfDoc.save();

    var pages = pdfDoc.getPages();
    var page = pages[this.pdfViewer.currentPage - 1];
    if (!page) return pdfDoc.save();

    var viewport = await this.pdfViewer.pdfDoc.getPage(this.pdfViewer.currentPage);
    var vp = viewport.getViewport({ scale: 1 });
    var canvasW = this.pdfViewer.canvas.width;
    var displayW = canvasW / (this.pdfViewer.dpr || 1);
    var scaleX = vp.width / displayW;
    var scaleY = vp.height / (this.pdfViewer.canvas.height / (this.pdfViewer.dpr || 1));
    var pageH = page.getHeight();

    var rgb = PDFLib.rgb;

    for (var i = 0; i < this.fields.length; i++) {
      var f = this.fields[i];

      page.drawRectangle({
        x: f.x * scaleX,
        y: pageH - (f.y + f.h) * scaleY,
        width: f.w * scaleX,
        height: f.h * scaleY,
        borderColor: rgb(0.42, 0.39, 1),
        borderWidth: 1.5
      });
    }

    this.fields = [];
    return pdfDoc.save();
  }
}

window.FormsTool = FormsTool;
