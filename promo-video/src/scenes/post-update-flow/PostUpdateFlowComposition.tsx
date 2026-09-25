import React from 'react';
import { Sequence } from 'remotion';
import { EntrySheetScene }     from './EntrySheetScene';
import { ComposeScene }        from './ComposeScene';
import { SuccessAndFeedScene } from './SuccessAndFeedScene';

// ─── Frame budget @ 30fps ────────────────────────────────────────────────────
// EntrySheetScene      : 230f  (~7.7s)  FAB tap → sheet → "Create Post" → exit
// ComposeScene         : 385f  (~12.8s) Header, author, vis toggle (Public 3.3s + Friends 3.3s), type, photo, Post tap + progress
// SuccessAndFeedScene  : 250f  (~8.3s)  Success → "Back to Feed" tap → feed (4s hold)
// TOTAL                : 865f  (~28.8s)

const ENTRY_DUR   = 230;
const COMPOSE_DUR = 385;
const SUCCESS_DUR = 250;

const ENTRY_START   = 0;
const COMPOSE_START = ENTRY_START   + ENTRY_DUR;
const SUCCESS_START = COMPOSE_START + COMPOSE_DUR;

export const POSTUPDATEFLOW_TOTAL_DURATION =
  ENTRY_DUR + COMPOSE_DUR + SUCCESS_DUR;
// = 865

export const PostUpdateFlowComposition: React.FC = () => (
  <>
    <Sequence from={ENTRY_START}   durationInFrames={ENTRY_DUR}   name="EntrySheet">
      <EntrySheetScene />
    </Sequence>

    <Sequence from={COMPOSE_START} durationInFrames={COMPOSE_DUR} name="Compose">
      <ComposeScene />
    </Sequence>

    <Sequence from={SUCCESS_START} durationInFrames={SUCCESS_DUR} name="SuccessAndFeed">
      <SuccessAndFeedScene />
    </Sequence>
  </>
);
