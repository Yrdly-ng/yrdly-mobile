import React from 'react';
import { Sequence } from 'remotion';
import { CaptionOverlay }           from '../../components/CaptionOverlay';
import { OnboardingHookScene }      from './OnboardingHookScene';
import { WelcomeScene }             from './WelcomeScene';
import { TourScene }                from './TourScene';
import { SignupScene }              from './SignupScene';
import { PhoneVerificationScene }   from './PhoneVerificationScene';
import { ProfileSetupScene }        from './ProfileSetupScene';
import { OnboardingEndCardScene }   from './OnboardingEndCardScene';

// ─── Frame budget @ 30fps ────────────────────────────────────────────────────
// OnboardingHookScene   : 60f  (~2.0s)  v2 Hook Intro — 3D beams + headline
// WelcomeScene          : 170f (~5.7s)
// TourScene             : 370f (~12.3s)
// SignupScene           : 305f (~10.2s)
// PhoneVerificationScene: 270f (~9.0s)
// ProfileSetupScene     : 300f (~10.0s)
// OnboardingEndCardScene:  90f (~3.0s)  v2 End Card — Yrdly logo lockup
// TOTAL                 : 1565f (~52.2s)

const HOOK_DUR     = 60;
const WELCOME_DUR  = 170;
const TOUR_DUR     = 370;
const SIGNUP_DUR   = 305;
const PHONE_DUR    = 270;
const PROFILE_DUR  = 300;
const END_DUR      = 90;

const HOOK_START    = 0;
const WELCOME_START = HOOK_START    + HOOK_DUR;
const TOUR_START    = WELCOME_START + WELCOME_DUR;
const SIGNUP_START  = TOUR_START    + TOUR_DUR;
const PHONE_START   = SIGNUP_START  + SIGNUP_DUR;
const PROFILE_START = PHONE_START   + PHONE_DUR;
const END_START     = PROFILE_START + PROFILE_DUR;

export const ONBOARDINGFLOW_TOTAL_DURATION =
  HOOK_DUR + WELCOME_DUR + TOUR_DUR + SIGNUP_DUR + PHONE_DUR + PROFILE_DUR + END_DUR;
// = 1565

export const OnboardingFlowComposition: React.FC = () => (
  <>
    <Sequence from={HOOK_START}    durationInFrames={HOOK_DUR}    name="Hook">    <OnboardingHookScene /></Sequence>
    <Sequence from={WELCOME_START} durationInFrames={WELCOME_DUR} name="Welcome"> <WelcomeScene /></Sequence>
    <Sequence from={TOUR_START}    durationInFrames={TOUR_DUR}    name="Tour">    <TourScene /></Sequence>
    <Sequence from={SIGNUP_START}  durationInFrames={SIGNUP_DUR}  name="Signup">  <SignupScene /></Sequence>
    <Sequence from={PHONE_START}   durationInFrames={PHONE_DUR}   name="PhoneVerification"><PhoneVerificationScene /></Sequence>
    <Sequence from={PROFILE_START} durationInFrames={PROFILE_DUR} name="ProfileSetup"><ProfileSetupScene /></Sequence>
    <Sequence from={END_START}     durationInFrames={END_DUR}     name="EndCard"> <OnboardingEndCardScene /></Sequence>

    {/* Kinetic Captions for Mute Social Viewing */}
    <CaptionOverlay startFrame={HOOK_START + 5}     durationFrames={50}  text="Welcome to Yrdly — Your Neighbourhood, Connected."     highlightWords={['Yrdly', 'Connected']} />
    <CaptionOverlay startFrame={WELCOME_START + 20} durationFrames={130} text="Your neighbourhood, right in your pocket"              highlightWords={['neighbourhood', 'pocket']} />
    <CaptionOverlay startFrame={TOUR_START + 10}    durationFrames={160} text="Discover events, buy & sell, and meet verified neighbours" highlightWords={['events', 'buy & sell', 'verified']} />
    <CaptionOverlay startFrame={SIGNUP_START + 10}  durationFrames={160} text="Quick sign up with live password strength indicator"   highlightWords={['sign up', 'password', 'strength']} />
    <CaptionOverlay startFrame={PHONE_START + 10}   durationFrames={180} text="Verify phone number with instant SMS OTP verification" highlightWords={['phone', 'SMS', 'OTP']} />
    <CaptionOverlay startFrame={PROFILE_START + 10} durationFrames={220} text="Upload avatar photo & setup your resident profile"     highlightWords={['avatar', 'resident', 'profile']} />
  </>
);
