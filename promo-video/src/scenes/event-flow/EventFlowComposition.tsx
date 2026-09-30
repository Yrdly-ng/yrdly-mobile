import React from 'react';
import { Sequence } from 'remotion';
import { CaptionOverlay }   from '../../components/CaptionOverlay';
import { EntrySheetScene }   from './EntrySheetScene';
import { Step0BasicInfoScene } from './Step0BasicInfoScene';
import { Step1DateTimeScene }  from './Step1DateTimeScene';
import { Step2LocationScene }  from './Step2LocationScene';
import { Step3TicketsScene }   from './Step3TicketsScene';
import { Step4MediaScene }     from './Step4MediaScene';
import { Step5ReviewScene }    from './Step5ReviewScene';
import { SuccessScene }        from './SuccessScene';

// ─── Frame budget @ 30fps ────────────────────────────────────────────────────
// EntrySheetScene      : 240f  (~8s)
// Step0BasicInfoScene  : 280f  (~9.3s)
// Step1DateTimeScene   : 220f  (~7.3s)
// Step2LocationScene   : 200f  (~6.7s)
// Step3TicketsScene    : 450f  (~15s)
// Step4MediaScene      : 210f  (~7s)
// Step5ReviewScene     : 270f  (~9s)
// SuccessScene         : 150f  (~5s)
// TOTAL                : 2020f (~67.3s)

const ENTRY_DUR  = 240;
const STEP0_DUR  = 280;
const STEP1_DUR  = 220;
const STEP2_DUR  = 200;
const STEP3_DUR  = 450;
const STEP4_DUR  = 210;
const STEP5_DUR  = 270;
const SUCCESS_DUR = 150;

const ENTRY_START  = 0;
const STEP0_START  = ENTRY_START  + ENTRY_DUR;
const STEP1_START  = STEP0_START  + STEP0_DUR;
const STEP2_START  = STEP1_START  + STEP1_DUR;
const STEP3_START  = STEP2_START  + STEP2_DUR;
const STEP4_START  = STEP3_START  + STEP3_DUR;
const STEP5_START  = STEP4_START  + STEP4_DUR;
const SUCCESS_START = STEP5_START  + STEP5_DUR;

export const EVENTFLOW_TOTAL_DURATION =
  ENTRY_DUR + STEP0_DUR + STEP1_DUR + STEP2_DUR + STEP3_DUR + STEP4_DUR + STEP5_DUR + SUCCESS_DUR;
// = 2020

export const EventFlowComposition: React.FC = () => (
  <>
    <Sequence from={ENTRY_START}  durationInFrames={ENTRY_DUR}  name="EntrySheet">
      <EntrySheetScene />
    </Sequence>

    <Sequence from={STEP0_START}  durationInFrames={STEP0_DUR}  name="Step0BasicInfo">
      <Step0BasicInfoScene />
    </Sequence>

    <Sequence from={STEP1_START}  durationInFrames={STEP1_DUR}  name="Step1DateTime">
      <Step1DateTimeScene />
    </Sequence>

    <Sequence from={STEP2_START}  durationInFrames={STEP2_DUR}  name="Step2Location">
      <Step2LocationScene />
    </Sequence>

    <Sequence from={STEP3_START}  durationInFrames={STEP3_DUR}  name="Step3Tickets">
      <Step3TicketsScene />
    </Sequence>

    <Sequence from={STEP4_START}  durationInFrames={STEP4_DUR}  name="Step4Media">
      <Step4MediaScene />
    </Sequence>

    <Sequence from={STEP5_START}  durationInFrames={STEP5_DUR}  name="Step5Review">
      <Step5ReviewScene />
    </Sequence>

    <Sequence from={SUCCESS_START} durationInFrames={SUCCESS_DUR} name="Success">
      <SuccessScene />
    </Sequence>

    {/* Kinetic Captions for Mute Social Viewing */}
    <CaptionOverlay startFrame={20} durationFrames={160} text="Host & discover local community events" highlightWords={["Host", "community", "events"]} />
    <CaptionOverlay startFrame={260} durationFrames={160} text="Set event title, description & category" highlightWords={["title", "description", "category"]} />
    <CaptionOverlay startFrame={540} durationFrames={140} text="Schedule event date, time & location" highlightWords={["date", "time", "location"]} />
    <CaptionOverlay startFrame={960} durationFrames={180} text="Configure Free or Paid ticket tiers" highlightWords={["Free", "Paid", "ticket", "tiers"]} />
    <CaptionOverlay startFrame={1400} durationFrames={140} text="Attach event posters & gallery photos" highlightWords={["posters", "gallery", "photos"]} />
    <CaptionOverlay startFrame={1620} durationFrames={180} text="Review event overview before publishing" highlightWords={["Review", "overview", "publishing"]} />
    <CaptionOverlay startFrame={1880} durationFrames={100} text="Event live! Neighbours can RSVP instantly." highlightWords={["live", "RSVP", "instantly"]} />
  </>
);
