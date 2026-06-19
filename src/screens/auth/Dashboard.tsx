import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Image, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
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

interface Notif {
  id_notificacion: number;
  tipo: 'like' | 'comment' | 'announcement';
  titulo: string;
  cuerpo: string | null;
  leida: boolean;
  fecha_creacion: string;
  id_referencia: number | null;
}

const CATEGORIES = ['Todo', 'general', 'taller', 'articulo', 'proyecto'];

export default function Dashboard({ navigation }: any) {
  const [activeCategory, setActiveCategory] = useState('Todo');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const { usuario } = useAuth();
  const channelRef = useRef<any>(null);

  const unreadCount = notifs.filter(n => !n.leida).length;

  // ── Cargar notificaciones reales ─────────────────────────────
  const cargarNotifs = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('id_usuario', usuario.id_usuario)
      .order('fecha_creacion', { ascending: false })
      .limit(30);
    if (data) setNotifs(data as Notif[]);
  }, [usuario?.id_usuario]);

  // ── Realtime: escuchar nuevas notificaciones ─────────────────
  useEffect(() => {
    if (!usuario?.id_usuario) return;
    cargarNotifs();
    const ch = supabase
      .channel(`notif-${usuario.id_usuario}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `id_usuario=eq.${usuario.id_usuario}`,
      }, (payload) => {
        setNotifs(prev => [payload.new as Notif, ...prev]);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [usuario?.id_usuario, cargarNotifs]);

  const marcarTodasLeidas = async () => {
    if (!usuario?.id_usuario) return;
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id_usuario', usuario.id_usuario)
      .eq('leida', false);
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  };

  const marcarLeida = async (n: Notif) => {
    if (n.leida) return;
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id_notificacion', n.id_notificacion);
    setNotifs(prev => prev.map(x => x.id_notificacion === n.id_notificacion ? { ...x, leida: true } : x));
  };

  // ── Cargar feed ──────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      let query = supabase
        .from('vw_feed_publicaciones')
        .select('*')
        .order('created_at', { ascending: false });
      if (activeCategory !== 'Todo') query = query.eq('tag', activeCategory);
      const { data, error } = await query;
      if (error) throw error;
      const postsConLike = await Promise.all((data ?? []).map(async (p: any) => {
        const { data: likeData } = await supabase
          .from('likes_publicacion')
          .select('id_usuario')
          .eq('id_publicacion', p.id)
          .eq('id_usuario', usuario!.id_usuario)
          .maybeSingle();
        return { ...p, usuario_dio_like: !!likeData };
      }));
      setPosts(postsConLike);
    } catch (err: any) {
      console.error('Error feed:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, usuario?.id_usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviarPush = async (idPublicacion: number, titulo: string, cuerpo: string) => {
    try {
      // Obtener token del autor via RPC
      const { data: token } = await supabase.rpc('fn_push_token_autor', { p_id_publicacion: idPublicacion });
      if (!token) return;
      // Llamar Edge Function
      await supabase.functions.invoke('send-push', { body: { token, titulo, cuerpo } });
    } catch (err) {
      console.log('Push error (no crítico):', err);
    }
  };

  const handleLike = async (post: PostItem) => {
    const nuevoEstado = !post.usuario_dio_like;
    setPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, usuario_dio_like: nuevoEstado, likes: p.likes + (nuevoEstado ? 1 : -1) } : p
    ));
    try {
      if (nuevoEstado) {
        await supabase.from('likes_publicacion').insert({ id_publicacion: post.id, id_usuario: usuario!.id_usuario });
        // Solo enviar push si no es la propia publicación
        if (post.id_usuario !== usuario!.id_usuario) {
          enviarPush(post.id, 'Tu publicación recibió un ❤️', post.content?.substring(0, 80) ?? '');
        }
      } else {
        await supabase.from('likes_publicacion').delete().eq('id_publicacion', post.id).eq('id_usuario', usuario!.id_usuario);
      }
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, usuario_dio_like: post.usuario_dio_like, likes: post.likes } : p));
    }
  };

  const getInitials = (name: string, lastName: string) =>
    `${name?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() || 'U';

  const tipoIcon = (tipo: Notif['tipo']) => {
    if (tipo === 'like') return '❤️';
    if (tipo === 'comment') return '💬';
    return '📢';
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

  const renderPost = ({ item }: { item: PostItem }) => {
    const fullName = `${item.user_name} ${item.user_last_name}`.trim();
    const initials = getInitials(item.user_name, item.user_last_name);
    const fecha = new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    return (
      <View style={styles.card}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.postHeaderText}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.postDate}>{fecha}</Text>
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
            <Feather name="download" size={16} color={Colors.textMuted} />
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
            <Feather name="external-link" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Compatibilidad con publicaciones antiguas que solo tenían url_referencia como imagen */}
        {!item.archivos?.length && !item.link_url && item.url_referencia && (
          <Image source={{ uri: item.url_referencia }} style={styles.postImage} resizeMode="cover" />
        )}
        <View style={styles.postFooter}>
          <View style={styles.interactionGroup}>
            <TouchableOpacity style={styles.interactionRow} onPress={() => handleLike(item)}>
              <Feather name="heart" size={16} color={item.usuario_dio_like ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.interactionText, item.usuario_dio_like && { color: Colors.primary }]}>{item.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.interactionRow} onPress={() => navigation.navigate('Comentarios', { publicacion: item })}>
              <Feather name="message-circle" size={16} color={Colors.textMuted} />
              <Text style={styles.interactionText}>{item.comments}</Text>
            </TouchableOpacity>
          </View>
          {item.id_usuario === usuario?.id_usuario && (
            <TouchableOpacity onPress={() => navigation.navigate('EditarPublicacion', { publicacion: item })}>
              <Feather name="edit-2" size={15} color="#9E9E9E" />
            </TouchableOpacity>
          )}
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{item.tag || 'general'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/logo_mech-girls.jpeg')} style={styles.headerLogo} resizeMode="cover" />
          <Text style={styles.headerTitle}>MECH <Text style={{ color: Colors.primary }}>GIRLS</Text></Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellWrapper} onPress={() => { setShowNotifications(true); }}>
            <Feather name="bell" size={24} color={Colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userProfileIcon}>
            <Text style={styles.userProfileText}>{getInitials(usuario?.nombre ?? '', usuario?.apellidos ?? '')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[styles.categoryPill, activeCategory === cat && styles.categoryPillActive]} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive, { textTransform: 'capitalize' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={styles.feedContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay publicaciones disponibles.</Text>}
        />
      )}

      {/* Panel de Notificaciones */}
      <Modal visible={showNotifications} animationType="slide" transparent onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notificaciones</Text>
              <View style={styles.notifHeaderActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={marcarTodasLeidas} style={styles.markReadBtn}>
                    <Text style={styles.markReadText}>Marcar todas como leídas</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                  <Feather name="x" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifs.length === 0 ? (
                <View style={styles.emptyNotif}>
                  <Text style={styles.emptyNotifEmoji}>🔔</Text>
                  <Text style={styles.emptyNotifText}>No tienes notificaciones</Text>
                </View>
              ) : (
                notifs.map(n => (
                  <TouchableOpacity
                    key={n.id_notificacion}
                    style={[styles.notifItem, !n.leida && styles.notifItemUnread]}
                    onPress={() => marcarLeida(n)}
                  >
                    <Text style={styles.notifIcon}>{tipoIcon(n.tipo)}</Text>
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifItemTitle, !n.leida && styles.notifItemTitleBold]}>{n.titulo}</Text>
                      {n.cuerpo ? <Text style={styles.notifBody}>{n.cuerpo}</Text> : null}
                      <Text style={styles.notifTime}>
                        {new Date(n.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!n.leida && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: Colors.text, letterSpacing: 1 },
  headerLogo: { width: 44, height: 44, borderRadius: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  bellWrapper: { marginRight: 14, position: 'relative' },
  badge: { position: 'absolute', top: -6, right: -8, backgroundColor: Colors.primary, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.background },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  userProfileIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  userProfileText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  categoriesWrapper: { marginBottom: 10 },
  categoriesContainer: { paddingHorizontal: 20, paddingVertical: 5 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginRight: 10, backgroundColor: Colors.background },
  categoryPillActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  categoryText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  categoryTextActive: { color: Colors.primary },
  feedContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginBottom: 15 },
  postHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  postHeaderText: { flex: 1 },
  userName: { fontWeight: '700', fontSize: 15, color: Colors.text, marginBottom: 2 },
  postDate: { fontSize: 11, color: Colors.textMuted },
  postContent: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  notifPanel: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: '75%', minHeight: 300 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  notifHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markReadBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  markReadText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  closeBtn: { padding: 4 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifItemUnread: { backgroundColor: Colors.primaryPale },
  notifIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  notifContent: { flex: 1 },
  notifItemTitle: { fontSize: 14, color: Colors.text, marginBottom: 2 },
  notifItemTitleBold: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  emptyNotif: { alignItems: 'center', paddingVertical: 48 },
  emptyNotifEmoji: { fontSize: 40, marginBottom: 12 },
  emptyNotifText: { fontSize: 14, color: Colors.textMuted },
});