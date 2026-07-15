class CompressTool {
  constructor() {
  }

  async compressPdf() {
    if (!window.app || !window.app.pdfViewer || !window.app.pdfViewer.pdfDoc) {
      if (window.app) window.app.showToast('No hay PDF cargado', 'error');
      return;
    }

    try {
      window.app.showToast('Comprimiendo PDF...', 'info');

      var PDFDocument = PDFLib.PDFDocument;
      var pdfData = await window.app.pdfViewer.pdfDoc.getData();
      var originalBytes = new Uint8Array(pdfData);
      var originalSize = originalBytes.length;

      var pdfDoc = await PDFDocument.load(originalBytes);
      var pages = pdfDoc.getPages();

      for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        var mediaBox = page.getMediaBox();

        var x = mediaBox.x;
        var y = mediaBox.y;
        var w = mediaBox.width;
        var h = mediaBox.height;

        var roundTo = 0.1;
        page.setMediaBox(
          Math.round(x / roundTo) * roundTo,
          Math.round(y / roundTo) * roundTo,
          Math.round(w / roundTo) * roundTo,
          Math.round(h / roundTo) * roundTo
        );
      }

      var newPdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      });

      var newSize = newPdfBytes.length;
      var reduction = Math.round((1 - newSize / originalSize) * 100);

      var message = 'PDF comprimido: ' + this.formatSize(originalSize) + ' -> ' + this.formatSize(newSize);
      if (reduction > 0) {
        message += ' (-' + reduction + '%)';
      }

      window.app.loadPdf(Array.from(newPdfBytes), window.app.currentFilePath, window.app.currentFileName);
      window.app.showToast(message, 'success');
    } catch (err) {
      console.error('Error compressing:', err);
      window.app.showToast('Error al comprimir: ' + err.message, 'error');
    }
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

window.CompressTool = CompressTool;
