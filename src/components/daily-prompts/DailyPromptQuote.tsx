import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { api } from '../../lib/network/api';

type Question = { id: string; question: string };
const pending = new Map<string, Promise<Question | null>>();
function loadQuestion(id: string) {
  const existing = pending.get(id);
  if (existing) return existing;
  const request = api
    .get<{ prompt: Question | null }>(`/api/daily-prompts?promptId=${encodeURIComponent(id)}`)
    .then((data) => (data.prompt?.id === id ? data.prompt : null))
    .catch(() => null)
    .finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

export function DailyPromptQuote({ promptId }: { promptId?: string | null }) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [result, setResult] = useState<{ id: string; question: Question | null } | null>(null);
  const question = result && result.id === promptId ? result.question : null;
  const loading = !!promptId && result?.id !== promptId;
  useEffect(() => {
    if (!promptId) return;
    let active = true;
    void loadQuestion(promptId).then((value) => {
      if (active) {
        setResult({ id: promptId, question: value });
      }
    });
    return () => {
      active = false;
    };
  }, [promptId]);
  if (!promptId) return null;
  return (
    <View
      accessibilityLabel="Daily question context"
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.GLASS_BORDER,
        backgroundColor: theme.colors.SURFACE,
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter-SemiBold',
          fontSize: 14,
          color: theme.colors.TEXT_PRIMARY,
          marginBottom: 8,
        }}
      >
        Answering a neighbourhood question
      </Text>
      <Text
        style={{
          fontFamily: 'Outfit-Bold',
          fontSize: 16,
          lineHeight: 24,
          color: theme.colors.TEXT_PRIMARY,
        }}
      >
        {loading
          ? 'Loading question…'
          : question?.question || 'The original question is currently unavailable.'}
      </Text>
      {question && (
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="View question and neighbours’ answers"
          onPress={(event) => {
            event.stopPropagation();
            router.push({ pathname: '/daily-prompts', params: { promptId } } as any);
          }}
          style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}
        >
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY, textDecorationLine: 'underline' }}>
            View question and neighbours’ answers
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
