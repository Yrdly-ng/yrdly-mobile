import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useUnistyles } from 'react-native-unistyles';
import { parsePrivateMediaReference } from '../../lib/media/private-media';
import { StorageService } from '../../lib/media/storage-service';
export function ReportAttachments({ media, sensitive }: { media: string[]; sensitive: boolean }) {
  const { theme } = useUnistyles();
  const [show, setShow] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!show || sensitive) return;
    let current = true;
    void Promise.all(
      media.map(async (value) => {
        const ref = parsePrivateMediaReference(value);
        if (ref) {
          const { data, error: failure } = await StorageService.getSignedUrl(
            ref.bucket,
            ref.path,
            300
          );
          if (failure || !data?.signedUrl) throw new Error('An attachment is unavailable.');
          return data.signedUrl as string;
        }
        const url = new URL(value);
        if (url.protocol !== 'https:') throw new Error('Invalid attachment.');
        return value;
      })
    )
      .then((result) => {
        if (current) setUrls(result);
      })
      .catch(() => {
        if (current) setError('Attachments could not be loaded. Close and try again.');
      });
    return () => {
      current = false;
    };
  }, [show, sensitive, media]);
  if (sensitive || !media.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setShow((v) => !v);
          setError('');
          setUrls([]);
        }}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.colors.TEXT_PRIMARY }}>
          {show
            ? 'Hide attachments'
            : `View ${media.length} attachment${media.length === 1 ? '' : 's'}`}
        </Text>
      </Pressable>
      {show &&
        (error ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.TEXT_PRIMARY }}>
            {error}
          </Text>
        ) : urls.length ? (
          urls.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              accessibilityLabel="Report attachment"
              contentFit="contain"
              style={{ width: '100%', height: 220 }}
            />
          ))
        ) : (
          <ActivityIndicator accessibilityLabel="Loading attachments" />
        ))}
    </View>
  );
}
