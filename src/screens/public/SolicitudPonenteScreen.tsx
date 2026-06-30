import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';

interface FormErrors {
  nombre: string;
  apellidos: string;
  correo: string;
  semblanza: string;
}

export default function SolicitudPonenteScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [nombre,    setNombre]    = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo,    setCorreo]    = useState('');
  const [semblanza, setSemblanza] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [empresa,   setEmpresa]   = useState('');
  const [sitioWeb,  setSitioWeb]  = useState('');
  const [enviando,  setEnviando]  = useState(false);
  const [errors,    setErrors]    = useState<FormErrors>({
    nombre: '', apellidos: '', correo: '', semblanza: '',
  });

  function validate(): boolean {
    const e: FormErrors = { nombre: '', apellidos: '', correo: '', semblanza: '' };
    let valid = true;
    if (!nombre.trim())    { e.nombre    = 'Tu nombre es requerido';       valid = false; }
    if (!apellidos.trim()) { e.apellidos = 'Tus apellidos son requeridos'; valid = false; }
    if (!correo.trim()) {
      e.correo = 'El correo es requerido'; valid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      e.correo = 'Ingresa un correo válido'; valid = false;
    }
    if (!semblanza.trim()) { e.semblanza = 'La semblanza es requerida'; valid = false; }
    setErrors(e);
    return valid;
  }

  async function handleEnviar() {
    if (!validate()) return;
    setEnviando(true);
    try {
      const { error } = await supabase
        .from('solicitudes_ponente')
        .insert({
          nombre:              nombre.trim(),
          apellidos:           apellidos.trim(),
          correo:              correo.trim().toLowerCase(),
          semblanza:           semblanza.trim(),
          especialidad:        especialidad.trim() || null,
          empresa_institucion: empresa.trim()      || null,
          sitio_web_url:       sitioWeb.trim()     || null,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe una solicitud con ese correo.');
        }
        throw error;
      }

      Alert.alert(
        '¡Solicitud enviada!',
        'El equipo de Mech Girls revisará tu información y recibirás un correo cuando tu cuenta esté lista.',
        [{ text: 'Entendido', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Registro de ponente</Text>
        <Text style={styles.subtitle}>
          Completa tu información. El equipo de Mech Girls revisará tu solicitud
          y te enviará un correo para activar tu cuenta.
        </Text>

        {/* Datos personales */}
        <Text style={styles.sectionLabel}>Datos personales</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Nombre"
              placeholder="Ana"
              value={nombre}
              onChangeText={setNombre}
              error={errors.nombre}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Apellidos"
              placeholder="López Ríos"
              value={apellidos}
              onChangeText={setApellidos}
              error={errors.apellidos}
            />
          </View>
        </View>

        <Input
          label="Correo electrónico"
          placeholder="correo@ejemplo.com"
          value={correo}
          onChangeText={setCorreo}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.correo}
        />

        {/* Semblanza */}
        <Text style={styles.sectionLabel}>Semblanza *</Text>
        <Input
          label=""
          placeholder="Escribe una breve descripción de tu trayectoria y experiencia profesional..."
          value={semblanza}
          onChangeText={setSemblanza}
          multiline
          numberOfLines={5}
          error={errors.semblanza}
        />
        <Text style={styles.charCount}>{semblanza.length}/1800</Text>

        {/* Datos profesionales (opcionales) */}
        <Text style={styles.sectionLabel}>Datos profesionales <Text style={styles.opcional}>(opcional)</Text></Text>

        <Input
          label="Especialidad"
          placeholder="Ej. Robótica, Inteligencia Artificial..."
          value={especialidad}
          onChangeText={setEspecialidad}
        />
        <Input
          label="Empresa / Institución"
          placeholder="Ej. UTEQ, Instituto XYZ..."
          value={empresa}
          onChangeText={setEmpresa}
        />
        <Input
          label="Sitio web"
          placeholder="https://..."
          value={sitioWeb}
          onChangeText={setSitioWeb}
          keyboardType="url"
          autoCapitalize="none"
        />

        <Button
          label="Enviar solicitud"
          onPress={handleEnviar}
          loading={enviando}
          style={styles.submitBtn}
        />

        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.background },
  container:   { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60 },
  backBtn:     { marginBottom: 24 },
  backText:    { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  title:       { fontSize: 26, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle:    { fontSize: 13, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  sectionLabel:{ fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 8, marginBottom: 4 },
  opcional:    { fontWeight: '400', color: Colors.textSecondary },
  row:         { flexDirection: 'row', gap: 10 },
  half:        { flex: 1 },
  charCount:   { fontSize: 12, color: Colors.textSecondary, textAlign: 'right', marginTop: -8, marginBottom: 12 },
  submitBtn:   { marginTop: 8, marginBottom: 20 },
  loginLinkContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  loginText:   { fontSize: 13, color: Colors.textSecondary },
  loginLink:   { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});