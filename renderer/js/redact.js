class RedactTool {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.regions = [];
    this.active = false;
  }

  activate() {
    this.active = true;
    this.canvas = document.getElementById('annotation-canvas');
    this.ctx = this.canvas.getContext('2d');
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

      self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
      if (window.app && window.app.annotationLayer) {
        window.app.annotationLayer.renderAll();
      }
      self.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      self.ctx.fillRect(
        Math.min(self.startX, x),
        Math.min(self.startY, y),
        Math.abs(x - self.startX),
        Math.abs(y - self.startY)
      );
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

      if (w > 5 && h > 5) {
        self.regions.push({ x: x, y: y, w: w, h: h });
        if (window.app) window.app.showToast('Area de redaccion marcada', 'info');
      }

      self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
      if (window.app && window.app.annotationLayer) {
        window.app.annotationLayer.renderAll();
      }
      self.drawRedactedRegions();
    });
  }

  drawRedactedRegions() {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    for (var i = 0; i < this.regions.length; i++) {
      var r = this.regions[i];
      this.ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    this.ctx.restore();
  }

  clearRegions() {
    this.regions = [];
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  async applyRedaction(pdfDoc) {
    if (this.regions.length === 0) return pdfDoc.save();

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

    for (var i = 0; i < this.regions.length; i++) {
      var r = this.regions[i];
      page.drawRectangle({
        x: r.x * scaleX,
        y: pageH - (r.y + r.h) * scaleY,
        width: r.w * scaleX,
        height: r.h * scaleY,
        color: rgb(0, 0, 0),
        borderWidth: 0
      });
    }

    this.regions = [];
    return pdfDoc.save();
  }
}

window.RedactTool = RedactTool;
