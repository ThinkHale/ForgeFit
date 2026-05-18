import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { authService } from '../../services/supabase';
import { colors, typography, spacing, radius, shadows } from '../../theme';

function generateNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function friendlyError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('Email not confirmed')) return 'Check your email to confirm your account.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be')) return 'Password must be at least 6 characters.';
  if (message.includes('Unable to validate')) return 'Apple Sign In failed. Please try again.';
  return message;
}

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAppleSignIn() {
    setAppleLoading(true);
    setError('');
    try {
      const rawNonce = generateNonce();
      const hashedNonce = await sha256(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) throw new Error('No identity token returned from Apple.');

      await authService.signInWithApple(credential.identityToken, rawNonce);
      // Auth state change in App.tsx handles navigation automatically
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // user dismissed the sheet — no error needed
      } else {
        setError(friendlyError(e.message ?? 'Apple Sign In failed.'));
      }
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        await authService.signUp(email.trim(), password, name.trim());
        Alert.alert('Check your email', 'We sent you a confirmation link. Click it to activate your account.');
      } else {
        await authService.signIn(email.trim(), password);
      }
    } catch (e: any) {
      setError(friendlyError(e.message ?? 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin');
    setError('');
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={s.brand}>
            <LinearGradient colors={colors.gradients.brand as [string, string]} style={s.logoRing}>
              <Text style={s.logoText}>F</Text>
            </LinearGradient>
            <Text style={s.appName}>Forge</Text>
            <Text style={s.tagline}>Your AI fitness coach</Text>
          </View>

          {/* Card */}
          <View style={s.card}>

            {/* Apple Sign In */}
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={s.appleBtn}
              onPress={handleAppleSignIn}
            />

            {appleLoading && (
              <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.sm }} />
            )}

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or continue with email</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Mode toggle */}
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, mode === 'signin' && s.toggleActive]}
                onPress={() => { setMode('signin'); setError(''); }}
              >
                <Text style={[s.toggleLabel, mode === 'signin' && s.toggleLabelActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, mode === 'signup' && s.toggleActive]}
                onPress={() => { setMode('signup'); setError(''); }}
              >
                <Text style={[s.toggleLabel, mode === 'signup' && s.toggleLabelActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            {mode === 'signup' && (
              <TextInput
                style={s.input}
                placeholder="Your name"
                placeholderTextColor={colors.text.tertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            )}

            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor={colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleEmailAuth}
            />

            {error !== '' && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleEmailAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={colors.gradients.brand as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitGradient}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitLabel}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMode} style={s.switchRow}>
              <Text style={s.switchText}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={s.switchLink}>{mode === 'signin' ? 'Sign Up' : 'Sign In'}</Text>
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background.secondary },
  flex:    { flex: 1 },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },

  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logoRing: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.brand,
  },
  logoText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  appName:  { ...typography.h1, color: colors.text.primary },
  tagline:  { ...typography.body, color: colors.text.secondary, marginTop: 4 },

  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },

  appleBtn: { width: '100%', height: 52 },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border.light },
  dividerText: { ...typography.caption, color: colors.text.tertiary, marginHorizontal: spacing.sm },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  toggleBtn:         { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  toggleActive:      { backgroundColor: colors.background.primary, ...shadows.sm },
  toggleLabel:       { ...typography.smallMed, color: colors.text.secondary },
  toggleLabelActive: { color: colors.text.primary },

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

  errorText: {
    ...typography.small,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  submitBtn:      { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.xs },
  submitGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitLabel:    { ...typography.bodyMed, color: '#fff', fontWeight: '700' },

  switchRow: { alignItems: 'center', marginTop: spacing.md },
  switchText: { ...typography.small, color: colors.text.secondary },
  switchLink: { color: colors.brand.primary, fontWeight: '600' },
});
