import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';

interface Evento {
  id_evento: number;
  titulo: string;
  descripcion?: string;
  temario?: string;
  tipo_evento: string;
  duracion_horas: number;
  costo: number;
  fecha_hora_inicio: string;
  cupo_maximo: number;
  lugar?: string;
  enlace_virtual?: string;
  total_inscritos: number;
  usuario_inscrito: boolean;
  id_inscripcion?: number;
  ponente_nombre?: string;
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Clave local YYYY-MM-DD tomada del texto crudo, sin conversión de zona horaria.
const claveFecha = (raw: string) => raw.slice(0, 10);

// Hora "HH:MM" desde el texto crudo (evita el desfase UTC de Hermes/Android).
const horaDesde = (raw: string) => {
  const t = raw.includes('T') ? raw.split('T')[1] : (raw.split(' ')[1] ?? '');
  const [hh, mm] = t.split(':');
  return hh ? `${hh.padStart(2, '0')}:${(mm ?? '00').padStart(2, '0')}` : '';
};

// Date local a partir del texto crudo, para comparar si ya venció.
const fechaLocal = (raw: string) => {
  const [fecha, hora] = raw.replace('T', ' ').split(' ');
  const [y, mo, d] = fecha.split('-').map(Number);
  const [hh, mm] = (hora ?? '00:00').split(':').map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
};

const claveDia = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function CalendarioScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const isGuest = useAuthStore(s => s.esInvitado)();

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11
  const [diaSel, setDiaSel] = useState<string>(claveDia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventoDetalle, setEventoDetalle] = useState<Evento | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select(`id_evento, titulo, descripcion, temario, tipo_evento, duracion_horas, costo, fecha_hora_inicio, cupo_maximo, lugar, enlace_virtual, nombre_ponente,
          total_inscritos:inscripciones(count),
          inscripciones_usuario:inscripciones!left(id_inscripcion, id_usuario, estado)`)
        .order('fecha_hora_inicio', { ascending: true });
      if (error) throw error;
      const mapped: Evento[] = (data ?? []).map((e: any) => {
        const miInscripcion = (e.inscripciones_usuario ?? []).find(
          (i: any) => i.id_usuario === usuario?.id_usuario && i.estado !== 'cancelada'
        );
        return {
          ...e,
          total_inscritos: e.total_inscritos?.[0]?.count ?? 0,
          usuario_inscrito: !!miInscripcion,
          id_inscripcion: miInscripcion?.id_inscripcion ?? undefined,
          ponente_nombre: e.nombre_ponente ?? undefined,
        };
      });
      setEventos(mapped);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuario?.id_usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mantiene el modal de detalle sincronizado tras inscribirse / cancelar.
  useEffect(() => {
    if (!eventoDetalle) return;
    const actualizado = eventos.find(e => e.id_evento === eventoDetalle.id_evento);
    if (actualizado && actualizado !== eventoDetalle) setEventoDetalle(actualizado);
  }, [eventos]);

  // Agrupa eventos por día: { 'YYYY-MM-DD': Evento[] }
  const eventosPorDia = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    for (const e of eventos) {
      const k = claveFecha(e.fecha_hora_inicio);
      (map[k] ??= []).push(e);
    }
    return map;
  }, [eventos]);

  const eventosDelDia = eventosPorDia[diaSel] ?? [];

  // Construcción de la cuadrícula (inicia en lunes)
  const primerDia = new Date(anio, mes, 1);
  const offset = (primerDia.getDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const cambiarMes = (dir: number) => {
    let nm = mes + dir;
    let na = anio;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMes(nm);
    setAnio(na);
  };

  const irAHoy = () => {
    const n = new Date();
    setAnio(n.getFullYear());
    setMes(n.getMonth());
    setDiaSel(claveDia(n.getFullYear(), n.getMonth(), n.getDate()));
  };

  const handleInscribirse = async (evento: Evento) => {
    if (isGuest) {
      Alert.alert('Necesitas una cuenta', 'Regístrate para inscribirte a eventos.');
      return;
    }
    if (evento.total_inscritos >= evento.cupo_maximo) {
      Alert.alert('Cupo lleno', 'No hay lugares disponibles.');
      return;
    }
    try {
      const { data: existente } = await supabase
        .from('inscripciones')
        .select('id_inscripcion, estado')
        .eq('id_evento', evento.id_evento)
        .eq('id_usuario', usuario!.id_usuario)
        .maybeSingle();
      if (existente) {
        await supabase.from('inscripciones').update({ estado: 'confirmada' }).eq('id_inscripcion', existente.id_inscripcion);
      } else {
        await supabase.from('inscripciones').insert({ id_evento: evento.id_evento, id_usuario: usuario!.id_usuario, estado: 'confirmada' });
      }
      Alert.alert('¡Listo!', 'Te has inscrito exitosamente.');
      cargar();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCancelar = (evento: Evento) => {
    Alert.alert('Cancelar inscripción', '¿Segura que quieres cancelar?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('inscripciones').update({ estado: 'cancelada' }).eq('id_inscripcion', evento.id_inscripcion);
            setEventos(prev => prev.map(e =>
              e.id_evento === evento.id_evento
                ? { ...e, usuario_inscrito: false, id_inscripcion: undefined, total_inscritos: Math.max(0, e.total_inscritos - 1) }
                : e
            ));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const renderCelda = (dia: number | null, idx: number) => {
    if (dia === null) return <View key={`b${idx}`} style={styles.celda} />;
    const clave = claveDia(anio, mes, dia);
    const tieneEventos = !!eventosPorDia[clave]?.length;
    const esHoy = clave === claveDia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const seleccionado = clave === diaSel;
    // Punto por tipo: si hay al menos un taller -> rosa; si solo conferencias -> morado
    const soloConf = tieneEventos && eventosPorDia[clave].every(e => e.tipo_evento === 'conferencia');

    return (
      <TouchableOpacity
        key={clave}
        style={styles.celda}
        onPress={() => setDiaSel(clave)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.celdaInner,
          esHoy && styles.celdaHoy,
          seleccionado && styles.celdaSeleccionada,
        ]}>
          <Text style={[
            styles.celdaTexto,
            seleccionado && styles.celdaTextoSel,
            esHoy && !seleccionado && styles.celdaTextoHoy,
          ]}>
            {dia}
          </Text>
          {tieneEventos && (
            <View style={[
              styles.punto,
              { backgroundColor: seleccionado ? Colors.white : soloConf ? '#534AB7' : Colors.primary },
            ]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const fechaTitulo = () => {
    const [y, m, d] = diaSel.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendario</Text>
        <TouchableOpacity style={styles.hoyBtn} onPress={irAHoy}>
          <Text style={styles.hoyBtnText}>Hoy</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.primary} />
          }
        >
          {/* Navegación de mes */}
          <View style={styles.mesNav}>
            <TouchableOpacity onPress={() => cambiarMes(-1)} style={styles.mesFlecha}>
              <Feather name="chevron-left" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.mesTitulo}>{MESES[mes]} {anio}</Text>
            <TouchableOpacity onPress={() => cambiarMes(1)} style={styles.mesFlecha}>
              <Feather name="chevron-right" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Cabecera días de la semana */}
          <View style={styles.semanaRow}>
            {DIAS_SEMANA.map((d, i) => (
              <View key={i} style={styles.celda}>
                <Text style={styles.semanaTexto}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Cuadrícula */}
          <View style={styles.grid}>
            {celdas.map((d, i) => renderCelda(d, i))}
          </View>

          {/* Leyenda */}
          <View style={styles.leyenda}>
            <View style={styles.leyendaItem}>
              <View style={[styles.leyendaPunto, { backgroundColor: Colors.primary }]} />
              <Text style={styles.leyendaTexto}>Taller</Text>
            </View>
            <View style={styles.leyendaItem}>
              <View style={[styles.leyendaPunto, { backgroundColor: '#534AB7' }]} />
              <Text style={styles.leyendaTexto}>Conferencia</Text>
            </View>
          </View>

          {/* Eventos del día seleccionado */}
          <View style={styles.diaSection}>
            <Text style={styles.diaTitulo}>{fechaTitulo()}</Text>

            {eventosDelDia.length === 0 ? (
              <View style={styles.sinEventos}>
                <Feather name="calendar" size={28} color={Colors.textMuted} />
                <Text style={styles.sinEventosTexto}>No hay eventos este día</Text>
              </View>
            ) : (
              eventosDelDia.map(ev => {
                const esTaller = ev.tipo_evento === 'taller';
                const estaLleno = ev.cupo_maximo - ev.total_inscritos <= 0;
                const haVencido = fechaLocal(ev.fecha_hora_inicio) < new Date();
                return (
                  <TouchableOpacity
                    key={ev.id_evento}
                    style={styles.eventoCard}
                    activeOpacity={0.85}
                    onPress={() => setEventoDetalle(ev)}
                  >
                    <View style={[styles.eventoHora, esTaller ? styles.horaTaller : styles.horaConf]}>
                      <Text style={[styles.eventoHoraText, { color: esTaller ? Colors.primary : '#534AB7' }]}>
                        {horaDesde(ev.fecha_hora_inicio)}
                      </Text>
                    </View>
                    <View style={styles.eventoInfo}>
                      <Text style={styles.eventoTitulo} numberOfLines={1}>{ev.titulo}</Text>
                      {ev.lugar ? (
                        <Text style={styles.eventoMeta} numberOfLines={1}>
                          <Feather name="map-pin" size={11} color={Colors.textMuted} /> {ev.lugar}
                        </Text>
                      ) : null}
                      <Text style={styles.eventoMeta}>
                        {ev.duracion_horas}h · {ev.costo === 0 ? 'Gratis' : `$${ev.costo}`} · {Math.max(0, ev.cupo_maximo - ev.total_inscritos)} lugares
                      </Text>
                    </View>
                    {ev.usuario_inscrito ? (
                      <TouchableOpacity style={styles.btnInscrita} onPress={() => handleCancelar(ev)}>
                        <Feather name="check" size={13} color={Colors.primary} />
                        <Text style={styles.btnInscritaText}>Inscrita</Text>
                      </TouchableOpacity>
                    ) : haVencido ? (
                      <View style={[styles.btnInscribirse, styles.btnDisabled]}>
                        <Text style={[styles.btnInscribirseText, { color: '#9E9E9E' }]}>Finalizado</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.btnInscribirse, estaLleno && styles.btnDisabled]}
                        disabled={estaLleno}
                        onPress={() => handleInscribirse(ev)}
                      >
                        <Text style={[styles.btnInscribirseText, estaLleno && { color: '#9E9E9E' }]}>
                          {estaLleno ? 'Lleno' : 'Inscribirse'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal detalle compacto */}
      <Modal visible={!!eventoDetalle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEventoDetalle(null)}>
        {eventoDetalle && (() => {
          const ev = eventoDetalle;
          const esTaller = ev.tipo_evento === 'taller';
          const estaLleno = ev.cupo_maximo - ev.total_inscritos <= 0;
          const haVencido = fechaLocal(ev.fecha_hora_inicio) < new Date();
          const disponibles = Math.max(0, ev.cupo_maximo - ev.total_inscritos);
          const fechaLarga = fechaLocal(ev.fecha_hora_inicio).toLocaleDateString('es-MX', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          });
          return (
            <SafeAreaView style={styles.detalleContainer}>
              <View style={styles.detalleHeader}>
                <TouchableOpacity onPress={() => setEventoDetalle(null)} style={styles.detalleCerrar}>
                  <Feather name="x" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={[styles.detalleTipoBadge, esTaller ? styles.badgeTaller : styles.badgeConf]}>
                  <Text style={[styles.detalleTipoBadgeText, { color: esTaller ? Colors.primary : '#534AB7' }]}>
                    {esTaller ? 'Taller' : 'Conferencia'}
                  </Text>
                </View>
              </View>

              <ScrollView contentContainerStyle={styles.detalleBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.detalleTitulo}>{ev.titulo}</Text>

                <View style={styles.detalleInfoRow}>
                  <View style={styles.detalleInfoItem}>
                    <Feather name="clock" size={16} color={Colors.primary} />
                    <Text style={styles.detalleInfoText}>{ev.duracion_horas}h</Text>
                  </View>
                  <View style={styles.detalleInfoItem}>
                    <Feather name="dollar-sign" size={16} color={Colors.primary} />
                    <Text style={styles.detalleInfoText}>{ev.costo === 0 ? 'Gratis' : `$${ev.costo}`}</Text>
                  </View>
                  <View style={styles.detalleInfoItem}>
                    <Feather name="users" size={16} color={Colors.primary} />
                    <Text style={styles.detalleInfoText}>{disponibles} lugares</Text>
                  </View>
                </View>

                <View style={styles.detalleSeccion}>
                  <Feather name="calendar" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.detalleSeccionTexto}>{fechaLarga} · {horaDesde(ev.fecha_hora_inicio)}</Text>
                </View>

                {ev.lugar ? (
                  <View style={styles.detalleSeccion}>
                    <Feather name="map-pin" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.detalleSeccionTexto}>{ev.lugar}</Text>
                  </View>
                ) : null}

                {ev.ponente_nombre ? (
                  <View style={styles.detalleSeccion}>
                    <Feather name="user" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.detalleSeccionTexto}>{ev.ponente_nombre}</Text>
                  </View>
                ) : null}

                {ev.descripcion ? (
                  <View style={styles.detalleBloque}>
                    <Text style={styles.detalleBloqueTitle}>Descripción</Text>
                    <Text style={styles.detalleBloqueText}>{ev.descripcion}</Text>
                  </View>
                ) : null}

                {ev.temario ? (
                  <View style={styles.detalleBloque}>
                    <Text style={styles.detalleBloqueTitle}>Temario</Text>
                    {ev.temario.split('\n').filter(l => l.trim()).map((linea, i) => (
                      <View key={i} style={styles.temarioItem}>
                        <View style={styles.temarioDot} />
                        <Text style={styles.temarioLinea}>{linea.trim()}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.detalleBloque}>
                  <Text style={styles.detalleBloqueTitle}>Ocupación</Text>
                  <View style={styles.progresoBarra}>
                    <View style={[styles.progresoRelleno, { width: `${Math.min(100, (ev.total_inscritos / ev.cupo_maximo) * 100)}%` as any }]} />
                  </View>
                  <Text style={styles.progresoTexto}>{ev.total_inscritos} de {ev.cupo_maximo} inscritas</Text>
                </View>

                <View style={{ marginTop: 20 }}>
                  {ev.usuario_inscrito ? (
                    <TouchableOpacity style={styles.btnInscritoDetalle} onPress={() => handleCancelar(ev)}>
                      <Feather name="check-circle" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnInscritoDetalleText}>Inscrita — Cancelar inscripción</Text>
                    </TouchableOpacity>
                  ) : haVencido ? (
                    <View style={[styles.btnInscribirseDetalle, styles.btnDisabled]}>
                      <Feather name="clock" size={18} color="#9E9E9E" style={{ marginRight: 8 }} />
                      <Text style={[styles.btnInscribirseDetalleText, { color: '#9E9E9E' }]}>Evento finalizado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btnInscribirseDetalle, estaLleno && styles.btnDisabled]}
                      disabled={estaLleno}
                      onPress={() => handleInscribirse(ev)}
                    >
                      <Feather name="user-plus" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.btnInscribirseDetalleText}>{estaLleno ? 'Cupo lleno' : 'Inscribirse'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
          );
        })()}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  hoyBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryPale },
  hoyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  mesNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 18, marginBottom: 12 },
  mesFlecha: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  mesTitulo: { fontSize: 18, fontWeight: '800', color: Colors.text },

  semanaRow: { flexDirection: 'row', paddingHorizontal: 10 },
  semanaTexto: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginTop: 4 },
  celda: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  celdaInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  celdaHoy: { borderWidth: 1.5, borderColor: Colors.primaryBorder },
  celdaSeleccionada: { backgroundColor: Colors.primary },
  celdaTexto: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  celdaTextoSel: { color: Colors.white, fontWeight: '700' },
  celdaTextoHoy: { color: Colors.primary, fontWeight: '700' },
  punto: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

  leyenda: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10, marginBottom: 6 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { fontSize: 12, color: Colors.textSecondary },

  diaSection: { marginTop: 12, paddingHorizontal: 20, borderTopWidth: 8, borderTopColor: Colors.surface, paddingTop: 18 },
  diaTitulo: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 14, textTransform: 'capitalize' },
  sinEventos: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  sinEventosTexto: { fontSize: 14, color: Colors.textMuted },

  eventoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 14, padding: 12, marginBottom: 10, gap: 12 },
  eventoHora: { width: 54, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  horaTaller: { backgroundColor: Colors.primaryPale },
  horaConf: { backgroundColor: '#EEEDFE' },
  eventoHoraText: { fontSize: 13, fontWeight: '800' },
  eventoInfo: { flex: 1 },
  eventoTitulo: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  eventoMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  btnInscribirse: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  btnInscribirseText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  btnInscrita: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primaryPale, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  btnInscritaText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  btnDisabled: { backgroundColor: Colors.surface, borderColor: Colors.border },

  // Detalle modal
  detalleContainer: { flex: 1, backgroundColor: Colors.background },
  detalleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detalleCerrar: { padding: 4 },
  detalleTipoBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeTaller: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryPale },
  badgeConf: { borderColor: '#C7C3F5', backgroundColor: '#EEEDFE' },
  detalleTipoBadgeText: { fontSize: 13, fontWeight: '700' },
  detalleBody: { padding: 20, paddingBottom: 60 },
  detalleTitulo: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  detalleInfoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  detalleInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryPale, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  detalleInfoText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  detalleSeccion: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 12, backgroundColor: Colors.surface, borderRadius: 10 },
  detalleSeccionTexto: { fontSize: 14, color: Colors.text, flex: 1 },
  detalleBloque: { marginBottom: 20 },
  detalleBloqueTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  detalleBloqueText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  temarioItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  temarioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  temarioLinea: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  progresoBarra: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progresoRelleno: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progresoTexto: { fontSize: 12, color: Colors.textMuted },
  btnInscribirseDetalle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 25, paddingVertical: 14 },
  btnInscribirseDetalleText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  btnInscritoDetalle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primaryPale, borderRadius: 25, paddingVertical: 14, borderWidth: 1, borderColor: Colors.primaryBorder },
  btnInscritoDetalleText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
});