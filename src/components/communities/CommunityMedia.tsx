import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import ImageViewing from 'react-native-image-viewing';

function CommunityVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: '100%', height: 230, borderRadius: 12 }}
      contentFit="contain"
    />
  );
}
export function CommunityRevisionNotice({
  item,
}: {
  item: { revision_status?: string; revision_reason?: string | null };
}) {
  if (!item.revision_status) return null;
  return (
    <Text
      style={{ color: item.revision_status === 'rejected' ? '#ef4444' : '#b68a27', fontSize: 13 }}
    >
      {item.revision_status === 'pending'
        ? 'Your edited version is awaiting review. The published version stays visible.'
        : `Your edit was rejected. ${item.revision_reason || 'The published version is unchanged.'}`}
    </Text>
  );
}
export function CommunityMedia({
  images = [],
  videos = [],
}: {
  images?: string[];
  videos?: string[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const photos = images.filter(Boolean);
  return (
    <View style={{ gap: 10 }}>
      {!!photos.length && (
        <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {photos.map((url, index) => (
            <TouchableOpacity
              key={`${url}-${index}`}
              onPress={() => setSelected(index)}
              accessibilityLabel={`Open photo ${index + 1}`}
            >
              <Image
                source={{ uri: url }}
                style={{ width: 180, height: 180, borderRadius: 12 }}
                contentFit="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {videos.filter(Boolean).map((url) => (
        <CommunityVideo key={url} url={url} />
      ))}
      {selected !== null && (
        <ImageViewing
          images={photos.map((uri) => ({ uri }))}
          imageIndex={selected}
          visible
          onRequestClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}
