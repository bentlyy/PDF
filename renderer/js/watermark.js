class WatermarkTool {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
  }

  showModal() {
    var existing = document.getElementById('watermark-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'watermark-modal';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-overlay"></div>' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<h3>Agregar marca de agua</h3>' +
          '<button class="modal-close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="prop-row">' +
            '<label>Texto:</label>' +
            '<input type="text" id="wm-text" class="fr-input" placeholder="BORRADOR" value="BORRADOR">' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Color:</label>' +
            '<input type="color" id="wm-color" value="#cccccc">' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Tamano:</label>' +
            '<input type="number" id="wm-size" value="60" min="20" max="200">' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Opacidad:</label>' +
            '<input type="range" id="wm-opacity" min="5" max="50" value="20">' +
            '<span id="wm-opacity-val">20%</span>' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Rotacion:</label>' +
            '<input type="range" id="wm-rotation" min="-90" max="90" value="-45">' +
            '<span id="wm-rotation-val">-45&deg;</span>' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Posicion:</label>' +
            '<select id="wm-position">' +
              '<option value="center">Centro</option>' +
              '<option value="diagonal">Diagonal (repetir)</option>' +
              '<option value="top">Arriba</option>' +
              '<option value="bottom">Abajo</option>' +
            '</select>' +
          '</div>' +
          '<div class="prop-row">' +
            '<label>Alcance:</label>' +
            '<select id="wm-scope">' +
              '<option value="current">Pagina actual</option>' +
              '<option value="all">Todas las paginas</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary modal-cancel">Cancelar</button>' +
          '<button id="btn-apply-wm" class="btn btn-primary">Aplicar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var self = this;
    modal.querySelector('.modal-overlay').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.modal-close').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.modal-cancel').addEventListener('click', function() { modal.remove(); });

    document.getElementById('wm-opacity').addEventListener('input', function(e) {
      document.getElementById('wm-opacity-val').textContent = e.target.value + '%';
    });
    document.getElementById('wm-rotation').addEventListener('input', function(e) {
      document.getElementById('wm-rotation-val').innerHTML = e.target.value + '&deg;';
    });

    document.getElementById('btn-apply-wm').addEventListener('click', function() {
      self.applyWatermark();
      modal.remove();
    });
  }

  async applyWatermark() {
    var text = document.getElementById('wm-text').value || 'BORRADOR';
    var colorHex = document.getElementById('wm-color').value;
    var size = parseInt(document.getElementById('wm-size').value) || 60;
    var opacity = parseInt(document.getElementById('wm-opacity').value) / 100;
    var rotation = parseInt(document.getElementById('wm-rotation').value) || -45;
    var position = document.getElementById('wm-position').value;
    var scope = document.getElementById('wm-scope').value;

    var PDFDocument = PDFLib.PDFDocument;
    var rgb = PDFLib.rgb;
    var degrees = PDFLib.degrees;

    var r = parseInt(colorHex.substr(1, 2), 16) / 255;
    var g = parseInt(colorHex.substr(3, 2), 16) / 255;
    var b = parseInt(colorHex.substr(5, 2), 16) / 255;

    var pdfData = await window.app.pdfViewer.pdfDoc.getData();
    var pdfBytes = new Uint8Array(pdfData);
    var pdfDoc = await PDFDocument.load(pdfBytes);
    var pages = pdfDoc.getPages();

    var font = await pdfDoc.embedFont('Helvetica');

    var pageIndices = scope === 'all'
      ? pages.map(function(_, i) { return i; })
      : [window.app.pdfViewer.currentPage - 1];

    for (var p = 0; p < pageIndices.length; p++) {
      var page = pages[pageIndices[p]];
      var w = page.getWidth();
      var h = page.getHeight();

      if (position === 'diagonal') {
        for (var dx = 0; dx < w; dx += 250) {
          for (var dy = 0; dy < h; dy += 150) {
            page.drawText(text, {
              x: dx,
              y: dy,
              size: size,
              font: font,
              color: rgb(r, g, b),
              opacity: opacity,
              rotate: degrees(rotation)
            });
          }
        }
      } else if (position === 'center') {
        var textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: (w - textWidth) / 2,
          y: h / 2,
          size: size,
          font: font,
          color: rgb(r, g, b),
          opacity: opacity,
          rotate: degrees(rotation)
        });
      } else if (position === 'top') {
        var tw = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: (w - tw) / 2,
          y: h - size - 20,
          size: size,
          font: font,
          color: rgb(r, g, b),
          opacity: opacity,
          rotate: degrees(rotation)
        });
      } else if (position === 'bottom') {
        var tw2 = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: (w - tw2) / 2,
          y: 20,
          size: size,
          font: font,
          color: rgb(r, g, b),
          opacity: opacity,
          rotate: degrees(rotation)
        });
      }
    }

    var newPdfBytes = await pdfDoc.save();
    window.app.loadPdf(Array.from(newPdfBytes), window.app.currentFilePath, window.app.currentFileName);
    window.app.showToast('Marca de agua aplicada', 'success');
  }
}

window.WatermarkTool = WatermarkTool;
