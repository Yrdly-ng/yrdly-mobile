import React from 'react';
import { Sequence } from 'remotion';
import { CaptionOverlay }          from '../../components/CaptionOverlay';
import { PostUpdateHookScene }     from './PostUpdateHookScene';
import { EntrySheetScene }         from './EntrySheetScene';
import { ComposeScene }            from './ComposeScene';
import { SuccessAndFeedScene }     from './SuccessAndFeedScene';
import { PostUpdateEndCardScene }  from './PostUpdateEndCardScene';

// ─── Frame budget @ 30fps ────────────────────────────────────────────────────
// PostUpdateHookScene  : 60f  (~2.0s)  v2 Hook Intro — 3D beams + headline
// EntrySheetScene      : 230f (~7.7s)  FAB tap → sheet → "Create Post" → exit
// ComposeScene         : 385f (~12.8s) Header, author, vis toggle, type, photo, Post tap + progress
// SuccessAndFeedScene  : 250f (~8.3s)  Success → "Back to Feed" tap → feed (4s hold)
// PostUpdateEndCardScene: 90f (~3.0s)  v2 End Card — Yrdly logo lockup
// TOTAL               : 1015f (~33.8s)

const HOOK_DUR    = 60;
const ENTRY_DUR   = 230;
const COMPOSE_DUR = 385;
const SUCCESS_DUR = 250;
const END_DUR     = 90;

const HOOK_START    = 0;
const ENTRY_START   = HOOK_START   + HOOK_DUR;
const COMPOSE_START = ENTRY_START  + ENTRY_DUR;
const SUCCESS_START = COMPOSE_START + COMPOSE_DUR;
const END_START     = SUCCESS_START + SUCCESS_DUR;

export const POSTUPDATEFLOW_TOTAL_DURATION =
  HOOK_DUR + ENTRY_DUR + COMPOSE_DUR + SUCCESS_DUR + END_DUR;
// = 1015

export const PostUpdateFlowComposition: React.FC = () => (
  <>
    <Sequence from={HOOK_START}    durationInFrames={HOOK_DUR}    name="Hook">
      <PostUpdateHookScene />
    </Sequence>

    <Sequence from={ENTRY_START}   durationInFrames={ENTRY_DUR}   name="EntrySheet">
      <EntrySheetScene />
    </Sequence>

    <Sequence from={COMPOSE_START} durationInFrames={COMPOSE_DUR} name="Compose">
      <ComposeScene />
    </Sequence>

    <Sequence from={SUCCESS_START} durationInFrames={SUCCESS_DUR} name="SuccessAndFeed">
      <SuccessAndFeedScene />
    </Sequence>

    <Sequence from={END_START}     durationInFrames={END_DUR}     name="EndCard">
      <PostUpdateEndCardScene />
    </Sequence>

    {/* Kinetic Captions for Mute Social Viewing */}
    <CaptionOverlay startFrame={HOOK_START + 5}    durationFrames={50}  text="Share neighbourhood updates & local news"       highlightWords={['neighbourhood', 'updates', 'news']} />
    <CaptionOverlay startFrame={ENTRY_START + 20}  durationFrames={150} text="Tap + Create to open your neighbourhood toolbar" highlightWords={['+ Create', 'toolbar']} />
    <CaptionOverlay startFrame={COMPOSE_START + 10} durationFrames={140} text="Set post visibility: Public or Friends Only"    highlightWords={['Public', 'Friends', 'visibility']} />
    <CaptionOverlay startFrame={COMPOSE_START + 170} durationFrames={160} text="Attach photos & compose your neighbourhood post" highlightWords={['photos', 'post']} />
    <CaptionOverlay startFrame={SUCCESS_START + 10} durationFrames={170} text="Post is live! Keep your local community informed." highlightWords={['live', 'local', 'community']} />
  </>
);
