class ThumbnailPanel {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.container = document.getElementById('thumbnail-list');
  }

  render() {
    if (!this.pdfViewer || !this.pdfViewer.pdfDoc) return;
    this.container.innerHTML = '';

    for (var i = 1; i <= this.pdfViewer.totalPages; i++) {
      var item = document.createElement('div');
      item.className = 'thumbnail-item' + (i === this.pdfViewer.currentPage ? ' active' : '');
      item.dataset.page = i;

      var canvas = document.createElement('canvas');
      var label = document.createElement('span');
      label.className = 'thumbnail-label';
      label.textContent = 'Pagina ' + i;

      item.appendChild(canvas);
      item.appendChild(label);
      this.container.appendChild(item);

      this.setupThumbnailClick(item, i);
      this.pdfViewer.renderThumbnail(i, canvas);
    }
  }

  setupThumbnailClick(item, pageNum) {
    var self = this;
    item.addEventListener('click', function() {
      self.pdfViewer.goToPage(pageNum);
      self.setActiveThumbnail(pageNum);
    });
  }

  setActiveThumbnail(pageNum) {
    var items = this.container.querySelectorAll('.thumbnail-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (parseInt(item.dataset.page) === pageNum) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    }

    var active = this.container.querySelector('.thumbnail-item.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

window.ThumbnailPanel = ThumbnailPanel;
