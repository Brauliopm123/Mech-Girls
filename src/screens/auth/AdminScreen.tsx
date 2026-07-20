import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, TextInput, Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';

interface UsuarioAdmin {
  id_usuario: number;
  correo: string;
  nombre: string;
  apellidos: string;
  nombre_rol: string;
  id_rol: number;
  activo: boolean;
  fecha_registro: string;
}

interface Rol {
  id_rol: number;
  nombre_rol: string;
}

const ROL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:    { bg: '#FFF3E0', text: '#E65100', border: '#FFB74D' },
  ponente:  { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  alumna:   { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
};

export default function AdminScreen() {
  const { usuario, esAdmin, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [filtrados, setFiltrados] = useState<UsuarioAdmin[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('Todos');
  const [modalUsuario, setModalUsuario] = useState<UsuarioAdmin | null>(null);
  const [cambiandoRol, setCambiandoRol] = useState(false);
  const [stats, setStats] = useState({ total: 0, admins: 0, ponentes: 0, alumnas: 0 });
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  // Guard: solo admin puede ver esta pantalla
  if (!esAdmin || !esAdmin()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Feather name="lock" size={48} color={Colors.textMuted} />
          <Text style={styles.noAccessTitle}>Acceso restringido</Text>
          <Text style={styles.noAccessText}>Solo administradoras pueden ver este panel.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cargar = useCallback(async () => {
    try {
      const { data: usData, error } = await supabase
        .from('usuarios')
        .select(`
          id_usuario, correo, activo, fecha_registro,
          perfiles_alumna(nombre, apellidos),
          perfiles_ponente(nombre, apellidos),
          roles(id_rol, nombre_rol)
        `)
        .order('fecha_registro', { ascending: false });

      if (error) throw error;

      const mapped: UsuarioAdmin[] = (usData ?? []).map((u: any) => {
        // Supabase retorna arrays para relaciones 1-N; tomar el primer elemento
        const pa = Array.isArray(u.perfiles_alumna) ? u.perfiles_alumna[0] : u.perfiles_alumna;
        const pp = Array.isArray(u.perfiles_ponente) ? u.perfiles_ponente[0] : u.perfiles_ponente;
        const perfil = pa ?? pp ?? {};
        return {
          id_usuario: u.id_usuario,
          correo: u.correo,
          nombre: perfil.nombre ?? '',
          apellidos: perfil.apellidos ?? '',
          nombre_rol: u.roles?.nombre_rol ?? 'sin rol',
          id_rol: u.roles?.id_rol ?? 0,
          activo: u.activo ?? 1,
          fecha_registro: u.fecha_registro,
        };
      });

      setUsuarios(mapped);
      setStats({
        total: mapped.length,
        admins: mapped.filter(u => u.nombre_rol === 'admin').length,
        ponentes: mapped.filter(u => u.nombre_rol === 'ponente').length,
        alumnas: mapped.filter(u => u.nombre_rol === 'alumna').length,
      });

      const { data: rolesData } = await supabase.from('roles').select('id_rol, nombre_rol');
      setRoles((rolesData as Rol[]) ?? []);

      const { count } = await supabase
        .from('solicitudes_ponente')
        .select('id_solicitud', { count: 'exact', head: true })
        .eq('estado', 'pendiente');
      setSolicitudesPendientes(count ?? 0);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    let result = usuarios;
    if (filtroRol !== 'Todos') result = result.filter(u => u.nombre_rol === filtroRol);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(u =>
        u.correo.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.apellidos.toLowerCase().includes(q)
      );
    }
    setFiltrados(result);
  }, [busqueda, filtroRol, usuarios]);

  const handleCambiarRol = async (u: UsuarioAdmin, nuevoRol: Rol) => {
    if (nuevoRol.id_rol === u.id_rol) { setModalUsuario(null); return; }
    setCambiandoRol(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ id_rol: nuevoRol.id_rol })
        .eq('id_usuario', u.id_usuario);
      if (error) throw error;
      Alert.alert('¡Actualizado!', `Rol de ${u.nombre || u.correo} cambiado a ${nuevoRol.nombre_rol}.`);
      setModalUsuario(null);
      cargar();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCambiandoRol(false);
    }
  };

  const handleToggleActivo = async (u: UsuarioAdmin) => {
    const accion = u.activo ? 'desactivar' : 'activar';
    Alert.alert(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} cuenta?`,
      `${u.nombre || u.correo} quedará ${u.activo ? 'inactiva' : 'activa'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: accion.charAt(0).toUpperCase() + accion.slice(1),
          style: u.activo ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await supabase.from('usuarios').update({ activo: !u.activo }).eq('id_usuario', u.id_usuario);
              cargar();
            } catch (err: any) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  };

  // Cierra el modal y luego navega al perfil público de esa usuaria.
  // El setTimeout es necesario: en iOS, navegar con un Modal pageSheet aún
  // montado deja la pantalla nueva atrapada detrás del modal.
  const verPublicaciones = (u: UsuarioAdmin) => {
    setModalUsuario(null);
    setTimeout(() => {
      navigation.navigate('PerfilPublico', {
        idUsuario: u.id_usuario,
        nombre: u.nombre,
        apellidos: u.apellidos,
        foto: null,
      });
    }, 300);
  };

  const renderUsuario = ({ item }: { item: UsuarioAdmin }) => {
    const rolColor = ROL_COLORS[item.nombre_rol] ?? { bg: '#F5F5F5', text: '#757575', border: '#E0E0E0' };
    const initials = `${item.nombre.charAt(0)}${item.apellidos.charAt(0)}`.toUpperCase() || item.correo.charAt(0).toUpperCase();
    return (
      <TouchableOpacity style={[styles.card, !item.activo && styles.cardInactivo]} onPress={() => setModalUsuario(item)} activeOpacity={0.8}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, !item.activo && { backgroundColor: '#BDBDBD' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardNombre} numberOfLines={1}>
                {item.nombre ? `${item.nombre} ${item.apellidos}` : item.correo}
              </Text>
              {!item.activo && (
                <View style={styles.inactivoBadge}>
                  <Text style={styles.inactivoBadgeText}>Inactiva</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardCorreo} numberOfLines={1}>{item.correo}</Text>
            <View style={[styles.rolBadge, { backgroundColor: rolColor.bg, borderColor: rolColor.border }]}>
              <Text style={[styles.rolBadgeText, { color: rolColor.text }]}>{item.nombre_rol}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  const filtrosRol = ['Todos', 'admin', 'ponente', 'alumna'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel Admin</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert('Cerrar sesión', '¿Segura que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: logout },
          ])}
        >
          <Feather name="log-out" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLabel}>Usuarias</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: '#E65100' }]}>{stats.admins}</Text><Text style={styles.statLabel}>Admins</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: '#2E7D32' }]}>{stats.ponentes}</Text><Text style={styles.statLabel}>Ponentes</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: '#1565C0' }]}>{stats.alumnas}</Text><Text style={styles.statLabel}>Alumnas</Text></View>
      </View>

      {/* Botón solicitudes de ponente */}
      <TouchableOpacity
        style={styles.solicitudesBtn}
        onPress={() => navigation.navigate('Solicitudes')}
      >
        <Feather name="user-plus" size={18} color={Colors.primary} />
        <Text style={styles.solicitudesBtnText}>Solicitudes de ponente</Text>
        {solicitudesPendientes > 0 && (
          <View style={styles.solicitudesBadge}>
            <Text style={styles.solicitudesBadgeText}>{solicitudesPendientes}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={Colors.textSecondary} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* Búsqueda */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor={Colors.textMuted}
        />
        {busqueda.length > 0 && <TouchableOpacity onPress={() => setBusqueda('')}><Feather name="x" size={16} color={Colors.textMuted} /></TouchableOpacity>}
      </View>

      {/* Filtros rol */}
      <View style={styles.filtrosRow}>
        {filtrosRol.map(f => (
          <TouchableOpacity key={f} style={[styles.filtroPill, filtroRol === f && styles.filtroPillActivo]} onPress={() => setFiltroRol(f)}>
            <Text style={[styles.filtroText, filtroRol === f && styles.filtroTextActivo]}>
              {f === 'Todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={i => String(i.id_usuario)}
          renderItem={renderUsuario}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Sin resultados.</Text>}
        />
      )}

      {/* Modal detalle usuario */}
      <Modal visible={!!modalUsuario} animationType="slide" presentationStyle="pageSheet">
        {modalUsuario && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestionar usuaria</Text>
              <TouchableOpacity onPress={() => setModalUsuario(null)}>
                <Feather name="x" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Info */}
              <View style={styles.modalUsuarioInfo}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {`${modalUsuario.nombre.charAt(0)}${modalUsuario.apellidos.charAt(0)}`.toUpperCase() || modalUsuario.correo.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.modalNombre}>
                  {modalUsuario.nombre ? `${modalUsuario.nombre} ${modalUsuario.apellidos}` : 'Sin nombre'}
                </Text>
                <Text style={styles.modalCorreo}>{modalUsuario.correo}</Text>
                <Text style={styles.modalFecha}>
                  Registro: {new Date(modalUsuario.fecha_registro).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {/* Ver publicaciones de esta usuaria */}
              <TouchableOpacity
                style={styles.btnVerPublicaciones}
                onPress={() => verPublicaciones(modalUsuario)}
                activeOpacity={0.8}
              >
                <View style={styles.verPubIconWrapper}>
                  <Feather name="grid" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verPubTitulo}>Ver publicaciones</Text>
                  <Text style={styles.verPubSubtitulo}>Revisar su actividad en el feed</Text>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              {/* Cambiar rol */}
              <Text style={styles.seccionTitle}>Rol asignado</Text>
              <View style={styles.rolesGrid}>
                {roles.map(r => {
                  const rc = ROL_COLORS[r.nombre_rol] ?? { bg: '#F5F5F5', text: '#757575', border: '#E0E0E0' };
                  const activo = r.id_rol === modalUsuario.id_rol;
                  return (
                    <TouchableOpacity
                      key={r.id_rol}
                      style={[styles.rolOpcion, activo && { borderColor: rc.border, backgroundColor: rc.bg }]}
                      onPress={() => handleCambiarRol(modalUsuario, r)}
                      disabled={cambiandoRol}
                    >
                      {cambiandoRol && activo
                        ? <ActivityIndicator size="small" color={rc.text} />
                        : <>
                            <Feather
                              name={r.nombre_rol === 'admin' ? 'shield' : r.nombre_rol === 'ponente' ? 'mic' : 'user'}
                              size={18}
                              color={activo ? rc.text : Colors.textMuted}
                            />
                            <Text style={[styles.rolOpcionText, activo && { color: rc.text, fontWeight: '700' }]}>
                              {r.nombre_rol.charAt(0).toUpperCase() + r.nombre_rol.slice(1)}
                            </Text>
                            {activo && <Feather name="check" size={14} color={rc.text} />}
                          </>
                      }
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Activar / Desactivar */}
              <Text style={styles.seccionTitle}>Estado de la cuenta</Text>
              <TouchableOpacity
                style={[styles.btnEstado, modalUsuario.activo ? styles.btnDesactivar : styles.btnActivar]}
                onPress={() => { handleToggleActivo(modalUsuario); setModalUsuario(null); }}
              >
                <Feather
                  name={modalUsuario.activo ? 'user-x' : 'user-check'}
                  size={18}
                  color={modalUsuario.activo ? '#D32F2F' : '#2E7D32'}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.btnEstadoText, { color: modalUsuario.activo ? '#D32F2F' : '#2E7D32' }]}>
                  {modalUsuario.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noAccessTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  noAccessText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  logoutBtn: { padding: 6 },
  solicitudesBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 14, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12 },
  solicitudesBtnText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  solicitudesBadge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  solicitudesBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border, paddingHorizontal: 14, marginBottom: 12, height: 44 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  filtrosRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14, flexWrap: 'wrap' },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  filtroPillActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryPale },
  filtroText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  filtroTextActivo: { color: Colors.primary, fontWeight: '600' },
  lista: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardInactivo: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardNombre: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  cardCorreo: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  rolBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  rolBadgeText: { fontSize: 11, fontWeight: '700' },
  inactivoBadge: { backgroundColor: '#EEEEEE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  inactivoBadgeText: { fontSize: 10, color: '#757575', fontWeight: '600' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20, paddingBottom: 60 },
  modalUsuarioInfo: { alignItems: 'center', marginBottom: 24 },
  modalAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  modalAvatarText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  modalNombre: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  modalCorreo: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  modalFecha: { fontSize: 11, color: Colors.textMuted },
  seccionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, marginTop: 8 },
  btnVerPublicaciones: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginBottom: 18,
    backgroundColor: Colors.primaryPale, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  verPubIconWrapper: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  verPubTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  verPubSubtitulo: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rolesGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  rolOpcion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  rolOpcionText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  btnEstado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 25, borderWidth: 1.5 },
  btnDesactivar: { borderColor: '#FFCDD2', backgroundColor: '#FFEBEE' },
  btnActivar: { borderColor: '#C8E6C9', backgroundColor: '#E8F5E9' },
  btnEstadoText: { fontSize: 15, fontWeight: '700' },
});