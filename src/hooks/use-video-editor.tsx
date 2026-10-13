import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import type { MobileFile } from '@/lib/storage-service';
import VideoEditModal from '@/components/VideoEditModal';

const ALLOWED = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

/** Delete only files created by our editor, never the user's camera-roll source. */
export async function discardEditedVideo(file: MobileFile) {
  if (
    FileSystem.cacheDirectory &&
    file.uri.startsWith(FileSystem.cacheDirectory + 'yrdly-video-edits/')
  ) {
    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
  }
}

export function useVideoEditor() {
  const [request, setRequest] = useState<{ file: MobileFile; maxBytes: number; id: number } | null>(
    null
  );
  const [checking, setChecking] = useState(false);
  const pending = useRef<((file: MobileFile | null) => void) | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const sequence = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.(null);
      pending.current = null;
    };
  }, []);

  const finish = useCallback((file: MobileFile | null) => {
    const resolve = pending.current;
    pending.current = null;
    if (mounted.current) setRequest(null);
    resolve?.(file);
  }, []);

  const editVideo = useCallback(
    async (file: MobileFile, maxBytes: number): Promise<MobileFile | null> => {
      if (!mounted.current || locked.current) return null;
      locked.current = true;
      setChecking(true);
      try {
        if (!ALLOWED.has(file.type)) throw new Error('Choose an MP4, MOV or WebM video.');
        const info = await FileSystem.getInfoAsync(file.uri);
        if (!info.exists || info.isDirectory)
          throw new Error('This video is no longer available. Please choose it again.');
        if (info.size > maxBytes)
          throw new Error(`Video must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        if (!mounted.current) return null;
        setChecking(false);
        return await new Promise((resolve) => {
          pending.current = resolve;
          setRequest({ file, maxBytes, id: ++sequence.current });
        });
      } finally {
        locked.current = false;
        if (mounted.current) setChecking(false);
      }
    },
    []
  );

  return {
    editVideo,
    isEditingVideo: checking || Boolean(request),
    videoEditor: request ? (
      <VideoEditModal
        key={request.id}
        file={request.file}
        maxBytes={request.maxBytes}
        onFinish={finish}
      />
    ) : null,
  };
}
