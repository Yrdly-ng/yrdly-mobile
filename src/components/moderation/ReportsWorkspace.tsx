import { ReportAttachments } from './ReportAttachments';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import {
  ReportAction,
  ReportCase,
  ReportKind,
  actOnReport,
  getReportCase,
  listReportCases,
  reportTitle,
} from '../../lib/moderation/report-cases';

export function ReportsWorkspace() {
  const router = useRouter();
  const [kind, setKind] = useState<ReportKind>('general');
  const [status, setStatus] = useState('open');
  const [childOnly, setChildOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ReportCase[]>([]);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<{ kind: ReportKind; id: string } | null>(null);
  const [detail, setDetail] = useState<ReportCase | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDetail(null);
    const work = selected
      ? getReportCase(selected.kind, selected.id, controller.signal).then((value) => {
          if (!controller.signal.aborted) setDetail(value);
        })
      : listReportCases(kind, status, page, childOnly, controller.signal).then((result) => {
          if (!controller.signal.aborted) {
            setRows(result.data);
            setCount(result.count);
          }
        });
    void work
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Reports could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, status, page, childOnly, selected, refresh]);
  const button = (label: string, onPress: () => void, danger = false, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[s.button, danger && s.danger, (disabled || busy) && s.disabled]}
    >
      <Text style={[s.buttonText, danger && s.dangerText]}>{label}</Text>
    </Pressable>
  );
  const run = async (action: ReportAction | 'suspend' | 'ban' | 'unsuspend') => {
    if (!detail || busy) return;
    if (reason.trim().length < 5)
      return Alert.alert(
        'Add a reason',
        'Explain your decision in at least five characters so other admins can follow up.'
      );
    const labels = {
      resolve: 'Resolve report',
      dismiss: 'Dismiss report',
      reopen: 'Reopen report',
      hide: 'Hide content',
      restore: 'Restore content',
      suspend: 'Suspend account',
      ban: 'Ban account',
      unsuspend: 'Restore account access',
    };
    Alert.alert(
      `${labels[action]}?`,
      `${reason.trim()}\n\n${['suspend', 'ban', 'unsuspend', 'hide', 'restore'].includes(action) ? 'This action does not close the report.' : 'This records your decision on this report.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await actOnReport(detail, action, reason);
                setReason('');
                setRefresh((v) => v + 1);
                Alert.alert('Decision recorded', 'The report and action history will refresh.');
              } catch (e) {
                Alert.alert(
                  'Action not completed',
                  e instanceof Error ? e.message : 'Refresh and try again.'
                );
                setRefresh((v) => v + 1);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {button(
          '‹ Back',
          () => {
            if (selected) {
              setSelected(null);
              setReason('');
              setReference(false);
            } else router.back();
          },
          false,
          busy
        )}
        <Text accessibilityRole="header" style={s.title}>
          {selected ? 'Review report' : 'Reports & safety'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {!selected && (
          <>
            <Text style={s.muted}>
              Review the context, take action, then record your decision. Oldest reports appear
              first.
            </Text>
            <View style={s.row}>
              {(['general', 'post', 'comment'] as ReportKind[]).map((value) =>
                button(
                  `${kind === value ? '✓ ' : ''}${value === 'general' ? 'Safety & accounts' : value === 'post' ? 'Posts' : 'Comments'}`,
                  () => {
                    setKind(value);
                    setChildOnly(false);
                    setPage(1);
                  }
                )
              )}
            </View>
            {kind === 'general' &&
              button(childOnly ? '✓ Child safety only' : 'Show child safety only', () => {
                setChildOnly((v) => !v);
                setPage(1);
              })}
            <View style={s.row}>
              {['open', 'resolved', 'dismissed', 'all'].map((value) =>
                button(
                  `${status === value ? '✓ ' : ''}${value[0].toUpperCase() + value.slice(1)}`,
                  () => {
                    setStatus(value);
                    setPage(1);
                  }
                )
              )}
            </View>
          </>
        )}
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading reports" />
        ) : error ? (
          <View style={s.card}>
            <Text accessibilityRole="alert" style={s.body}>
              {error}
            </Text>
            {button('Try again', () => setRefresh((v) => v + 1))}
          </View>
        ) : selected && detail ? (
          <>
            <View style={s.card}>
              <Text style={s.title}>{reportTitle(detail)}</Text>
              <Text style={s.badge}>
                {detail.status.toUpperCase()} · {detail.category || 'General report'}
              </Text>
              <Text style={s.muted}>{new Date(detail.createdAt).toLocaleString()}</Text>
              <Text style={s.label}>Reporter’s explanation</Text>
              <Text selectable style={s.body}>
                {detail.description || 'No explanation provided.'}
              </Text>
              <Text style={s.muted}>
                Reported by {detail.reporter?.name || 'Unavailable account'}
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.label}>Reported account</Text>
              <Text style={s.body}>{detail.reportedAccount?.name || 'No account linked'}</Text>
              {detail.reportedAccount && (
                <>
                  <Text style={s.muted}>
                    {detail.reportedAccount.isBanned
                      ? 'Banned'
                      : detail.reportedAccount.isSuspended
                        ? 'Suspended'
                        : 'Active'}
                  </Text>
                  {button('View account profile', () =>
                    router.push(`/profile/${detail.reportedAccount!.id}` as never)
                  )}
                </>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.label}>Reported content</Text>
              <ReportAttachments
                key={detail.id}
                media={detail.media ?? []}
                sensitive={detail.sensitive}
              />
              {detail.sensitive && (
                <Text style={s.muted}>
                  Child-safety media is not displayed here. Review the text and account context
                  without downloading or forwarding sensitive media.
                </Text>
              )}
              <Text selectable style={s.body}>
                {detail.content?.text || 'Content is unavailable or was removed.'}
              </Text>
              {detail.content && (
                <Text style={s.badge}>
                  {detail.content.hidden ? 'Hidden from users' : 'Currently visible'}
                </Text>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.label}>Your decision</Text>
              <Text style={s.muted}>
                Record why you’re taking action. Hiding content or restricting an account does not
                close this case.
              </Text>
              <TextInput
                accessibilityLabel="Reason for moderation decision"
                placeholder="Explain your decision…"
                placeholderTextColor="#737B74"
                multiline
                maxLength={500}
                editable={!busy}
                value={reason}
                onChangeText={setReason}
                style={s.input}
              />
              {busy && <ActivityIndicator accessibilityLabel="Saving decision" />}
              <View style={s.row}>
                {detail.content &&
                  button(
                    detail.content.hidden ? 'Restore content' : 'Hide content',
                    () => void run(detail.content!.hidden ? 'restore' : 'hide'),
                    !detail.content.hidden
                  )}
                {detail.reportedAccount && (
                  <>
                    {button(
                      'Suspend account',
                      () => void run('suspend'),
                      true,
                      detail.reportedAccount.isSuspended || detail.reportedAccount.isBanned
                    )}
                    {button(
                      'Ban account',
                      () => void run('ban'),
                      true,
                      detail.reportedAccount.isBanned
                    )}
                    {(detail.reportedAccount.isSuspended || detail.reportedAccount.isBanned) &&
                      button('Restore account access', () => void run('unsuspend'))}
                  </>
                )}
              </View>
              <View style={s.row}>
                {detail.status === 'open' ? (
                  <>
                    {button('Resolve report', () => void run('resolve'))}
                    {button('Dismiss report', () => void run('dismiss'))}
                  </>
                ) : (
                  button('Reopen report', () => void run('reopen'))
                )}
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.label}>Action history</Text>
              {detail.history.length ? (
                detail.history.map((entry) => (
                  <View key={entry.id} style={s.history}>
                    <Text style={s.body}>
                      {entry.action.replace(/_/g, ' ')} · {entry.actorName || 'Admin'}
                    </Text>
                    <Text style={s.muted}>{entry.reason}</Text>
                    <Text style={s.muted}>{new Date(entry.createdAt).toLocaleString()}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.muted}>No recorded actions yet.</Text>
              )}
              {button(reference ? 'Hide reference details' : 'Reference details', () =>
                setReference((v) => !v)
              )}
              {reference && (
                <Text selectable style={s.muted}>
                  Report: {detail.id}
                  {detail.content ? `\nContent: ${detail.content.id}` : ''}
                </Text>
              )}
            </View>
          </>
        ) : (
          !selected && (
            <>
              {rows.length ? (
                rows.map((item) => (
                  <View style={s.card} key={item.id}>
                    <Text style={s.badge}>
                      {item.sensitive ? 'CHILD SAFETY · ' : ''}
                      {item.status.toUpperCase()}
                    </Text>
                    <Text style={s.title}>{reportTitle(item)}</Text>
                    <Text style={s.body}>
                      {item.reportedAccount?.name || item.subject || 'Account or content report'}
                    </Text>
                    <Text numberOfLines={3} style={s.muted}>
                      {item.description || 'No explanation provided.'}
                    </Text>
                    <Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
                    {button('Review report', () => setSelected({ kind: item.kind, id: item.id }))}
                  </View>
                ))
              ) : (
                <Text style={s.body}>No reports match these filters.</Text>
              )}
              <View style={s.row}>
                {button('Previous', () => setPage((v) => v - 1), false, page === 1)}
                <Text style={s.muted}>Page {page}</Text>
                {button('Next', () => setPage((v) => v + 1), false, page * 20 >= count)}
              </View>
            </>
          )
        )}
        {button('Refresh', () => setRefresh((v) => v + 1), false, loading)}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  scroll: { padding: 20, gap: 16 },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 21,
    color: theme.colors.TEXT_PRIMARY,
    flexShrink: 1,
  },
  body: { fontSize: 15, lineHeight: 23, color: theme.colors.TEXT_PRIMARY },
  muted: { fontSize: 14, lineHeight: 21, color: theme.colors.LABEL },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
  badge: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: theme.colors.G },
  card: { padding: 18, borderRadius: 18, backgroundColor: theme.colors.SURFACE, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  buttonText: { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' },
  danger: { backgroundColor: '#9A2525' },
  dangerText: { color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 12,
    padding: 12,
    color: theme.colors.TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  history: { gap: 4, paddingVertical: 8 },
}));
