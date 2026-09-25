import React from 'react';
import { Sequence } from 'remotion';
import { WelcomeScene }           from './WelcomeScene';
import { TourScene }              from './TourScene';
import { SignupScene }            from './SignupScene';
import { PhoneVerificationScene } from './PhoneVerificationScene';
import { ProfileSetupScene }      from './ProfileSetupScene';

// ─── Frame budget @ 30fps ────────────────────────────────────────────────────
// WelcomeScene          : 170f  (~5.7s)
// TourScene             : 370f  (~12.3s)
// SignupScene           : 305f  (~10.2s)
// PhoneVerificationScene: 270f  (~9.0s)
// ProfileSetupScene     : 300f  (~10.0s)
// TOTAL (Phases 1–4)   : 1415f (~47.2s)

const WELCOME_DUR  = 170;
const TOUR_DUR     = 370;
const SIGNUP_DUR   = 305;
const PHONE_DUR    = 270;
const PROFILE_DUR  = 300;

const WELCOME_START = 0;
const TOUR_START    = WELCOME_START + WELCOME_DUR;
const SIGNUP_START  = TOUR_START    + TOUR_DUR;
const PHONE_START   = SIGNUP_START  + SIGNUP_DUR;
const PROFILE_START = PHONE_START   + PHONE_DUR;

export const ONBOARDINGFLOW_TOTAL_DURATION = WELCOME_DUR + TOUR_DUR + SIGNUP_DUR + PHONE_DUR + PROFILE_DUR;
// = 1415

export const OnboardingFlowComposition: React.FC = () => (
  <>
    <Sequence from={WELCOME_START}  durationInFrames={WELCOME_DUR}  name="Welcome"><WelcomeScene /></Sequence>
    <Sequence from={TOUR_START}     durationInFrames={TOUR_DUR}     name="Tour"><TourScene /></Sequence>
    <Sequence from={SIGNUP_START}   durationInFrames={SIGNUP_DUR}   name="Signup"><SignupScene /></Sequence>
    <Sequence from={PHONE_START}    durationInFrames={PHONE_DUR}    name="PhoneVerification"><PhoneVerificationScene /></Sequence>
    <Sequence from={PROFILE_START}  durationInFrames={PROFILE_DUR}  name="ProfileSetup"><ProfileSetupScene /></Sequence>
  </>
);
