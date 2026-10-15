import {
  formatearCompacto,
  formatearMonto,
  formatearRam,
  formatearTamano,
  limpiarEntradaMonto,
  parsearMonto,
} from '../formato';
import { MONEDA_POR_DEFECTO, type Moneda } from '../moneda';

const SOL: Moneda = { codigo: 'PEN', simbolo: 'S/' };

describe('formatearMonto', () => {
  it('usa el símbolo y dos decimales', () => {
    expect(formatearMonto(1250.5, MONEDA_POR_DEFECTO, { locale: 'en-US' })).toBe('$1,250.50');
    expect(formatearMonto(0, MONEDA_POR_DEFECTO, { locale: 'en-US' })).toBe('$0.00');
  });

  it('separa símbolos largos con espacio fijo', () => {
    expect(formatearMonto(12, SOL, { locale: 'en-US' })).toBe('S/ 12.00');
  });

  it('respeta el locale para separadores', () => {
    expect(formatearMonto(1250.5, MONEDA_POR_DEFECTO, { locale: 'de-DE' })).toBe('$1.250,50');
  });

  it('muestra el signo menos y, si se pide, el más', () => {
    expect(formatearMonto(-12, MONEDA_POR_DEFECTO, { locale: 'en-US' })).toBe('−$12.00');
    expect(formatearMonto(50, MONEDA_POR_DEFECTO, { locale: 'en-US', conSigno: true })).toBe('+$50.00');
    expect(formatearMonto(0, MONEDA_POR_DEFECTO, { locale: 'en-US', conSigno: true })).toBe('$0.00');
  });

  it('no muestra "−$0.00" por redondeo', () => {
    expect(formatearMonto(-0.001, MONEDA_POR_DEFECTO, { locale: 'en-US' })).toBe('$0.00');
  });
});

describe('formatearCompacto', () => {
  it('abrevia miles y millones', () => {
    expect(formatearCompacto(0)).toBe('0');
    expect(formatearCompacto(950)).toBe('950');
    expect(formatearCompacto(1200)).toBe('1.2k');
    expect(formatearCompacto(25000)).toBe('25k');
    expect(formatearCompacto(3_000_000)).toBe('3M');
  });

  it('conserva decimales en valores chicos', () => {
    expect(formatearCompacto(2.5)).toBe('2.5');
    expect(formatearCompacto(0.25)).toBe('0.25');
  });
});

describe('entrada de monto', () => {
  it('acepta coma o punto y limita a 2 decimales', () => {
    expect(limpiarEntradaMonto('12,5')).toBe('12.5');
    expect(limpiarEntradaMonto('12.345')).toBe('12.34');
    expect(limpiarEntradaMonto('1.2.3')).toBe('1.23');
    expect(limpiarEntradaMonto('abc12x')).toBe('12');
    expect(limpiarEntradaMonto('12.')).toBe('12.');
  });

  it('limita la parte entera', () => {
    expect(limpiarEntradaMonto('12345678901')).toBe('123456789');
  });

  it('parsea a número o devuelve null', () => {
    expect(parsearMonto('12,50')).toBe(12.5);
    expect(parsearMonto('.5')).toBe(0.5);
    expect(parsearMonto('')).toBeNull();
    expect(parsearMonto('.')).toBeNull();
    expect(parsearMonto('abc')).toBeNull();
  });
});

describe('formatearTamano y formatearRam', () => {
  it('muestra el tamaño de un archivo en decimal', () => {
    expect(formatearTamano(2_588_147_712)).toBe('2.6 GB');
    expect(formatearTamano(497_664_000)).toBe('498 MB');
    expect(formatearTamano(12_000)).toBe('12 KB');
    expect(formatearTamano(0)).toBe('0 KB');
    expect(formatearTamano(300)).toBe('1 KB');
  });

  it('muestra la RAM como la anuncia el fabricante', () => {
    expect(formatearRam(17_179_869_184)).toBe('16 GB');
    expect(formatearRam(8_589_934_592)).toBe('8 GB');
    expect(formatearRam(3_221_225_472)).toBe('3 GB');
    expect(formatearRam(3_758_096_384)).toBe('3.5 GB');
  });
});
