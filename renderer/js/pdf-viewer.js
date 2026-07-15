class PDFViewer {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.zoom = 1;
    this.baseScale = 2;
    this.fitMode = 'page';
    this.rendering = false;
    this.pendingRender = null;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas = document.getElementById('pdf-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scrollContainer = document.getElementById('pdf-scroll');

    this.setupZoomHandler();
    this.setupResizeHandler();
  }

  async loadDocument(data) {
    const typedArray = new Uint8Array(data);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    this.pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
    this.totalPages = this.pdfDoc.numPages;
    this.currentPage = 1;

    document.getElementById('page-input').max = this.totalPages;
    document.getElementById('page-count').textContent = '/ ' + this.totalPages;

    await this.setZoom(1);
  }

  getScale() {
    return this.zoom * this.baseScale * this.dpr;
  }

  async renderPage(pageNum, targetCanvas, overrideScale) {
    if (!this.pdfDoc) return null;

    const canvas = targetCanvas || this.canvas;
    const scale = overrideScale || this.getScale();

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!overrideScale) {
        canvas.style.width = (viewport.width / this.dpr) + 'px';
        canvas.style.height = (viewport.height / this.dpr) + 'px';
      }

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      }).promise;

      return viewport;
    } catch (err) {
      console.error('Error rendering page:', err);
      return null;
    }
  }

  async renderCurrentPage() {
    const viewport = await this.renderPage(this.currentPage);
    if (viewport && window.app && window.app.annotationLayer) {
      const displayW = viewport.width / this.dpr;
      const displayH = viewport.height / this.dpr;
      window.app.annotationLayer.syncCanvasSize(displayW, displayH, viewport.width, viewport.height);
      window.app.annotationLayer.loadPageAnnotations(this.currentPage);
    }
    if (window.app) window.app.updateStatusBar();
  }

  async renderThumbnail(pageNum, thumbCanvas) {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(pageNum);
    const thumbScale = 0.3 * this.dpr;
    const viewport = page.getViewport({ scale: thumbScale });

    thumbCanvas.width = viewport.width;
    thumbCanvas.height = viewport.height;
    thumbCanvas.style.width = (viewport.width / this.dpr) + 'px';
    thumbCanvas.style.height = (viewport.height / this.dpr) + 'px';

    await page.render({
      canvasContext: thumbCanvas.getContext('2d'),
      viewport: viewport
    }).promise;
  }

  async renderPageToImage(pageNum, scale) {
    if (!this.pdfDoc) return null;
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale * this.dpr });

    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;

    await page.render({
      canvasContext: offscreen.getContext('2d'),
      viewport: viewport
    }).promise;

    return offscreen.toDataURL('image/png');
  }

  async goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages) return;
    this.currentPage = pageNum;
    document.getElementById('page-input').value = pageNum;
    await this.renderCurrentPage();
    if (window.app && window.app.thumbnailPanel) {
      window.app.thumbnailPanel.setActiveThumbnail(pageNum);
    }
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.goToPage(this.currentPage + 1);
    }
  }

  async prevPage() {
    if (this.currentPage > 1) {
      await this.goToPage(this.currentPage - 1);
    }
  }

  async setZoom(zoom) {
    this.zoom = Math.max(0.1, Math.min(zoom, 10));
    document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    await this.renderCurrentPage();
  }

  async zoomIn() {
    await this.setZoom(this.zoom + 0.15);
  }

  async zoomOut() {
    await this.setZoom(this.zoom - 0.15);
  }

  async fitWidth() {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = this.scrollContainer.clientWidth - 40;
    this.zoom = containerWidth / (viewport.width * this.dpr);
    this.fitMode = 'width';
    document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    await this.renderCurrentPage();
  }

  async fitPage() {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = this.scrollContainer.clientWidth - 40;
    const containerHeight = this.scrollContainer.clientHeight - 40;
    const zoomW = containerWidth / (viewport.width * this.dpr);
    const zoomH = containerHeight / (viewport.height * this.dpr);
    this.zoom = Math.min(zoomW, zoomH);
    this.fitMode = 'page';
    document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    await this.renderCurrentPage();
  }

  setupZoomHandler() {
    this.scrollContainer.addEventListener('wheel', function(e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          window.app.pdfViewer.zoomIn();
        } else {
          window.app.pdfViewer.zoomOut();
        }
      }
    }, { passive: false });
  }

  setupResizeHandler() {
    var self = this;
    var resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        self.dpr = window.devicePixelRatio || 1;
        if (self.fitMode === 'width') {
          self.fitWidth();
        } else if (self.fitMode === 'page') {
          self.fitPage();
        } else {
          self.renderCurrentPage();
        }
      }, 200);
    });
  }
}

window.PDFViewer = PDFViewer;
