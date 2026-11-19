import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/network/api';

type Prompt = { id: string; question: string; prompt_date: string };
type Response = {
  id: string;
  author_name: string;
  text: string;
  comment_count: number;
  created_at: string;
};
export default function DailyPromptResponsesScreen() {
  const { theme } = useUnistyles(),
    router = useRouter();
  const params = useLocalSearchParams<{ promptId?: string | string[] }>();
  const requestedId = Array.isArray(params.promptId) ? params.promptId[0] : params.promptId;
  const [currentDate, setCurrentDate] = useState('');
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showTodayLink, setShowTodayLink] = useState(false);
  const [answers, setAnswers] = useState<Response[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const refreshQuestion = () => setRefresh((attempt) => attempt + 1);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      setPrompt(null);
      setShowTodayLink(false);
      setAnswers([]);
      setNextPage(null);
      const endpoint = requestedId
        ? `/api/daily-prompts?promptId=${encodeURIComponent(requestedId)}`
        : '/api/daily-prompts';
      void api
        .get<{ prompt: Prompt | null; date: string }>(endpoint)
        .then(async (data) => {
          if (!active) return;
          if (requestedId && data.prompt?.id !== requestedId)
            throw new Error('This question is unavailable.');
          setCurrentDate(data.date);
          setPrompt(data.prompt);
          if (!data.prompt) {
            setAnswers([]);
            setNextPage(null);
            return;
          }
          if (data.prompt.prompt_date !== data.date) {
            const displayedId = data.prompt.id;
            void api.get<{ prompt: Prompt | null; date: string }>('/api/daily-prompts')
              .then(({ prompt: today, date }) => {
                if (active && today && today.id !== displayedId && today.prompt_date === date) {
                  setShowTodayLink(true);
                }
              })
              .catch(() => {}); // The historical question and answers remain available.
          }
          const result = await api.get<{ responses: Response[]; nextPage: number | null }>(
            `/api/daily-prompts/responses?promptId=${encodeURIComponent(data.prompt.id)}&page=0`
          );
          if (active) {
            setAnswers(result.responses);
            setNextPage(result.nextPage);
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load question');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // A manual retry restarts the focused request for the same question.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedId, refresh])
  );
  const loadMore = async () => {
    if (!prompt || nextPage === null || more) return;
    setMore(true);
    try {
      const result = await api.get<{ responses: Response[]; nextPage: number | null }>(
        `/api/daily-prompts/responses?promptId=${encodeURIComponent(prompt.id)}&page=${nextPage}`
      );
      setAnswers((old) => [
        ...old,
        ...result.responses.filter((item) => !old.some((x) => x.id === item.id)),
      ]);
      setNextPage(result.nextPage);
    } catch {
      setError('Could not load more answers');
    } finally {
      setMore(false);
    }
  };
  const isToday = prompt?.prompt_date === currentDate;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 18,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 20, color: theme.colors.TEXT_PRIMARY }}>
          Neighbourhood Question
        </Text>
      </View>
      {loading ? (
        <View style={{ alignItems: 'center', gap: 12, padding: 28 }}>
          <ActivityIndicator color={theme.colors.G} />
          <Text style={{ color: theme.colors.TEXT_PRIMARY }}>Loading neighbourhood question…</Text>
        </View>
      ) : (
        <FlatList
          data={answers}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 20, paddingVertical: 18, gap: 12 }}>
              {prompt ? (
                <>
                  {!isToday && (
                    <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}>
                      Past neighbourhood question
                    </Text>
                  )}
                  <Text
                    style={{
                      fontFamily: 'Outfit-Bold',
                      fontSize: 20,
                      lineHeight: 28,
                      color: theme.colors.TEXT_PRIMARY,
                    }}
                  >
                    {prompt.question}
                  </Text>
                  {isToday ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/create-post',
                          params: { dailyPrompt: prompt.id },
                        } as any)
                      }
                      style={{
                        backgroundColor: theme.colors.G,
                        borderRadius: 20,
                        padding: 13,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' }}>
                        Share your answer
                      </Text>
                    </TouchableOpacity>
                  ) : showTodayLink && (
                    <TouchableOpacity
                      accessibilityRole="link"
                      onPress={() => router.setParams({ promptId: '' })}
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold' }}>
                        View today’s question
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text
                    style={{
                      fontFamily: 'Outfit-Bold',
                      fontSize: 16,
                      color: theme.colors.TEXT_PRIMARY,
                    }}
                  >
                    Neighbourhood responses
                  </Text>
                </>
              ) : !error && (
                <View style={{ gap: 10, padding: 18, borderRadius: 18, backgroundColor: theme.colors.SURFACE }}>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Bold', fontSize: 18 }}>
                    Today’s question isn’t available yet
                  </Text>
                  <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
                    New questions open from 7 a.m. Lagos time. Check back later today.
                  </Text>
                  <TouchableOpacity accessibilityRole="button" onPress={refreshQuestion} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold' }}>Check again</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!!error && (
                <View style={{ gap: 8 }}>
                  <Text accessibilityRole="alert" style={{ color: theme.colors.TEXT_PRIMARY }}>{error}</Text>
                  {!prompt && (
                    <TouchableOpacity accessibilityRole="button" onPress={refreshQuestion} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Text style={{ color: theme.colors.G, fontFamily: 'Inter-SemiBold' }}>Try again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push(`/posts/${item.id}` as any)}
              style={{
                marginHorizontal: 20,
                marginBottom: 12,
                padding: 16,
                borderRadius: 18,
                backgroundColor: theme.colors.SURFACE,
                borderColor: theme.colors.GLASS_BORDER,
                borderWidth: 1,
              }}
            >
              <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}>
                {item.author_name}
              </Text>
              <Text style={{ color: theme.colors.TEXT_PRIMARY, marginTop: 8, lineHeight: 22 }}>
                {item.text}
              </Text>
              <Text style={{ color: theme.colors.MUTED, fontSize: 12, marginTop: 8 }}>
                View discussion · {item.comment_count || 0} comments
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            prompt ? (
              <Text style={{ textAlign: 'center', color: theme.colors.MUTED, padding: 28 }}>
                {isToday ? 'No answers nearby yet. Be the first!' : 'No neighbourhood answers to show.'}
              </Text>
            ) : null
          }
          ListFooterComponent={
            nextPage !== null ? (
              <TouchableOpacity
                disabled={more}
                onPress={() => void loadMore()}
                style={{ padding: 18, alignSelf: 'center' }}
              >
                <Text style={{ color: theme.colors.G }}>
                  {more ? 'Loading…' : 'Load more responses'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
