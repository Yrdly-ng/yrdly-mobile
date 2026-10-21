import { isPaidPrice, MINIMUM_PRICE_MESSAGE } from '../marketplace/price-policy';

export interface EventTicketDraft {
  name: string;
  price: string;
  isFree: boolean;
  capacity: string;
}

// Validate the same minute-resolution timestamps that are sent to the create API.
export function getEventSchedule(eventDate: Date, startTime: Date, endTime: Date) {
  const combine = (time: Date) =>
    new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      time.getHours(),
      time.getMinutes()
    );
  const start = combine(startTime);
  const end = combine(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { error: 'Choose a valid date, start time and end time.', startTime: '', endTime: '' };
  }
  if (end.getTime() <= start.getTime()) {
    return {
      error: 'The end time must be after the start time on the event date.',
      startTime: '',
      endTime: '',
    };
  }
  return { error: null, startTime: start.toISOString(), endTime: end.toISOString() };
}

export function getTicketValidationError(tiers: EventTicketDraft[]): string | null {
  if (tiers.length < 1 || tiers.length > 30) return 'Add between 1 and 30 ticket tiers.';
  for (const [index, tier] of tiers.entries()) {
    const prefix = `Ticket tier ${index + 1}: `;
    if (!tier.name.trim()) return `${prefix}enter a ticket name.`;
    if (!tier.isFree && !isPaidPrice(Number(tier.price))) {
      return prefix + MINIMUM_PRICE_MESSAGE;
    }
    const capacity = Number(tier.capacity);
    if (!tier.capacity.trim() || !Number.isSafeInteger(capacity) || capacity < 1) {
      return `${prefix}enter a whole number of tickets of at least 1.`;
    }
  }
  return null;
}
