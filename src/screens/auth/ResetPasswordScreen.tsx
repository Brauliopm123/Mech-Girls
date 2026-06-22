import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();

  // listo = true cuando PASSWORD_RECOVERY llegó y la sesión está activa
  const [listo, setListo]             = useState(false);
  const [nuevaPassword, setNueva]     = useState('');
  const [confirmar, setConfirmar]     = useState('');
  const [errorPass, setErrorPass]     = useState('');
  const [errorConf, setErrorConf]     = useState('');
  const [cargando, setCargando]       = useState(false);
  const [exito, setExito]             = useState(false);

  useEffect(() => {
    // AppNavigator ya llamó supabase.auth.setSession() con el token del deep link.
    // Eso dispara PASSWORD_RECOVERY en el listener global de authStore Y aquí.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setListo(true);
      }
    });

    // Si la app ya tenía la sesión recovery activa al montar esta pantalla
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  function validar(): boolean {
    let ok = true;
    if (nuevaPassword.length < 6) {
      setErrorPass('Mínimo 6 caracteres'); ok = false;
    } else setErrorPass('');
    if (nuevaPassword !== confirmar) {
      setErrorConf('Las contraseñas no coinciden'); ok = false;
    } else setErrorConf('');
    return ok;
  }

  async function handleReset() {
    if (!validar()) return;
    setCargando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) throw error;
      // Cerrar la sesión recovery para que la usuaria inicie sesión normalmente
      await supabase.auth.signOut();
      setExito(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo actualizar la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.titulo}>¡Contraseña actualizada!</Text>
        <Text style={styles.sub}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnPrimaryText}>Ir a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!listo) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
        <Text style={styles.titulo}>Verificando enlace…</Text>
        <Text style={styles.sub}>Espera un momento mientras validamos tu sesión.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backBtn}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🔑</Text>
        </View>

        <Text style={styles.titulo}>Nueva contraseña</Text>
        <Text style={styles.sub}>Crea una contraseña segura para tu cuenta.</Text>

        <Input
          label="Nueva contraseña"
          placeholder="Mínimo 6 caracteres"
          value={nuevaPassword}
          onChangeText={t => { setNueva(t); setErrorPass(''); }}
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
  flex:       { flex: 1, backgroundColor: Colors.background },
  container:  { flexGrow: 1, padding: 24, paddingTop: 60 },
  centrado:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.background },
  backBtn:    { marginBottom: 32 },
  backText:   { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryPale, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24, borderWidth: 2, borderColor: Colors.primaryBorder },
  iconEmoji:  { fontSize: 36 },
  titulo:     { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  sub:        { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32, textAlign: 'center' },
  btnGuardar: { marginTop: 24 },
  emoji:      { fontSize: 64, marginBottom: 24 },
  btnPrimary: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25, marginTop: 24 },
  btnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});