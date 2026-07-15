# Plan: Editor de PDF con Electron

## Arquitectura General

Aplicación de escritorio Electron con interfaz web moderna. El proceso principal maneja operaciones de sistema de archivos y firmas digitales. El proceso renderer maneja visualización, anotaciones y edición visual.

## Stack Tecnológico

| Componente | Librería | Función |
|---|---|---|
| Framework | Electron | App de escritorio |
| UI | HTML/CSS/JS vanilla | Interfaz moderna sin dependencias pesadas |
| Renderizado PDF | `pdfjs-dist` (PDF.js) | Visualizar páginas del PDF en canvas |
| Edición PDF | `pdf-lib` | Crear, modificar, combinar, separar PDFs |
| Anotaciones | `fabric.js` | Dibujar, texto, imágenes, formas sobre el PDF |
| Firma digital | `@signpdf/signpdf` + `node-forge` | Firma criptográfica con certificados P12 |
| Iconos | Lucide Icons | Iconografía de la UI |

## Estructura del Proyecto

```
EditorPDF/
├── package.json
├── main.js                    # Proceso principal de Electron
├── preload.js                 # Puente IPC seguro
├── renderer/
│   ├── index.html             # Ventana principal
│   ├── styles/
│   │   ├── main.css           # Estilos generales
│   │   ├── toolbar.css        # Barra de herramientas
│   │   ├── sidebar.css        # Panel lateral (thumbnails, capas)
│   │   └── modals.css         # Estilos de diálogos modales
│   ├── js/
│   │   ├── app.js             # Inicialización y orquestador
│   │   ├── pdf-viewer.js      # Renderizado y navegación de PDFs
│   │   ├── annotation-layer.js # Capa de anotaciones con fabric.js
│   │   ├── text-tool.js       # Herramienta de texto
│   │   ├── image-tool.js      # Herramienta de inserción de imágenes
│   │   ├── draw-tool.js       # Herramienta de dibujo libre
│   │   ├── shape-tool.js      # Herramienta de formas (rect, círculo, línea)
│   │   ├── signature-tool.js  # Herramienta de firma
│   │   ├── merge-split.js     # Combinar y separar PDFs
│   │   ├── export.js          # Exportar como imagen
│   │   ├── thumbnail-panel.js # Panel de miniaturas
│   │   └── toolbar.js         # Controles de la barra de herramientas
│   └── assets/
│       └── fonts/             # Fuentes para incrustar en PDFs
└── icons/
    └── app.ico                # Icono de la aplicación
```

## Funcionalidades Detalladas

### 1. Visor y Navegación de PDFs
- Abrir PDFs desde sistema de archivos (diálogo nativo)
- Renderizar páginas con PDF.js en canvas de alta resolución
- Navegación: página siguiente/anterior, ir a página específica
- Zoom: +/-, ajustar ancho, ajustar página, porcentaje personalizado
- Panel lateral con miniaturas de todas las páginas
- Modo vista: una página, dos páginas, continuous scroll
- Búsqueda de texto (Ctrl+F)

### 2. Agregar Texto
- Click en el PDF para crear un campo de texto
- Editor de texto inline con fabric.js
- Opciones: tamaño de fuente, color, negrita, cursiva, subrayado
- Arrastrar y redimensionar campos de texto
- Selección múltiple de objetos de texto

### 3. Agregar Imágenes
- Botón para insertar imagen (PNG, JPG, JPEG, SVG)
- Diálogo de selección de archivo
- Arrastrar para posicionar, escalar, rotar
- Soporte para transparencia (PNG)
- Compresión automática para no inflar el PDF

### 4. Dibujar / Anotaciones
- Lápiz libre con grosor y color configurables
- Formas: rectángulo, círculo/óvalo, línea, flecha, estrella
- Resaltar: sobretexto semitransparente
- Subrayar: línea bajo el texto
- Colores predefinidos + selector de color personalizado
- Borrar objetos seleccionados (Delete/Backspace)
- Deshacer/Rehacer (Ctrl+Z / Ctrl+Y)

### 5. Firmar Documentos
- Dibujar firma manuscrita en canvas (pad de firma)
- Subir imagen de firma
- Agregar firma como imagen al PDF
- Posicionar y escalar la firma
- (Opcional avanzado) Firma digital con certificado P12/PFX

### 6. Combinar / Separar PDFs
- Unir múltiples archivos PDF en uno solo
- Arrastrar para reordenar páginas
- Separar: extraer páginas seleccionadas a nuevo PDF
- Eliminar páginas del PDF actual
- Duplicar páginas

### 7. Convertir a Imagen
- Exportar página actual como PNG o JPEG
- Exportar todas las páginas como imágenes
- Configurar resolución (DPI: 72, 150, 300)
- Diálogo de selección de carpeta de destino

### 8. Guardar / Exportar
- Guardar cambios sobre el archivo original
- Guardar como nuevo archivo
- Guardar solo las anotaciones como capa separada (futuro)

## Diseño de la Interfaz

```
┌─────────────────────────────────────────────────────────────┐
│  [Archivo] [Edición] [Ver] [Herramientas]    [🔍] [⚙️]    │  ← Menú bar
├──────┬──────────────────────────────────────┬───────────────┤
│      │  [←] [→] [1/10] [+][-][100%][⛶]    │  Capas        │  ← Toolbar
│ Mini │──────────────────────────────────────│  ─────────── │
│ -atu │                                      │  [T] Texto    │
│ ras  │         VISTA DEL PDF                │  [📷] Imagen  │
│      │         (canvas + overlay)           │  [✏️] Dibujo  │
│ [□]  │                                      │  [⬜] Formas  │
│ [□]  │                                      │  [✍️] Firma   │
│ [□]  │                                      │  [📄] Merge   │
│ [□]  │                                      │  [🖼️] Export  │
│      │                                      │               │
├──────┴──────────────────────────────────────┴───────────────┤
│  Listo | Página 1/10 | Zoom 100% | Herramienta: Seleccionar │  ← Status bar
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

```
1. Abrir PDF
   → Electron abre diálogo de archivo
   → Lee bytes del PDF
   → pdfjs-dist renderiza página actual a canvas
   → pdf-lib carga el PDF para edición posterior

2. Editar (añadir texto/imagen/dibujo)
   → fabric.js captura el objeto en su canvas overlay
   → El objeto se almacena en memoria junto con la página

3. Guardar
   → Serializa objetos de fabric.js para la página actual
   → pdf-lib incrusta los objetos sobre el PDF original
   → Escribe el PDF modificado al disco

4. Combinar PDFs
   → Usuario selecciona archivos
   → pdf-lib carga cada uno
   → Copia páginas de uno a otro en orden deseado
   → Guarda el resultado

5. Exportar como imagen
   → pdfjs-dist renderiza la página a canvas a alta resolución
   → canvas.toDataURL() exporta como PNG/JPEG
   → Descarga o guarda en carpeta seleccionada
```

## Implementación Paso a Paso

### Paso 1: Configuración inicial
- Inicializar proyecto npm
- Instalar dependencias: electron, pdfjs-dist, pdf-lib, fabric, @signpdf/signpdf, node-forge
- Configurar electron-builder para empaquetado
- Crear main.js, preload.js, estructura de carpetas

### Paso 2: Ventana principal y UI base
- Crear index.html con layout de la interfaz
- Estilos CSS modernos (tema oscuro/claro)
- Barra de menú nativa de Electron
- Toolbar con iconos
- Panel lateral colapsable
- Barra de estado

### Paso 3: Visor de PDF
- Implementar apertura de archivos
- Renderizado de páginas con PDF.js
- Navegación (prev/next/go-to)
- Zoom (in/out/fit width/fit page)
- Panel de miniaturas
- Scroll continuo

### Paso 4: Herramienta de selección y texto
- Modo selección (mover/escalar objetos)
- Herramienta de texto: click para crear, doble-click para editar
- Propiedades de texto (fuente, tamaño, color, estilo)

### Paso 5: Herramienta de imágenes
- Botón insertar imagen
- Diálogo de selección
- Posicionamiento con drag & drop
- Escalado y rotación

### Paso 6: Herramientas de dibujo y formas
- Lápiz libre
- Formas: rectángulo, elipse, línea, flecha
- Propiedades: grosor, color, fill/stroke

### Paso 7: Firma
- Canvas para dibujar firma
- Subir imagen de firma
- Posicionar en el PDF

### Paso 8: Combinar y separar
- UI para seleccionar archivos PDF a combinar
- Reordenamiento de páginas
- Extracción de páginas a nuevo PDF
- Eliminación de páginas

### Paso 9: Exportar como imagen
- Exportar página actual
- Exportar todas las páginas
- Selección de formato y resolución

### Paso 10: Guardar PDF
- Serializar anotaciones
- Incrustar en PDF con pdf-lib
- Guardar archivo

### Paso 11: Pulido y extras
- Atajos de teclado
- Menú contextual
- Tema oscuro/claro
- Barra de progreso para operaciones largas
- Manejo de errores amigable

## Dependencias (package.json)

```json
{
  "name": "editor-pdf",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win"
  },
  "dependencies": {
    "pdfjs-dist": "^4.0.379",
    "pdf-lib": "^1.17.1",
    "fabric": "^6.0.0",
    "@signpdf/signpdf": "^3.2.2",
    "@signpdf/placeholder-plain": "^3.2.2",
    "@signpdf/signer-p12": "^3.2.2",
    "node-forge": "^1.3.1"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

## Notas Técnicas Importantes

1. **Coordenadas**: PDF usa origen abajo-izquierda, canvas usa arriba-izquierda. Se necesita traducción.
2. **pdf-lib** permite modificar PDFs existentes pero no puede renderizar. Siempre combinar con pdfjs-dist.
3. **fabric.js** maneja el overlay de anotaciones. Al guardar, se serializan los objetos y se incrustan con pdf-lib.
4. **Firma digital** requiere certificado P12. La firma visual (manuscrita) es solo una imagen incrustada.
5. **Fuentes**: Para incrustar texto con fuentes específicas, pdf-lib requiere embed del archivo TTF completo.
6. **Performance**: Para PDFs grandes, renderizar páginas bajo demanda (lazy loading) con Web Workers.
