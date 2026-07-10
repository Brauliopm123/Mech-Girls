import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, Alert, Share, ActivityIndicator,
  RefreshControl, Modal, TextInput, ScrollView, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import * as WebBrowser from 'expo-web-browser';

interface ArchivoAdjunto {
  id: number;
  url: string;
  tipo: 'imagen' | 'archivo';
  nombre: string | null;
}

interface PostItem {
  id: number;
  content: string;
  tag: string;
  created_at: string;
  url_referencia: string | null;
  link_url: string | null;
  archivos: ArchivoAdjunto[];
  likes: number;
  comments: number;
  usuario_dio_like: boolean;
}

interface ConstanciaItem {
  id_inscripcion: number;
  id_evento: number;
  titulo: string;
  fecha_hora_inicio: string;
}

export default function PerfilScreen({ navigation }: any) {
  const { esInvitado, logout: logoutInvitado } = useAuth();

  if (esInvitado && esInvitado()) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>👋</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 8, textAlign: 'center' }}>
          ¡Únete a Mech Girls!
        </Text>
        <Text style={{ fontSize: 14, color: '#6B6B80', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          Crea una cuenta para publicar proyectos, inscribirte a talleres, enviar mensajes y mucho más.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#E91E63', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 12, width: '100%', alignItems: 'center' }}
          onPress={async () => {
            // Salir del modo invitada -> AppNavigator muestra AuthNavigator.
            // Pasamos intención de ir a Register vía deep link interno.
            await logoutInvitado();
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Crear cuenta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ borderWidth: 1.5, borderColor: '#E91E63', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center' }}
          onPress={async () => {
            // Salir del modo invitada -> AppNavigator muestra AuthNavigator (Login)
            await logoutInvitado();
          }}
        >
          <Text style={{ color: '#E91E63', fontWeight: '700', fontSize: 16 }}>Iniciar sesión</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  const [activeTab, setActiveTab] = useState('Publicaciones');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ publicaciones: 0, talleres: 0 });
  const [modalEditar, setModalEditar] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [apellidosEdit, setApellidosEdit] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [constancias, setConstancias] = useState<ConstanciaItem[]>([]);

  const { usuario, logout, esAlumna, esPonente } = useAuth();

  const getInitials = (name?: string, lastName?: string) => {
    const first = name ? name.charAt(0).toUpperCase() : 'M';
    const last = lastName ? lastName.charAt(0).toUpperCase() : 'G';
    return `${first}${last}`;
  };

  const fullName = usuario ? `${usuario.nombre ?? ''} ${usuario.apellidos ?? ''}`.trim() : '';
  const initials = getInitials(usuario?.nombre, usuario?.apellidos);
  const roleText = esPonente?.() ? 'Ponente' : 'Alumna — Ingeniería Mecatrónica';

  const cargar = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    try {
      // Publicaciones propias con likes y comentarios reales
      const { data: pubData } = await supabase
        .from('vw_feed_publicaciones')
        .select('*')
        .eq('id_usuario', usuario.id_usuario)
        .order('created_at', { ascending: false });

      const postsConLike = await Promise.all((pubData ?? []).map(async (p: any) => {
        const { data: likeData } = await supabase
          .from('likes_publicacion')
          .select('id_usuario')
          .eq('id_publicacion', p.id)
          .eq('id_usuario', usuario.id_usuario)
          .maybeSingle();
        return { ...p, usuario_dio_like: !!likeData };
      }));
      setPosts(postsConLike);

      // Talleres inscritos
      const { count: talleres } = await supabase
        .from('inscripciones')
        .select('*', { count: 'exact', head: true })
        .eq('id_usuario', usuario.id_usuario)
        .neq('estado', 'cancelada');

      setStats({
        publicaciones: pubData?.length ?? 0,
        talleres: talleres ?? 0,
      });
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuario?.id_usuario]);

  // Constancias: inscripciones confirmadas de eventos ya finalizados.
  // El PDF se genera on-demand en la web PHP; aquí solo se visualiza.
  const cargarConstancias = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    const { data, error } = await supabase
      .from('inscripciones')
      .select('id_inscripcion, id_evento, estado, eventos(titulo, fecha_hora_inicio)')
      .eq('id_usuario', usuario.id_usuario)
      .eq('estado', 'confirmada');

    if (error) return;

    const ahora = new Date();
    const finalizados = (data ?? [])
      .filter((i: any) => i.eventos && new Date(i.eventos.fecha_hora_inicio) < ahora)
      .map((i: any) => ({
        id_inscripcion: i.id_inscripcion,
        id_evento: i.id_evento,
        titulo: i.eventos.titulo,
        fecha_hora_inicio: i.eventos.fecha_hora_inicio,
      }));

    setConstancias(finalizados);
  }, [usuario?.id_usuario]);

  const verConstancia = (item: ConstanciaItem) => {
    // TODO: reemplazar TU-DOMINIO y el patrón por el endpoint real del compañero (web PHP)
    const url = `https://TU-DOMINIO/constancia.php?id_inscripcion=${item.id_inscripcion}`;
    WebBrowser.openBrowserAsync(url);
  };

  useEffect(() => { cargar(); cargarConstancias(); }, [cargar, cargarConstancias]);

  const handleLike = async (post: PostItem) => {
    const nuevoEstado = !post.usuario_dio_like;
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, usuario_dio_like: nuevoEstado, likes: p.likes + (nuevoEstado ? 1 : -1) }
        : p
    ));
    try {
      if (nuevoEstado) {
        await supabase.from('likes_publicacion').insert({ id_publicacion: post.id, id_usuario: usuario!.id_usuario });
      } else {
        await supabase.from('likes_publicacion').delete()
          .eq('id_publicacion', post.id).eq('id_usuario', usuario!.id_usuario);
      }
    } catch { cargar(); }
  };

  const handleCompartir = async () => {
    try {
      await Share.share({
        message: `¡Conoce el perfil de ${fullName} en Mech Girls — Mujeres Mecatrónicas!`,
        title: 'Mech Girls',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleGuardarPerfil = async () => {
    if (!nombreEdit.trim() || !apellidosEdit.trim()) {
      Alert.alert('Error', 'Nombre y apellidos son requeridos.');
      return;
    }
    setGuardando(true);
    try {
      const tabla = esPonente?.() ? 'perfiles_ponente' : 'perfiles_alumna';
      const { error } = await supabase
        .from(tabla)
        .update({ nombre: nombreEdit.trim(), apellidos: apellidosEdit.trim() })
        .eq('id_usuario', usuario!.id_usuario);
      if (error) throw error;
      Alert.alert('¡Guardado!', 'Tu perfil fue actualizado.');
      setModalEditar(false);
      cargar();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás segura de que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const abrirUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      console.log('No se pudo abrir la URL:', url);
    }
  };

  const nombreArchivoDesdeUrl = (url: string) => {
    try {
      const parte = url.split('/').pop() ?? 'archivo';
      return decodeURIComponent(parte.split('?')[0]);
    } catch {
      return 'archivo';
    }
  };

  const formatearLink = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const renderPost = ({ item }: { item: PostItem }) => (
    <View style={styles.card}>
      <View style={styles.postHeader}>
        <View style={styles.smallAvatar}>
          <Text style={styles.smallAvatarText}>{initials}</Text>
        </View>
        <View style={styles.postHeaderText}>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.postDate}>
            {new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>

      {item.archivos?.filter(a => a.tipo === 'imagen').map(img => (
        <Image key={img.id} source={{ uri: img.url }} style={styles.postImage} resizeMode="cover" />
      ))}

      {item.archivos?.filter(a => a.tipo === 'archivo').map(arch => (
        <TouchableOpacity
          key={arch.id}
          style={styles.fileCard}
          onPress={() => abrirUrl(arch.url)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconWrapper}>
            <Feather name="file-text" size={18} color="#1976D2" />
          </View>
          <Text style={styles.fileCardText} numberOfLines={1}>
            {arch.nombre || nombreArchivoDesdeUrl(arch.url)}
          </Text>
          <Feather name="download" size={16} color="#9E9E9E" />
        </TouchableOpacity>
      ))}

      {item.link_url && (
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => abrirUrl(item.link_url!)}
          activeOpacity={0.7}
        >
          <View style={styles.linkIconWrapper}>
            <Feather name="link" size={18} color="#388E3C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkCardHost} numberOfLines={1}>{formatearLink(item.link_url)}</Text>
            <Text style={styles.linkCardUrl} numberOfLines={1}>{item.link_url}</Text>
          </View>
          <Feather name="external-link" size={16} color="#9E9E9E" />
        </TouchableOpacity>
      )}

      {!item.archivos?.length && !item.link_url && item.url_referencia && (
        <Image source={{ uri: item.url_referencia }} style={styles.postImage} resizeMode="cover" />
      )}
      <View style={styles.postFooter}>
        <View style={styles.interactionGroup}>
          <TouchableOpacity style={styles.interactionRow} onPress={() => handleLike(item)}>
            <Feather name="heart" size={16} color={item.usuario_dio_like ? '#E91E63' : '#9E9E9E'} />
            <Text style={styles.interactionText}>{item.likes}</Text>
          </TouchableOpacity>
          <View style={styles.interactionRow}>
            <Feather name="message-circle" size={16} color="#757575" />
            <Text style={styles.interactionText}>{item.comments}</Text>
          </View>
        </View>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
      </View>
    </View>
  );

  const ProfileHeader = () => (
    <View>
      <View style={styles.profileInfoSection}>
        <View style={styles.largeAvatar}>
          <Text style={styles.largeAvatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{fullName || 'Mi perfil'}</Text>
        <Text style={styles.profileRole}>{roleText}</Text>
        <Text style={styles.profileEmail}>{usuario?.correo}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.publicaciones}</Text>
          <Text style={styles.statLabel}>Publicaciones</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.talleres}</Text>
          <Text style={styles.statLabel}>Talleres</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {posts.reduce((acc, p) => acc + p.likes, 0)}
          </Text>
          <Text style={styles.statLabel}>Likes totales</Text>
        </View>
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setNombreEdit(usuario?.nombre ?? '');
            setApellidosEdit(usuario?.apellidos ?? '');
            setModalEditar(true);
          }}
        >
          <Feather name="edit-2" size={14} color="#E91E63" style={{ marginRight: 6 }} />
          <Text style={styles.actionButtonText}>Editar perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleCompartir}>
          <Feather name="share" size={14} color="#E91E63" style={{ marginRight: 6 }} />
          <Text style={styles.actionButtonText}>Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
          <Feather name="log-out" size={14} color="#D32F2F" style={{ marginRight: 6 }} />
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Sección: Mis constancias — solo aparece si hay constancias disponibles */}
      {constancias.length > 0 && (
        <View style={styles.constanciasSection}>
          <TouchableOpacity
            style={styles.constanciasLink}
            onPress={() => navigation.navigate('Constancias')}
            activeOpacity={0.7}
          >
            <View style={styles.constanciaIconWrapper}>
              <Feather name="award" size={18} color="#E91E63" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.constanciaTitulo}>Mis constancias</Text>
              <Text style={styles.constanciaFecha}>{constancias.length} disponible{constancias.length !== 1 ? 's' : ''}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9E9E9E" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Publicaciones' && styles.activeTab]}
          onPress={() => setActiveTab('Publicaciones')}
        >
          <Text style={[styles.tabText, activeTab === 'Publicaciones' && styles.activeTabText]}>
            Mis publicaciones
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MECH GIRLS</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E91E63" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => String(item.id)}
          renderItem={renderPost}
          ListHeaderComponent={ProfileHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); cargarConstancias(); }} tintColor="#E91E63" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aún no has publicado nada.</Text>
          }
        />
      )}

      {/* Modal editar perfil */}
      <Modal visible={modalEditar} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <TouchableOpacity onPress={() => setModalEditar(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.textInput}
              value={nombreEdit}
              onChangeText={setNombreEdit}
              placeholder="Tu nombre"
              placeholderTextColor="#9E9E9E"
            />
            <Text style={styles.inputLabel}>Apellidos</Text>
            <TextInput
              style={styles.textInput}
              value={apellidosEdit}
              onChangeText={setApellidosEdit}
              placeholder="Tus apellidos"
              placeholderTextColor="#9E9E9E"
            />
            <Text style={styles.inputLabel}>Correo (no editable)</Text>
            <TextInput
              style={[styles.textInput, styles.inputDisabled]}
              value={usuario?.correo}
              editable={false}
            />
            <TouchableOpacity
              style={[styles.btnGuardar, guardando && styles.btnDisabled]}
              onPress={handleGuardarPerfil}
              disabled={guardando}
            >
              {guardando
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.btnGuardarText}>Guardar cambios</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#E91E63', letterSpacing: 1 },
  profileInfoSection: { alignItems: 'center', marginTop: 10, paddingHorizontal: 20 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  largeAvatarText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#212121', marginBottom: 4 },
  profileRole: { fontSize: 13, color: '#757575', marginBottom: 2 },
  profileEmail: { fontSize: 12, color: '#9E9E9E', marginBottom: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#757575' },
  statDivider: { width: 1, height: 30, backgroundColor: '#E0E0E0' },
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 25, gap: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E91E63', backgroundColor: '#FFF', flex: 1 },
  actionButtonText: { color: '#E91E63', fontSize: 12, fontWeight: 'bold' },
  logoutButton: { borderColor: '#D32F2F', backgroundColor: '#FFEBEE' },
  logoutButtonText: { color: '#D32F2F', fontSize: 12, fontWeight: 'bold' },
  // Constancias
  constanciasSection: { paddingHorizontal: 20, marginBottom: 20 },
  constanciasTitulo: { fontSize: 15, fontWeight: '700', color: '#212121', marginBottom: 10 },
  constanciaItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE4EC', borderWidth: 1, borderColor: '#F8BBD0', borderRadius: 12, padding: 12, marginBottom: 10 },
  constanciaIconWrapper: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  constanciaTitulo: { fontSize: 13, fontWeight: '600', color: '#212121' },
  constanciaFecha: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  constanciasLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE4EC', borderWidth: 1, borderColor: '#F8BBD0', borderRadius: 12, padding: 12 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#E91E63' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9E9E9E' },
  activeTabText: { color: '#E91E63' },
  listContainer: { paddingBottom: 100 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8EAF6', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 15 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  smallAvatarText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  postHeaderText: { flex: 1 },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#212121' },
  postDate: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  postContent: { fontSize: 14, color: '#424242', lineHeight: 20, marginBottom: 12 },
  postImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  fileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#BBDEFB', borderRadius: 12, padding: 12, marginBottom: 12 },
  fileIconWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  fileCardText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1976D2', marginRight: 8 },
  linkCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 12, padding: 12, marginBottom: 12 },
  linkIconWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  linkCardHost: { fontSize: 13, fontWeight: '700', color: '#388E3C' },
  linkCardUrl: { fontSize: 11, color: '#558B2F', marginTop: 1 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  interactionGroup: { flexDirection: 'row', alignItems: 'center' },
  interactionRow: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  interactionText: { marginLeft: 6, color: '#757575', fontSize: 13, fontWeight: '500' },
  tagBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FCE4EC', borderWidth: 1, borderColor: '#E91E63' },
  tagText: { fontSize: 11, fontWeight: 'bold', color: '#E91E63', textTransform: 'capitalize' },
  emptyText: { textAlign: 'center', color: '#9E9E9E', marginTop: 30, fontSize: 14 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },
  modalBody: { padding: 20, paddingBottom: 60 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#424242', marginBottom: 6, marginTop: 14 },
  textInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#212121', borderWidth: 1, borderColor: '#E0E0E0' },
  inputDisabled: { backgroundColor: '#EEEEEE', color: '#9E9E9E' },
  btnGuardar: { marginTop: 24, backgroundColor: '#E91E63', borderRadius: 25, paddingVertical: 14, alignItems: 'center' },
  btnGuardarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  btnDisabled: { backgroundColor: '#E0E0E0' },
});