import { PrismaClient, TipoProducto } from '@prisma/client';
import { getIO } from '../socket';
import { httpError } from '../utils/http';
import { siguienteCodigoNumerico } from './product.service';

const prisma = new PrismaClient();

// Importación de maquinaria y repuestos desde CSV, como "Importar" del panel del catálogo:
// primero se previsualiza (con los errores de cada fila) y recién después se confirma.
// Acepta tal cual lo que exporta el catálogo (Maquinaria / Repuestos en CSV o Excel): las columnas que el ERP
// no maneja (ficha técnica, visitas, etc.) se ignoran, marca y modelo van a la descripción y los precios
// en dólares se pasan a pesos con la cotización que se indique.

export const COLUMNAS = [
  'codigo', 'nombre', 'descripcion', 'categoria', 'costo', 'ganancia', 'precio', 'stock', 'stock_minimo', 'activo',
  // Columnas del catálogo que se aprovechan
  'marca', 'modelo', 'moneda', 'resumen',
] as const;
type Columna = typeof COLUMNAS[number];

// Encabezados del catálogo con otro nombre que el de la plantilla del ERP
const SINONIMOS: Record<string, Columna> = {
  codigo_interno: 'codigo', precio_final: 'precio', ganancia_porcentaje: 'ganancia', costo_precio: 'costo',
  stock_minimo_unidades: 'stock_minimo', publicado: 'activo', publicada: 'activo',
};

export const TIPOS: Record<string, TipoProducto> = { maquinaria: 'MAQUINARIA', repuestos: 'REPUESTO' };
const ETIQUETA: Record<TipoProducto, string> = { MAQUINARIA: 'una máquina', REPUESTO: 'un repuesto' };

const MAX_FILAS = 5000;

// Columnas que solo trae el Excel/CSV del catálogo de un tipo (ya normalizadas: "Año" -> "ano", "Código OEM" -> "codigo_oem")
const COLUMNAS_SOLO_MAQUINARIA = ['modelo', 'ano', 'anio', 'horas', 'combustible', 'capacidad_kg', 'nro_de_serie', 'numero_serie', 'tipo_de_mastil', 'tipo_mastil'];
const COLUMNAS_SOLO_REPUESTOS = ['codigo_oem', 'fabricante', 'codigo_fabricante', 'origen', 'compatible_con', 'compatibilidad', 'compatibilidades'];
const NOMBRE_TIPO: Record<TipoProducto, string> = { MAQUINARIA: 'Maquinaria', REPUESTO: 'Repuestos' };
const archivoDeOtroTipo = (delArchivo: TipoProducto) =>
  `Este archivo es de ${NOMBRE_TIPO[delArchivo]}, pero elegiste importar ${NOMBRE_TIPO[delArchivo === 'MAQUINARIA' ? 'REPUESTO' : 'MAQUINARIA']}. `
  + `Cambiá "¿Qué querés importar?" a ${NOMBRE_TIPO[delArchivo]} y volvé a previsualizar.`;
const BOM = 0xFEFF;

type Datos = {
  codigo: string | null; nombre?: string; descripcion?: string; categoria?: string
  precioCosto?: number; precio?: number; stock?: number; stockMinimo?: number; activo?: boolean
};
type FilaOk = { linea: number; datos: Datos; existe: boolean };
type FilaError = { linea: number; codigo: string; nombre: string; errores: string[] };

// "Código de barras" -> "codigo_de_barras": los encabezados se comparan sin acentos, mayúsculas ni espacios
const normalizarEncabezado = (h: string) =>
  h.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Separa un CSV respetando comillas ("a; b" queda como un solo campo y "" es una comilla literal).
// El separador (punto y coma o coma) se deduce de la fila de encabezados.
const parsearCsv = (texto: string) => {
  let contenido = texto.charCodeAt(0) === BOM ? texto.slice(1) : texto;
  // El CSV del catálogo empieza con "sep=;" (le indica el separador a Excel): se usa ese y se saca la línea
  const indicado = /^sep=(.)\r?\n/i.exec(contenido);
  if (indicado) contenido = contenido.slice(indicado[0].length);
  const primera = contenido.split(/\r?\n/, 1)[0] ?? '';
  const sep = indicado?.[1] ?? ((primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ',');
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false;
  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (comillas) {
      if (c === '"' && contenido[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenido[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
};

// Acepta "1.234,56" (formato argentino), "1234.56" y "$ 1234"; null si está vacío, NaN si no es un número
const numero = (texto: string): number | null => {
  let t = texto.replace(/[\s$]/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const booleano = (texto: string): boolean | null | undefined => {
  const t = texto.trim().toLowerCase();
  if (!t) return undefined;
  if (['si', 'sí', '1', 'true', 'activo', 'x'].includes(t)) return true;
  if (['no', '0', 'false', 'inactivo'].includes(t)) return false;
  return null;
};

const validar = async (tipoTexto: string, contenido: unknown, cotizacionTexto?: unknown) => {
  const tipo = TIPOS[tipoTexto];
  const cotizacion = Number(cotizacionTexto) > 0 ? Number(cotizacionTexto) : null;
  if (!tipo) throw httpError(400, 'Elegí qué querés importar: maquinaria o repuestos');
  if (typeof contenido !== 'string' || !contenido.trim()) throw httpError(400, 'El archivo está vacío');

  const filas = parsearCsv(contenido).filter(f => f.some(c => c.trim() !== ''));
  if (filas.length < 2) throw httpError(400, 'El archivo no tiene filas para importar (la primera fila tiene que ser la de los encabezados)');
  if (filas.length - 1 > MAX_FILAS) throw httpError(400, `El archivo tiene más de ${MAX_FILAS} filas`);

  const crudos = filas[0].map(normalizarEncabezado);
  // El archivo del catálogo dice de qué es por sus columnas: si no coincide con lo elegido, un solo aviso claro
  // en vez de un error por fila
  const deMaquinaria = crudos.some(h => COLUMNAS_SOLO_MAQUINARIA.includes(h));
  const deRepuestos = crudos.some(h => COLUMNAS_SOLO_REPUESTOS.includes(h));
  if (deMaquinaria !== deRepuestos && (deMaquinaria ? 'MAQUINARIA' : 'REPUESTO') !== tipo)
    throw httpError(400, archivoDeOtroTipo(deMaquinaria ? 'MAQUINARIA' : 'REPUESTO'));
  const encabezados = crudos.map(h => SINONIMOS[h] ?? h);
  const indice = new Map<Columna, number>();
  COLUMNAS.forEach(c => { const i = encabezados.indexOf(c); if (i >= 0) indice.set(c, i); });
  if (!indice.has('codigo') && !indice.has('nombre'))
    throw httpError(400, 'No se reconocen las columnas. Usá la plantilla: la primera fila tiene que tener codigo, nombre, categoria, etc.');

  const codigos = filas.slice(1).map(f => (indice.has('codigo') ? f[indice.get('codigo')!] ?? '' : '').trim()).filter(Boolean);
  const existentes = new Map((await prisma.producto.findMany({ where: { codigo: { in: codigos } } })).map(p => [p.codigo!, p]));
  // Con la plantilla del ERP (no tiene columnas propias de cada tipo): si todos los códigos que ya existen son del
  // otro tipo, casi seguro se eligió mal la opción
  const delOtroTipo = [...existentes.values()].filter(p => p.tipoProducto !== tipo).length;
  if (delOtroTipo && delOtroTipo === existentes.size && delOtroTipo >= codigos.length / 2)
    throw httpError(400, archivoDeOtroTipo(tipo === 'MAQUINARIA' ? 'REPUESTO' : 'MAQUINARIA'));

  const valid: FilaOk[] = [], invalid: FilaError[] = [];
  const vistos = new Set<string>();

  filas.slice(1).forEach((f, i) => {
    const linea = i + 2;
    const v = (c: Columna) => (indice.has(c) ? f[indice.get(c)!] ?? '' : '').trim();
    const errores: string[] = [];
    const codigo = v('codigo') || null;
    const existente = codigo ? existentes.get(codigo) : undefined;

    if (codigo) {
      if (vistos.has(codigo)) errores.push(`El código ${codigo} está repetido en el archivo`);
      vistos.add(codigo);
      if (codigo.length > 30) errores.push('El código no puede tener más de 30 caracteres');
    }
    if (existente && existente.tipoProducto !== tipo)
      errores.push(`El código ${codigo} ya existe y es ${ETIQUETA[existente.tipoProducto]}: importalo desde la otra opción`);

    const datos: Datos = { codigo };
    if (v('nombre')) datos.nombre = v('nombre').slice(0, 200);
    if (v('categoria')) datos.categoria = v('categoria').slice(0, 120);
    // El ERP no tiene marca ni modelo: se guardan al principio de la descripción para no perder el dato
    const marcaModelo = [v('marca') && `Marca: ${v('marca')}`, v('modelo') && `Modelo: ${v('modelo')}`].filter(Boolean).join(' · ');
    const texto = v('descripcion') || v('resumen');
    if (marcaModelo || texto) datos.descripcion = [marcaModelo, texto].filter(Boolean).join('\n').slice(0, 2000);

    // Precios: con costo + precio se usan esos dos; con costo + ganancia se calcula el precio.
    // Si vienen los tres (como en el Excel del catálogo) manda el precio.
    const costo = numero(v('costo')), ganancia = numero(v('ganancia')), precio = numero(v('precio'));
    for (const [n, val] of [['costo', costo], ['ganancia', ganancia], ['precio', precio]] as const)
      if (Number.isNaN(val)) errores.push(`"${v(n)}" no es un número válido en ${n}`);
      else if (val !== null && val < 0) errores.push(`${n} no puede ser negativo`);
    if (precio !== null && !Number.isNaN(precio)) datos.precio = precio;
    else if (ganancia !== null && !Number.isNaN(ganancia)) {
      if (costo === null || Number.isNaN(costo)) errores.push('Para usar ganancia también hace falta el costo');
      else datos.precio = Math.round(costo * (1 + ganancia / 100) * 100) / 100;
    }
    if (costo !== null && !Number.isNaN(costo)) datos.precioCosto = costo;

    // El ERP trabaja en pesos: lo que esté en dólares se convierte con la cotización indicada
    const moneda = v('moneda').toUpperCase();
    if (moneda && !['ARS', 'USD', '$', 'U$S', 'US$'].includes(moneda)) errores.push(`moneda: "${v('moneda')}" no se reconoce (ARS o USD)`);
    // Solo hace falta la cotización si hay algo que convertir (un precio 0 "a consultar" queda en 0)
    else if (['USD', 'U$S', 'US$'].includes(moneda) && ((datos.precio ?? 0) > 0 || (datos.precioCosto ?? 0) > 0)) {
      if (!cotizacion) errores.push('El precio está en dólares: indicá la cotización del dólar para pasarlo a pesos');
      else {
        if (datos.precio !== undefined) datos.precio = Math.round(datos.precio * cotizacion * 100) / 100;
        if (datos.precioCosto !== undefined) datos.precioCosto = Math.round(datos.precioCosto * cotizacion * 100) / 100;
      }
    }
    // Precio 0 es válido: en el catálogo son los productos "a consultar"

    for (const [n, campo] of [['stock', 'stock'], ['stock_minimo', 'stockMinimo']] as const) {
      const val = numero(v(n));
      if (val === null) continue;
      if (Number.isNaN(val) || val < 0 || !Number.isInteger(val)) errores.push(`${n} tiene que ser un número entero mayor o igual a 0`);
      else datos[campo] = val;
    }

    const activo = booleano(v('activo'));
    if (activo === null) errores.push(`activo: poné "si" o "no" (no "${v('activo')}")`);
    else if (activo !== undefined) datos.activo = activo;

    // Un producto nuevo necesita los datos mínimos; uno existente solo actualiza lo que venga cargado
    if (!existente) {
      if (!datos.nombre) errores.push('Falta el nombre');
      if (!datos.categoria) errores.push('Falta la categoría');
    }

    if (errores.length) invalid.push({ linea, codigo: codigo ?? '', nombre: v('nombre'), errores });
    else valid.push({ linea, datos, existe: !!existente });
  });

  return { tipo, valid, invalid };
};

export const previsualizar = async (tipo: string, contenido: unknown, cotizacion?: unknown) => {
  const { valid, invalid } = await validar(tipo, contenido, cotizacion);
  return { valid, invalid };
};

// Vuelve a validar todo en el servidor (no confía en la previsualización) y aplica las filas correctas de una vez
export const importar = async (tipoTexto: string, contenido: unknown, actualizar: boolean, cotizacion?: unknown) => {
  const { tipo, valid, invalid } = await validar(tipoTexto, contenido, cotizacion);
  if (!valid.length) throw httpError(400, 'No hay filas correctas para importar');

  const resultado = await prisma.$transaction(async tx => {
    // Las categorías que no existen se crean (se comparan sin distinguir mayúsculas)
    const categorias = new Map((await tx.categoria.findMany()).map(c => [c.nombre.toLowerCase(), c.id]));
    const categoriaId = async (nombre: string) => {
      const clave = nombre.toLowerCase();
      if (!categorias.has(clave)) categorias.set(clave, (await tx.categoria.create({ data: { nombre } })).id);
      return categorias.get(clave)!;
    };

    // Los nuevos sin código reciben el siguiente número correlativo, igual que al crearlos a mano
    let siguiente = await siguienteCodigoNumerico(tx);
    const nuevoCodigo = async () => {
      let codigo = String(siguiente++).padStart(4, '0');
      while (await tx.producto.findUnique({ where: { codigo } })) codigo = String(siguiente++).padStart(4, '0');
      return codigo;
    };

    let creados = 0, actualizados = 0, omitidos = 0;
    for (const { datos, existe } of valid) {
      const { codigo, categoria, ...campos } = datos;
      if (existe) {
        if (!actualizar) { omitidos++; continue; }
        await tx.producto.update({
          where: { codigo: codigo! },
          data: { ...campos, ...(categoria ? { categoriaId: await categoriaId(categoria) } : {}) },
        });
        actualizados++;
      } else {
        await tx.producto.create({
          data: {
            codigo: codigo ?? await nuevoCodigo(), tipoProducto: tipo, nombre: campos.nombre!, descripcion: campos.descripcion,
            precioCosto: campos.precioCosto ?? 0, precio: campos.precio ?? 0, stock: campos.stock ?? 0,
            stockMinimo: campos.stockMinimo ?? (tipo === 'MAQUINARIA' ? 1 : 5),
            activo: campos.activo ?? true, categoriaId: await categoriaId(categoria!),
          },
        });
        creados++;
      }
    }
    return { creados, actualizados, omitidos };
  }, { timeout: 60_000 });

  getIO()?.emit('stock-actualizado');
  return { ...resultado, conError: invalid.length };
};
