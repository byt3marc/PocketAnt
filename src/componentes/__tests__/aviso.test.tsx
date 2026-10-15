import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';

import { AvisoProvider, useAviso, type OpcionesAviso } from '../AvisoProvider';
import { Boton } from '../Boton';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

function Disparador({ nombre = 'avisar', opciones }: { nombre?: string; opciones: OpcionesAviso }) {
  const { avisar } = useAviso();
  return <Boton titulo={nombre} onPress={() => avisar(opciones)} />;
}

const montar = (ui: ReactElement) =>
  render(
    <AjustesProvider>
      <AvisoProvider>{ui}</AvisoProvider>
    </AjustesProvider>,
  );

const pulsar = async (nombre: string) => {
  await fireEvent.press(screen.getByRole('button', { name: nombre }));
};

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

describe('AvisoProvider', () => {
  it('no se ve hasta que hay un aviso', async () => {
    await montar(<Disparador opciones={{ titulo: 'Falló' }} />);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('muestra qué pasó, cómo entenderlo y el motivo técnico', async () => {
    await montar(
      <Disparador
        opciones={{
          titulo: 'No se pudo generar el informe',
          mensaje: 'La IA no pudo terminar el informe.',
          detalle: 'INFERENCE_FAILED: Can not find OpenCL library',
        }}
      />,
    );
    await pulsar('avisar');
    expect(screen.getByTestId('aviso')).toBeTruthy();
    expect(screen.getByText('No se pudo generar el informe')).toBeTruthy();
    expect(screen.getByText('La IA no pudo terminar el informe.')).toBeTruthy();
    expect(screen.getByText('Motivo técnico')).toBeTruthy();
    expect(screen.getByText('INFERENCE_FAILED: Can not find OpenCL library')).toBeTruthy();
  });

  it('es una alerta para lectores de pantalla', async () => {
    await montar(<Disparador opciones={{ titulo: 'Falló', detalle: 'X' }} />);
    await pulsar('avisar');
    // El contenedor no es «accesible» a propósito: así los botones de dentro siguen siendo enfocables por separado.
    expect(screen.getByTestId('aviso').props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByTestId('aviso').props.accessibilityRole).toBe('alert');
  });

  it('sin mensaje ni motivo, solo el título', async () => {
    await montar(<Disparador opciones={{ titulo: 'Solo título' }} />);
    await pulsar('avisar');
    expect(screen.getByText('Solo título')).toBeTruthy();
    expect(screen.queryByText('Motivo técnico')).toBeNull();
  });

  it('se cierra con la ✕', async () => {
    await montar(<Disparador opciones={{ titulo: 'Falló' }} />);
    await pulsar('avisar');
    await pulsar('Cerrar aviso');
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('se cierra solo pasados unos segundos', async () => {
    await montar(<Disparador opciones={{ titulo: 'Falló' }} />);
    await pulsar('avisar');
    await avanzar(8000);
    expect(screen.getByTestId('aviso')).toBeTruthy();
    await avanzar(5000);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('un aviso nuevo reemplaza al anterior y reinicia el tiempo', async () => {
    function Dos() {
      const { avisar } = useAviso();
      return (
        <>
          <Boton titulo="primero" onPress={() => avisar({ titulo: 'Primero' })} />
          <Boton titulo="segundo" onPress={() => avisar({ titulo: 'Segundo' })} />
        </>
      );
    }
    await montar(<Dos />);
    await pulsar('primero');
    await avanzar(9000);
    await pulsar('segundo');
    expect(screen.queryByText('Primero')).toBeNull();
    expect(screen.getByText('Segundo')).toBeTruthy();
    // El tiempo cuenta desde el nuevo: 9 s después del segundo sigue ahí.
    await avanzar(9000);
    expect(screen.getByText('Segundo')).toBeTruthy();
    await avanzar(4000);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('tocarlo muestra el motivo completo en lugar de solo tres líneas', async () => {
    const largo = 'una línea muy larga '.repeat(15).trim();
    await montar(<Disparador opciones={{ titulo: 'Falló', detalle: largo }} />);
    await pulsar('avisar');
    const motivo = screen.getByText(largo);
    expect(motivo.props.numberOfLines).toBe(3);
    await fireEvent.press(screen.getByRole('button', { name: /Falló/ }));
    expect(screen.getByText(largo).props.numberOfLines).toBeUndefined();
    await fireEvent.press(screen.getByRole('button', { name: /Falló/ }));
    expect(screen.getByText(largo).props.numberOfLines).toBe(3);
  });

  it('el motivo se puede seleccionar para copiarlo', async () => {
    await montar(<Disparador opciones={{ titulo: 'Falló', detalle: 'INFERENCE_FAILED: algo' }} />);
    await pulsar('avisar');
    expect(screen.getByText('INFERENCE_FAILED: algo').props.selectable).toBe(true);
  });

  it('fuera del proveedor avisa del error de uso', async () => {
    const errorOriginal = console.error;
    console.error = jest.fn();
    function Suelto() {
      useAviso();
      return null;
    }
    await expect(render(<Suelto />)).rejects.toThrow(/AvisoProvider/);
    console.error = errorOriginal;
  });
});
