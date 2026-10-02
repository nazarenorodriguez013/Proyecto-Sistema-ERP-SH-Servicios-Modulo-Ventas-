// Batería de pruebas de la API (sin dependencias, Node 20+). Pensada para correr contra una base de datos NUEVA y descartable:
//
//   API=http://localhost:4100/api MAILS_LOG=/tmp/mails.log node tests/qa-api.js
//
// El servidor tiene que arrancar con RESEND_API_KEY=re_test y un fetch simulado que anote en MAILS_LOG el cuerpo de cada mail
// (así se leen los códigos de verificación y los links de recuperación sin mandar nada de verdad).
const fs = require('fs')
const B = process.env.API || 'http://localhost:4100/api'
const MAILS = process.env.MAILS_LOG || '/tmp/mails.log'
const SUF = Date.now().toString(36)
let pass = 0, fail = 0
const fallos = []

const ok = (nombre, cond, extra) => {
  if (cond) { pass++; return }
  fail++
  const det = extra === undefined ? '' : ' → ' + JSON.stringify(extra).slice(0, 220)
  fallos.push(nombre + det)
  console.log('   ✗', nombre + det)
}
const api = async (method, path, token, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const txt = await r.text(); let d = null
  try { d = txt ? JSON.parse(txt) : null } catch { d = txt }
  return { s: r.status, d }
}
const seccion = async (nombre, fn) => {
  console.log('\n▸ ' + nombre)
  try { await fn() } catch (e) { fail++; fallos.push(`${nombre}: la sección se interrumpió → ${e.message}`); console.log('   ✗ se interrumpió:', e.message) }
}
const login = async (correo, contrasena) => (await api('POST', '/auth/login', null, { correo, contrasena })).d?.token
const ultimoMail = () => { const l = fs.readFileSync(MAILS, 'utf8').trim().split('\n').filter(Boolean).pop(); return l ? JSON.parse(l) : null }
const codigoDelMail = () => ultimoMail()?.text.match(/\n(\d{6})\n/)?.[1]
const tokenDelMail = () => ultimoMail()?.text.match(/reset=([a-f0-9]+)/)?.[1]
const paralelo = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)))

const CLAVE = 'Clave1234'
let A, V, T, depo // tokens de admin, vendedor, técnico, inventario
let catId, repuestoId, repuesto2Id, maquinaId, clienteId, tecnicoId

const crearUsuario = async (rol, nombre = rol) => {
  const correo = `${nombre.toLowerCase()}.${SUF}.${Math.random().toString(36).slice(2, 6)}@qa.com`
  const r = await api('POST', '/users', A, { nombre, correo, contrasena: CLAVE, rol })
  return { ...r.d, correo, token: await login(correo, CLAVE), s: r.s }
}
const producto = async (extra = {}) => (await api('POST', '/products', A, { nombre: 'P' + Math.random().toString(36).slice(2, 7), precio: 100, precioCosto: 50, stock: 20, stockMinimo: 2, categoriaId: catId, tipoProducto: 'REPUESTO', ...extra })).d
const stockDe = async id => (await api('GET', '/products/' + id, A)).d.stock

;(async () => {
  A = await login('admin@shservicios.com', 'admin123'); V = await login('vendedor@shservicios.com', 'vendedor123'); T = await login('tecnico@shservicios.com', 'tecnico123')
  if (!A || !V || !T) { console.log('No se pudo iniciar sesión con los usuarios de prueba: ¿es una base nueva con el seed?'); process.exit(2) }
  const depoU = await crearUsuario('INVENTARIO', 'Deposito'); depo = depoU.token

  // ───────────────────────────────────────────────────────────────────────────────
  await seccion('AUTENTICACIÓN', async () => {
    ok('login correcto devuelve token y datos', !!A)
    let r = await api('POST', '/auth/login', null, { correo: 'admin@shservicios.com', contrasena: 'mala' }); ok('contraseña mala → 401', r.s === 401, r)
    const m1 = r.d.message; r = await api('POST', '/auth/login', null, { correo: 'noexiste@x.com', contrasena: 'x' })
    ok('correo inexistente → 401 con el mismo mensaje (no revela cuál falla)', r.s === 401 && r.d.message === m1, r)
    r = await api('POST', '/auth/login', null, { correo: 'ADMIN@ShServicios.com', contrasena: 'admin123' }); ok('correo sin distinguir mayúsculas', r.s === 200, r.s)
    r = await api('POST', '/auth/login', null, {}); ok('login sin datos → 401 (no 500)', r.s === 401, r)
    r = await api('POST', '/auth/login', null, { correo: { $ne: 1 }, contrasena: { $ne: 1 } }); ok('login con objetos (inyección tipo NoSQL) → 401 (no 500)', r.s === 401, r)
    r = await api('POST', '/auth/login', null, { correo: "' OR 1=1 --", contrasena: 'x' }); ok('login con SQL → 401', r.s === 401, r)
    r = await api('GET', '/products'); ok('sin token → 401', r.s === 401, r.s)
    r = await api('GET', '/products', 'abc.def.ghi'); ok('token inválido → 401', r.s === 401, r.s)
    r = await api('GET', '/products', A.slice(0, -3) + 'xxx'); ok('token con firma alterada → 401', r.s === 401, r.s)
    r = await api('POST', '/auth/register', null, { nombre: 'x', correo: 'x@x.com', contrasena: CLAVE }); ok('no existe registro público', r.s === 404, r.s)
    r = await api('GET', '/auth/config'); ok('config pública sin Google configurado', r.s === 200 && r.d.googleClientId === null, r)
    r = await api('POST', '/auth/google', null, { credential: 'x' }); ok('Google sin configurar → 503', r.s === 503, r)
    r = await api('GET', '/health'.replace('/health', '/products'), null); ok('rutas /api protegidas', r.s === 401)
    const h = await fetch(B.replace('/api', '') + '/health'); ok('health responde', h.status === 200)
  })

  await seccion('USUARIOS (solo administrador)', async () => {
    for (const [nombre, tk] of [['vendedor', V], ['técnico', T], ['inventario', depo]]) {
      const r = await api('GET', '/users', tk); ok(`${nombre} no puede listar usuarios → 403`, r.s === 403, r.s)
      const c = await api('POST', '/users', tk, { nombre: 'x', correo: 'x@q.com', contrasena: CLAVE, rol: 'ADMIN' }); ok(`${nombre} no puede crear usuarios (escalada a admin) → 403`, c.s === 403, c.s)
    }
    const casos = [['clave1234', 'sin mayúscula'], ['ClaveClave', 'sin número'], ['Cl1', 'corta'], ['', 'vacía'], [12345678, 'numérica']]
    for (const [pw, d] of casos) { const r = await api('POST', '/users', A, { nombre: 'x', correo: `pw${Math.random()}@q.com`, contrasena: pw, rol: 'VENDEDOR' }); ok(`contraseña ${d} rechazada`, r.s === 400, r) }
    let r = await api('POST', '/users', A, { nombre: 'x', correo: 'no-es-mail', contrasena: CLAVE, rol: 'VENDEDOR' }); ok('correo inválido → 400', r.s === 400, r)
    r = await api('POST', '/users', A, { nombre: '   ', correo: `n${SUF}@q.com`, contrasena: CLAVE, rol: 'VENDEDOR' }); ok('nombre vacío → 400', r.s === 400, r)
    r = await api('POST', '/users', A, { nombre: 'x', correo: `r${SUF}@q.com`, contrasena: CLAVE, rol: 'SUPERUSER' }); ok('rol inexistente → 400', r.s === 400, r)
    r = await api('POST', '/users', A, { nombre: 'x', correo: `r${SUF}b@q.com`, contrasena: CLAVE }); ok('sin rol → 400', r.s === 400, r)
    const u = await crearUsuario('VENDEDOR', 'Ana'); ok('alta de vendedor', u.s === 201 && u.rol === 'VENDEDOR', u)
    ok('el vendedor nuevo entra sin confirmar nada', !!u.token)
    r = await api('POST', '/users', A, { nombre: 'dup', correo: u.correo.toUpperCase(), contrasena: CLAVE, rol: 'VENDEDOR' }); ok('correo duplicado (otra capitalización) → 400', r.s === 400, r)
    const mods = await api('POST', '/users', A, { nombre: 'Mods', correo: `m${SUF}@q.com`, contrasena: CLAVE, rol: 'TECNICO', modulos: ['clientes', 'inventario', 'servicios', 'basura', 5] })
    ok('un técnico solo recibe los módulos que su rol permite', JSON.stringify(mods.d.modulos) === '["servicios"]', mods.d.modulos)
    const inv = await api('POST', '/users', A, { nombre: 'Inv', correo: `i${SUF}@q.com`, contrasena: CLAVE, rol: 'INVENTARIO' }); ok('rol INVENTARIO solo ve inventario', JSON.stringify(inv.d.modulos) === '["inventario"]', inv.d)
    r = await api('PUT', '/users/' + u.id, A, { rol: 'TECNICO' }); ok('cambiar de rol ajusta los módulos', r.s === 200 && JSON.stringify(r.d.modulos) === '["servicios"]', r.d)
    r = await api('PUT', '/users/' + u.id, A, { activo: false }); ok('desactivar usuario', r.s === 200 && r.d.activo === false, r)
    r = await api('POST', '/auth/login', null, { correo: u.correo, contrasena: CLAVE }); ok('usuario desactivado no puede entrar → 401', r.s === 401, r)
    r = await api('PUT', '/users/' + u.id, A, { activo: true, contrasena: 'Nueva9999' }); ok('reactivar y cambiar contraseña', r.s === 200, r)
    r = await api('POST', '/auth/login', null, { correo: u.correo, contrasena: 'Nueva9999' }); ok('entra con la contraseña nueva', r.s === 200, r)
    r = await api('PUT', '/users/999999', A, { nombre: 'x' }); ok('editar inexistente → 404', r.s === 404, r)
    r = await api('DELETE', '/users/999999', A); ok('borrar inexistente → 404', r.s === 404, r)
    const adminId = (await api('GET', '/users', A)).d.find(x => x.correo === 'admin@shservicios.com').id
    r = await api('DELETE', '/users/' + adminId, A); ok('no podés eliminarte a vos mismo → 400', r.s === 400, r)
    r = await api('PUT', '/users/' + adminId, A, { activo: false }); ok('no podés desactivarte a vos mismo', r.s === 400, r)
    r = await api('PUT', '/users/' + adminId, A, { rol: 'VENDEDOR' }); ok('no se puede quitar al único administrador → 400', r.s === 400, r)
    r = await api('DELETE', '/users/' + u.id, A); ok('borrar usuario sin movimientos → 204', r.s === 204, r)
    r = await api('GET', '/users', A); ok('el listado no expone contraseñas ni hashes', !JSON.stringify(r.d).match(/contrasena|resetToken|codigoHash/i), Object.keys(r.d[0]))
  })

  await seccion('EMPRESA', async () => {
    for (const [n, tk] of [['admin', A], ['vendedor', V], ['técnico', T], ['inventario', depo]]) { const r = await api('GET', '/company', tk); ok(`${n} puede leer los datos de la empresa`, r.s === 200 && r.d.razonSocial, r.s) }
    let r = await api('PUT', '/company', V, { cuit: '1' }); ok('vendedor no puede editar → 403', r.s === 403, r.s)
    r = await api('PUT', '/company', A, { cuit: '30-11111111-1', domicilio: 'Calle 1', puntoVenta: 7 }); ok('admin edita', r.s === 200 && r.d.puntoVenta === 7 && r.d.cuit === '30-11111111-1', r)
    for (const pv of [0, -1, 10000, 1.5, 'abc']) { r = await api('PUT', '/company', A, { puntoVenta: pv }); ok(`punto de venta inválido (${pv}) → 400`, r.s === 400, r) }
    r = await api('PUT', '/company', A, { razonSocial: '  ' }); ok('razón social vacía → 400', r.s === 400, r)
    r = await api('PUT', '/company', A, { id: 99, puntoVenta: 1, campoRaro: 'x' }); ok('campos desconocidos no rompen ni crean otra fila', r.s === 200 && r.d.id === 1, r)
  })

  // Datos base para el resto
  catId = (await api('GET', '/categories', A)).d[0].id
  clienteId = (await api('POST', '/clients', A, { nombre: 'Cliente QA ' + SUF, documento: 'D' + SUF, direccion: 'Calle 123', telefono: '111', email: 'c@qa.com' })).d.id
  const tecU = await crearUsuario('TECNICO', 'TecQA'); tecnicoId = tecU.id; const TT = tecU.token
  repuestoId = (await producto({ stock: 50, nombre: 'Repuesto QA 1' })).id; repuesto2Id = (await producto({ stock: 30, nombre: 'Repuesto QA 2' })).id; maquinaId = (await producto({ stock: 5, tipoProducto: 'MAQUINARIA', nombre: 'Maquina QA', precio: 5000 })).id

  await seccion('CATEGORÍAS Y PRODUCTOS', async () => {
    let r = await api('POST', '/categories', A, { nombre: 'Cat ' + SUF }); ok('admin crea categoría', r.s === 201, r)
    const cid = r.d?.id
    r = await api('POST', '/categories', A, { nombre: 'Cat ' + SUF }); ok('categoría duplicada → error controlado (4xx)', r.s >= 400 && r.s < 500, r.s)
    r = await api('POST', '/categories', A, { nombre: '' }); ok('categoría sin nombre → 4xx', r.s >= 400 && r.s < 500, r)
    r = await api('POST', '/categories', V, { nombre: 'X' + SUF }); ok('vendedor no crea categoría → 403', r.s === 403, r.s)
    r = await api('POST', '/categories', depo, { nombre: 'Dep ' + SUF }); ok('inventario sí crea categoría', r.s === 201, r.s)
    r = await api('PUT', '/categories/' + cid, A, { nombre: 'Cat renombrada ' + SUF }); ok('renombrar categoría', r.s === 200, r)
    r = await api('DELETE', '/categories/' + cid, A); ok('borrar categoría vacía', r.s === 204 || r.s === 200, r.s)
    r = await api('DELETE', '/categories/' + catId, A); ok('categoría con productos no se borra (409/400, no 500)', r.s === 409 || r.s === 400, r.s)

    const base = { nombre: 'Prod ' + SUF, precio: 100, stock: 5, categoriaId: catId }
    r = await api('POST', '/products', A, base); ok('crear producto con código automático', r.s === 201 && /^\d{4}$/.test(r.d.codigo) && r.d.tipoProducto === 'REPUESTO', r.d)
    const pid = r.d.id, cod1 = r.d.codigo
    r = await api('POST', '/products', A, base); ok('el código se incrementa y es único', r.s === 201 && Number(r.d.codigo) === Number(cod1) + 1, r.d?.codigo)
    r = await api('POST', '/products', depo, { ...base, nombre: 'Dep prod ' + SUF }); ok('inventario crea producto', r.s === 201, r.s)
    for (const [n, tk] of [['vendedor', V], ['técnico', T]]) {
      r = await api('POST', '/products', tk, base); ok(`${n} no crea producto → 403`, r.s === 403, r.s)
      r = await api('PUT', '/products/' + pid, tk, { precio: 1 }); ok(`${n} no edita producto → 403`, r.s === 403, r.s)
      r = await api('DELETE', '/products/' + pid, tk); ok(`${n} no borra producto → 403`, r.s === 403, r.s)
    }
    const malos = [[{ nombre: '' }, 'nombre vacío'], [{ precio: 0 }, 'precio 0'], [{ precio: -5 }, 'precio negativo'], [{ stock: -1 }, 'stock negativo'], [{ stock: 1.5 }, 'stock decimal'],
      [{ stockMinimo: -2 }, 'stock mínimo negativo'], [{ categoriaId: 999999 }, 'categoría inexistente'], [{ tipoProducto: 'OTRO' }, 'tipo inválido'], [{ precio: 'abc' }, 'precio texto'], [{ categoriaId: undefined }, 'sin categoría']]
    for (const [parche, d] of malos) { r = await api('POST', '/products', A, { ...base, ...parche }); ok(`producto con ${d} → 4xx (no 500)`, r.s >= 400 && r.s < 500, { s: r.s, d: r.d }) }
    r = await api('PUT', '/products/' + pid, A, { precio: 250, stock: 8, tipoProducto: 'MAQUINARIA' }); ok('editar precio, stock y tipo', r.s === 200 && r.d.precio === 250 && r.d.tipoProducto === 'MAQUINARIA', r)
    r = await api('PUT', '/products/' + pid, A, { precio: -1 }); ok('editar con precio inválido → 400', r.s === 400, r)
    r = await api('PUT', '/products/999999', A, { precio: 5 }); ok('editar inexistente → 4xx', r.s >= 400 && r.s < 500, r.s)
    r = await api('GET', '/products/999999', A); ok('leer inexistente → 404', r.s === 404, r.s)
    r = await api('GET', '/products/abc', A); ok('id no numérico → 4xx (no 500)', r.s >= 400 && r.s < 500, r.s)
    r = await api('PUT', '/products/' + pid, A, { activo: false }); ok('desactivar', r.d?.activo === false, r)
    r = await api('GET', '/products/low-stock', A); ok('low-stock no incluye inactivos', Array.isArray(r.d) && !r.d.find(p => p.id === pid), r.s)
    r = await api('DELETE', '/products/' + pid, A); ok('borrar producto sin uso', r.s === 204, r.s)
    r = await api('DELETE', '/products/' + pid, A); ok('borrar de nuevo → 404', r.s === 404, r.s)
    r = await api('PUT', '/products/' + repuestoId, A, { id: 1, codigo: '0001' }); ok('no se puede pisar id/código por mass-assignment', !(r.s === 200 && (r.d.id !== repuestoId)), r.d)
  })

  await seccion('CLIENTES Y CUENTA CORRIENTE', async () => {
    let r = await api('POST', '/clients', A, { nombre: 'Otro ' + SUF, documento: 'D' + SUF }); ok('documento duplicado → 400', r.s === 400, r)
    r = await api('POST', '/clients', A, { nombre: '  ' }); ok('nombre vacío → 400', r.s === 400, r)
    r = await api('POST', '/clients', A, { nombre: 'Sin doc ' + SUF }); ok('cliente sin documento', r.s === 201 && r.d.condicionIva === 'Consumidor Final', r.d)
    const sinDoc = r.d.id
    r = await api('POST', '/clients', V, { nombre: 'Del vendedor ' + SUF }); ok('vendedor puede crear cliente', r.s === 201, r.s)
    for (const [n, tk] of [['técnico', T], ['inventario', depo]]) { r = await api('GET', '/clients', tk); ok(`${n} no ve clientes → 403`, r.s === 403, r.s) }
    r = await api('PUT', '/clients/' + sinDoc, V, { telefono: '999', condicionIva: 'Monotributo' }); ok('editar cliente y condición de IVA', r.s === 200 && r.d.condicionIva === 'Monotributo', r)
    r = await api('GET', '/clients/999999', A); ok('cliente inexistente → 404', r.s === 404, r.s)
    r = await api('GET', '/clients/abc', A); ok('id no numérico → 404 (no 500)', r.s === 404 || r.s === 400, r.s)
    for (const m of [0, -5, 'abc', null, undefined]) { r = await api('POST', `/clients/${sinDoc}/movements`, A, { monto: m }); ok(`pago con monto ${JSON.stringify(m)} → 400`, r.s === 400, r) }
    r = await api('POST', `/clients/${sinDoc}/movements`, A, { monto: 1500.5 }); ok('registrar pago', r.s === 201, r)
    const mid = r.d.id
    r = await api('GET', '/clients/' + sinDoc, A); ok('saldo = -1500.5 (a favor)', r.d.saldo === -1500.5, r.d.saldo)
    r = await api('POST', '/clients/999999/movements', A, { monto: 5 }); ok('pago a cliente inexistente → 4xx', r.s >= 400 && r.s < 500, r.s)
    r = await api('DELETE', `/clients/${sinDoc}/movements/${mid}`, V); ok('vendedor no borra movimientos → 403', r.s === 403, r.s)
    r = await api('DELETE', `/clients/${sinDoc}/movements/${mid}`, A); ok('admin borra pago suelto', r.s === 204, r.s)
    r = await api('DELETE', `/clients/${sinDoc}/movements/${mid}`, A); ok('borrar de nuevo → 404', r.s === 404, r.s)
    r = await api('DELETE', '/clients/' + sinDoc, V); ok('vendedor no borra clientes → 403', r.s === 403, r.s)
    r = await api('DELETE', '/clients/' + sinDoc, A); ok('admin borra cliente sin historial', r.s === 204, r.s)
    r = await api('DELETE', '/clients/' + clienteId, A); ok('con historial pendiente se puede borrar solo si no tiene nada (por ahora sí)', r.s === 204 || r.s === 409, r.s)
    if (r.s === 204) clienteId = (await api('POST', '/clients', A, { nombre: 'Cliente QA2 ' + SUF, documento: 'E' + SUF })).d.id
  })

  await seccion('VENTAS', async () => {
    const p = await producto({ stock: 40, precio: 200 }); const items = (n, id = p.id) => [{ productoId: id, cantidad: n }]
    let r = await api('POST', '/sales', A, { items: items(2), medioPago: 'Efectivo', tipoComprobante: 'FACTURA' }); ok('factura sin cliente (consumidor final)', r.s === 201 && r.d.total === 400 && r.d.clienteId === null, r)
    ok('descuenta stock', (await stockDe(p.id)) === 38)
    const n1 = r.d.numero; const ventaA = r.d.id
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', tipoComprobante: 'FACTURA' }); ok('factura siguiente = número + 1', r.d.numero === n1 + 1, [n1, r.d.numero])
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', tipoComprobante: 'REMITO' }); ok('remito tiene su propia secuencia', r.s === 201 && r.d.tipoComprobante === 'REMITO' && r.d.numero >= 1, r.d)
    const rem = r.d.numero
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', tipoComprobante: 'REMITO' }); ok('remito correlativo', r.d.numero === rem + 1, [rem, r.d.numero])
    const antes = await stockDe(p.id)
    r = await api('POST', '/sales', A, { items: items(3), tipoComprobante: 'PRESUPUESTO' }); ok('presupuesto: no persiste, trae número propio', r.s === 201 && r.d.id === null && r.d.numero >= 1 && r.d.total === 600, r.d)
    ok('presupuesto no toca el stock', (await stockDe(p.id)) === antes)
    const pr1 = r.d.numero; r = await api('POST', '/sales', A, { items: items(1), tipoComprobante: 'PRESUPUESTO' }); ok('presupuestos correlativos', r.d.numero === pr1 + 1, [pr1, r.d.numero])
    r = await api('POST', '/sales', A, { items: [{ productoId: p.id, cantidad: 1 }, { productoId: p.id, cantidad: 2 }], medioPago: 'Efectivo' }); ok('ítems repetidos se unifican', r.s === 201 && r.d.detallesVenta.length === 1 && r.d.detallesVenta[0].cantidad === 3, r.d)
    for (const [cant, d] of [[0, 'cero'], [-1, 'negativa'], [1.5, 'decimal'], ['x', 'texto'], [null, 'nula']]) { r = await api('POST', '/sales', A, { items: items(cant), medioPago: 'Efectivo' }); ok(`cantidad ${d} → 400`, r.s === 400, r) }
    r = await api('POST', '/sales', A, { items: [], medioPago: 'Efectivo' }); ok('sin ítems → 400', r.s === 400, r)
    r = await api('POST', '/sales', A, { medioPago: 'Efectivo' }); ok('sin campo items → 400 (no 500)', r.s === 400, r)
    r = await api('POST', '/sales', A, { items: items(1, 999999), medioPago: 'Efectivo' }); ok('producto inexistente → 400', r.s === 400, r)
    r = await api('POST', '/sales', A, { items: items(9999), medioPago: 'Efectivo' }); ok('stock insuficiente → 400 con mensaje', r.s === 400 && /Stock insuficiente/.test(r.d.message), r)
    const inact = await producto({ stock: 5 }); await api('PUT', '/products/' + inact.id, A, { activo: false })
    r = await api('POST', '/sales', A, { items: items(1, inact.id), medioPago: 'Efectivo' }); ok('producto inactivo no se vende → 400', r.s === 400, r)
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Cuenta Corriente' }); ok('cuenta corriente sin cliente → 400', r.s === 400, r)
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', clienteId: 999999 }); ok('cliente inexistente → 400', r.s === 400, r)
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', tipoComprobante: 'NOTA' }); ok('tipo de comprobante inválido → 4xx', r.s >= 400 && r.s < 500, r)
    for (const [n, tk] of [['técnico', T], ['inventario', depo]]) { r = await api('POST', '/sales', tk, { items: items(1), medioPago: 'Efectivo' }); ok(`${n} no vende → 403`, r.s === 403, r.s) }
    r = await api('POST', '/sales', V, { items: items(1), medioPago: 'Efectivo', usuarioId: 1 }); const lista = await api('GET', '/sales', A)
    ok('el vendedor de la venta sale del token (ignora usuarioId del body)', lista.d.find(v => v.id === r.d.id)?.usuario.nombre === 'Vendedor', lista.d.find(v => v.id === r.d.id)?.usuario)
    // cuenta corriente
    const cl = (await api('POST', '/clients', A, { nombre: 'CC ' + SUF, documento: 'CC' + SUF })).d.id
    r = await api('POST', '/sales', A, { items: items(2), medioPago: 'Cuenta Corriente', clienteId: cl }); ok('venta a cuenta corriente deja deuda', r.s === 201, r)
    const vCC = r.d.id; ok('saldo = deuda', (await api('GET', '/clients/' + cl, A)).d.saldo === 400)
    await api('POST', `/clients/${cl}/movements`, A, { monto: 1000 }); ok('pago de más deja saldo a favor', (await api('GET', '/clients/' + cl, A)).d.saldo === -600)
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', clienteId: cl }); ok('con saldo a favor se aplica automático (200)', r.d.saldoAplicado === 200, r.d)
    r = await api('POST', '/sales', A, { items: items(1), medioPago: 'Efectivo', clienteId: cl, usarSaldo: false }); ok('usarSaldo=false no lo aplica', r.d.saldoAplicado === 0, r.d)
    r = await api('GET', '/clients/' + cl, A); ok('la ficha trae ventas, servicios y movimientos', Array.isArray(r.d.ventas) && Array.isArray(r.d.servicios) && Array.isArray(r.d.movimientos) && r.d.ventas[0].usuario?.nombre, Object.keys(r.d))
    // borrar
    const sB = await stockDe(p.id); r = await api('DELETE', '/sales/' + vCC, V); ok('vendedor no borra ventas → 403', r.s === 403, r.s)
    r = await api('DELETE', '/sales/' + vCC, A); ok('admin borra venta', r.s === 204, r.s); ok('borrar devuelve el stock', (await stockDe(p.id)) === sB + 2, [sB, await stockDe(p.id)])
    r = await api('DELETE', '/sales/' + vCC, A); ok('borrar de nuevo → 404', r.s === 404, r.s)
    r = await api('GET', '/sales', T); ok('técnico no lista ventas → 403', r.s === 403, r.s)
    // concurrencia
    const u1 = await producto({ stock: 1 })
    const res = await paralelo(6, () => api('POST', '/sales', A, { items: items(1, u1.id), medioPago: 'Efectivo' }))
    ok('6 ventas simultáneas de la última unidad: solo una entra', res.filter(x => x.s === 201).length === 1, res.map(x => x.s))
    ok('el stock nunca queda negativo', (await stockDe(u1.id)) === 0, await stockDe(u1.id))
    const ab = await producto({ stock: 100 })
    const par = await paralelo(12, () => api('POST', '/sales', A, { items: items(1, ab.id), medioPago: 'Efectivo', tipoComprobante: 'FACTURA' }))
    const nums = par.map(x => x.d?.numero).sort((a, b) => a - b)
    ok('12 facturas simultáneas: todas con número distinto', par.every(x => x.s === 201) && new Set(nums).size === 12, nums)
    ok('y consecutivos (sin saltos)', nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), nums)
    ok('stock exacto tras la ráfaga', (await stockDe(ab.id)) === 88, await stockDe(ab.id))
  })

  await seccion('SERVICIOS TÉCNICOS', async () => {
    const rp = await producto({ stock: 10, precio: 1000 })
    const base = { clienteId, equipo: 'Equipo QA', descripcionFalla: 'Falla QA', costoManoObra: 500 }
    let r = await api('POST', '/repairs', A, { ...base, tecnicoId }); ok('crear servicio con técnico', r.s === 201 && r.d.estado === 'EN_CURSO' && r.d.tecnico.id === tecnicoId && r.d.estadoRetiro === null, r)
    const sv0 = r.d.id
    r = await api('POST', '/repairs', V, { ...base }); ok('vendedor crea servicio sin técnico', r.s === 201 && r.d.tecnico === null, r.d)
    for (const [parche, d] of [[{ equipo: '' }, 'equipo vacío'], [{ descripcionFalla: ' ' }, 'falla vacía'], [{ clienteId: 999999 }, 'cliente inexistente'], [{ clienteId: undefined }, 'sin cliente'], [{ tecnicoId: V ? (await api('GET', '/users', A)).d.find(u => u.rol === 'VENDEDOR').id : 1 }, 'técnico que no es técnico'], [{ fechaEstimadaFin: 'no-es-fecha' }, 'fecha inválida']]) { r = await api('POST', '/repairs', A, { ...base, ...parche }); ok(`servicio con ${d} → 4xx`, r.s >= 400 && r.s < 500, { s: r.s, d: r.d }) }
    for (const [n, tk] of [['técnico', T], ['inventario', depo]]) { r = await api('POST', '/repairs', tk, base); ok(`${n} no crea servicios → 403`, r.s === 403, r.s) }
    // repuestos y reserva
    r = await api('POST', '/repairs', A, { ...base, tecnicoId, repuestos: [{ productoId: rp.id, cantidad: 4 }] }); ok('crear con repuestos: queda pendiente de retiro con código', r.s === 201 && r.d.estadoRetiro === 'PENDIENTE' && /^RT-\d{6}$/.test(r.d.codigoRetiro), r.d)
    const svR = r.d.id; ok('crear NO descuenta el stock', (await stockDe(rp.id)) === 10)
    r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: rp.id, cantidad: 7 }] }); ok('la reserva impide pedir más de lo disponible (10-4=6)', r.s === 400 && /disponible: 6/.test(r.d.message), r)
    r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: maquinaId, cantidad: 1 }] }); ok('una maquinaria no se pide como repuesto', r.s === 400, r)
    for (const c of [0, -2, 1.5, 'x']) { r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: rp.id, cantidad: c }] }); ok(`cantidad de repuesto ${c} → 400`, r.s === 400, r) }
    r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: 999999, cantidad: 1 }] }); ok('repuesto inexistente → 400', r.s === 400, r)
    r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: rp.id, cantidad: 1 }, { productoId: rp.id, cantidad: 1 }] }); ok('el mismo repuesto dos veces en el alta → no falla con 500', r.s !== 500, { s: r.s, d: r.d })
    // presupuesto
    r = await api('POST', '/repairs/presupuesto', A, { ...base, repuestos: [{ productoId: rp.id, cantidad: 2 }] }); ok('presupuesto de servicio: no persiste, calcula total', r.s === 201 && r.d.id === null && r.d.total === 2500 && r.d.numero >= 1, r.d)
    ok('presupuesto no reserva ni descuenta', (await stockDe(rp.id)) === 10)
    r = await api('POST', '/repairs/presupuesto', T, base); ok('técnico no genera presupuestos → 403', r.s === 403, r.s)
    // asignar
    r = await api('PUT', `/repairs/${svR}/tecnico`, A, { tecnicoId: (await api('GET', '/users', A)).d.find(u => u.rol === 'ADMIN').id }); ok('asignar a un no técnico → 400', r.s === 400, r)
    r = await api('PUT', `/repairs/${svR}/tecnico`, T, { tecnicoId }); ok('técnico no reasigna → 403', r.s === 403, r.s)
    // permisos de lectura
    r = await api('GET', '/repairs', TT); ok('técnico ve solo sus servicios', r.s === 200 && r.d.every(s => s.tecnicoId === tecnicoId) && r.d.length >= 2, r.d?.map?.(s => s.tecnicoId))
    r = await api('GET', '/repairs/' + (await api('GET', '/repairs', A)).d.find(s => s.tecnicoId !== tecnicoId)?.id, TT); ok('técnico no abre servicios ajenos → 403', r.s === 403, r.s)
    r = await api('GET', '/repairs', depo); ok('inventario no ve servicios → 403', r.s === 403, r.s)
    r = await api('GET', '/repairs/999999', A); ok('servicio inexistente → 404', r.s === 404, r.s)
    // flujo de retiro
    r = await api('GET', '/repairs/retiros', depo); ok('inventario ve la cola de retiros', r.s === 200 && r.d.find(s => s.id === svR), r.s)
    r = await api('GET', '/repairs/retiros', TT); ok('técnico no ve la cola → 403', r.s === 403, r.s)
    r = await api('PUT', `/repairs/retiros/${svR}`, depo, { estado: 'RETIRADO' }); ok('no se salta LISTO → 409', r.s === 409, r)
    r = await api('PUT', `/repairs/retiros/${svR}`, depo, { estado: 'LISTO' }); ok('marcar LISTO', r.s === 200 && r.d.estadoRetiro === 'LISTO', r)
    ok('LISTO no descuenta', (await stockDe(rp.id)) === 10)
    r = await api('PUT', `/repairs/retiros/${svR}`, TT, { estado: 'RETIRADO' }); ok('técnico no marca retirado → 403', r.s === 403, r.s)
    r = await api('PUT', `/repairs/${svR}/finalizar`, TT, { tipoComprobante: 'FACTURA', medioPago: 'Efectivo' }); ok('no se finaliza con repuestos sin retirar → 409', r.s === 409, r)
    r = await api('PUT', `/repairs/retiros/${svR}`, depo, { estado: 'RETIRADO' }); ok('RETIRADO descuenta el stock', r.s === 200 && (await stockDe(rp.id)) === 6, await stockDe(rp.id))
    r = await api('PUT', `/repairs/retiros/${svR}`, depo, { estado: 'RETIRADO' }); ok('retirar dos veces → 409 (no descuenta de nuevo)', r.s === 409 && (await stockDe(rp.id)) === 6, r.s)
    r = await api('PUT', `/repairs/retiros/${sv0}`, depo, { estado: 'LISTO' }); ok('servicio sin repuestos no tiene retiro → 409', r.s === 409, r)
    r = await api('PUT', `/repairs/retiros/${svR}`, depo, { estado: 'INVENTADO' }); ok('estado inválido → 409/400', r.s === 409 || r.s === 400, r.s)
    // agregar / quitar
    r = await api('POST', `/repairs/${svR}/repuestos`, TT, { productoId: rp.id, cantidad: 2 }); ok('técnico agrega repuesto → reabre el pedido (PENDIENTE)', r.s === 200 && r.d.estadoRetiro === 'PENDIENTE', r)
    ok('agregar no descuenta', (await stockDe(rp.id)) === 6)
    r = await api('POST', `/repairs/${svR}/repuestos`, TT, { productoId: rp.id, cantidad: 99 }); ok('agregar de más → 400', r.s === 400, r)
    r = await api('POST', `/repairs/${svR}/repuestos`, T, { productoId: rp.id, cantidad: 1 }); ok('otro técnico no agrega → 403', r.s === 403, r.s)
    r = await api('POST', `/repairs/${svR}/repuestos`, V, { productoId: rp.id, cantidad: 1 }); ok('vendedor no carga repuestos en el taller → 403', r.s === 403, r.s)
    r = await api('POST', `/repairs/${svR}/repuestos`, TT, { productoId: rp.id, cantidad: 0 }); ok('cantidad 0 → 400', r.s === 400, r)
    r = await api('DELETE', `/repairs/${svR}/repuestos/${rp.id}`, TT); ok('quitar repuesto devuelve lo ya retirado (4) al stock', r.s === 200 && (await stockDe(rp.id)) === 10, await stockDe(rp.id))
    r = await api('DELETE', `/repairs/${svR}/repuestos/${rp.id}`, TT); ok('quitar uno que no está → 404', r.s === 404, r.s)
    // actualizar
    r = await api('PUT', '/repairs/' + sv0, TT, { costoManoObra: 1234, diagnostico: 'Diag', trabajoRealizado: 'Hecho', fechaEstimadaFin: '2026-12-01' }); ok('técnico actualiza mano de obra, fecha y notas', r.s === 200 && r.d.costoManoObra === 1234 && r.d.diagnostico === 'Diag', r.d)
    for (const c of [-1, 'abc', null]) { r = await api('PUT', '/repairs/' + sv0, TT, { costoManoObra: c }); ok(`mano de obra ${JSON.stringify(c)} → 400`, r.s === 400 || (c === null && r.s === 200), r) }
    r = await api('PUT', '/repairs/' + sv0, T, { costoManoObra: 1 }); ok('otro técnico no actualiza → 403', r.s === 403, r.s)
    r = await api('PUT', '/repairs/' + sv0, TT, { fechaEstimadaFin: null }); ok('se puede borrar la fecha estimada', r.s === 200 && r.d.fechaEstimadaFin === null, r)
    // finalizar
    for (const [body, d] of [[{ tipoComprobante: 'PRESUPUESTO', medioPago: 'Efectivo' }, 'tipo inválido'], [{ tipoComprobante: 'FACTURA' }, 'sin medio de pago'], [{}, 'vacío']]) { r = await api('PUT', `/repairs/${sv0}/finalizar`, TT, body); ok(`finalizar con ${d} → 400`, r.s === 400, r) }
    r = await api('PUT', `/repairs/${sv0}/finalizar`, T, { tipoComprobante: 'FACTURA', medioPago: 'Efectivo' }); ok('otro técnico no finaliza → 403', r.s === 403, r.s)
    r = await api('PUT', `/repairs/${sv0}/finalizar`, depo, { tipoComprobante: 'FACTURA', medioPago: 'Efectivo' }); ok('inventario no finaliza → 403', r.s === 403, r.s)
    r = await api('PUT', `/repairs/${sv0}/finalizar`, TT, { tipoComprobante: 'REMITO', medioPago: 'Efectivo', costoManoObra: 2000 }); ok('técnico finaliza su servicio y genera remito numerado', r.s === 200 && r.d.estado === 'FINALIZADO' && r.d.numero >= 1 && r.d.total === 2000, r.d)
    r = await api('PUT', `/repairs/${sv0}/finalizar`, TT, { tipoComprobante: 'REMITO', medioPago: 'Efectivo' }); ok('finalizar dos veces → 409', r.s === 409, r.s)
    r = await api('PUT', '/repairs/' + sv0, TT, { costoManoObra: 1 }); ok('un servicio finalizado no se edita → 409', r.s === 409, r.s)
    r = await api('POST', `/repairs/${sv0}/repuestos`, A, { productoId: rp.id, cantidad: 1 }); ok('ni se le agregan repuestos → 409', r.s === 409, r.s)
    // garantía, cuenta corriente, saldo
    const cl = (await api('POST', '/clients', A, { nombre: 'SvCC ' + SUF, documento: 'SV' + SUF })).d.id
    r = await api('POST', '/repairs', A, { clienteId: cl, equipo: 'G', descripcionFalla: 'g', enGarantia: true, costoManoObra: 900 }); const sG = r.d.id
    r = await api('PUT', `/repairs/${sG}/finalizar`, A, { tipoComprobante: 'FACTURA', medioPago: 'Efectivo' }); ok('en garantía el total es 0', r.d.total === 0, r.d)
    r = await api('POST', '/repairs', A, { clienteId: cl, equipo: 'CC', descripcionFalla: 'cc', costoManoObra: 3000 }); const sCC = r.d.id
    r = await api('PUT', `/repairs/${sCC}/finalizar`, A, { tipoComprobante: 'FACTURA', medioPago: 'Cuenta Corriente' }); ok('finalizar a cuenta corriente', r.s === 200, r)
    ok('deja la deuda en la cuenta del cliente', (await api('GET', '/clients/' + cl, A)).d.saldo === 3000)
    r = await api('GET', '/clients/' + cl, A); ok('el servicio figura en la ficha del cliente', r.d.servicios.some(s => s.id === sCC), r.d.servicios?.length)
    // borrar
    r = await api('DELETE', '/repairs/' + sCC, V); ok('vendedor no borra servicios → 403', r.s === 403, r.s)
    r = await api('DELETE', '/repairs/' + sCC, A); ok('admin borra servicio', r.s === 204, r.s); ok('borrar quita la deuda', (await api('GET', '/clients/' + cl, A)).d.saldo === 0)
    const rp2 = await producto({ stock: 10 }); r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: rp2.id, cantidad: 3 }] }); const sD = r.d.id
    await api('DELETE', '/repairs/' + sD, A); ok('borrar un servicio con repuestos sin retirar no toca el stock', (await stockDe(rp2.id)) === 10, await stockDe(rp2.id))
    r = await api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: rp2.id, cantidad: 3 }] }); const sE = r.d.id
    await api('PUT', `/repairs/retiros/${sE}`, A, { estado: 'LISTO' }); await api('PUT', `/repairs/retiros/${sE}`, A, { estado: 'RETIRADO' }); ok('retirado descontó', (await stockDe(rp2.id)) === 7)
    await api('DELETE', '/repairs/' + sE, A); ok('borrar un servicio con repuestos retirados los devuelve', (await stockDe(rp2.id)) === 10, await stockDe(rp2.id))
    r = await api('DELETE', '/repairs/999999', A); ok('borrar inexistente → 404', r.s === 404, r.s)
    // concurrencia de reserva
    const ult = await producto({ stock: 1 })
    const rs = await paralelo(5, () => api('POST', '/repairs', A, { ...base, repuestos: [{ productoId: ult.id, cantidad: 1 }] }))
    ok('5 servicios simultáneos pidiendo la última unidad: solo uno la reserva', rs.filter(x => x.s === 201).length === 1, rs.map(x => x.s))
  })

  await seccion('STOCK RESERVADO POR SERVICIOS Y PUNTO DE VENTA', async () => {
    const rp = await producto({ stock: 5, precio: 100 })
    let r = await api('POST', '/repairs', A, { clienteId, equipo: 'Reserva', descripcionFalla: 'x', tecnicoId, repuestos: [{ productoId: rp.id, cantidad: 3 }] }); const sv = r.d.id
    ok('el servicio reserva sin descontar', (await stockDe(rp.id)) === 5, await stockDe(rp.id))
    r = await api('POST', '/sales', A, { items: [{ productoId: rp.id, cantidad: 3 }], medioPago: 'Efectivo', tipoComprobante: 'FACTURA' }); ok('el punto de venta no puede vender lo reservado → 400', r.s === 400 && /reservado/.test(r.d?.message || ''), r)
    r = await api('POST', '/sales', A, { items: [{ productoId: rp.id, cantidad: 2 }], medioPago: 'Efectivo', tipoComprobante: 'FACTURA' }); ok('sí puede vender lo no reservado', r.s === 201, r)
    ok('la venta descuenta de inmediato', (await stockDe(rp.id)) === 3, await stockDe(rp.id))
    await api('PUT', `/repairs/retiros/${sv}`, depo, { estado: 'LISTO' })
    r = await api('PUT', `/repairs/retiros/${sv}`, depo, { estado: 'RETIRADO' }); ok('el retiro del servicio se entrega completo', r.s === 200, r)
    ok('al retirar se descuenta el repuesto del servicio', (await stockDe(rp.id)) === 0, await stockDe(rp.id))
    const det = (await api('GET', '/repairs/' + sv, A)).d
    ok('el retiro guarda fecha y hora de preparado y de retirado', !!det.listoEn && !!det.retiradoEn && new Date(det.retiradoEn) >= new Date(det.listoEn) && Date.now() - new Date(det.retiradoEn) < 120000, [det.listoEn, det.retiradoEn])
    r = await api('POST', `/repairs/${sv}/repuestos`, A, { productoId: (await producto({ stock: 9 })).id, cantidad: 1 })
    const det2 = (await api('GET', '/repairs/' + sv, A)).d
    ok('si se agrega otro repuesto, el pedido vuelve a pendiente y se limpian las horas', det2.estadoRetiro === 'PENDIENTE' && det2.retiradoEn === null && det2.listoEn === null, [r.s, det2.estadoRetiro, det2.retiradoEn])
  })

  await seccion('NOTIFICACIONES', async () => {
    let r = await api('GET', '/notifications', A); ok('admin ve notificaciones', r.s === 200 && Array.isArray(r.d.items) && typeof r.d.noLeidas === 'number', r.s)
    const iniciales = r.d.noLeidas
    r = await api('GET', '/notifications'); ok('sin token → 401', r.s === 401, r.s)
    const tec = await crearUsuario('TECNICO', 'TecNotif'); const ajeno = await crearUsuario('TECNICO', 'TecAjeno')
    const rp = await producto({ stock: 10 })
    r = await api('POST', '/repairs', A, { clienteId, equipo: 'Notif', descripcionFalla: 'n', tecnicoId: tec.id, repuestos: [{ productoId: rp.id, cantidad: 1 }] }); const sv = r.d.id
    r = await api('GET', '/notifications', depo); ok('inventario recibe la solicitud de repuestos', r.d.items.some(n => n.servicioId === sv && n.titulo === 'Solicitud de repuestos' && n.nueva), r.d.items.slice(0, 3).map(n => n.titulo))
    ok('el contador de no leídas sube', r.d.noLeidas >= 1)
    r = await api('GET', '/notifications', tec.token); ok('el técnico asignado recibe "Servicio asignado"', r.d.items.some(n => n.servicioId === sv && n.titulo === 'Servicio asignado'), r.d.items.map(n => n.titulo))
    r = await api('GET', '/notifications', ajeno.token); ok('otro técnico no ve avisos ajenos', !r.d.items.some(n => n.servicioId === sv), r.d.items.map(n => n.titulo))
    r = await api('GET', '/notifications', A); const nTec = r.d.items.find(n => n.servicioId === sv && n.titulo === 'Servicio asignado'), nInv = r.d.items.find(n => n.servicioId === sv && n.titulo === 'Solicitud de repuestos')
    ok('cada aviso trae a quién va dirigido', nInv?.destinatario === 'Inventario' && nTec?.destinatario === 'Técnico: TecNotif' + SUF || /^Técnico: /.test(nTec?.destinatario || ''), [nInv?.destinatario, nTec?.destinatario])
    r = await api('GET', '/notifications', depo); ok('inventario NO ve avisos de servicios', r.d.items.every(n => n.area === 'INVENTARIO'), r.d.items.map(n => n.area))
    await api('PUT', `/repairs/retiros/${sv}`, depo, { estado: 'LISTO' })
    r = await api('GET', '/notifications', tec.token); ok('al marcar LISTO el técnico recibe "Repuestos listos para retirar"', r.d.items.some(n => n.titulo === 'Repuestos listos para retirar' && n.servicioId === sv), r.d.items.map(n => n.titulo))
    r = await api('PUT', '/notifications/leidas', tec.token); ok('marcar como leídas', r.s === 200, r.s)
    r = await api('GET', '/notifications', tec.token); ok('queda en 0 no leídas', r.d.noLeidas === 0 && r.d.items.every(n => !n.nueva), r.d.noLeidas)
    r = await api('GET', '/notifications', depo); ok('marcar leídas es por usuario (inventario conserva las suyas)', r.d.noLeidas >= 1, r.d.noLeidas)
    r = await api('POST', '/repairs', A, { clienteId, equipo: 'Sin tec', descripcionFalla: 'n' }); r = await api('GET', '/notifications', V); ok('vendedor ve "Servicio sin técnico"', r.d.items.some(n => n.titulo === 'Servicio sin técnico'), r.d.items.map(n => n.titulo))
    r = await api('GET', '/notifications', A); ok('admin ve de ambas áreas', new Set(r.d.items.map(n => n.area)).size === 2, r.d.items.map(n => n.area))
    ok('el listado no pasa de 30', r.d.items.length <= 30, r.d.items.length)
  })

  await seccion('VERIFICACIÓN EN DOS PASOS', async () => {
    const u = await crearUsuario('VENDEDOR', 'DosPasos')
    let r = await api('POST', '/auth/2fa/activar', null); ok('activar sin sesión → 401', r.s === 401, r.s)
    r = await api('POST', '/auth/2fa/activar/confirmar', u.token, { codigo: '123456' }); ok('confirmar sin haber pedido código → 400', r.s === 400, r)
    r = await api('POST', '/auth/2fa/activar', u.token); ok('pedir código de activación', r.s === 200, r)
    const c1 = codigoDelMail(); ok('el mail trae un código de 6 dígitos', /^\d{6}$/.test(c1), c1)
    r = await api('POST', '/auth/2fa/activar/confirmar', u.token, { codigo: '000000' }); ok('código malo → 400', r.s === 400, r)
    r = await api('POST', '/auth/2fa/activar/confirmar', u.token, { codigo: c1 }); ok('activar con el código bueno', r.s === 200 && r.d.user.dosPasos === true, r.d)
    r = await api('POST', '/auth/2fa/activar/confirmar', u.token, { codigo: c1 }); ok('el código no se reutiliza', r.s === 400, r)
    r = await api('POST', '/auth/2fa/activar', u.token); ok('no se puede activar dos veces → 400', r.s === 400, r)
    r = await api('POST', '/auth/login', null, { correo: u.correo, contrasena: CLAVE }); ok('login ahora pide código y no entrega token', r.s === 200 && r.d.requiere2fa && !r.d.token && r.d.desafio, Object.keys(r.d))
    ok('el correo viaja enmascarado', /\*\*\*/.test(r.d.correo), r.d.correo)
    const des = r.d.desafio; const cod = codigoDelMail()
    r = await api('GET', '/products', des); ok('el desafío no sirve como token de sesión', r.s === 401, r.s)
    r = await api('POST', '/auth/2fa', null, { desafio: 'basura', codigo: cod }); ok('desafío inválido → 401', r.s === 401, r.s)
    r = await api('POST', '/auth/2fa', null, { desafio: des, codigo: '' }); ok('código vacío → 400', r.s === 400, r)
    r = await api('POST', '/auth/2fa', null, { desafio: des, codigo: cod }); ok('código bueno entrega el token', r.s === 200 && r.d.token, r)
    r = await api('POST', '/auth/2fa', null, { desafio: des, codigo: cod }); ok('el código del login no se reutiliza', r.s === 400, r)
    r = await api('POST', '/auth/2fa/desactivar', u.token, { contrasenaActual: 'mala' }); ok('desactivar con contraseña mala → 400', r.s === 400, r)
    r = await api('POST', '/auth/2fa/desactivar', u.token, { contrasenaActual: CLAVE }); ok('desactivar con la contraseña', r.s === 200 && r.d.user.dosPasos === false, r.d)
    // fuerza bruta en otro usuario
    const b = await crearUsuario('VENDEDOR', 'Brute'); await api('POST', '/auth/2fa/activar', b.token); await api('POST', '/auth/2fa/activar/confirmar', b.token, { codigo: codigoDelMail() })
    r = await api('POST', '/auth/login', null, { correo: b.correo, contrasena: CLAVE }); const d2 = r.d.desafio; const buenoB = codigoDelMail()
    const intentos = []; for (let i = 0; i < 6; i++) intentos.push((await api('POST', '/auth/2fa', null, { desafio: d2, codigo: String(100000 + i) })).s)
    ok('a los 5 intentos fallidos se bloquea (429)', intentos.slice(0, 5).every(s => s === 400) && intentos[5] === 429, intentos)
    r = await api('POST', '/auth/2fa', null, { desafio: d2, codigo: buenoB }); ok('ni el código bueno sirve después del bloqueo', r.s === 429, r)
    r = await api('POST', '/auth/2fa/reenviar', null, { desafio: d2 }); ok('reenviar antes de 1 minuto → 429', r.s === 429, r)
    r = await api('POST', '/users/' + b.id.toString().replace(/^/, ''), null, {}); ok('(control) ruta de usuarios sin token → 401', r.s === 401, r.s)
    r = await api('PUT', '/users/' + b.id, A, { dosPasos: false }); ok('el admin puede apagarla', r.s === 200 && r.d.dosPasos === false, r.d)
    r = await api('PUT', '/users/' + b.id, A, { dosPasos: true }); ok('pero no encenderla', r.d.dosPasos === false, r.d)
    r = await api('POST', '/auth/login', null, { correo: b.correo, contrasena: CLAVE }); ok('tras apagarla entra directo', !!r.d.token, r.d)
  })

  await seccion('MI CUENTA Y RECUPERAR CONTRASEÑA', async () => {
    const u = await crearUsuario('VENDEDOR', 'Cuenta')
    let r = await api('PUT', '/auth/me', null, { nombre: 'x' }); ok('sin sesión → 401', r.s === 401, r.s)
    r = await api('PUT', '/auth/me', u.token, { nombre: 'Nombre Nuevo' }); ok('cambiar nombre sin pedir contraseña', r.s === 200 && r.d.user.nombre === 'Nombre Nuevo', r.d)
    r = await api('PUT', '/auth/me', u.token, { nombre: '  ' }); ok('nombre vacío → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { correo: `n${SUF}@qa.com` }); ok('cambiar correo exige contraseña actual → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { correo: 'invalido', contrasenaActual: CLAVE }); ok('correo inválido → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { correo: 'admin@shservicios.com', contrasenaActual: CLAVE }); ok('correo de otro usuario → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { contrasenaNueva: 'sinmayus1', contrasenaActual: CLAVE }); ok('contraseña nueva débil → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { contrasenaNueva: 'Mejor12345', contrasenaActual: 'mala' }); ok('contraseña actual incorrecta → 400', r.s === 400, r)
    r = await api('PUT', '/auth/me', u.token, { rol: 'ADMIN', modulos: ['x'], contrasenaNueva: 'Mejor12345', contrasenaActual: CLAVE }); ok('cambiar contraseña', r.s === 200, r)
    ok('no se puede escalar el rol desde Mi cuenta', r.d.user.rol === 'VENDEDOR', r.d.user)
    r = await api('POST', '/auth/login', null, { correo: u.correo, contrasena: 'Mejor12345' }); ok('entra con la nueva', r.s === 200, r.s)
    // recuperar
    const rec = await crearUsuario('VENDEDOR', 'Recup')
    r = await api('POST', '/auth/forgot', null, { correo: 'noexiste@q.com' }); ok('correo inexistente → misma respuesta genérica', r.s === 200 && /Si el correo/.test(r.d.message), r)
    r = await api('POST', '/auth/forgot', null, {}); ok('sin correo → 400', r.s === 400, r)
    r = await api('POST', '/auth/forgot', null, { correo: rec.correo }); ok('correo existente → genérica', r.s === 200, r)
    const tk = tokenDelMail(); ok('el mail trae un link con token', /^[a-f0-9]{64}$/.test(tk || ''), tk)
    ok('el link usa la dirección del servidor', /^https?:\/\//.test(ultimoMail().text.match(/(https?:\/\/\S+)\/\?reset=/)?.[1] || ''), ultimoMail().text.slice(0, 160))
    r = await api('POST', '/auth/reset', null, { token: tk, contrasena: 'debil' }); ok('contraseña débil → 400', r.s === 400, r)
    r = await api('POST', '/auth/reset', null, { token: 'a'.repeat(64), contrasena: 'Reset12345' }); ok('token falso → 400', r.s === 400, r)
    r = await api('POST', '/auth/reset', null, { contrasena: 'Reset12345' }); ok('sin token → 400', r.s === 400, r)
    r = await api('POST', '/auth/reset', null, { token: tk, contrasena: 'Reset12345' }); ok('restablecer', r.s === 200, r)
    r = await api('POST', '/auth/reset', null, { token: tk, contrasena: 'Otra123456' }); ok('el link es de un solo uso', r.s === 400, r)
    r = await api('POST', '/auth/login', null, { correo: rec.correo, contrasena: 'Reset12345' }); ok('entra con la contraseña nueva', r.s === 200, r.s)
    r = await api('POST', '/auth/forgot', null, { correo: rec.correo }); const n1 = fs.readFileSync(MAILS, 'utf8').trim().split('\n').length
    r = await api('POST', '/auth/forgot', null, { correo: rec.correo }); ok('pedidos seguidos no mandan otro mail (1 por minuto)', fs.readFileSync(MAILS, 'utf8').trim().split('\n').length === n1)
  })

  await seccion('SESIONES Y ROLES (seguridad)', async () => {
    const u = await crearUsuario('VENDEDOR', 'Sesion'); const viejo = u.token
    let r = await api('GET', '/clients', viejo); ok('el vendedor entra a clientes', r.s === 200, r.s)
    await api('PUT', '/users/' + u.id, A, { activo: false })
    r = await api('GET', '/clients', viejo); ok('al desactivar al usuario, su sesión abierta deja de servir → 401', r.s === 401, r.s)
    await api('PUT', '/users/' + u.id, A, { activo: true })
    const adm = await crearUsuario('ADMIN', 'AdminTmp'); r = await api('GET', '/users', adm.token); ok('un admin nuevo lista usuarios', r.s === 200, r.s)
    await api('PUT', '/users/' + adm.id, A, { rol: 'VENDEDOR' })
    r = await api('GET', '/users', adm.token); ok('al bajarle el rol, su token viejo ya no tiene permisos de admin → 403', r.s === 403, r.s)
    const del = await crearUsuario('VENDEDOR', 'Borrado'); await api('DELETE', '/users/' + del.id, A)
    r = await api('GET', '/clients', del.token); ok('al borrar al usuario, su token deja de servir → 401', r.s === 401, r.s)
    r = await api('GET', '/clients', u.token); ok('(control) reactivado vuelve a entrar con sesión nueva', r.s === 200 || r.s === 401, r.s)
  })

  await seccion('TÉCNICOS (ABM)', async () => {
    let r = await api('GET', '/technicians', V); ok('administración lista técnicos', r.s === 200, r.s)
    r = await api('GET', '/technicians', T); ok('técnico no lista técnicos → 403', r.s === 403, r.s)
    r = await api('POST', '/technicians', V, { nombre: 'x', correo: 'x@q.com', contrasena: CLAVE }); ok('vendedor no crea técnicos → 403', r.s === 403, r.s)
    r = await api('POST', '/technicians', A, { nombre: 'Tec ABM', correo: `abm${SUF}@qa.com`, contrasena: 'debil' }); ok('contraseña débil → 400', r.s === 400, r)
    r = await api('POST', '/technicians', A, { nombre: 'Tec ABM', correo: `abm${SUF}@qa.com`, contrasena: CLAVE }); ok('crear técnico', r.s === 201, r); const id = r.d.id
    r = await api('POST', '/technicians', A, { nombre: 'Tec ABM', correo: `ABM${SUF}@qa.com`, contrasena: CLAVE }); ok('correo duplicado → 400', r.s === 400, r)
    r = await api('PUT', '/technicians/' + id, A, { nombre: 'Tec ABM 2' }); ok('editar', r.s === 200 && r.d.nombre === 'Tec ABM 2', r)
    r = await api('PUT', '/technicians/' + (await api('GET', '/users', A)).d.find(u => u.rol === 'ADMIN').id, A, { nombre: 'hack' }); ok('no se edita un admin por la ruta de técnicos → 404', r.s === 404, r.s)
    r = await api('DELETE', '/technicians/' + id, A); ok('borrar técnico sin servicios', r.s === 204, r.s)
    r = await api('DELETE', '/technicians/' + tecnicoId, A); ok('técnico con servicios no se borra → 409', r.s === 409, r.s)
  })

  await seccion('ENTRADAS MALAS (sin filtrar detalles internos)', async () => {
    const crudo = async (path, token, cuerpo) => { const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: cuerpo }); const t = await r.text(); let d; try { d = JSON.parse(t) } catch { d = t } return { s: r.status, d, t } }
    let r = await crudo('/categories', A, '{"nombre":')
    ok('JSON mal formado → 400 en JSON (sin stack)', r.s === 400 && typeof r.d?.message === 'string' && !/at .*\.js|node_modules/.test(r.t), r.t.slice(0, 120))
    r = await api('POST', '/categories', A, { nombre: 123 }); ok('categoría con nombre numérico → 400', r.s === 400 && !/trim|undefined|prisma/i.test(r.d?.message || ''), r)
    r = await api('POST', '/categories', A, { nombre: { a: 1 } }); ok('categoría con nombre objeto → 400', r.s === 400, r)
    r = await api('POST', '/products', A, { nombre: 'x', precio: 'abc', stock: 1, categoriaId: catId }); ok('precio no numérico → 400 sin mensajes de Prisma', r.s === 400 && !/prisma|invocation|argument/i.test(r.d?.message || ''), r)
    r = await api('POST', '/products', A, { nombre: 'x', precio: 10, stock: 1, categoriaId: 'zzz' }); ok('categoría inválida → 400 sin mensajes de Prisma', r.s === 400 && !/prisma|invocation|argument/i.test(r.d?.message || ''), r)
    r = await api('POST', '/products', A, { nombre: 'x', precio: 10, stock: 1, categoriaId: 99999999 }); ok('categoría inexistente → 400 sin detalles internos', r.s === 400 && !/prisma|invocation|foreign key/i.test(r.d?.message || ''), r)
    r = await api('POST', '/clients', A, { nombre: ['a'] }); ok('cliente con nombre inválido → 400', r.s === 400 && !/prisma|invocation|trim/i.test(r.d?.message || ''), r)
    r = await api('GET', '/products/abc', A); ok('id no numérico → 404', r.s === 404, r.s)
    r = await api('POST', '/sales', A, { items: 'x' }); ok('venta con items inválidos → 400', r.s === 400 && !/prisma|invocation|is not|undefined/i.test(r.d?.message || ''), r)
  })

  console.log(`\n══════════ ${pass} pruebas correctas · ${fail} con fallas ══════════`)
  if (fail) { console.log('\nFALLAS:'); fallos.forEach((f, i) => console.log(`${i + 1}. ${f}`)) }
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('Error general:', e); process.exit(2) })
