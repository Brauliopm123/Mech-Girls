import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

interface Conversacion {
  id_otro_usuario: number;
  nombre: string;
  apellidos: string;
  foto_url: string | null;
  ultimo_mensaje: string;
  fecha_ultimo: string;
  no_leidos: number;
}

interface UsuarioBusqueda {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  foto_url: string | null;
  rol: string;
}

function iniciales(nombre: string, apellidos: string) {
  return `${nombre?.charAt(0) ?? ''}${apellidos?.charAt(0) ?? ''}`.toUpperCase() || 'U';
}

export default function MensajesScreen() {
  const { usuario } = useAuth();
  const navigation  = useNavigation<any>();

  const [convs, setConvs]           = useState<Conversacion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [busqueda, setBusqueda]     = useState('');
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [buscando, setBuscando]     = useState(false);

  const cargarConvs = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    const { data } = await supabase.rpc('fn_mis_conversaciones', { p_id_usuario: usuario.id_usuario });
    setConvs((data as Conversacion[]) ?? []);
    setLoading(false);
  }, [usuario?.id_usuario]);

  useEffect(() => { cargarConvs(); }, [cargarConvs]);

  // Realtime: refrescar lista cuando llega mensaje nuevo
  useEffect(() => {
    if (!usuario?.id_usuario) return;
    const ch = supabase.channel(`msgs-list-${usuario.id_usuario}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `id_receptor=eq.${usuario.id_usuario}`,
      }, () => cargarConvs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [usuario?.id_usuario, cargarConvs]);

  const abrirChat = (conv: Conversacion) => {
    // Marca como leídos y navega al stack Chat (sin tab bar)
    supabase.rpc('fn_marcar_leidos', {
      p_id_emisor: conv.id_otro_usuario,
      p_id_receptor: usuario!.id_usuario,
    });
    setConvs(prev => prev.map(c =>
      c.id_otro_usuario === conv.id_otro_usuario ? { ...c, no_leidos: 0 } : c
    ));
    navigation.navigate('Chat', { conv });
  };

  const buscarUsuarios = async (q: string) => {
    setBusqueda(q);
    if (q.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const { data } = await supabase.rpc('fn_buscar_usuarios', {
      p_busqueda: q.trim(), p_excluir: usuario!.id_usuario,
    });
    setResultados((data as UsuarioBusqueda[]) ?? []);
    setBuscando(false);
  };

  const iniciarConv = (u: UsuarioBusqueda) => {
    setModalNuevo(false);
    setBusqueda('');
    setResultados([]);
    const conv: Conversacion = {
      id_otro_usuario: u.id_usuario,
      nombre: u.nombre,
      apellidos: u.apellidos,
      foto_url: u.foto_url,
      ultimo_mensaje: '',
      fecha_ultimo: '',
      no_leidos: 0,
    };
    navigation.navigate('Chat', { conv });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajes</Text>
        <TouchableOpacity onPress={() => setModalNuevo(true)} style={styles.newBtn}>
          <Feather name="edit" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={c => String(c.id_otro_usuario)}
          contentContainerStyle={styles.lista}
          onFocus={cargarConvs}
          renderItem={({ item }) => {
            const hora = item.fecha_ultimo
              ? new Date(item.fecha_ultimo).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <TouchableOpacity style={styles.convRow} onPress={() => abrirChat(item)}>
                <View style={styles.convAvatar}>
                  <Text style={styles.convAvatarText}>{iniciales(item.nombre, item.apellidos)}</Text>
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convNombre}>{item.nombre} {item.apellidos}</Text>
                    <Text style={styles.convHora}>{hora}</Text>
                  </View>
                  <View style={styles.convBottom}>
                    <Text style={styles.convUltimo} numberOfLines={1}>{item.ultimo_mensaje}</Text>
                    {item.no_leidos > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.no_leidos}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No tienes conversaciones aún</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalNuevo(true)}>
                <Text style={styles.emptyBtnText}>Iniciar conversación</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal nueva conversación */}
      <Modal visible={modalNuevo} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nueva conversación</Text>
            <TouchableOpacity onPress={() => { setModalNuevo(false); setBusqueda(''); setResultados([]); }}>
              <Feather name="x" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o correo..."
              placeholderTextColor={Colors.textMuted}
              value={busqueda}
              onChangeText={buscarUsuarios}
              autoFocus
            />
            {buscando && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>
          <FlatList
            data={resultados}
            keyExtractor={u => String(u.id_usuario)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userRow} onPress={() => iniciarConv(item)}>
                <View style={styles.convAvatar}>
                  <Text style={styles.convAvatarText}>{iniciales(item.nombre, item.apellidos)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convNombre}>{item.nombre} {item.apellidos}</Text>
                  <Text style={styles.convHora}>{item.rol}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              busqueda.length >= 2 && !buscando
                ? <Text style={[styles.emptyText, { marginTop: 20 }]}>Sin resultados para "{busqueda}"</Text>
                : null
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: Colors.text },
  newBtn:       { padding: 4 },
  loader:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista:        { paddingBottom: 100 },
  convRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  convAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  convAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  convInfo:     { flex: 1 },
  convTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convNombre:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  convHora:     { fontSize: 11, color: Colors.textMuted },
  convBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convUltimo:   { fontSize: 13, color: Colors.textSecondary, flex: 1, marginRight: 8 },
  badge:        { backgroundColor: Colors.primary, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText:    { color: '#FFF', fontSize: 11, fontWeight: '700' },
  separator:    { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
  empty:        { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText:    { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  emptyBtn:     { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primaryPale, borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryBorder },
  emptyBtnText: { color: Colors.primary, fontWeight: '700' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: Colors.text },
  searchBox:    { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput:  { flex: 1, fontSize: 15, color: Colors.text },
  userRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
});