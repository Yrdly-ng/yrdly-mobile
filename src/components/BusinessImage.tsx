import React, { useState } from 'react';
import { Image, ImageProps } from 'expo-image';

/** Bundled fallback also covers failed and outdated business image URLs. */
export function BusinessImage({
  uri,
  ...props
}: Omit<ImageProps, 'source'> & { uri?: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const validUri = uri && !uri.startsWith('file://') && uri !== failedUri ? uri : null;
  return (
    <Image
      {...props}
      source={validUri ? { uri: validUri } : require('../../assets/images/logo.png')}
      recyclingKey={uri || 'business-placeholder'}
      onError={() => setFailedUri(uri || null)}
    />
  );
}
