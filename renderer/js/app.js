class App {
  constructor() {
    this.pdfViewer = null;
    this.annotationLayer = null;
    this.thumbnailPanel = null;
    this.toolbar = null;
    this.currentFilePath = null;
    this.currentFileName = null;

    this.textEditMode = null;
    this.findReplace = null;
    this.tabsManager = null;
    this.watermarkTool = null;
    this.compressTool = null;
    this.bookmarksPanel = null;
    this.redactTool = null;
    this.formsTool = null;
    this.isLightTheme = false;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDragDrop();
    this.setupMenuListeners();
    this.setupKeyboardShortcuts();
    this.compressTool = new CompressTool();
    this.watermarkTool = new WatermarkTool(null);
    this.bookmarksPanel = new BookmarksPanel(null);
  }

  setupEventListeners() {
    var self = this;

    document.getElementById('btn-open-pdf').addEventListener('click', function() { self.openFile(); });
    document.getElementById('btn-merge-pdf').addEventListener('click', function() { self.showMergeModal(); });
    document.getElementById('btn-open').addEventListener('click', function() { self.openFile(); });
    document.getElementById('btn-save').addEventListener('click', function() { self.saveFile(); });
    document.getElementById('btn-undo').addEventListener('click', function() { self.undo(); });
    document.getElementById('btn-redo').addEventListener('click', function() { self.redo(); });

    document.getElementById('btn-toggle-sidebar').addEventListener('click', function() { self.toggleSidebar(); });

    document.getElementById('btn-zoom-in').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.zoomIn(); });
    document.getElementById('btn-zoom-out').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.zoomOut(); });
    document.getElementById('btn-fit-width').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.fitWidth(); });
    document.getElementById('btn-fit-page').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.fitPage(); });

    document.getElementById('btn-prev-page').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.prevPage(); });
    document.getElementById('btn-next-page').addEventListener('click', function() { if (self.pdfViewer) self.pdfViewer.nextPage(); });

    document.getElementById('btn-find').addEventListener('click', function() { if (self.findReplace) self.findReplace.toggle(); });
    document.getElementById('btn-compress').addEventListener('click', function() { self.compressTool.compressPdf(); });
    document.getElementById('btn-theme-toggle').addEventListener('click', function() { self.toggleTheme(); });

    document.getElementById('page-input').addEventListener('change', function(e) {
      var page = parseInt(e.target.value);
      if (self.pdfViewer && page >= 1 && page <= self.pdfViewer.totalPages) {
        self.pdfViewer.goToPage(page);
      }
    });

    document.getElementById('prop-color').addEventListener('input', function(e) {
      if (self.annotationLayer) self.annotationLayer.setStrokeColor(e.target.value);
    });
    document.getElementById('prop-stroke-width').addEventListener('input', function(e) {
      document.getElementById('prop-stroke-width-val').textContent = e.target.value;
      if (self.annotationLayer) self.annotationLayer.setStrokeWidth(parseInt(e.target.value));
    });
    document.getElementById('prop-fill-color').addEventListener('input', function(e) {
      if (self.annotationLayer) self.annotationLayer.setFillColor(e.target.value);
    });
    document.getElementById('prop-brush-size').addEventListener('input', function(e) {
      document.getElementById('prop-brush-size-val').textContent = e.target.value;
      if (self.annotationLayer) self.annotationLayer.setBrushSize(parseInt(e.target.value));
    });

    document.getElementById('prop-font-family').addEventListener('change', function(e) {
      if (self.annotationLayer) self.annotationLayer.setFontFamily(e.target.value);
    });
    document.getElementById('prop-font-size').addEventListener('change', function(e) {
      if (self.annotationLayer) self.annotationLayer.setFontSize(parseInt(e.target.value));
    });

    document.getElementById('prop-bold').addEventListener('click', function() { self.toggleStyle('bold'); });
    document.getElementById('prop-italic').addEventListener('click', function() { self.toggleStyle('italic'); });
    document.getElementById('prop-underline').addEventListener('click', function() { self.toggleStyle('underline'); });

    document.getElementById('prop-shape-type').addEventListener('change', function(e) {
      if (self.annotationLayer) self.annotationLayer.setShapeType(e.target.value);
    });

    document.querySelectorAll('.sidebar-tab').forEach(function(tab) {
      tab.addEventListener('click', function() { self.switchSidebarTab(tab.dataset.tab); });
    });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(function(btn) {
      btn.addEventListener('click', function() { self.selectTool(btn.dataset.tool); });
    });

    document.querySelectorAll('.modal-close, .modal-cancel, .modal-overlay').forEach(function(el) {
      el.addEventListener('click', function(e) {
        var modal = e.target.closest('.modal');
        if (modal) modal.classList.add('hidden');
      });
    });

    document.getElementById('btn-add-merge-files').addEventListener('click', function() { self.addMergeFiles(); });
    document.getElementById('btn-do-merge').addEventListener('click', function() { self.doMerge(); });
    document.getElementById('btn-do-export').addEventListener('click', function() { self.doExport(); });

    this.setupSignatureModal();
  }

  setupDragDrop() {
    var self = this;
    var viewer = document.getElementById('pdf-viewer');
    var welcome = document.getElementById('welcome-screen');

    var handleDragOver = function(e) {
      e.preventDefault();
      e.stopPropagation();
    };

    var handleDrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        self.loadPdfFromFile(files[0]);
      }
    };

    if (viewer) {
      viewer.addEventListener('dragover', handleDragOver);
      viewer.addEventListener('drop', handleDrop);
    }
    if (welcome) {
      welcome.addEventListener('dragover', handleDragOver);
      welcome.addEventListener('drop', handleDrop);
    }
  }

  setupMenuListeners() {
    var self = this;
    var api = window.electronAPI;
    if (!api) return;

    api.on('menu-open', function() { self.openFile(); });
    api.on('menu-save', function() { self.saveFile(); });
    api.on('menu-save-as', function() { self.saveFileAs(); });
    api.on('menu-export-image', function() { self.showExportModal(); });
    api.on('menu-merge', function() { self.showMergeModal(); });
    api.on('menu-undo', function() { self.undo(); });
    api.on('menu-redo', function() { self.redo(); });
    api.on('menu-delete', function() { if (self.annotationLayer) self.annotationLayer.deleteSelected(); });
    api.on('menu-select-all', function() { if (self.annotationLayer) self.annotationLayer.selectAll(); });
    api.on('menu-zoom-in', function() { if (self.pdfViewer) self.pdfViewer.zoomIn(); });
    api.on('menu-zoom-out', function() { if (self.pdfViewer) self.pdfViewer.zoomOut(); });
    api.on('menu-zoom-reset', function() { if (self.pdfViewer) self.pdfViewer.setZoom(1); });
    api.on('menu-fit-width', function() { if (self.pdfViewer) self.pdfViewer.fitWidth(); });
    api.on('menu-fit-page', function() { if (self.pdfViewer) self.pdfViewer.fitPage(); });
    api.on('menu-toggle-sidebar', function() { self.toggleSidebar(); });
    api.on('menu-shortcuts', function() { document.getElementById('shortcuts-modal').classList.remove('hidden'); });
    api.on('tool-select', function() { self.selectTool('select'); });
    api.on('tool-text', function() { self.selectTool('text'); });
    api.on('tool-draw', function() { self.selectTool('draw'); });
    api.on('tool-shapes', function() { self.selectTool('shapes'); });
    api.on('tool-image', function() { self.selectTool('image'); });
    api.on('tool-signature', function() { self.selectTool('signature'); });
  }

  setupKeyboardShortcuts() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o': e.preventDefault(); self.openFile(); break;
          case 's': e.preventDefault(); self.saveFile(); break;
          case 'e': e.preventDefault(); self.showExportModal(); break;
          case 'z': e.preventDefault(); self.undo(); break;
          case 'y': e.preventDefault(); self.redo(); break;
          case 't': e.preventDefault(); self.toggleSidebar(); break;
          case 'f': e.preventDefault(); if (self.findReplace) self.findReplace.toggle(); break;
          case 'h': e.preventDefault(); self.toggleTheme(); break;
          case 'w': e.preventDefault(); if (self.tabsManager) self.closeCurrentTab(); break;
          case '=': case '+': e.preventDefault(); if (self.pdfViewer) self.pdfViewer.zoomIn(); break;
          case '-': e.preventDefault(); if (self.pdfViewer) self.pdfViewer.zoomOut(); break;
          case '0': e.preventDefault(); if (self.pdfViewer) self.pdfViewer.setZoom(1); break;
          case '1': e.preventDefault(); if (self.pdfViewer) self.pdfViewer.fitWidth(); break;
          case '2': e.preventDefault(); if (self.pdfViewer) self.pdfViewer.fitPage(); break;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          self.nextTab();
        }
        return;
      }

      switch (e.key) {
        case 'Delete': case 'Backspace':
          if (self.annotationLayer) self.annotationLayer.deleteSelected(); break;
        case 'Escape':
          if (self.annotationLayer) self.annotationLayer.deselectAll(); break;
        case 'v': case 'V':
          self.selectTool('select'); break;
        case 't': case 'T':
          self.selectTool('text'); break;
        case 'd': case 'D':
          self.selectTool('draw'); break;
        case 's': case 'S':
          self.selectTool('shapes'); break;
        case 'i': case 'I':
          self.selectTool('image'); break;
        case 'e': case 'E':
          self.selectTool('edit-text'); break;
        case 'w': case 'W':
          self.selectTool('watermark'); break;
      }
    });
  }

  setupSignatureModal() {
    var self = this;
    var canvas = document.getElementById('signature-canvas');
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var lastX, lastY;

    document.querySelectorAll('.sig-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.sig-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.sig-tab-content').forEach(function(c) { c.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('sigtab-' + tab.dataset.sigtab).classList.add('active');
      });
    });

    canvas.addEventListener('mousedown', function(e) {
      drawing = true;
      var rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', function(e) {
      if (!drawing) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      ctx.strokeStyle = document.getElementById('sig-color').value;
      ctx.lineWidth = document.getElementById('sig-width').value;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    });

    canvas.addEventListener('mouseup', function() { drawing = false; });
    canvas.addEventListener('mouseleave', function() { drawing = false; });

    document.getElementById('btn-clear-signature').addEventListener('click', function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    var uploadArea = document.getElementById('sig-upload-area');
    var fileInput = document.getElementById('sig-file-input');
    var preview = document.getElementById('sig-preview');

    uploadArea.addEventListener('click', function() { fileInput.click(); });
    uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent)'; });
    uploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = ''; });
    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      if (e.dataTransfer.files.length > 0) {
        self.loadSignatureImage(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        self.loadSignatureImage(e.target.files[0]);
      }
    });

    document.getElementById('btn-apply-signature').addEventListener('click', function() {
      var activeTab = document.querySelector('.sig-tab.active').dataset.sigtab;
      var dataUrl;
      if (activeTab === 'draw') {
        dataUrl = canvas.toDataURL('image/png');
      } else {
        dataUrl = preview.src;
      }
      if (dataUrl && self.annotationLayer) {
        self.annotationLayer.addSignatureImage(dataUrl);
        document.getElementById('signature-modal').classList.add('hidden');
      }
    });
  }

  loadSignatureImage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var preview = document.getElementById('sig-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  async openFile() {
    var self = this;
    var api = window.electronAPI;
    if (api) {
      var result = await api.openFile();
      if (result) {
        if (self.tabsManager && self.tabsManager.hasOpenTabs()) {
          self.tabsManager.addTab(result.name, result.data, result.filePath);
        } else {
          self.loadPdf(result.data, result.filePath, result.name);
        }
      }
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = function(e) { self.loadPdfFromFile(e.target.files[0]); };
      input.click();
    }
  }

  async loadPdfFromFile(file) {
    var arrayBuffer = await file.arrayBuffer();
    var data = Array.from(new Uint8Array(arrayBuffer));
    if (this.tabsManager && this.tabsManager.hasOpenTabs()) {
      this.tabsManager.addTab(file.name, data, null);
    } else {
      this.loadPdf(data, null, file.name);
    }
  }

  async loadPdf(data, filePath, fileName) {
    try {
      this.currentFilePath = filePath;
      this.currentFileName = fileName;

      document.getElementById('welcome-screen').classList.add('hidden');
      document.getElementById('editor-ui').classList.remove('hidden');

      if (!this.pdfViewer) {
        this.pdfViewer = new PDFViewer();
        this.annotationLayer = new AnnotationLayer(this.pdfViewer);
        this.thumbnailPanel = new ThumbnailPanel(this.pdfViewer);
        this.toolbar = new Toolbar(this.pdfViewer, this.annotationLayer);
        this.textEditMode = new TextEditMode(this.pdfViewer);
        this.findReplace = new FindReplace(this.pdfViewer);
        this.findReplace.init();
        this.tabsManager = new TabsManager();
        this.redactTool = new RedactTool(this.pdfViewer);
        this.formsTool = new FormsTool(this.pdfViewer);
        this.bookmarksPanel = new BookmarksPanel(this.pdfViewer);
        this.bookmarksPanel.init();
      } else {
        this.textEditMode.pdfViewer = this.pdfViewer;
        this.findReplace.pdfViewer = this.pdfViewer;
        this.redactTool.pdfViewer = this.pdfViewer;
        this.formsTool.pdfViewer = this.pdfViewer;
        this.bookmarksPanel.pdfViewer = this.pdfViewer;
      }

      this.watermarkTool.pdfViewer = this.pdfViewer;

      await this.pdfViewer.loadDocument(data);

      this.annotationLayer.init(this.pdfViewer);
      this.thumbnailPanel.render();
      this.updateStatusBar();
      this.updateTitle();

      if (this.textEditMode.active) {
        this.textEditMode.deactivate();
      }

      document.getElementById('status-file').textContent = fileName || 'Sin archivo';
    } catch (err) {
      console.error('Error loading PDF:', err);
      this.showToast('Error al cargar el PDF: ' + err.message, 'error');
    }
  }

  async saveFile() {
    if (!this.annotationLayer) return;
    var api = window.electronAPI;

    try {
      var PDFDocument = PDFLib.PDFDocument;
      var pdfData = await this.pdfViewer.pdfDoc.getData();
      var pdfBytes = new Uint8Array(pdfData);
      var pdfDoc = await PDFDocument.load(pdfBytes);

      if (this.textEditMode && this.textEditMode.changes.length > 0) {
        await this.textEditMode.applyChangesToPdf(pdfDoc);
      }

      var allBytes = await this.annotationLayer.saveToPdf();

      if (this.redactTool && this.redactTool.regions.length > 0) {
        allBytes = await this.redactTool.applyRedaction(pdfDoc);
      }

      if (this.formsTool && this.formsTool.fields.length > 0) {
        allBytes = await this.formsTool.applyFormFields(pdfDoc);
      }

      if (this.bookmarksPanel && this.bookmarksPanel.bookmarks.length > 0) {
        allBytes = await this.bookmarksPanel.applyBookmarksToPdf(pdfDoc);
      }

      if (this.currentFilePath && api) {
        var success = await api.saveFileDirect({ filePath: this.currentFilePath, data: Array.from(allBytes) });
        if (success) {
          this.showToast('PDF guardado correctamente', 'success');
        } else {
          this.showToast('Error al guardar el PDF', 'error');
        }
      } else {
        await this.saveFileAs();
      }
    } catch (err) {
      console.error('Error saving:', err);
      this.showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  async saveFileAs() {
    if (!this.annotationLayer) return;
    var api = window.electronAPI;

    try {
      var pdfBytes = await this.annotationLayer.saveToPdf();
      if (api) {
        var result = await api.saveFile({
          data: Array.from(pdfBytes),
          defaultPath: this.currentFileName || 'documento.pdf'
        });
        if (result) {
          this.currentFilePath = result;
          this.showToast('PDF guardado correctamente', 'success');
          this.updateTitle();
        }
      }
    } catch (err) {
      console.error('Error saving:', err);
      this.showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  undo() {
    if (this.annotationLayer) this.annotationLayer.undo();
  }

  redo() {
    if (this.annotationLayer) this.annotationLayer.redo();
  }

  toggleSidebar() {
    var self = this;
    var sidebar = document.getElementById('sidebar');
    var btn = document.getElementById('btn-toggle-sidebar');
    sidebar.classList.toggle('collapsed');
    btn.classList.toggle('active');
    setTimeout(function() {
      if (self.pdfViewer) {
        if (self.pdfViewer.fitMode === 'width') {
          self.pdfViewer.fitWidth();
        } else if (self.pdfViewer.fitMode === 'page') {
          self.pdfViewer.fitPage();
        } else {
          self.pdfViewer.renderCurrentPage();
        }
      }
    }, 280);
  }

  switchSidebarTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
  }

  selectTool(tool) {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.querySelector('[data-tool="' + tool + '"]');
    if (btn) btn.classList.add('active');

    if (this.textEditMode && this.textEditMode.active && tool !== 'edit-text') {
      this.textEditMode.deactivate();
    }
    if (this.redactTool) this.redactTool.deactivate();
    if (this.formsTool) this.formsTool.deactivate();

    if (tool === 'edit-text') {
      if (this.annotationLayer) this.annotationLayer.setTool('select');
      if (this.textEditMode) {
        this.textEditMode.activate(this.pdfViewer.currentPage);
      }
      document.getElementById('text-props').style.display = 'none';
      document.getElementById('shape-props').style.display = 'none';
      document.getElementById('draw-props').style.display = 'none';
    } else if (tool === 'watermark') {
      if (this.watermarkTool) this.watermarkTool.showModal();
      if (this.annotationLayer) this.annotationLayer.setTool('select');
      document.getElementById('text-props').style.display = 'none';
      document.getElementById('shape-props').style.display = 'none';
      document.getElementById('draw-props').style.display = 'none';
    } else if (tool === 'redact') {
      if (this.annotationLayer) this.annotationLayer.setTool('select');
      if (this.redactTool) this.redactTool.activate();
      document.getElementById('text-props').style.display = 'none';
      document.getElementById('shape-props').style.display = 'none';
      document.getElementById('draw-props').style.display = 'none';
    } else if (tool === 'form-text') {
      if (this.annotationLayer) this.annotationLayer.setTool('select');
      if (this.formsTool) this.formsTool.activate('text');
      document.getElementById('text-props').style.display = 'none';
      document.getElementById('shape-props').style.display = 'none';
      document.getElementById('draw-props').style.display = 'none';
    } else if (tool === 'form-check') {
      if (this.annotationLayer) this.annotationLayer.setTool('select');
      if (this.formsTool) this.formsTool.activate('checkbox');
      document.getElementById('text-props').style.display = 'none';
      document.getElementById('shape-props').style.display = 'none';
      document.getElementById('draw-props').style.display = 'none';
    } else {
      if (this.annotationLayer) {
        this.annotationLayer.setTool(tool);
      }

      document.getElementById('text-props').style.display = tool === 'text' ? 'block' : 'none';
      document.getElementById('shape-props').style.display = tool === 'shapes' ? 'block' : 'none';
      document.getElementById('draw-props').style.display = tool === 'draw' ? 'block' : 'none';
    }

    var toolNames = {
      select: 'Seleccionar', text: 'Texto', draw: 'Dibujar',
      shapes: 'Formas', image: 'Imagen', signature: 'Firma',
      highlight: 'Resaltar', eraser: 'Borrar',
      'edit-text': 'Editar texto', watermark: 'Marca de agua',
      redact: 'Redactar', 'form-text': 'Formulario', 'form-check': 'Checkbox'
    };
    document.getElementById('status-tool').textContent = 'Herramienta: ' + (toolNames[tool] || tool);

    if (tool === 'image') this.handleImageTool();
    if (tool === 'signature') this.showSignatureModal();
  }

  toggleStyle(style) {
    var btn = document.getElementById('prop-' + style);
    btn.classList.toggle('active');
    if (this.annotationLayer) {
      this.annotationLayer.setTextStyle(style, btn.classList.contains('active'));
    }
  }

  toggleTheme() {
    this.isLightTheme = !this.isLightTheme;
    document.body.classList.toggle('light-theme', this.isLightTheme);
    this.showToast(this.isLightTheme ? 'Tema claro' : 'Tema oscuro', 'info');
  }

  closeCurrentTab() {
    if (this.tabsManager && this.tabsManager.activeTabId) {
      this.tabsManager.closeTab(this.tabsManager.activeTabId);
    }
  }

  nextTab() {
    if (!this.tabsManager || this.tabsManager.tabs.length <= 1) return;
    var idx = this.tabsManager.tabs.findIndex(function(t) { return t.id === this.tabsManager.activeTabId; }.bind(this));
    var next = (idx + 1) % this.tabsManager.tabs.length;
    this.tabsManager.switchTab(this.tabsManager.tabs[next].id);
  }

  async handleImageTool() {
    var self = this;
    var api = window.electronAPI;
    if (api) {
      var result = await api.openImageFile();
      if (result && self.annotationLayer) {
        self.annotationLayer.addImage(result.data);
      }
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function(e) {
        var file = e.target.files[0];
        var reader = new FileReader();
        reader.onload = function(ev) {
          if (self.annotationLayer) self.annotationLayer.addImage(ev.target.result);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }

  updateStatusBar() {
    if (!this.pdfViewer) return;
    document.getElementById('status-page').textContent =
      'Pagina ' + this.pdfViewer.currentPage + '/' + this.pdfViewer.totalPages;
    document.getElementById('status-zoom').textContent =
      'Zoom: ' + Math.round(this.pdfViewer.zoom * 100) + '%';
  }

  updateTitle() {
    var name = this.currentFileName || 'Sin archivo';
    document.title = name + ' - Editor PDF';
  }

  showToast(message, type) {
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  }

  showMergeModal() {
    this.mergeFiles = [];
    document.getElementById('merge-file-list').innerHTML = '<p class="empty-text">No hay archivos seleccionados</p>';
    document.getElementById('btn-do-merge').disabled = true;
    document.getElementById('merge-modal').classList.remove('hidden');
  }

  async addMergeFiles() {
    var self = this;
    var api = window.electronAPI;
    if (api) {
      var results = await api.openMultipleFiles();
      if (results) {
        self.mergeFiles = self.mergeFiles.concat(results);
        self.renderMergeList();
      }
    }
  }

  renderMergeList() {
    var self = this;
    var list = document.getElementById('merge-file-list');
    if (this.mergeFiles.length === 0) {
      list.innerHTML = '<p class="empty-text">No hay archivos seleccionados</p>';
      document.getElementById('btn-do-merge').disabled = true;
      return;
    }

    var html = '';
    for (var i = 0; i < this.mergeFiles.length; i++) {
      html += '<div class="merge-file-item" data-index="' + i + '">' +
        '<span class="file-index">' + (i + 1) + '</span>' +
        '<span class="file-name">' + this.mergeFiles[i].name + '</span>' +
        '<button class="file-remove" data-index="' + i + '">&times;</button>' +
        '</div>';
    }
    list.innerHTML = html;

    list.querySelectorAll('.file-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.mergeFiles.splice(parseInt(btn.dataset.index), 1);
        self.renderMergeList();
      });
    });

    document.getElementById('btn-do-merge').disabled = this.mergeFiles.length < 2;
  }

  async doMerge() {
    if (this.mergeFiles.length < 2) return;

    try {
      var PDFDocument = PDFLib.PDFDocument;
      var mergedPdf = await PDFDocument.create();

      for (var i = 0; i < this.mergeFiles.length; i++) {
        var file = this.mergeFiles[i];
        var pdfBytes = new Uint8Array(file.data);
        var pdf = await PDFDocument.load(pdfBytes);
        var copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(function(page) { mergedPdf.addPage(page); });
      }

      var mergedBytes = await mergedPdf.save();
      document.getElementById('merge-modal').classList.add('hidden');

      this.loadPdf(Array.from(mergedBytes), null, 'PDFs combinados.pdf');
      this.showToast('PDFs combinados correctamente', 'success');
    } catch (err) {
      console.error('Error merging:', err);
      this.showToast('Error al combinar PDFs: ' + err.message, 'error');
    }
  }

  showExportModal() {
    if (!this.pdfViewer) return;
    document.getElementById('export-modal').classList.remove('hidden');
  }

  async doExport() {
    if (!this.pdfViewer) return;
    var self = this;
    var api = window.electronAPI;

    var format = document.getElementById('export-format').value;
    var scale = parseInt(document.getElementById('export-dpi').value);
    var range = document.getElementById('export-range').value;

    try {
      var pages;
      if (range === 'current') {
        pages = [this.pdfViewer.currentPage];
      } else {
        pages = [];
        for (var i = 1; i <= this.pdfViewer.totalPages; i++) pages.push(i);
      }

      if (range === 'all' && api) {
        var folder = await api.selectFolder();
        if (!folder) return;

        var images = [];
        for (var j = 0; j < pages.length; j++) {
          var dataUrl = await this.pdfViewer.renderPageToImage(pages[j], scale);
          images.push({ page: pages[j], data: dataUrl });
        }

        await api.saveImagesBatch({ folder: folder, images: images, format: format });
        this.showToast('Imagenes exportadas a: ' + folder, 'success');
      } else {
        var dataUrl2 = await this.pdfViewer.renderPageToImage(pages[0], scale);
        if (api) {
          await api.saveImage({
            data: dataUrl2,
            defaultPath: 'pagina_' + pages[0] + '.' + format,
            format: format
          });
        }
      }

      document.getElementById('export-modal').classList.add('hidden');
    } catch (err) {
      console.error('Error exporting:', err);
      this.showToast('Error al exportar: ' + err.message, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  window.app = new App();
});
