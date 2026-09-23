import { StyleSheet, useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/use-supabase-auth';
import { setStoredThemePreference } from '../../lib/theme-preference';

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  const s = sStylesheet;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function SettingDivider() {
  const s = sStylesheet;
  return <View style={s.divider} />;
}

function SettingRow({
  icon,
  label,
  sub,
  value,
  danger,
  toggle,
  toggled,
  onToggle,
  chevron = true,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value?: string;
  danger?: boolean;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useUnistyles(); const s = sStylesheet;

  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress && !toggle}>
      <View
        style={[
          s.iconBox,
          danger && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' },
        ]}
      >
        {icon}
      </View>
      <View style={s.rowMid}>
        <Text style={[s.rowLabel, danger && { color: '#ef4444' }]}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {toggle && (
        <Switch
          value={toggled}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.GLASS_BORDER, true: theme.colors.G }}
          thumbColor="#fff"
        />
      )}
      {!toggle && chevron && (
        <Feather
          name="chevron-right"
          size={18}
          color={theme.colors.LABEL}
          style={{ marginLeft: 8 }}
        />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const isDarkMode = UnistylesRuntime.themeName === 'dark';

  const toggleDarkMode = (value: boolean) => {
    const nextTheme = value ? 'dark' : 'light';
    UnistylesRuntime.setTheme(nextTheme);
    setStoredThemePreference(nextTheme);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const isAdmin = (profile as any)?.is_admin || (profile as any)?.role === 'admin';

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 }}
      >
        <SettingSection title="Account & Identity">
          <SettingRow
            icon={<Feather name="user" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Edit Profile"
            sub="Update your name, photo and bio"
            onPress={() => router.push('/profile/edit' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Text style={{ fontSize: 16 }}>🇳🇬</Text>}
            label="Phone Number"
            sub={
              profile?.phone_verified
                ? `${profile?.phone || 'Phone'} · Verified`
                : 'Verify phone number'
            }
            onPress={
              profile?.phone_verified ? undefined : () => router.push('/verify-phone' as any)
            }
            chevron={!profile?.phone_verified}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="mail" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Email Address"
            sub={user?.email || 'No email linked'}
            onPress={() =>
              Alert.alert(
                'Change Email',
                'To change your email address, please contact support@yrdly.ng with a valid ID for verification.',
                [{ text: 'OK' }]
              )
            }
          />
        </SettingSection>

        <SettingSection title="Commerce">
          <SettingRow
            icon={<Feather name="shopping-bag" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Transactions"
            sub="Track your orders & marketplace activity"
            onPress={() => router.push('/transactions' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Ionicons name="wallet-outline" size={18} color={theme.colors.TEXT_PRIMARY} />}
            label="Payouts"
            sub="Manage your earnings & balances"
            onPress={() => router.push('/settings/payouts' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Ionicons name="business-outline" size={18} color={theme.colors.TEXT_PRIMARY} />}
            label="Bank Account"
            sub="Manage your linked payout account"
            onPress={() => router.push('/settings/payout-settings' as any)}
          />
        </SettingSection>

        <SettingSection title="Privacy & Location">
          <SettingRow
            icon={<Feather name="lock" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Privacy & Discoverability"
            sub="Manage location sharing and visibility"
            onPress={() => router.push('/settings/privacy' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="map-pin" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Location"
            sub="Your neighbourhood & location alerts"
            onPress={() => router.push('/settings/location' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="shield" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Blocked Users"
            sub="Manage who can't see or contact you"
            value={profile?.blocked_users?.length ? String(profile.blocked_users.length) : '0'}
            onPress={() => router.push('/settings/blocked' as any)}
          />
        </SettingSection>

        <SettingSection title="Preferences">
          <SettingRow
            icon={<Feather name="moon" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Dark Mode"
            sub="Toggle dark mode theme"
            toggle
            toggled={isDarkMode}
            onToggle={toggleDarkMode}
          />
          <SettingRow
            icon={<Feather name="bell" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Notifications"
            sub="Choose what you want to hear"
            onPress={() => router.push('/settings/notifications' as any)}
          />
        </SettingSection>

        <SettingSection title="Community & Support">
          <SettingRow
            icon={<Feather name="user-plus" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Invite Neighbours"
            sub="Invite neighbours to join your community"
            value="Invite"
            onPress={() => router.push('/settings/invite' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="book-open" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Neighbourhood Guidelines"
            sub="What we stand for in every community"
            onPress={() => router.push('/settings/guidelines' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="help-circle" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Help Center"
            sub="FAQs, tutorials and getting support"
            onPress={() => router.push('/settings/help' as any)}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="flag" size={16} color={theme.colors.TEXT_PRIMARY} />}
            label="Report an Issue"
            sub="Flag a problem or inappropriate content"
            onPress={() => router.push('/settings/report' as any)}
          />
        </SettingSection>

        {isAdmin && (
          <View style={{ marginBottom: 24 }}>
            <View style={s.adminBanner}>
              <View style={s.adminBannerIcon}>
                <Ionicons name="shield-checkmark" size={16} color={theme.colors.G} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.adminBannerTitle}>Admin Portal</Text>
                <Text style={s.adminBannerSub}>You have administrator privileges</Text>
              </View>
              <View style={s.adminBadge}>
                <Text style={s.adminBadgeTxt}>ADMIN</Text>
              </View>
            </View>
            <SettingSection title="Admin Tools">
              <SettingRow
                icon={<Feather name="inbox" size={16} color={theme.colors.TEXT_PRIMARY} />}
                label="Dispute Resolution"
                sub="Review and resolve marketplace disputes"
                onPress={() => router.push('/(admin)/disputes' as any)}
              />
              <SettingDivider />
              <SettingRow
                icon={<Feather name="shield" size={16} color={theme.colors.TEXT_PRIMARY} />}
                label="Moderation Queue"
                sub="Review flagged content and users"
                onPress={() => router.push('/(admin)/moderation' as any)}
              />
              <SettingDivider />
              <SettingRow
                icon={<Feather name="alert-triangle" size={16} color={theme.colors.TEXT_PRIMARY} />}
                label="Safety Alerts"
                sub="Create and manage community safety alerts"
                onPress={() => router.push('/settings/safety' as any)}
              />
            </SettingSection>
          </View>
        )}

        <SettingSection title="Account">
          <SettingRow
            icon={<Feather name="log-out" size={16} color="#ef4444" />}
            label="Sign Out"
            sub="Log out of your YRDLY account"
            danger
            chevron={false}
            onPress={handleSignOut}
          />
          <SettingDivider />
          <SettingRow
            icon={<Feather name="trash-2" size={16} color="#ef4444" />}
            label="Request Account Deletion"
            sub="We'll process your request within 30 days"
            danger
            chevron={false}
            onPress={() => router.push('/settings/delete-account' as any)}
          />
        </SettingSection>

        <Text style={s.footerText}>YRDLY v1.01</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.LABEL,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },

  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginLeft: 66 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1, paddingLeft: 14, paddingRight: 8 },
  rowLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  rowSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, marginTop: 2 },
  rowValue: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },

  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.18)',
    borderRadius: 18,
    marginBottom: 12,
  },
  adminBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(130,219,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerTitle: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.G },
  adminBannerSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(130,219,126,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
  },
  adminBadgeTxt: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: theme.colors.G,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  footerText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: theme.colors.LABEL,
    textAlign: 'center',
    marginTop: 4,
  },
}));
