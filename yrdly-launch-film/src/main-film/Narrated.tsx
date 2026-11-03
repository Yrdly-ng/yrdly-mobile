import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { MainFilm } from './Film';

// Preserve the editable picture and original music-only composition. Narration,
// ducked score and tactile effects are reproducibly mixed from retained stems.
export function NarratedMainFilm({ renderScale = 2 / 3, withAudio = true }: {
  renderScale?: number; withAudio?: boolean;
}) {
  return <AbsoluteFill>
    <MainFilm renderScale={renderScale} withAudio={false} />
    {withAudio ? <Audio src={staticFile('audio/voiceover/main-voiceover-mix.wav')} /> : null}
  </AbsoluteFill>;
}
