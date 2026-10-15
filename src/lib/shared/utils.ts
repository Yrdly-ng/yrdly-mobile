import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;
  const msPerMonth = msPerDay * 30;
  const msPerYear = msPerDay * 365;

  const elapsed = now.getTime() - past.getTime();

  if (elapsed < msPerMinute) {
    return 'Just now';
  } else if (elapsed < msPerHour) {
    return Math.round(elapsed / msPerMinute) + 'm ago';
  } else if (elapsed < msPerDay) {
    return Math.round(elapsed / msPerHour) + 'h ago';
  } else if (elapsed < msPerMonth) {
    return Math.round(elapsed / msPerDay) + 'd ago';
  } else if (elapsed < msPerYear) {
    return Math.round(elapsed / msPerMonth) + 'mo ago';
  } else {
    return Math.round(elapsed / msPerYear) + 'y ago';
  }
}

export function formatPrice(amount: number): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (e) {
    const rounded = Math.round(amount);
    return `₦${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

export function parseSafePrice(priceVal: string | number | undefined | null): number {
  if (priceVal === undefined || priceVal === null || priceVal === '') return 0;
  if (typeof priceVal === 'number') return priceVal;
  // Remove all non-numeric characters except decimal points
  const cleaned = String(priceVal).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function getDistanceStr(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): string {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 'Nearby';

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;

  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}
