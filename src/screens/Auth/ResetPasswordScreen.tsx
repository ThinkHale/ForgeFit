import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useStore } from '../../store';
import { colors, typography, spacing, radius, shadows } from '../../theme';

export default function ResetPasswordScreen() {
  const { setResettingPassword } = useStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!password || !confirm) { setError('Please fill in both fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setResettingPassword(false);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <View style={s.container}>
          <Text style={s.title}>Set New Password</Text>
          <Text style={s.subtitle}>Choose a new password for your account.</Text>

          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="New password"
              placeholderTextColor={colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />
            <TextInput
              style={s.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.text.tertiary}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />

            {error !== '' && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={colors.gradients.brand as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.btnGradient}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnLabel}>Update Password</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background.secondary },
  flex:      { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title:     { ...typography.h1, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle:  { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  errorText: { ...typography.small, color: colors.error, marginBottom: spacing.sm, textAlign: 'center' },
  btn:         { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.xs },
  btnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnLabel:    { ...typography.bodyMed, color: '#fff', fontWeight: '700' },
});
