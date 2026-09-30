import React from 'react';
import { Sequence } from 'remotion';
import { CaptionOverlay }        from '../../components/CaptionOverlay';
import { EntrySheetScene }       from './EntrySheetScene';
import { Step1PhotosScene }      from './Step1PhotosScene';
import { Step2DetailsScene }     from './Step2DetailsScene';
import { Step3DescriptionScene } from './Step3DescriptionScene';
import { Step4ReviewScene }      from './Step4ReviewScene';
import { SuccessScene }          from './SuccessScene';

// ─── Frame budget per scene @ 30fps ───────────────────────────────────────────
// EntrySheetScene      : 240 frames (~8s)
// Step1PhotosScene     : 240 frames (~8s)
// Step2DetailsScene    : 390 frames (~13s)
// Step3DescriptionScene: 180 frames (~6s)
// Step4ReviewScene     : 240 frames (~8s)
// SuccessScene         : 150 frames (~5s)
// ─── TOTAL            : 1440 frames (~48s) ────────────────────────────────────

const ENTRY_START  = 0;    const ENTRY_DUR  = 240;
const STEP1_START  = 240;  const STEP1_DUR  = 240;
const STEP2_START  = 480;  const STEP2_DUR  = 390;
const STEP3_START  = 870;  const STEP3_DUR  = 180;
const STEP4_START  = 1050; const STEP4_DUR  = 240;
const SUCCESS_START = 1290; const SUCCESS_DUR = 150;

export const SellFlowComposition: React.FC = () => {
  return (
    <>
      <Sequence from={ENTRY_START} durationInFrames={ENTRY_DUR} name="EntrySheet">
        <EntrySheetScene />
      </Sequence>

      <Sequence from={STEP1_START} durationInFrames={STEP1_DUR} name="Step1Photos">
        <Step1PhotosScene />
      </Sequence>

      <Sequence from={STEP2_START} durationInFrames={STEP2_DUR} name="Step2Details">
        <Step2DetailsScene />
      </Sequence>

      <Sequence from={STEP3_START} durationInFrames={STEP3_DUR} name="Step3Description">
        <Step3DescriptionScene />
      </Sequence>

      <Sequence from={STEP4_START} durationInFrames={STEP4_DUR} name="Step4Review">
        <Step4ReviewScene />
      </Sequence>

      <Sequence from={SUCCESS_START} durationInFrames={SUCCESS_DUR} name="Success">
        <SuccessScene />
      </Sequence>

      {/* Kinetic Captions for Mute Social Viewing */}
      <CaptionOverlay startFrame={20} durationFrames={120} text="Sell to verified neighbours in 3 simple steps" highlightWords={["Sell", "3", "simple", "steps"]} />
      <CaptionOverlay startFrame={260} durationFrames={140} text="Upload multiple crisp listing photos" highlightWords={["crisp", "listing", "photos"]} />
      <CaptionOverlay startFrame={500} durationFrames={150} text="Set price and choose item category" highlightWords={["Set", "price", "category"]} />
      <CaptionOverlay startFrame={890} durationFrames={120} text="Add detailed description & pickup location" highlightWords={["description", "pickup", "location"]} />
      <CaptionOverlay startFrame={1070} durationFrames={140} text="Protected by Payluk Escrow Payment System" highlightWords={["Payluk", "Escrow", "Protection"]} />
      <CaptionOverlay startFrame={1310} durationFrames={110} text="Item listed live in your neighbourhood marketplace!" highlightWords={["live", "neighbourhood", "marketplace"]} />
    </>
  );
};
