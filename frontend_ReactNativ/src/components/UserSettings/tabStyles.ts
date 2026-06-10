import { StyleSheet } from 'react-native';

// Returns a StyleSheet with common tab styles given a colors object from useTheme().
// Each tab calls makeTabStyles(colors) and merges with its own tab-specific styles.
export function makeTabStyles(colors: any) {
  return StyleSheet.create({
    label: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      marginBottom: 12,
    },
    inputDisabled: { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary },
    hint: { fontSize: 11, color: colors.textTertiary, marginTop: -8, marginBottom: 12 },
    errorBox: {
      padding: 12,
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      marginBottom: 12,
    },
    errorText: { fontSize: 13, color: colors.error },
    successBox: {
      padding: 12,
      backgroundColor: colors.successLight,
      borderWidth: 1,
      borderColor: colors.successBorder,
      borderRadius: 8,
      marginBottom: 12,
    },
    successText: { fontSize: 13, color: colors.success },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelButton: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      alignItems: 'center',
    },
    cancelButtonText: { fontWeight: '600', color: colors.textSecondary },
    saveButton: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: 'center',
    },
    saveButtonText: { fontWeight: '600', color: '#FFF' },
  });
}
