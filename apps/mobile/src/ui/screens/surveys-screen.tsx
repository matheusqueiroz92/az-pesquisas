import { StyleSheet, Text, View } from 'react-native';

import { ClipboardIcon } from '../components/icons';
import { t } from '../i18n';
import { colors, fonts, radii, space } from '../theme';

/** Rule 12: empty until F1 brings surveys through the sync. */
export function SurveysScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <ClipboardIcon color={colors.mutedForeground} size={28} />
        </View>
        <Text style={styles.title}>{t.surveys.emptyTitle}</Text>
        <Text style={styles.body}>{t.surveys.emptyBody}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space[6],
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: space[3],
    padding: space[8],
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.foreground, textAlign: 'center' },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 360,
  },
});
