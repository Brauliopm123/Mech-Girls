import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

interface Mensaje {
  id_mensaje: number;
  id_emisor: number;
  id_receptor: number;
  contenido: string;
  leido: boolean;
  fecha_envio: string;
}

function iniciales(nombre: string, apellidos: string) {
  return `${nombre?.charAt(0) ?? ''}${apellidos?.charAt(0) ?? ''}`.toUpperCase() || 'U';
}

export default function ChatScreen({ route, navigation }: any) {
  const { conv } = route.params;
  const { usuario } = useAuth();

  const [mensajes, setMensajes]     = useState<Mensaje[]>([]);
  const [loading, setLoading]       = useState(true);
  const [texto, setTexto]           = useState('');
  const [enviando, setEnviando]     = useState(false);
  const flatRef                     = useRef<FlatList>(null);
  const channelRef                  = useRef<any>(null);

  const cargarMensajes = useCallback(async () => {
    await supabase.rpc('fn_marcar_leidos', {
      p_id_emisor: conv.id_otro_usuario,
      p_id_receptor: usuario!.id_usuario,
    });
    const { data } = await supabase
      .from('mensajes')
      .select('*')
      .or(`and(id_emisor.eq.${usuario!.id_usuario},id_receptor.eq.${conv.id_otro_usuario}),and(id_emisor.eq.${conv.id_otro_usuario},id_receptor.eq.${usuario!.id_usuario})`)
      .order('fecha_envio', { ascending: true });
    setMensajes((data as Mensaje[]) ?? []);
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }, [conv.id_otro_usuario, usuario?.id_usuario]);

  useEffect(() => {
    cargarMensajes();

    // Realtime
    const ch = supabase
      .channel(`chat-${usuario!.id_usuario}-${conv.id_otro_usuario}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        const m = payload.new as Mensaje;
        const esMio    = m.id_emisor === usuario!.id_usuario && m.id_receptor === conv.id_otro_usuario;
        const esDelOtro = m.id_emisor === conv.id_otro_usuario && m.id_receptor === usuario!.id_usuario;
        if (esMio || esDelOtro) {
          setMensajes(prev => [...prev, m]);
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
        }
      })
      .subscribe();
    channelRef.current = ch;

    return () => { supabase.removeChannel(ch); };
  }, [cargarMensajes]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    const txt = texto.trim();
    setTexto('');
    setEnviando(true);
    try {
      await supabase.from('mensajes').insert({
        id_emisor:   usuario!.id_usuario,
        id_receptor: conv.id_otro_usuario,
        contenido:   txt,
      });
    } catch {
      setTexto(txt);
    }
    setEnviando(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{iniciales(conv.nombre, conv.apellidos)}</Text>
        </View>
        <Text style={styles.nombre}>{conv.nombre} {conv.apellidos}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={mensajes}
            keyExtractor={m => String(m.id_mensaje)}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Sé la primera en escribir 👋</Text>
            }
            renderItem={({ item }) => {
              const propio = item.id_emisor === usuario!.id_usuario;
              const hora   = new Date(item.fecha_envio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              return (
                <View style={[styles.bubble, propio ? styles.bubblePropio : styles.bubbleAjeno]}>
                  <Text style={[styles.bubbleText, propio && styles.bubbleTextPropio]}>
                    {item.contenido}
                  </Text>
                  <Text style={[styles.bubbleHora, propio && styles.bubbleHoraPropio]}>{hora}</Text>
                </View>
              );
            }}
          />
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!texto.trim() || enviando) && styles.sendBtnOff]}
            onPress={enviar}
            disabled={!texto.trim() || enviando}
          >
            {enviando
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Feather name="send" size={18} color="#FFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  backBtn:         { padding: 4 },
  avatar:          { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText:      { color: '#FFF', fontWeight: '700', fontSize: 14 },
  nombre:          { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  loader:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:            { padding: 16, paddingBottom: 8, gap: 8 },
  emptyText:       { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
  bubble:          { maxWidth: '78%', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignSelf: 'flex-start', marginBottom: 4 },
  bubblePropio:    { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderColor: Colors.primary },
  bubbleAjeno:     { alignSelf: 'flex-start' },
  bubbleText:      { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTextPropio:{ color: '#FFF' },
  bubbleHora:      { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleHoraPropio:{ color: 'rgba(255,255,255,0.7)' },
  inputRow:        { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 55, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: 10 },
  input:           { flex: 1, backgroundColor: Colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border, maxHeight: 120 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff:      { backgroundColor: Colors.primaryBorder },
});