// Archivos para Importar / Exportar: CSV, Excel (.xlsx) y PDF (vista para imprimir), sin librerías externas.
// El .xlsx es un ZIP con XML adentro: para escribirlo se arma un ZIP sin compresión y para leerlo se usa
// el descompresor del navegador (DecompressionStream).

type Celda = string | number | null | undefined

const BOM = String.fromCharCode(0xFEFF)

export const descargar = (blob: Blob, nombre: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nombre
  link.click()
  // Se libera en el ciclo siguiente: revocarlo en el acto puede cancelar la descarga en Firefox y Safari
  setTimeout(() => URL.revokeObjectURL(link.href))
}

export const hoy = () => new Date().toLocaleDateString('sv-SE')

// ---------------------------------------------------------------------------- CSV

// Separado por punto y coma, números con coma decimal y BOM: así Excel en español lo abre bien
export const generarCsv = (columnas: string[], filas: Celda[][]) => {
  const campo = (v: Celda) => {
    const t = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v ?? '')
    return `"${t.replace(/"/g, '""')}"`
  }
  const texto = [columnas, ...filas].map(f => f.map(campo).join(';')).join('\r\n')
  return new Blob([BOM + texto], { type: 'text/csv;charset=utf-8' })
}

// Excel en Windows guarda los CSV en ANSI (Windows-1252): si no es UTF-8 válido se lee como tal
export const leerTexto = async (archivo: File) => {
  const bytes = await archivo.arrayBuffer()
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('windows-1252').decode(bytes) }
}

// ---------------------------------------------------------------------------- ZIP

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (datos: Uint8Array) => {
  let c = 0xFFFFFFFF
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ZIP "store" (sin compresión): alcanza para un .xlsx y no necesita librerías
const armarZip = (archivos: { nombre: string; datos: Uint8Array }[]) => {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const { nombre, datos } of archivos) {
    const n = enc.encode(nombre), crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true)
    local.setUint32(14, crc, true); local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true)
    local.setUint16(26, n.length, true)
    const cab = new DataView(new ArrayBuffer(46))
    cab.setUint32(0, 0x02014b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 20, true)
    cab.setUint32(16, crc, true); cab.setUint32(20, datos.length, true); cab.setUint32(24, datos.length, true)
    cab.setUint16(28, n.length, true); cab.setUint32(42, offset, true)
    partes.push(new Uint8Array(local.buffer), n, datos)
    central.push(new Uint8Array(cab.buffer), n)
    offset += 30 + n.length + datos.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true)
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], { type: 'application/zip' })
}

// Lee todas las entradas de un ZIP (store o deflate)
const leerZip = async (buffer: ArrayBuffer) => {
  const v = new DataView(buffer), bytes = new Uint8Array(buffer)
  let fin = bytes.length - 22
  while (fin >= 0 && v.getUint32(fin, true) !== 0x06054b50) fin--
  if (fin < 0) throw new Error('El archivo no es un Excel (.xlsx) válido')
  const cantidad = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const dec = new TextDecoder()
  const entradas = new Map<string, Uint8Array>()
  for (let i = 0; i < cantidad; i++) {
    const metodo = v.getUint16(p + 10, true), tam = v.getUint32(p + 20, true)
    const lnNombre = v.getUint16(p + 28, true), lnExtra = v.getUint16(p + 30, true), lnComent = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + lnNombre))
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const datos = bytes.subarray(ini, ini + tam)
    entradas.set(nombre, metodo === 0 ? datos
      : new Uint8Array(await new Response(new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()))
    p += 46 + lnNombre + lnExtra + lnComent
  }
  return entradas
}

// ---------------------------------------------------------------------------- Excel

// Escapa para XML y saca los caracteres de control que Excel no acepta (salvo tab y saltos de línea)
const xml = (t: string) => [...t].filter(ch => {
  const c = ch.charCodeAt(0)
  return c >= 32 || c === 9 || c === 10 || c === 13
}).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const letraColumna = (i: number) => {
  let s = ''
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

// Hoja única con el encabezado en negrita y fijo (como el Excel que exporta el catálogo)
export const generarXlsx = (titulo: string, columnas: string[], filas: Celda[][]) => {
  const fila = (valores: Celda[], r: number, estilo = '') => `<row r="${r}">${valores.map((val, c) => {
    const ref = `${letraColumna(c)}${r}`
    if (typeof val === 'number' && Number.isFinite(val)) return `<c r="${ref}"${estilo}><v>${val}</v></c>`
    if (val === null || val === undefined || val === '') return ''
    return `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${xml(String(val))}</t></is></c>`
  }).join('')}</row>`
  const hoja = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<sheetData>${fila(columnas, 1, ' s="1"')}${filas.map((f, i) => fila(f, i + 2)).join('')}</sheetData></worksheet>`
  const enc = new TextEncoder()
  const archivos: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(titulo.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': hoja,
  }
  const zip = armarZip(Object.entries(archivos).map(([nombre, contenido]) => ({ nombre, datos: enc.encode(contenido) })))
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// Primera hoja de un .xlsx como filas de texto (lo que exporta el catálogo o cualquier Excel)
export const leerXlsx = async (archivo: File): Promise<string[][]> => {
  const zip = await leerZip(await archivo.arrayBuffer())
  const dec = new TextDecoder()
  const parsear = (nombre: string) => {
    const datos = zip.get(nombre)
    return datos ? new DOMParser().parseFromString(dec.decode(datos), 'application/xml') : null
  }
  const compartidos = [...(parsear('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [])]
    .map(si => [...si.getElementsByTagName('t')].map(t => t.textContent ?? '').join(''))
  // La primera hoja según el libro (normalmente xl/worksheets/sheet1.xml)
  const rels = parsear('xl/_rels/workbook.xml.rels')
  const primera = parsear('xl/workbook.xml')?.getElementsByTagName('sheet')[0]
  const rid = primera?.getAttribute('r:id')
  const destino = rid && [...(rels?.getElementsByTagName('Relationship') ?? [])].find(r => r.getAttribute('Id') === rid)?.getAttribute('Target')
  const hoja = parsear(destino ? `xl/${destino.replace(/^\/?xl\//, '')}` : 'xl/worksheets/sheet1.xml')
  if (!hoja) throw new Error('No se encontró ninguna hoja en el Excel')

  const columna = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  return [...hoja.getElementsByTagName('row')].map(row => {
    const fila: string[] = []
    for (const c of row.getElementsByTagName('c')) {
      const tipo = c.getAttribute('t')
      const valor = c.getElementsByTagName('v')[0]?.textContent ?? ''
      const texto = tipo === 's' ? compartidos[Number(valor)] ?? ''
        : tipo === 'inlineStr' ? [...c.getElementsByTagName('t')].map(t => t.textContent ?? '').join('')
        : valor
      fila[columna(c.getAttribute('r') ?? 'A1')] = texto
    }
    return Array.from(fila, v => v ?? '')
  })
}

// Filas -> texto CSV con punto y coma (lo que entiende el importador del servidor)
export const filasACsv = (filas: string[][]) =>
  filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')

// ---------------------------------------------------------------------------- PDF

// Abre una vista limpia lista para "Guardar como PDF" desde el diálogo de impresión del navegador
export const imprimirTabla = (titulo: string, subtitulo: string, columnas: string[], filas: Celda[][]) => {
  const ventana = window.open('', '_blank')
  if (!ventana) return false
  const formato = (v: Celda) => typeof v === 'number' ? v.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : String(v ?? '')
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${xml(titulo)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #F5C400; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 18px; margin: 0; text-transform: uppercase; letter-spacing: .04em; }
  small { color: #6B6B6B; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #111; color: #fff; text-align: left; padding: 6px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
  td { padding: 5px 6px; border-bottom: 1px solid #E7E9ED; vertical-align: top; }
  tr:nth-child(even) td { background: #FAFBFC; }
  .num { text-align: right; white-space: nowrap; }
</style></head><body>
<header><div><h1>${xml(titulo)}</h1><small>${xml(subtitulo)}</small></div><small>SH Servicios · ${new Date().toLocaleString('es-AR')}</small></header>
<table><thead><tr>${columnas.map(c => `<th>${xml(c)}</th>`).join('')}</tr></thead>
<tbody>${filas.map(f => `<tr>${f.map(v => `<td class="${typeof v === 'number' ? 'num' : ''}">${xml(formato(v))}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload = () => { window.print() }</script>
</body></html>`)
  ventana.document.close()
  return true
}
