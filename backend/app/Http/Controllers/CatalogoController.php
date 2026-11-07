<?php

namespace App\Http\Controllers;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\ServicioRepuesto;
use App\Support\Erp;
use Illuminate\Http\Request;

// Categorías, maquinaria y repuestos
class CatalogoController extends Controller
{
    private const CAMPOS_AUDITADOS = ['nombre', 'descripcion', 'tipoProducto', 'categoria', 'precioCosto', 'precio', 'stock', 'stockMinimo', 'activo'];
    private const TIPOS = ['REPUESTO', 'MAQUINARIA'];

    // ───── Categorías

    public function categorias()
    {
        return Categoria::withCount('productos')->orderByRaw('nombre COLLATE utf8mb4_unicode_ci')->get()->map(function ($c) {
            $total = $c->productos_count;

            return array_diff_key($c->toArray(), ['productosCount' => 1]) + ['_count' => ['productos' => $total]];
        });
    }

    private function validarNombre($nombre): string
    {
        if (! is_string($nombre) || trim($nombre) === '') {
            $this->falla(400, 'El nombre de la categoría es obligatorio');
        }

        return trim($nombre);
    }

    private function validarTipo($tipo): string
    {
        if (! in_array($tipo, self::TIPOS, true)) {
            $this->falla(400, 'Elegí para qué es la categoría: repuestos o maquinaria');
        }

        return $tipo;
    }

    public function crearCategoria(Request $r)
    {
        $nombre = $this->validarNombre($r->input('nombre'));
        $c = Categoria::create(['nombre' => $nombre, 'tipo' => $this->validarTipo($r->input('tipo'))])->fresh();
        Erp::auditar($r, ['accion' => 'create', 'seccion' => 'categorias', 'entidad' => 'categoria', 'entidadId' => $c->id,
            'descripcion' => "Creó la categoría {$c->nombre} (".($c->tipo === 'MAQUINARIA' ? 'maquinaria' : 'repuestos').')']);

        return response()->json($c, 201);
    }

    public function editarCategoria(Request $r, $id)
    {
        $nombre = $this->validarNombre($r->input('nombre'));
        $tipo = $r->input('tipo') === null ? null : $this->validarTipo($r->input('tipo'));
        $c = Categoria::find(self::id($id)) ?? $this->falla(400, 'Los datos enviados no son válidos');
        // No se puede cambiar el tipo si ya tiene artículos del otro tipo: quedarían en una categoría que no les corresponde
        if ($tipo && Producto::where('categoria_id', $c->id)->where('tipo_producto', '!=', $tipo)->exists()) {
            $this->falla(400, 'No se puede cambiar el tipo: la categoría tiene artículos del otro tipo. Pasalos a otra categoría primero');
        }
        $antes = $c->nombre;
        $c->update(['nombre' => $nombre] + ($tipo ? ['tipo' => $tipo] : []));
        if ($antes !== $c->nombre) {
            Erp::auditar($r, ['accion' => 'update', 'seccion' => 'categorias', 'entidad' => 'categoria', 'entidadId' => $c->id,
                'descripcion' => "Renombró la categoría $antes", 'datos' => ['nombre' => ['antes' => $antes, 'ahora' => $c->nombre]]]);
        }

        return $c;
    }

    public function eliminarCategoria(Request $r, $id)
    {
        $c = Categoria::find(self::id($id)) ?? $this->falla(404, 'Categoría no encontrada');
        if (Producto::where('categoria_id', $c->id)->exists()) {
            $this->falla(409, 'No se puede eliminar: tiene productos asignados');
        }
        $c->delete();
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => 'categorias', 'entidad' => 'categoria', 'entidadId' => $c->id, 'descripcion' => "Eliminó la categoría {$c->nombre}"]);

        return response()->noContent();
    }

    // ───── Artículos

    // El costo y la ganancia solo los ven los roles con "productos.costos"
    private function conCostos(Request $r, $dato)
    {
        return in_array('productos.costos', $this->actor($r)->permisos, true) ? $dato : $dato->makeHidden('precio_costo');
    }

    private function seccion(Producto $p): string
    {
        return $p->tipo_producto === 'MAQUINARIA' ? 'maquinaria' : 'repuestos';
    }

    private function paraAuditar(Producto $p): array
    {
        return ['categoria' => $p->categoria->nombre] + $p->toArray();
    }

    public function productos(Request $r)
    {
        return $this->conCostos($r, Producto::with('categoria')->orderBy('nombre')->get());
    }

    public function producto(Request $r, $id)
    {
        $p = Producto::with('categoria')->find(self::id($id)) ?? $this->falla(404, 'Producto no encontrado');

        return $this->conCostos($r, $p);
    }

    // Solo productos activos: uno descontinuado no debería disparar alertas de reposición
    public function stockBajo(Request $r)
    {
        return $this->conCostos($r, Producto::with('categoria')->where('activo', true)->whereColumn('stock', '<=', 'stock_minimo')->get());
    }

    private function validar(array $d): void
    {
        if (array_key_exists('nombre', $d) && (! is_string($d['nombre']) || trim($d['nombre']) === '')) {
            $this->falla(400, 'El nombre del producto es obligatorio');
        }
        // Precio 0 se permite: son los productos "a consultar" (como en el catálogo)
        if (array_key_exists('precio', $d) && (! is_int($d['precio']) && ! is_float($d['precio']) || $d['precio'] < 0)) {
            $this->falla(400, 'El precio no puede ser negativo');
        }
        if (array_key_exists('stock', $d) && (! self::entero($d['stock']) || $d['stock'] < 0)) {
            $this->falla(400, 'El stock debe ser un número entero mayor o igual a 0');
        }
        if (array_key_exists('stockMinimo', $d) && (! self::entero($d['stockMinimo']) || $d['stockMinimo'] < 0)) {
            $this->falla(400, 'El stock mínimo debe ser un número entero mayor o igual a 0');
        }
        if (array_key_exists('tipoProducto', $d) && ! in_array($d['tipoProducto'], self::TIPOS, true)) {
            $this->falla(400, 'Los datos enviados no son válidos');
        }
        if (array_key_exists('precioCosto', $d) && (! is_numeric($d['precioCosto']) || $d['precioCosto'] < 0)) {
            $this->falla(400, 'Los datos enviados no son válidos');
        }
    }

    // La categoría tiene que ser del mismo tipo que el artículo
    private function validarCategoria($categoriaId, string $tipo): void
    {
        $c = Categoria::find(self::id($categoriaId)) ?? $this->falla(400, 'La categoría no existe');
        if ($c->tipo !== $tipo) {
            $de = fn ($t) => $t === 'MAQUINARIA' ? 'maquinaria' : 'repuestos';
            $this->falla(400, "La categoría «{$c->nombre}» es de {$de($c->tipo)}: elegí una de {$de($tipo)}");
        }
    }

    // Solo estos campos se pueden cargar desde el formulario: id y código no se tocan
    private function campos(array $d): array
    {
        $mapa = ['nombre' => 'nombre', 'descripcion' => 'descripcion', 'tipoProducto' => 'tipo_producto', 'precioCosto' => 'precio_costo', 'precio' => 'precio',
            'stock' => 'stock', 'stockMinimo' => 'stock_minimo', 'categoriaId' => 'categoria_id', 'activo' => 'activo'];
        $campos = [];
        foreach ($mapa as $entrada => $columna) {
            if (array_key_exists($entrada, $d)) {
                $campos[$columna] = $d[$entrada];
            }
        }

        return $campos;
    }

    public function crearProducto(Request $r)
    {
        $d = $r->all();
        $this->validar($d);
        if (! isset($d['nombre'], $d['precio'])) {
            $this->falla(400, 'Los datos enviados no son válidos');
        }
        $this->validarCategoria($d['categoriaId'] ?? null, $d['tipoProducto'] ?? 'REPUESTO');
        // El código se genera acá, no lo manda el cliente, para garantizar unicidad y orden
        $codigo = str_pad((string) Producto::siguienteCodigo(), 4, '0', STR_PAD_LEFT);
        $p = Producto::create($this->campos($d) + ['codigo' => $codigo])->fresh('categoria');
        Erp::emitir('stock-actualizado');
        Erp::auditar($r, ['accion' => 'create', 'seccion' => $this->seccion($p), 'entidad' => 'producto', 'entidadId' => $p->id, 'descripcion' => "Creó {$p->codigo} · {$p->nombre}"]);

        return response()->json($this->conCostos($r, $p), 201);
    }

    public function editarProducto(Request $r, $id)
    {
        $d = $r->all();
        $this->validar($d);
        $p = Producto::with('categoria')->find(self::id($id)) ?? $this->falla(400, 'Los datos enviados no son válidos');
        if (array_key_exists('categoriaId', $d) || array_key_exists('tipoProducto', $d)) {
            $this->validarCategoria($d['categoriaId'] ?? $p->categoria_id, $d['tipoProducto'] ?? $p->tipo_producto);
        }
        $antes = $this->paraAuditar($p);
        $p->update($this->campos($d));
        $p = $p->fresh('categoria');
        Erp::emitir('stock-actualizado');

        $cambios = Erp::diferencias($antes, $this->paraAuditar($p), self::CAMPOS_AUDITADOS);
        if ($cambios) {
            // Los cambios de precio se destacan aparte en la auditoría (como en el catálogo)
            $accion = isset($cambios['precio']) || isset($cambios['precioCosto']) ? 'price_change' : 'update';
            Erp::auditar($r, ['accion' => $accion, 'seccion' => $this->seccion($p), 'entidad' => 'producto', 'entidadId' => $p->id, 'descripcion' => "Modificó {$p->codigo} · {$p->nombre}", 'datos' => $cambios]);
        }

        return $this->conCostos($r, $p);
    }

    // Las ventas y los servicios finalizados guardan el artículo como texto, así que no impiden eliminarlo.
    // Solo se bloquea si lo usa un servicio que todavía está en curso
    public function eliminarProducto(Request $r, $id)
    {
        $p = Producto::find(self::id($id)) ?? $this->falla(404, 'Producto no encontrado');
        if (ServicioRepuesto::where('producto_id', $p->id)->whereHas('servicio', fn ($q) => $q->where('estado', 'EN_CURSO'))->exists()) {
            $this->falla(409, 'No se puede eliminar: está en servicios técnicos en curso. Finalizá esos servicios o desactivá el artículo');
        }
        $p->delete();
        Erp::emitir('stock-actualizado');
        Erp::auditar($r, ['accion' => 'delete', 'seccion' => $this->seccion($p), 'entidad' => 'producto', 'entidadId' => $p->id, 'descripcion' => "Eliminó {$p->codigo} · {$p->nombre}"]);

        return response()->noContent();
    }
}
