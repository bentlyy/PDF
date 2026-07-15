class TextEditMode {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.active = false;
    this.textBlocks = [];
    this.changes = [];
    this.overlayContainer = null;
    this.currentPage = 1;
    this.scaleX = 1;
    this.scaleY = 1;
  }

  activate(pageNum) {
    this.active = true;
    this.currentPage = pageNum;
    this.createOverlayContainer();
    this.extractAndOverlay(pageNum);
  }

  deactivate() {
    this.active = false;
    this.textBlocks = [];
    this.changes = [];
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
  }

  createOverlayContainer() {
    var wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    if (this.overlayContainer) this.overlayContainer.remove();
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'text-edit-overlay';
    this.overlayContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;pointer-events:none;';
    wrapper.appendChild(this.overlayContainer);
  }

  async extractAndOverlay(pageNum) {
    if (!this.pdfViewer.pdfDoc || !this.active) return;

    var page = await this.pdfViewer.pdfDoc.getPage(pageNum);
    var textContent = await page.getTextContent();
    var viewport = page.getViewport({ scale: this.pdfViewer.getScale() });

    var canvasW = this.pdfViewer.canvas.width;
    var canvasH = this.pdfViewer.canvas.height;
    var displayW = canvasW / (this.pdfViewer.dpr || 1);
    var displayH = canvasH / (this.pdfViewer.dpr || 1);

    var scaleX = displayW / viewport.width;
    var scaleY = displayH / viewport.height;

    this.textBlocks = [];
    this.groupTextItems(textContent.items, viewport, scaleX, scaleY);
    this.renderOverlays();
  }

  groupTextItems(items, viewport, scaleX, scaleY) {
    var lines = [];
    var currentLine = null;
    var lastY = null;
    var tolerance = 3;

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

      var displayX = tx * scaleX;
      var displayY = (viewport.height - ty - h) * scaleY;
      var displayW = w * scaleX;
      var displayH = h * scaleY;

      var fontSize = Math.abs(h) * scaleY;
      if (fontSize < 4) continue;

      var lineY = Math.round(ty / tolerance) * tolerance;

      if (currentLine && Math.abs(lineY - lastY) < tolerance) {
        currentLine.items.push(item);
        currentLine.text += item.str;
        var lineEndX = (tx + w) * scaleX;
        var lineEndY = (viewport.height - ty - h) * scaleY;
        currentLine.displayW = Math.max(currentLine.displayW, lineEndX - currentLine.displayX);
        currentLine.displayY = Math.min(currentLine.displayY, displayY);
        currentLine.displayH = Math.max(currentLine.displayH, lineEndY - currentLine.displayY + displayH);
        currentLine.fontSize = Math.max(currentLine.fontSize, fontSize);
      } else {
        currentLine = {
          items: [item],
          text: item.str,
          displayX: displayX,
          displayY: displayY,
          displayW: displayW,
          displayH: displayH,
          fontSize: fontSize,
          fontName: item.fontName || 'Helvetica',
          color: '#000000',
          originalText: item.str
        };
        lines.push(currentLine);
        lastY = ty;
      }
    }

    this.textBlocks = lines;
  }

  renderOverlays() {
    if (!this.overlayContainer) return;
    this.overlayContainer.innerHTML = '';

    for (var i = 0; i < this.textBlocks.length; i++) {
      var block = this.textBlocks[i];
      var div = document.createElement('div');
      div.className = 'text-edit-block';
      div.contentEditable = 'false';
      div.dataset.index = i;

      var padding = 2;
      div.style.cssText =
        'position:absolute;pointer-events:auto;cursor:text;' +
        'left:' + (block.displayX - padding) + 'px;' +
        'top:' + (block.displayY - padding) + 'px;' +
        'width:' + (block.displayW + padding * 2) + 'px;' +
        'min-height:' + (block.displayH + padding * 2) + 'px;' +
        'font-size:' + block.fontSize + 'px;' +
        'font-family:Helvetica,Arial,sans-serif;' +
        'color:transparent;' +
        'line-height:1.2;' +
        'white-space:nowrap;' +
        'overflow:hidden;' +
        'border:1px solid transparent;' +
        'border-radius:2px;' +
        'padding:2px 4px;' +
        'transition:border-color 0.15s,background 0.15s;' +
        'box-sizing:border-box;';

      div.textContent = block.text;

      this.setupBlockEvents(div, i);

      this.overlayContainer.appendChild(div);
    }
  }

  setupBlockEvents(div, index) {
    var self = this;

    div.addEventListener('mouseenter', function() {
      if (!div.isContentEditable || div.contentEditable === 'false') {
        div.style.borderColor = 'rgba(108,99,255,0.5)';
        div.style.background = 'rgba(108,99,255,0.08)';
      }
    });

    div.addEventListener('mouseleave', function() {
      if (div.contentEditable === 'false') {
        div.style.borderColor = 'transparent';
        div.style.background = 'transparent';
      }
    });

    div.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      self.startEditing(div, index);
    });

    div.addEventListener('click', function(e) {
      e.stopPropagation();
      if (div.contentEditable === 'true') return;
      self.startEditing(div, index);
    });
  }

  startEditing(div, index) {
    var self = this;
    var block = this.textBlocks[index];

    div.contentEditable = 'true';
    div.style.color = block.color || '#000000';
    div.style.borderColor = '#6c63ff';
    div.style.background = 'rgba(255,255,255,0.95)';
    div.style.whiteSpace = 'pre-wrap';
    div.style.overflow = 'visible';
    div.style.minWidth = block.displayW + 'px';
    div.focus();

    var range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    div.addEventListener('blur', function onBlur() {
      div.removeEventListener('blur', onBlur);
      self.finishEditing(div, index);
    });

    div.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        div.blur();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        div.blur();
      }
    });
  }

  finishEditing(div, index) {
    var block = this.textBlocks[index];
    var newText = div.textContent || div.innerText;

    if (newText !== block.text) {
      this.changes.push({
        pageIndex: this.currentPage,
        blockIndex: index,
        originalText: block.text,
        newText: newText,
        displayX: block.displayX,
        displayY: block.displayY,
        displayW: block.displayW,
        displayH: block.displayH,
        fontSize: block.fontSize
      });

      block.text = newText;
      if (window.app) window.app.showToast('Texto modificado', 'info');
    }

    div.contentEditable = 'false';
    div.style.color = 'transparent';
    div.style.borderColor = 'transparent';
    div.style.background = 'transparent';
    div.style.whiteSpace = 'nowrap';
    div.style.overflow = 'hidden';

    div.textContent = block.text;
  }

  async applyChangesToPdf(pdfDoc) {
    var rgb = PDFLib.rgb;

    var pages = pdfDoc.getPages();

    for (var i = 0; i < this.changes.length; i++) {
      var change = this.changes[i];
      var page = pages[change.pageIndex - 1];
      if (!page) continue;

      try {
        var pageData = await this.pdfViewer.pdfDoc.getPage(change.pageIndex);
        var viewport = pageData.getViewport({ scale: 1 });
        var pageH = page.getHeight();

        var canvasW = this.pdfViewer.canvas.width;
        var displayW = canvasW / (this.pdfViewer.dpr || 1);
        var displayH = this.pdfViewer.canvas.height / (this.pdfViewer.dpr || 1);
        var scaleX = viewport.width / displayW;
        var scaleY = viewport.height / displayH;

        var pdfX = change.displayX * scaleX;
        var pdfY = pageH - (change.displayY * scaleY) - (change.displayH * scaleY);

        var whiteColor = rgb(1, 1, 1);
        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - 1,
          width: change.displayW * scaleX + 2,
          height: change.displayH * scaleY + 2,
          color: whiteColor,
          borderWidth: 0
        });

        try {
          var font = await pdfDoc.embedFont('Helvetica');
          var fontSizeInPdf = change.fontSize * scaleX;
          page.drawText(change.newText, {
            x: pdfX,
            y: pdfY + 1,
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
