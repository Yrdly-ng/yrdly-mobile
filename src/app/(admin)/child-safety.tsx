import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/use-supabase-auth';
import {
  CHILD_SAFETY_PAGE_SIZE,
  ChildSafetyReport,
  enforceChildSafetyAccountAction,
  fetchChildSafetyReports,
  hideChildSafetyReportedPost,
} from '../../lib/legal/child-safety-reports';

export default function ChildSafetyInbox() {
  const { profile } = useAuth();
  const { theme } = useUnistyles();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [reports, setReports] = useState<ChildSafetyReport[]>([]);
  const [count, setCount] = useState(0);
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [errorQueryKey, setErrorQueryKey] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionedReportIds, setActionedReportIds] = useState<string[]>([]);
  const [hiddenPostReportIds, setHiddenPostReportIds] = useState<string[]>([]);
  const isAdmin = profile?.role === 'admin';
  const adminId = profile?.id;
  const queryKey = `${adminId ?? ''}:${page}:${refresh}`;
  const loading = loadedQueryKey !== queryKey && errorQueryKey !== queryKey;
  const error = errorQueryKey === queryKey;
  const visibleReports = loadedForUserId === adminId ? reports : [];
  const visibleCount = loadedForUserId === adminId ? count : 0;

  const confirmAccountAction = (report: ChildSafetyReport, action: 'suspend' | 'ban') => {
    if (!report.reported_user_id) return;
    const title = action === 'ban' ? 'Ban this account?' : 'Suspend this account?';
    const consequence = action === 'ban'
      ? 'The account will be banned and unable to use YRDLY.'
      : 'The account will be suspended and unable to use YRDLY.';
    Alert.alert(
      title,
      `${consequence}\n\nOnly proceed after reviewing the report. Reference: ${report.id}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'ban' ? 'Ban account' : 'Suspend account',
          style: 'destructive',
          onPress: () => { void applyAccountAction(report, action); },
        },
      ]
    );
  };

  const applyAccountAction = async (report: ChildSafetyReport, action: 'suspend' | 'ban') => {
    if (!report.reported_user_id || actionLoading) return;
    setActionLoading(report.id);
    try {
      await enforceChildSafetyAccountAction(report.reported_user_id, report.id, action);
      setActionedReportIds((ids) => ids.includes(report.id) ? ids : [...ids, report.id]);
      Alert.alert('Action recorded', `The account was ${action === 'ban' ? 'banned' : 'suspended'}. Use the web admin to review or reverse the action.`);
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'The account could not be updated.');
    } finally {
      setActionLoading(null);
      setRefresh((value) => value + 1);
    }
  };

  const applyPostHide = async (report: ChildSafetyReport) => {
    if (!report.reported_post_id || actionLoading) return;
    setActionLoading(report.id);
    try {
      await hideChildSafetyReportedPost(report.id);
      setHiddenPostReportIds((ids) => ids.includes(report.id) ? ids : [...ids, report.id]);
      Alert.alert('Post hidden', 'The post is hidden from other viewers. This does not resolve the report; review associated media and account action separately.');
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'The post could not be hidden.');
    } finally {
      setActionLoading(null);
      setRefresh((value) => value + 1);
    }
  };

  const confirmPostHide = (report: ChildSafetyReport) => {
    if (!report.reported_post_id) return;
    Alert.alert(
      'Hide this reported post?',
      `The post will be removed from other viewers' feeds. The report stays open for follow-up. Reference: ${report.id}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide post', style: 'destructive', onPress: () => { void applyPostHide(report); } },
      ]
    );
  };

  useEffect(() => {
    let current = true;
    if (!isAdmin) {
      return;
    }
    const requestKey = queryKey;
    void fetchChildSafetyReports(page)
      .then((result) => {
        if (!current) return;
        setReports(result.reports);
        setCount(result.count);
        setLoadedForUserId(adminId ?? null);
        setLoadedQueryKey(requestKey);
      })
      .catch(() => {
        if (current) setErrorQueryKey(requestKey);
      });
    return () => {
      current = false;
    };
  }, [isAdmin, adminId, page, queryKey]);

  const retry = useCallback(() => setRefresh((value) => value + 1), []);
  if (!isAdmin) return null; // The parent admin layout redirects non-staff; RLS is authoritative.

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.button}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.TEXT_PRIMARY} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Child safety reports</Text>
      </View>
      <Text style={styles.notice}>
        Open reports, oldest first. Review each report before acting. You can suspend or ban a linked reported account here; use the staff web moderation workspace to resolve or dismiss the report. An account action does not resolve its report.
      </Text>
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.body}>Reports could not be loaded. Check your connection and staff access.</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator color={theme.colors.G} style={styles.state} />
      ) : (
        <FlatList
          data={visibleReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={retry} tintColor={theme.colors.G} />}
          ListEmptyComponent={<Text style={styles.body}>No open child-safety reports on this page. Pull down to refresh.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.reportTitle}>{item.subject || 'Child safety concern'}</Text>
              <Text style={styles.body}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text selectable style={styles.body}>Reference: {item.id}</Text>
              <Text selectable style={styles.body}>{item.description || 'No description supplied.'}</Text>
              {item.reported_user_id ? <Text selectable style={styles.body}>Reported account: {item.reported_user_id}</Text> : null}
              {item.reported_post_id ? <Text selectable style={styles.body}>Reported post: {item.reported_post_id}</Text> : null}
              {item.user_id ? <Text selectable style={styles.body}>Reporter: {item.user_id}</Text> : null}
              {item.reported_post_id && hiddenPostReportIds.includes(item.id) ? (
                <Text style={styles.body}>Post hidden. Resolve or dismiss the report in the web moderation workspace after follow-up.</Text>
              ) : item.reported_post_id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hide reported post"
                  disabled={actionLoading !== null}
                  onPress={() => confirmPostHide(item)}
                  style={[styles.actionButton, styles.banButton]}
                >
                  {actionLoading === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Hide reported post</Text>}
                </Pressable>
              ) : null}
              {item.reported_user_id && actionedReportIds.includes(item.id) ? (
                <Text style={styles.body}>An account action was applied. Resolve or dismiss this report in the web moderation workspace.</Text>
              ) : item.reported_user_id ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Suspend reported account"
                    disabled={actionLoading !== null}
                    onPress={() => confirmAccountAction(item, 'suspend')}
                    style={[styles.actionButton, styles.suspendButton]}
                  >
                    {actionLoading === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Suspend account</Text>}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ban reported account"
                    disabled={actionLoading !== null}
                    onPress={() => confirmAccountAction(item, 'ban')}
                    style={[styles.actionButton, styles.banButton]}
                  >
                    <Text style={styles.actionText}>Ban account</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={loading || page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={styles.button}>
          <Text style={styles.link}>Previous</Text>
        </Pressable>
        <Text style={styles.body}>Page {page + 1}</Text>
        <Pressable accessibilityRole="button" disabled={loading || error || (page + 1) * CHILD_SAFETY_PAGE_SIZE >= visibleCount} onPress={() => setPage((value) => value + 1)} style={styles.button}>
          <Text style={styles.link}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  title: { fontFamily: 'Outfit-Bold', fontSize: 20, color: theme.colors.TEXT_PRIMARY, flex: 1 },
  notice: { color: theme.colors.LABEL, fontSize: 14, lineHeight: 21, margin: 20 },
  state: { padding: 24 },
  body: { color: theme.colors.TEXT_PRIMARY, fontSize: 14, lineHeight: 21 },
  list: { padding: 20, flexGrow: 1 },
  card: { backgroundColor: theme.colors.SURFACE, borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  reportTitle: { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold', fontSize: 16 },
  button: { minWidth: 48, minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center' },
  link: { color: theme.colors.G, fontFamily: 'Inter-SemiBold', fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  actionButton: { minHeight: 48, minWidth: 140, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  suspendButton: { backgroundColor: '#8f4b16' },
  banButton: { backgroundColor: '#a32626' },
  actionText: { color: '#fff', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
}));
