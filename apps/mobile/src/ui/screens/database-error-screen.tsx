import { StyleSheet, Text, View } from 'react-native';

import { LockIcon } from '../components/icons';
import { t } from '../i18n';
import { colors, fonts, space } from '../theme';

/** Rule 2: without SQLCipher the app stops here and stores nothing. */
export function DatabaseErrorScreen() {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <LockIcon color={colors.errorForeground} size={36} />
      <Text style={styles.title}>{t.databaseError.title}</Text>
      <Text style={styles.body}>{t.databaseError.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[8],
    gap: space[4],
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.foreground,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 420,
  },
});
