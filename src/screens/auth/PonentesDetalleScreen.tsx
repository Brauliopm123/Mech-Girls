import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';

export default function PonentesDetalleScreen({ route, navigation }: any) {
  const { ponente, color } = route.params ?? {};
  const [numPublicaciones, setNumPublicaciones] = useState<number | null>(null);

  // Contar cuántas publicaciones tiene este ponente (para mostrarlo en el botón)
  useEffect(() => {
    if (!ponente?.id_usuario) return;
    let activo = true;
    (async () => {
      const { count } = await supabase
        .from('publicaciones')
        .select('*', { count: 'exact', head: true })
        .eq('id_usuario', ponente.id_usuario);
      if (activo) setNumPublicaciones(count ?? 0);
    })();
    return () => { activo = false; };
  }, [ponente?.id_usuario]);

  if (!ponente) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.errorText}>No se encontró el perfil.</Text>
      </SafeAreaView>
    );
  }

  const initials = `${ponente.nombre?.charAt(0) ?? ''}${ponente.apellidos?.charAt(0) ?? ''}`.toUpperCase();
  const avatarColor = color ?? '#E91E63';

  const verPublicaciones = () => {
    navigation.navigate('PerfilPublico', {
      idUsuario: ponente.id_usuario,
      nombre: ponente.nombre,
      apellidos: ponente.apellidos,
      foto: ponente.foto_perfil_url ?? null,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Avatar y nombre */}
        <View style={styles.heroSection}>
          {ponente.foto_perfil_url ? (
            <Image source={{ uri: ponente.foto_perfil_url }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.nombre}>{ponente.nombre} {ponente.apellidos}</Text>
          {ponente.especialidad ? (
            <Text style={styles.especialidad}>{ponente.especialidad}</Text>
          ) : null}
          {ponente.empresa_institucion ? (
            <View style={styles.empresaRow}>
              <Feather name="briefcase" size={13} color={Colors.textMuted} style={{ marginRight: 5 }} />
              <Text style={styles.empresa}>{ponente.empresa_institucion}</Text>
            </View>
          ) : null}
        </View>

        {/* Botón: ver publicaciones de este ponente */}
        <TouchableOpacity style={styles.verPublicacionesBtn} onPress={verPublicaciones} activeOpacity={0.8}>
          <View style={styles.verPubIconWrapper}>
            <Feather name="grid" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.verPubTitulo}>Ver publicaciones</Text>
            <Text style={styles.verPubSubtitulo}>
              {numPublicaciones === null
                ? 'Cargando...'
                : numPublicaciones === 0
                  ? 'Aún no ha publicado nada'
                  : `${numPublicaciones} publicaci${numPublicaciones === 1 ? 'ón' : 'ones'}`}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Semblanza */}
        {ponente.semblanza ? (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Semblanza</Text>
            <Text style={styles.semblanzaTexto}>{ponente.semblanza}</Text>
          </View>
        ) : (
          <View style={styles.seccion}>
            <Text style={styles.sinSemblanza}>Este ponente aún no ha agregado su semblanza.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  errorText: { textAlign: 'center', marginTop: 60, color: Colors.textMuted, fontSize: 15 },
  body: { paddingBottom: 60 },
  heroSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarImg: { width: 90, height: 90, borderRadius: 45, marginBottom: 14, backgroundColor: '#F8F7FC' },
  avatarText: { fontSize: 34, fontWeight: 'bold', color: '#FFF' },
  nombre: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  especialidad: { fontSize: 14, color: '#E91E63', fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  empresaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  empresa: { fontSize: 13, color: Colors.textMuted },
  // Botón ver publicaciones
  verPublicacionesBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16, padding: 14,
    backgroundColor: Colors.primaryPale, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  verPubIconWrapper: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  verPubTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  verPubSubtitulo: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  seccion: {
    marginHorizontal: 20, marginTop: 4, padding: 18,
    backgroundColor: '#FAFAFA', borderRadius: 14,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  seccionTitulo: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  semblanzaTexto: { fontSize: 15, color: Colors.text, lineHeight: 24 },
  sinSemblanza: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 10 },
});