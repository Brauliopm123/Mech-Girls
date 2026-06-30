import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register, isLoading } = useAuth();

  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errors, setErrors] = useState({
    nombre: '', apellidos: '', correo: '', contrasena: '', confirmar: '',
  });

  function validate(): boolean {
    const e = { nombre: '', apellidos: '', correo: '', contrasena: '', confirmar: '' };
    let valid = true;
    if (!nombre.trim())    { e.nombre   = 'Tu nombre es requerido';       valid = false; }
    if (!apellidos.trim()) { e.apellidos = 'Tus apellidos son requeridos'; valid = false; }
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
    if (contrasena !== confirmar) {
      e.confirmar = 'Las contraseñas no coinciden'; valid = false;
    }
    setErrors(e);
    return valid;
  }

  async function handleRegister() {
    if (!validate()) return;
    try {
      await register({ nombre, apellidos, correo, contrasena, id_rol: 1 });
      Alert.alert(
        '¡Cuenta creada!',
        'Tu cuenta fue creada. Ya puedes iniciar sesión.',
        [{ text: 'Iniciar sesión', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      Alert.alert('Error al registrarte', err.message);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Únete a la comunidad Mech Girls</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Nombre" placeholder="Ana" value={nombre} onChangeText={setNombre} error={errors.nombre} />
          </View>
          <View style={styles.half}>
            <Input label="Apellidos" placeholder="López Ríos" value={apellidos} onChangeText={setApellidos} error={errors.apellidos} />
          </View>
        </View>

        <Input label="Correo electrónico" placeholder="correo@uteq.edu.mx" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoComplete="email" error={errors.correo} />
        <Input label="Contraseña" placeholder="Mínimo 6 caracteres" value={contrasena} onChangeText={setContrasena} secureTextEntry error={errors.contrasena} />
        <Input label="Confirmar contraseña" placeholder="Repite tu contraseña" value={confirmar} onChangeText={setConfirmar} secureTextEntry error={errors.confirmar} />

        <Text style={styles.termsText}>
          Al registrarte aceptas los{' '}
          <Text style={styles.termsLink}>Términos y Condiciones</Text> de Mech Girls.
        </Text>

        <Button label="Crear cuenta" onPress={handleRegister} loading={isLoading} style={styles.registerBtn} />

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
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  termsText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  termsLink: { color: Colors.primary, fontWeight: '500' },
  registerBtn: { marginBottom: 20 },
  loginLinkContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  loginText: { fontSize: 13, color: Colors.textSecondary },
  loginLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});