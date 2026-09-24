import React from 'react';
import { COLORS, FONTS } from '../theme';

interface EventsUIProps {
  mode?: 'organizer' | 'attendee';
  organizerStep?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0: Basic Info, 1: Date & Time, 2: Location, 3: Tickets, 4: Photos, 5: Review, 6: Live
  attendeeStep?: 0 | 1 | 2 | 3;             // 0: Event View, 1: Ticket Modal, 2: Registering, 3: Confirmed
}

export const EventsUI: React.FC<EventsUIProps> = ({
  mode = 'organizer',
  organizerStep = 0,
  attendeeStep = 0,
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.DARK,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONTS.body,
        overflow: 'hidden',
      }}
    >
      {/* ── MODE A: ORGANIZER EVENT CREATION WIZARD (create-event.tsx) ── */}
      {mode === 'organizer' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
              backgroundColor: COLORS.DARK,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: COLORS.MUTED }}>←</span>
              <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: COLORS.TEXT_PRIMARY }}>
                Create Event
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.G }}>
              Step {Math.min(organizerStep + 1, 6)} of 6
            </span>
          </div>

          {/* 6-Step Progress Bar */}
          <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${((organizerStep + 1) / 6) * 100}%`,
                backgroundColor: COLORS.G,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>

          {/* 6-Step Labels Track */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid rgba(255,255,255,0.05)`, overflowX: 'hidden' }}>
            {['Info', 'Date', 'Venue', 'Tickets', 'Photos', 'Review'].map((label, idx) => (
              <span
                key={label}
                style={{
                  fontSize: '9px',
                  fontWeight: idx <= organizerStep ? 800 : 500,
                  color: idx <= organizerStep ? COLORS.G : COLORS.MUTED,
                  transition: 'color 0.2s ease',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Form Content Body */}
          <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'hidden' }}>
            {/* Step 1: Basic Info */}
            {organizerStep >= 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                  Event Name & Category
                </label>
                <div style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, fontSize: '13px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>
                  Lekki Saturday Farmers & Artisan Market
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {organizerStep >= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                  Date & Start Time
                </label>
                <div style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, fontSize: '12px', fontWeight: 700, color: COLORS.G }}>
                  Sat, 28 Oct 2026 • 9:00 AM
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {organizerStep >= 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                  Venue Location
                </label>
                <div style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: COLORS.GLASS_BG, border: `1px solid ${COLORS.GLASS_BORDER}`, fontSize: '12px', fontWeight: 600, color: COLORS.FILL_YELLOW }}>
                  Lekki Phase 1, Lagos
                </div>
              </div>
            )}

            {/* Step 4: Tickets */}
            {organizerStep >= 3 && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: 'rgba(130,219,126,0.1)', border: `1px solid ${COLORS.G}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>Standard Ticket</span>
                <span style={{ fontSize: '11px', fontWeight: 900, color: COLORS.G }}>FREE</span>
              </div>
            )}

            {/* Step 5 & 6: Photos & Review + Publish Button */}
            {organizerStep >= 5 && (
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px',
                    backgroundColor: organizerStep === 6 ? COLORS.G : COLORS.G,
                    color: COLORS.DARK,
                    fontSize: '14px',
                    fontWeight: 900,
                    fontFamily: FONTS.display,
                    textAlign: 'center',
                    boxShadow: `0 4px 20px rgba(130, 219, 126, 0.4)`,
                    cursor: 'pointer',
                  }}
                >
                  {organizerStep === 6 ? '✓ Event Live' : 'Publish Event'}
                </div>
              </div>
            )}
          </div>

          {/* Success Live Banner */}
          {organizerStep === 6 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(5,5,5,0.92)',
                backdropFilter: 'blur(16px)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.G,
                  color: COLORS.DARK,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 900,
                  boxShadow: `0 8px 30px rgba(130, 219, 126, 0.5)`,
                }}
              >
                🎉
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, fontFamily: FONTS.display, color: COLORS.TEXT_PRIMARY }}>
                Event Live!
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: COLORS.MUTED }}>
                Your Farmers Market event is published for neighbors in <span style={{ color: COLORS.G, fontWeight: 700 }}>Lekki Phase 1</span>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MODE B: ATTENDEE TICKETING & RSVP FLOW (events/[id]/index.tsx) ── */}
      {mode === 'attendee' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          {/* Events Navigation Bar */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${COLORS.GLASS_BORDER}`,
              backgroundColor: COLORS.DARK,
              zIndex: 20,
            }}
          >
            <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: '18px', color: COLORS.TEXT_PRIMARY }}>
              Events
            </span>
            <div style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(130, 219, 126, 0.15)', color: COLORS.G, fontSize: '11px', fontWeight: 700 }}>
              Nearby
            </div>
          </div>

          {/* Event Details Card (attendeeStep 0) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px', overflowY: 'hidden' }}>
            <div style={{ height: '150px', width: '100%', position: 'relative', borderRadius: '14px', overflow: 'hidden' }}>
              <img src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&auto=format&fit=crop&q=80" alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(139,92,246,0.25)', color: '#8B5CF6', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: '1px solid rgba(139,92,246,0.4)' }}>
                This Weekend
              </div>
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(12,14,15,0.9)', padding: '4px 8px', borderRadius: '8px', border: `1px solid ${COLORS.GLASS_BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 900, color: COLORS.G, lineHeight: 1 }}>28</span>
                <span style={{ fontSize: '8px', color: COLORS.MUTED, fontWeight: 700 }}>OCT</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, fontFamily: FONTS.display, color: COLORS.TEXT_PRIMARY }}>
                Lekki Saturday Farmers & Artisan Market
              </h3>
              <span style={{ fontSize: '11px', color: COLORS.MUTED }}>Sat, 28 Oct • 9:00 AM • Lekki Phase 1, Lagos</span>
            </div>

            {/* Attendee Avatars Cluster */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: `1px solid rgba(255,255,255,0.06)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {['photo-1534528741775-53994a69daeb', 'photo-1507003211169-0a1dd7228f2d', 'photo-1544005313-94ddf0286df2'].map((id, i) => (
                    <img key={i} src={`https://images.unsplash.com/${id}?w=150&auto=format&fit=crop&q=80`} alt="Avatar" style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${COLORS.DARK}`, marginLeft: i > 0 ? '-6px' : '0', objectFit: 'cover' }} />
                  ))}
                  {attendeeStep === 3 && (
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" alt="You" style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${COLORS.G}`, marginLeft: '-6px', objectFit: 'cover', transform: 'scale(1.1)', transition: 'all 0.2s ease-out' }} />
                  )}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.MUTED }}>
                  +{attendeeStep === 3 ? '29 going' : '28 going'}
                </span>
              </div>

              {/* Action Button: View Tickets / RSVP */}
              <div
                style={{
                  padding: '8px 18px',
                  borderRadius: '20px',
                  backgroundColor: attendeeStep === 3 ? COLORS.G : COLORS.G,
                  color: COLORS.DARK,
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: FONTS.display,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: attendeeStep === 3 ? `0 2px 12px rgba(130,219,126,0.5)` : 'none',
                }}
              >
                {attendeeStep === 3 ? '✓ Going' : 'View Tickets'}
              </div>
            </div>
          </div>

          {/* Ticket Selection / Registration Modal Overlay (attendeeStep 1 & 2) */}
          {(attendeeStep === 1 || attendeeStep === 2) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(5,5,5,0.92)',
                backdropFilter: 'blur(16px)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.GLASS_BORDER}`, paddingBottom: '10px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: COLORS.TEXT_PRIMARY }}>Get Tickets</span>
                <span style={{ fontSize: '11px', color: COLORS.MUTED }}>Lekki Farmers Market</span>
              </div>

              <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(130,219,126,0.1)', border: `1px solid ${COLORS.G}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: COLORS.TEXT_PRIMARY }}>Standard Ticket</div>
                  <div style={{ fontSize: '10px', color: COLORS.MUTED }}>1x General Admission</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: COLORS.G }}>FREE</div>
              </div>

              <div style={{ marginTop: 'auto', padding: '12px', borderRadius: '14px', backgroundColor: COLORS.G, color: COLORS.DARK, fontSize: '13px', fontWeight: 900, textAlign: 'center' }}>
                {attendeeStep === 2 ? 'Processing Registration...' : 'Register Now'}
              </div>
            </div>
          )}

          {/* Registration Confirmed View (attendeeStep 3) */}
          {attendeeStep === 3 && (
            <div
              style={{
                position: 'absolute',
                top: '52px',
                left: '12px',
                right: '12px',
                backgroundColor: 'rgba(12, 14, 15, 0.95)',
                backdropFilter: 'blur(16px)',
                border: `1.5px solid ${COLORS.G}`,
                borderRadius: '14px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: `0 8px 24px rgba(130, 219, 126, 0.3)`,
                zIndex: 30,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: COLORS.G, color: COLORS.DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '12px' }}>
                  ✓
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: COLORS.TEXT_PRIMARY }}>Registration Confirmed!</span>
                  <span style={{ fontSize: '10px', color: COLORS.MUTED }}>See you at Lekki Farmers Market</span>
                </div>
              </div>

              <div style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(130,219,126,0.15)', color: COLORS.G, fontSize: '10px', fontWeight: 700 }}>
                Pass Saved
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
