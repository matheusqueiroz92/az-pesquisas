import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '../components/banner';
import { AzSymbol } from '../components/az-symbol';
import { Button } from '../components/button';
import { TextField } from '../components/text-field';
import { t } from '../i18n';
import { API_URL } from '../services';
import { useSession } from '../session-context';
import { signInMessage } from '../sign-in-message';
import { colors, fonts, space } from '../theme';

export function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showHint, setShowHint] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const failure = await signIn(email.trim(), password);
    setBusy(false);
    if (failure) {
      setError(signInMessage(failure));
      setShowHint(failure.kind === 'rejected');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.band}>
        <AzSymbol height={44} />
        <Text style={styles.bandTitle}>{t.app.name}</Text>
      </SafeAreaView>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.title}>
              {t.signIn.title}
            </Text>
            <Text style={styles.intro}>{t.signIn.intro}</Text>
            {error ? (
              <ErrorBanner message={error} {...(showHint ? { hint: t.signIn.lockoutHint } : {})} />
            ) : null}
            <TextField
              label={t.signIn.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
            />
            <TextField
              label={t.signIn.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => {
                void submit();
              }}
            />
            <Button
              label={busy ? t.signIn.submitting : t.signIn.submit}
              busy={busy}
              disabled={email.trim() === '' || password === ''}
              onPress={() => {
                void submit();
              }}
            />
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t.signIn.server}: <Text style={styles.mono}>{API_URL}</Text>
            </Text>
            <Text style={styles.footerText}>{t.app.byline}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  band: {
    backgroundColor: colors.sidebar.background,
    paddingHorizontal: space[6],
    paddingBottom: space[6],
    paddingTop: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    // The red "linha AZ" closes the dark band (spec 012).
    borderBottomWidth: 3,
    borderBottomColor: colors.sidebar.accent,
  },
  bandTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.sidebar.foreground,
    letterSpacing: -0.3,
  },
  content: { flexGrow: 1, padding: space[6], justifyContent: 'space-between', gap: space[8] },
  form: { gap: space[5], width: '100%', maxWidth: 440, alignSelf: 'center', paddingTop: space[4] },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    color: colors.foreground,
    letterSpacing: -0.8,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mutedForeground,
    marginTop: -space[3],
  },
  footer: { gap: 4, alignItems: 'center' },
  footerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  mono: { fontFamily: fonts.mono },
});
