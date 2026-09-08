export interface AlertLike {
  id?: string;
  type?: string;
  severity?: string;
  status?: string;
  is_resolved?: boolean;
  resolved_at?: string;
  subject_name?: string;
  subject_photo_url?: string;
  created_at?: string;
  [key: string]: any;
}

export type SeverityTier = 'urgent' | 'caution' | 'information';

/**
 * Determines the severity tier for an alert.
 * 1. Missing person / broadcast (subject_name or subject_photo_url present) -> 'urgent'
 * 2. alert.severity is 'urgent' or 'caution' -> that value
 * 3. Fallback -> 'information'
 */
export function getSeverityTier(alert: AlertLike): SeverityTier {
  if (alert.subject_name || alert.subject_photo_url) {
    return 'urgent';
  }
  if (alert.severity === 'urgent' || alert.severity === 'caution') {
    return alert.severity;
  }
  return 'information';
}

/**
 * Returns user-facing label for alert type/severity.
 * 1. Missing person -> 'Missing person'
 * 2. alert.type === 'amber' -> 'Amber alert'
 * 3. Tier-based -> 'Urgent alert' | 'Caution' | 'Community info'
 */
export function getAlertLabel(alert: AlertLike): string {
  if (alert.subject_name || alert.subject_photo_url) {
    return 'Missing person';
  }
  if (alert.type === 'amber') {
    return 'Amber alert';
  }

  const tier = getSeverityTier(alert);
  switch (tier) {
    case 'urgent':
      return 'Urgent alert';
    case 'caution':
      return 'Caution';
    case 'information':
    default:
      return 'Community info';
  }
}

/**
 * Checks if an alert is resolved across both safety_alerts and alerts schema models.
 */
export function isResolved(alert: AlertLike): boolean {
  return Boolean(alert.is_resolved || alert.resolved_at || alert.status === 'resolved');
}

/**
 * Formats a date string into "MMM D" (e.g., "Sep 2").
 */
export function formatAlertDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
