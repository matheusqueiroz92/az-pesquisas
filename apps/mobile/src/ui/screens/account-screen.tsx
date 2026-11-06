import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/button';
import { LockIcon } from '../components/icons';
import { t } from '../i18n';
import { API_URL, APP_VERSION } from '../services';
import { useSession } from '../session-context';
import { colors, fonts, radii, space } from '../theme';

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

export function AccountScreen() {
  const { state, device, signOut } = useSession();
  if (state.status !== 'signed-in') {
    return null;
  }
  const { user } = state.session;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Row label={t.account.name} value={user.name} />
        <Row label={t.account.email} value={user.email} />
        <Row label={t.account.role} value={t.roles[user.role]} />
      </View>

      <Text style={styles.section}>{t.account.device}</Text>
      <View style={styles.card}>
        {device ? <Row label={t.account.organization} value={device.organization.name} /> : null}
        <Row label={t.account.server} value={API_URL} mono />
        <Row label={t.account.version} value={APP_VERSION} mono />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t.account.database}</Text>
          <View style={styles.secure}>
            <LockIcon color={colors.successForeground} size={16} />
            <Text style={styles.secureText}>{t.account.encrypted(state.cipherVersion)}</Text>
          </View>
        </View>
      </View>

      <Button
        label={t.account.signOut}
        variant="secondary"
        onPress={() => {
          void signOut();
        }}
      />
      <Text style={styles.hint}>{t.account.signOutHint}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: space[6], gap: space[4], maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space[5],
  },
  row: {
    paddingVertical: space[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  rowValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  mono: { fontFamily: fonts.mono, fontSize: 14 },
  section: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: space[2],
  },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  secureText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.successForeground },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
