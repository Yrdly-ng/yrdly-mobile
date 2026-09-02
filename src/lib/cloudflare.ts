/**
 * Cloudflare CDN Helper Utility for yrdly-mobile (yrdly.ng)
 */

const SUPABASE_STORAGE_HOST = 'yoiyqxtpmxnrrbqqidcs.supabase.co';
const CLOUDFLARE_CDN_BASE = process.env.EXPO_PUBLIC_CLOUDFLARE_CDN_URL || 'https://media.yrdly.ng';

/**
 * Transforms a Supabase Storage asset URL to pass through the Cloudflare CDN edge proxy (media.yrdly.ng).
 * Falls back to the original URL if CDN is not configured or URL is invalid.
 */
export function getCdnMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  if (url.includes(SUPABASE_STORAGE_HOST) && CLOUDFLARE_CDN_BASE) {
    try {
      // Basic URL replacement for React Native performance
      return url.replace(`https://${SUPABASE_STORAGE_HOST}`, CLOUDFLARE_CDN_BASE.replace(/\/$/, ''));
    } catch {
      return url;
    }
  }
  
  return url;
}
