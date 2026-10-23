import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../../hooks/use-supabase-auth';
import { eventScreenStyles as styles } from './event-screen-styles';
import {
  eventTeamEndpoint,
  eventTeamRequest,
  eventTeamRoleLabel,
  type EventAssignment,
  type EventTeamAction,
  type EventTeamData,
  type EventTeamRole,
} from '../../lib/events/event-team';

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
};
export function EventTeamWorkspace({ eventId }: { eventId?: string }) {
  const { user } = useAuth();
  return (
    <EventTeamWorkspaceContent
      key={`${user?.id || 'signed-out'}:${eventId || 'assignments'}`}
      eventId={eventId}
    />
  );
}
function EventTeamWorkspaceContent({ eventId }: { eventId?: string }) {
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [data, setData] = useState<EventTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EventTeamRole>('checkin');
  const generation = useRef(0);
  const readInFlight = useRef(0);
  const mutationInFlight = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(true);
  const clear = useCallback(() => {
    setData(null);
    setAssignments([]);
  }, []);
  const load = useCallback(
    async (force = false) => {
      if (mutationInFlight.current || (readInFlight.current && !force)) return;
      const request = ++generation.current;
      readInFlight.current = request;
      if (!userId) {
        clear();
        setLoading(false);
        setRefreshing(false);
        readInFlight.current = 0;
        return;
      }
      setError('');
      try {
        if (eventId) {
          const result = await eventTeamRequest<EventTeamData>(eventTeamEndpoint(eventId));
          if (request === generation.current) setData(result);
        } else {
          const result = await eventTeamRequest<{ assignments: EventAssignment[] }>(
            eventTeamEndpoint()
          );
          if (request === generation.current) setAssignments(result.assignments);
        }
      } catch (failure) {
        if (request !== generation.current) return;
        const problem = failure as Error & { status?: number };
        if (
          problem.status === 401 ||
          problem.status === 403 ||
          problem.status === 404 ||
          /session.*expired|sign in/i.test(problem.message)
        )
          clear();
        setError(problem.message || 'Could not load your event team.');
      } finally {
        if (readInFlight.current === request) readInFlight.current = 0;
        if (request === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId, eventId, clear]
  );
  useEffect(() => {
    mounted.current = true;
    clear();
    setLoading(true);
    void load(true);
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [load, clear]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => listener.remove();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
      };
    }, [load])
  );
  useEffect(() => {
    if (!eventId || !userId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = (state: string) => {
      if (timer) clearInterval(timer);
      timer =
        state === 'active'
          ? setInterval(() => {
              if (focused.current) void load();
            }, 20_000)
          : undefined;
    };
    sync(AppState.currentState);
    const listener = AppState.addEventListener('change', sync);
    return () => {
      if (timer) clearInterval(timer);
      listener.remove();
    };
  }, [eventId, userId, load]);
  const mutate = async (id: string, body: EventTeamAction) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await eventTeamRequest(eventTeamEndpoint(id), body);
      if (!mounted.current) return;
      if (body.action === 'invite') setEmail('');
      setNotice(
        body.action === 'invite'
          ? 'Invitation sent. They can accept in Assigned events.'
          : 'Your event team has been updated.'
      );
      mutationInFlight.current = false;
      await load(true);
    } catch (failure) {
      if (!mounted.current) return;
      const problem = failure as Error & { status?: number };
      if (
        problem.status === 401 ||
        problem.status === 403 ||
        problem.status === 404 ||
        /session.*expired|sign in/i.test(problem.message)
      )
        clear();
      setError(problem.message || 'Could not update your event team.');
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const button = (label: string, onPress: () => void, primary = false, danger = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[primary ? styles.primaryButton : styles.secondaryButton, { opacity: busy ? 0.5 : 1 }]}
    >
      <Text
        style={[
          primary ? styles.primaryButtonText : styles.secondaryButtonText,
          danger && { color: theme.colors.DANGER },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const canManage = data?.role === 'organizer' || data?.role === 'manager';
  const canScan = data?.event.status.toUpperCase() === 'PUBLISHED';
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.G}
            />
          }
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.secondaryButton, { minWidth: 48 }]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={22} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            {button('Refresh', () => {
              setRefreshing(true);
              void load();
            })}
          </View>
          <View style={styles.section}>
            <Text style={styles.eyebrow}>THE DOOR TEAM</Text>
            <Text style={styles.title}>
              {eventId ? 'Welcome them in.' : 'Your place on the team.'}
            </Text>
            <Text style={styles.subtitle}>
              {data?.event.title ||
                (eventId
                  ? 'Team access, attendance and check-ins, together.'
                  : 'Accept invitations and check in guests using your own account.')}
            </Text>
            <Text style={styles.muted}>
              Online check-in keeps every entrance in sync. Pull down to refresh attendance.
            </Text>
          </View>
          {!user && (
            <View style={styles.card}>
              <Text style={styles.body}>
                Sign in to see your invitations and event assignments.
              </Text>
            </View>
          )}
          {!!error && (
            <View
              accessibilityRole="alert"
              style={[styles.card, { borderColor: theme.colors.DANGER }]}
            >
              <Text style={styles.body}>{error}</Text>
              {button('Try again', () => void load())}
            </View>
          )}
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {notice}
            </Text>
          )}
          {loading && (
            <ActivityIndicator accessibilityLabel="Loading event team" color={theme.colors.G} />
          )}
          {!!user && !loading && !eventId && (
            <View style={styles.section}>
              {!assignments.length && !error && (
                <View style={styles.card}>
                  <Feather name="users" size={28} color={theme.colors.G} />
                  <Text style={styles.sectionTitle}>Your next event starts here.</Text>
                  <Text style={styles.muted}>
                    Ask an organiser to invite the email on your YRDLY account. Invitations will
                    appear here.
                  </Text>
                </View>
              )}
              {assignments.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.eyebrow}>
                    {eventTeamRoleLabel(item.role)} · {item.status}
                  </Text>
                  <Text style={styles.sectionTitle}>{item.event?.title || 'Event'}</Text>
                  <Text style={styles.muted}>
                    {dateLabel(item.event?.start_time)} · {item.event?.status}
                  </Text>
                  {item.status === 'pending' && item.expires_at && (
                    <Text style={styles.muted}>
                      Invitation expires {dateLabel(item.expires_at)}
                    </Text>
                  )}
                  {item.status === 'pending' &&
                  (!item.expires_at || Date.parse(item.expires_at) > Date.now()) ? (
                    <View style={styles.section}>
                      {button(
                        'Accept invitation',
                        () => void mutate(item.event_id, { action: 'accept', member_id: item.id }),
                        true
                      )}
                      {button(
                        'Decline',
                        () => void mutate(item.event_id, { action: 'decline', member_id: item.id })
                      )}
                    </View>
                  ) : item.status === 'active' ? (
                    button(
                      'Open event desk →',
                      () => router.push(`/events/${item.event_id}/team` as never),
                      true
                    )
                  ) : (
                    <Text style={styles.muted}>This assignment no longer grants event access.</Text>
                  )}
                </View>
              ))}
            </View>
          )}
          {!!user && !loading && data && (
            <>
              <Text style={styles.body}>Your access: {eventTeamRoleLabel(data.role)}</Text>
              {canScan ? (
                button('Scan tickets', () => router.push(`/events/${eventId}/scan` as never), true)
              ) : (
                <Text style={styles.muted}>
                  Check-in is unavailable while this event is{' '}
                  {data.event.status.toLowerCase().replaceAll('_', ' ')}.
                </Text>
              )}
              <View style={[styles.row, { alignItems: 'stretch', gap: 8 }]}>
                {[
                  ['Expected', data.summary.total],
                  ['Checked in', data.summary.checked_in],
                  ['Remaining', data.summary.remaining],
                ].map(([label, value]) => (
                  <View key={label} style={[styles.card, { flex: 1, padding: 12 }]}>
                    <Text style={[styles.muted, { fontSize: 11 }]}>{label}</Text>
                    <Text style={styles.sectionTitle}>{value}</Text>
                  </View>
                ))}
              </View>
              {canManage && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Build your door team.</Text>
                  <Text style={styles.muted}>
                    Invite someone with an existing YRDLY account. Check-in staff can scan and view
                    attendance. Managers can also manage check-in staff. Financial controls stay
                    with the organiser.
                  </Text>
                  <Text style={styles.body}>YRDLY account email</Text>
                  <TextInput
                    accessibilityLabel="YRDLY account email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    placeholder="teammate@example.com"
                    placeholderTextColor={theme.colors.MUTED}
                    style={{
                      minHeight: 52,
                      borderWidth: 1,
                      borderColor: theme.colors.GLASS_BORDER,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      color: theme.colors.TEXT_PRIMARY,
                      backgroundColor: theme.colors.DARK,
                    }}
                  />
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {button(role === 'checkin' ? '✓ Check-in staff' : 'Check-in staff', () =>
                      setRole('checkin')
                    )}
                    {data.role === 'organizer' &&
                      button(role === 'manager' ? '✓ Event manager' : 'Event manager', () =>
                        setRole('manager')
                      )}
                  </View>
                  {button(
                    busy ? 'Updating…' : 'Send invitation',
                    () => {
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                        setError('Enter the email on their YRDLY account.');
                        return;
                      }
                      void mutate(eventId!, {
                        action: 'invite',
                        email: email.trim(),
                        role: data.role === 'organizer' ? role : 'checkin',
                      });
                    },
                    true
                  )}
                  {!data.members.length && (
                    <Text style={styles.muted}>
                      No teammates yet. Invite your first person above.
                    </Text>
                  )}
                  {data.members.map((member) => {
                    const editable = data.role === 'organizer' || member.role === 'checkin';
                    return (
                      <View
                        key={member.id}
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: theme.colors.GLASS_BORDER,
                          paddingTop: 16,
                          gap: 10,
                        }}
                      >
                        <Text style={styles.body}>
                          {member.user?.name || member.user?.email || member.name || 'YRDLY member'}
                        </Text>
                        <Text style={styles.muted}>
                          {eventTeamRoleLabel(member.role)} · {member.status}
                        </Text>
                        {member.status === 'pending' && member.expires_at && (
                          <Text style={styles.muted}>
                            Invitation expires {dateLabel(member.expires_at)}
                          </Text>
                        )}
                        {editable && ['active', 'pending'].includes(member.status) && (
                          <View style={styles.section}>
                            {data.role === 'organizer' &&
                              button(
                                `Make ${member.role === 'manager' ? 'check-in staff' : 'manager'}`,
                                () => {
                                  const next = member.role === 'manager' ? 'checkin' : 'manager';
                                  Alert.alert(
                                    'Change team role?',
                                    `Change this person to ${eventTeamRoleLabel(next)}?`,
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Change role',
                                        onPress: () =>
                                          void mutate(eventId!, {
                                            action: 'update_role',
                                            member_id: member.id,
                                            role: next,
                                          }),
                                      },
                                    ]
                                  );
                                }
                              )}
                            {button(
                              'Revoke access',
                              () =>
                                Alert.alert(
                                  'Revoke event access?',
                                  'They will no longer be able to scan tickets for this event.',
                                  [
                                    { text: 'Keep access', style: 'cancel' },
                                    {
                                      text: 'Revoke',
                                      style: 'destructive',
                                      onPress: () =>
                                        void mutate(eventId!, {
                                          action: 'revoke',
                                          member_id: member.id,
                                        }),
                                    },
                                  ]
                                ),
                              false,
                              true
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
              {!!data.guests?.length && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Guest list</Text>
                  <Text style={styles.muted}>
                    Showing up to 200 guests. Attendance totals cover the whole event.
                  </Text>
                  {data.guests.map((guest) => (
                    <View key={guest.id} style={{ gap: 4, paddingVertical: 8 }}>
                      <Text style={styles.body}>
                        {guest.attendee_name || guest.user_name || 'Guest'}
                      </Text>
                      <Text style={styles.muted}>
                        {guest.status}
                        {guest.tier_name || guest.tier?.name
                          ? ` · ${guest.tier_name || guest.tier?.name}`
                          : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>At the entrance.</Text>
                <Text style={styles.muted}>
                  The latest 100 successful admissions. Each ticket can be checked in once.
                </Text>
                {!data.history.length ? (
                  <Text style={styles.muted}>No guests checked in yet.</Text>
                ) : (
                  data.history.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.GLASS_BORDER,
                        paddingTop: 14,
                        gap: 4,
                      }}
                    >
                      <Text style={styles.body}>{item.attendee_name || 'Guest'}</Text>
                      <Text style={styles.muted}>By {item.scanner_name || 'Event team'}</Text>
                      <Text style={styles.muted}>{dateLabel(item.scanned_at)}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
