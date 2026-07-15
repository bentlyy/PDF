class FindReplace {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.results = [];
    this.currentIndex = -1;
    this.panel = null;
  }

  init() {
    this.createPanel();
  }

  createPanel() {
    if (document.getElementById('find-replace-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'find-replace-panel';
    panel.className = 'find-replace-panel hidden';
    panel.innerHTML =
      '<div class="fr-header">' +
        '<span class="fr-title">Buscar y reemplazar</span>' +
        '<button id="fr-close" class="fr-close-btn">&times;</button>' +
      '</div>' +
      '<div class="fr-body">' +
        '<div class="fr-row">' +
          '<input type="text" id="fr-search" class="fr-input" placeholder="Buscar...">' +
          '<span id="fr-count" class="fr-count">0 resultados</span>' +
        '</div>' +
        '<div class="fr-row">' +
          '<input type="text" id="fr-replace" class="fr-input" placeholder="Reemplazar con...">' +
        '</div>' +
        '<div class="fr-row fr-actions">' +
          '<button id="fr-prev" class="btn btn-secondary btn-sm">Anterior</button>' +
          '<button id="fr-next" class="btn btn-secondary btn-sm">Siguiente</button>' +
          '<button id="fr-replace-one" class="btn btn-secondary btn-sm">Reemplazar</button>' +
          '<button id="fr-replace-all" class="btn btn-primary btn-sm">Reemplazar todo</button>' +
        '</div>' +
      '</div>';

    document.getElementById('pdf-viewer').appendChild(panel);
    this.panel = panel;

    var self = this;
    document.getElementById('fr-close').addEventListener('click', function() { self.hide(); });
    document.getElementById('fr-search').addEventListener('input', function() { self.search(); });
    document.getElementById('fr-prev').addEventListener('click', function() { self.prevResult(); });
    document.getElementById('fr-next').addEventListener('click', function() { self.nextResult(); });
    document.getElementById('fr-replace-one').addEventListener('click', function() { self.replaceCurrent(); });
    document.getElementById('fr-replace-all').addEventListener('click', function() { self.replaceAll(); });
  }

  show() {
    this.panel.classList.remove('hidden');
    document.getElementById('fr-search').focus();
  }

  hide() {
    this.panel.classList.add('hidden');
    this.clearHighlights();
  }

  toggle() {
    if (this.panel.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  async search() {
    this.clearHighlights();
    this.results = [];
    this.currentIndex = -1;

    var query = document.getElementById('fr-search').value;
    if (!query || !this.pdfViewer.pdfDoc) {
      document.getElementById('fr-count').textContent = '0 resultados';
      return;
    }

    var page = await this.pdfViewer.pdfDoc.getPage(this.pdfViewer.currentPage);
    var textContent = await page.getTextContent();
    var viewport = page.getViewport({ scale: this.pdfViewer.getScale() });

    var canvasW = this.pdfViewer.canvas.width;
    var displayW = canvasW / (this.pdfViewer.dpr || 1);
    var scaleX = displayW / viewport.width;

    var fullText = '';
    var charMap = [];
    for (var i = 0; i < textContent.items.length; i++) {
      var item = textContent.items[i];
      for (var j = 0; j < item.str.length; j++) {
        fullText += item.str[j];
        charMap.push({
          itemIndex: i,
          charIndex: j,
          tx: item.transform[4],
          ty: item.transform[5],
          w: item.width,
          h: item.height
        });
      }
    }

    var lowerFull = fullText.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var startIdx = 0;

    while (startIdx < lowerFull.length) {
      var found = lowerFull.indexOf(lowerQuery, startIdx);
      if (found === -1) break;

      var startChar = charMap[found];
      var endChar = charMap[found + query.length - 1];

      if (startChar && endChar) {
        var sx = startChar.tx * scaleX;
        var sy = (viewport.height - startChar.ty - startChar.h) * (this.pdfViewer.canvas.height / viewport.height);
        var ex = (endChar.tx + endChar.w) * scaleX;
        var ey = (viewport.height - endChar.ty) * (this.pdfViewer.canvas.height / viewport.height);

        this.results.push({
          start: found,
          length: query.length,
          displayX: sx,
          displayY: sy,
          displayW: ex - sx,
          displayH: ey - sy
        });
      }

      startIdx = found + 1;
    }

    document.getElementById('fr-count').textContent = this.results.length + ' resultado' + (this.results.length !== 1 ? 's' : '');

    if (this.results.length > 0) {
      this.currentIndex = 0;
      this.highlightCurrent();
    }
  }

  highlightCurrent() {
    this.clearHighlights();

    if (this.currentIndex < 0 || this.currentIndex >= this.results.length) return;

    var result = this.results[this.currentIndex];
    var wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    var highlight = document.createElement('div');
    highlight.className = 'find-highlight';
    highlight.style.cssText =
      'position:absolute;z-index:15;pointer-events:none;' +
      'left:' + result.displayX + 'px;' +
      'top:' + result.displayY + 'px;' +
      'width:' + result.displayW + 'px;' +
      'height:' + result.displayH + 'px;' +
      'background:rgba(108,99,255,0.35);border:2px solid #6c63ff;border-radius:2px;' +
      'transition:all 0.2s ease;';

    wrapper.appendChild(highlight);
  }

  clearHighlights() {
    var highlights = document.querySelectorAll('.find-highlight');
    for (var i = 0; i < highlights.length; i++) {
      highlights[i].remove();
    }
  }

  nextResult() {
    if (this.results.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.results.length;
    this.highlightCurrent();
    this.scrollToResult();
  }

  prevResult() {
    if (this.results.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.results.length) % this.results.length;
    this.highlightCurrent();
    this.scrollToResult();
  }

  scrollToResult() {
    if (this.currentIndex < 0) return;
    var result = this.results[this.currentIndex];
    var scroll = this.pdfViewer.scrollContainer;
    var canvas = this.pdfViewer.canvas;
    var offsetX = (scroll.clientWidth - canvas.clientWidth) / 2;
    scroll.scrollTo({
      left: result.displayX - offsetX + 50,
      top: result.displayY - 100,
      behavior: 'smooth'
    });
  }

  replaceCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.results.length) return;
    var replaceText = document.getElementById('fr-replace').value;
    var result = this.results[this.currentIndex];

    if (window.app && window.app.annotationLayer) {
      var pos = { x: result.displayX + result.displayW / 2, y: result.displayY + result.displayH / 2 };
      window.app.annotationLayer.setTool('text');
      window.app.annotationLayer.addTextWithContent(pos, replaceText);
    }

    this.search();
  }

  replaceAll() {
    var replaceText = document.getElementById('fr-replace').value;
    var count = this.results.length;

    for (var i = this.results.length - 1; i >= 0; i--) {
      var result = this.results[i];
      if (window.app && window.app.annotationLayer) {
        var pos = { x: result.displayX + result.displayW / 2, y: result.displayY + result.displayH / 2 };
        window.app.annotationLayer.addTextWithContent(pos, replaceText);
      }
    }

    if (count > 0 && window.app) {
      window.app.showToast(count + ' ocurrencias reemplazadas', 'success');
    }

    this.search();
  }
}

window.FindReplace = FindReplace;
