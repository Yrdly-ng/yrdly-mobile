import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { useCommunityConnections, CommunityFilterTab } from '../hooks/useCommunityConnections';
import { DiscoverUserCard } from './DiscoverUserCard';

export interface DiscoverPeopleSectionProps {
  search?: string;
  initialMode?: 'nearby' | 'circle';
}

export function DiscoverPeopleSection({
  search = '',
  initialMode = 'nearby',
}: DiscoverPeopleSectionProps) {
  const { styles: sStylesheet, theme } = useStyles(_stylesheet);
  const router = useRouter();

  const [mode, setMode] = useState<'nearby' | 'circle'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [activeFilterTab, setActiveFilterTab] = useState<CommunityFilterTab>('all');
  const [circleSearchQuery, setCircleSearchQuery] = useState('');

  const {
    friends,
    requests,
    discoverUsers,
    loading,
    isFetchingMore,
    hasMoreDiscover,
    loadMoreDiscover,
    handleRequestAction,
    handleFriendOptions,
    handleInvite,
  } = useCommunityConnections(activeFilterTab, search);

  // Server handles search filtering on discoverUsers
  const filteredNearbyUsers = discoverUsers;

  // Filter friends in My Circle tab by circle search query
  const filteredFriends = useMemo(() => {
    if (!circleSearchQuery.trim()) return friends;
    const q = circleSearchQuery.trim().toLowerCase();
    return friends.filter((f) => (f.user?.name || '').toLowerCase().includes(q));
  }, [friends, circleSearchQuery]);

  const filterChips: { key: CommunityFilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'neighbors', label: 'Neighbors' },
    { key: 'mutuals', label: 'Mutuals' },
    { key: 'sellers', label: 'Sellers' },
  ];

  return (
    <View style={sStylesheet.container}>
      {/* ── Segmented Mode Toggle (Nearby | My circle) ── */}
      <View style={sStylesheet.toggleContainer}>
        <TouchableOpacity
          style={[sStylesheet.toggleButton, mode === 'nearby' && sStylesheet.toggleButtonActive]}
          onPress={() => setMode('nearby')}
          activeOpacity={0.8}
        >
          <Text style={[sStylesheet.toggleText, mode === 'nearby' && sStylesheet.toggleTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sStylesheet.toggleButton, mode === 'circle' && sStylesheet.toggleButtonActive]}
          onPress={() => setMode('circle')}
          activeOpacity={0.8}
        >
          <View style={sStylesheet.tabLabelRow}>
            <Text style={[sStylesheet.toggleText, mode === 'circle' && sStylesheet.toggleTextActive]}>
              My circle
            </Text>
            {requests.length > 0 && <View style={sStylesheet.badgeDot} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── MODE 1: NEARBY ── */}
      {mode === 'nearby' && (
        <View style={sStylesheet.modeContent}>
          {/* Filter Chips Bar */}
          <View style={sStylesheet.chipsContainer}>
            {filterChips.map((chip) => {
              const isActive = activeFilterTab === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[sStylesheet.chip, isActive && sStylesheet.chipActive]}
                  onPress={() => setActiveFilterTab(chip.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[sStylesheet.chipText, isActive && sStylesheet.chipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={sStylesheet.loadingContainer}>
              <ActivityIndicator color={theme.colors.G} size="large" />
            </View>
          )}

          {/* Empty Search Results */}
          {!loading && filteredNearbyUsers.length === 0 && (
            <View style={sStylesheet.emptyContainer}>
              <Ionicons name="search-outline" size={40} color={theme.colors.MUTED} />
              <Text style={sStylesheet.emptyTitle}>No people found</Text>
              <Text style={sStylesheet.emptySub}>
                {search.trim() ? `No matches for "${search}"` : 'Try changing your location filter'}
              </Text>
            </View>
          )}

          {/* Single Vertical FlatList */}
          {!loading && filteredNearbyUsers.length > 0 && (
            <FlatList
              data={filteredNearbyUsers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMoreDiscover}
              onEndReachedThreshold={0.4}
              contentContainerStyle={sStylesheet.listPadding}
              ListFooterComponent={
                isFetchingMore ? (
                  <ActivityIndicator color={theme.colors.G} style={{ marginVertical: 16 }} />
                ) : null
              }
              renderItem={({ item: user }) => (
                <DiscoverUserCard
                  user={user}
                  context={
                    activeFilterTab === 'sellers'
                      ? 'seller'
                      : activeFilterTab === 'mutuals'
                        ? 'mutual'
                        : 'neighbor'
                  }
                  onPress={() => router.push(`/profile/${user.id}` as any)}
                />
              )}
            />
          )}
        </View>
      )}

      {/* ── MODE 2: MY CIRCLE ── */}
      {mode === 'circle' && (
        <ScrollView style={sStylesheet.modeContent} showsVerticalScrollIndicator={false}>
          {/* Requests Section */}
          {requests.length > 0 && (
            <View style={sStylesheet.sectionBlock}>
              <Text style={sStylesheet.sectionHeader}>REQUESTS ({requests.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {requests.map((req) => (
                  <View key={req.id} style={sStylesheet.requestCard}>
                    <TouchableOpacity onPress={() => router.push(`/profile/${req.from_user?.id}` as any)}>
                      <Image
                        source={req.from_user?.avatar_url ? { uri: req.from_user.avatar_url } : undefined}
                        style={sStylesheet.requestAvatar}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                    <Text style={sStylesheet.requestName} numberOfLines={1}>
                      {req.from_user?.name || 'User'}
                    </Text>
                    <Text style={sStylesheet.requestHandle} numberOfLines={1}>
                      @{req.from_user?.username || 'user'}
                    </Text>
                    <View style={sStylesheet.requestActionRow}>
                      <TouchableOpacity
                        style={sStylesheet.acceptBtn}
                        onPress={() => handleRequestAction(req.id, 'accepted')}
                      >
                        <Text style={sStylesheet.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={sStylesheet.declineBtn}
                        onPress={() => handleRequestAction(req.id, 'declined')}
                      >
                        <Text style={sStylesheet.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Friends Section */}
          <View style={sStylesheet.sectionBlock}>
            <View style={sStylesheet.sectionHeaderRow}>
              <Text style={sStylesheet.sectionHeader}>FRIENDS ({friends.length})</Text>
            </View>

            {/* Circle Search Bar */}
            <View style={sStylesheet.searchBox}>
              <Ionicons name="search-outline" size={16} color={theme.colors.MUTED} />
              <TextInput
                style={sStylesheet.searchInput}
                placeholder="Search friends..."
                placeholderTextColor={theme.colors.MUTED}
                value={circleSearchQuery}
                onChangeText={setCircleSearchQuery}
              />
              {circleSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCircleSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.MUTED} />
                </TouchableOpacity>
              )}
            </View>

            {/* Friends List */}
            {filteredFriends.length === 0 ? (
              <View style={sStylesheet.emptyCircleBlock}>
                <Text style={sStylesheet.emptyCircleText}>
                  {circleSearchQuery ? 'No matching friends found' : 'No friends yet. Discover neighbors in the Nearby tab!'}
                </Text>
              </View>
            ) : (
              filteredFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.reqId || friend.user?.id}
                  style={sStylesheet.friendRow}
                  onPress={() => handleFriendOptions(friend)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={friend.user?.avatar_url ? { uri: friend.user.avatar_url } : undefined}
                    style={sStylesheet.friendAvatar}
                    contentFit="cover"
                  />
                  <View style={sStylesheet.friendInfo}>
                    <Text style={sStylesheet.friendName}>{friend.user?.name || 'Anonymous'}</Text>
                    <Text style={sStylesheet.friendHandle}>
                      @{friend.user?.username || 'user'}
                    </Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.MUTED} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Invite Friends Card */}
          <View style={sStylesheet.inviteCard}>
            <View style={sStylesheet.inviteIconCircle}>
              <Feather name="user-plus" size={20} color={theme.colors.G} />
            </View>
            <View style={sStylesheet.inviteContent}>
              <Text style={sStylesheet.inviteTitle}>Invite Friends & Neighbors</Text>
              <Text style={sStylesheet.inviteSub}>
                Build your local circle on YRDLY to share events, items, and recommendations.
              </Text>
            </View>
            <TouchableOpacity style={sStylesheet.inviteBtn} onPress={handleInvite} activeOpacity={0.8}>
              <Text style={sStylesheet.inviteBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.G,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: theme.colors.MUTED,
  },
  toggleTextActive: {
    color: '#000',
    fontFamily: 'Outfit-Bold',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.G,
  },
  modeContent: {
    flex: 1,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  chipActive: {
    backgroundColor: theme.colors.G + '20',
    borderColor: theme.colors.G,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: theme.colors.LABEL,
  },
  chipTextActive: {
    color: theme.colors.G,
    fontFamily: 'Outfit-Bold',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: theme.colors.TEXT_PRIMARY,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
    marginTop: 4,
    textAlign: 'center',
  },
  listPadding: {
    paddingBottom: 40,
  },
  sectionBlock: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: theme.colors.LABEL,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  requestCard: {
    width: 140,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
  },
  requestAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
  },
  requestName: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    color: theme.colors.TEXT_PRIMARY,
  },
  requestHandle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
    marginBottom: 10,
  },
  requestActionRow: {
    width: '100%',
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: theme.colors.G,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
  declineBtn: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingVertical: 5,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: theme.colors.MUTED,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.TEXT_PRIMARY,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE_ALT,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    color: theme.colors.TEXT_PRIMARY,
  },
  friendHandle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
  },
  emptyCircleBlock: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCircleText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
    textAlign: 'center',
  },
  inviteCard: {
    marginHorizontal: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.G + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteContent: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  inviteSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: theme.colors.MUTED,
    lineHeight: 15,
  },
  inviteBtn: {
    backgroundColor: theme.colors.G,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  inviteBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
}));
