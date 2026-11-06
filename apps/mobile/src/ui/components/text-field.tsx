import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, fonts, radii, TOUCH } from '../theme';

interface TextFieldProps extends TextInputProps {
  readonly label: string;
}

export function TextField({ label, style, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        {...props}
        style={[styles.input, focused && styles.focused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.foreground },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.foreground,
  },
  focused: { borderColor: colors.ring, borderWidth: 2, paddingHorizontal: 13 },
});
