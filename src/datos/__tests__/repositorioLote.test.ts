import type { Movimiento } from '@/dominio/tipos';
import { crearRepositorioMemoria } from '@/pruebas/repositorioMemoria';

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `lote${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: `Motivo ${contador}`,
    fecha: '2026-10-15',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-15T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

describe('guardarLote (repositorio en memoria)', () => {
  it('persiste todo el lote de una vez', async () => {
    const repo = crearRepositorioMemoria();
    const lote = [mov({ fecha: '2026-10-13' }), mov({ fecha: '2026-10-14' }), mov({ fecha: '2026-10-15' })];

    await repo.guardarLote(lote);

    const activos = await repo.listarActivos();
    expect(activos).toHaveLength(3);
    // `listarActivos` ordena por fecha descendente, como el repositorio real.
    expect(activos.map((m) => m.motivo)).toEqual([lote[2].motivo, lote[1].motivo, lote[0].motivo]);
  });

  it('si una inserción falla a mitad de lote, nada se persiste', async () => {
    const previo = mov({ fecha: '2026-10-01' });
    // Falla el movimiento tercero del lote (los dos primeros ya «habrían entrado» en la transacción).
    const repo = crearRepositorioMemoria([previo], (_m, indice) => indice === 2);
    const lote = [mov({ fecha: '2026-10-05' }), mov({ fecha: '2026-10-06' }), mov({ fecha: '2026-10-07' })];

    await expect(repo.guardarLote(lote)).rejects.toThrow();

    const todos = await repo.listarTodos();
    expect(todos.map((m) => m.id)).toEqual([previo.id]); // ni el 1º ni el 2º quedaron
  });

  it('un lote vacío no hace nada', async () => {
    const repo = crearRepositorioMemoria();
    await expect(repo.guardarLote([])).resolves.toBeUndefined();
    await expect(repo.listarActivos()).resolves.toHaveLength(0);
  });

  it('guarda motivos con contenido SQL como datos, sin ejecutar nada', async () => {
    const repo = crearRepositorioMemoria();
    const trampa = mov({ motivo: "'; DROP TABLE movimientos; --" });

    await repo.guardarLote([trampa]);

    // El contenido vuelve intacto: se almacenó como valor, no se interpretó.
    const activos = await repo.listarActivos();
    expect(activos[0].motivo).toBe("'; DROP TABLE movimientos; --");
  });

  it('reemplaza por `id` si el movimiento ya existía (upsert)', async () => {
    const anterior = mov({ id: 'fijo', motivo: 'Antiguo' });
    const repo = crearRepositorioMemoria([anterior]);
    await repo.guardarLote([mov({ id: 'fijo', motivo: 'Nuevo' })]);

    const todos = await repo.listarActivos();
    expect(todos).toHaveLength(1);
    expect(todos[0].motivo).toBe('Nuevo');
  });
});
