class TabsManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 0;
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'tabs-bar';
    this.container.className = 'tabs-bar hidden';

    var toolbar = document.querySelector('.toolbar-left');
    if (toolbar) {
      toolbar.parentNode.insertBefore(this.container, toolbar.nextSibling);
    }
  }

  addTab(name, data, filePath) {
    this.tabCounter++;
    var id = 'tab-' + this.tabCounter;

    var tab = {
      id: id,
      name: name || 'Documento ' + this.tabCounter,
      data: data,
      filePath: filePath,
      pageNum: 1,
      zoom: 1,
      annotations: null
    };

    this.tabs.push(tab);
    this.renderTabs();
    this.switchTab(id);

    return id;
  }

  closeTab(id) {
    var index = this.tabs.findIndex(function(t) { return t.id === id; });
    if (index === -1) return;

    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.container.classList.add('hidden');
      if (window.app) {
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('editor-ui').classList.add('hidden');
      }
      this.activeTabId = null;
    } else if (this.activeTabId === id) {
      var newIndex = Math.min(index, this.tabs.length - 1);
      this.switchTab(this.tabs[newIndex].id);
    }

    this.renderTabs();
  }

  switchTab(id) {
    var self = this;
    var prevTab = this.tabs.find(function(t) { return t.id === self.activeTabId; });
    var nextTab = this.tabs.find(function(t) { return t.id === id; });
    if (!nextTab) return;

    if (prevTab && window.app && window.app.pdfViewer) {
      prevTab.pageNum = window.app.pdfViewer.currentPage;
      prevTab.zoom = window.app.pdfViewer.zoom;
      if (window.app.annotationLayer) {
        prevTab.annotations = window.app.annotationLayer.objects.map(function(o) {
          return JSON.parse(JSON.stringify({
            type: o.type, left: o.left, top: o.top, width: o.width, height: o.height,
            scaleX: o.scaleX, scaleY: o.scaleY, stroke: o.stroke, strokeWidth: o.strokeWidth,
            fill: o.fill, fontSize: o.fontSize, fontFamily: o.fontFamily,
            fontWeight: o.fontWeight, fontStyle: o.fontStyle, underline: o.underline,
            text: o.text, rx: o.rx, ry: o.ry,
            x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, path: o.path, src: o.src
          }));
        });
      }
    }

    this.activeTabId = id;
    this.container.classList.add('hidden');
    this.renderTabs();

    if (window.app && nextTab.data) {
      document.getElementById('welcome-screen').classList.add('hidden');
      document.getElementById('editor-ui').classList.remove('hidden');

      window.app.currentFilePath = nextTab.filePath;
      window.app.currentFileName = nextTab.name;
      window.app.loadPdf(nextTab.data, nextTab.filePath, nextTab.name);

      setTimeout(function() {
        if (window.app.pdfViewer) {
          window.app.pdfViewer.goToPage(nextTab.pageNum || 1);
          window.app.pdfViewer.setZoom(nextTab.zoom || 1);
        }
      }, 500);
    }
  }

  renderTabs() {
    var self = this;
    this.container.innerHTML = '';

    if (this.tabs.length <= 1) {
      this.container.classList.add('hidden');
      return;
    }

    this.container.classList.remove('hidden');

    for (var i = 0; i < this.tabs.length; i++) {
      var tab = this.tabs[i];
      var tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (tab.id === this.activeTabId ? ' active' : '');
      tabEl.dataset.tabId = tab.id;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = tab.name;
      nameSpan.title = tab.name;

      var closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.dataset.tabId = tab.id;

      tabEl.appendChild(nameSpan);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', (function(tabId) {
        return function() { self.switchTab(tabId); };
      })(tab.id));

      closeBtn.addEventListener('click', (function(e, tabId) {
        e.stopPropagation();
        self.closeTab(tabId);
      })(closeBtn, tab.id));

      this.container.appendChild(tabEl);
    }
  }

  hasOpenTabs() {
    return this.tabs.length > 0;
  }
}

window.TabsManager = TabsManager;
