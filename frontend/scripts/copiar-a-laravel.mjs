// Copia el build de React (dist/) a backend/public, así Laravel sirve la aplicación y la API desde el mismo sitio.
// index.html se guarda como app.html: lo entrega la ruta comodín de Laravel para cualquier pantalla (/ventas, /clientes, ...)
import { cpSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const publico = fileURLToPath(new URL('../../backend/public/', import.meta.url))
const PROPIOS_DE_LARAVEL = new Set(['index.php', '.htaccess', 'robots.txt'])

if (!existsSync(join(dist, 'index.html'))) throw new Error('Primero corré vite build')
rmSync(join(publico, 'assets'), { recursive: true, force: true })
for (const archivo of readdirSync(dist)) {
  if (PROPIOS_DE_LARAVEL.has(archivo)) continue
  cpSync(join(dist, archivo), join(publico, archivo), { recursive: true })
}
renameSync(join(publico, 'index.html'), join(publico, 'app.html'))
console.log('Frontend copiado a backend/public')
