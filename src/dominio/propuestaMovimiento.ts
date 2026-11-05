import { esClaveValida, dosDigitos } from './fechas';
import { limpiarEntradaMonto, parsearMonto } from './formato';
import type { Moneda } from './moneda';
import { MAX_MONTO, MAX_MOTIVO, validarBorrador, type ErroresBorrador } from './movimiento';
import type { EntradaMovimiento, Movimiento, TipoMovimiento } from './tipos';

/**
 * Importación de movimientos desde una imagen: el OCR (paso nativo) da texto y la IA local lo estructura;
 * este módulo convierte esa respuesta —tratada como datos no fiables— en propuestas revisables. Nada se
 * guarda aquí: solo se construye, valida y resuena. Las entradas guardables salen por `validarPropuesta`,
 * que reutiliza las reglas existentes de `movimiento.ts`.
 */

/* ------------------------------ Monto desde OCR ------------------------------ */

/**
 * Un monto visto en la imagen, sin resolver ambigüedad:
 * - `ok`: valor único en centavos (entero exacto, siempre positivo).
 * - `negativo`: el signo indica dirección opuesta al tipo propuesto; se conserva el absoluto para revisión.
 * - `ambiguo`: el separador no deja claro miles vs decimal (p. ej. «1.234»); el usuario debe decidir.
 * - `invalido`: no es un monto reconocible o supera los límites del dominio.
 */
export type ResultadoMontoOcr =
  | { estado: 'ok'; centavos: number; positivoExplicito?: boolean }
  | { estado: 'negativo'; centavos: number }
  | { estado: 'ambiguo' }
  | { estado: 'invalido' };

const CODIGOS_MONEDA = 'USD|EUR|GBP|PEN|MXN|COP|ARS|CLP|UYU|BOB|BRL|PYG|DOP|GTQ|CRC|CAD|CHF|JPY|CNY|INR';
const SIMBOLOS_MONEDA = 'RD\\$|R\\$|\\$U|S\\/|Bs|CHF|\\$|€|£|₲|Q|₡|¥|₹';
/** Código o símbolo de moneda que se toleran al principio del token (nunca en medio). */
const MONEDA_INICIO = new RegExp(`^\\s*(?:(?:${CODIGOS_MONEDA})\\s+|(?:${SIMBOLOS_MONEDA})\\s*)`, 'i');
/** Código o nombre de moneda que se toleran al final del token. */
const CODIGO_FIN = new RegExp(`\\s+(?:${CODIGOS_MONEDA}|PESOS?|SOL(?:ES)?)\\s*$`, 'i');

function aCentavos(entera: string, decimales: string): number | null {
  if (entera.length > 9) return null; // más enteros que MAX_MONTO
  const dos = (decimales + '00').slice(0, 2);
  const centavos = Number(entera + dos);
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Clasifica el patrón de separadores de un cuerpo numérico (sin signo ni símbolo). */
function clasificarCuerpo(base: string): number | 'ambiguo' | 'invalido' {
  // Entero simple.
  if (/^\d+$/.test(base)) return aCentavos(base, '') ?? 'invalido';
  // Miles con coma y decimales con punto (opcional): 1,234 / 1,234,567.89.
  let m = base.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/);
  if (m) return aCentavos(m[1].replace(/,/g, ''), m[2] ?? '') ?? 'invalido';
  // Miles con punto y decimales con coma: 1.234,56 / 1.234.567,89 (la coma decimal quita la duda).
  m = base.match(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/);
  if (m) return aCentavos(m[1].replace(/\./g, ''), m[2]) ?? 'invalido';
  // Miles con punto sin decimales: solo con dos o más grupos («1.234.567»). Un grupo suelto
  // («1.234») puede ser miles o decimal según el idioma → se deja ambiguo abajo.
  m = base.match(/^(\d{1,3}(?:\.\d{3}){2,})$/);
  if (m) return aCentavos(m[1].replace(/\./g, ''), '') ?? 'invalido';
  // Un solo separador con exactamente dos decimales: es decimal.
  m = base.match(/^(\d+)\.(\d{2})$/);
  if (m) return aCentavos(m[1], m[2]) ?? 'invalido';
  m = base.match(/^(\d+),(\d{2})$/);
  if (m) return aCentavos(m[1], m[2]) ?? 'invalido';
  // Tres cifras tras el separador: «1,234» es miles en ambos idiomas; «1.234» puede ser uno u otro → ambiguo.
  if (/^\d+,\d{3}$/.test(base)) return aCentavos(base.replace(',', ''), '') ?? 'invalido';
  if (/^\d+\.\d{3}$/.test(base)) return 'ambiguo';
  return 'invalido';
}

/**
 * Parser completo de tokens de monto de OCR. No usa `parseFloat`/`Number` sobre el texto crudo: se valida el
 * token entero y se rechaza lo que no encaja en un formato conocido. «12abc» es invalido, no 12.
 */
export function parsearMontoOcr(texto: string): ResultadoMontoOcr {
  let t = texto.trim();
  if (t === '') return { estado: 'invalido' };

  let negativo = false;
  let positivoExplicito = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1).trim();
  } else {
    const primera = t[0];
    if (primera === '+' || primera === '-' || primera === '−') {
      negativo = primera !== '+';
      positivoExplicito = primera === '+';
      t = t.slice(1).trim();
    }
  }

  // Código al principio («USD 25.00»), símbolo ($/S/…) o código al final («25.00 USD»): solo en los bordes.
  t = t.replace(MONEDA_INICIO, '').replace(CODIGO_FIN, '');
  // Espacios (también no rompes) solo como separadores de miles.
  const base = t.replace(/[\s\u00a0]+/g, '');
  if (!/^[\d.,]+$/.test(base)) return { estado: 'invalido' };

  const clasificado = clasificarCuerpo(base);
  if (clasificado === 'ambiguo') return { estado: 'ambiguo' };
  if (clasificado === 'invalido') return { estado: 'invalido' };
  if (clasificado > MAX_MONTO * 100) return { estado: 'invalido' };
  if (negativo) return { estado: 'negativo', centavos: clasificado };
  return positivoExplicito
    ? { estado: 'ok', centavos: clasificado, positivoExplicito: true }
    : { estado: 'ok', centavos: clasificado };
}

/** Centavos → texto en el formato de entrada de la app («1234.56»), para reutilizar su validación. */
export function montoTextoDeCentavos(centavos: number): string {
  return `${Math.trunc(centavos / 100)}.${dosDigitos(centavos % 100)}`;
}

/* ------------------------------ Fecha desde OCR ------------------------------ */

export type ResultadoFechaOcr = { estado: 'ok'; clave: string } | { estado: 'ambiguo' } | { estado: 'invalido' };

function claveValida(anio: number, mes: number, dia: number): ResultadoFechaOcr {
  if (anio < 1900 || anio > 2100) return { estado: 'invalido' };
  const ultimoDia = new Date(anio, mes, 0).getDate(); // días reales del mes (incluye bisiestos)
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDia) return { estado: 'invalido' };
  return { estado: 'ok', clave: `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}` };
}

/**
 * Parser de fechas de OCR con formatos explícitos (nunca `Date.parse` sobre el texto crudo):
 * `AAAA-MM-DD` y pares numéricos con año completo. Si día/mes son intercambiables o falta/el año es
 * de dos dígitos, devuelve `ambiguo`: la referencia temporal la decide el usuario, no la app.
 */
export function parsearFechaOcr(texto: string): ResultadoFechaOcr {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (t === '') return { estado: 'invalido' };

  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return claveValida(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const anio = Number(m[3]);
    if (a > 12 && b <= 12) return claveValida(anio, b, a); // solo puede ser día/mes
    if (b > 12 && a <= 12) return claveValida(anio, a, b); // solo puede ser mes/día
    return { estado: 'ambiguo' }; // ambos ≤ 12: el orden no está probado
  }

  // Año de dos dígitos o fecha sin año: no se adivina el siglo ni la referencia.
  if (/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/.test(t)) return { estado: 'ambiguo' };
  if (/^\d{1,2}[-/. ]\d{1,2}$/.test(t)) return { estado: 'ambiguo' };
  return { estado: 'invalido' };
}

const MONEDA_EN_TOKEN = new RegExp(
  `^\\s*[+\\-−(]?\\s*(${CODIGOS_MONEDA}|${SIMBOLOS_MONEDA})|(${CODIGOS_MONEDA}|PESOS?|SOL(?:ES)?)\\s*\\)?\\s*$`,
  'i',
);
const SIMBOLO_DE: Record<string, string> = {
  '€': 'EUR',
  '£': 'GBP',
  'S/': 'PEN',
  SOL: 'PEN',
  SOLES: 'PEN',
  'R$': 'BRL',
  'RD$': 'DOP',
  $U: 'UYU',
  BS: 'BOB',
  '₲': 'PYG',
  Q: 'GTQ',
  '₡': 'CRC',
  '₹': 'INR',
};

/** `true` si el token trae una moneda explícita distinta de la de la app (o una que no se puede asegurar). */
export function monedaNoCoincide(token: string, moneda: Moneda): boolean {
  const m = token.match(MONEDA_EN_TOKEN);
  const hallada = (m?.[1] ?? m?.[2])?.toUpperCase();
  if (!hallada) return false; // sin moneda explícita: lo decide `monedaDuda`
  if (hallada === '$' || hallada === '¥') return moneda.simbolo !== hallada; // símbolos compartidos entre varias divisas
  if (/^PESOS?$/.test(hallada)) return true; // «peso(s)» no identifica un código concreto → revisión
  return (SIMBOLO_DE[hallada] ?? hallada) !== moneda.codigo;
}

/* --------------------------- Contrato de la respuesta --------------------------- */

export const MAX_PROPUESTAS = 30;
/** Límite del texto de la respuesta antes de parsear (un modelo pequeño a veces no sabe parar). */
export const MAX_CARACTERES_EXTRACCION = 20_000;
const MAX_CAMPO_OCR = 200;
const MAX_TOKEN_OCR = 40;

/** Un movimiento tal como lo describe la IA: solo tokens crudos de la imagen, sin cifras convertidas. */
export interface ExtraccionMovimiento {
  tipo: TipoMovimiento | null;
  motivo: string | null;
  /** Token del monto tal como aparece impreso (p. ej. «1.234,56»); `null` si no se ve. */
  montoTexto: string | null;
  /** Texto de la fecha tal como aparece (p. ej. «04/11/2026»); `null` si no se ve. */
  fechaTexto: string | null;
  /** El origen lo marca pendiente / por liquidar. */
  pendiente: boolean;
  /** Posible transferencia o pago a una cuenta propia (puede duplicar gastos ya registrados). */
  transferencia: boolean;
  /** Línea del OCR de donde salió, para que el usuario verifique. */
  fuente: string;
}

export interface DatosExtraccion {
  movimientos: ExtraccionMovimiento[];
  monedaDuda: boolean;
  recibo: boolean;
  dudaTotalRecibo: boolean;
}

export type ResultadoValidacionExtraccion =
  | { ok: true; datos: DatosExtraccion }
  | { ok: false; codigo: 'largo' | 'json' | 'forma' };

const TIPOS_VALIDOS: ReadonlySet<string> = new Set(['ingreso', 'gasto']);

function textoO(v: unknown, max: number, porDefecto: string): string | 'invalido' {
  if (v === null || v === undefined) return porDefecto;
  if (typeof v !== 'string' || v.length > max) return 'invalido';
  return v;
}

function booleanoO(v: unknown): boolean | 'invalido' {
  if (v === undefined) return false;
  return typeof v === 'boolean' ? v : 'invalido';
}

/**
 * Valida la respuesta cruda del modelo como `unknown` y proyecta SOLO los campos del contrato. No usa
 * `as` sobre el objeto: cada campo se comprueba y lo desconocido (ids, rutas, «sql»…) no pasa adelante.
 */
export function validarRespuestaExtraccion(texto: string): ResultadoValidacionExtraccion {
  if (typeof texto !== 'string' || texto.length === 0 || texto.length > MAX_CARACTERES_EXTRACCION) {
    return { ok: false, codigo: 'largo' };
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, codigo: 'json' }; // también cubre respuestas truncadas
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return { ok: false, codigo: 'forma' };
  }
  const raiz = bruto as Record<string, unknown>;
  const lista = raiz.movimientos;
  if (!Array.isArray(lista) || lista.length > MAX_PROPUESTAS) return { ok: false, codigo: 'forma' };

  const movimientos: ExtraccionMovimiento[] = [];
  for (const fila of lista) {
    if (typeof fila !== 'object' || fila === null || Array.isArray(fila)) return { ok: false, codigo: 'forma' };
    const f = fila as Record<string, unknown>;

    const tipo =
      f.tipo === null ? null : typeof f.tipo === 'string' && TIPOS_VALIDOS.has(f.tipo) ? (f.tipo as TipoMovimiento) : undefined;
    if (tipo === undefined) return { ok: false, codigo: 'forma' };

    // `null` significa «no se ve en la imagen»: se distingue de un motivo vacío.
    const motivo = f.motivo === null || f.motivo === undefined ? null : textoO(f.motivo, MAX_CAMPO_OCR, '');
    const montoTexto = f.montoTexto === null ? null : textoO(f.montoTexto, MAX_TOKEN_OCR, '');
    const fechaTexto = f.fechaTexto === null ? null : textoO(f.fechaTexto, MAX_TOKEN_OCR, '');
    const fuente = textoO(f.fuente, MAX_CAMPO_OCR, '');
    const pendiente = booleanoO(f.pendiente);
    const transferencia = booleanoO(f.transferencia);
    if (
      motivo === 'invalido' ||
      montoTexto === 'invalido' ||
      fechaTexto === 'invalido' ||
      fuente === 'invalido' ||
      pendiente === 'invalido' ||
      transferencia === 'invalido'
    ) {
      return { ok: false, codigo: 'forma' };
    }

    movimientos.push({ tipo, motivo, montoTexto, fechaTexto, pendiente, transferencia, fuente });
  }

  const monedaDuda = booleanoO(raiz.monedaDuda);
  const recibo = booleanoO(raiz.recibo);
  const dudaTotalRecibo = booleanoO(raiz.dudaTotalRecibo);
  if (monedaDuda === 'invalido' || recibo === 'invalido' || dudaTotalRecibo === 'invalido') {
    return { ok: false, codigo: 'forma' };
  }

  return { ok: true, datos: { movimientos, monedaDuda, recibo, dudaTotalRecibo } };
}

/* ------------------------------ Propuestas ------------------------------ */

/** Motivos de aviso, explícitos y enumerados; la interfaz los traduce. Son heurísticos: nunca bloquean por sí solos. */
export type AvisoPropuesta =
  | 'tipo_dudoso' // tipo ausente o en conflicto con el signo del origen
  | 'pendiente' // el origen lo marca como pendiente / por liquidar
  | 'puede_duplicar' // transferencia o pago a cuenta propia: puede duplicar gastos existentes
  | 'moneda_duda' // la moneda de la imagen no coincide o no está establecida
  | 'total_recibo_dudoso' // recibo con total ambiguo
  | 'duplicado_interno' // otra propuesta del mismo lote coincide en fecha, monto y tipo
  | 'duplicado_existente'; // un movimiento activo coincide en fecha, monto y tipo

/**
 * Una fila de la revisión. `montoTexto` y `fecha` son los campos editables (formato de la app); los tokens
 * originales del OCR se conservan en `montoOriginal`/`fechaOriginal` como evidencia, nunca se mezclan.
 */
export interface PropuestaMovimiento {
  id: string;
  tipo: TipoMovimiento | null;
  /** Texto editable; `''` = por completar. Formato de entrada de la app (punto decimal). */
  montoTexto: string;
  motivo: string;
  /** Clave `YYYY-MM-DD` o `null` si la fecha del origen no quedó resuelta. */
  fecha: string | null;
  /** Token del monto tal como aparecía en la imagen (evidencia). */
  montoOriginal: string | null;
  /** Texto de la fecha tal como aparecía (evidencia). */
  fechaOriginal: string | null;
  /** Línea del OCR de referencia. */
  fuente: string;
  pendiente: boolean;
  seleccionada: boolean;
  avisos: AvisoPropuesta[];
}

/** Id local estable, independiente de la posición en la lista. */
let secuencia = 0;
const crearIdPorDefecto = () => `prop-${(secuencia++).toString(36)}`;

/** Clave para comparar duplicados: día + centavos + tipo (la descripción no cuenta: es heurística suelta). */
function claveDuplicado(fecha: string, centavos: number, tipo: TipoMovimiento): string {
  return `${fecha}|${centavos}|${tipo}`;
}

export function construirPropuestas(
  datos: DatosExtraccion,
  activos: readonly Movimiento[],
  monedaOCrearId?: Moneda | (() => string),
  crearIdPorParametro: () => string = crearIdPorDefecto,
): PropuestaMovimiento[] {
  const moneda = typeof monedaOCrearId === 'object' && monedaOCrearId !== null ? monedaOCrearId : undefined;
  const crearId = typeof monedaOCrearId === 'function' ? monedaOCrearId : crearIdPorParametro;
  const propuestas: PropuestaMovimiento[] = datos.movimientos.map((m) => {
    const avisos: AvisoPropuesta[] = [];

    let tipo = m.tipo;
    let montoTexto = '';
    let fecha: string | null = null;

    if (m.montoTexto !== null && m.montoTexto.trim() !== '') {
      const rMonto = parsearMontoOcr(m.montoTexto);
      if (rMonto.estado === 'ok') {
        montoTexto = montoTextoDeCentavos(rMonto.centavos);
        if (rMonto.positivoExplicito && tipo === 'gasto') avisos.push('tipo_dudoso');
      } else if (rMonto.estado === 'negativo') {
        // El signo de un estado bancario indica dirección: coherente con «gasto», en conflicto con «ingreso».
        if (tipo === 'ingreso') avisos.push('tipo_dudoso');
        montoTexto = montoTextoDeCentavos(rMonto.centavos);
      } // ambiguo/invalido → campo vacío: el usuario lo completa, nada se inventa
    }

    if (m.fechaTexto !== null && m.fechaTexto.trim() !== '') {
      const rFecha = parsearFechaOcr(m.fechaTexto);
      if (rFecha.estado === 'ok') fecha = rFecha.clave;
    }

    if (tipo === null) avisos.push('tipo_dudoso');
    if (m.pendiente) avisos.push('pendiente');
    if (m.transferencia) avisos.push('puede_duplicar');
    if (datos.monedaDuda || (moneda && m.montoTexto !== null && monedaNoCoincide(m.montoTexto, moneda))) {
      avisos.push('moneda_duda');
    }
    if (datos.recibo && datos.dudaTotalRecibo) avisos.push('total_recibo_dudoso');

    return {
      id: crearId(),
      tipo,
      montoTexto,
      motivo: m.motivo ?? '',
      fecha,
      montoOriginal: m.montoTexto,
      fechaOriginal: m.fechaTexto,
      fuente: m.fuente,
      pendiente: m.pendiente,
      seleccionada: false, // se decide al final, con los duplicados ya calculados
      avisos,
    };
  });

  marcarDuplicadosInternos(propuestas);
  marcarDuplicadosConActivos(propuestas, activos);

  for (const p of propuestas) {
    p.seleccionada =
      p.tipo !== null &&
      !p.pendiente &&
      p.avisos.length === 0 &&
      parsearMonto(p.montoTexto) !== null &&
      esClaveValida(p.fecha ?? '') &&
      p.motivo.trim() !== '' &&
      p.motivo.trim().length <= MAX_MOTIVO;
  }

  return propuestas;
}

/**
 * Clave de comparación de duplicados de una fila editable: `null` si falta algún campo o es inválido
 * (una fila incompleta no puede ser «duplicada» de nada). La usan tanto la construcción inicial como la
 * recomposición tras cada edición.
 */
export function claveDuplicadoDe(p: Pick<PropuestaMovimiento, 'tipo' | 'montoTexto' | 'fecha'>): string | null {
  const monto = parsearMonto(p.montoTexto);
  if (!p.tipo || !esClaveValida(p.fecha ?? '') || monto === null || monto <= 0) return null;
  return claveDuplicado(p.fecha as string, Math.round(monto * 100), p.tipo);
}

function marcarDuplicadosInternos(propuestas: PropuestaMovimiento[]): void {
  const vistas = new Map<string, number>();
  for (const p of propuestas) {
    const clave = claveDuplicadoDe(p);
    if (clave) vistas.set(clave, (vistas.get(clave) ?? 0) + 1);
  }
  for (const p of propuestas) {
    const clave = claveDuplicadoDe(p);
    if (clave && (vistas.get(clave) ?? 0) > 1 && !p.avisos.includes('duplicado_interno')) {
      p.avisos.push('duplicado_interno');
    }
  }
}

function marcarDuplicadosConActivos(propuestas: PropuestaMovimiento[], activos: readonly Movimiento[]): void {
  const claves = new Set<string>();
  for (const m of activos) {
    if (m.eliminado || !esClaveValida(m.fecha)) continue;
    claves.add(claveDuplicado(m.fecha, Math.round(m.monto * 100), m.tipo));
  }
  for (const p of propuestas) {
    const clave = claveDuplicadoDe(p);
    if (clave && claves.has(clave) && !p.avisos.includes('duplicado_existente')) {
      p.avisos.push('duplicado_existente');
    }
  }
}

/* ------------------------------ Validación y entrada guardable ------------------------------ */

export interface ErroresPropuesta extends ErroresBorrador {
  tipo?: { clave: 'importar.error_tipo' };
}

/**
 * Revalida una propuesta (tras ediciones incluidas) con las reglas existentes de `movimiento.ts`.
 * Devuelve la entrada guardable (`recurrente: false` siempre: lo importado no se repite por defecto) o los
 * errores por campo. Una propuesta inválida nunca produce entrada.
 */
export function validarPropuesta(p: PropuestaMovimiento): {
  entrada: EntradaMovimiento | null;
  errores: ErroresPropuesta;
} {
  const errores: ErroresPropuesta = {};
  if (p.tipo === null) errores.tipo = { clave: 'importar.error_tipo' };

  const montoCrudo = p.montoTexto.trim();
  // Lo que se guarda tiene que ser exactamente lo que se ve: nunca se reinterpreta el texto en silencio.
  if (montoCrudo !== '' && limpiarEntradaMonto(montoCrudo) !== montoCrudo) {
    errores.monto = { clave: 'error.monto_requerido' };
  }

  const resultado = validarBorrador({
    tipo: p.tipo ?? 'gasto',
    monto: p.montoTexto,
    motivo: p.motivo,
    fecha: p.fecha ?? '',
    recurrente: false,
    periodo: 'mensual',
    frecuencia: 1,
  });

  // Solo los errores reales: asignar `undefined` crearía claves «presentes» y rompería el resumen.
  if (resultado.errores.monto) errores.monto = resultado.errores.monto;
  if (resultado.errores.motivo) errores.motivo = resultado.errores.motivo;
  if (resultado.errores.fecha) errores.fecha = resultado.errores.fecha;

  if (Object.keys(errores).length > 0 || resultado.entrada === null) {
    return { entrada: null, errores };
  }
  return { entrada: { ...resultado.entrada, recurrente: false, periodo: null, frecuencia: null }, errores };
}

/* ------------------------------ Totales ------------------------------ */

export interface ResumenSeleccionadas {
  cantidad: number;
  ingresosCentavos: number;
  gastosCentavos: number;
  netoCentavos: number;
}

/**
 * Totales de las propuestas seleccionadas, en centavos exactos y solo sobre entradas validas. Las
 * seleccionadas que no superan la validación (edición pendiente) quedan fuera del resumen.
 */
export function resumenSeleccionadas(propuestas: readonly PropuestaMovimiento[]): ResumenSeleccionadas {
  const resumen: ResumenSeleccionadas = { cantidad: 0, ingresosCentavos: 0, gastosCentavos: 0, netoCentavos: 0 };
  for (const p of propuestas) {
    if (!p.seleccionada) continue;
    const { entrada } = validarPropuesta(p);
    if (entrada === null) continue;
    const centavos = Math.round(entrada.monto * 100);
    if (entrada.tipo === 'ingreso') resumen.ingresosCentavos += centavos;
    else resumen.gastosCentavos += centavos;
    resumen.cantidad += 1;
  }
  resumen.netoCentavos = resumen.ingresosCentavos - resumen.gastosCentavos;
  return resumen;
}
