import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageEditModal } from '@/components/media/ImageEditModal';
import type { MobileFile } from '@/lib/media/storage-service';
export function useImageEditor() {
  const [file, setFile] = useState<MobileFile | null>(null);
  const pending = useRef<((file: MobileFile | null) => void) | null>(null);
  useEffect(
    () => () => {
      pending.current?.(null);
      pending.current = null;
    },
    []
  );
  const finish = useCallback((result: MobileFile | null) => {
    const resolve = pending.current;
    pending.current = null;
    setFile(null);
    resolve?.(result);
  }, []);
  const editImage = useCallback(
    (selected: MobileFile) =>
      new Promise<MobileFile | null>((resolve) => {
        if (pending.current) {
          resolve(null);
          return;
        }
        pending.current = resolve;
        setFile(selected);
      }),
    []
  );
  return {
    editImage,
    isEditingImage: !!file,
    imageEditor: file ? <ImageEditModal key={file.uri} file={file} onFinish={finish} /> : null,
  };
}

export async function discardEditedImage(file: MobileFile) {
  if (
    FileSystem.cacheDirectory &&
    file.uri.startsWith(FileSystem.cacheDirectory + 'yrdly-image-edits/')
  )
    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
}
