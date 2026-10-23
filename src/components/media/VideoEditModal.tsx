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
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import type { MobileFile } from '@/lib/media/storage-service';
import { exportNativeVideo, readNativeVideoMetadata } from '@/lib/media/native-video-editor';
import {
  VideoEditError,
  centeredVideoCrop,
  moveVideoCrop,
  VIDEO_ASPECTS,
  videoCropPixels,
  type VideoCrop,
  type VideoMetadata,
} from '@/lib/media/video-editing';
import { VideoEditSlider } from './VideoEditSlider';
import { VideoTrimTimeline } from './VideoTrimTimeline';
import { CropFrame } from './CropFrame';

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
  const [shape, setShape] = useState('Freeform');
  const [mode, setMode] = useState<'trim' | 'crop'>('trim');
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
  const drag = useRef({
    crop,
    original: crop,
    width: frameWidth,
    height: frameHeight,
    busy,
    distance: 0,
  });
  useLayoutEffect(() => {
    drag.current = { ...drag.current, crop, width: frameWidth, height: frameHeight, busy };
  }, [crop, frameWidth, frameHeight, busy]);
  // PanResponder registers these callbacks; construction never reads their refs.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !drag.current.busy && Boolean(metadataRef.current),
      onMoveShouldSetPanResponder: () => !drag.current.busy && Boolean(metadataRef.current),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        drag.current.original = drag.current.crop;
        const touches = event.nativeEvent.touches;
        drag.current.distance =
          touches.length > 1
            ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
            : 0;
      },
      onPanResponderMove: (event, gesture) => {
        if (drag.current.busy) return;
        const touches = event.nativeEvent.touches;
        if (touches.length > 1) {
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          if (!drag.current.distance) {
            drag.current.distance = distance;
            drag.current.original = drag.current.crop;
            return;
          }
          const original = drag.current.original;
          const factor = Math.max(
            0.05 / Math.min(original.width, original.height),
            Math.min(
              1 / Math.max(original.width, original.height),
              drag.current.distance / Math.max(distance, 1)
            )
          );
          const width = original.width * factor,
            height = original.height * factor;
          setCrop(
            moveVideoCrop(
              { ...original, width, height },
              original.x + (original.width - width) / 2,
              original.y + (original.height - height) / 2
            )
          );
          setZoom(Math.min(8, Math.max(1, 1 / Math.max(width, height))));
          return;
        }
        if (drag.current.distance) return;
        setCrop(
          moveVideoCrop(
            drag.current.original,
            drag.current.original.x + gesture.dx / drag.current.width,
            drag.current.original.y + gesture.dy / drag.current.height
          )
        );
      },
    })
  );

  useEffect(() => {
    mounted.current = true;
    void readNativeVideoMetadata(file)
      .then((data) => {
        if (!mounted.current) return;
        setMetadata(data);
        setEnd(data.duration);
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

  const customValid = true;
  function updateFraming(label: string, nextZoom: number) {
    if (!metadata) return;
    if (label === 'Freeform') {
      setCrop((previous) => {
        const scale = zoom / nextZoom;
        const factor = Math.min(scale, 1 / Math.max(previous.width, previous.height));
        const width = Math.max(0.05, previous.width * factor),
          height = Math.max(0.05, previous.height * factor);
        return moveVideoCrop(
          { ...previous, width, height },
          previous.x + (previous.width - width) / 2,
          previous.y + (previous.height - height) / 2
        );
      });
      return;
    }
    const aspect =
      VIDEO_ASPECTS.find((option) => option.label === label)?.value ??
      metadata.width / metadata.height;
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
    mounted.current = false;
    player.pause();
    onFinish(null);
  };
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
                {mode === 'crop'
                  ? 'Drag a corner or edge to crop. Drag inside to move, or pinch to zoom.'
                  : 'Drag the ends to trim. Tap Crop to change the framing.'}
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
                {...(mode === 'crop' ? pan.panHandlers : {})}
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
                {metadata && mode === 'crop' && (
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
                {metadata && mode === 'crop' && (
                  <CropFrame
                    crop={crop}
                    width={frameWidth}
                    height={frameHeight}
                    disabled={busy}
                    aspect={
                      shape === 'Freeform'
                        ? null
                        : VIDEO_ASPECTS.find((option) => option.label === shape)?.value ||
                          metadata.width / metadata.height
                    }
                    onChange={setCrop}
                  />
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
                <View style={styles.row}>
                  {(['trim', 'crop'] as const).map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setMode(tab)}
                      style={[
                        styles.button,
                        { backgroundColor: mode === tab ? '#82DB7E' : '#29312B' },
                      ]}
                    >
                      <Text style={{ color: mode === tab ? '#102114' : '#FFFFFF' }}>
                        {tab === 'trim' ? 'Trim' : 'Crop'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => {
                      setStart(0);
                      setEnd(metadata.duration);
                      setCrop({ x: 0, y: 0, width: 1, height: 1 });
                      setShape('Freeform');
                      setZoom(1);
                    }}
                    style={button}
                  >
                    <Text style={text}>Reset</Text>
                  </TouchableOpacity>
                </View>
                {mode === 'trim' ? (
                  <VideoTrimTimeline
                    uri={file.uri}
                    duration={metadata.duration}
                    start={start}
                    end={end}
                    disabled={busy}
                    onChange={(nextStart, nextEnd) => {
                      setStart(nextStart);
                      setEnd(nextEnd);
                    }}
                    onSeek={(seconds) => {
                      player.pause();
                      seekVideo(player, seconds);
                    }}
                  />
                ) : (
                  <>
                    <View style={styles.presets}>
                      {['Freeform', ...VIDEO_ASPECTS.map((option) => option.label)].map((label) => (
                        <TouchableOpacity
                          key={label}
                          accessibilityRole="button"
                          accessibilityState={{ selected: shape === label, disabled: busy }}
                          disabled={busy}
                          onPress={() => {
                            setShape(label);
                            setZoom(1);
                            if (label === 'Freeform') return;
                            updateFraming(label, 1);
                          }}
                          style={[
                            styles.button,
                            {
                              backgroundColor:
                                shape === label ? theme.colors.G : theme.colors.SURFACE,
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
                  </>
                )}
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
              <Text style={{ color: '#08120b', fontFamily: 'Outfit-Bold' }}>Confirm</Text>
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
