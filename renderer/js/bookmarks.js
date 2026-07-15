class BookmarksPanel {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
    this.bookmarks = [];
  }

  init() {
    this.createPanel();
    this.renderBookmarks();
  }

  createPanel() {
    if (document.getElementById('bookmarks-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'bookmarks-panel';
    panel.className = 'bookmarks-panel hidden';

    panel.innerHTML =
      '<div class="bm-header">' +
        '<span class="bm-title">Marcadores</span>' +
        '<button id="bm-add" class="bm-add-btn" title="Agregar marcador">+</button>' +
      '</div>' +
      '<div id="bm-list" class="bm-list">' +
        '<p class="empty-text">No hay marcadores</p>' +
      '</div>';

    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.appendChild(panel);
    }

    var self = this;
    document.getElementById('bm-add').addEventListener('click', function() { self.addBookmark(); });
  }

  show() {
    var panel = document.getElementById('bookmarks-panel');
    if (panel) panel.classList.remove('hidden');
  }

  hide() {
    var panel = document.getElementById('bookmarks-panel');
    if (panel) panel.classList.add('hidden');
  }

  toggle() {
    var panel = document.getElementById('bookmarks-panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  addBookmark() {
    if (!this.pdfViewer || !this.pdfViewer.pdfDoc) return;

    var name = prompt('Nombre del marcador:', 'Pagina ' + this.pdfViewer.currentPage);
    if (!name) return;

    this.bookmarks.push({
      name: name,
      page: this.pdfViewer.currentPage,
      created: new Date().toLocaleTimeString()
    });

    this.renderBookmarks();
    if (window.app) window.app.showToast('Marcador agregado', 'success');
  }

  removeBookmark(index) {
    this.bookmarks.splice(index, 1);
    this.renderBookmarks();
  }

  renderBookmarks() {
    var list = document.getElementById('bm-list');
    if (!list) return;

    if (this.bookmarks.length === 0) {
      list.innerHTML = '<p class="empty-text">No hay marcadores</p>';
      return;
    }

    var self = this;
    var html = '';
    for (var i = 0; i < this.bookmarks.length; i++) {
      var bm = this.bookmarks[i];
      html += '<div class="bm-item" data-page="' + bm.page + '">' +
        '<span class="bm-page">P. ' + bm.page + '</span>' +
        '<span class="bm-name">' + bm.name + '</span>' +
        '<button class="bm-remove" data-index="' + i + '">&times;</button>' +
      '</div>';
    }
    list.innerHTML = html;

    var items = list.querySelectorAll('.bm-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', (function(page) {
        return function() {
          if (window.app && window.app.pdfViewer) {
            window.app.pdfViewer.goToPage(page);
          }
        };
      })(parseInt(items[j].dataset.page)));
    }

    var removeBtns = list.querySelectorAll('.bm-remove');
    for (var k = 0; k < removeBtns.length; k++) {
      removeBtns[k].addEventListener('click', (function(idx) {
        return function(e) {
          e.stopPropagation();
          self.removeBookmark(idx);
        };
      })(parseInt(removeBtns[k].dataset.index)));
    }
  }

  async applyBookmarksToPdf(pdfDoc) {
    if (this.bookmarks.length === 0) return pdfDoc.save();

    for (var i = 0; i < this.bookmarks.length; i++) {
      var bm = this.bookmarks[i];
      try {
        pdfDoc.addOutlineEntry(bm.name, bm.page - 1);
      } catch (e) {
        console.warn('Could not add bookmark:', e);
      }
    }

    return pdfDoc.save();
  }
}

window.BookmarksPanel = BookmarksPanel;
