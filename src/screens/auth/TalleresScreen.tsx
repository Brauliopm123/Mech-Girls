import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, TextInput,
  Alert, ActivityIndicator, Modal, ScrollView, RefreshControl, Animated,
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

interface PerfilPonente {
  id_perfil_ponente: number;
  nombre: string;
  apellidos: string;
  especialidad?: string;
  empresa_institucion?: string;
}

const FILTROS = ['Todos', 'taller', 'conferencia'];

// ─── Sección plegable de ponente con búsqueda en BD ──────────────────────────
interface PonenteSelectorProps {
  ponente: string;
  setPonente: (v: string) => void;
}

function PonenteSelector({ ponente, setPonente }: PonenteSelectorProps) {
  const [expandido, setExpandido] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<PerfilPonente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<PerfilPonente | null>(null);

  const buscar = async (q: string) => {
    setBusqueda(q);
    if (q.trim().length < 1) {
      // Cargar todos los ponentes si búsqueda vacía
      const { data } = await supabase.from('perfiles_ponente').select('id_perfil_ponente, nombre, apellidos, especialidad, empresa_institucion').limit(30);
      setResultados((data as PerfilPonente[]) ?? []);
      return;
    }
    setBuscando(true);
    const { data } = await supabase
      .from('perfiles_ponente')
      .select('id_perfil_ponente, nombre, apellidos, especialidad, empresa_institucion')
      .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
      .limit(20);
    setResultados((data as PerfilPonente[]) ?? []);
    setBuscando(false);
  };

  const abrir = async () => {
    if (!expandido) await buscar('');
    setExpandido(!expandido);
  };

  const seleccionar = (p: PerfilPonente) => {
    setSeleccionado(p);
    setPonente(`${p.nombre} ${p.apellidos}`);
    setExpandido(false);
  };

  const limpiar = () => {
    setSeleccionado(null);
    setPonente('');
    setBusqueda('');
    setResultados([]);
  };

  return (
    <View>
      <Text style={styles.inputLabel}>Ponente</Text>

      {/* Botón plegable */}
      <TouchableOpacity style={styles.ponenteToggle} onPress={abrir}>
        <View style={{ flex: 1 }}>
          {seleccionado ? (
            <Text style={styles.ponenteSelNombre}>{seleccionado.nombre} {seleccionado.apellidos}</Text>
          ) : ponente ? (
            <Text style={styles.ponenteSelNombre}>{ponente}</Text>
          ) : (
            <Text style={styles.ponentePlaceholder}>Buscar ponente registrado...</Text>
          )}
          {seleccionado?.especialidad && (
            <Text style={styles.ponenteSelEsp}>{seleccionado.especialidad}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {(seleccionado || ponente) && (
            <TouchableOpacity onPress={limpiar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <Feather name={expandido ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Panel expandido */}
      {expandido && (
        <View style={styles.ponentePanel}>
          <View style={styles.ponenteSearch}>
            <Feather name="search" size={14} color={Colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.ponenteSearchInput}
              placeholder="Buscar por nombre..."
              placeholderTextColor={Colors.textMuted}
              value={busqueda}
              onChangeText={buscar}
              autoFocus
            />
            {buscando && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          {resultados.length === 0 ? (
            <View style={styles.ponenteEmpty}>
              <Text style={styles.ponenteEmptyText}>
                {busqueda ? 'Sin resultados' : 'No hay ponentes registrados'}
              </Text>
            </View>
          ) : (
            resultados.map(p => (
              <TouchableOpacity key={p.id_perfil_ponente} style={styles.ponenteItem} onPress={() => seleccionar(p)}>
                <View style={styles.ponenteAvatar}>
                  <Text style={styles.ponenteAvatarText}>
                    {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ponenteNombre}>{p.nombre} {p.apellidos}</Text>
                  {p.especialidad && <Text style={styles.ponenteEsp}>{p.especialidad}</Text>}
                </View>
                <Feather name="check" size={16} color={Colors.primary} style={{ opacity: 0 }} />
              </TouchableOpacity>
            ))
          )}

          {/* También permite escribir manualmente */}
          <View style={styles.ponenteManual}>
            <Text style={styles.ponenteManualLabel}>O escribe manualmente:</Text>
            <TextInput
              style={styles.textInput}
              value={ponente}
              onChangeText={v => { setPonente(v); setSeleccionado(null); }}
              placeholder="Nombre del ponente"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Formulario EXTERNO (evita bug del teclado) ───────────────────────────────
interface FormProps {
  titulo: string; setTitulo: (v: string) => void;
  descripcion: string; setDescripcion: (v: string) => void;
  temario: string; setTemario: (v: string) => void;
  ponente: string; setPonente: (v: string) => void;
  tipo: 'taller' | 'conferencia'; setTipo: (v: 'taller' | 'conferencia') => void;
  horas: string; setHoras: (v: string) => void;
  costo: string; setCosto: (v: string) => void;
  cupo: string; setCupo: (v: string) => void;
  lugar: string; setLugar: (v: string) => void;
  fecha: string; setFecha: (v: string) => void;
  guardando: boolean;
  onGuardar: () => void;
}

function FormularioEvento({
  titulo, setTitulo, descripcion, setDescripcion,
  temario, setTemario, ponente, setPonente,
  tipo, setTipo, horas, setHoras, costo, setCosto,
  cupo, setCupo, lugar, setLugar, fecha, setFecha,
  guardando, onGuardar,
}: FormProps) {
  return (
    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.inputLabel}>Título *</Text>
      <TextInput style={styles.textInput} value={titulo} onChangeText={setTitulo} placeholder="Nombre del evento" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.inputLabel}>Descripción</Text>
      <TextInput style={[styles.textInput, styles.textArea]} value={descripcion} onChangeText={setDescripcion} placeholder="Descripción del contenido..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />

      <Text style={styles.inputLabel}>Temario</Text>
      <TextInput style={[styles.textInput, styles.textAreaTall]} value={temario} onChangeText={setTemario} placeholder="Temas a cubrir en el evento..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={4} />

      {/* Selector plegable de ponente */}
      <PonenteSelector ponente={ponente} setPonente={setPonente} />

      <Text style={styles.inputLabel}>Tipo</Text>
      <View style={styles.tipoRow}>
        {(['taller', 'conferencia'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tipoBtn, tipo === t && styles.tipoBtnActivo]} onPress={() => setTipo(t)}>
            <Text style={[styles.tipoBtnText, tipo === t && styles.tipoBtnTextActivo]}>{t === 'taller' ? 'Taller' : 'Conferencia'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.rowInputs}>
        <View style={styles.halfInput}>
          <Text style={styles.inputLabel}>Horas *</Text>
          <TextInput style={styles.textInput} value={horas} onChangeText={setHoras} placeholder="ej. 8" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.inputLabel}>Costo ($)</Text>
          <TextInput style={styles.textInput} value={costo} onChangeText={setCosto} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </View>
      </View>

      <Text style={styles.inputLabel}>Cupo máximo *</Text>
      <TextInput style={styles.textInput} value={cupo} onChangeText={setCupo} placeholder="ej. 20" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />

      <Text style={styles.inputLabel}>Lugar</Text>
      <TextInput style={styles.textInput} value={lugar} onChangeText={setLugar} placeholder="Lab 1 o enlace virtual" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.inputLabel}>Fecha y hora * (YYYY-MM-DD HH:MM)</Text>
      <TextInput style={styles.textInput} value={fecha} onChangeText={setFecha} placeholder="2025-06-15 10:00" placeholderTextColor={Colors.textMuted} />

      <TouchableOpacity style={[styles.btnGuardar, guardando && styles.btnDisabled]} onPress={onGuardar} disabled={guardando}>
        {guardando ? <ActivityIndicator color={Colors.white} /> : <><Feather name="save" size={18} color={Colors.white} /><Text style={styles.btnGuardarText}>  Guardar</Text></>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Modal detalle del taller ─────────────────────────────────────────────────
function DetalleEvento({ evento, onCerrar, onInscribirse, onCancelar, usuario }: {
  evento: Evento; onCerrar: () => void;
  onInscribirse: (e: Evento) => void; onCancelar: (e: Evento) => void;
  usuario: any;
}) {
  const esTaller = evento.tipo_evento === 'taller';
  const estaLleno = evento.cupo_maximo - evento.total_inscritos <= 0;
  const haVencido = new Date(evento.fecha_hora_inicio) < new Date();
  const fecha = new Date(evento.fecha_hora_inicio).toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const disponibles = Math.max(0, evento.cupo_maximo - evento.total_inscritos);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.detalleContainer}>
        <View style={styles.detalleHeader}>
          <TouchableOpacity onPress={onCerrar} style={styles.detalleCerrar}>
            <Feather name="x" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={[styles.detalleTipoBadge, esTaller ? styles.badgeTaller : styles.badgeConf]}>
            <Text style={[styles.detalleTipoBadgeText, esTaller ? { color: Colors.primary } : { color: '#534AB7' }]}>
              {esTaller ? 'Taller' : 'Conferencia'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.detalleBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.detalleTitulo}>{evento.titulo}</Text>

          {/* Info rápida */}
          <View style={styles.detalleInfoRow}>
            <View style={styles.detalleInfoItem}>
              <Feather name="clock" size={16} color={Colors.primary} />
              <Text style={styles.detalleInfoText}>{evento.duracion_horas}h</Text>
            </View>
            <View style={styles.detalleInfoItem}>
              <Feather name="dollar-sign" size={16} color={Colors.primary} />
              <Text style={styles.detalleInfoText}>{evento.costo === 0 ? 'Gratis' : `$${evento.costo}`}</Text>
            </View>
            <View style={styles.detalleInfoItem}>
              <Feather name="users" size={16} color={Colors.primary} />
              <Text style={styles.detalleInfoText}>{disponibles} lugares</Text>
            </View>
          </View>

          {/* Fecha */}
          <View style={styles.detalleSeccion}>
            <Feather name="calendar" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.detalleSeccionTexto}>{fecha}</Text>
          </View>

          {/* Lugar */}
          {evento.lugar && (
            <View style={styles.detalleSeccion}>
              <Feather name="map-pin" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.detalleSeccionTexto}>{evento.lugar}</Text>
            </View>
          )}

          {/* Ponente */}
          {evento.ponente_nombre && (
            <View style={styles.detallePonente}>
              <View style={styles.ponenteAvatar}>
                <Text style={styles.ponenteAvatarText}>
                  {evento.ponente_nombre.charAt(0)}{evento.ponente_nombre.split(' ')[1]?.charAt(0) ?? ''}
                </Text>
              </View>
              <View>
                <Text style={styles.detallePonenteTitulo}>Ponente</Text>
                <Text style={styles.detallePonenteName}>{evento.ponente_nombre}</Text>
              </View>
            </View>
          )}

          {/* Descripción */}
          {evento.descripcion && (
            <View style={styles.detalleBloque}>
              <Text style={styles.detalleBloqueTitle}>Descripción</Text>
              <Text style={styles.detalleBloqueText}>{evento.descripcion}</Text>
            </View>
          )}

          {/* Temario */}
          {evento.temario && (
            <View style={styles.detalleBloque}>
              <Text style={styles.detalleBloqueTitle}>Temario</Text>
              {evento.temario.split('\n').filter(l => l.trim()).map((linea, i) => (
                <View key={i} style={styles.temarioItem}>
                  <View style={styles.temarioDot} />
                  <Text style={styles.temarioLinea}>{linea.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Barra de ocupación */}
          <View style={styles.detalleBloque}>
            <Text style={styles.detalleBloqueTitle}>Ocupación</Text>
            <View style={styles.progresoBarra}>
              <View style={[styles.progresoRelleno, { width: `${Math.min(100, (evento.total_inscritos / evento.cupo_maximo) * 100)}%` as any }]} />
            </View>
            <Text style={styles.progresoTexto}>{evento.total_inscritos} de {evento.cupo_maximo} inscritas</Text>
          </View>

          {/* Botón acción */}
          <View style={styles.detalleBotones}>
            {evento.usuario_inscrito ? (
              <TouchableOpacity style={styles.btnInscritoDetalle} onPress={() => { onCancelar(evento); onCerrar(); }}>
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
                onPress={() => { onInscribirse(evento); onCerrar(); }}
              >
                <Feather name="user-plus" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.btnInscribirseDetalleText}>{estaLleno ? 'Cupo lleno' : 'Inscribirse'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
// Convierte "2026-06-15 10:00" a "2026-06-15T10:00:00" sin aplicar offset UTC.
// new Date("2026-06-15 10:00") en Hermes/Android se interpreta como UTC → desplaza la hora.
function parseFechaLocal(fechaStr: string): string {
  const s = fechaStr.trim().replace(' ', 'T');
  const [datePart, timePart] = s.split('T');
  const [hh, mm] = (timePart ?? '00:00').split(':');
  const [yyyy, mo, dd] = datePart.split('-');
  return `${yyyy}-${mo}-${dd}T${(hh ?? '00').padStart(2,'0')}:${(mm ?? '00').padStart(2,'0')}:00`;
}

export default function TalleresScreen({navigation}: any) {
  const { usuario, esAdmin } = useAuth();
  const isGuest = useAuthStore(s => s.esInvitado)();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtrados, setFiltrados] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [eventoDetalle, setEventoDetalle] = useState<Evento | null>(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [temario, setTemario] = useState('');
  const [ponente, setPonente] = useState('');
  const [tipo, setTipo] = useState<'taller' | 'conferencia'>('taller');
  const [horas, setHoras] = useState('');
  const [costo, setCosto] = useState('0');
  const [cupo, setCupo] = useState('');
  const [lugar, setLugar] = useState('');
  const [fecha, setFecha] = useState('');

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    let result = eventos;
    if (filtro !== 'Todos') result = result.filter(e => e.tipo_evento === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(e =>
        e.titulo.toLowerCase().includes(q) ||
        (e.descripcion ?? '').toLowerCase().includes(q) ||
        (e.ponente_nombre ?? '').toLowerCase().includes(q)
      );
    }
    setFiltrados(result);
  }, [busqueda, filtro, eventos]);

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
        const miInscripcion = (e.inscripciones_usuario ?? []).find((i: any) => i.id_usuario === usuario?.id_usuario && i.estado !== 'cancelada');
        return {
          ...e,
          total_inscritos: e.total_inscritos?.[0]?.count ?? 0,
          usuario_inscrito: !!miInscripcion,
          id_inscripcion: miInscripcion?.id_inscripcion ?? null,
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

  const disponibles = filtrados.filter(e => e.cupo_maximo - e.total_inscritos > 0).length;
  const inscritas = eventos.filter(e => e.usuario_inscrito).length;
  const horasCursadas = eventos.filter(e => e.usuario_inscrito).reduce((a, e) => a + e.duracion_horas, 0);

  const handleInscribirse = async (evento: Evento) => {
    if (isGuest) {
      Alert.alert('Necesitas una cuenta', 'Regístrate para inscribirte a eventos.');
      return;
    }
    if (evento.total_inscritos >= evento.cupo_maximo) { Alert.alert('Cupo lleno', 'No hay lugares.'); return; }
    try {
      const { data: existente } = await supabase.from('inscripciones').select('id_inscripcion, estado').eq('id_evento', evento.id_evento).eq('id_usuario', usuario!.id_usuario).maybeSingle();
      if (existente) {
        await supabase.from('inscripciones').update({ estado: 'confirmada' }).eq('id_inscripcion', existente.id_inscripcion);
      } else {
        await supabase.from('inscripciones').insert({ id_evento: evento.id_evento, id_usuario: usuario!.id_usuario, estado: 'confirmada' });
      }
      Alert.alert('¡Listo!', 'Te has inscrito exitosamente.');
      cargar();
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleCancelar = (evento: Evento) => {
    Alert.alert('Cancelar inscripción', '¿Segura?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('inscripciones').update({ estado: 'cancelada' }).eq('id_inscripcion', evento.id_inscripcion);
          setEventos(prev => prev.map(e => e.id_evento === evento.id_evento ? { ...e, usuario_inscrito: false, id_inscripcion: undefined, total_inscritos: Math.max(0, e.total_inscritos - 1) } : e));
        } catch (err: any) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  const resetForm = () => { setTitulo(''); setDescripcion(''); setTemario(''); setPonente(''); setTipo('taller'); setHoras(''); setCosto('0'); setCupo(''); setLugar(''); setFecha(''); };

  const handleCrear = async () => {
    if (!titulo.trim() || !horas || !cupo || !fecha) { Alert.alert('Campos requeridos', 'Título, horas, cupo y fecha son obligatorios.'); return; }
    setGuardando(true);
    try {
      await supabase.from('eventos').insert({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, temario: temario.trim() || null, nombre_ponente: ponente.trim() || null, tipo_evento: tipo, duracion_horas: parseFloat(horas), costo: parseFloat(costo) || 0, cupo_maximo: parseInt(cupo), lugar: lugar.trim() || null, fecha_hora_inicio: parseFechaLocal(fecha) });
      Alert.alert('¡Creado!', 'Evento registrado.'); setModalCrear(false); resetForm(); cargar();
    } catch (err: any) { Alert.alert('Error', err.message); }
    setGuardando(false);
  };

  const abrirEditar = (evento: Evento) => {
    setEventoEditando(evento); setTitulo(evento.titulo); setDescripcion(evento.descripcion ?? ''); setTemario(evento.temario ?? ''); setPonente(evento.ponente_nombre ?? ''); setTipo(evento.tipo_evento as any); setHoras(String(evento.duracion_horas)); setCosto(String(evento.costo)); setCupo(String(evento.cupo_maximo)); setLugar(evento.lugar ?? '');
    try { const d = new Date(evento.fecha_hora_inicio); const pad = (n: number) => String(n).padStart(2, '0'); setFecha(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`); } catch { setFecha(''); }
    setModalEditar(true);
  };

  const handleEditar = async () => {
    if (!eventoEditando || !titulo.trim() || !horas || !cupo || !fecha) { Alert.alert('Campos requeridos'); return; }
    setGuardando(true);
    try {
      await supabase.from('eventos').update({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, temario: temario.trim() || null, nombre_ponente: ponente.trim() || null, tipo_evento: tipo, duracion_horas: parseFloat(horas), costo: parseFloat(costo) || 0, cupo_maximo: parseInt(cupo), lugar: lugar.trim() || null, fecha_hora_inicio: parseFechaLocal(fecha) }).eq('id_evento', eventoEditando.id_evento);
      Alert.alert('¡Actualizado!'); setModalEditar(false); setEventoEditando(null); resetForm(); cargar();
    } catch (err: any) { Alert.alert('Error', err.message); }
    setGuardando(false);
  };

  const puedeEditar = esAdmin && esAdmin();

  const renderEvento = ({ item }: { item: Evento }) => {
    const estaLleno = item.cupo_maximo - item.total_inscritos <= 0;
    const haVencido = new Date(item.fecha_hora_inicio) < new Date();
    const esTaller = item.tipo_evento === 'taller';
    return (
      <TouchableOpacity style={styles.card} onPress={() => setEventoDetalle(item)} activeOpacity={0.85}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, esTaller ? styles.iconTaller : styles.iconConf]}>
            <Feather name={esTaller ? 'tool' : 'mic'} size={20} color={esTaller ? Colors.primary : '#534AB7'} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
              {puedeEditar && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); abrirEditar(item); }} style={styles.editBtn}>
                  <Feather name="edit-2" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {item.descripcion ? <Text style={styles.cardDesc} numberOfLines={1}>{item.descripcion}</Text> : null}
            {item.ponente_nombre ? <Text style={styles.cardPonente}><Feather name="user" size={11} color={Colors.textMuted} /> {item.ponente_nombre}</Text> : null}
            <View style={styles.badgesRow}>
              <View style={styles.badgeHoras}><Text style={styles.badgeHorasText}>{item.duracion_horas}h</Text></View>
              <View style={styles.badgeCosto}><Text style={styles.badgeCostoText}>{item.costo === 0 ? 'Gratis' : `$${item.costo}`}</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardTapHint}>Ver detalles →</Text>
          {item.usuario_inscrito ? (
            <TouchableOpacity style={styles.btnInscrito} onPress={(e) => { e.stopPropagation?.(); handleCancelar(item); }}>
              <Text style={styles.btnInscritoText}>Inscrita</Text>
            </TouchableOpacity>
          ) : haVencido ? (
            <View style={[styles.btnInscribirse, styles.btnDisabled]}>
              <Text style={[styles.btnInscribirseText, { color: '#9E9E9E' }]}>Finalizado</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.btnInscribirse, estaLleno && styles.btnDisabled]} disabled={estaLleno} onPress={(e) => { e.stopPropagation?.(); handleInscribirse(item); }}>
              <Text style={styles.btnInscribirseText}>{estaLleno ? 'Cupo lleno' : 'Inscribirse'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const formProps: FormProps = { titulo, setTitulo, descripcion, setDescripcion, temario, setTemario, ponente, setPonente, tipo, setTipo, horas, setHoras, costo, setCosto, cupo, setCupo, lugar, setLugar, fecha, setFecha, guardando, onGuardar: modalEditar ? handleEditar : handleCrear };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Talleres</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.btnPonentes} onPress={() => navigation.navigate('Ponentes')}>
            <Feather name="users" size={14} color={Colors.primary} />
            <Text style={styles.btnPonentesText}>Ponentes</Text>
          </TouchableOpacity>
          {esAdmin && esAdmin() && (
            <TouchableOpacity style={styles.btnNuevo} onPress={() => { resetForm(); setModalCrear(true); }}>
              <Text style={styles.btnNuevoText}>+ Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{disponibles}</Text><Text style={styles.statLabel}>Disponibles</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{inscritas}</Text><Text style={styles.statLabel}>Inscritas</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{horasCursadas}h</Text><Text style={styles.statLabel}>Cursadas</Text></View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Buscar taller o ponente..." value={busqueda} onChangeText={setBusqueda} placeholderTextColor={Colors.textMuted} />
        {busqueda.length > 0 && <TouchableOpacity onPress={() => setBusqueda('')}><Feather name="x" size={16} color={Colors.textMuted} /></TouchableOpacity>}
      </View>

      <View style={styles.filtrosRow}>
        {FILTROS.map(f => (
          <TouchableOpacity key={f} style={[styles.filtroPill, filtro === f && styles.filtroPillActivo]} onPress={() => setFiltro(f)}>
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActivo]}>{f === 'Todos' ? 'Todos' : f === 'taller' ? 'Talleres' : 'Conferencias'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} /> : (
        <FlatList
          data={filtrados}
          keyExtractor={i => String(i.id_evento)}
          renderItem={renderEvento}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{busqueda ? 'Sin resultados.' : 'No hay eventos disponibles.'}</Text>}
        />
      )}

      {/* Detalle */}
      {eventoDetalle && (
        <DetalleEvento
          evento={eventoDetalle}
          onCerrar={() => setEventoDetalle(null)}
          onInscribirse={handleInscribirse}
          onCancelar={handleCancelar}
          usuario={usuario}
        />
      )}

      {/* Modal CREAR */}
      <Modal visible={modalCrear} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Nuevo evento</Text><TouchableOpacity onPress={() => { setModalCrear(false); resetForm(); }}><Feather name="x" size={24} color={Colors.text} /></TouchableOpacity></View>
          <FormularioEvento {...formProps} onGuardar={handleCrear} />
        </SafeAreaView>
      </Modal>

      {/* Modal EDITAR */}
      <Modal visible={modalEditar} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Editar evento</Text><TouchableOpacity onPress={() => { setModalEditar(false); setEventoEditando(null); resetForm(); }}><Feather name="x" size={24} color={Colors.text} /></TouchableOpacity></View>
          <FormularioEvento {...formProps} onGuardar={handleEditar} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 
    Colors.background 
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  btnPonentes: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  btnPonentesText: { color: Colors.primary, fontWeight: '600', fontSize: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  btnNuevo: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryBorder },
  btnNuevoText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border, paddingHorizontal: 14, marginBottom: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  filtrosRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  filtroPillActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  filtroText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  filtroTextActivo: { color: Colors.primary, fontWeight: '600' },
  lista: { paddingHorizontal: 20, paddingBottom: 100 },
  loader: { marginTop: 60 },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconTaller: { backgroundColor: Colors.primaryPale },
  iconConf: { backgroundColor: '#EEEDFE' },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  editBtn: { padding: 4, marginLeft: 8 },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  cardPonente: { fontSize: 11, color: Colors.textMuted, marginBottom: 6 },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  badgeHoras: { backgroundColor: Colors.primaryPale, borderWidth: 0.5, borderColor: Colors.primaryBorder, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeHorasText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  badgeCosto: { backgroundColor: Colors.warningPale, borderWidth: 0.5, borderColor: '#FAC775', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeCostoText: { fontSize: 12, fontWeight: '600', color: Colors.warning },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardTapHint: { fontSize: 11, color: Colors.textMuted },
  btnInscribirse: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  btnInscribirseText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  btnInscrito: { backgroundColor: Colors.primaryPale, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  btnInscritoText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  btnDisabled: { backgroundColor: Colors.surface, borderColor: Colors.border },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20, paddingBottom: 60 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  textInput: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 0.5, borderColor: Colors.border },
  textArea: { height: 80, textAlignVertical: 'top' },
  textAreaTall: { height: 100, textAlignVertical: 'top' },
  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  tipoBtnActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  tipoBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tipoBtnTextActivo: { color: Colors.primary },
  rowInputs: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  btnGuardar: { marginTop: 24, backgroundColor: Colors.primary, borderRadius: 25, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnGuardarText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  // Ponente selector
  ponenteToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  ponentePlaceholder: { fontSize: 14, color: Colors.textMuted },
  ponenteSelNombre: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  ponenteSelEsp: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  ponentePanel: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  ponenteSearch: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ponenteSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  ponenteItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 10 },
  ponenteAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryPale, justifyContent: 'center', alignItems: 'center' },
  ponenteAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  ponenteNombre: { fontSize: 14, fontWeight: '600', color: Colors.text },
  ponenteEsp: { fontSize: 12, color: Colors.textSecondary },
  ponenteEmpty: { padding: 20, alignItems: 'center' },
  ponenteEmptyText: { color: Colors.textMuted, fontSize: 13 },
  ponenteManual: { padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  ponenteManualLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 6 },
  // Detalle
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
  detallePonente: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 16 },
  detallePonenteTitulo: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  detallePonenteName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  detalleBloque: { marginBottom: 20 },
  detalleBloqueTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  detalleBloqueText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  temarioItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  temarioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  temarioLinea: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  progresoBarra: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progresoRelleno: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progresoTexto: { fontSize: 12, color: Colors.textMuted },
  detalleBotones: { marginTop: 24 },
  btnInscribirseDetalle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 25, paddingVertical: 14 },
  btnInscribirseDetalleText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  btnInscritoDetalle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primaryPale, borderRadius: 25, paddingVertical: 14, borderWidth: 1, borderColor: Colors.primaryBorder },
  btnInscritoDetalleText: { 
    color: Colors.primary, 
    fontWeight: '700', 
    fontSize: 15 
  },
});