<?php

namespace App\Http\Controllers;

use App\Models\Categoria;
use App\Models\Producto;
use App\Support\Erp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Importación de maquinaria y repuestos desde CSV, como "Importar" del panel del catálogo: primero se previsualiza
// (con los errores de cada fila) y recién después se confirma. Acepta tal cual lo que exporta el catálogo: las columnas
// que el ERP no maneja se ignoran, marca y modelo van a la descripción y los dólares se pasan a pesos con la cotización indicada
class ImportacionController extends Controller
{
    private const COLUMNAS = ['codigo', 'nombre', 'descripcion', 'categoria', 'costo', 'ganancia', 'precio', 'stock', 'stock_minimo', 'activo', 'marca', 'modelo', 'moneda', 'resumen'];
    // Encabezados del catálogo con otro nombre que el de la plantilla del ERP
    private const SINONIMOS = ['codigo_interno' => 'codigo', 'precio_final' => 'precio', 'ganancia_porcentaje' => 'ganancia', 'costo_precio' => 'costo',
        'stock_minimo_unidades' => 'stock_minimo', 'publicado' => 'activo', 'publicada' => 'activo'];
    private const TIPOS = ['maquinaria' => 'MAQUINARIA', 'repuestos' => 'REPUESTO'];
    private const ETIQUETA = ['MAQUINARIA' => 'una máquina', 'REPUESTO' => 'un repuesto'];
    private const NOMBRE_TIPO = ['MAQUINARIA' => 'Maquinaria', 'REPUESTO' => 'Repuestos'];
    private const MAX_FILAS = 5000;
    // Columnas que solo trae el archivo del catálogo de un tipo (ya normalizadas)
    private const SOLO_MAQUINARIA = ['modelo', 'ano', 'anio', 'horas', 'combustible', 'capacidad_kg', 'nro_de_serie', 'numero_serie', 'tipo_de_mastil', 'tipo_mastil'];
    private const SOLO_REPUESTOS = ['codigo_oem', 'fabricante', 'codigo_fabricante', 'origen', 'compatible_con', 'compatibilidad', 'compatibilidades'];
    private const COLUMNA_A_CAMPO = ['nombre' => 'nombre', 'descripcion' => 'descripcion', 'precioCosto' => 'precio_costo', 'precio' => 'precio', 'stock' => 'stock', 'stockMinimo' => 'stock_minimo', 'activo' => 'activo'];

    private function archivoDeOtroTipo(string $delArchivo): string
    {
        $otro = $delArchivo === 'MAQUINARIA' ? 'REPUESTO' : 'MAQUINARIA';

        return 'Este archivo es de '.self::NOMBRE_TIPO[$delArchivo].', pero elegiste importar '.self::NOMBRE_TIPO[$otro].'. '
            .'Cambiá "¿Qué querés importar?" a '.self::NOMBRE_TIPO[$delArchivo].' y volvé a previsualizar.';
    }

    // "Código de barras" -> "codigo_de_barras": los encabezados se comparan sin acentos, mayúsculas ni espacios
    private static function normalizarEncabezado(string $h): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', '_', strtolower(trim(Str::ascii($h)))), '_');
    }

    // Separa un CSV respetando comillas ("a; b" queda como un solo campo y "" es una comilla literal).
    // El separador (punto y coma o coma) se deduce de la fila de encabezados. Se recorre por bytes: en UTF-8 los
    // separadores y las comillas nunca aparecen dentro de un carácter acentuado
    private static function parsearCsv(string $texto): array
    {
        $contenido = str_starts_with($texto, "\xEF\xBB\xBF") ? substr($texto, 3) : $texto;
        // El CSV del catálogo empieza con "sep=;" (le indica el separador a Excel): se usa ese y se saca la línea
        $sep = null;
        if (preg_match('/^sep=(.)\r?\n/i', $contenido, $m)) {
            $sep = $m[1];
            $contenido = substr($contenido, strlen($m[0]));
        }
        $primera = preg_split('/\r?\n/', $contenido, 2)[0] ?? '';
        $sep ??= substr_count($primera, ';') >= substr_count($primera, ',') ? ';' : ',';

        $filas = [];
        $fila = [];
        $campo = '';
        $comillas = false;
        $largo = strlen($contenido);
        for ($i = 0; $i < $largo; $i++) {
            $c = $contenido[$i];
            if ($comillas) {
                if ($c === '"' && ($contenido[$i + 1] ?? '') === '"') {
                    $campo .= '"';
                    $i++;
                } elseif ($c === '"') {
                    $comillas = false;
                } else {
                    $campo .= $c;
                }
            } elseif ($c === '"') {
                $comillas = true;
            } elseif ($c === $sep) {
                $fila[] = $campo;
                $campo = '';
            } elseif ($c === "\n" || $c === "\r") {
                if ($c === "\r" && ($contenido[$i + 1] ?? '') === "\n") {
                    $i++;
                }
                $fila[] = $campo;
                $filas[] = $fila;
                $fila = [];
                $campo = '';
            } else {
                $campo .= $c;
            }
        }
        if ($campo !== '' || $fila) {
            $fila[] = $campo;
            $filas[] = $fila;
        }

        return $filas;
    }

    // Acepta "1.234,56" (formato argentino), "1234.56" y "$ 1234"; null si está vacío, NAN si no es un número
    private static function leerNumero(string $texto): ?float
    {
        $t = preg_replace('/[\s$]/', '', $texto);
        if ($t === '') {
            return null;
        }
        if (str_contains($t, ',') && str_contains($t, '.')) {
            $t = strrpos($t, ',') > strrpos($t, '.') ? str_replace(['.', ','], ['', '.'], $t) : str_replace(',', '', $t);
        } elseif (str_contains($t, ',')) {
            $t = preg_replace('/,/', '.', $t, 1);
        } elseif (preg_match('/^\d{1,3}(\.\d{3})+$/', $t)) {
            $t = str_replace('.', '', $t);
        }

        return is_numeric($t) && is_finite((float) $t) ? (float) $t : NAN;
    }

    // true, false, null si no se entiende y "" si está vacío
    private static function booleano(string $texto)
    {
        $t = mb_strtolower(trim($texto));
        if ($t === '') {
            return '';
        }
        if (in_array($t, ['si', 'sí', '1', 'true', 'activo', 'x'], true)) {
            return true;
        }

        return in_array($t, ['no', '0', 'false', 'inactivo'], true) ? false : null;
    }

    private static function hayNumero(?float $n): bool
    {
        return $n !== null && ! is_nan($n);
    }

    private function validar(string $tipoTexto, $contenido, $cotizacionTexto): array
    {
        $tipo = self::TIPOS[$tipoTexto] ?? null;
        $cotizacion = self::numero($cotizacionTexto) > 0 ? self::numero($cotizacionTexto) : null;
        if (! $tipo) {
            $this->falla(400, 'Elegí qué querés importar: maquinaria o repuestos');
        }
        if (! is_string($contenido) || trim($contenido) === '') {
            $this->falla(400, 'El archivo está vacío');
        }

        $filas = array_values(array_filter(self::parsearCsv($contenido), fn ($f) => array_filter($f, fn ($c) => trim($c) !== '') !== []));
        if (count($filas) < 2) {
            $this->falla(400, 'El archivo no tiene filas para importar (la primera fila tiene que ser la de los encabezados)');
        }
        if (count($filas) - 1 > self::MAX_FILAS) {
            $this->falla(400, 'El archivo tiene más de '.self::MAX_FILAS.' filas');
        }

        $crudos = array_map(self::normalizarEncabezado(...), $filas[0]);
        // El archivo del catálogo dice de qué es por sus columnas: si no coincide con lo elegido, un solo aviso claro
        $deMaquinaria = (bool) array_intersect($crudos, self::SOLO_MAQUINARIA);
        $deRepuestos = (bool) array_intersect($crudos, self::SOLO_REPUESTOS);
        if ($deMaquinaria !== $deRepuestos && ($deMaquinaria ? 'MAQUINARIA' : 'REPUESTO') !== $tipo) {
            $this->falla(400, $this->archivoDeOtroTipo($deMaquinaria ? 'MAQUINARIA' : 'REPUESTO'));
        }
        $encabezados = array_map(fn ($h) => self::SINONIMOS[$h] ?? $h, $crudos);
        $indice = [];
        foreach (self::COLUMNAS as $c) {
            $i = array_search($c, $encabezados, true);
            if ($i !== false) {
                $indice[$c] = $i;
            }
        }
        if (! isset($indice['codigo']) && ! isset($indice['nombre'])) {
            $this->falla(400, 'No se reconocen las columnas. Usá la plantilla: la primera fila tiene que tener codigo, nombre, categoria, etc.');
        }

        $datosFilas = array_slice($filas, 1);
        $celda = fn (array $f, string $c) => isset($indice[$c]) ? trim($f[$indice[$c]] ?? '') : '';
        $codigos = array_values(array_filter(array_map(fn ($f) => $celda($f, 'codigo'), $datosFilas), fn ($c) => $c !== ''));
        $existentes = Producto::whereIn('codigo', $codigos)->get()->keyBy('codigo');
        // Con la plantilla del ERP: si todos los códigos que ya existen son del otro tipo, casi seguro se eligió mal la opción
        $delOtroTipo = $existentes->filter(fn ($p) => $p->tipo_producto !== $tipo)->count();
        if ($delOtroTipo && $delOtroTipo === $existentes->count() && $delOtroTipo >= count($codigos) / 2) {
            $this->falla(400, $this->archivoDeOtroTipo($tipo === 'MAQUINARIA' ? 'REPUESTO' : 'MAQUINARIA'));
        }

        $valid = [];
        $invalid = [];
        $vistos = [];
        foreach ($datosFilas as $i => $f) {
            $linea = $i + 2;
            $v = fn (string $c) => $celda($f, $c);
            $errores = [];
            $codigo = $v('codigo') !== '' ? $v('codigo') : null;
            $existente = $codigo !== null ? $existentes->get($codigo) : null;

            if ($codigo !== null) {
                if (isset($vistos[$codigo])) {
                    $errores[] = "El código $codigo está repetido en el archivo";
                }
                $vistos[$codigo] = true;
                if (mb_strlen($codigo) > 30) {
                    $errores[] = 'El código no puede tener más de 30 caracteres';
                }
            }
            if ($existente && $existente->tipo_producto !== $tipo) {
                $errores[] = "El código $codigo ya existe y es ".self::ETIQUETA[$existente->tipo_producto].': importalo desde la otra opción';
            }

            $datos = ['codigo' => $codigo];
            if ($v('nombre') !== '') {
                $datos['nombre'] = mb_substr($v('nombre'), 0, 200);
            }
            if ($v('categoria') !== '') {
                $datos['categoria'] = mb_substr($v('categoria'), 0, 120);
            }
            // El ERP no tiene marca ni modelo: se guardan al principio de la descripción para no perder el dato
            $marcaModelo = implode(' · ', array_filter([$v('marca') !== '' ? 'Marca: '.$v('marca') : '', $v('modelo') !== '' ? 'Modelo: '.$v('modelo') : '']));
            $texto = $v('descripcion') !== '' ? $v('descripcion') : $v('resumen');
            if ($marcaModelo !== '' || $texto !== '') {
                $datos['descripcion'] = mb_substr(implode("\n", array_filter([$marcaModelo, $texto], fn ($t) => $t !== '')), 0, 2000);
            }

            // Precios: con costo + precio se usan esos dos; con costo + ganancia se calcula el precio. Si vienen los tres manda el precio
            $costo = self::leerNumero($v('costo'));
            $ganancia = self::leerNumero($v('ganancia'));
            $precio = self::leerNumero($v('precio'));
            foreach (['costo' => $costo, 'ganancia' => $ganancia, 'precio' => $precio] as $n => $val) {
                if ($val !== null && is_nan($val)) {
                    $errores[] = "\"{$v($n)}\" no es un número válido en $n";
                } elseif ($val !== null && $val < 0) {
                    $errores[] = "$n no puede ser negativo";
                }
            }
            if (self::hayNumero($precio)) {
                $datos['precio'] = $precio;
            } elseif (self::hayNumero($ganancia)) {
                if (! self::hayNumero($costo)) {
                    $errores[] = 'Para usar ganancia también hace falta el costo';
                } else {
                    $datos['precio'] = round($costo * (1 + $ganancia / 100), 2);
                }
            }
            if (self::hayNumero($costo)) {
                $datos['precioCosto'] = $costo;
            }

            // El ERP trabaja en pesos: lo que esté en dólares se convierte con la cotización indicada
            $moneda = mb_strtoupper($v('moneda'));
            if ($moneda !== '' && ! in_array($moneda, ['ARS', 'USD', '$', 'U$S', 'US$'], true)) {
                $errores[] = "moneda: \"{$v('moneda')}\" no se reconoce (ARS o USD)";
            } elseif (in_array($moneda, ['USD', 'U$S', 'US$'], true) && (($datos['precio'] ?? 0) > 0 || ($datos['precioCosto'] ?? 0) > 0)) {
                // Solo hace falta la cotización si hay algo que convertir (un precio 0 "a consultar" queda en 0)
                if (! $cotizacion) {
                    $errores[] = 'El precio está en dólares: indicá la cotización del dólar para pasarlo a pesos';
                } else {
                    foreach (['precio', 'precioCosto'] as $campo) {
                        if (isset($datos[$campo])) {
                            $datos[$campo] = round($datos[$campo] * $cotizacion, 2);
                        }
                    }
                }
            }

            foreach (['stock' => 'stock', 'stock_minimo' => 'stockMinimo'] as $n => $campo) {
                $val = self::leerNumero($v($n));
                if ($val === null) {
                    continue;
                }
                if (is_nan($val) || $val < 0 || floor($val) !== $val) {
                    $errores[] = "$n tiene que ser un número entero mayor o igual a 0";
                } else {
                    $datos[$campo] = (int) $val;
                }
            }

            $activo = self::booleano($v('activo'));
            if ($activo === null) {
                $errores[] = "activo: poné \"si\" o \"no\" (no \"{$v('activo')}\")";
            } elseif ($activo !== '') {
                $datos['activo'] = $activo;
            }

            // Un producto nuevo necesita los datos mínimos; uno existente solo actualiza lo que venga cargado
            if (! $existente) {
                if (! isset($datos['nombre'])) {
                    $errores[] = 'Falta el nombre';
                }
                if (! isset($datos['categoria'])) {
                    $errores[] = 'Falta la categoría';
                }
            }

            if ($errores) {
                $invalid[] = ['linea' => $linea, 'codigo' => $codigo ?? '', 'nombre' => $v('nombre'), 'errores' => $errores];
            } else {
                $valid[] = ['linea' => $linea, 'datos' => $datos, 'existe' => (bool) $existente];
            }
        }

        return [$tipo, $valid, $invalid];
    }

    public function previsualizar(Request $r)
    {
        [, $valid, $invalid] = $this->validar(self::texto($r->input('tipo')), $r->input('contenido'), $r->input('cotizacion'));

        return ['valid' => $valid, 'invalid' => $invalid];
    }

    // Vuelve a validar todo en el servidor (no confía en la previsualización) y aplica las filas correctas de una vez
    public function importar(Request $r)
    {
        @set_time_limit(120);
        $tipoTexto = self::texto($r->input('tipo'));
        [$tipo, $valid, $invalid] = $this->validar($tipoTexto, $r->input('contenido'), $r->input('cotizacion'));
        if (! $valid) {
            $this->falla(400, 'No hay filas correctas para importar');
        }
        $actualizar = $r->input('actualizar') !== false;

        $resultado = DB::transaction(function () use ($valid, $tipo, $actualizar) {
            // Las categorías que no existen se crean (se comparan sin distinguir mayúsculas). Cada categoría es de un tipo:
            // si ya existe una con ese nombre pero del otro tipo, se crea una aparte con el tipo en el nombre
            $categorias = [];
            $usados = [];
            foreach (Categoria::all() as $c) {
                $categorias[$c->tipo.':'.mb_strtolower($c->nombre)] = $c->id;
                $usados[mb_strtolower($c->nombre)] = true;
            }
            $categoriaId = function (string $nombre) use (&$categorias, &$usados, $tipo) {
                $clave = $tipo.':'.mb_strtolower($nombre);
                if (! isset($categorias[$clave])) {
                    $propio = isset($usados[mb_strtolower($nombre)]) ? $nombre.' ('.($tipo === 'MAQUINARIA' ? 'maquinaria' : 'repuestos').')' : $nombre;
                    $usados[mb_strtolower($propio)] = true;
                    $categorias[$clave] = Categoria::create(['nombre' => $propio, 'tipo' => $tipo])->id;
                }

                return $categorias[$clave];
            };

            // Los nuevos sin código reciben el siguiente número correlativo, igual que al crearlos a mano
            $siguiente = Producto::siguienteCodigo();
            $nuevoCodigo = function () use (&$siguiente) {
                do {
                    $codigo = str_pad((string) $siguiente++, 4, '0', STR_PAD_LEFT);
                } while (Producto::where('codigo', $codigo)->exists());

                return $codigo;
            };

            $creados = $actualizados = $omitidos = 0;
            foreach ($valid as ['datos' => $datos, 'existe' => $existe]) {
                if ($existe) {
                    if (! $actualizar) {
                        $omitidos++;
                        continue;
                    }
                    $campos = [];
                    foreach (self::COLUMNA_A_CAMPO as $dato => $columna) {
                        if (array_key_exists($dato, $datos)) {
                            $campos[$columna] = $datos[$dato];
                        }
                    }
                    if (isset($datos['categoria'])) {
                        $campos['categoria_id'] = $categoriaId($datos['categoria']);
                    }
                    Producto::where('codigo', $datos['codigo'])->update($campos);
                    $actualizados++;
                } else {
                    Producto::create([
                        'codigo' => $datos['codigo'] ?? $nuevoCodigo(), 'tipo_producto' => $tipo, 'nombre' => $datos['nombre'], 'descripcion' => $datos['descripcion'] ?? null,
                        'precio_costo' => $datos['precioCosto'] ?? 0, 'precio' => $datos['precio'] ?? 0, 'stock' => $datos['stock'] ?? 0,
                        'stock_minimo' => $datos['stockMinimo'] ?? ($tipo === 'MAQUINARIA' ? 1 : 5), 'activo' => $datos['activo'] ?? true,
                        'categoria_id' => $categoriaId($datos['categoria']),
                    ]);
                    $creados++;
                }
            }

            return ['creados' => $creados, 'actualizados' => $actualizados, 'omitidos' => $omitidos];
        });

        Erp::emitir('stock-actualizado');
        $resultado['conError'] = count($invalid);
        $archivo = $r->input('nombreArchivo') ? ' desde '.mb_substr(self::texto($r->input('nombreArchivo')), 0, 80) : '';
        Erp::auditar($r, ['accion' => 'import', 'seccion' => 'importar', 'datos' => $resultado,
            'descripcion' => "Importó $tipoTexto$archivo: {$resultado['creados']} nuevo(s), {$resultado['actualizados']} actualizado(s), {$resultado['omitidos']} omitido(s)"]);

        return $resultado;
    }
}
