import React from 'react';
import { Composition, Folder, delayRender, continueRender } from 'remotion';
import { Campaign, scenes } from './compositions/Campaign';
import { ShortEdit, FeatureTeaser } from './compositions/ShortEdits';
import { Feature } from './components/Elements';
import { fontsReady } from './theme';
import { ReferenceFilm } from './reference-film/Film';
import { Opening } from './reference-film/Opening';
import { Introduction } from './reference-film/Introduction';
import { FeatureScene } from './reference-film/FeatureScene';
import { Carousel } from './reference-film/Carousel';
import { Endboard } from './reference-film/Endboard';
import { InteractionProof } from './interaction-proof/Film';
import { MainFilm } from './main-film/Film';
import { NarratedMainFilm } from './main-film/Narrated';
import { MAIN_FRAMES } from './main-film/timeline';
const handle = delayRender('Loading original YRDLY fonts');
fontsReady.then(() => continueRender(handle));
export const Root = () => (
  <>
    <Folder name="Interaction-led-film">
      <Composition id="YrdlyMainNarrated60" component={NarratedMainFilm} durationInFrames={MAIN_FRAMES} fps={60} width={1920} height={1080} defaultProps={{ renderScale: 2 / 3, withAudio: true }} />
      <Composition id="YrdlyInteractionMain" component={MainFilm} durationInFrames={MAIN_FRAMES} fps={60} width={1920} height={1080} defaultProps={{ renderScale: 2 / 3, withAudio: true }} />
      <Composition id="YrdlyInteractionProof14" component={InteractionProof} durationInFrames={840} fps={60} width={1920} height={1080} />
    </Folder>
    <Folder name="Reference-film">
      <Composition id="YrdlyReferenceMain36" component={ReferenceFilm} durationInFrames={2160} fps={60} width={1920} height={1080} defaultProps={{vertical:false,withAudio:true}}/>
      <Composition id="YrdlyReferenceSocial15" component={ReferenceFilm} durationInFrames={900} fps={60} width={1080} height={1920} defaultProps={{vertical:true,withAudio:true}}/>
      <Folder name="Editable-scenes">
        <Composition id="RefOpening" component={Opening} durationInFrames={222} fps={60} width={1920} height={1080}/>
        <Composition id="RefIntroduction" component={Introduction} durationInFrames={222} fps={60} width={1920} height={1080}/>
        {(['event','marketplace','business','community'] as const).map(feature=><Composition key={feature} id={`Ref-${feature}`} component={FeatureScene} durationInFrames={342} fps={60} width={1920} height={1080} defaultProps={{feature}}/>)}
        <Composition id="RefCarousel" component={Carousel} durationInFrames={342} fps={60} width={1920} height={1080}/>
        <Composition id="RefEndboard" component={Endboard} durationInFrames={300} fps={60} width={1920} height={1080}/>
      </Folder>
    </Folder>
    <Composition
      id="YrdlyMain36"
      component={Campaign}
      durationInFrames={2160}
      fps={60}
      width={1920}
      height={1080}
      defaultProps={{ vertical: false }}
    />
    <Composition
      id="YrdlySocial15"
      component={Campaign}
      durationInFrames={900}
      fps={60}
      width={1080}
      height={1920}
      defaultProps={{ vertical: true }}
    />
    <Folder name="Scene-studies">
      {Object.entries(scenes).map(([name, Component]) => (
        <Composition
          key={name}
          id={`Scene-${name}`}
          component={Component}
          durationInFrames={360}
          fps={60}
          width={1920}
          height={1080}
          defaultProps={{ vertical: false, fast: false, duration: 360 }}
        />
      ))}
    </Folder>
    <Composition id="YrdlyShort8" component={ShortEdit} durationInFrames={480} fps={60} width={1080} height={1920} />
    <Folder name="Feature-teasers">
      {([
        ['YrdlyEvents6', 'event'],
        ['YrdlyMarketplace6', 'marketplace'],
        ['YrdlyBusinesses6', 'business'],
        ['YrdlyCommunities6', 'community'],
      ] as [string, Feature][]).map(([id, feature]) => (
        <Composition key={id} id={id} component={FeatureTeaser} durationInFrames={360} fps={60} width={1080} height={1920} defaultProps={{ feature }} />
      ))}
    </Folder>
  </>
);
