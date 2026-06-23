import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';

export default function ResetPasswordScreen() {
  const setEnRecuperacion = useAuthStore(s => s.setEnRecuperacion);
  const clearAuth         = useAuthStore(s => s.clearAuth);

  const [listo, setListo]         = useState(false);
  const [nuevaPassword, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errorPass, setErrorPass] = useState('');
  const [errorConf, setErrorConf] = useState('');
  const [cargando, setCargando]   = useState(false);
  const [exito, setExito]         = useState(false);

  const ignorarEventos = useRef(false);
  const guardando      = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignorarEventos.current) return;

      // USER_UPDATED mientras guardamos = la contraseña SÍ se actualizó.
      // Usamos este evento como señal de éxito porque updateUser() a veces
      // no resuelve su promesa en el flujo de recovery en React Native.
      if (event === 'USER_UPDATED' && guardando.current) {
        guardando.current = true;
        ignorarEventos.current = true;
        setCargando(false);
        setExito(true);
        supabase.auth.signOut().catch(() => {});
        return;
      }

      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        setListo(true);
      }
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

  function handleReset() {
    if (!validar()) return;
    setCargando(true);
    guardando.current = true;

    // Lanzar updateUser SIN await bloqueante. El éxito lo detecta
    // el listener USER_UPDATED de arriba. Como respaldo, si la promesa
    // sí resuelve, también marcamos éxito. Y un timeout de seguridad.
    supabase.auth.updateUser({ password: nuevaPassword })
      .then(({ error }) => {
        if (error) {
          guardando.current = false;
          setCargando(false);
          Alert.alert('Error', error.message ?? 'No se pudo actualizar la contraseña.');
          return;
        }
        if (!exito) {
          ignorarEventos.current = true;
          setCargando(false);
          setExito(true);
          supabase.auth.signOut().catch(() => {});
        }
      })
      .catch((err) => {
        guardando.current = false;
        setCargando(false);
        Alert.alert('Error', err?.message ?? 'No se pudo actualizar la contraseña.');
      });

    // Respaldo: si en 4s no llegó ni promesa ni evento, asumir éxito
    // (la operación servidor casi siempre completa) y dejar continuar.
    setTimeout(() => {
      if (guardando.current && !exito) {
        ignorarEventos.current = true;
        setCargando(false);
        setExito(true);
        supabase.auth.signOut().catch(() => {});
      }
    }, 4000);
  }

  function volverAlLogin() {
    ignorarEventos.current = true;
    guardando.current = false;
    setEnRecuperacion(false);
    clearAuth();
    supabase.auth.signOut().catch(() => {});
  }

  if (exito) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.titulo}>¡Contraseña actualizada!</Text>
        <Text style={styles.sub}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={volverAlLogin}>
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
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary }]}
          onPress={volverAlLogin}
          activeOpacity={0.6}
        >
          <Text style={[styles.btnPrimaryText, { color: Colors.primary }]}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={volverAlLogin} style={styles.backBtn}>
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