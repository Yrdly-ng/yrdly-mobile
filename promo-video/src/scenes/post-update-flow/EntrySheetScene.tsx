import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../theme';

// ─── Real Phosphor SVG paths (phosphor-icons/core, regular weight) ─────────

const PencilSimplePath =
  'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z';

const StorefrontPath =
  'M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z';

const CalendarBlankPath =
  'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z';

const WarningCirclePath =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z';

const PhosphorIcon: React.FC<{ path: string; size?: number; color?: string }> = ({
  path,
  size = 24,
  color = COLORS.G,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    fill={color}
    width={size}
    height={size}
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d={path} />
  </svg>
);

const SHEET_OPTIONS = [
  { title: 'Create Post',    desc: 'Share thoughts or photos',   path: PencilSimplePath   },
  { title: 'Create Listing', desc: 'Sell or give away items',    path: StorefrontPath     },
  { title: 'Create Event',   desc: 'Host a gathering or party',  path: CalendarBlankPath  },
  { title: 'Publish Alert',  desc: 'Notify neighbors of danger', path: WarningCirclePath  },
];

const FeedPostCard: React.FC<{
  avatarColor: string;
  imageColor: string;
  name: string;
  text: string;
}> = ({ avatarColor, imageColor, name, text }) => (
  <div
    style={{
      background: COLORS.SURFACE,
      borderRadius: 16,
      marginBottom: 10,
      overflow: 'hidden',
      border: `1px solid ${COLORS.GLASS_BORDER}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: avatarColor, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 13, color: COLORS.TEXT_PRIMARY }}>{name}</div>
        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.LABEL }}>Lekki, Lagos</div>
      </div>
    </div>
    <div style={{ padding: '0 12px 8px', fontFamily: FONTS.body, fontSize: 12, color: COLORS.MUTED, lineHeight: 1.5 }}>
      {text}
    </div>
    <div style={{ width: '100%', height: 130, background: imageColor, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
    </div>
    <div style={{ display: 'flex', gap: 16, padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12, color: COLORS.LABEL }}>
      <span>♥ 24</span><span>💬 6</span><span style={{ marginLeft: 'auto' }}>↗ Share</span>
    </div>
  </div>
);

export const EntrySheetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // FAB press spring F30–55
  const fabPressIn  = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 300, mass: 0.6 } });
  const fabPressOut = spring({ frame: frame - 45, fps, config: { damping: 15, stiffness: 300, mass: 0.6 } });
  const fabScale =
    frame < 30 ? 1
    : frame < 55 ? interpolate(fabPressIn,  [0, 1], [1, 0.92])
    : interpolate(fabPressOut, [0, 1], [0.92, 1]);

  // Backdrop fade F60–66
  const backdropOpacity = interpolate(frame, [60, 66], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sheet slide-in spring F66–
  const sheetSpring = spring({ frame: frame - 66, fps, config: { damping: 14, stiffness: 140, mass: 0.7 } });
  const sheetTranslateY = interpolate(sheetSpring, [0, 1], [460, 0]);
  const sheetVisible = frame >= 60;

  // Highlight "Create Post" (index 0) F165–195
  const highlightProgress = interpolate(frame, [165, 190], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sheet exit F200–215
  const exitProgress = spring({ frame: frame - 200, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
  const sheetExitY = frame >= 200 ? interpolate(exitProgress, [0, 1], [0, 460]) : 0;
  const backdropCurrent = frame >= 200
    ? interpolate(exitProgress, [0, 1], [1, 0])
    : backdropOpacity;

  // Scene fade-out F215–230
  const sceneOpacity = interpolate(frame, [215, 230], [1, 0], {
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
        alignItems: 'center',
        justifyContent: 'center',
        opacity: sceneOpacity,
        position: 'relative',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 700, height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,219,126,0.18) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Phone shell */}
      <div
        style={{
          position: 'relative',
          width: 420, height: 860,
          borderRadius: 52,
          backgroundColor: '#121214',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.12), inset 0 0 0 2px rgba(0,0,0,0.8)',
          padding: 12, boxSizing: 'border-box',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position: 'absolute', inset: -20, borderRadius: 64,
            background: 'radial-gradient(circle, rgba(130,219,126,0.35) 0%, transparent 70%)',
            filter: 'blur(35px)', pointerEvents: 'none', zIndex: 0,
          }}
        />

        {/* Inner screen */}
        <div
          style={{
            position: 'relative', width: '100%', height: '100%',
            borderRadius: 40, backgroundColor: COLORS.DARK, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', zIndex: 1,
          }}
        >
          {/* Status bar */}
          <div
            style={{
              height: 44, padding: '0 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: 600,
              fontFamily: FONTS.body, backgroundColor: 'rgba(5,5,5,0.85)', flexShrink: 0,
            }}
          >
            <span>9:41</span>
            <div style={{ width: 110, height: 26, borderRadius: 16, backgroundColor: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width={16} height={12} viewBox="0 0 16 12" fill={COLORS.TEXT_PRIMARY}>
                <path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z" />
              </svg>
              <svg width={20} height={12} viewBox="0 0 20 12" fill={COLORS.TEXT_PRIMARY}>
                <rect x="1" y="1" width="15" height="10" rx="2" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="1.5" />
                <rect x="3" y="3" width="9" height="6" rx="1" />
                <path d="M17 4.5v3a1.5 1.5 0 0 0 0-3z" />
              </svg>
            </div>
          </div>

          {/* Screen content */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Feed header */}
            <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 22, color: COLORS.TEXT_PRIMARY }}>yrdly</div>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: COLORS.SURFACE, border: `1px solid ${COLORS.GLASS_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.LABEL} strokeWidth={1.8}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
            </div>

            {/* Feed cards */}
            <div style={{ flex: 1, overflowY: 'hidden', padding: '0 12px' }}>
              <FeedPostCard avatarColor="rgba(130,219,126,0.5)" imageColor="rgba(30,70,50,0.7)" name="Chidinma A." text="Community cleanup at Lekki Phase 1 park this Saturday — come join us! 🌿" />
              <FeedPostCard avatarColor="rgba(99,102,241,0.5)" imageColor="rgba(40,35,80,0.7)" name="Emeka R." text="Rooftop vibes this weekend? Block party in the estate, food and music all day 🎶" />
            </div>

            {/* Tab bar */}
            <div
              style={{
                height: 64, backgroundColor: COLORS.GLASS_BG,
                borderTop: `1px solid ${COLORS.GLASS_BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                paddingBottom: 4, flexShrink: 0, position: 'relative',
              }}
            >
              {[
                { label: 'Home',    active: true,  icon: (c: string) => <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={c} strokeWidth={1.8}><path d="M3 12L12 4l9 8" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" strokeLinecap="round"/></svg> },
                { label: 'Explore', active: false, icon: (c: string) => <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={c} strokeWidth={1.8}><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22" strokeLinecap="round"/></svg> },
              ].map((tab) => (
                <div key={tab.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 8 }}>
                  {tab.icon(tab.active ? COLORS.G : COLORS.LABEL)}
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, color: tab.active ? COLORS.G : COLORS.LABEL, fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
                </div>
              ))}

              {/* FAB */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 12 }}>
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: COLORS.G,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `scale(${fabScale})`,
                    boxShadow: '0 4px 12px rgba(130,219,126,0.5)',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <span style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.LABEL, marginTop: 2 }}>Create</span>
              </div>

              {[
                { label: 'Messages', icon: (c: string) => <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={c} strokeWidth={1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { label: 'Profile',  icon: (c: string) => <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={c} strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/></svg> },
              ].map((tab) => (
                <div key={tab.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 8 }}>
                  {tab.icon(COLORS.LABEL)}
                  <span style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.LABEL }}>{tab.label}</span>
                </div>
              ))}
            </div>

            {/* ── CreateMenuOverlay ── */}
            {sheetVisible && (
              <>
                {/* Backdrop */}
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: `rgba(0,0,0,${0.8 * backdropCurrent})`,
                    backdropFilter: 'blur(6px)',
                    zIndex: 20,
                  }}
                />

                {/* Sheet */}
                <div
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    zIndex: 30,
                    transform: `translateY(${sheetTranslateY + sheetExitY}px)`,
                    padding: '0 20px 50px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    opacity: backdropCurrent,
                  }}
                >
                  <div style={{ width: '100%', marginBottom: 16 }}>
                    {SHEET_OPTIONS.map((opt) => {
                      const isPost = opt.title === 'Create Post';
                      const hp = isPost && frame >= 165 ? highlightProgress : 0;
                      return (
                        <div
                          key={opt.title}
                          style={{
                            display: 'flex', flexDirection: 'row', alignItems: 'center',
                            backgroundColor: hp > 0 ? `rgba(130,219,126,${0.12 * hp})` : COLORS.SURFACE_ALT,
                            border: `1px solid ${hp > 0 ? `rgba(130,219,126,${0.35 * hp})` : COLORS.GLASS_BORDER}`,
                            borderRadius: 16, padding: 16, marginBottom: 8, gap: 16,
                            transform: `scale(${1 - 0.02 * hp})`,
                          }}
                        >
                          <div
                            style={{
                              width: 44, height: 44, borderRadius: 22,
                              backgroundColor: 'rgba(130,219,126,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <PhosphorIcon path={opt.path} size={24} color={COLORS.G} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 16, color: COLORS.TEXT_PRIMARY, marginBottom: 2 }}>{opt.title}</div>
                            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.MUTED }}>{opt.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Close button */}
                  <div
                    style={{
                      width: 52, height: 52, borderRadius: 26,
                      backgroundColor: COLORS.SURFACE_ALT,
                      border: `1px solid ${COLORS.GLASS_BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth={2.5} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                </div>
              </>
            )}
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
