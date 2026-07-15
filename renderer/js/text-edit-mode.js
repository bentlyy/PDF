class TextEditMode {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.active = false;
    this.textItems = [];
    this.changes = [];
    this.currentPage = 1;
    this.activeInput = null;
    this.highlightCanvas = null;
    this.highlightCtx = null;
    this._clickHandler = null;
    this._moveHandler = null;
    this.hoveredIndex = -1;
  }

  activate(pageNum) {
    this.active = true;
    this.currentPage = pageNum;
    this.extractText(pageNum);
    this.createHighlightCanvas();
    this.bindEvents();
    this.updateStatus();
  }

  deactivate() {
    this.active = false;
    this.removeActiveInput();
    this.removeHighlightCanvas();
    this.unbindEvents();
    this.textItems = [];
    this.hoveredIndex = -1;
  }

  createHighlightCanvas() {
    var wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    this.removeHighlightCanvas();
    this.highlightCanvas = document.createElement('canvas');
    this.highlightCanvas.id = 'text-highlight-canvas';
    var mainCanvas = document.getElementById('pdf-canvas');
    this.highlightCanvas.width = mainCanvas.width;
    this.highlightCanvas.height = mainCanvas.height;
    this.highlightCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;pointer-events:none;';
    wrapper.appendChild(this.highlightCanvas);
    this.highlightCtx = this.highlightCanvas.getContext('2d');
  }

  removeHighlightCanvas() {
    if (this.highlightCanvas) {
      this.highlightCanvas.remove();
      this.highlightCanvas = null;
      this.highlightCtx = null;
    }
  }

  async extractText(pageNum) {
    if (!this.pdfViewer.pdfDoc) return;
    this.textItems = [];

    try {
      var page = await this.pdfViewer.pdfDoc.getPage(pageNum);
      var textContent = await page.getTextContent();
      var viewport = page.getViewport({ scale: 1 });

      var canvasW = this.pdfViewer.canvas.width;
      var canvasH = this.pdfViewer.canvas.height;
      var displayW = canvasW / (this.pdfViewer.dpr || 1);
      var displayH = canvasH / (this.pdfViewer.dpr || 1);

      var scaleX = displayW / viewport.width;
      var scaleY = displayH / viewport.height;

      var items = textContent.items;
      var lines = [];
      var currentLine = null;
      var tolerance = 4;

      var sorted = items.slice().sort(function(a, b) {
        var ay = a.transform[5];
        var by = b.transform[5];
        if (Math.abs(ay - by) < tolerance) return a.transform[4] - b.transform[4];
        return by - ay;
      });

      for (var i = 0; i < sorted.length; i++) {
        var item = sorted[i];
        if (!item.str || item.str.trim() === '') continue;

        var tx = item.transform[4];
        var ty = item.transform[5];
        var w = item.width;
        var h = item.height;

        var x = tx * scaleX;
        var y = (viewport.height - ty - h) * scaleY;
        var iw = w * scaleX;
        var ih = h * scaleY;

        if (ih < 3) continue;

        var lineY = Math.round(ty / tolerance) * tolerance;

        if (currentLine && Math.abs(lineY - lastY) < tolerance) {
          currentLine.text += item.str;
          var lineEndX = (tx + w) * scaleX;
          var lineEndY = (viewport.height - ty - h) * scaleY;
          currentLine.w = Math.max(currentLine.w, lineEndX - currentLine.x);
          currentLine.h = Math.max(currentLine.h, (lineEndY + ih) - currentLine.y);
          currentLine.fontSize = Math.max(currentLine.fontSize, ih);
        } else {
          currentLine = {
            text: item.str,
            x: x,
            y: y,
            w: iw,
            h: ih,
            fontSize: ih,
            fontName: item.fontName || 'helvetica'
          };
          lines.push(currentLine);
          lastY = lineY;
        }
      }

      this.textItems = lines;
    } catch (e) {
      console.error('Error extracting text:', e);
    }
  }

  bindEvents() {
    var self = this;
    var annotationCanvas = document.getElementById('annotation-canvas');

    this._clickHandler = function(e) { self.onCanvasClick(e); };
    this._moveHandler = function(e) { self.onCanvasMove(e); };

    annotationCanvas.addEventListener('click', this._clickHandler);
    annotationCanvas.addEventListener('mousemove', this._moveHandler);
  }

  unbindEvents() {
    var annotationCanvas = document.getElementById('annotation-canvas');
    if (annotationCanvas && this._clickHandler) {
      annotationCanvas.removeEventListener('click', this._clickHandler);
    }
    if (annotationCanvas && this._moveHandler) {
      annotationCanvas.removeEventListener('mousemove', this._moveHandler);
    }
    this._clickHandler = null;
    this._moveHandler = null;
  }

  getCanvasPos(e) {
    var rect = e.target.getBoundingClientRect();
    var sx = this.pdfViewer.canvas.width / rect.width;
    var sy = this.pdfViewer.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy
    };
  }

  findTextAt(pos) {
    for (var i = 0; i < this.textItems.length; i++) {
      var item = this.textItems[i];
      if (pos.x >= item.x - 5 && pos.x <= item.x + item.w + 5 &&
          pos.y >= item.y - 5 && pos.y <= item.y + item.h + 5) {
        return i;
      }
    }
    return -1;
  }

  onCanvasMove(e) {
    if (!this.active) return;
    var pos = this.getCanvasPos(e);
    var idx = this.findTextAt(pos);

    var annotationCanvas = document.getElementById('annotation-canvas');
    if (idx >= 0) {
      annotationCanvas.style.cursor = 'text';
      if (idx !== this.hoveredIndex) {
        this.hoveredIndex = idx;
        this.drawHighlights();
      }
    } else {
      annotationCanvas.style.cursor = 'crosshair';
      if (this.hoveredIndex !== -1) {
        this.hoveredIndex = -1;
        this.drawHighlights();
      }
    }
  }

  onCanvasClick(e) {
    if (!this.active) return;
    var pos = this.getCanvasPos(e);
    var idx = this.findTextAt(pos);

    if (idx >= 0) {
      this.removeActiveInput();
      this.createFloatingInput(idx, pos);
    } else {
      this.removeActiveInput();
    }
  }

  createFloatingInput(textIndex, clickPos) {
    var item = this.textItems[textIndex];
    if (!item) return;

    var wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    var dpr = this.pdfViewer.dpr || 1;
    var displayX = item.x / dpr;
    var displayY = item.y / dpr;
    var displayW = Math.max(item.w / dpr, 100);
    var displayH = item.h / dpr;

    var input = document.createElement('textarea');
    input.value = item.text;
    input.className = 'text-edit-floating-input';
    input.style.cssText =
      'position:absolute;z-index:20;' +
      'left:' + displayX + 'px;' +
      'top:' + displayY + 'px;' +
      'width:' + displayW + 'px;' +
      'height:' + (displayH + 6) + 'px;' +
      'font-size:' + (item.fontSize / dpr) + 'px;' +
      'font-family:Helvetica,Arial,sans-serif;' +
      'color:#000;' +
      'background:rgba(255,255,255,0.97);' +
      'border:2px solid #6c63ff;' +
      'border-radius:3px;' +
      'padding:2px 4px;' +
      'outline:none;' +
      'resize:none;' +
      'overflow:hidden;' +
      'line-height:1.2;' +
      'white-space:pre-wrap;' +
      'box-shadow:0 2px 12px rgba(108,99,255,0.25);';

    var self = this;

    input.addEventListener('blur', function() {
      self.finishInput(textIndex, input);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        input.blur();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        input.blur();
      }
    });

    wrapper.appendChild(input);
    this.activeInput = input;

    input.focus();
    input.select();
  }

  finishInput(textIndex, input) {
    var item = this.textItems[textIndex];
    var newText = input.value;

    if (newText !== item.text && newText.trim() !== '') {
      this.changes.push({
        pageIndex: this.currentPage,
        textIndex: textIndex,
        originalText: item.text,
        newText: newText,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        fontSize: item.fontSize
      });
      item.text = newText;
      if (window.app) window.app.showToast('Texto modificado: "' + newText.substring(0, 20) + '..."', 'info');
    }

    input.remove();
    this.activeInput = null;
    this.drawHighlights();
  }

  removeActiveInput() {
    if (this.activeInput) {
      this.activeInput.remove();
      this.activeInput = null;
    }
  }

  drawHighlights() {
    if (!this.highlightCtx) return;
    var ctx = this.highlightCtx;
    var dpr = this.pdfViewer.dpr || 1;

    ctx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);

    for (var i = 0; i < this.textItems.length; i++) {
      var item = this.textItems[i];
      var isHovered = (i === this.hoveredIndex);

      ctx.strokeStyle = isHovered ? '#6c63ff' : 'rgba(108,99,255,0.3)';
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.setLineDash(isHovered ? [] : [4, 3]);

      ctx.strokeRect(item.x - 2, item.y - 2, item.w + 4, item.h + 4);

      if (isHovered) {
        ctx.fillStyle = 'rgba(108,99,255,0.08)';
        ctx.fillRect(item.x - 2, item.y - 2, item.w + 4, item.h + 4);
      }
    }

    ctx.setLineDash([]);
  }

  updateStatus() {
    if (this.active && window.app) {
      document.getElementById('status-tool').textContent =
        'Herramienta: Editar texto (' + this.textItems.length + ' bloques detectados)';
    }
  }

  async applyChangesToPdf(pdfDoc) {
    if (this.changes.length === 0) return pdfDoc.save();
    var rgb = PDFLib.rgb;
    var pages = pdfDoc.getPages();

    for (var i = 0; i < this.changes.length; i++) {
      var change = this.changes[i];
      var page = pages[change.pageIndex - 1];
      if (!page) continue;

      try {
        var pageData = await this.pdfViewer.pdfDoc.getPage(change.pageIndex);
        var viewport = pageData.getViewport({ scale: 1 });
        var canvasW = this.pdfViewer.canvas.width;
        var displayW = canvasW / (this.pdfViewer.dpr || 1);
        var displayH = this.pdfViewer.canvas.height / (this.pdfViewer.dpr || 1);
        var scaleX = viewport.width / displayW;
        var scaleY = viewport.height / displayH;
        var pageH = page.getHeight();

        var pdfX = change.x * scaleX;
        var pdfY = pageH - (change.y * scaleY) - (change.h * scaleY);

        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - 1,
          width: change.w * scaleX + 2,
          height: change.h * scaleY + 2,
          color: rgb(1, 1, 1),
          borderWidth: 0
        });

        try {
          var font = await pdfDoc.embedFont('Helvetica');
          var fontSizeInPdf = change.fontSize * scaleX;
          page.drawText(change.newText, {
            x: pdfX,
            y: pdfY + 2,
            size: fontSizeInPdf,
            font: font,
            color: rgb(0, 0, 0)
          });
        } catch (e) {
          console.warn('Could not embed text:', e);
        }
      } catch (e) {
        console.warn('Could not apply text change:', e);
      }
    }

    return pdfDoc.save();
  }
}

window.TextEditMode = TextEditMode;
