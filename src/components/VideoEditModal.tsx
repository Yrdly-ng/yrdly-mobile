import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import type { MobileFile } from '@/lib/storage-service';
import { exportNativeVideo, readNativeVideoMetadata } from '@/lib/native-video-editor';
import {
  VideoEditError,
  centeredVideoCrop,
  moveVideoCrop,
  VIDEO_ASPECTS,
  videoCropPixels,
  type VideoCrop,
  type VideoMetadata,
} from '@/lib/video-editing';
import { VideoEditSlider } from './VideoEditSlider';

interface Props {
  file: MobileFile;
  maxBytes: number;
  onFinish: (file: MobileFile | null) => void;
}

// Expo's player is an imperative native handle; its documented setter seeks.
function seekVideo(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

export default function VideoEditModal({ file, maxBytes, onFinish }: Props) {
  const { theme } = useUnistyles();
  const screen = useWindowDimensions();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [crop, setCrop] = useState<VideoCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [shape, setShape] = useState('Original');
  const [customWidth, setCustomWidth] = useState('1');
  const [customHeight, setCustomHeight] = useState('1');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const player = useVideoPlayer(file.uri, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.1;
  });
  const metadataRef = useRef(metadata);
  useLayoutEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);
  const frameWidth = metadata
    ? Math.min(screen.width - 48, (screen.height * 0.32 * metadata.width) / metadata.height, 600)
    : screen.width - 48;
  const frameHeight = metadata ? (frameWidth * metadata.height) / metadata.width : 220;
  const drag = useRef({ crop, original: crop, width: frameWidth, height: frameHeight, busy });
  useLayoutEffect(() => {
    drag.current = { ...drag.current, crop, width: frameWidth, height: frameHeight, busy };
  }, [crop, frameWidth, frameHeight, busy]);
  // PanResponder registers these callbacks; construction never reads their refs.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !drag.current.busy && Boolean(metadataRef.current),
      onMoveShouldSetPanResponder: () => !drag.current.busy && Boolean(metadataRef.current),
      onPanResponderGrant: () => {
        drag.current.original = drag.current.crop;
      },
      onPanResponderMove: (_event, gesture) =>
        setCrop(
          moveVideoCrop(
            drag.current.original,
            drag.current.original.x + gesture.dx / drag.current.width,
            drag.current.original.y + gesture.dy / drag.current.height
          )
        ),
    })
  );

  useEffect(() => {
    mounted.current = true;
    void readNativeVideoMetadata(file)
      .then((data) => {
        if (!mounted.current) return;
        setMetadata(data);
        setEnd(data.duration);
        setCustomWidth(String(data.width));
        setCustomHeight(String(data.height));
      })
      .catch((failure) => {
        if (mounted.current)
          setError(
            failure instanceof VideoEditError
              ? failure.message
              : 'Could not read this video. Please choose another file.'
          );
      });
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [file]);

  useEffect(() => {
    const timing = player.addListener('timeUpdate', (event) => {
      if (end > 0 && (event.currentTime >= end || event.currentTime < start)) {
        player.pause();
        seekVideo(player, start);
      }
    });
    const playback = player.addListener('playingChange', (event) => setPlaying(event.isPlaying));
    return () => {
      timing.remove();
      playback.remove();
    };
  }, [player, start, end]);

  const customAspect = Number(customWidth) / Number(customHeight);
  const customValid =
    shape !== 'Custom' ||
    (Number(customWidth) > 0 &&
      Number(customHeight) > 0 &&
      Number.isFinite(customAspect) &&
      customAspect >= 0.1 &&
      customAspect <= 10);
  function updateFraming(
    label: string,
    nextZoom: number,
    ratioWidth = customWidth,
    ratioHeight = customHeight
  ) {
    if (!metadata) return;
    const ratio = Number(ratioWidth) / Number(ratioHeight);
    if (
      label === 'Custom' &&
      (!Number.isFinite(ratio) ||
        Number(ratioWidth) <= 0 ||
        Number(ratioHeight) <= 0 ||
        ratio < 0.1 ||
        ratio > 10)
    )
      return;
    const aspect =
      label === 'Custom'
        ? ratio
        : (VIDEO_ASPECTS.find((value) => value.label === label)?.value ?? null);
    const next = centeredVideoCrop(metadata.width, metadata.height, aspect, 1 / nextZoom);
    setCrop((previous) =>
      moveVideoCrop(
        next,
        previous.x + (previous.width - next.width) / 2,
        previous.y + (previous.height - next.height) / 2
      )
    );
  }

  const cancel = () => {
    controller.current?.abort();
    player.pause();
    onFinish(null);
  };
  const minimum = metadata ? Math.min(0.25, metadata.duration) : 0.25;
  const pixels = metadata
    ? videoCropPixels(metadata, crop, Math.max(metadata.width, metadata.height))
    : null;
  async function apply() {
    if (!metadata || busy || controller.current || !customValid) return;
    const abort = new AbortController();
    controller.current = abort;
    player.pause();
    setBusy(true);
    setError('');
    try {
      const result = await exportNativeVideo(
        file,
        metadata,
        { start, end, crop },
        maxBytes,
        abort.signal
      );
      if (mounted.current && !abort.signal.aborted) onFinish(result);
    } catch (failure) {
      if (mounted.current && !abort.signal.aborted)
        setError(
          failure instanceof VideoEditError
            ? failure.message
            : 'Could not prepare this video. Try a shorter clip or another file.'
        );
    } finally {
      controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const text = { color: theme.colors.TEXT_PRIMARY };
  const button = [styles.button, { backgroundColor: theme.colors.SURFACE }];

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.DARK }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <View>
              <Text accessibilityRole="header" style={[styles.title, text]}>
                Edit video
              </Text>
              <Text style={{ color: theme.colors.MUTED }}>
                Trim your clip and drag the crop frame.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel video editing"
              onPress={cancel}
              style={styles.iconButton}
            >
              <Feather name="x" size={24} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.preview}>
              <View
                {...pan.panHandlers}
                style={{ width: frameWidth, height: frameHeight, overflow: 'hidden' }}
              >
                <VideoView
                  pointerEvents="none"
                  player={player}
                  style={StyleSheet.absoluteFill}
                  nativeControls={false}
                  contentFit="contain"
                  surfaceType="textureView"
                />
                {metadata && (
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <View
                      style={[
                        styles.shade,
                        { top: 0, left: 0, right: 0, height: crop.y * frameHeight },
                      ]}
                    />
                    <View
                      style={[
                        styles.shade,
                        { top: (crop.y + crop.height) * frameHeight, bottom: 0, left: 0, right: 0 },
                      ]}
                    />
                    <View
                      style={[
                        styles.shade,
                        {
                          top: crop.y * frameHeight,
                          height: crop.height * frameHeight,
                          left: 0,
                          width: crop.x * frameWidth,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.shade,
                        {
                          top: crop.y * frameHeight,
                          height: crop.height * frameHeight,
                          left: (crop.x + crop.width) * frameWidth,
                          right: 0,
                        },
                      ]}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        borderWidth: 2,
                        borderColor: theme.colors.G,
                        left: crop.x * frameWidth,
                        top: crop.y * frameHeight,
                        width: crop.width * frameWidth,
                        height: crop.height * frameHeight,
                      }}
                    />
                  </View>
                )}
                {!metadata && !error && (
                  <ActivityIndicator
                    accessibilityLabel="Loading video"
                    style={StyleSheet.absoluteFill}
                    color={theme.colors.G}
                  />
                )}
              </View>
            </View>
            {metadata && (
              <>
                <View style={styles.row}>
                  <TouchableOpacity
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Preview clip"
                    onPress={() => {
                      if (player.playing) player.pause();
                      else {
                        if (player.currentTime < start || player.currentTime >= end)
                          seekVideo(player, start);
                        player.play();
                      }
                    }}
                    style={button}
                  >
                    <Feather name={playing ? 'pause' : 'play'} size={16} color={theme.colors.G} />
                    <Text style={text}>Preview</Text>
                  </TouchableOpacity>
                  <Text style={{ color: theme.colors.MUTED }}>
                    {(end - start).toFixed(2)}s · {pixels?.outputWidth} × {pixels?.outputHeight}px
                  </Text>
                </View>
                <VideoEditSlider
                  label="Start seconds"
                  minimum={0}
                  maximum={metadata.duration}
                  value={start}
                  disabled={busy}
                  onChange={(value) => {
                    const next = Math.min(value, end - minimum);
                    setStart(next);
                    seekVideo(player, next);
                  }}
                />
                <VideoEditSlider
                  label="End seconds"
                  minimum={0}
                  maximum={metadata.duration}
                  value={end}
                  disabled={busy}
                  onChange={(value) => setEnd(Math.max(start + minimum, value))}
                />
                <View style={styles.presets}>
                  {[...VIDEO_ASPECTS.map((option) => option.label), 'Custom'].map((label) => (
                    <TouchableOpacity
                      key={label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: shape === label, disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        setShape(label);
                        setZoom(1);
                        updateFraming(label, 1);
                      }}
                      style={[
                        styles.button,
                        {
                          backgroundColor: shape === label ? theme.colors.G : theme.colors.SURFACE,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: shape === label ? '#08120b' : theme.colors.TEXT_PRIMARY,
                          fontFamily: 'Outfit-Medium',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {shape === 'Custom' && (
                  <View style={styles.row}>
                    <TextInput
                      accessibilityLabel="Custom ratio width"
                      keyboardType="decimal-pad"
                      value={customWidth}
                      onChangeText={(value) => {
                        setCustomWidth(value);
                        updateFraming(shape, zoom, value, customHeight);
                      }}
                      editable={!busy}
                      style={[styles.input, text, { backgroundColor: theme.colors.SURFACE }]}
                    />
                    <Text style={text}>:</Text>
                    <TextInput
                      accessibilityLabel="Custom ratio height"
                      keyboardType="decimal-pad"
                      value={customHeight}
                      onChangeText={(value) => {
                        setCustomHeight(value);
                        updateFraming(shape, zoom, customWidth, value);
                      }}
                      editable={!busy}
                      style={[styles.input, text, { backgroundColor: theme.colors.SURFACE }]}
                    />
                  </View>
                )}
                <VideoEditSlider
                  label="Zoom to crop"
                  minimum={1}
                  maximum={4}
                  value={zoom}
                  disabled={busy}
                  onChange={(value) => {
                    setZoom(value);
                    updateFraming(shape, value);
                  }}
                />
                <View style={styles.presets}>
                  {(
                    [
                      ['Left', -0.02, 0],
                      ['Up', 0, -0.02],
                      ['Down', 0, 0.02],
                      ['Right', 0.02, 0],
                    ] as const
                  ).map(([label, x, y]) => (
                    <TouchableOpacity
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={`Move crop ${label.toLowerCase()}`}
                      disabled={busy}
                      style={button}
                      onPress={() =>
                        setCrop((value) => moveVideoCrop(value, value.x + x, value.y + y))
                      }
                    >
                      <Text style={text}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {!customValid && (
              <Text accessibilityRole="alert" style={styles.error}>
                Enter a positive ratio between 1:10 and 10:1.
              </Text>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {busy && (
              <View accessibilityLiveRegion="polite" style={styles.row}>
                <ActivityIndicator color={theme.colors.G} />
                <Text style={text}>Preparing your video…</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" onPress={cancel} style={button}>
              <Text style={text}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                player.pause();
                onFinish(file);
              }}
              style={button}
            >
              <Text style={text}>Keep original</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!metadata || busy || !customValid}
              onPress={() => void apply()}
              style={[
                styles.button,
                {
                  backgroundColor: theme.colors.G,
                  opacity: !metadata || busy || !customValid ? 0.4 : 1,
                },
              ]}
            >
              <Text style={{ color: '#08120b', fontFamily: 'Outfit-Bold' }}>Apply edits</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  title: { fontFamily: 'Outfit-Bold', fontSize: 24, marginBottom: 4 },
  iconButton: { padding: 10 },
  body: { paddingHorizontal: 24, paddingBottom: 28, gap: 12 },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, padding: 12 },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 8,
  },
  error: { color: '#ff8585', fontSize: 14 },
});
