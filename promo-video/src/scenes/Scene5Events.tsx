import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { PhoneFrame } from '../components/PhoneFrame';
import { EventsUI } from '../components/EventsUI';
import { KineticText } from '../components/KineticText';

interface Scene5EventsProps {
  layout?: 'vertical' | 'landscape';
}

export const Scene5Events: React.FC<Scene5EventsProps> = ({ layout = 'vertical' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = layout === 'vertical' || height > width;

  // 1. Phone Frame Entrance Transition (Frames 0-25)
  const entryProgress = spring({
    frame: frame - 2,
    fps,
    config: {
      damping: 18,
      stiffness: 90,
      mass: 0.8,
    },
  });

  const phoneScale = interpolate(entryProgress, [0, 1], [0.92, 1.0]);
  const phoneRotateY = interpolate(entryProgress, [0, 1], [-8, 0]);
  const phoneRotateX = interpolate(entryProgress, [0, 1], [4, 0]);
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mode Selection: Frames 0-85 = Organizer, Frames 85-180 = Attendee
  const mode: 'organizer' | 'attendee' = frame < 85 ? 'organizer' : 'attendee';

  // Organizer Step Progression (Frames 0-85)
  let organizerStep: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0;
  if (frame < 14) organizerStep = 0;
  else if (frame < 28) organizerStep = 1;
  else if (frame < 42) organizerStep = 2;
  else if (frame < 56) organizerStep = 3;
  else if (frame < 70) organizerStep = 5;
  else organizerStep = 6;

  // Attendee Step Progression (Frames 85-180)
  let attendeeStep: 0 | 1 | 2 | 3 = 0;
  if (frame < 115) attendeeStep = 0;
  else if (frame < 135) attendeeStep = 1;
  else if (frame < 155) attendeeStep = 2;
  else attendeeStep = 3;

  // Dynamic Headline Text based on Phase
  const isOrganizerPhase = frame < 85;

  // Outro Transition Shift (Frames 168-180)
  const exitShiftY = interpolate(frame, [168, 180], [0, -20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitRotateY = interpolate(frame, [168, 180], [0, -6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background Green/Yellow Glow Pulse
  const glowPulse = interpolate(frame, [0, 90, 180], [0.3, 0.65, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: isVertical ? '40px 20px' : '40px 80px',
      }}
    >
      {/* Background Ambient Community Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: isVertical ? '750px' : '950px',
          height: isVertical ? '750px' : '950px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(130,219,126,0.22) 0%, rgba(247,241,124,0.08) 45%, transparent 75%)`,
          transform: `translate(-50%, -50%) scale(${1 + glowPulse * 0.25})`,
          opacity: glowPulse,
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Kinetic Headline Callout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isVertical ? 'center' : 'flex-start',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 10,
          marginBottom: isVertical ? '30px' : '0',
          marginRight: isVertical ? '0' : '60px',
          textAlign: isVertical ? 'center' : 'left',
          maxWidth: isVertical ? '100%' : '520px',
        }}
      >
        <KineticText
          text={isOrganizerPhase ? "Host Events Nearby" : "RSVP & Get Tickets"}
          delay={5}
          fontSize={isVertical ? 46 : 54}
          fontFamily={FONTS.display}
          fontWeight={900}
          letterSpacing="-0.02em"
          gradient={true}
        />
        <KineticText
          text={
            isOrganizerPhase
              ? "Publish local meetups and track registrations."
              : "Discover community events happening around you."
          }
          delay={18}
          fontSize={isVertical ? 22 : 26}
          fontFamily={FONTS.body}
          fontWeight={500}
          color={COLORS.TEXT_SECONDARY}
        />
      </div>

      {/* Animated Phone Mockup */}
      <div
        style={{
          zIndex: 10,
          opacity: phoneOpacity,
          transform: `scale(${phoneScale}) rotateY(${phoneRotateY + exitRotateY}deg) rotateX(${phoneRotateX}deg) translateY(${exitShiftY}px)`,
          perspective: '1000px',
        }}
      >
        <PhoneFrame
          kenBurns={true}
          frame={frame}
          duration={180}
        >
          <EventsUI
            mode={mode}
            organizerStep={organizerStep}
            attendeeStep={attendeeStep}
          />
        </PhoneFrame>
      </div>
    </div>
  );
};
