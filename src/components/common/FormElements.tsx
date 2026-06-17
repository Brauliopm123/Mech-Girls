import React from 'react';
import {
  TouchableOpacity,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
  TextInputProps,
  TouchableOpacityProps,
} from 'react-native';
import { Colors } from '../../constants/colors';

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'outline';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnOutline,
        (disabled || loading) ? styles.btnDisabled : null,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.btnText, !isPrimary ? styles.btnTextOutline : null]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function Input({ label, error, leftIcon, style, ...props }: InputProps) {
  // Se usa ternario en lugar de && para evitar false en el array de estilos
  const inputStyle: StyleProp<TextStyle>[] = [
    styles.input,
    leftIcon ? styles.inputWithIcon : null,
    style ?? null,
  ];

  return (
    <View style={styles.inputWrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        {leftIcon ? <View style={styles.inputIcon}>{leftIcon}</View> : null}
        <TextInput
          style={inputStyle}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          {...props}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextOutline: {
    color: Colors.primary,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: Colors.text,
    paddingHorizontal: 14,
  },
  inputWithIcon: {
    paddingHorizontal: 0,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.error,
  },
});