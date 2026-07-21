import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
  Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';

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
  id_usuario: number;
  user_name: string;
  user_last_name: string;
  user_foto: string | null;
  likes: number;
  comments: number;
  usuario_dio_like: boolean;
}

interface PerfilInfo {
  nombre: string;
  apellidos: string;
  foto_perfil_url: string | null;
  esPonente: boolean;
  // alumna
  biografia?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  // ponente
  semblanza?: string | null;
  especialidad?: string | null;
  empresa_institucion?: string | null;
  sitio_web_url?: string | null;
}

export default function PerfilPublicoScreen({ route, navigation }: any) {
  const { idUsuario, nombre, apellidos, foto } = route.params ?? {};
  const { usuario } = useAuth();
  const isGuest = useAuthStore(s => s.esInvitado)();

  const [perfil, setPerfil] = useState<PerfilInfo | null>(
    nombre
      ? {
          nombre,
          apellidos: apellidos ?? '',
          foto_perfil_url: foto ?? null,
          esPonente: false,
        }
      : null
  );
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [stats, setStats] = useState({ publicaciones: 0, talleres: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const esSuPerfil = usuario?.id_usuario === idUsuario;

  const getInitials = (n?: string, l?: string) =>
    `${n?.charAt(0) ?? ''}${l?.charAt(0) ?? ''}`.toUpperCase() || 'U';

  // ── Cargar info de perfil (alumna o ponente) ─────────────────
  const cargarPerfil = useCallback(async () => {
    if (!idUsuario) return;
    try {
      const [alumnaRes, ponenteRes] = await Promise.all([
        supabase
          .from('perfiles_alumna')
          .select('nombre, apellidos, biografia, foto_perfil_url, linkedin_url, github_url')
          .eq('id_usuario', idUsuario)
          .maybeSingle(),
        supabase
          .from('perfiles_ponente')
          .select('nombre, apellidos, semblanza, especialidad, empresa_institucion, foto_perfil_url, sitio_web_url')
          .eq('id_usuario', idUsuario)
          .maybeSingle(),
      ]);

      const pp = ponenteRes.data;
      const pa = alumnaRes.data;

      if (pp) {
        setPerfil({
          nombre: pp.nombre,
          apellidos: pp.apellidos,
          foto_perfil_url: pp.foto_perfil_url ?? null,
          esPonente: true,
          semblanza: pp.semblanza,
          especialidad: pp.especialidad,
          empresa_institucion: pp.empresa_institucion,
          sitio_web_url: pp.sitio_web_url,
        });
      } else if (pa) {
        setPerfil({
          nombre: pa.nombre,
          apellidos: pa.apellidos,
          foto_perfil_url: pa.foto_perfil_url ?? null,
          esPonente: false,
          biografia: pa.biografia,
          linkedin_url: pa.linkedin_url,
          github_url: pa.github_url,
        });
      }
    } catch (err: any) {
      console.error('Error perfil público:', err.message);
    }
  }, [idUsuario]);

  // ── Cargar publicaciones del usuario ─────────────────────────
  const cargarPosts = useCallback(async () => {
    if (!idUsuario) return;
    try {
      const { data } = await supabase
        .from('vw_feed_publicaciones')
        .select('*')
        .eq('id_usuario', idUsuario)
        .order('created_at', { ascending: false });

      const lista = (data ?? []) as PostItem[];
      setPosts(lista);

      const { count: talleres } = await supabase
        .from('inscripciones')
        .select('*', { count: 'exact', head: true })
        .eq('id_usuario', idUsuario)
        .neq('estado', 'cancelada');

      setStats({ publicaciones: lista.length, talleres: talleres ?? 0 });
    } catch (err: any) {
      console.error('Error publicaciones perfil:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idUsuario]);

  useEffect(() => {
    cargarPerfil();
    cargarPosts();
  }, [cargarPerfil, cargarPosts]);

  const handleLike = async (post: PostItem) => {
    if (isGuest) {
      Alert.alert('Necesitas una cuenta', 'Regístrate para dar like a publicaciones.');
      return;
    }
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
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, usuario_dio_like: post.usuario_dio_like, likes: post.likes } : p
      ));
    }
  };

  const handleMensaje = () => {
    if (!perfil) return;
    const conv = {
      id_otro_usuario: idUsuario,
      nombre: perfil.nombre,
      apellidos: perfil.apellidos,
      foto_url: perfil.foto_perfil_url,
      ultimo_mensaje: '',
      fecha_ultimo: '',
      no_leidos: 0,
    };
    navigation.navigate('Chat', { conv });
  };

  const abrirUrl = async (url: string) => {
    try {
      const limpio = url.trim();
      const final = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
      await Linking.openURL(final);
    } catch { console.log('No se pudo abrir la URL:', url); }
  };

  const nombreArchivoDesdeUrl = (url: string) => {
    try {
      const parte = url.split('/').pop() ?? 'archivo';
      return decodeURIComponent(parte.split('?')[0]);
    } catch { return 'archivo'; }
  };

  const formatearLink = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellidos}`.trim() : '';
  const initials = getInitials(perfil?.nombre ?? nombre, perfil?.apellidos ?? apellidos);
  const fotoUrl = perfil?.foto_perfil_url ?? foto ?? null;
  const roleText = perfil?.esPonente ? 'Ponente' : 'Alumna — Ingeniería Mecatrónica';
  const bio = perfil?.esPonente ? perfil?.semblanza : perfil?.biografia;

  const renderPost = ({ item }: { item: PostItem }) => (
    <View style={styles.card}>
      <View style={styles.postHeader}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={styles.smallAvatarImg} />
        ) : (
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.postHeaderText}>
          <Text style={styles.userName}>{nombreCompleto}</Text>
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
          onPress={() => abrirUrl(`${arch.url}?download=${encodeURIComponent(arch.nombre || nombreArchivoDesdeUrl(arch.url))}`)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconWrapper}>
            <Feather name="file-text" size={18} color="#1976D2" />
          </View>
          <Text style={styles.fileCardText} numberOfLines={1}>
            {arch.nombre || nombreArchivoDesdeUrl(arch.url)}
          </Text>
          <Feather name="download" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      ))}

      {item.link_url && (
        <TouchableOpacity style={styles.linkCard} onPress={() => abrirUrl(item.link_url!)} activeOpacity={0.7}>
          <View style={styles.linkIconWrapper}>
            <Feather name="link" size={18} color="#388E3C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkCardHost} numberOfLines={1}>{formatearLink(item.link_url)}</Text>
            <Text style={styles.linkCardUrl} numberOfLines={1}>{item.link_url}</Text>
          </View>
          <Feather name="external-link" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {!item.archivos?.length && !item.link_url && item.url_referencia && (
        <Image source={{ uri: item.url_referencia }} style={styles.postImage} resizeMode="cover" />
      )}

      <View style={styles.postFooter}>
        <View style={styles.interactionGroup}>
          <TouchableOpacity style={styles.interactionRow} onPress={() => handleLike(item)}>
            <Feather name="heart" size={16} color={item.usuario_dio_like ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.interactionText, item.usuario_dio_like && { color: Colors.primary }]}>{item.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.interactionRow}
            onPress={() => navigation.navigate('Comentarios', { publicacion: item })}
          >
            <Feather name="message-circle" size={16} color={Colors.textMuted} />
            <Text style={styles.interactionText}>{item.comments}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{item.tag || 'general'}</Text>
        </View>
      </View>
    </View>
  );

  const ProfileHeader = () => (
    <View>
      <View style={styles.profileInfoSection}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={styles.largeAvatarImg} />
        ) : (
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.profileName}>{nombreCompleto || 'Perfil'}</Text>
        <Text style={styles.profileRole}>{roleText}</Text>

        {perfil?.esPonente && perfil?.empresa_institucion ? (
          <View style={styles.metaRow}>
            <Feather name="briefcase" size={13} color={Colors.textMuted} style={{ marginRight: 5 }} />
            <Text style={styles.metaText}>{perfil.empresa_institucion}</Text>
          </View>
        ) : null}
        {perfil?.esPonente && perfil?.especialidad ? (
          <Text style={styles.especialidad}>{perfil.especialidad}</Text>
        ) : null}
      </View>

      {/* Botón mensaje: solo si no es tu propio perfil y no eres invitada */}
      {!esSuPerfil && !isGuest && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.messageButton} onPress={handleMensaje} activeOpacity={0.8}>
            <Feather name="message-circle" size={16} color={Colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.messageButtonText}>Enviar mensaje</Text>
          </TouchableOpacity>
        </View>
      )}

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
          <Text style={styles.statNumber}>{posts.reduce((acc, p) => acc + p.likes, 0)}</Text>
          <Text style={styles.statLabel}>Likes totales</Text>
        </View>
      </View>

      {bio ? (
        <View style={styles.bioSection}>
          <Text style={styles.bioTitle}>{perfil?.esPonente ? 'SEMBLANZA' : 'BIOGRAFÍA'}</Text>
          <Text style={styles.bioText}>{bio}</Text>
        </View>
      ) : null}

      {/* Enlaces */}
      {(perfil?.linkedin_url || perfil?.github_url || perfil?.sitio_web_url) ? (
        <View style={styles.linksSection}>
          {perfil?.linkedin_url ? (
            <TouchableOpacity style={styles.socialLink} onPress={() => abrirUrl(perfil.linkedin_url!)} activeOpacity={0.7}>
              <Feather name="linkedin" size={16} color={Colors.primary} />
              <Text style={styles.socialLinkText}>LinkedIn</Text>
            </TouchableOpacity>
          ) : null}
          {perfil?.github_url ? (
            <TouchableOpacity style={styles.socialLink} onPress={() => abrirUrl(perfil.github_url!)} activeOpacity={0.7}>
              <Feather name="github" size={16} color={Colors.primary} />
              <Text style={styles.socialLinkText}>GitHub</Text>
            </TouchableOpacity>
          ) : null}
          {perfil?.sitio_web_url ? (
            <TouchableOpacity style={styles.socialLink} onPress={() => abrirUrl(perfil.sitio_web_url!)} activeOpacity={0.7}>
              <Feather name="globe" size={16} color={Colors.primary} />
              <Text style={styles.socialLinkText}>Sitio web</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tabsContainer}>
        <View style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Publicaciones</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => String(item.id)}
          renderItem={renderPost}
          ListHeaderComponent={ProfileHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); cargarPerfil(); cargarPosts(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Esta persona aún no ha publicado nada.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

  profileInfoSection: { alignItems: 'center', marginTop: 16, paddingHorizontal: 20 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  largeAvatarImg: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, backgroundColor: Colors.surface },
  largeAvatarText: { color: Colors.white, fontSize: 34, fontWeight: 'bold' },
  profileName: { fontSize: 21, fontWeight: '800', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  profileRole: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 13, color: Colors.textMuted },
  especialidad: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 4, textAlign: 'center' },

  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 20, marginTop: 18, marginBottom: 4 },
  messageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 28, borderRadius: 24, backgroundColor: Colors.primary },
  messageButtonText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 20 },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  bioSection: { marginHorizontal: 20, marginBottom: 18, padding: 16, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: Colors.border },
  bioTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  bioText: { fontSize: 14, color: Colors.text, lineHeight: 21 },

  linksSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 18 },
  socialLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryPale },
  socialLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  activeTabText: { color: Colors.primary },

  listContainer: { paddingBottom: 100 },
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 15 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  smallAvatarImg: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: Colors.surface },
  smallAvatarText: { color: Colors.white, fontSize: 14, fontWeight: 'bold' },
  postHeaderText: { flex: 1 },
  userName: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  postDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  postContent: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
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
  interactionText: { marginLeft: 6, color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  tagBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.primaryPale, borderWidth: 1, borderColor: Colors.primaryBorder },
  tagText: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'capitalize' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 30, fontSize: 14 },
});