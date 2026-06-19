import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';

interface Comentario {
  id_comentario: number;
  id_publicacion: number;
  id_usuario: number;
  contenido: string;
  fecha_comentario: string;
  user_name: string;
  user_last_name: string;
}

export default function ComentariosScreen({ route, navigation }: any) {
  const { publicacion } = route.params;
  const { usuario } = useAuth();
  const isGuest = useAuthStore(s => s.esInvitado)();
   const insets = useSafeAreaInsets();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const cargar = useCallback(async () => {
    try {
      // Traer comentarios y luego unir nombre desde perfiles_alumna/ponente
      const { data, error } = await supabase
        .from('comentarios')
        .select('id_comentario, id_publicacion, id_usuario, contenido, fecha_comentario')
        .eq('id_publicacion', publicacion.id)
        .order('fecha_comentario', { ascending: true });

      if (error) throw error;

      // Para cada comentario buscar el nombre en perfiles
      const enriched = await Promise.all((data ?? []).map(async (c: any) => {
        const { data: pa } = await supabase
          .from('perfiles_alumna')
          .select('nombre, apellidos')
          .eq('id_usuario', c.id_usuario)
          .maybeSingle();
        const { data: pp } = await supabase
          .from('perfiles_ponente')
          .select('nombre, apellidos')
          .eq('id_usuario', c.id_usuario)
          .maybeSingle();
        return {
          ...c,
          user_name: pa?.nombre ?? pp?.nombre ?? 'Usuario',
          user_last_name: pa?.apellidos ?? pp?.apellidos ?? '',
        };
      }));

      setComentarios(enriched);
    } catch (err: any) {
      console.error('Error comentarios:', err.message);
    } finally {
      setLoading(false);
    }
  }, [publicacion.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEnviar = async () => {
    if (!texto.trim() || !usuario) return;
    setEnviando(true);
    try {
      const { error } = await supabase.from('comentarios').insert({
        id_publicacion: publicacion.id,
        id_usuario: usuario.id_usuario,
        contenido: texto.trim(),
      });
      if (error) throw error;
      setTexto('');
      cargar();
      // Enviar push al autor si no es su propia publicación
      if (publicacion.id_usuario !== usuario.id_usuario) {
        try {
          const { data: token } = await supabase.rpc('fn_push_token_autor', { p_id_publicacion: publicacion.id });
          if (token) await supabase.functions.invoke('send-push', {
            body: { token, titulo: 'Nuevo comentario en tu publicación 💬', cuerpo: texto.trim().substring(0, 80) }
          });
        } catch { /* push no crítico */ }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setEnviando(false);
    }
  };

  const getInitials = (name: string, last: string) =>
    `${name?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase() || 'U';

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  const renderComentario = ({ item }: { item: Comentario }) => (
    <View style={styles.comentario}>
      <View style={styles.avatarSm}>
        <Text style={styles.avatarSmText}>
          {getInitials(item.user_name, item.user_last_name)}
        </Text>
      </View>
      <View style={styles.bubble}>
        <View style={styles.bubbleHead}>
          <Text style={styles.bubbleName}>{item.user_name} {item.user_last_name}</Text>
          <Text style={styles.bubbleTime}>{formatFecha(item.fecha_comentario)}</Text>
        </View>
        <Text style={styles.bubbleText}>{item.contenido}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comentarios</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.postPreview}>
        <View style={styles.postPreviewHead}>
          <View style={styles.avatarMd}>
            <Text style={styles.avatarMdText}>
              {getInitials(publicacion.user_name, publicacion.user_last_name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>
              {publicacion.user_name} {publicacion.user_last_name}
            </Text>
          </View>
          <View style={styles.tagChip}>
            <Text style={styles.tagChipText}>{publicacion.tag}</Text>
          </View>
        </View>
        <Text style={styles.postContent} numberOfLines={3}>{publicacion.content}</Text>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Feather name="heart" size={13} color={Colors.primary} />
            <Text style={styles.statText}>{publicacion.likes} likes</Text>
          </View>
          <View style={styles.statItem}>
            <Feather name="message-circle" size={13} color="#9E9E9E" />
            <Text style={styles.statText}>{comentarios.length} comentarios</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={comentarios}
            keyExtractor={c => String(c.id_comentario)}
            renderItem={renderComentario}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Sé la primera en comentar ✨</Text>
            }
          />
        )}

        {isGuest ? (
          <View style={[styles.inputArea, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12, justifyContent: 'center' }]}>
            <Text style={{ color: '#9E9E9E', textAlign: 'center', fontSize: 13 }}>
              Regístrate para dejar un comentario
            </Text>
          </View>
        ) : (
        <View style={[
  styles.inputArea,
  { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }
]}>
  <View style={styles.avatarXs}>
    <Text style={styles.avatarXsText}>
      {getInitials(usuario?.nombre ?? '', usuario?.apellidos ?? '')}
    </Text>
  </View>
  <View style={styles.inputWrap}>
    <TextInput
      ref={inputRef}
      style={styles.input}
      placeholder="Escribe un comentario..."
      placeholderTextColor="#9E9E9E"
      value={texto}
      onChangeText={setTexto}
      multiline
      maxLength={500}
    />
  </View>
  <TouchableOpacity
    style={[styles.sendBtn, !texto.trim() && styles.sendBtnDisabled]}
    onPress={handleEnviar}
    disabled={!texto.trim() || enviando}
  >
    {enviando
      ? <ActivityIndicator size="small" color="#FFF" />
      : <Feather name="send" size={18} color="#FFF" />
    }
  </TouchableOpacity>
</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E8E0F0' },
  backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 0.5, borderColor: '#E8E0F0', backgroundColor: '#F8F7FC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  postPreview: { margin: 16, padding: 14, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 0.5, borderColor: '#E8E0F0' },
  postPreviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatarMd: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E83E8C', alignItems: 'center', justifyContent: 'center' },
  avatarMdText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  postAuthor: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  tagChip: { backgroundColor: '#FBEAF0', borderWidth: 0.5, borderColor: '#F4C0D1', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  tagChipText: { fontSize: 11, fontWeight: '600', color: '#E83E8C', textTransform: 'capitalize' },
  postContent: { fontSize: 13, color: '#6B6B80', lineHeight: 18, marginBottom: 10 },
  postStats: { flexDirection: 'row', gap: 14, borderTopWidth: 0.5, borderTopColor: '#F8F7FC', paddingTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#9E9E9E' },
  lista: { paddingHorizontal: 16, paddingBottom: 16 },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#9E9E9E', marginTop: 40, fontSize: 14 },
  comentario: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E83E8C', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  avatarSmText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  bubble: { flex: 1, backgroundColor: '#F8F7FC', borderRadius: 12, borderWidth: 0.5, borderColor: '#E8E0F0', padding: 10 },
  bubbleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bubbleName: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  bubbleTime: { fontSize: 10, color: '#9E9E9E' },
  bubbleText: { fontSize: 13, color: '#6B6B80', lineHeight: 18 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: '#E8E0F0', backgroundColor: '#FFF' },
  avatarXs: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E83E8C', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarXsText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  inputWrap: { flex: 1, backgroundColor: '#F8F7FC', borderRadius: 20, borderWidth: 0.5, borderColor: '#E8E0F0', paddingHorizontal: 14, paddingVertical: 8, minHeight: 38, justifyContent: 'center' },
  input: { fontSize: 13, color: '#1A1A2E', maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E83E8C', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { backgroundColor: '#E8E0F0' },
});