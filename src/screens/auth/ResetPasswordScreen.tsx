import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Parámetros que llegan desde el deep link
  // mechgirls://reset-password?token=xxx&correo=yyy
  const token  = route.params?.token  ?? '';
  const correo = route.params?.correo ?? '';

  const [nuevaPassword, setNuevaPassword]     = useState('');
  const [confirmar, setConfirmar]             = useState('');
  const [errorPass, setErrorPass]             = useState('');
  const [errorConf, setErrorConf]             = useState('');
  const [cargando, setCargando]               = useState(false);
  const [exito, setExito]                     = useState(false);

  function validar(): boolean {
    let ok = true;
    if (nuevaPassword.length < 6) {
      setErrorPass('Mínimo 6 caracteres');
      ok = false;
    } else setErrorPass('');
    if (nuevaPassword !== confirmar) {
      setErrorConf('Las contraseñas no coinciden');
      ok = false;
    } else setErrorConf('');
    return ok;
  }

  async function handleReset() {
    if (!validar()) return;
    if (!token || !correo) {
      Alert.alert('Error', 'Enlace inválido o expirado. Solicita uno nuevo.');
      return;
    }
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('fn_reset_password', {
        p_correo: correo.trim().toLowerCase(),
        p_token:  token,
        p_nueva_contrasena: nuevaPassword,
      });
      if (error) throw error;
      if (!data) throw new Error('El enlace expiró o es inválido. Solicita uno nuevo.');
      setExito(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <View style={styles.exitoContainer}>
        <Text style={styles.exitoEmoji}>✅</Text>
        <Text style={styles.exitoTitulo}>¡Contraseña actualizada!</Text>
        <Text style={styles.exitoSub}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
        <TouchableOpacity style={styles.btnLogin} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnLoginText}>Ir a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backBtn}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🔑</Text>
        </View>

        <Text style={styles.titulo}>Nueva contraseña</Text>
        <Text style={styles.sub}>
          Crea una contraseña segura para tu cuenta{correo ? ` (${correo})` : ''}.
        </Text>

        <Input
          label="Nueva contraseña"
          placeholder="Mínimo 6 caracteres"
          value={nuevaPassword}
          onChangeText={t => { setNuevaPassword(t); setErrorPass(''); }}
          secureTextEntry
          error={errorPass}
        />

        <Input
          label="Confirmar contraseña"
          placeholder="Repite tu nueva contraseña"
          value={confirmar}
          onChangeText={t => { setConfirmar(t); setErrorConf(''); }}
          secureTextEntry
          error={errorConf}
        />

        <Button
          label="Guardar contraseña"
          onPress={handleReset}
          loading={cargando}
          style={styles.btnGuardar}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 32 },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryPale, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24, borderWidth: 2, borderColor: Colors.primaryBorder },
  iconEmoji: { fontSize: 36 },
  titulo: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },
  btnGuardar: { marginTop: 24 },
  exitoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.background },
  exitoEmoji: { fontSize: 64, marginBottom: 24 },
  exitoTitulo: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  exitoSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btnLogin: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 },
  btnLoginText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});