class TextEditMode {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.active = false;
    this.textItems = [];
    this.changes = [];
    this.currentPage = 1;
    this.overlays = [];
    this.activeOverlay = null;
    this._moveHandler = null;
  }

  activate(pageNum) {
    this.active = true;
    this.currentPage = pageNum;
    this.extractText(pageNum);
    this.buildOverlays();
    this.updateStatus();
  }

  deactivate() {
    this.active = false;
    this.saveActiveOverlay();
    this.destroyOverlays();
    this.textItems = [];
    this.unbindEvents();
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
      var dpr = this.pdfViewer.dpr || 1;
      var displayW = canvasW / dpr;
      var displayH = canvasH / dpr;

      var scaleX = displayW / viewport.width;
      var scaleY = displayH / viewport.height;

      var items = textContent.items;
      var lines = [];
      var currentLine = null;
      var lastY = null;
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
          var newBottom = lineEndY + ih;
          var oldBottom = currentLine.y + currentLine.h;
          currentLine.h = Math.max(currentLine.h, newBottom - currentLine.y);
          currentLine.fontSize = Math.max(currentLine.fontSize, ih);
        } else {
          currentLine = {
            text: item.str,
            x: x,
            y: y,
            w: iw,
            h: ih,
            fontSize: ih,
            fontName: item.fontName || 'helvetica',
            modified: false
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

  buildOverlays() {
    this.destroyOverlays();
    var wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    var dpr = this.pdfViewer.dpr || 1;

    for (var i = 0; i < this.textItems.length; i++) {
      var item = this.textItems[i];
      var div = document.createElement('div');
      div.className = 'text-edit-overlay-block';
      div.dataset.index = i;

      var pad = 3;
      div.style.left = (item.x - pad) + 'px';
      div.style.top = (item.y - pad) + 'px';
      div.style.width = (item.w + pad * 2) + 'px';
      div.style.height = (item.h + pad * 2) + 'px';
      div.style.fontSize = (item.fontSize * 0.95) + 'px';
      div.style.lineHeight = '1.2';
      div.style.fontFamily = 'Helvetica, Arial, sans-serif';
      div.textContent = item.text;

      this.setupOverlayEvents(div, i);
      wrapper.appendChild(div);
      this.overlays.push(div);
    }
  }

  setupOverlayEvents(div, index) {
    var self = this;

    div.addEventListener('mouseenter', function() {
      if (div.classList.contains('editing')) return;
      div.classList.add('hovered');
    });

    div.addEventListener('mouseleave', function() {
      div.classList.remove('hovered');
    });

    div.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      self.startEditingOverlay(div, index);
    });
  }

  startEditingOverlay(div, index) {
    this.saveActiveOverlay();

    var item = this.textItems[index];
    this.activeOverlay = { div: div, index: index };

    div.classList.add('editing');
    div.classList.remove('hovered');
    div.contentEditable = 'true';
    div.spellcheck = false;

    var range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    div.focus();

    var self = this;

    var onBlur = function() {
      div.removeEventListener('blur', onBlur);
      div.removeEventListener('keydown', onKeydown);
      self.finishEditingOverlay(div, index);
    };

    var onKeydown = function(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        div.blur();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        div.blur();
      }
    };

    div.addEventListener('blur', onBlur);
    div.addEventListener('keydown', onKeydown);
  }

  saveActiveOverlay() {
    if (!this.activeOverlay) return;
    var div = this.activeOverlay.div;
    var index = this.activeOverlay.index;

    if (div.classList.contains('editing')) {
      div.contentEditable = 'false';
      div.classList.remove('editing');
    }

    this.activeOverlay = null;
  }

  finishEditingOverlay(div, index) {
    var item = this.textItems[index];
    var newText = div.textContent || div.innerText;

    div.contentEditable = 'false';
    div.classList.remove('editing');

    if (newText !== item.text && newText.trim() !== '') {
      var alreadyChanged = false;
      for (var c = 0; c < this.changes.length; c++) {
        if (this.changes[c].textIndex === index && this.changes[c].pageIndex === this.currentPage) {
          this.changes[c].newText = newText;
          alreadyChanged = true;
          break;
        }
      }

      if (!alreadyChanged) {
        this.changes.push({
          pageIndex: this.currentPage,
          textIndex: index,
          originalText: item.text,
          newText: newText,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          fontSize: item.fontSize
        });
      }

      item.text = newText;
      div.textContent = newText;
      item.modified = true;
      if (window.app) window.app.showToast('Texto editado', 'info');
    }

    this.activeOverlay = null;
  }

  destroyOverlays() {
    for (var i = 0; i < this.overlays.length; i++) {
      if (this.overlays[i] && this.overlays[i].parentNode) {
        this.overlays[i].remove();
      }
    }
    this.overlays = [];
  }

  unbindEvents() {
  }

  updateStatus() {
    if (this.active && window.app) {
      document.getElementById('status-tool').textContent =
        'Modo edicion: ' + this.textItems.length + ' bloques de texto detectados';
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
        var dpr = this.pdfViewer.dpr || 1;
        var displayW = canvasW / dpr;
        var displayH = this.pdfViewer.canvas.height / dpr;
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
