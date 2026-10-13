import * as FileSystem from 'expo-file-system/legacy';
import type { MobileFile } from './storage-service';
import {
  VideoEditError,
  validateVideoEdit,
  videoCropPixels,
  videoEditIsOriginal,
  type VideoEdit,
  type VideoMetadata,
} from './video-editing';

let processing: Promise<unknown> = Promise.resolve();

async function getToolkit() {
  try {
    return (await import('react-native-media-toolkit')).MediaToolkit;
  } catch {
    throw new VideoEditError(
      'Video editing is unavailable in this app version. Update Yrdly to edit your video.'
    );
  }
}

function cancelled(signal: AbortSignal) {
  if (signal.aborted) {
    const error = new Error('Video editing cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

export async function readNativeVideoMetadata(file: MobileFile): Promise<VideoMetadata> {
  const toolkit = await getToolkit();
  // Thumbnail extraction supports all native video containers and returns
  // rotation-corrected dimensions; do not infer metadata from the extension.
  const thumbnail = await toolkit.getThumbnail(file.uri, { timeMs: 0, maxWidth: 256, quality: 50 });
  try {
    const metadata = {
      width: thumbnail.width,
      height: thumbnail.height,
      duration: thumbnail.duration / 1000,
    };
    validateVideoEdit(metadata, {
      start: 0,
      end: metadata.duration,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
    return metadata;
  } finally {
    if (thumbnail.uri !== file.uri)
      await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => {});
  }
}

async function encode(
  file: MobileFile,
  metadata: VideoMetadata,
  edit: VideoEdit,
  maxBytes: number,
  signal: AbortSignal
): Promise<MobileFile> {
  cancelled(signal);
  validateVideoEdit(metadata, edit);
  const info = await FileSystem.getInfoAsync(file.uri);
  cancelled(signal);
  if (!info.exists || info.isDirectory || info.size > maxBytes)
    throw new VideoEditError('This video exceeds the upload limit or is no longer available.');
  if (videoEditIsOriginal(metadata, edit)) return file;
  if (!FileSystem.cacheDirectory)
    throw new VideoEditError('Video storage is unavailable. Please try again.');
  const directory = FileSystem.cacheDirectory + 'yrdly-video-edits/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const outputUri = directory + Date.now() + '-' + Math.random().toString(36).slice(2) + '.mp4';
  let accepted = false;
  try {
    const toolkit = await getToolkit();
    cancelled(signal);
    const pixels = videoCropPixels(metadata, edit.crop, Math.max(metadata.width, metadata.height));
    const result = await toolkit.trimAndCropVideo(file.uri, {
      startTime: Math.round(edit.start * 1000),
      endTime: Math.round(edit.end * 1000),
      x: pixels.left / metadata.width,
      y: pixels.top / metadata.height,
      width: pixels.outputWidth / metadata.width,
      height: pixels.outputHeight / metadata.height,
      outputPath: outputUri.replace(/^file:\/\//, ''),
    });
    cancelled(signal);
    const saved = await FileSystem.getInfoAsync(outputUri);
    cancelled(signal);
    if (!saved.exists || saved.isDirectory || saved.size === 0)
      throw new VideoEditError('The edited video could not be saved. Please try again.');
    if (saved.size > maxBytes)
      throw new VideoEditError(
        'The edited video is too large. Try a shorter clip or smaller frame.'
      );
    if (Math.abs(result.duration / 1000 - (edit.end - edit.start)) > 0.5)
      throw new VideoEditError(
        'The video could not be trimmed accurately. Please try another clip.'
      );
    accepted = true;
    return {
      uri: outputUri,
      name: (file.name.replace(/\.[^.]+$/, '') || 'video') + '-edited.mp4',
      type: 'video/mp4',
      size: saved.size,
    };
  } finally {
    if (!accepted) await FileSystem.deleteAsync(outputUri, { idempotent: true }).catch(() => {});
  }
}

/** Serialize native encoders. Cancelled dialogs discard and clean late results. */
export function exportNativeVideo(
  file: MobileFile,
  metadata: VideoMetadata,
  edit: VideoEdit,
  maxBytes: number,
  signal: AbortSignal
): Promise<MobileFile> {
  const result = processing
    .catch(() => {})
    .then(() => encode(file, metadata, edit, maxBytes, signal));
  processing = result.then(
    () => {},
    () => {}
  );
  return result;
}
