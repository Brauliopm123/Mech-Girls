import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, loginComoInvitada } = useAuth();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ correo: '', contrasena: '' });

  // Apagar el spinner si onAuthStateChange autentica al usuario
  // antes de que handleLogin termine (el navigator redirigirá después).
  useEffect(() => {
    if (isAuthenticated) setLoading(false);
  }, [isAuthenticated]);

  function validate(): boolean {
    const e = { correo: '', contrasena: '' };
    let valid = true;
    if (!correo.trim()) {
      e.correo = 'El correo es requerido'; valid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      e.correo = 'Ingresa un correo válido'; valid = false;
    }
    if (!contrasena) {
      e.contrasena = 'La contraseña es requerida'; valid = false;
    } else if (contrasena.length < 6) {
      e.contrasena = 'Mínimo 6 caracteres'; valid = false;
    }
    setErrors(e);
    return valid;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      // Solo hace el signInWithPassword — onAuthStateChange maneja el resto
      await login({ correo, contrasena });
    } catch (err: any) {
      console.log('LOGIN ERROR:', JSON.stringify(err));
      console.log('LOGIN ERROR message:', err.message);
      Alert.alert('Error al iniciar sesión', err.message);
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/logo_mech-girls.jpeg')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Bienvenida de vuelta</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

          <Input
            label="Correo electrónico"
            placeholder="correo@instituto.edu.mx"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.correo}
          />

          <Input
            label="Contraseña"
            placeholder="Tu contraseña"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry
            autoComplete="password"
            error={errors.contrasena}
          />

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Button
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Crear cuenta nueva"
            variant="outline"
            onPress={() => navigation.navigate('Register')}
          />

          <TouchableOpacity style={styles.guestBtn} onPress={loginComoInvitada}>
            <Text style={styles.guestBtnText}>Continuar como invitada →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  guestBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  guestBtnText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', borderWidth: 3, borderColor: Colors.primaryBorder, elevation: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  logoImage: { width: '100%', height: '100%' },
  form: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  loginBtn: { marginBottom: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textMuted },
});