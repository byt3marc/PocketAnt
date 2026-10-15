import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';

import { Boton } from '../Boton';
import { DialogoProvider, useDialogo, type BotonDialogo } from '../DialogoProvider';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

interface PropsAbrir {
  titulo: string;
  mensaje?: string;
  botones?: BotonDialogo[];
}

/** Un botón «abrir» que muestra el diálogo con lo que se le pida. */
function Abrir({ titulo, mensaje, botones }: PropsAbrir) {
  const { alerta } = useDialogo();
  return <Boton titulo="abrir" onPress={() => alerta(titulo, mensaje, botones)} />;
}

const montar = (ui: ReactElement) =>
  render(
    <AjustesProvider>
      <DialogoProvider>{ui}</DialogoProvider>
    </AjustesProvider>,
  );

const pulsar = async (nombre: string) => {
  await fireEvent.press(screen.getByRole('button', { name: nombre }));
};

/** Lo que dispara el botón «atrás» de Android sobre el diálogo. */
const atras = async () => {
  await act(async () => {
    screen.getByTestId('dialogo').props.onRequestClose();
  });
};

const CANCELAR_Y_ELIMINAR = (cancelar: () => void, eliminar: () => void): BotonDialogo[] => [
  { text: 'Cancelar', style: 'cancel', onPress: cancelar },
  { text: 'Eliminar', style: 'destructive', onPress: eliminar },
];

describe('DialogoProvider', () => {
  it('muestra el título y el mensaje, y se cierra con «Aceptar» si no se piden botones', async () => {
    await montar(<Abrir titulo="Algo salió mal" mensaje="Intenta de nuevo." />);
    expect(screen.queryByText('Algo salió mal')).toBeNull();

    await pulsar('abrir');
    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByText('Intenta de nuevo.')).toBeTruthy();

    await pulsar('Aceptar');
    expect(screen.queryByText('Algo salió mal')).toBeNull();
  });

  it('el título es un encabezado accesible', async () => {
    await montar(<Abrir titulo="Eliminar" />);
    await pulsar('abrir');
    expect(screen.getByRole('header', { name: 'Eliminar' })).toBeTruthy();
  });

  it('cada botón cierra el diálogo y ejecuta su acción', async () => {
    const eliminar = jest.fn();
    const cancelar = jest.fn();
    await montar(<Abrir titulo="¿Eliminar?" botones={CANCELAR_Y_ELIMINAR(cancelar, eliminar)} />);

    await pulsar('abrir');
    await pulsar('Eliminar');
    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(cancelar).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Eliminar?')).toBeNull();

    await pulsar('abrir');
    await pulsar('Cancelar');
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('¿Eliminar?')).toBeNull();
  });

  it('«atrás» cancela cuando hay un botón de cancelar, y nunca confirma', async () => {
    const eliminar = jest.fn();
    const cancelar = jest.fn();
    await montar(<Abrir titulo="¿Eliminar?" botones={CANCELAR_Y_ELIMINAR(cancelar, eliminar)} />);
    await pulsar('abrir');
    await atras();
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Eliminar?')).toBeNull();
  });

  it('tocar fuera de la tarjeta también cancela', async () => {
    const eliminar = jest.fn();
    const cancelar = jest.fn();
    await montar(<Abrir titulo="¿Eliminar?" botones={CANCELAR_Y_ELIMINAR(cancelar, eliminar)} />);
    await pulsar('abrir');
    // El fondo oscuro va detrás de la tarjeta y no es accesible (el botón «atrás» y «Cancelar» ya cubren a quien lo necesite).
    await fireEvent.press(screen.getByTestId('dialogo-fondo', { includeHiddenElements: true }));
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('un aviso de un solo botón se cierra con «atrás» ejecutando su acción', async () => {
    const alEntender = jest.fn();
    await montar(<Abrir titulo="Listo" botones={[{ text: 'Entendido', onPress: alEntender }]} />);
    await pulsar('abrir');
    await atras();
    expect(alEntender).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Listo')).toBeNull();
  });

  it('con varios botones y sin «cancelar», «atrás» no decide por el usuario', async () => {
    const uno = jest.fn();
    await montar(<Abrir titulo="Elige" botones={[{ text: 'Uno', onPress: uno }, { text: 'Dos' }]} />);
    await pulsar('abrir');
    await atras();
    expect(uno).not.toHaveBeenCalled();
    expect(screen.getByText('Elige')).toBeTruthy();
  });

  it('con más de dos botones todos están disponibles y funcionan', async () => {
    const tercero = jest.fn();
    await montar(
      <Abrir titulo="Elige" botones={[{ text: 'Uno' }, { text: 'Dos' }, { text: 'Tres', onPress: tercero }]} />,
    );
    await pulsar('abrir');
    expect(screen.getByRole('button', { name: 'Uno' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dos' })).toBeTruthy();
    await pulsar('Tres');
    expect(tercero).toHaveBeenCalledTimes(1);
  });

  it('si una acción abre otro diálogo, sale a continuación', async () => {
    function Encadenado() {
      const { alerta } = useDialogo();
      return (
        <Boton
          titulo="abrir"
          onPress={() =>
            alerta('Primero', undefined, [{ text: 'Siguiente', onPress: () => alerta('Segundo', 'Ya está.') }])
          }
        />
      );
    }
    await montar(<Encadenado />);
    await pulsar('abrir');
    expect(screen.getByText('Primero')).toBeTruthy();
    await pulsar('Siguiente');
    expect(screen.queryByText('Primero')).toBeNull();
    expect(screen.getByText('Segundo')).toBeTruthy();
    await pulsar('Aceptar');
    expect(screen.queryByText('Segundo')).toBeNull();
  });

  it('si llegan varios seguidos, los muestra de uno en uno', async () => {
    function Varios() {
      const { alerta } = useDialogo();
      return (
        <Boton
          titulo="abrir"
          onPress={() => {
            alerta('A');
            alerta('B');
          }}
        />
      );
    }
    await montar(<Varios />);
    await pulsar('abrir');
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByText('B')).toBeNull();
    await pulsar('Aceptar');
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('fuera del proveedor avisa del error de uso', async () => {
    const errorOriginal = console.error;
    console.error = jest.fn();
    function Suelto() {
      useDialogo();
      return null;
    }
    await expect(render(<Suelto />)).rejects.toThrow(/DialogoProvider/);
    console.error = errorOriginal;
  });
});
