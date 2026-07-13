import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import * as WebBrowser from 'expo-web-browser';

interface ReconocimientoItem {
  id_reconocimiento: number;
  nombre_destinatario: string;
  descripcion: string;
  evento: string;
  fecha_evento: string;
  url_pdf: string;
  fecha_creacion: string;
}

export default function ConstanciasScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const [reconocimientos, setReconocimientos] = useState<ReconocimientoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarReconocimientos = useCallback(async () => {
    if (!usuario?.id_usuario) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // La RLS ya filtra por el usuario autenticado; filtramos también
    // explícitamente por claridad.
    const { data, error } = await supabase
      .from('reconocimientos')
      .select('id_reconocimiento, nombre_destinatario, descripcion, evento, fecha_evento, url_pdf, fecha_creacion')
      .eq('id_usuario', usuario.id_usuario)
      .order('fecha_creacion', { ascending: false });

    if (!error) {
      setReconocimientos(data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [usuario?.id_usuario]);

  useEffect(() => { cargarReconocimientos(); }, [cargarReconocimientos]);

  const verReconocimiento = (item: ReconocimientoItem) => {
    // El visor de Google renderiza el PDF en pantalla en vez de descargarlo
    const visor = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(item.url_pdf)}`;
    WebBrowser.openBrowserAsync(visor);
  };

  const renderItem = ({ item }: { item: ReconocimientoItem }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => verReconocimiento(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <Feather name="award" size={20} color="#E91E63" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitulo} numberOfLines={2}>{item.evento}</Text>
        <Text style={styles.itemDescripcion} numberOfLines={1}>{item.descripcion}</Text>
        <Text style={styles.itemFecha}>{item.fecha_evento}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#9E9E9E" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis reconocimientos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E91E63" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={reconocimientos}
          keyExtractor={item => String(item.id_reconocimiento)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); cargarReconocimientos(); }}
              tintColor="#E91E63"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="award" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aún no tienes reconocimientos.</Text>
              <Text style={styles.emptySub}>
                Aquí aparecerán los reconocimientos que se te otorguen por participar como ponente.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  backBtn: { width: 24 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },
  listContainer: { padding: 20, paddingBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE4EC', borderWidth: 1, borderColor: '#F8BBD0', borderRadius: 12, padding: 14, marginBottom: 12 },
  iconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  itemTitulo: { fontSize: 14, fontWeight: '600', color: '#212121' },
  itemDescripcion: { fontSize: 12, color: '#616161', marginTop: 2 },
  itemFecha: { fontSize: 11, color: '#9E9E9E', marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: '#616161', fontSize: 15, fontWeight: '600', marginTop: 16 },
  emptySub: { textAlign: 'center', color: '#9E9E9E', fontSize: 13, marginTop: 8, lineHeight: 19 },
});