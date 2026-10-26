import { supabase } from '../supabase/supabase';

export const TERMS_VERSION = '2026-10-26-child-safety';
export const LEGAL_LINKS = {
  terms: 'https://yrdly.ng/terms',
  privacy: 'https://yrdly.ng/privacy-policy',
  safety: 'https://yrdly.ng/trust-and-safety',
  childSafety: 'https://yrdly.ng/child-safety',
} as const;

// This records a user's acknowledgement, not an authorization claim. Never use
// editable user_metadata to grant database access or administrative privileges.
export function hasAcceptedTerms(user: { user_metadata?: Record<string, unknown> } | null) {
  const record = user?.user_metadata?.mobile_terms as Record<string, unknown> | undefined;
  return (
    record?.version === TERMS_VERSION &&
    typeof record.accepted_at === 'string' &&
    record.adult_confirmed === true
  );
}

export function isAccountHelpRoute(segments: readonly string[]) {
  return (
    (segments[0] === 'settings' &&
      ['delete-account', 'help', 'report', 'guidelines'].includes(segments[1])) ||
    ((segments[0] === '(auth)' || segments[0] === 'auth') && segments[1] === 'reset-password')
  );
}

export async function acceptTerms(userId: string, adultConfirmed: boolean) {
  if (adultConfirmed !== true) throw new Error('You must be 18 or older to hold a Yrdly account.');
  const { data: current, error: currentError } = await supabase.auth.getUser();
  if (currentError) throw currentError;
  if (current.user?.id !== userId) throw new Error('Your account changed. Please try again.');
  const { data, error } = await supabase.auth.updateUser({
    data: { mobile_terms: { version: TERMS_VERSION, accepted_at: new Date().toISOString(), adult_confirmed: true } },
  });
  if (error) throw error;
  if (data.user?.id !== userId || !hasAcceptedTerms(data.user)) {
    throw new Error('Your acceptance could not be saved. Please try again.');
  }
  return data.user;
}
