import { Action as Pressable, Field as TextInput } from '../action';
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, nativeApi } from '../api';
import { useSession } from '../session';
export default function Auth() {
  const params = useLocalSearchParams<{ token?: string }>(),
    session = useSession();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(
      params.token ? 'reset' : 'signin',
    ),
    [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signin') {
        const result = await auth.signIn.email({ email, password });
        if (result.error)
          throw new Error(
            'Check your email and password; email verification is required.',
          );
        await session.refresh();
        router.replace('/health');
      } else if (mode === 'signup') {
        const result = await auth.signUp.email({
          email,
          password,
          name,
          callbackURL: 'biovitai://auth',
        });
        if (result.error)
          throw new Error('Account creation unavailable. Check your details.');
        setMessage('Verify the captured local email link, then sign in.');
        setMode('signin');
      } else if (mode === 'forgot') {
        await nativeApi('/api/auth/request-password-reset', {
          email,
          redirectTo: 'biovitai://auth',
        });
        setMessage(
          'If this account exists, a reset link is available in the private local mailbox.',
        );
      } else {
        await nativeApi('/api/auth/reset-password', {
          token: params.token,
          newPassword: password,
        });
        setMode('signin');
        setMessage('Password updated. Sign in again.');
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Service unavailable',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.brand}>biovitai ✳</Text>
      <Text style={s.title}>
        {mode === 'signin'
          ? 'Welcome back.'
          : mode === 'signup'
            ? 'A healthier start.'
            : mode === 'reset'
              ? 'Choose a new password.'
              : 'Reset your password.'}
      </Text>
      <Text style={s.note}>Local pilot · synthetic data only</Text>
      {mode === 'signup' && (
        <TextInput
          accessibilityLabel="Your name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          style={s.input}
        />
      )}
      {mode !== 'reset' && (
        <TextInput
          accessibilityLabel="Email address"
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={s.input}
        />
      )}
      {mode !== 'forgot' && (
        <TextInput
          accessibilityLabel="Password"
          placeholder="Password · 12 or more characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={s.input}
        />
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={s.note}>
          {message}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={s.button}
        onPress={() => void submit()}
      >
        <Text style={s.buttonText}>
          {busy
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Save password'
                  : 'Send reset link'}
        </Text>
      </Pressable>
      <View style={s.links}>
        <Pressable
          onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          <Text>
            {mode === 'signup' ? 'Back to sign in' : 'Create account'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode(mode === 'forgot' ? 'signin' : 'forgot')}
        >
          <Text>
            {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
          </Text>
        </Pressable>
      </View>
      <Text style={s.note}>
        Verification and recovery links stay in the private local capture
        mailbox. No external email is sent.
      </Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#f7f8f3',
  },
  brand: {
    fontSize: 34,
    color: '#27614e',
    fontWeight: '600',
    marginBottom: 45,
  },
  title: { fontSize: 32, color: '#243f35', marginBottom: 15 },
  input: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#cbd8c7',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: 'white',
    fontSize: 16,
  },
  button: { backgroundColor: '#27614e', padding: 17, borderRadius: 9 },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  note: { fontSize: 13, color: '#64765e', lineHeight: 21, marginBottom: 20 },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 25,
  },
});
