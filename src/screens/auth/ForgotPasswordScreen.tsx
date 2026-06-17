import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { forgotPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sent, setSent] = useState(false);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('El correo es requerido');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Ingresa un correo válido');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSend() {
    if (!validate()) return;
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      Alert.alert(
        'Error al enviar',
        err.message ?? 'No se pudo enviar el correo. Verifica que el correo esté registrado.',
        [{ text: 'Entendido' }]
      );
    }
  }

  // ─── Estado: correo enviado ──────────────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>📬</Text>
        </View>
        <Text style={styles.title}>Correo enviado</Text>
        <Text style={styles.successText}>
          Enviamos un enlace a{' '}
          <Text style={styles.emailBold}>{email}</Text>
          {'. '}
          Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
        </Text>
        <Text style={styles.spamHint}>
          ¿No lo ves? Revisa también tu carpeta de Spam o correo no deseado.
        </Text>
        <Button
          label="Volver al inicio de sesión"
          onPress={() => navigation.navigate('Login')}
          style={styles.backBtn}
        />
        <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }}>
          <Text style={styles.resendText}>¿No llegó? Intentar de nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Estado: formulario ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.topBack} onPress={() => navigation.goBack()}>
          <Text style={styles.topBackText}>← Regresar</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Text style={styles.lockEmoji}>🔐</Text>
        </View>

        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresa tu correo registrado y te enviaremos un enlace para crear una nueva contraseña.
        </Text>

        <Input
          label="Correo electrónico"
          placeholder="correo@instituto.edu.mx"
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(''); }}
          keyboardType="email-address"
          autoComplete="email"
          error={emailError}
        />

        <Button
          label="Enviar enlace de recuperación"
          onPress={handleSend}
          loading={isLoading}
          style={styles.sendBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    backgroundColor: Colors.background,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  topBack: { marginBottom: 32 },
  topBackText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockEmoji: { fontSize: 28 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  sendBtn: { marginTop: 8 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: { fontSize: 36 },
  successText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  spamHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  emailBold: { color: Colors.text, fontWeight: '600' },
  backBtn: { marginBottom: 16, width: '100%' },
  resendText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
});