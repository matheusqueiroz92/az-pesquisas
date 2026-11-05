import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '../theme';
import { AlertIcon } from './icons';

/** Error message with an icon: status is never color alone (spec 012). */
export function ErrorBanner({ message, hint }: { message: string; hint?: string }) {
  return (
    <View accessibilityRole="alert" style={styles.box}>
      <AlertIcon color={colors.errorForeground} />
      <View style={styles.texts}>
        <Text style={styles.message}>{message}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: `${colors.error}40`,
  },
  texts: { flex: 1, gap: 4 },
  message: { fontFamily: fonts.semibold, fontSize: 15, color: colors.errorForeground },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.errorForeground },
});
