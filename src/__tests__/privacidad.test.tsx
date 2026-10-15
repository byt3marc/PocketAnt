import { fireEvent, render, screen } from '@testing-library/react-native';

import Privacidad from '@/app/privacidad';
import { AjustesProvider, useAjustes } from '@/ajustes/AjustesProvider';
import { Boton } from '@/componentes/Boton';
import { politicaDePrivacidad } from '@/legal/privacidad';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const { createContext } = jest.requireActual('react');
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes, SafeAreaInsetsContext: createContext(margenes) };
});

describe('política de privacidad', () => {
  it('español e inglés dicen lo mismo: las mismas secciones, todas con texto', () => {
    const es = politicaDePrivacidad('es');
    const en = politicaDePrivacidad('en');
    expect(es.secciones).toHaveLength(en.secciones.length);
    es.secciones.forEach((seccion, i) => {
      expect(seccion.parrafos.length).toBeGreaterThan(0);
      expect(en.secciones[i].parrafos).toHaveLength(seccion.parrafos.length);
    });
  });

  it('cuenta lo que de verdad sale del teléfono: la descarga del modelo y los reportes de la IA', () => {
    const texto = politicaDePrivacidad('es')
      .secciones.flatMap((s) => s.parrafos)
      .join(' ');
    expect(texto).toMatch(/Hugging Face/);
    expect(texto).toMatch(/Google Forms/);
    expect(texto).toMatch(/Uso Limitado/);
  });

  it('se lee dentro de la app, en el idioma elegido', async () => {
    function AIngles() {
      const { cambiarIdioma } = useAjustes();
      return <Boton titulo="a inglés" onPress={() => cambiarIdioma('en')} />;
    }
    await render(
      <AjustesProvider>
        <Privacidad />
        <AIngles />
      </AjustesProvider>,
    );
    expect(screen.getByText('Qué datos guarda y dónde')).toBeTruthy();
    expect(screen.getByText(/no tiene cuentas, anuncios ni analítica/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'a inglés' }));
    expect(screen.getByText('What data it keeps and where')).toBeTruthy();
  });

  it('sin correo de contacto puesto, no muestra una línea de contacto vacía', () => {
    expect(politicaDePrivacidad('es').contacto).toBeNull();
  });
});
