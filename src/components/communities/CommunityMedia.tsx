import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import ImageViewing from 'react-native-image-viewing';

function CommunityPhoto({
  url,
  width,
  index,
  onOpen,
}: {
  url: string;
  width: number | '100%';
  index: number;
  onOpen: () => void;
}) {
  const [aspectRatio, setAspectRatio] = useState(1);
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open photo ${index + 1}`}
      style={{ width }}
    >
      <Image
        source={{ uri: url }}
        style={{ width: '100%', aspectRatio, borderRadius: 12 }}
        contentFit="contain"
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) {
            setAspectRatio(Math.min(2, Math.max(0.75, source.width / source.height)));
          }
        }}
      />
    </TouchableOpacity>
  );
}

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
  const [mediaWidth, setMediaWidth] = useState(0);
  const photos = images.filter(Boolean);
  return (
    <View style={{ gap: 10 }} onLayout={(event) => setMediaWidth(event.nativeEvent.layout.width)}>
      {photos.length === 1 ? (
        <View style={{ paddingVertical: 10 }}>
          <CommunityPhoto
            key={photos[0]}
            url={photos[0]}
            width="100%"
            index={0}
            onOpen={() => setSelected(0)}
          />
        </View>
      ) : photos.length > 1 && mediaWidth > 0 ? (
        <ScrollView horizontal pagingEnabled contentContainerStyle={{ paddingVertical: 10 }}>
          {photos.map((url, index) => (
            <CommunityPhoto
              key={`${url}-${index}`}
              url={url}
              width={mediaWidth}
              index={index}
              onOpen={() => setSelected(index)}
            />
          ))}
        </ScrollView>
      ) : null}
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
