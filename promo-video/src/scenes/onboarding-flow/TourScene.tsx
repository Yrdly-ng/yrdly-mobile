import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Exact slide content from src/app/(onboarding)/tour.tsx ──────────────────
const SLIDES = [
  {
    headline: 'Welcome to Your\nNeighbourhood',
    description:
      'Stay connected with the people, places, and conversations that make your neighbourhood feel like home.',
    cta: 'Continue',
    bgGradient: 'radial-gradient(ellipse at 50% 40%, rgba(130,219,126,0.18) 0%, transparent 65%)',
    imageFile: 'slide1.jpg',
  },
  {
    headline: 'Everything You Need,\nClose to Home',
    description:
      'Discover trusted neighbours, support local businesses, and find great deals just around the corner.',
    cta: 'Continue',
    bgGradient: 'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.18) 0%, transparent 65%)',
    imageFile: 'slide2.jpg',
  },
  {
    headline: "Something's Always\nHappening Nearby",
    description:
      "From community gatherings to weekend markets, there's always something worth showing up for.",
    cta: 'Continue',
    bgGradient: 'radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.14) 0%, transparent 65%)',
    imageFile: 'slide3.jpg',
  },
  {
    headline: 'Meet the People\nAround You',
    description:
      'Build meaningful relationships with the people who live, work and create around you.',
    cta: 'Welcome Home',
    bgGradient: 'radial-gradient(ellipse at 50% 40%, rgba(130,219,126,0.2) 0%, transparent 65%)',
    imageFile: 'slide4.jpg',
  },
];

// ─── Timings: ~2.5s per slide + 15f transition ─────────────────────────────
// Slide 0: F0–75    (2.5s)
// Trans 0→1: F75–90 (0.5s)
// Slide 1: F90–165  (2.5s)
// Trans 1→2: F165–180
// Slide 2: F180–255 (2.5s)
// Trans 2→3: F255–270
// Slide 3: F270–360 (3s hold, ends on "Welcome Home")
// Fade out: F355–370

const SLIDE_DUR = 75;   // frames per slide
const TRANS_DUR = 15;   // frames per transition

function getSlideFrame(slideIdx: number): number {
  return slideIdx * (SLIDE_DUR + TRANS_DUR);
}

export const TourScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine active slide and transition progress
  const totalCycleLen = SLIDE_DUR + TRANS_DUR;
  const rawSlide = Math.min(Math.floor(frame / totalCycleLen), SLIDES.length - 1);
  const frameInCycle = frame - rawSlide * totalCycleLen;

  // Is transitioning?
  const isTransitioning = frameInCycle >= SLIDE_DUR && rawSlide < SLIDES.length - 1;
  const activeSlide = isTransitioning ? rawSlide + 1 : rawSlide;
  const transProgress = isTransitioning
    ? interpolate(frameInCycle, [SLIDE_DUR, SLIDE_DUR + TRANS_DUR], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const slide = SLIDES[Math.min(activeSlide, SLIDES.length - 1)];

  // Content fade per slide — new slide fades in, old fades out
  const contentOpacity = isTransitioning
    ? interpolate(transProgress, [0, 1], [1, 0])
    : frameInCycle < 15 ? interpolate(frameInCycle, [0, 15], [0, 1]) : 1;

  // Scene fade-out
  const lastSlideStart = getSlideFrame(3);
  const sceneOpacity = frame < 10
    ? interpolate(frame, [0, 10], [0, 1])
    : interpolate(frame, [355, 370], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // "Skip" fade in
  const skipOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // CTA button scale on last slide
  const ctaActive = activeSlide === SLIDES.length - 1;
  const ctaBounce = spring({ frame: frame - lastSlideStart - 20, fps, config: { damping: 10, stiffness: 140, mass: 0.7 } });
  const ctaScale = ctaActive ? interpolate(ctaBounce, [0, 1], [0.9, 1]) : 1;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: sceneOpacity, position: 'relative',
      }}
    >
      {/* Phone shell */}
      <div
        style={{
          position: 'relative', width: 420, height: 860,
          borderRadius: 52, backgroundColor: '#121214',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12)',
          padding: 12, boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <div style={{ position: 'absolute', inset: -20, borderRadius: 64, background: 'radial-gradient(circle, rgba(130,219,126,0.28) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 1, backgroundColor: COLORS.DARK }}>

          {/* Status bar */}
          <div style={{ height: 44, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: 600, fontFamily: FONTS.body, backgroundColor: 'rgba(5,5,5,0.85)', flexShrink: 0 }}>
            <span>9:41</span>
            <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width={16} height={12} viewBox="0 0 16 12" fill={COLORS.TEXT_PRIMARY}><path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z"/></svg>
              <svg width={20} height={12} viewBox="0 0 20 12" fill={COLORS.TEXT_PRIMARY}><rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="1.5"/><rect x="3" y="3" width="9" height="6" rx="1"/><path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z"/></svg>
            </div>
          </div>

          {/* Full-screen content */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Real slide background image */}
            <Img src={staticFile(`onboarding/${slide.imageFile}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
            {/* Slide-specific bg glow */}
            <div style={{ position: 'absolute', inset: 0, background: slide.bgGradient, transition: 'none', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,5,5,0.3) 0%, rgba(5,5,5,0.85) 75%, rgba(5,5,5,0.98) 100%)', zIndex: 1 }} />

            {/* Top bar: progress pills + Skip */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
              {/* Progress pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {SLIDES.map((_, i) => {
                  const isActive = i === activeSlide;
                  const isDone   = i < activeSlide;
                  return (
                    <div
                      key={i}
                      style={{
                        height: 4, borderRadius: 2,
                        width: isActive ? 28 : 8,
                        backgroundColor: isDone || isActive ? COLORS.G : 'rgba(255,255,255,0.2)',
                      }}
                    />
                  );
                })}
              </div>
              {/* Skip — visible unless last slide */}
              {activeSlide < SLIDES.length - 1 && (
                <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', opacity: skipOpacity }}>
                  Skip
                </span>
              )}
            </div>

            {/* Spacer */}
            <div style={{ flex: 1, zIndex: 2 }} />

            {/* Content box */}
            <div style={{ position: 'relative', zIndex: 2, padding: '0 24px 28px', opacity: contentOpacity }}>
              {/* Headline */}
              <div
                style={{
                  fontFamily: FONTS.display, fontWeight: 800,
                  fontSize: 26, lineHeight: 1.2,
                  color: COLORS.TEXT_PRIMARY, marginBottom: 14,
                  whiteSpace: 'pre-line',
                }}
              >
                {slide.headline}
              </div>
              {/* Description */}
              <div
                style={{
                  fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.65,
                  color: 'rgba(255,255,255,0.55)', marginBottom: 24,
                }}
              >
                {slide.description}
              </div>
              {/* CTA button */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  backgroundColor: COLORS.G, borderRadius: 28, padding: '14px 0',
                  boxShadow: '0 6px 20px rgba(130,219,126,0.4)',
                  transform: `scale(${ctaScale})`,
                }}
              >
                <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: '#000' }}>
                  {slide.cta}
                </span>
                {slide.cta === 'Welcome Home' ? (
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="#000"><path d="M3 12L12 4l9 8M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                )}
              </div>
            </div>
          </div>

          {/* Bottom home indicator */}
          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.DARK, flexShrink: 0 }}>
            <div style={{ width: 130, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
