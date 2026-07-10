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

interface ConstanciaItem {
  id_inscripcion: number;
  id_evento: number;
  titulo: string;
  fecha_hora_inicio: string;
}

export default function ConstanciasScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const [constancias, setConstancias] = useState<ConstanciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarConstancias = useCallback(async () => {
    if (!usuario?.id_usuario) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data, error } = await supabase
      .from('inscripciones')
      .select('id_inscripcion, id_evento, estado, eventos(titulo, fecha_hora_inicio)')
      .eq('id_usuario', usuario.id_usuario)
      .eq('estado', 'confirmada');

    if (!error) {
      const ahora = new Date();
      const finalizados = (data ?? [])
        .filter((i: any) => i.eventos && new Date(i.eventos.fecha_hora_inicio) < ahora)
        .map((i: any) => ({
          id_inscripcion: i.id_inscripcion,
          id_evento: i.id_evento,
          titulo: i.eventos.titulo,
          fecha_hora_inicio: i.eventos.fecha_hora_inicio,
        }))
        // Más recientes primero
        .sort((a: ConstanciaItem, b: ConstanciaItem) =>
          new Date(b.fecha_hora_inicio).getTime() - new Date(a.fecha_hora_inicio).getTime()
        );
      setConstancias(finalizados);
    }
    setLoading(false);
    setRefreshing(false);
  }, [usuario?.id_usuario]);

  useEffect(() => { cargarConstancias(); }, [cargarConstancias]);

  const verConstancia = (item: ConstanciaItem) => {
    // TODO: reemplazar TU-DOMINIO y el patrón por el endpoint real del compañero (web PHP)
    const url = `https://TU-DOMINIO/constancia.php?id_inscripcion=${item.id_inscripcion}`;
    WebBrowser.openBrowserAsync(url);
  };

  const renderItem = ({ item }: { item: ConstanciaItem }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => verConstancia(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <Feather name="award" size={20} color="#E91E63" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitulo} numberOfLines={2}>{item.titulo}</Text>
        <Text style={styles.itemFecha}>
          {new Date(item.fecha_hora_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
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
        <Text style={styles.headerTitle}>Mis constancias</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E91E63" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={constancias}
          keyExtractor={item => String(item.id_inscripcion)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarConstancias(); }} tintColor="#E91E63" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="award" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aún no tienes constancias disponibles.</Text>
              <Text style={styles.emptySub}>Las constancias aparecen cuando un evento en el que participaste finaliza.</Text>
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
  itemFecha: { fontSize: 12, color: '#9E9E9E', marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: '#616161', fontSize: 15, fontWeight: '600', marginTop: 16 },
  emptySub: { textAlign: 'center', color: '#9E9E9E', fontSize: 13, marginTop: 8, lineHeight: 19 },
});