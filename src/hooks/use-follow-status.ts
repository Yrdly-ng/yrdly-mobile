import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './use-supabase-auth';

export function useFollowStatus(targetUserId: string, refreshKey?: number) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user || !targetUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [followingRes, followerRes] = await Promise.all([
        supabase
          .from('followers')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('followers')
          .select('id')
          .eq('follower_id', targetUserId)
          .eq('following_id', user.id)
          .maybeSingle(),
      ]);

      setIsFollowing(!!followingRes.data);
      setIsFollower(!!followerRes.data);
    } catch (e) {
      console.warn('Error fetching follow status:', e);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, refreshKey]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleFollow = async () => {
    if (!user || !targetUserId || actionLoading) return;
    setActionLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        setIsFollowing(false);
      } else {
        // Follow
        await supabase.from('followers').insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
        setIsFollowing(true);
      }
    } catch (e) {
      console.error('Error toggling follow:', e);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    isFollowing,
    isFollower,
    isMutual: isFollowing && isFollower,
    loading,
    actionLoading,
    toggleFollow,
  };
}
