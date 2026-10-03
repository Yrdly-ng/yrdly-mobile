import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';

interface FriendItem {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function CreateGroupChatScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [groupTitle, setGroupTitle] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingFriends, setFetchingFriends] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchFriends = async () => {
      try {
        const [{ data: followingData }, { data: followersData }] = await Promise.all([
          supabase.from('followers').select('following_id').eq('follower_id', user.id),
          supabase.from('followers').select('follower_id').eq('following_id', user.id),
        ]);

        const followingSet = new Set((followingData || []).map((f) => f.following_id));
        const followerSet = new Set((followersData || []).map((f) => f.follower_id));

        const connectionIds = Array.from(
          new Set([...Array.from(followingSet), ...Array.from(followerSet)])
        ).filter((id) => id && id !== user.id);

        if (connectionIds.length > 0) {
          const { data: friendsData } = await supabase
            .from('users')
            .select('id, name, avatar_url')
            .in('id', connectionIds);
          setFriends(friendsData || []);
        } else {
          setFriends([]);
        }
      } catch (e) {
        console.error('Error fetching connections:', e);
      } finally {
        setFetchingFriends(false);
      }
    };
    fetchFriends();
  }, [user]);

  const toggleSelectFriend = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      Alert.alert('Group Title Required', 'Please enter a name for your group chat.');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_title: groupTitle.trim(),
        p_avatar_url: null,
        p_participant_ids: selectedIds,
      });

      if (error) throw error;

      Alert.alert('Group Created', 'Your group chat has been created successfully.');
      if (data) {
        router.replace(`/chat/${data}` as any);
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create group chat.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Code Required', 'Please enter a valid group invite code.');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const cleanCode = inviteCode.trim().toLowerCase().replace(/.*code=/, '');
      const { data, error } = await supabase.rpc('join_group_via_invite_code', {
        p_invite_code: cleanCode,
      });

      if (error) throw error;

      Alert.alert('Success', 'You have joined the group chat!');
      if (data) {
        router.replace(`/chat/${data}` as any);
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Join Error', e.message || 'Invalid or expired invite code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Chat</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Mode Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'create' && styles.tabBtnActive]}
            onPress={() => setMode('create')}
          >
            <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>
              Create Group
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'join' && styles.tabBtnActive]}
            onPress={() => setMode('join')}
          >
            <Text style={[styles.tabText, mode === 'join' && styles.tabTextActive]}>
              Join via Code
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'create' ? (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Group Name Input */}
            <Text style={styles.label}>GROUP NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ward 4 Youth Association"
              placeholderTextColor="#666666"
              value={groupTitle}
              onChangeText={setGroupTitle}
            />

            {/* Select Members */}
            <Text style={[styles.label, { marginTop: 16 }]}>
              ADD MEMBERS ({selectedIds.length} SELECTED)
            </Text>

            {fetchingFriends ? (
              <ActivityIndicator color="#82DB7E" style={{ marginTop: 20 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>
                No connections available to add yet. You can still create the group and share the invite code.
              </Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.friendItem, isSelected && styles.friendItemSelected]}
                      onPress={() => toggleSelectFriend(item.id)}
                    >
                      <Image
                        source={{ uri: item.avatar_url || 'https://via.placeholder.com/150' }}
                        style={styles.avatar}
                      />
                      <Text style={styles.friendName}>{item.name}</Text>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? '#82DB7E' : '#666666'}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Create Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleCreateGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitBtnText}>Create Group Chat</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
            <Text style={styles.label}>INVITE CODE OR LINK</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 8-character invite code"
              placeholderTextColor="#666666"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { marginTop: 24 }, loading && { opacity: 0.6 }]}
              onPress={handleJoinGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitBtnText}>Join Group</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(130, 219, 126, 0.15)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
  },
  tabTextActive: {
    color: '#82DB7E',
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 13,
    color: '#888888',
    marginTop: 12,
    lineHeight: 18,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  friendItemSelected: {
    backgroundColor: 'rgba(130, 219, 126, 0.08)',
    borderColor: 'rgba(130, 219, 126, 0.3)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    marginRight: 12,
  },
  friendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#82DB7E',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 16,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
});
