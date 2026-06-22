import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../../components/common/FormElements';
import { Colors } from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { forgotPassword } = useAuth();

  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar() {
    if (!correo.trim() || !/\S+@\S+\.\S+/.test(correo)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(correo);
      setEnviado(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.icono}>📧</Text>
        <Text style={styles.titulo}>Revisa tu correo</Text>
        <Text style={styles.descripcion}>
          Enviamos un enlace a{'\n'}<Text style={styles.correoTexto}>{correo}</Text>
          {'\n\n'}Abre el enlace en tu teléfono para restablecer tu contraseña.
          {'\n\n'}
          <Text style={styles.nota}>
            Nota: si el enlace abre un navegador en vez de la app, cópialo y ábrelo desde el teléfono donde tienes instalada la app.
          </Text>
        </Text>
        <TouchableOpacity style={styles.volverBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.volverText}>Volver al inicio de sesión</Text>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Regresar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>¿Olvidaste tu contraseña?</Text>
        <Text style={styles.descripcion}>
          Ingresa tu correo y te enviaremos un enlace para restablecerla.
        </Text>

        <Input
          label="Correo electrónico"
          placeholder="correo@instituto.edu.mx"
          value={correo}
          onChangeText={setCorreo}
          keyboardType="email-address"
          autoComplete="email"
        />

        <Button
          label="Enviar enlace"
          onPress={handleEnviar}
          loading={loading}
          style={styles.btn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { 
    flex: 1, 
    backgroundColor: Colors.background 
  },
  container: 
  { flexGrow: 1, 
    paddingHorizontal: 28, 
    paddingTop: 60, 
    paddingBottom: 40 
  },
  centrado: { 
    flex: 1, 
    backgroundColor: Colors.background, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 32 
  },
  backBtn: { 
    marginBottom: 24 
  },
  backText: { 
    fontSize: 14, 
    color: Colors.primary, 
    fontWeight: '500' 
  },
  titulo: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: Colors.text, 
    marginBottom: 12 
  },
  descripcion: { 
    fontSize: 14, 
    color: Colors.textSecondary, 
    marginBottom: 28, 
    lineHeight: 22, 
    textAlign: 'center' 
  },
  icono: { 
    fontSize: 56, 
    marginBottom: 20 
  },
  correoTexto: { 
    fontWeight: '700', 
    color: Colors.text 
  },
  nota: { 
    fontSize: 12, 
    color: Colors.textMuted, 
    fontStyle: 'italic' 
  },
  btn: { 
    marginTop: 8 
  },
  volverBtn: { 
    marginTop: 32, 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: Colors.primary 
  },
  volverText: { 
    color: Colors.primary, 
    fontWeight: '600', 
    fontSize: 14 
  },
});