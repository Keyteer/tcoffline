import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { X } from 'react-native-feather';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { formatTimeAgo } from '../lib/timeAgo';
import { useResponsive, LAYOUT_MAX } from '../hooks/useResponsive';
import type { SyncStats } from '../types';

type Props = {
  syncStats: SyncStats | null;
};

// Diagnostic indicator showing the full upload chain:
//   App  ── link1 ──  Servidor local  ── link2 ──  Servidor central
// link1 = device → hospital server (`isBackendReachable` from
// ConnectivityContext). link2 = hospital server → central HIS
// (`syncStats.connection.is_online`, computed server-side).
//
// Layout: three nodes spread edge-to-edge (left / center / right) with
// drawn lines between them. Each link can show a backlog badge above and
// a "last activity" caption below; broken links draw a red "✕" badge in
// the middle of the line.
export function SyncPipeline({ syncStats }: Props) {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const {
    isBackendReachable,
    pendingOutbox,
    lastBackendLossAt,
    lastDeviceSendAt,
  } = useConnectivity();
  const { isWide } = useResponsive();

  const link1Ok = isBackendReachable;
  const link2Ok = !!syncStats?.connection.is_online;
  // Tri-state for the hospital server → central HIS link.
  // Falls back to 'offline' when stats aren't loaded yet or the backend
  // doesn't expose the `status` field.
  const link2Status: 'online' | 'warning' | 'offline' =
    syncStats?.connection.status ?? (link2Ok ? 'online' : 'offline');

  const tp = t.syncPipeline;
  const fmtAgo = (iso: string | null) => (iso ? formatTimeAgo(iso, language) : tp.never);
  // Convert ms epoch (from local store / loss tracker) into the ISO string
  // formatTimeAgo expects.
  const fmtMs = (ms: number | null) =>
    fmtAgo(ms ? new Date(ms).toISOString() : null);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 14,
      marginBottom: 8,
      gap: 8,
      // Keep the chain narrow on tablets / desktops so nodes don't drift far
      // apart and labels stay readable. Centred within the parent container.
      width: '100%',
      maxWidth: LAYOUT_MAX.pipeline,
      alignSelf: isWide ? 'center' : 'stretch',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    nodeCol: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    node: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    nodeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    linkCol: {
      flex: 1,
      minWidth: 40,
      // Vertically center the line at the same y as the node label.
      // Node label height ~16 (12px font * ~1.3 line-height) + 6+6 padding +
      // 2px border ≈ 30. Half of that ≈ 15.
      paddingTop: 15,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      position: 'relative',
    },
    line: {
      height: 2,
      width: '100%',
      borderRadius: 1,
    },
    lineOk: { backgroundColor: colors.success },
    lineDown: { backgroundColor: colors.error },
    lineWarning: { backgroundColor: colors.warning },
    badge: {
      position: 'absolute',
      top: -2,
      alignSelf: 'center',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warningBorder,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.warning,
    },
    xMark: {
      position: 'absolute',
      top: 4,
      alignSelf: 'center',
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkCaption: {
      marginTop: 14,
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 2,
    },
  });

  const renderLink = (
    ok: boolean,
    badgeText: string | null,
    caption: string,
    status?: 'online' | 'warning' | 'offline',
  ) => {
    // Resolve the line style from the tri-state when provided, else fall back
    // to the binary ok/down logic used for link1.
    const resolvedStatus = status ?? (ok ? 'online' : 'offline');
    const lineStyle =
      resolvedStatus === 'online'
        ? styles.lineOk
        : resolvedStatus === 'warning'
        ? styles.lineWarning
        : styles.lineDown;
    const isDown = resolvedStatus === 'offline';
    const isWarning = resolvedStatus === 'warning';

    return (
      <View style={styles.linkCol}>
        <View style={[styles.line, lineStyle]} />
        {isDown && (
          <View style={styles.xMark}>
            <X width={10} height={10} color={colors.error} />
          </View>
        )}
        {isWarning && (
          <View style={[styles.xMark, { borderColor: colors.warning, backgroundColor: colors.warningLight }]}>
            <Text style={{ fontSize: 10, color: colors.warning, fontWeight: '700' }}>!</Text>
          </View>
        )}
        {!!badgeText && (
          <View style={[styles.badge, (isDown || isWarning) && { top: -16 }]}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        <Text style={styles.linkCaption}>{caption}</Text>
      </View>
    );
  };

  const outboxBadge =
    pendingOutbox > 0 ? tp.pendingInOutbox.replace('{n}', String(pendingOutbox)) : null;
  const eventsBadge =
    syncStats && syncStats.pending_events > 0
      ? tp.pendingEvents.replace('{n}', String(syncStats.pending_events))
      : null;

  // link1 (App → Local server):
  //   up   → "sent {ago}" using the device's own last successful POST
  //          (from localStore via ConnectivityContext).
  //   down → "Lost connection, {ago}" using the loss-edge timestamp; if we
  //          don't have one yet (e.g. app started already offline), fall
  //          back to the bare "Lost connection" string.
  const link1Caption = link1Ok
    ? tp.lastSent.replace('{ago}', fmtMs(lastDeviceSendAt))
    : lastBackendLossAt
    ? tp.lostConnection.replace('{ago}', fmtMs(lastBackendLossAt))
    : tp.lostConnection.replace(', {ago}', '');
  // link2 (Local server → Central HIS):
  //   online   → "sent {ago}" using last_upstream_sync from the hospital server.
  //   warning  → "SSL Warning" — connection alive but cert is invalid.
  //   offline  → "Lost connection, {ago}" using last_downstream_sync as the
  //              best proxy for "last time the link was alive".
  const link2Caption =
    link2Status === 'online'
      ? tp.lastSent.replace('{ago}', fmtAgo(syncStats?.last_upstream_sync ?? null))
      : link2Status === 'warning'
      ? tp.sslWarning
      : tp.lostConnection.replace('{ago}', fmtAgo(syncStats?.last_downstream_sync ?? null));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.nodeCol}>
          <View style={styles.node}>
            <Text style={styles.nodeLabel}>{tp.app}</Text>
          </View>
        </View>

        {renderLink(link1Ok, outboxBadge, link1Caption)}

        <View style={styles.nodeCol}>
          <View style={styles.node}>
            <Text style={styles.nodeLabel}>{tp.localServer}</Text>
          </View>
        </View>

        {/* Only draw the link2 line when link1 is up, but always render the
            flex spacer so the Local node stays centred regardless. */}
        {link1Ok
          ? renderLink(link2Ok, eventsBadge, link2Caption, link2Status)
          : <View style={styles.linkCol} />}

        <View style={styles.nodeCol}>
          <View style={styles.node}>
            <Text style={styles.nodeLabel}>{tp.centralServer}</Text>
          </View>
        </View>
      </View>

    </View>
  );
}
