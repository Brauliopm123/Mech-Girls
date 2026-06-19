import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

const TIPOS = ['general', 'taller', 'articulo', 'proyecto'];

export default function EditarPublicacionScreen({ route, navigation }: any) {
  const { publicacion } = route.params;
  const { usuario } = useAuth();

  // La vista vw_feed_publicaciones expone id_publicacion como "id"
  const pubId: number = publicacion.id;

  const [contenido, setContenido] = useState(publicacion.content ?? '');
  const [tipo, setTipo] = useState(publicacion.tag ?? 'general');
  const [linkUrl, setLinkUrl] = useState(publicacion.link_url ?? '');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!contenido.trim()) {
      Alert.alert('Error', 'El contenido no puede estar vacío.');
      return;
    }
    setGuardando(true);
    try {
      const { data, error } = await supabase.rpc('fn_editar_publicacion', {
        p_id_publicacion:   pubId,
        p_id_usuario:       usuario!.id_usuario,
        p_contenido_texto:  contenido.trim(),
        p_tipo_publicacion: tipo,
        p_link_url:         linkUrl.trim() || null,
      });

      if (error) throw error;

      if (!data) {
        Alert.alert('Sin cambios', 'No se encontró la publicación o no eres la autora.');
        return;
      }

      Alert.alert('¡Guardado!', 'Tu publicación fue actualizada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = () => {
    Alert.alert(
      'Eliminar publicación',
      '¿Segura que deseas eliminar esta publicación? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('fn_eliminar_publicacion', {
                p_id_publicacion: pubId,
                p_id_usuario:     usuario!.id_usuario,
              });

              if (error) throw error;

              if (!data) {
                Alert.alert('Error', 'No se encontró la publicación o no eres la autora.');
                return;
              }

              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar publicación</Text>
        <TouchableOpacity onPress={handleEliminar}>
          <Feather name="trash-2" size={20} color="#D32F2F" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Tipo de publicación</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiposRow}>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tipoPill, tipo === t && styles.tipoPillActivo]}
                onPress={() => setTipo(t)}
              >
                <Text style={[styles.tipoPillText, tipo === t && styles.tipoPillTextActivo]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Contenido</Text>
          <TextInput
            style={styles.textArea}
            value={contenido}
            onChangeText={setContenido}
            multiline
            numberOfLines={8}
            placeholder="¿Qué quieres compartir?"
            placeholderTextColor="#9E9E9E"
            textAlignVertical="top"
          />

          <Text style={styles.label}>Enlace (opcional)</Text>
          <TextInput
            style={styles.textInputLink}
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://ejemplo.com"
            placeholderTextColor="#9E9E9E"
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity
            style={[styles.btnGuardar, guardando && styles.btnDisabled]}
            onPress={handleGuardar}
            disabled={guardando}
          >
            {guardando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnGuardarText}>Guardar cambios</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#212121' },
  body: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '600', color: '#424242', marginBottom: 10, marginTop: 16 },
  tiposRow: { marginBottom: 4 },
  tipoPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#E0E0E0', marginRight: 8, backgroundColor: '#FAFAFA',
  },
  tipoPillActivo: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  tipoPillText: { fontSize: 13, color: '#757575', fontWeight: '600', textTransform: 'capitalize' },
  tipoPillTextActivo: { color: '#E91E63' },
  textArea: {
    backgroundColor: '#F5F5F5', borderRadius: 12,
    borderWidth: 1, borderColor: '#E0E0E0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#212121', minHeight: 180,
  },
  textInputLink: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: '#212121',
  },
  btnGuardar: {
    marginTop: 24, backgroundColor: '#E91E63',
    borderRadius: 25, paddingVertical: 14, alignItems: 'center',
  },
  btnGuardarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  btnDisabled: { backgroundColor: '#E0E0E0' },
});