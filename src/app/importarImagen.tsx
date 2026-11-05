import { launchImageLibraryAsync } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { Boton } from '@/componentes/Boton';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { useAviso } from '@/componentes/AvisoProvider';
import { FilaPropuesta, type CambiosPropuesta } from '@/componentes/FilaPropuesta';
import { Tarjeta } from '@/componentes/Tarjeta';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import { esClaveValida } from '@/dominio/fechas';
import type { EntradaMovimiento } from '@/dominio/tipos';
import {
  claveDuplicadoDe,
  construirPropuestas,
  resumenSeleccionadas,
  validarRespuestaExtraccion,
  validarPropuesta,
  MAX_CARACTERES_EXTRACCION,
  type AvisoPropuesta,
  type PropuestaMovimiento,
} from '@/dominio/propuestaMovimiento';
import { MAX_OCR_PROMPT, construirPromptExtraccion } from '@/dominio/promptExtraccion';
import { RespuestaIncompletaError, useIA } from '@/ia/IAProvider';
import { traducirErrorIA } from '@/ia/errores';
import { reconocerTextoImagen, soportaOcrLocal } from '@/ia/ocrTexto';
import type { ClaveTexto } from '@/i18n/es';

/** Provisionales: el paso 1 los ajusta con medidas reales de memoria y tiempo. */
const MAX_BYTES_IMAGEN_OCR = 30 * 1024 * 1024;
const MAX_PIXELES_OCR = 50_000_000;
const TIEMPO_MAXIMO_EXTRACCION_MS = 300_000;

/** Fases del flujo. `intento` invalida resultados tardíos: ningún valor llega sin pasarlo por la revisión. */
type Fase =
  | { nombre: 'elegir' }
  | { nombre: 'analizando'; etapa: 'ocr' | 'ia' }
  | { nombre: 'sinMovimientos' }
  | { nombre: 'fallo'; clave: ClaveTexto }
  | { nombre: 'revision' };

/** Avisos que no dependen del lote: los fija la extracción. Los de duplicados se recomputan en cada edición. */
const avisosBaseDe = (avisos: readonly AvisoPropuesta[]) =>
  avisos.filter((aviso) => aviso !== 'duplicado_interno' && aviso !== 'duplicado_existente');

/** Propuesta en revisión: recuerda qué avisos aceptó el usuario al marcarla. */
type PropuestaRevision = PropuestaMovimiento & { avisosAceptados: readonly AvisoPropuesta[] };

export default function ImportarImagen() {
  const { formatear, i18n, moneda } = useAjustes();
  const { movimientos, almacen, guardarLoteMovimientos } = useDatos();
  const { estado, refrescar, generarTexto, detener } = useIA();
  const { avisar } = useAviso();
  const router = useRouter();

  const [fase, setFase] = useState<Fase>({ nombre: 'elegir' });
  const [propuestas, setPropuestas] = useState<PropuestaRevision[] | null>(null);
  const [enGuardado, setEnGuardado] = useState(false);
  // Cada análisis nuevo (o una cancelación) incrementa el intento: los resultados viejos se descartan.
  const intento = useRef(0);
  // Guarda síncrono en vuelo (el botón deshabilitado no basta contra dos toques rápidos).
  const guardandoRef = useRef(false);
  const eligiendoRef = useRef(false);
  // Copia de la galería que eligió el usuario: es nuestra hasta que el OCR termina o se desmonta la pantalla.
  const uriTemporal = useRef<string | null>(null);
  const enIA = useRef(false);

  const alEntrar = useEffectEvent(() => void refrescar());
  const alSalir = useEffectEvent(() => {
    intento.current += 1; // al desmontar, nada de esta pantalla puede tocar el estado ya
    if (enIA.current) detener(); // no seguir generando para una pantalla que ya no existe
    if (uriTemporal.current) almacen.borrarTemporal(uriTemporal.current);
  });

  useEffect(() => {
    alEntrar();
    return () => alSalir();
  }, []);

  /** Claves `fecha|centavos|tipo` de los movimientos activos: la base de comparación de duplicados. */
  const clavesActivas = useMemo(
    () =>
      new Set(
        movimientos
          .filter((m) => !m.eliminado && esClaveValida(m.fecha))
          .map((m) => claveDuplicadoDe({ tipo: m.tipo, montoTexto: String(m.monto), fecha: m.fecha }))
          .filter((clave): clave is string => clave !== null),
      ),
    [movimientos],
  );

  /**
   * Por qué no se puede importar ahora (`null` = se puede). El OCR es solo Android y la extracción necesita el
   * modelo local listo; si falta, se señala el flujo de descarga en lugar de duplicarlo.
   */
  const bloqueo: ClaveTexto | null = useMemo(() => {
    if (!soportaOcrLocal()) return 'ia.no_compatible_plataforma';
    switch (estado.fase) {
      case 'desconocido':
        return null; // aún se consulta al teléfono
      case 'no-compatible':
        return 'ia.no_compatible_generico';
      case 'sin-descargar':
      case 'descargando':
      case 'verificando':
      case 'pausada':
        return 'importar.necesita_modelo';
      default:
        return null; // descargado, cargando o listo
    }
  }, [estado.fase]);

  /** Avisos de duplicados sobre las filas actuales (el resto ya vive en cada propuesta). */
  const avisosPorId = useMemo(() => {
    const mapa = new Map<string, AvisoPropuesta[]>();
    if (!propuestas) return mapa;
    const vistas = new Map<string, number>();
    for (const p of propuestas) {
      const clave = claveDuplicadoDe(p);
      if (clave) vistas.set(clave, (vistas.get(clave) ?? 0) + 1);
    }
    for (const p of propuestas) {
      const avisos = [...p.avisos];
      const clave = claveDuplicadoDe(p);
      if (clave && (vistas.get(clave) ?? 0) > 1) avisos.push('duplicado_interno');
      if (clave && clavesActivas.has(clave)) avisos.push('duplicado_existente');
      mapa.set(p.id, avisos);
    }
    return mapa;
  }, [propuestas, clavesActivas]);

  // Selección vigente = marcada Y sin avisos que el usuario no haya visto al marcarla.
  const vigentes = useMemo(
    () =>
      propuestas?.map((p) => ({
        ...p,
        seleccionada:
          p.seleccionada && (avisosPorId.get(p.id) ?? []).every((a) => p.avisosAceptados.includes(a)),
      })) ?? null,
    [propuestas, avisosPorId],
  );

  const validaciones = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof validarPropuesta>>();
    if (!vigentes) return mapa;
    for (const p of vigentes) mapa.set(p.id, validarPropuesta(p));
    return mapa;
  }, [vigentes]);

  const resumen = useMemo(() => (vigentes ? resumenSeleccionadas(vigentes) : null), [vigentes]);

  const analizar = async (uri: string) => {
    if (bloqueo !== null) {
      almacen.borrarTemporal(uri);
      return;
    }
    const mio = ++intento.current;
    uriTemporal.current = uri;
    setPropuestas(null);
    setFase({ nombre: 'analizando', etapa: 'ocr' });
    let textoOcr = '';
    try {
      textoOcr = await reconocerTextoImagen(uri);
    } catch {
      // El OCR no expone cancelación nativa: un intento invalidado se descarta en el guard siguiente.
      if (mio === intento.current) setFase({ nombre: 'fallo', clave: 'importar.error_ocr' });
      return;
    } finally {
      // Con el texto ya extraído, solo se borra el archivo de este intento específico.
      almacen.borrarTemporal(uri);
      if (uriTemporal.current === uri) uriTemporal.current = null;
    }
    if (mio !== intento.current) return; // se canceló o cambió la imagen mientras tanto
    if (!textoOcr.trim()) {
      setFase({ nombre: 'fallo', clave: 'importar.sin_texto' });
      return;
    }
    if (textoOcr.length > MAX_OCR_PROMPT) {
      setFase({ nombre: 'fallo', clave: 'importar.texto_largo' });
      return;
    }

    setFase({ nombre: 'analizando', etapa: 'ia' });
    enIA.current = true;
    try {
      const respuesta = await generarTexto(construirPromptExtraccion(textoOcr, i18n.idioma, moneda), {
        maxCaracteres: MAX_CARACTERES_EXTRACCION,
        tiempoMaximoMs: TIEMPO_MAXIMO_EXTRACCION_MS,
      });
      if (mio !== intento.current) return;
      const validado = validarRespuestaExtraccion(respuesta);
      if (!validado.ok) {
        setFase({ nombre: 'fallo', clave: 'importar.error_extraccion' });
        return;
      }
      // La IA da tokens crudos; el dominio los convierte y marca duplicados contra los movimientos activos.
      const nuevas: PropuestaRevision[] = construirPropuestas(validado.datos, movimientos, moneda).map((p) => ({
        ...p,
        avisos: avisosBaseDe(p.avisos),
        avisosAceptados: [],
      }));
      setPropuestas(nuevas.length > 0 ? nuevas : null);
      setFase(nuevas.length > 0 ? { nombre: 'revision' } : { nombre: 'sinMovimientos' });
    } catch (fallo) {
      if (mio !== intento.current) return;
      if (fallo instanceof RespuestaIncompletaError) {
        setFase({
          nombre: 'fallo',
          clave: fallo.motivo === 'largo' ? 'importar.respuesta_larga' : 'importar.respuesta_lenta',
        });
        return;
      }
      const { cancelado, clave } = traducirErrorIA(fallo);
      // Cancelación del usuario → volver a elegir sin contarla como fallo.
      setFase(cancelado ? { nombre: 'elegir' } : { nombre: 'fallo', clave: (clave ?? 'importar.error_extraccion') as ClaveTexto });
    } finally {
      enIA.current = false;
    }
  };

  const elegirImagen = async () => {
    if (eligiendoRef.current) return;
    eligiendoRef.current = true;
    let respuesta;
    try {
      // `quality: 1` conserva el original sin re-comprimir: el OCR necesita el detalle fino.
      respuesta = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    } catch {
      setFase({ nombre: 'fallo', clave: 'importar.error_ocr' });
      return;
    } finally {
      eligiendoRef.current = false;
    }
    const asset = respuesta.assets?.[0];
    if (respuesta.canceled || !asset?.uri) return; // cancelar el selector no cambia nada
    if ((asset.fileSize ?? 0) > MAX_BYTES_IMAGEN_OCR || (asset.width ?? 0) * (asset.height ?? 0) > MAX_PIXELES_OCR) {
      almacen.borrarTemporal(asset.uri);
      setFase({ nombre: 'fallo', clave: 'importar.imagen_grande' });
      return;
    }
    void analizar(asset.uri);
  };

  const detenerAnalisis = () => {
    intento.current += 1; // lo que llegue de aquí en adelante es de otro intento
    detener(); // si toca a la IA, se detiene el motor (el OCR no ofrece cancelación)
    setPropuestas(null);
    setFase({ nombre: 'elegir' });
  };

  /** Cualquier edición desmarca la fila: lo editado debe volver a validarse y elegirse a conciencia. */
  const editarPropuesta = (id: string, cambios: CambiosPropuesta) => {
    setPropuestas((antiguas) =>
      antiguas?.map((p) => (p.id === id ? { ...p, ...cambios, seleccionada: false, avisosAceptados: [] } : p)) ?? null,
    );
  };

  const alternarSeleccion = (id: string) => {
    // Una fila inválida nunca es elegible, con o sin avisos.
    if (!validaciones.get(id)?.entrada) return;
    const actuales = avisosPorId.get(id) ?? [];
    setPropuestas((antiguas) =>
      antiguas?.map((p) =>
        p.id === id
          ? { ...p, seleccionada: !p.seleccionada, avisosAceptados: p.seleccionada ? [] : actuales }
          : p,
      ) ?? null,
    );
  };

  /**
   * Paso 4 del plan: revalida las filas seleccionadas y guarda el lote de forma atómica. Nada se
   * persiste hasta aquí; si la transacción falla, nada queda guardado y la revisión sigue intacta.
   */
  const confirmar = async () => {
    if (guardandoRef.current || !propuestas || !vigentes) return; // en curso: dos toques rápidos no duplican el lote
    // Si un aviso nuevo invalidó alguna marca, se avisa en vez de cambiar la selección en silencio.
    if (propuestas.some((p, i) => p.seleccionada !== vigentes[i].seleccionada)) {
      avisar({ titulo: i18n.t('importar.revisa_avisos') });
      return;
    }
    const entradas: EntradaMovimiento[] = [];
    for (const p of vigentes) {
      if (!p.seleccionada) continue;
      // Revalidación en el límite de persistencia: nunca se guarda lo que no pasa la validación actual.
      const entrada = validarPropuesta(p).entrada;
      if (!entrada) {
        avisar({ titulo: i18n.t('importar.revisa_filas') });
        return;
      }
      entradas.push(entrada);
    }
    if (entradas.length === 0) return;

    guardandoRef.current = true;
    setEnGuardado(true);
    try {
      await guardarLoteMovimientos(entradas);
      router.back();
    } catch {
      // La transacción revierte por completo: el lote no se tocó y reintentar no puede duplicarlo.
      guardandoRef.current = false;
      setEnGuardado(false);
      avisar({ titulo: i18n.t('importar.error_guardado') });
    }
  };

  /* ------------------------------ Fases ------------------------------ */

  if (estado.fase === 'desconocido') {
    return (
      <View style={estilos.centro} testID="importar-estado">
        <ActivityIndicator accessibilityLabel={i18n.t('ia.cargando')} />
      </View>
    );
  }

  if (bloqueo !== null) {
    return (
      <View style={estilos.centro} testID="importar-estado">
        <Tarjeta>
          <EstadoVacio
            icono={bloqueo === 'importar.necesita_modelo' ? 'sparkles-outline' : 'image-outline'}
            titulo={i18n.t('importar.titulo')}
            descripcion={i18n.t(bloqueo)}
          />
        </Tarjeta>
      </View>
    );
  }

  if (fase.nombre === 'analizando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel={i18n.t('importar.revisar')} />
        <Texto variante="cuerpo" style={estilos.textoCentro}>
          {i18n.t(fase.etapa === 'ocr' ? 'importar.analizando_ocr' : 'importar.analizando_ia')}
        </Texto>
        {/* El OCR no puede pararse de verdad; «Detener» invalida el intento y descarta su resultado. */}
        <Boton titulo={i18n.t('ia.detener')} variante="neutro" icono="stop-circle-outline" onPress={detenerAnalisis} />
      </View>
    );
  }

  if (fase.nombre === 'sinMovimientos' || fase.nombre === 'fallo') {
    const esFallo = fase.nombre === 'fallo';
    const titulo = esFallo ? i18n.t(fase.clave) : i18n.t('importar.sin_movimientos');
    // En fallo el título ya es el mensaje; no hay descripción.
    const descripcion = esFallo ? '' : i18n.t('importar.sin_movimientos_desc');
    return (
      <View style={estilos.centro}>
        <Tarjeta>
          <EstadoVacio icono="image-outline" titulo={titulo} descripcion={descripcion} />
        </Tarjeta>
        <Boton titulo={i18n.t('comun.reintentar')} icono="refresh" onPress={() => setFase({ nombre: 'elegir' })} />
      </View>
    );
  }

  if (fase.nombre === 'elegir') {
    return (
      <View style={estilos.centro}>
        <Tarjeta>
          <EstadoVacio
            icono="image-outline"
            titulo={i18n.t('importar.elegir')}
            descripcion={i18n.t('importar.elegir_desc')}
          />
        </Tarjeta>
        <Boton titulo={i18n.t('importar.elegir')} icono="image" onPress={() => void elegirImagen()} />
      </View>
    );
  }

  // `revision`: lista editable + resumen. Nada se guarda hasta la confirmación explícita (paso 4).
  const n = resumen?.cantidad ?? 0;
  return (
    <ScrollView contentContainerStyle={estilos.revision}>
      <Texto variante="secundario" style={estilos.resumenEncabezado}>
        {i18n.t('importar.revisar')} · {i18n.t('importar.seleccionadas', { n, total: vigentes?.length ?? 0 })}
      </Texto>
      {vigentes?.map((p) => (
        <FilaPropuesta
          key={p.id}
          propuesta={p}
          avisos={avisosPorId.get(p.id) ?? []}
          errores={validaciones.get(p.id)?.errores ?? {}}
          onEditar={editarPropuesta}
          onToggleSeleccion={alternarSeleccion}
          bloqueada={enGuardado}
        />
      ))}
      <Tarjeta style={estilos.resumen}>
        <Texto variante="secundario">
          {formatear((resumen?.ingresosCentavos ?? 0) / 100)} · {formatear((resumen?.gastosCentavos ?? 0) / 100)} ·{' '}
          {i18n.t('importar.neto')}: {formatear((resumen?.netoCentavos ?? 0) / 100)}
        </Texto>
        <Boton
          titulo={enGuardado ? i18n.t('importar.guardando') : i18n.plural('importar.agregar', n)}
          icono="add"
          deshabilitado={n === 0 || enGuardado}
          onPress={() => void confirmar()}
        />
      </Tarjeta>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  textoCentro: { textAlign: 'center' },
  revision: { gap: 12, padding: 16, paddingBottom: 24 },
  resumenEncabezado: { paddingHorizontal: 2 },
  resumen: { gap: 8 },
});
