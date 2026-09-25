import React from 'react';
import { Sequence } from 'remotion';
import { Step1ItemDetailScene, STEP1_DURATION } from './Step1ItemDetailScene';
import { Step2CheckoutScene, STEP2_DURATION } from './Step2CheckoutScene';
import { Step3PaylukModalScene, STEP3_DURATION } from './Step3PaylukModalScene';
import { Step4SuccessScene, STEP4_DURATION } from './Step4SuccessScene';

// Total: 240 + 240 + 165 + 240 = 885 frames @ 30fps = 29.5s
const S1_START = 0;
const S2_START = S1_START + STEP1_DURATION;
const S3_START = S2_START + STEP2_DURATION;
const S4_START = S3_START + STEP3_DURATION;

export const BUYFLOW_TOTAL_DURATION = STEP1_DURATION + STEP2_DURATION + STEP3_DURATION + STEP4_DURATION;

export const BuyFlowComposition: React.FC = () => {
  return (
    <>
      <Sequence from={S1_START} durationInFrames={STEP1_DURATION}>
        <Step1ItemDetailScene />
      </Sequence>
      <Sequence from={S2_START} durationInFrames={STEP2_DURATION}>
        <Step2CheckoutScene />
      </Sequence>
      <Sequence from={S3_START} durationInFrames={STEP3_DURATION}>
        <Step3PaylukModalScene />
      </Sequence>
      <Sequence from={S4_START} durationInFrames={STEP4_DURATION}>
        <Step4SuccessScene />
      </Sequence>
    </>
  );
};
