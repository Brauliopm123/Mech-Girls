import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, TextInput, Dimensions, ActivityIndicator,
  RefreshControl, Modal, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;
const AVATAR_COLORS = ['#E91E63','#7E57C2','#009688','#FF9800','#03A9F4','#4CAF50'];

interface Ponente {
  id_perfil_ponente: number;
  id_usuario: number;
  nombre: string;
  apellidos: string;
  especialidad?: string;
  empresa_institucion?: string;
  semblanza?: string;
  foto_perfil_url?: string;
}

export default function PonentesScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const [ponentes, setPonentes] = useState<Ponente[]>([]);
  const [filtrados, setFiltrados] = useState<Ponente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Modal nuevo ponente
  const [modalNuevo, setModalNuevo] = useState(false);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellidos, setNuevoApellidos] = useState('');
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [nuevoEspecialidad, setNuevoEspecialidad] = useState('');
  const [nuevoEmpresa, setNuevoEmpresa] = useState('');

  // Modal semblanza
  const [modalSemblanza, setModalSemblanza] = useState(false);
  const [guardandoSemblanza, setGuardandoSemblanza] = useState(false);
  const [semblanzaTexto, setSemblanzaTexto] = useState('');
  const [especialidadEdit, setEspecialidadEdit] = useState('');
  const [empresaEdit, setEmpresaEdit] = useState('');

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!busqueda.trim()) { setFiltrados(ponentes); return; }
    const q = busqueda.toLowerCase();
    setFiltrados(ponentes.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.apellidos.toLowerCase().includes(q) ||
      (p.especialidad ?? '').toLowerCase().includes(q) ||
      (p.empresa_institucion ?? '').toLowerCase().includes(q)
    ));
  }, [busqueda, ponentes]);

  const cargar = async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles_ponente')
        .select('id_perfil_ponente, id_usuario, nombre, apellidos, especialidad, empresa_institucion, semblanza, foto_perfil_url')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setPonentes(data ?? []);
      setFiltrados(data ?? []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Crear nuevo ponente: registra usuario con rol 2 y perfil_ponente
  const handleCrearPonente = async () => {
    if (!nuevoNombre.trim() || !nuevoApellidos.trim() || !nuevoCorreo.trim()) {
      Alert.alert('Campos requeridos', 'Nombre, apellidos y correo son obligatorios.');
      return;
    }
    setGuardandoNuevo(true);
    try {
      const { data, error } = await supabase.rpc('fn_registrar_usuario', {
        p_correo: nuevoCorreo.trim().toLowerCase(),
        p_contrasena: 'MechGirls2025!', // contraseña temporal
        p_nombre: nuevoNombre.trim(),
        p_apellidos: nuevoApellidos.trim(),
        p_id_rol: 2,
      });
      if (error) throw error;

      const id_usuario = data?.[0]?.id_usuario;
      if (id_usuario && (nuevoEspecialidad || nuevoEmpresa)) {
        await supabase.from('perfiles_ponente')
          .update({ especialidad: nuevoEspecialidad || null, empresa_institucion: nuevoEmpresa || null })
          .eq('id_usuario', id_usuario);
      }

      Alert.alert('¡Ponente creada!', `Contraseña temporal: MechGirls2025!\nSe recomienda cambiarla al iniciar sesión.`);
      setModalNuevo(false);
      setNuevoNombre(''); setNuevoApellidos(''); setNuevoCorreo('');
      setNuevoEspecialidad(''); setNuevoEmpresa('');
      cargar();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // Registrar/actualizar semblanza propia
  const abrirSemblanza = async () => {
    const miPerfil = ponentes.find(p => p.id_usuario === usuario?.id_usuario);
    setSemblanzaTexto(miPerfil?.semblanza ?? '');
    setEspecialidadEdit(miPerfil?.especialidad ?? '');
    setEmpresaEdit(miPerfil?.empresa_institucion ?? '');
    setModalSemblanza(true);
  };

  const handleGuardarSemblanza = async () => {
    setGuardandoSemblanza(true);
    try {
      const { error } = await supabase
        .from('perfiles_ponente')
        .update({
          semblanza: semblanzaTexto.trim() || null,
          especialidad: especialidadEdit.trim() || null,
          empresa_institucion: empresaEdit.trim() || null,
        })
        .eq('id_usuario', usuario!.id_usuario);
      if (error) throw error;
      Alert.alert('¡Guardado!', 'Tu semblanza fue actualizada.');
      setModalSemblanza(false);
      cargar();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGuardandoSemblanza(false);
    }
  };

  const esPonente = ponentes.some(p => p.id_usuario === usuario?.id_usuario);
  const getColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  const renderPonente = ({ item, index }: { item: Ponente; index: number }) => (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      <View style={[styles.avatar, { backgroundColor: getColor(index) }]}>
        <Text style={styles.avatarInitials}>
          {item.nombre.charAt(0)}{item.apellidos.charAt(0)}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.nombre} {item.apellidos}</Text>
      {item.especialidad && <Text style={styles.specialty} numberOfLines={1}>{item.especialidad}</Text>}
      {item.empresa_institucion && <Text style={styles.company} numberOfLines={1}>{item.empresa_institucion}</Text>}
      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => navigation.navigate('PonentesDetalle', { ponente: item, color: getColor(index) })}
      >
        <Text style={styles.profileBtnText}>Ver perfil</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PONENTES</Text>
        <View style={styles.headerBtns}>
          {esPonente && (
            <TouchableOpacity style={styles.btnSemblanza} onPress={abrirSemblanza}>
              <Feather name="file-text" size={14} color="#E91E63" />
              <Text style={styles.btnSemblanzaText}>Mi semblanza</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnNuevo} onPress={() => setModalNuevo(true)}>
            <Feather name="plus" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#9E9E9E" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ponente o especialidad..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor="#9E9E9E"
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Feather name="x" size={18} color="#9E9E9E" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E91E63" style={styles.loader} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => String(item.id_perfil_ponente)}
          renderItem={renderPonente}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor="#E91E63" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {busqueda ? 'Sin resultados.' : 'No hay ponentes registradas.'}
            </Text>
          }
        />
      )}

      {/* Modal nuevo ponente */}
      <Modal visible={modalNuevo} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar ponente</Text>
            <TouchableOpacity onPress={() => setModalNuevo(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput style={styles.textInput} value={nuevoNombre} onChangeText={setNuevoNombre} placeholder="Carmen" placeholderTextColor="#9E9E9E" />
            <Text style={styles.inputLabel}>Apellidos *</Text>
            <TextInput style={styles.textInput} value={nuevoApellidos} onChangeText={setNuevoApellidos} placeholder="Ruiz Torres" placeholderTextColor="#9E9E9E" />
            <Text style={styles.inputLabel}>Correo *</Text>
            <TextInput style={styles.textInput} value={nuevoCorreo} onChangeText={setNuevoCorreo} placeholder="ponente@correo.com" placeholderTextColor="#9E9E9E" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.inputLabel}>Especialidad</Text>
            <TextInput style={styles.textInput} value={nuevoEspecialidad} onChangeText={setNuevoEspecialidad} placeholder="Robótica Industrial" placeholderTextColor="#9E9E9E" />
            <Text style={styles.inputLabel}>Empresa / Institución</Text>
            <TextInput style={styles.textInput} value={nuevoEmpresa} onChangeText={setNuevoEmpresa} placeholder="UTEQ" placeholderTextColor="#9E9E9E" />
            <Text style={[styles.inputLabel, { color: '#9E9E9E', marginTop: 16 }]}>
              Se creará una cuenta con contraseña temporal: MechGirls2025!
            </Text>
            <TouchableOpacity
              style={[styles.btnGuardar, guardandoNuevo && styles.btnDisabled]}
              onPress={handleCrearPonente}
              disabled={guardandoNuevo}
            >
              {guardandoNuevo ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnGuardarText}>Crear ponente</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancelarModal} onPress={() => setModalNuevo(false)}>
              <Text style={styles.btnCancelarModalText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal semblanza */}
      <Modal visible={modalSemblanza} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mi semblanza</Text>
            <TouchableOpacity onPress={() => setModalSemblanza(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Especialidad</Text>
            <TextInput style={styles.textInput} value={especialidadEdit} onChangeText={setEspecialidadEdit} placeholder="Ej. Robótica Industrial" placeholderTextColor="#9E9E9E" />
            <Text style={styles.inputLabel}>Empresa / Institución</Text>
            <TextInput style={styles.textInput} value={empresaEdit} onChangeText={setEmpresaEdit} placeholder="Ej. UTEQ" placeholderTextColor="#9E9E9E" />
            <Text style={styles.inputLabel}>Semblanza</Text>
            <TextInput
              style={[styles.textInput, { height: 160, textAlignVertical: 'top', paddingTop: 10 }]}
              value={semblanzaTexto}
              onChangeText={v => setSemblanzaTexto(v.slice(0, 1800))}
              placeholder="Describe tu trayectoria, logros y experiencia..."
              placeholderTextColor="#9E9E9E"
              multiline
              numberOfLines={6}
              maxLength={1800}
            />
            <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: '#9E9E9E', marginTop: 4 }}>
              {semblanzaTexto.length}/1800
            </Text>
            <TouchableOpacity
              style={[styles.btnGuardar, guardandoSemblanza && styles.btnDisabled]}
              onPress={handleGuardarSemblanza}
              disabled={guardandoSemblanza}
            >
              {guardandoSemblanza ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnGuardarText}>Guardar semblanza</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancelarModal} onPress={() => setModalSemblanza(false)}>
              <Text style={styles.btnCancelarModalText}>Cancelar</Text>
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
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnSemblanza: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E91E63', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  btnSemblanzaText: { color: '#E91E63', fontWeight: '600', fontSize: 12 },
  btnNuevo: { backgroundColor: '#E91E63', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 15, marginBottom: 16, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#333', fontSize: 14 },
  loader: { marginTop: 60 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8EAF6', borderRadius: 16, padding: 14, alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarInitials: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  name: { fontSize: 13, fontWeight: 'bold', color: '#212121', textAlign: 'center', marginBottom: 4 },
  specialty: { fontSize: 11, color: '#E91E63', textAlign: 'center', marginBottom: 2 },
  company: { fontSize: 11, color: '#757575', textAlign: 'center', marginBottom: 12 },
  profileBtn: { width: '100%', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E91E63', alignItems: 'center' },
  profileBtnText: { color: '#E91E63', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#9E9E9E', marginTop: 40, fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },
  modalBody: { padding: 20, paddingBottom: 60 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#424242', marginBottom: 6, marginTop: 12 },
  textInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#212121', borderWidth: 1, borderColor: '#E0E0E0' },
  btnGuardar: { marginTop: 24, backgroundColor: '#E91E63', borderRadius: 25, paddingVertical: 14, alignItems: 'center' },
  btnGuardarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  btnCancelarModal: { marginTop: 10, borderRadius: 25, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  btnCancelarModalText: { color: '#757575', fontWeight: '600', fontSize: 14 },
  btnDisabled: { backgroundColor: '#E0E0E0' },
});