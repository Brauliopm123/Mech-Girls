import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { decode } from 'base64-arraybuffer';

const CATEGORIES = [
  { id: 'General', icon: 'grid' },
  { id: 'Taller', icon: 'tool' },
  { id: 'Artículo', icon: 'file-text' },
  // { id: 'Idea', icon: 'zap' },
  { id: 'Proyecto', icon: 'monitor' },
];

const INITIAL_TAGS = ['#mecatrónica', '#mechgirls'];

function getInitialState() {
  return {
    title: '',
    content: '',
    category: 'General',
    tags: [...INITIAL_TAGS],
    image: null as any,
    file: null as any,
    link: '',
  };
}

export default function CrearPublicacionScreen() {
  const { usuario } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState<string[]>([...INITIAL_TAGS]);
  const [image, setImage] = useState<any>(null);
  const [file, setFile] = useState<any>(null);
  const [link, setLink] = useState('');
  const [isLinkModalVisible, setLinkModalVisible] = useState(false);
  const [tempLink, setTempLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const isValid = content.trim().length > 0;

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('General');
    setTags([...INITIAL_TAGS]);
    setImage(null);
    setFile(null);
    setLink('');
    setTempLink('');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFile(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const uploadToStorage = async (fileObj: any, folder: string) => {
    try {
      const uri = typeof fileObj === 'string' ? fileObj : fileObj.uri;
      if (!uri) return null;

      const fileExt = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'bin';
      const fileName = `${folder}/${Date.now()}.${fileExt}`;

      // Leer como base64 — funciona tanto en iOS como en Android con URIs content://
      let base64Data: string;
      if (typeof fileObj === 'object' && fileObj.base64) {
        // ImagePicker ya trae base64 si se pidió
        base64Data = fileObj.base64;
      } else {
        // DocumentPicker o imagen sin base64 — leer con FileSystem
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const fileData = decode(base64Data);

      const contentType = folder === 'imagenes'
        ? `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
        : fileObj.mimeType || 'application/octet-stream';

      const { error } = await supabase.storage
        .from('media')
        .upload(fileName, fileData, { contentType });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      return null;
    }
  };

  const handlePublish = async () => {
    if (!usuario) {
      Alert.alert('Error', 'Debes iniciar sesión para publicar.');
      return;
    }

    const userId = (usuario as any).id_usuario || (usuario as any).id;
    if (!userId) {
      Alert.alert('Error', 'No se pudo identificar al usuario activo.');
      return;
    }

    setIsUploading(true);

    try {
      let imageUrl = null;
      let fileUrl = null;

      if (image) imageUrl = await uploadToStorage(image, 'imagenes');
      if (file) fileUrl = await uploadToStorage(file, 'archivos');

      const urlFinal = imageUrl || fileUrl || link || null;

      let descripcionUrl = null;
      if (link) descripcionUrl = 'Enlace adjunto';
      else if (imageUrl) descripcionUrl = 'Imagen adjunta';
      else if (fileUrl) descripcionUrl = 'Archivo adjunto';

      const { error } = await supabase.from('publicaciones').insert([
        {
          id_usuario: userId,
          contenido_texto: content.trim(),
          tipo_publicacion: category.toLowerCase(),
          url_referencia: urlFinal,
          descripcion_url: descripcionUrl,
        }
      ]);

      if (error) throw error;

      Alert.alert('¡Éxito!', 'Tu publicación ha sido creada.');
      resetForm();

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Ocurrió un problema al publicar.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeTag = (tagToRemove: string) => setTags(tags.filter(t => t !== tagToRemove));
  const addDemoTag = () => {
    const newTag = `#innovación${tags.length}`;
    if (!tags.includes(newTag)) setTags([...tags, newTag]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E91E63" />
          <Text style={styles.loadingText}>Subiendo publicación...</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>Nueva publicación</Text>
        <TouchableOpacity
          style={[styles.publishButton, isValid && styles.publishButtonActive]}
          disabled={!isValid || isUploading}
          onPress={handlePublish}
        >
          <Text style={[styles.publishButtonText, isValid && styles.publishButtonTextActive]}>
            Publicar
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <View style={styles.userInfoRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(usuario as any)?.nombre?.charAt(0) || 'M'}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{(usuario as any)?.nombre || 'MechGirl'}</Text>
              <View style={styles.visibilityDropdown}>
                <Feather name="globe" size={12} color="#757575" style={{ marginRight: 4 }} />
                <Text style={styles.visibilityText}>Comunidad</Text>
              </View>
            </View>
          </View>

          <View style={styles.inputsContainer}>
            <TextInput
              style={styles.inputUnified}
              placeholder={"Comparte tu idea o proyecto..."}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={560}
              editable={!isUploading}
            />
            <Text style={styles.charCounter}>{content.length}/560</Text>
          </View>

          {image && (
            <View style={styles.previewBox}>
              <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setImage(null)}>
                <Feather name="x" size={16} color="#FFF" />
              </TouchableOpacity>
              <Feather name="image" size={24} color="#E91E63" style={{ marginBottom: 4 }} />
              <Text style={styles.previewText} numberOfLines={1}>Imagen adjunta</Text>
            </View>
          )}

          {file && (
            <View style={[styles.previewBox, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
              <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setFile(null)}>
                <Feather name="x" size={16} color="#FFF" />
              </TouchableOpacity>
              <Feather name="file-text" size={24} color="#1976D2" style={{ marginBottom: 4 }} />
              <Text style={[styles.previewText, { color: '#1976D2' }]} numberOfLines={1}>{file.name}</Text>
            </View>
          )}

          {link ? (
            <View style={[styles.previewBox, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
              <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setLink('')}>
                <Feather name="x" size={16} color="#FFF" />
              </TouchableOpacity>
              <Feather name="link" size={24} color="#388E3C" style={{ marginBottom: 4 }} />
              <Text style={[styles.previewText, { color: '#388E3C' }]} numberOfLines={1}>{link}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CATEGORÍA</Text>
            <View style={styles.chipsContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, category.toLowerCase() === cat.id.toLowerCase() && styles.chipActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Feather
                    name={cat.icon as any}
                    size={14}
                    color={category.toLowerCase() === cat.id.toLowerCase() ? '#E91E63' : '#757575'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.chipText, category.toLowerCase() === cat.id.toLowerCase() && styles.chipTextActive]}>
                    {cat.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADJUNTAR</Text>
            <View style={styles.attachContainer}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickImage} disabled={isUploading}>
                <Feather name="image" size={16} color="#757575" style={{ marginRight: 8 }} />
                <Text style={styles.attachBtnText}>Imagen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={() => { setTempLink(link); setLinkModalVisible(true); }} disabled={isUploading}>
                <Feather name="link" size={16} color={link ? '#388E3C' : '#757575'} style={{ marginRight: 8 }} />
                <Text style={[styles.attachBtnText, link ? { color: '#388E3C' } : {}]}>Enlace{link ? ' ✓' : ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={pickFile} disabled={isUploading}>
                <Feather name="file" size={16} color={file ? '#1976D2' : '#757575'} style={{ marginRight: 8 }} />
                <Text style={[styles.attachBtnText, file ? { color: '#1976D2' } : {}]}>Archivo{file ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ETIQUETAS</Text>
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Feather name="x" size={14} color="#E91E63" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addTagBtn} onPress={addDemoTag}>
                <Feather name="plus" size={14} color="#9E9E9E" style={{ marginRight: 4 }} />
                <Text style={styles.addTagBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL ENLACE */}
      <Modal visible={isLinkModalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Agregar un enlace</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://ejemplo.com"
              value={tempLink}
              onChangeText={setTempLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setLinkModalVisible(false); setTempLink(''); }}>
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnAdd} onPress={() => { setLink(tempLink.trim()); setLinkModalVisible(false); setTempLink(''); }}>
                <Text style={styles.modalBtnTextAdd}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#E91E63', fontWeight: 'bold' },
  scrollContent: { paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  publishButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  publishButtonActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  publishButtonText: { fontSize: 13, fontWeight: 'bold', color: '#9E9E9E' },
  publishButtonTextActive: { color: '#FFFFFF' },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  userName: { fontSize: 15, fontWeight: 'bold', color: '#212121', marginBottom: 4 },
  visibilityDropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#EEEEEE' },
  visibilityText: { fontSize: 12, color: '#757575' },
  inputsContainer: { paddingHorizontal: 20 },
  inputUnified: { fontSize: 15, color: '#212121', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 15, minHeight: 150 },
  charCounter: { alignSelf: 'flex-end', fontSize: 11, color: '#9E9E9E', marginTop: 6, marginBottom: 15 },
  previewBox: { marginHorizontal: 20, marginBottom: 10, padding: 15, backgroundColor: '#FCE4EC', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F8BBD0' },
  removePreviewBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4 },
  previewText: { color: '#E91E63', fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#9E9E9E', marginBottom: 12 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  chipActive: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  chipText: { fontSize: 13, color: '#757575', fontWeight: '500' },
  chipTextActive: { color: '#E91E63', fontWeight: 'bold' },
  attachContainer: { flexDirection: 'row', gap: 10 },
  attachBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA' },
  attachBtnText: { fontSize: 13, color: '#757575', fontWeight: '500' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE4EC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#F8BBD0' },
  tagBadgeText: { color: '#E91E63', fontSize: 12, fontWeight: '500' },
  addTagBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  addTagBtnText: { color: '#9E9E9E', fontSize: 12, fontWeight: '500' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, color: '#333', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: { paddingHorizontal: 15, paddingVertical: 8 },
  modalBtnTextCancel: { color: '#757575', fontWeight: 'bold' },
  modalBtnAdd: { backgroundColor: '#E91E63', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  modalBtnTextAdd: { color: '#FFF', fontWeight: 'bold' },
});