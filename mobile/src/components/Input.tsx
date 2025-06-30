import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = true,
  style,
  ...props
}) => {
  const inputStyle = [
    styles.input,
    error ? styles.inputError : styles.inputNormal,
    fullWidth && styles.fullWidth,
    style,
  ];

  return (
    <View style={[styles.container, fullWidth && styles.fullWidth]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <TextInput
        style={inputStyle}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputNormal: {
    borderColor: '#d1d5db',
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    color: '#dc2626',
  },
});

export default Input;