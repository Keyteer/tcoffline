import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';

export function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { isBackendReachable, pendingMutations } = useConnectivity();

  if (isBackendReachable && pendingMutations === 0) return null;

  const styles = StyleSheet.create({
    banner: {
      backgroundColor: isBackendReachable ? colors.warningLight : colors.errorLight,
      borderWidth: 1,
      borderColor: isBackendReachable ? colors.warningBorder : colors.errorBorder,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isBackendReachable ? colors.warning : colors.error,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: isBackendReachable ? colors.warning : colors.error,
      fontWeight: '500',
    },
  });

  let message: string;
  if (!isBackendReachable) {
    message = pendingMutations > 0
      ? `${t.offline.banner} · ${pendingMutations} ${pendingMutations === 1 ? t.offline.pendingChange : t.offline.pendingChanges}`
      : t.offline.banner;
  } else {
    message = `${pendingMutations} ${pendingMutations === 1 ? t.offline.pendingChange : t.offline.pendingChanges} ${t.offline.syncing}`;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
