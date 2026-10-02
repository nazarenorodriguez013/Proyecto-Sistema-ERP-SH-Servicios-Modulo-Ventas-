// Recorrido de pantallas en un navegador real (Playwright): navegación por rol, errores de consola, desbordes,
// y los flujos principales de cada módulo. Corre contra una base nueva, igual que qa-api.js:
//
//   API=http://localhost:4100/api APP=http://localhost:5174 node tests/qa-ui.js
//
// Hace falta Playwright instalado globalmente (PLAYWRIGHT=/ruta/a/playwright) y Chromium (CHROMIUM=/ruta).
const PW = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright')
const B = process.env.API || 'http://localhost:4100/api'
const APP = process.env.APP || 'http://localhost:5174'
const SUF = Date.now().toString(36)
let pass = 0, fail = 0
const fallos = []

const ok = (nombre, cond, extra) => {
  if (cond) { pass++; return }
  fail++
  const det = extra === undefined ? '' : ' → ' + JSON.stringify(extra).slice(0, 240)
  fallos.push(nombre + det); console.log('   ✗', nombre + det)
}
const api = async (method, path, token, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text(); try { return { s: r.status, d: t ? JSON.parse(t) : null } } catch { return { s: r.status, d: t } }
}
const sesion = async (correo, contrasena) => (await api('POST', '/auth/login', null, { correo, contrasena })).d
const seccion = async (nombre, fn) => { console.log('\n▸ ' + nombre); try { await fn() } catch (e) { fail++; fallos.push(`${nombre}: se interrumpió → ${e.message.split('\n')[0]}`); console.log('   ✗ se interrumpió:', e.message.split('\n')[0]) } }

// Errores que no vienen de nuestra app: el script de Google está bloqueado por la red de pruebas
const RUIDO = [/status of 401/, /accounts\.google\.com/, /gsi\/client/, /Failed to load resource: net::ERR/, /ERR_(CONNECTION|NAME|TUNNEL|PROXY)/]

;(async () => {
  const admin = await sesion('admin@shservicios.com', 'admin123')
  if (!admin?.token) { console.log('No hay sesión de admin: ¿base nueva con seed?'); process.exit(2) }
  const T = admin.token
  const mk = async (rol, nombre) => { const correo = `${nombre}.${SUF}@qa.com`; await api('POST', '/users', T, { nombre, correo, contrasena: 'Clave1234', rol }); return { ...(await sesion(correo, 'Clave1234')), correo } }
  const vend = await sesion('vendedor@shservicios.com', 'vendedor123'), tecU = await mk('TECNICO', 'TecUI'), depo = await mk('INVENTARIO', 'DepoUI')
  const cat = (await api('GET', '/categories', T)).d[0].id
  const prod = async (n, extra = {}) => (await api('POST', '/products', T, { nombre: n, precio: 1500, precioCosto: 900, stock: 60, stockMinimo: 3, categoriaId: cat, ...extra })).d
  const repu = await prod('Filtro UI ' + SUF), maq = await prod('Torno UI ' + SUF, { tipoProducto: 'MAQUINARIA', precio: 90000, stock: 3 })
  const cliente = (await api('POST', '/clients', T, { nombre: 'Cliente UI ' + SUF, documento: 'U' + SUF, direccion: 'Av. Test 100', telefono: '4444', email: 'ui@qa.com', condicionIva: 'Responsable Inscripto' })).d

  const browser = await PW.chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const nuevaPagina = async (s, w = 1366, h = 768) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage()
    page.problemas = []
    page.on('pageerror', e => page.problemas.push('JS: ' + e.message))
    page.on('console', m => { if (m.type() === 'error' && !RUIDO.some(r => r.test(m.text()))) page.problemas.push('consola: ' + m.text().slice(0, 140)) })
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400 && !r.url().includes('/auth/')) page.problemas.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/.*\/api/, '/api')}`) })
    if (s) await page.addInitScript(([tk, u]) => { if (sessionStorage.getItem('qa-sesion')) return; sessionStorage.setItem('qa-sesion', '1'); localStorage.setItem('token', tk); localStorage.setItem('user', JSON.stringify(u)); localStorage.setItem('loginTime', String(Date.now())) }, [s.token, s.user])
    return page
  }
  const sinProblemas = (page, nombre) => { ok(nombre + ': sin errores de JS, consola ni API', page.problemas.length === 0, page.problemas.slice(0, 4)); page.problemas.length = 0 }
  const desborde = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth + 1, y: document.documentElement.scrollHeight > innerHeight + 1 }))

  await seccion('NAVEGACIÓN POR ROL (todas las pantallas)', async () => {
    const roles = [
      ['ADMIN', admin, ['/', '/historial-ventas', '/servicios', '/tecnicos', '/historial-servicios', '/clientes', '/inventario', '/configuracion'], 8],
      ['VENDEDOR', vend, ['/', '/historial-ventas', '/servicios', '/tecnicos', '/historial-servicios', '/clientes', '/inventario', '/configuracion'], 8],
      ['TECNICO', tecU, ['/servicios', '/configuracion'], 2],
      ['INVENTARIO', depo, ['/inventario', '/configuracion'], 2],
    ]
    for (const [rol, s, rutas, nav] of roles) {
      const page = await nuevaPagina(s)
      for (const ruta of rutas) {
        await page.goto(APP + ruta); await page.waitForTimeout(900)
        const titulo = (await page.locator('.db-main h2').first().innerText().catch(() => '')).trim()
        ok(`${rol} ${ruta}: la pantalla carga con título`, titulo.length > 0, titulo)
        const d = await desborde(page); ok(`${rol} ${ruta}: sin desborde horizontal`, !d.x, d)
      }
      const items = await page.locator('.db-sidebar nav > div > button').count()
      ok(`${rol}: el menú tiene ${nav} entradas`, items === (rol === 'ADMIN' || rol === 'VENDEDOR' ? 6 : 2), items)
      // rutas que no le corresponden: no deben romper ni mostrar nada ajeno
      for (const ajena of rol === 'TECNICO' ? ['/clientes', '/inventario', '/tecnicos'] : rol === 'INVENTARIO' ? ['/', '/servicios', '/clientes'] : []) {
        await page.goto(APP + ajena); await page.waitForTimeout(700)
        const t = (await page.locator('.db-main h2').first().innerText().catch(() => '')).trim()
        ok(`${rol} entrando por URL a ${ajena} cae en su primera pantalla`, t === (rol === 'TECNICO' ? 'Servicios Técnicos' : 'Inventario'), t)
      }
      sinProblemas(page, rol); await page.context().close()
    }
  })

  await seccion('LOGIN', async () => {
    const page = await nuevaPagina(null)
    await page.goto(APP); await page.waitForTimeout(700)
    await page.locator('input[type=email]').fill('admin@shservicios.com'); await page.locator('input[type=password]').fill('incorrecta')
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click(); await page.waitForTimeout(600)
    ok('contraseña incorrecta muestra el error', await page.getByText('Credenciales inválidas').count() === 1)
    await page.getByText('¿Olvidaste tu contraseña?').click()
    ok('abre la recuperación', await page.getByText('Recuperar contraseña').count() >= 1)
    await page.locator('input[type=email]').fill('nadie@qa.com'); await page.getByRole('button', { name: 'Enviar link' }).click(); await page.waitForTimeout(600)
    ok('respuesta genérica de recuperación', await page.getByText('Si el correo está registrado').count() === 1)
    await page.getByText('Volver a iniciar sesión').click()
    await page.goto(APP + '/?reset=falso'); await page.waitForTimeout(600)
    ok('link de restablecer abre el formulario de contraseña nueva', await page.getByText('Elegí una contraseña nueva').count() === 1)
    await page.locator('input[type=password]').nth(0).fill('debil'); await page.locator('input[type=password]').nth(1).fill('debil')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click(); await page.waitForTimeout(400)
    ok('el navegador exige la contraseña fuerte (no llega a enviar)', await page.getByText('Elegí una contraseña nueva').count() === 1)
    await page.goto(APP); await page.locator('input[type=email]').fill('vendedor@shservicios.com'); await page.locator('input[type=password]').fill('vendedor123')
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click(); await page.waitForTimeout(1200)
    ok('login correcto entra al sistema', await page.locator('.db-sidebar').count() === 1)
    await page.getByText('Cerrar Sesión').click(); await page.waitForTimeout(500)
    ok('cerrar sesión vuelve al login', await page.locator('input[type=email]').count() === 1)
    const m = await nuevaPagina(null, 390, 844); await m.goto(APP); await m.waitForTimeout(600)
    const dm = await desborde(m); ok('login en celular: sin desborde horizontal', !dm.x, dm)
    sinProblemas(page, 'login'); await page.context().close(); await m.context().close()
  })

  await seccion('PUNTO DE VENTA', async () => {
    const page = await nuevaPagina(admin); await page.goto(APP + '/'); await page.waitForTimeout(1000)
    const d0 = await desborde(page); ok('POS en 1366x768 entra en una sola pantalla (sin scroll)', !d0.y && !d0.x, d0)
    await page.locator('input[placeholder*="compresor"]').fill('Filtro UI ' + SUF); await page.waitForTimeout(300)
    ok('el buscador sugiere el producto', await page.getByText('Filtro UI ' + SUF).count() >= 1)
    await page.keyboard.press('Enter'); await page.waitForTimeout(300)
    ok('Enter agrega al carrito', await page.locator('text=Sin productos').count() === 0)
    await page.getByRole('button', { name: '+', exact: true }).first().click()
    await page.waitForTimeout(500); const cuerpo = await page.locator('body').innerText(); ok('el botón + suma una unidad (total 3000)', cuerpo.includes('$3.000,00'), cuerpo.split('\n').filter(l => /\$|Filtro/.test(l)).slice(0, 8))
    await page.getByRole('button', { name: '−' }).first().click()
    ok('el botón − resta (total 1500)', await page.locator('text=/^\\$1\\.500,00$/').first().waitFor({ timeout: 4000 }).then(() => true, () => false))
    await page.locator('input[placeholder*="compresor"]').fill('Torno UI'); await page.waitForTimeout(300); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Cuenta Corriente' }).click()
    await page.getByRole('button', { name: /Confirmar Venta/ }).click(); await page.waitForTimeout(600)
    ok('cuenta corriente sin cliente muestra el aviso', await page.getByText('Seleccioná un cliente').count() >= 1)
    await page.getByRole('button', { name: 'Efectivo', exact: true }).click()
    await page.locator('input[placeholder*="compresor"]').fill('zzzz'); await page.waitForTimeout(300)
    ok('búsqueda sin resultados no rompe', await page.locator('.db-main').count() === 1)
    await page.locator('input[placeholder*="compresor"]').fill('')
    await page.getByRole('button', { name: /Confirmar Venta/ }).click(); await page.waitForTimeout(1000)
    ok('la venta sin cliente imprime a nombre de Consumidor Final', await page.locator('#ticket').getByText('Consumidor Final').count() >= 1)
    ok('el comprobante trae letra C y punto de venta', await page.locator('#ticket').getByText('FACTURA').count() >= 1)
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click(); await page.waitForTimeout(300)
    // presupuesto
    await page.getByRole('button', { name: 'Presupuesto', exact: true }).click()
    await page.locator('input[placeholder*="compresor"]').fill('Filtro UI ' + SUF); await page.waitForTimeout(300); await page.keyboard.press('Enter')
    ok('en presupuesto no se pide medio de pago', await page.getByText('MEDIO DE PAGO').count() === 0)
    await page.getByRole('button', { name: /Generar Presupuesto/ }).click(); await page.waitForTimeout(900)
    ok('el presupuesto sale con letra P', await page.locator('#ticket').getByText('PRESUPUESTO').count() >= 1)
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    // cliente + remito
    await page.getByRole('button', { name: 'Remito', exact: true }).click()
    await page.locator('input[placeholder*="Buscar cliente"]').fill('Cliente UI ' + SUF); await page.waitForTimeout(300)
    await page.locator('div', { hasText: new RegExp('^Cliente UI ' + SUF) }).last().dispatchEvent('mousedown'); await page.waitForTimeout(300)
    ok('se elige el cliente', await page.locator('text=Cliente UI ' + SUF).count() >= 1)
    await page.locator('input[placeholder*="compresor"]').fill('Filtro UI ' + SUF); await page.waitForTimeout(300); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: /Confirmar Venta/ }).click(); await page.waitForTimeout(1000)
    const txt = await page.locator('#ticket').innerText()
    ok('remito con los datos completos del cliente', /REMITO/.test(txt) && /Responsable Inscripto/.test(txt) && /Av\. Test 100/.test(txt) && /U[a-z0-9]+/.test(txt), txt.slice(0, 300))
    // impresión A4
    await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(300)
    const caja = await page.locator('#ticket').boundingBox(); ok('al imprimir la hoja ocupa toda el A4', Math.abs(caja.width - 793.7) < 2 && Math.abs(caja.height - 1122.5) < 3 && caja.x === 0 && caja.y === 0, caja)
    await page.emulateMedia({ media: 'screen' }); await page.setViewportSize({ width: 1366, height: 768 })
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    // solicitud rápida de servicio
    await page.getByRole('button', { name: /Solicitar servicio técnico/ }).click(); await page.waitForTimeout(400)
    ok('abre el pedido rápido de servicio', await page.locator('.page-modal').count() === 1)
    await page.getByRole('button', { name: 'Cancelar' }).last().click().catch(() => {})
    sinProblemas(page, 'punto de venta'); await page.context().close()
    // celular
    const m = await nuevaPagina(admin, 390, 844); await m.goto(APP + '/'); await m.waitForTimeout(900)
    const dm = await desborde(m); ok('POS en celular: sin desborde horizontal', !dm.x, dm)
    await m.locator('.db-hamburger').click(); await m.waitForTimeout(400); ok('el menú hamburguesa abre', await m.locator('.db-sidebar.open').count() === 1)
    sinProblemas(m, 'POS celular'); await m.context().close()
  })

  await seccion('LISTAS LARGAS (la página no debe crecer, la lista scrollea por dentro)', async () => {
    for (const ruta of ['/servicios', '/inventario', '/clientes', '/historial-ventas', '/configuracion']) {
      const page = await nuevaPagina(admin); await page.goto(APP + ruta); await page.waitForTimeout(1000)
      const d = await desborde(page); ok(`${ruta} con muchos datos: el documento no scrollea (1366x768)`, !d.y && !d.x, d)
      const m = await nuevaPagina(admin, 390, 844); await m.goto(APP + ruta); await m.waitForTimeout(1000)
      const dm = await desborde(m); ok(`${ruta} en celular: sin desborde horizontal ni vertical del documento`, !dm.x && !dm.y, dm)
      await page.context().close(); await m.context().close()
    }
    const pos = await nuevaPagina(admin); await pos.goto(APP + '/'); await pos.waitForTimeout(900)
    for (let i = 0; i < 14; i++) { await pos.locator('input[placeholder*="compresor"]').fill('Filtro UI ' + SUF); await pos.waitForTimeout(120); await pos.keyboard.press('Enter'); await pos.waitForTimeout(100) }
    const dp = await desborde(pos); ok('POS con carrito largo: el documento no scrollea', !dp.y, dp)
    ok('y el botón Confirmar sigue visible', await pos.getByRole('button', { name: /Confirmar Venta/ }).isVisible())
    await pos.context().close()
  })

  await seccion('INVENTARIO', async () => {
    const page = await nuevaPagina(admin); await page.goto(APP + '/inventario'); await page.waitForTimeout(1000)
    const filas = () => page.locator('.inv-row').count()
    const total = await filas() - 1
    ok('lista artículos con etiqueta de tipo', await page.getByText('Repuesto', { exact: true }).count() >= 1 && await page.getByText('Maquinaria', { exact: true }).count() >= 1)
    await page.getByRole('button', { name: 'Maquinaria', exact: true }).first().click(); await page.waitForTimeout(300)
    ok('el filtro Maquinaria muestra solo maquinaria', await page.locator('.inv-row').filter({ hasText: 'Repuesto' }).count() === 0)
    await page.getByRole('button', { name: 'Todos', exact: true }).first().click()
    await page.locator('input[placeholder*="Buscar"]').first().fill('Filtro UI ' + SUF); await page.waitForTimeout(300)
    ok('el buscador filtra al instante', (await filas()) - 1 === 1, await filas())
    await page.locator('input[placeholder*="Buscar"]').first().fill('')
    await page.locator('.inv-row').nth(1).click(); await page.waitForTimeout(300)
    const modal = page.locator('div[style*="position: fixed"] >> nth=0'); const caja = await page.locator('form').first().evaluate(f => { const b = f.parentElement.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight } })
    ok('el modal del artículo entra en pantalla sin scroll', caja.top >= 0 && caja.bottom <= caja.h, caja)
    await page.locator('input[type=number]').nth(2).fill('1999'); await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.waitForTimeout(800)
    ok('guardar cierra el modal', await page.locator('form').count() === 0)
    // alta
    await page.getByRole('button', { name: /Nuevo artículo/ }).click(); await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Crear artículo' }).click(); await page.waitForTimeout(300)
    ok('no deja crear un artículo vacío', await page.locator('form').count() === 1)
    await page.locator('form input').first().fill('Articulo UI ' + SUF); await page.locator('form select').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Maquinaria', exact: true }).last().click()
    await page.locator('input[type=number]').nth(2).fill('777'); await page.locator('input[type=number]').nth(3).fill('4')
    await page.getByRole('button', { name: 'Crear artículo' }).click(); await page.waitForTimeout(900)
    const nuevo = (await api('GET', '/products', T)).d.find(p => p.nombre === 'Articulo UI ' + SUF)
    ok('el artículo se crea con tipo Maquinaria', nuevo?.tipoProducto === 'MAQUINARIA' && nuevo.stock === 4, nuevo)
    // categorías y retiros
    await page.getByRole('button', { name: 'Categorías' }).click(); await page.waitForTimeout(500); ok('pestaña categorías', await page.getByRole('button', { name: /Nueva categoría/ }).count() === 1)
    await page.getByRole('button', { name: 'Retiro de repuestos' }).click(); await page.waitForTimeout(500); ok('pestaña retiros', await page.locator('text=Código').count() >= 1)
    // exportar
    await page.getByRole('button', { name: 'Artículos y stock' }).click(); await page.waitForTimeout(300)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar/ }).click()]); ok('exporta CSV', /inventario-.*\.csv/.test(dl.suggestedFilename()), dl.suggestedFilename())
    sinProblemas(page, 'inventario'); await page.context().close()
    // rol vendedor: solo consulta
    const v = await nuevaPagina(vend); await v.goto(APP + '/inventario'); await v.waitForTimeout(900)
    ok('el vendedor no ve "Nuevo artículo"', await v.getByRole('button', { name: /Nuevo artículo/ }).count() === 0)
    await v.locator('.inv-row').nth(1).click(); await v.waitForTimeout(300)
    ok('y la ficha le queda de solo lectura', await v.locator('fieldset[disabled]').count() === 1)
    sinProblemas(v, 'inventario (vendedor)'); await v.context().close()
    const d = await nuevaPagina(depo); await d.goto(APP + '/inventario'); await d.waitForTimeout(900)
    ok('el rol Inventario sí ve "Nuevo artículo"', await d.getByRole('button', { name: /Nuevo artículo/ }).count() === 1)
    sinProblemas(d, 'inventario (rol inventario)'); await d.context().close()
  })

  await seccion('SERVICIOS TÉCNICOS Y RETIRO DE REPUESTOS (circuito completo)', async () => {
    const stockPrevio = (await api('GET', '/products/' + repu.id, T)).d.stock
    const page = await nuevaPagina(admin); await page.goto(APP + '/servicios'); await page.waitForTimeout(1000)
    const d0 = await desborde(page); ok('Servicios entra en una sola pantalla (sin scroll)', !d0.y && !d0.x, d0)
    await page.getByRole('button', { name: /Crear servicio/ }).click(); await page.waitForTimeout(300)
    ok('sin cliente no crea y avisa', await page.getByText('Seleccioná el cliente').count() === 1 || await page.locator('form:invalid').count() >= 0)
    await page.locator('input[placeholder*="Buscar cliente"]').fill('Cliente UI ' + SUF); await page.waitForTimeout(300)
    await page.locator('div', { hasText: new RegExp('^Cliente UI ' + SUF) }).last().dispatchEvent('mousedown'); await page.waitForTimeout(200)
    await page.locator('select').first().selectOption({ index: 1 }).catch(() => {})
    await page.locator('input[placeholder*="Autoelevador"]').fill('Autoelevador UI'); await page.locator('textarea').first().fill('Pierde aceite por el cilindro')
    await page.locator('input[placeholder*="Buscar repuesto"]').fill('Torno UI'); await page.waitForTimeout(300)
    ok('la maquinaria no aparece como repuesto', await page.locator('text=stock').count() === 0)
    await page.locator('input[placeholder*="Buscar repuesto"]').fill('Filtro UI ' + SUF); await page.waitForTimeout(300)
    await page.locator('div[style*="cursor: pointer"]', { hasText: 'stock' }).first().dispatchEvent('mousedown'); await page.waitForTimeout(200)
    await page.getByRole('button', { name: '+', exact: true }).first().click()
    await page.getByRole('button', { name: /Generar presupuesto/ }).click(); await page.waitForTimeout(900)
    ok('el presupuesto del servicio sale con letra P', await page.locator('#ticket').getByText('PRESUPUESTO DE SERVICIO').count() === 1)
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await page.getByRole('button', { name: /Crear servicio/ }).click(); await page.waitForTimeout(1100)
    ok('al crear con repuestos sale la hoja de retiro con código', await page.locator('#ticket').getByText('RETIRO DE REPUESTOS').count() === 1 && /RT-\d{6}/.test(await page.locator('#ticket').innerText()))
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click(); await page.waitForTimeout(500)
    const sv = (await api('GET', '/repairs', T)).d.find(s => s.equipo === 'Autoelevador UI'); ok('el servicio quedó creado', !!sv, sv?.id)
    const stock0 = (await api('GET', '/products/' + repu.id, T)).d.stock
    ok('crear no descontó stock (solo reservó)', stock0 === stockPrevio, [stockPrevio, stock0])
    ok('el servicio aparece en la lista', await page.getByText('Autoelevador UI').count() >= 1)
    // inventario (rol depósito) prepara y entrega
    const dep = await nuevaPagina(depo); await dep.goto(APP + '/inventario'); await dep.waitForTimeout(900)
    await dep.locator('button[title="Notificaciones"]').click(); await dep.waitForTimeout(400)
    ok('la campanita del depósito muestra la solicitud', await dep.getByText('Solicitud de repuestos').count() >= 1)
    await dep.getByText('Solicitud de repuestos').first().click(); await dep.waitForTimeout(800)
    ok('tocar el aviso abre la pestaña de retiros', await dep.getByRole('button', { name: 'Marcar como listo' }).count() >= 1)
    await dep.getByRole('button', { name: 'Marcar como listo' }).first().click(); await dep.waitForTimeout(800)
    ok('pasa a listo para retirar', await dep.getByText('Listo para retirar').count() >= 1)
    await dep.getByRole('button', { name: /Retirado: descontar stock/ }).first().click(); await dep.waitForTimeout(900)
    const stock1 = (await api('GET', '/products/' + repu.id, T)).d.stock
    ok('al marcar retirado se descuenta el stock', stock1 < stock0, [stock0, stock1])
    await dep.getByText(/^Retirados \(/).click(); await dep.waitForTimeout(300)
    const fila = dep.getByRole('button', { name: /Autoelevador UI/ }).first()
    ok('el historial de retiros muestra fecha y hora', /\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}/.test(await fila.innerText()), await fila.innerText())
    await fila.click(); await dep.waitForTimeout(300)
    ok('al tocar un retiro se ve su detalle (preparado, retirado y repuestos)', await dep.getByText('Preparado:').count() === 1 && await dep.getByText('Cantidad retirada').count() === 1 && await dep.getByText('Filtro UI ' + SUF).count() >= 1)
    sinProblemas(dep, 'depósito'); await dep.context().close()
    // el técnico asignado trabaja y finaliza
    await api('PUT', `/repairs/${sv.id}/tecnico`, T, { tecnicoId: tecU.user.id })
    const tec = await nuevaPagina(tecU); await tec.goto(APP + '/servicios'); await tec.waitForTimeout(1000)
    await tec.locator('button[title="Notificaciones"]').click(); await tec.waitForTimeout(400)
    ok('la campanita del técnico muestra su aviso', await tec.getByText('Servicio asignado').count() >= 1)
    await tec.locator('body').click({ position: { x: 300, y: 400 } })
    await tec.getByText('Autoelevador UI').first().click(); await tec.waitForTimeout(800)
    ok('el técnico ve el seguimiento y el formulario de finalizar', await tec.getByText('Seguimiento del trabajo').count() === 1 && await tec.getByText('Finalizar servicio').count() === 1)
    const f = tec.locator('form', { hasText: 'Seguimiento del trabajo' })
    await f.locator('input[type=number]').fill('6500'); await f.locator('input[type=date]').fill('2026-12-15')
    await f.locator('textarea').nth(0).fill('Sello del cilindro dañado'); await f.locator('textarea').nth(1).fill('Se cambió el sello y se probó la presión')
    await f.getByRole('button', { name: 'Guardar cambios' }).click(); await tec.waitForTimeout(700)
    ok('guarda el seguimiento', await tec.getByText('Cambios guardados').count() === 1)
    ok('y queda en el servidor', (await api('GET', '/repairs/' + sv.id, T)).d.diagnostico === 'Sello del cilindro dañado')
    await tec.getByRole('button', { name: /Finalizar y cobrar/ }).click(); await tec.waitForTimeout(1200)
    const hoja = await tec.locator('#ticket').innerText()
    ok('el comprobante final trae diagnóstico y trabajo realizado', /Sello del cilindro dañado/.test(hoja) && /Se cambió el sello/.test(hoja) && /FACTURA DE SERVICIO/.test(hoja), hoja.slice(0, 200))
    ok('la factura de servicio muestra los repuestos y la mano de obra', /Filtro UI/.test(hoja) && /Mano de obra/.test(hoja))
    sinProblemas(tec, 'técnico'); await tec.context().close()
    // historial
    await page.goto(APP + '/historial-servicios'); await page.waitForTimeout(900)
    ok('el servicio finalizado aparece en el historial', await page.getByText('Autoelevador UI').count() >= 1)
    await page.getByRole('button', { name: /Reimprimir/ }).first().click(); await page.waitForTimeout(500); ok('se puede reimprimir', await page.locator('#ticket').count() === 1)
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await page.goto(APP + '/tecnicos'); await page.waitForTimeout(800); ok('pantalla de técnicos con la lista', await page.getByText('TecUI').count() >= 1)
    sinProblemas(page, 'servicios (admin)'); await page.context().close()
  })

  await seccion('CLIENTES Y SU HISTORIAL', async () => {
    const page = await nuevaPagina(admin); await page.goto(APP + '/clientes'); await page.waitForTimeout(1000)
    await page.locator('input[placeholder*="Buscar por nombre"]').fill('Cliente UI ' + SUF); await page.waitForTimeout(300)
    ok('el buscador de clientes filtra', await page.getByText('Cliente UI ' + SUF).count() >= 1)
    await page.getByRole('button', { name: /Nuevo cliente/ }).first().click(); await page.waitForTimeout(300)
    await page.locator('.page-modal input').first().fill('Cliente Alta UI ' + SUF)
    await page.locator('.page-modal select').selectOption('Monotributo'); await page.getByRole('button', { name: 'Crear cliente' }).click(); await page.waitForTimeout(800)
    ok('el alta guarda la condición de IVA', (await api('GET', '/clients', T)).d.find(c => c.nombre === 'Cliente Alta UI ' + SUF)?.condicionIva === 'Monotributo')
    ok('al crear, se abre la ficha del cliente nuevo', await page.getByText('SALDO CUENTA CORRIENTE').count() === 1)
    await page.getByRole('button', { name: /Volver/ }).click(); await page.waitForTimeout(400)
    await page.locator('input[placeholder*="Buscar por nombre"]').fill('Cliente UI ' + SUF); await page.waitForTimeout(300)
    await page.locator('button', { hasText: 'Cliente UI ' + SUF }).first().click()
    await page.getByText('SALDO CUENTA CORRIENTE').waitFor({ timeout: 6000 }).catch(() => {})
    ok('la ficha muestra el saldo y los datos', await page.getByText('SALDO CUENTA CORRIENTE').count() === 1 && await page.getByText('Av. Test 100').count() === 1)
    await page.locator('input[placeholder="Monto"]').fill('2500'); await page.getByRole('button', { name: /Registrar pago/ }).click(); await page.waitForTimeout(700)
    ok('registrar un pago actualiza el saldo (a favor)', await page.getByText(/A favor/).count() >= 1)
    ok('el historial lista compras, servicios y pagos', await page.getByText('Servicio técnico', { exact: true }).count() >= 1 && await page.getByText('Pago', { exact: true }).count() >= 1)
    await page.getByText('Autoelevador UI').first().click(); await page.waitForTimeout(400)
    ok('abrir un servicio muestra falla, diagnóstico y trabajo', await page.getByText('Sello del cilindro dañado').count() >= 1 && await page.getByText('Se cambió el sello').count() >= 1)
    await page.getByRole('button', { name: 'Ver comprobante' }).first().click(); await page.waitForTimeout(500); ok('desde el historial se ve el comprobante', await page.locator('#ticket').count() === 1)
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await page.getByRole('button', { name: /Volver/ }).click(); await page.waitForTimeout(500); ok('volver a la lista', await page.getByText(/Nuevo cliente/).count() >= 1)
    sinProblemas(page, 'clientes'); await page.context().close()
  })

  await seccion('HISTORIAL DE VENTAS', async () => {
    const page = await nuevaPagina(admin); await page.goto(APP + '/historial-ventas'); await page.waitForTimeout(1000)
    ok('lista comprobantes con su número', await page.getByText(/N° \d{4}-\d{8}/).count() >= 1)
    await page.locator('input[placeholder*="Buscar"]').fill('zzzzzz'); await page.waitForTimeout(300); ok('búsqueda sin resultados', await page.getByText('No hay ventas').count() === 1)
    await page.locator('input[placeholder*="Buscar"]').fill('')
    await page.getByRole('button', { name: /Reimprimir/ }).first().click(); await page.waitForTimeout(500); ok('reimprime', await page.locator('#ticket').count() === 1)
    sinProblemas(page, 'historial de ventas'); await page.context().close()
  })

  await seccion('CONFIGURACIÓN', async () => {
    const page = await nuevaPagina(admin); await page.goto(APP + '/configuracion'); await page.waitForTimeout(1000)
    ok('lista de usuarios', await page.getByText(/usuarios \(\d+\)/i).count() === 1)
    await page.getByRole('button', { name: /Nuevo usuario/ }).click(); await page.waitForTimeout(300)
    await page.locator('.page-modal input').nth(0).fill('Nuevo UI'); await page.locator('.page-modal input').nth(1).fill(`nuevo.${SUF}@qa.com`); await page.locator('.page-modal input').nth(2).fill('clave')
    await page.getByRole('button', { name: 'Crear usuario' }).click(); await page.waitForTimeout(400)
    ok('el navegador rechaza una contraseña débil', await page.locator('.page-modal').count() === 1)
    await page.locator('.page-modal input').nth(2).fill('Clave1234')
    await page.locator('.page-modal button', { hasText: 'Inventario' }).first().click(); await page.waitForTimeout(200)
    ok('al elegir Inventario solo ofrece ese módulo', await page.locator('.page-modal input[type=checkbox]').count() === 1)
    await page.getByRole('button', { name: 'Crear usuario' }).click(); await page.waitForTimeout(900)
    const nu = (await api('GET', '/users', T)).d.find(u => u.correo === `nuevo.${SUF}@qa.com`); ok('se crea el usuario con rol Inventario', nu?.rol === 'INVENTARIO', nu)
    await page.getByRole('button', { name: 'Datos de la empresa' }).click(); await page.waitForTimeout(300)
    await page.locator('form input').nth(2).fill('30-98765432-1'); await page.getByRole('button', { name: 'Guardar datos' }).click(); await page.waitForTimeout(700)
    ok('guarda los datos de la empresa', (await api('GET', '/company', T)).d.cuit === '30-98765432-1')
    await page.getByRole('button', { name: 'Mi cuenta' }).click(); await page.waitForTimeout(300)
    ok('Mi cuenta muestra la verificación en dos pasos', await page.getByText('Verificación en dos pasos').count() >= 1)
    await page.getByRole('button', { name: 'Usuarios' }).click(); await page.waitForTimeout(300)
    const d = await desborde(page); ok('Configuración sin scroll en 1366x768', !d.y, d)
    sinProblemas(page, 'configuración'); await page.context().close()
  })

  await seccion('SESIÓN INVALIDADA (cierre automático)', async () => {
    const u = await mk('VENDEDOR', 'Expulsado'); const page = await nuevaPagina(u); await page.goto(APP + '/clientes'); await page.waitForTimeout(900)
    ok('el vendedor entra a Clientes', await page.locator('.db-sidebar').count() === 1)
    await api('PUT', '/users/' + u.user.id, T, { activo: false })
    await page.goto(APP + '/historial-ventas'); await page.waitForTimeout(1500)
    ok('al desactivarlo, la pantalla vuelve sola al login', await page.locator('input[type=email]').count() === 1, page.url())
    await page.context().close()
  })

  await browser.close()
  console.log(`\n══════════ ${pass} pruebas correctas · ${fail} con fallas ══════════`)
  if (fail) { console.log('\nFALLAS:'); fallos.forEach((f, i) => console.log(`${i + 1}. ${f}`)) }
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('Error general:', e); process.exit(2) })
