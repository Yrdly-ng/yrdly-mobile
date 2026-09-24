import React from 'react';
import { COLORS, FONTS } from '../theme';

export interface FeedPostData {
  id: string;
  authorName: string;
  authorAvatar: string;
  location: string;
  timeAgo: string;
  category: 'Recommendation' | 'Selling' | 'Event' | 'General';
  title?: string;
  price?: string;
  body: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  shares: number;
  isVerified?: boolean;
}

export const MOCK_FEED_POSTS: FeedPostData[] = [
  {
    id: 'post-1',
    authorName: 'Aisha Bello',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    location: 'Lekki Phase 1',
    timeAgo: '8m ago',
    category: 'Recommendation',
    title: 'Solar Streetlights Active on Admiralty',
    body: 'Heads up neighbors! The Admiralty Way streetlights have been fully restored. Great effort by our resident safety association!',
    imageUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80',
    likes: 24,
    comments: 9,
    shares: 4,
    isVerified: true,
  },
  {
    id: 'post-2',
    authorName: 'Emeka Okonkwo',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    location: 'Ikoyi',
    timeAgo: '25m ago',
    category: 'Selling',
    title: 'Ergonomic Mesh Office Chair',
    price: '₦85,000',
    body: 'Moving sale! Herman Miller style mesh chair in mint condition. Pickup at Parkview Estate.',
    imageUrl: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&auto=format&fit=crop&q=80',
    likes: 14,
    comments: 6,
    shares: 2,
    isVerified: true,
  },
  {
    id: 'post-3',
    authorName: 'Yrdly Events Team',
    authorAvatar: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80',
    location: 'Victoria Island',
    timeAgo: '1h ago',
    category: 'Event',
    title: 'Saturday Farmers & Artisans Market',
    body: '45+ local food, produce, and artisan craft vendors this Saturday at Muri Okunola Park! Live music starts at 10 AM.',
    likes: 52,
    comments: 18,
    shares: 11,
    isVerified: true,
  },
];

interface FeedUIProps {
  scrollY?: number;
  highlightedPostId?: string | null;
  postLikeBonus?: number;
  postOpacityProgress?: number;
}

export const FeedUI: React.FC<FeedUIProps> = ({
  scrollY = 0,
  highlightedPostId = null,
  postLikeBonus = 0,
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
      {/* Feed Header Bar */}
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
          flexShrink: 0,
        }}
      >
        {/* YRDLY Brand Logo Text */}
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: '20px',
            fontWeight: 800,
            color: COLORS.G,
            letterSpacing: '-0.5px',
          }}
        >
          YRDLY
        </span>

        {/* Location Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '16px',
            backgroundColor: COLORS.SURFACE,
            border: `1px solid ${COLORS.GLASS_BORDER}`,
            fontSize: '12px',
            fontWeight: 500,
            color: COLORS.TEXT_PRIMARY,
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: COLORS.G,
              boxShadow: `0 0 8px ${COLORS.G}`,
            }}
          />
          <span>Lekki Phase 1, Lagos</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>

        {/* Header Action Buttons (Map & Bell) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: COLORS.SURFACE,
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </div>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: COLORS.SURFACE,
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.TEXT_PRIMARY} strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: COLORS.RED,
                border: `1.5px solid ${COLORS.DARK}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Feed Scroll Container */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `translateY(${-scrollY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '12px 14px 40px 14px',
            boxSizing: 'border-box',
          }}
        >
          {/* Quick Post Box */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '20px',
              backgroundColor: COLORS.SURFACE,
              border: `1px solid ${COLORS.GLASS_BORDER}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '17px',
                border: `2px solid ${COLORS.G}`,
                overflow: 'hidden',
                backgroundColor: COLORS.SURFACE_ALT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: COLORS.G,
                flexShrink: 0,
              }}
            >
              U
            </div>
            <span style={{ flex: 1, color: COLORS.MUTED, fontSize: '13px' }}>
              What's happening in your neighbourhood?
            </span>
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '14px',
                backgroundColor: COLORS.G,
                color: '#000000',
                fontWeight: 700,
                fontSize: '12px',
                fontFamily: FONTS.display,
                flexShrink: 0,
              }}
            >
              Post
            </div>
          </div>

          {/* Post Cards List */}
          {MOCK_FEED_POSTS.map((post) => {
            const isHighlighted = post.id === highlightedPostId;
            const currentLikes = isHighlighted ? post.likes + postLikeBonus : post.likes;

            return (
              <div
                key={post.id}
                style={{
                  borderRadius: '20px',
                  backgroundColor: COLORS.SURFACE,
                  border: isHighlighted
                    ? `1.5px solid ${COLORS.G}`
                    : `1px solid ${COLORS.GLASS_BORDER}`,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: isHighlighted
                    ? `0 0 24px ${COLORS.GLOW_STRONG}, 0 8px 30px rgba(0,0,0,0.6)`
                    : '0 4px 20px rgba(0, 0, 0, 0.4)',
                  transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}
              >
                {/* Author Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={post.authorAvatar}
                    alt={post.authorName}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '20px',
                      objectFit: 'cover',
                      border: `1px solid ${COLORS.GLASS_BORDER}`,
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          fontFamily: FONTS.display,
                          fontWeight: 700,
                          fontSize: '14px',
                          color: COLORS.TEXT_PRIMARY,
                        }}
                      >
                        {post.authorName}
                      </span>
                      {post.isVerified && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.G}>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: COLORS.LABEL }}>
                      {post.location} · {post.timeAgo}
                    </span>
                  </div>
                  {/* Category Pill Tag */}
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      backgroundColor:
                        post.category === 'Selling'
                          ? 'rgba(255, 171, 0, 0.15)'
                          : post.category === 'Event'
                          ? 'rgba(130, 219, 126, 0.15)'
                          : 'rgba(179, 136, 255, 0.15)',
                      color:
                        post.category === 'Selling'
                          ? '#FFAB00'
                          : post.category === 'Event'
                          ? COLORS.G
                          : '#B388FF',
                    }}
                  >
                    {post.category}
                  </span>
                </div>

                {/* Title & Body */}
                {post.title && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontFamily: FONTS.display,
                        fontWeight: 700,
                        fontSize: '15px',
                        color: COLORS.TEXT_PRIMARY,
                      }}
                    >
                      {post.title}
                    </h4>
                    {post.price && (
                      <span
                        style={{
                          fontFamily: FONTS.display,
                          fontWeight: 800,
                          fontSize: '15px',
                          color: COLORS.GOLD,
                        }}
                      >
                        {post.price}
                      </span>
                    )}
                  </div>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: COLORS.MUTED,
                    lineHeight: 1.4,
                  }}
                >
                  {post.body}
                </p>

                {/* Post Image */}
                {post.imageUrl && (
                  <div
                    style={{
                      width: '100%',
                      height: '180px',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      marginTop: '4px',
                    }}
                  >
                    <img
                      src={post.imageUrl}
                      alt="Post attachment"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}

                {/* Engagement Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '6px',
                    borderTop: `1px solid rgba(255,255,255,0.05)`,
                    fontSize: '12px',
                    color: COLORS.LABEL,
                  }}
                >
                  {/* Likes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={isHighlighted && postLikeBonus > 0 ? COLORS.RED : 'none'}
                      stroke={isHighlighted && postLikeBonus > 0 ? COLORS.RED : 'currentColor'}
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span style={{ color: isHighlighted && postLikeBonus > 0 ? COLORS.TEXT_PRIMARY : undefined, fontWeight: isHighlighted ? 600 : 400 }}>
                      {currentLikes}
                    </span>
                  </div>

                  {/* Comments */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{post.comments}</span>
                  </div>

                  {/* Shares */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>{post.shares}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
