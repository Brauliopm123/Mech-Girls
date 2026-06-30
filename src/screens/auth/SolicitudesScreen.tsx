import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';

interface Solicitud {
  id_solicitud:        number;
  nombre:              string;
  apellidos:           string;
  correo:              string;
  semblanza:           string | null;
  especialidad:        string | null;
  empresa_institucion: string | null;
  sitio_web_url:       string | null;
  estado:              'pendiente' | 'aprobada' | 'rechazada';
  fecha_solicitud:     string;
}

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#FFF8E1', text: '#F57F17' },
  aprobada:  { bg: '#E8F5E9', text: '#2E7D32' },
  rechazada: { bg: '#FFEBEE', text: '#C62828' },
};

export default function SolicitudesScreen() {
  const navigation = useNavigation<any>();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando,    setCargando]    = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [procesando,  setProcesando]  = useState<number | null>(null);
  const [filtro,      setFiltro]      = useState<'pendiente' | 'aprobada' | 'rechazada' | 'todas'>('pendiente');

  const cargar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('solicitudes_ponente')
        .select('*')
        .order('fecha_solicitud', { ascending: false });
      if (error) throw error;
      setSolicitudes(data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function handleAprobar(s: Solicitud) {
    Alert.alert(
      'Aprobar solicitud',
      `¿Crear cuenta de ponente para ${s.nombre} ${s.apellidos}?\n\nRecibirá un correo para establecer su contraseña.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setProcesando(s.id_solicitud);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Sin sesión de admin');

              const res = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-ponente`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    correo:        s.correo,
                    nombre:        s.nombre,
                    apellidos:     s.apellidos,
                    especialidad:  s.especialidad,
                    empresa:       s.empresa_institucion,
                    semblanza:     s.semblanza,
                    sitio_web_url: s.sitio_web_url,
                    id_solicitud:  s.id_solicitud,
                  }),
                }
              );
              const result = await res.json();
              if (!res.ok) throw new Error(result.error ?? 'Error al aprobar');

              Alert.alert('¡Aprobada!', `Cuenta creada para ${s.nombre}. Se le envió un correo.`);
              cargar();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setProcesando(null);
            }
          },
        },
      ]
    );
  }

  async function handleRechazar(s: Solicitud) {
    Alert.alert(
      'Rechazar solicitud',
      `¿Rechazar la solicitud de ${s.nombre} ${s.apellidos}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcesando(s.id_solicitud);
            try {
              const { error } = await supabase
                .from('solicitudes_ponente')
                .update({ estado: 'rechazada', fecha_resolucion: new Date().toISOString() })
                .eq('id_solicitud', s.id_solicitud);
              if (error) throw error;
              cargar();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setProcesando(null);
            }
          },
        },
      ]
    );
  }

  const filtradas = filtro === 'todas'
    ? solicitudes
    : solicitudes.filter(s => s.estado === filtro);

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Solicitudes de ponente</Text>
          {pendientes > 0 && (
            <Text style={styles.pendientesBadge}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
        <View style={styles.filtrosRow}>
          {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Lista */}
      {cargando ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filtradas.length === 0 ? (
            <Text style={styles.empty}>No hay solicitudes {filtro !== 'todas' ? filtro + 's' : ''}.</Text>
          ) : (
            filtradas.map(s => {
              const estadoColor = ESTADO_COLOR[s.estado] ?? ESTADO_COLOR.pendiente;
              const isProcesando = procesando === s.id_solicitud;

              return (
                <View key={s.id_solicitud} style={styles.card}>
                  {/* Nombre + badge estado */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardNombre}>{s.nombre} {s.apellidos}</Text>
                    <View style={[styles.estadoBadge, { backgroundColor: estadoColor.bg }]}>
                      <Text style={[styles.estadoText, { color: estadoColor.text }]}>{s.estado}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardCorreo}>{s.correo}</Text>

                  {s.especialidad && (
                    <Text style={styles.cardMeta}>🔧 {s.especialidad}</Text>
                  )}
                  {s.empresa_institucion && (
                    <Text style={styles.cardMeta}>🏢 {s.empresa_institucion}</Text>
                  )}
                  {s.semblanza && (
                    <Text style={styles.cardSemblanza} numberOfLines={3}>{s.semblanza}</Text>
                  )}

                  <Text style={styles.cardFecha}>
                    Solicitado: {new Date(s.fecha_solicitud).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </Text>

                  {/* Acciones — solo para pendientes */}
                  {s.estado === 'pendiente' && (
                    <View style={styles.acciones}>
                      {isProcesando ? (
                        <ActivityIndicator color={Colors.primary} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.accionBtn, styles.accionAprobar]}
                            onPress={() => handleAprobar(s)}
                          >
                            <Text style={styles.accionAprobarText}>Aprobar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.accionBtn, styles.accionRechazar]}
                            onPress={() => handleRechazar(s)}
                          >
                            <Text style={styles.accionRechazarText}>Rechazar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { 
    flex: 1, 
    backgroundColor: Colors.background 
},
  header:           { 
    paddingTop: 60, 
    paddingHorizontal: 20, 
    paddingBottom: 12 
},
  backBtn:          { 
    marginBottom: 12 
},
  backText:         { 
    fontSize: 14, 
    color: Colors.primary, 
    fontWeight: '500' 
},
  title:            { 
    fontSize: 22, 
    fontWeight: '700', 
    color: Colors.text 
},
  pendientesBadge:  { 
    fontSize: 13, 
    color: Colors.primary, 
    fontWeight: '500', 
    marginTop: 2 
},
  filtrosScroll:    { 
    maxHeight: 48, 
    paddingLeft: 20 
},
  filtrosRow:       { 
    flexDirection: 'row', 
    gap: 8, 
    paddingRight: 20, 
    paddingVertical: 8 
},
  filtroBtn:        { 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 20, 
    borderWidth: 1.5, 
    borderColor: Colors.border, 
    backgroundColor: Colors.surface 
},
  filtroBtnActive:  { 
    borderColor: Colors.primary, 
    backgroundColor: Colors.primaryPale 
},
  filtroText:       { 
    fontSize: 13, 
    color: Colors.textSecondary, 
    fontWeight: '500' 
},
  filtroTextActive: { 
    color: Colors.primary 
},
  lista:            { 
    padding: 20, 
    gap: 12, 
    paddingBottom: 40 
},
  empty:            { 
    textAlign: 'center', 
    color: Colors.textSecondary, 
    marginTop: 40, 
    fontSize: 14 
},
  card:             { 
    backgroundColor: Colors.surface, 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: Colors.border 
},
  cardHeader:       { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
},
  cardNombre:       { 
    fontSize: 15, 
    fontWeight: '600', 
    color: Colors.text, 
    flex: 1, 
    marginRight: 8 
},
  estadoBadge:      { 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 12 
},
  estadoText:       { 
    fontSize: 12, 
    fontWeight: '600' 
},
  cardCorreo:       { 
    fontSize: 13, 
    color: Colors.textSecondary, 
    marginBottom: 6 
},
  cardMeta:         { 
    fontSize: 13, 
    color: Colors.textSecondary, 
    marginBottom: 2 
},
  cardSemblanza:    { 
    fontSize: 13, color: Colors.text, 
    marginTop: 8, 
    lineHeight: 18 
},
  cardFecha:        { 
    fontSize: 11, 
    color: Colors.textMuted, 
    marginTop: 8 
},
  acciones:         { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 14 
},
  accionBtn:        { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignItems: 'center' 
},
  accionAprobar:    { 
    backgroundColor: Colors.primary 
},
  accionAprobarText:{ 
    color: '#FFF', 
    fontWeight: '600', 
    fontSize: 14 
},
  accionRechazar:   { 
    borderWidth: 1.5, 
    borderColor: '#C62828' 
},
  accionRechazarText:{ 
    color: '#C62828', 
    fontWeight: '600', 
    fontSize: 14 
},
});