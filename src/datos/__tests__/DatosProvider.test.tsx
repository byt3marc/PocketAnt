import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import type { EntradaMovimiento } from '@/dominio/tipos';
import { DatosProvider, useDatos } from '@/datos/DatosProvider';
import type { ProveedorSync } from '@/datos/sincronizacion/proveedor';
import { crearRepositorioMemoria } from '@/pruebas/repositorioMemoria';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

const proveedor: ProveedorSync = {
  id: 'prueba',
  nombre: 'Prueba',
  subir: async () => {},
  descargar: async () => null,
};

const entrada = (parcial: Partial<EntradaMovimiento> = {}): EntradaMovimiento => ({
  tipo: 'gasto',
  monto: 45.9,
  motivo: 'Supermercado',
  fecha: '2026-10-15',
  recurrente: false,
  periodo: null,
  frecuencia: null,
  ...parcial,
});

/** La última operación de lote lanzada por la sonda: permite esperar su rechazo en las pruebas. */
let ultimaOperacion: Promise<void> | null = null;
/** El id que devolvió el último `guardarMovimiento` de la sonda. */
let ultimoId: Promise<string> | null = null;

function Sonda() {
  const datos = useDatos();
  return (
    <>
      <Text testID="version">{String(datos.versionLocal)}</Text>
      <Text testID="cuentas">{String(datos.movimientos.length)}</Text>
      <Pressable
        testID="guardar-lote"
        accessibilityRole="button"
        onPress={() => {
          ultimaOperacion = datos.guardarLoteMovimientos([entrada()]);
          // Evita un rechazo «sin manejar» si la prueba aún no ha anexado su propio catch.
          void ultimaOperacion.catch(() => {});
        }}
      />
      <Pressable
        testID="guardar-uno"
        accessibilityRole="button"
        onPress={() => {
          ultimoId = datos.guardarMovimiento(entrada({ motivo: 'Café' }));
        }}
      />
      <Pressable
        testID="guardar-vacio"
        accessibilityRole="button"
        onPress={() => {
          ultimaOperacion = datos.guardarLoteMovimientos([]);
          void ultimaOperacion.catch(() => {});
        }}
      />
    </>
  );
}

const montar = async (repositorio: ReturnType<typeof crearRepositorioMemoria>) => {
  await render(
    <AjustesProvider>
      <DatosProvider repositorio={repositorio} proveedorSync={proveedor}>
        <Sonda />
      </DatosProvider>
    </AjustesProvider>,
  );
};

const pulsar = async (testId: string) => {
  await fireEvent.press(screen.getByTestId(testId));
};

describe('DatosProvider.guardarMovimiento', () => {
  it('devuelve el id del movimiento creado', async () => {
    const repo = crearRepositorioMemoria();
    await montar(repo);
    await pulsar('guardar-uno');
    let id = '';
    await act(async () => {
      id = await ultimoId!;
    });
    const [guardado] = await repo.listarActivos();
    expect(guardado.motivo).toBe('Café');
    expect(id).toBe(guardado.id);
  });
});

describe('DatosProvider.guardarLoteMovimientos', () => {
  it('persiste el lote, refresca la lista y sube la versión local', async () => {
    const repo = crearRepositorioMemoria();
    await montar(repo);
    expect(screen.getByTestId('cuentas').props.children).toBe('0');

    await pulsar('guardar-lote');

    expect(screen.getByTestId('cuentas').props.children).toBe('1');
    expect(screen.getByTestId('version').props.children).toBe('1');
    const activos = await repo.listarActivos();
    expect(activos[0].motivo).toBe('Supermercado');
  });

  it('si la transacción falla, propaga el error y nada cambia: lista intacta y sin subir versión', async () => {
    // El lote de un solo movimiento falla en su única inserción.
    const repo = crearRepositorioMemoria([], (_m, indice) => indice === 0);
    await montar(repo);

    let fallo: unknown = null;
    await fireEvent.press(screen.getByTestId('guardar-lote'));
    try {
      await act(async () => {
        await ultimaOperacion;
      });
    } catch (e) {
      fallo = e;
    }

    expect(fallo).toBeInstanceOf(Error); // el provider propaga el error al llamante, no lo traga
    expect(screen.getByTestId('cuentas').props.children).toBe('0');
    expect(screen.getByTestId('version').props.children).toBe('0');
  });

  it('un lote vacío no persiste nada ni sube versión', async () => {
    const repo = crearRepositorioMemoria();
    await montar(repo);

    await pulsar('guardar-vacio');

    expect(screen.getByTestId('cuentas').props.children).toBe('0');
    expect(screen.getByTestId('version').props.children).toBe('0');
    await expect(repo.listarActivos()).resolves.toHaveLength(0);
  });
});
