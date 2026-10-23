import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { MobileFile } from '@/lib/media/storage-service';
import { centeredVideoCrop, moveVideoCrop, type VideoCrop } from '@/lib/media/video-editing';
import { CropFrame } from './CropFrame';

const presets = [
  ['Freeform', null],
  ['Original', 0],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
] as const;
export function ImageEditModal({
  file,
  onFinish,
}: {
  file: MobileFile;
  onFinish: (file: MobileFile | null) => void;
}) {
  const screen = useWindowDimensions();
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<VideoCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [aspect, setAspect] = useState<number | null>(null);
  const [label, setLabel] = useState('Freeform');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true),
    exporting = useRef(false);
  const cancel = () => {
    mounted.current = false;
    onFinish(null);
  };
  const width = dimensions
    ? Math.min(screen.width - 40, (screen.height * 0.55 * dimensions.width) / dimensions.height)
    : screen.width - 40;
  const height = dimensions ? (width * dimensions.height) / dimensions.width : 260;
  const current = useRef({ crop, width, height, busy });
  const origin = useRef({ crop, distance: 0 });
  useLayoutEffect(() => {
    current.current = { crop, width, height, busy };
  }, [crop, width, height, busy]);
  // PanResponder registers callbacks; these refs are read only when gestures arrive.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.busy,
      onMoveShouldSetPanResponder: () => !current.current.busy,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        origin.current = {
          crop: current.current.crop,
          distance:
            touches.length > 1
              ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
              : 0,
        };
      },
      onPanResponderMove: (event, gesture) => {
        const p = current.current,
          initial = origin.current.crop,
          touches = event.nativeEvent.touches;
        if (p.busy) return;
        if (touches.length > 1 && origin.current.distance === 0) {
          origin.current = {
            crop: p.crop,
            distance: Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            ),
          };
          return;
        }
        if (touches.length > 1 && origin.current.distance > 0) {
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          const factor = Math.max(
            0.05 / Math.min(initial.width, initial.height),
            Math.min(
              1 / Math.max(initial.width, initial.height),
              origin.current.distance / Math.max(1, distance)
            )
          );
          const w = initial.width * factor,
            h = initial.height * factor;
          setCrop(
            moveVideoCrop(
              { x: initial.x, y: initial.y, width: w, height: h },
              initial.x + (initial.width - w) / 2,
              initial.y + (initial.height - h) / 2
            )
          );
        } else
          setCrop(
            moveVideoCrop(
              initial,
              initial.x + gesture.dx / p.width,
              initial.y + gesture.dy / p.height
            )
          );
      },
    })
  );
  useEffect(() => {
    mounted.current = true;
    void import('react-native-media-toolkit')
      .then(({ MediaToolkit }) => MediaToolkit.getMediaMetadata(file.uri))
      .then((metadata) => {
        if (mounted.current && metadata.width > 0 && metadata.height > 0) setDimensions(metadata);
      })
      .catch(() => {
        if (mounted.current) setError('Could not open this photo. You can keep the original.');
      });
    return () => {
      mounted.current = false;
    };
  }, [file.uri]);
  async function confirm() {
    if (!dimensions || exporting.current) return;
    if (crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1) {
      onFinish(file);
      return;
    }
    exporting.current = true;
    setBusy(true);
    setError('');
    let croppedUri: string | undefined,
      outputUri: string | undefined,
      accepted = false;
    try {
      const { MediaToolkit } = await import('react-native-media-toolkit');
      if (!FileSystem.cacheDirectory) throw new Error('Photo storage unavailable');
      const directory = FileSystem.cacheDirectory + 'yrdly-image-edits/';
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const name = Crypto.randomUUID();
      const cropped = await MediaToolkit.cropImage(file.uri, {
        ...crop,
        outputPath: (directory + name + '-crop.png').replace(/^file:\/\//, ''),
      });
      croppedUri = cropped.uri;
      // Bound output size, normalize orientation, and omit location/EXIF metadata.
      const output = await MediaToolkit.compressImage(cropped.uri, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 88,
        format: file.type === 'image/png' ? 'png' : 'jpeg',
        outputPath: (directory + name + (file.type === 'image/png' ? '.png' : '.jpg')).replace(
          /^file:\/\//,
          ''
        ),
      });
      outputUri = output.uri;
      if (!mounted.current) return;
      const info = await FileSystem.getInfoAsync(output.uri);
      if (!info.exists || info.isDirectory || !info.size) throw new Error('Photo export failed');
      accepted = true;
      onFinish({
        uri: output.uri,
        name:
          (file.name.replace(/\.[^.]+$/, '') || 'photo') +
          (file.type === 'image/png' ? '-cropped.png' : '-cropped.jpg'),
        type: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        size: info.size,
      });
    } catch {
      if (mounted.current) setError('Could not save the crop. Your original photo is safe.');
    } finally {
      if (croppedUri && croppedUri !== file.uri && (!accepted || croppedUri !== outputUri))
        void FileSystem.deleteAsync(croppedUri, { idempotent: true }).catch(() => {});
      if (!accepted && outputUri && outputUri !== file.uri)
        void FileSystem.deleteAsync(outputUri, { idempotent: true }).catch(() => {});
      exporting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const button = { padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: '#29312B' };
  return (
    <Modal visible presentationStyle="fullScreen" animationType="slide" onRequestClose={cancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#101511', padding: 20, gap: 18 }}>
        <Text
          accessibilityRole="header"
          style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}
        >
          Crop photo
        </Text>
        <Text style={{ color: '#C5D0C7' }}>
          Drag a corner or edge to crop. Drag inside to move, or pinch to zoom.
        </Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View {...pan.panHandlers} style={{ width, height }}>
            <Image source={{ uri: file.uri }} style={{ width, height }} contentFit="contain" />
            {dimensions && (
              <CropFrame
                crop={crop}
                width={width}
                height={height}
                aspect={aspect}
                disabled={busy}
                onChange={setCrop}
              />
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {presets.map(([name, ratio]) => (
            <TouchableOpacity
              key={name}
              disabled={busy}
              onPress={() => {
                const selected =
                  ratio === 0 && dimensions ? dimensions.width / dimensions.height : ratio;
                setAspect(selected);
                setLabel(name);
                if (dimensions)
                  setCrop(centeredVideoCrop(dimensions.width, dimensions.height, selected));
              }}
              style={[button, { backgroundColor: label === name ? '#82DB7E' : '#29312B' }]}
            >
              <Text style={{ color: label === name ? '#102114' : '#FFFFFF' }}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: '#FF9898' }}>
            {error}
          </Text>
        )}
        {busy && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActivityIndicator color="#82DB7E" />
            <Text style={{ color: '#FFFFFF' }}>Preparing photo…</Text>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <TouchableOpacity style={button} onPress={cancel}>
            <Text style={{ color: '#FFFFFF' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={button}
            disabled={busy}
            onPress={() => {
              setCrop({ x: 0, y: 0, width: 1, height: 1 });
              setAspect(null);
              setLabel('Freeform');
            }}
          >
            <Text style={{ color: '#FFFFFF' }}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={button} disabled={busy} onPress={() => onFinish(file)}>
            <Text style={{ color: '#FFFFFF' }}>Keep original</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={button}
            disabled={busy || !dimensions}
            onPress={() => void confirm()}
          >
            <Text style={{ color: '#82DB7E' }}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
