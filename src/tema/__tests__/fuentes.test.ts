import { fuentesDeTexto } from '../archivosDeFuentes';
import { esFuenteApp, estiloDeFuente, FUENTE_POR_DEFECTO, FUENTES } from '../fuentes';

describe('fuentes', () => {
  it('hay tres y la del sistema es la de siempre', () => {
    expect(FUENTES).toEqual(['sistema', 'redondeada', 'clasica']);
    expect(FUENTE_POR_DEFECTO).toBe('sistema');
  });

  it('solo reconoce las tres fuentes', () => {
    expect(esFuenteApp('clasica')).toBe(true);
    expect(esFuenteApp('comic')).toBe(false);
    expect(esFuenteApp(undefined)).toBe(false);
    expect(esFuenteApp(1)).toBe(false);
  });

  it('con la fuente del sistema solo cambia el peso, no la familia', () => {
    expect(estiloDeFuente('sistema', 'normal')).toEqual({ fontWeight: '400' });
    expect(estiloDeFuente('sistema', 'seminegrita')).toEqual({ fontWeight: '600' });
    expect(estiloDeFuente('sistema', 'negrita')).toEqual({ fontWeight: '700' });
  });

  it('sin fuente (ajustes viejos o parciales) usa la del sistema', () => {
    expect(estiloDeFuente(undefined, 'negrita')).toEqual({ fontWeight: '700' });
    expect(estiloDeFuente(undefined)).toEqual({ fontWeight: '400' });
  });

  it('con una fuente propia el peso va en la familia y fontWeight queda en normal', () => {
    expect(estiloDeFuente('redondeada', 'normal')).toEqual({ fontFamily: 'Nunito_400Regular', fontWeight: 'normal' });
    expect(estiloDeFuente('redondeada', 'seminegrita')).toEqual({
      fontFamily: 'Nunito_600SemiBold',
      fontWeight: 'normal',
    });
    expect(estiloDeFuente('redondeada', 'negrita')).toEqual({ fontFamily: 'Nunito_700Bold', fontWeight: 'normal' });
    expect(estiloDeFuente('clasica', 'normal')).toEqual({ fontFamily: 'Lora_400Regular', fontWeight: 'normal' });
    expect(estiloDeFuente('clasica', 'seminegrita')).toEqual({ fontFamily: 'Lora_600SemiBold', fontWeight: 'normal' });
    expect(estiloDeFuente('clasica', 'negrita')).toEqual({ fontFamily: 'Lora_700Bold', fontWeight: 'normal' });
  });

  it('cada familia que se pide tiene su archivo registrado para cargarse', () => {
    for (const fuente of ['redondeada', 'clasica'] as const) {
      for (const peso of ['normal', 'seminegrita', 'negrita'] as const) {
        const { fontFamily } = estiloDeFuente(fuente, peso);
        expect(fontFamily).toBeDefined();
        expect(Object.keys(fuentesDeTexto)).toContain(fontFamily);
      }
    }
  });
});
