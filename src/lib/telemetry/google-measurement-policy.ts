/** Google measurement accepts only fixed event names and authenticated server evidence. */
export const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const HASH = /^[a-f0-9]{64}$/;
export const conversions = new Set(['sign_up', 'business_created', 'listing_published'] as const);
export type Conversion = 'sign_up' | 'business_created' | 'listing_published';
export type PurchaseKind = 'post' | 'catalog_item' | 'ticket' | 'booking';
export function productionMeasurementAllowed(input: {enabled?: string; env?: string; platform: string; development: boolean; apiOrigin: string; database?: string; firebaseProject?: string}): boolean {
  return input.enabled === 'true' && input.env === 'production' && !input.development &&
    ['ios','android'].includes(input.platform) && input.apiOrigin === 'https://app.yrdly.ng' &&
    ['https://api.yrdly.ng','https://yoiyqxtpmxnrrbqqidcs.supabase.co'].includes(input.database || '') &&
    input.firebaseProject === 'yrdly-470221';
}
export function verifiedPurchase(path: string, result: unknown) {
  if (!result || typeof result !== 'object') return null;
  const row = result as Record<string, unknown>;
  if (row.success !== true || typeof row.transactionId !== 'string' || !UUID.test(row.transactionId)) return null;
  let kind: PurchaseKind;
  if (path === '/api/events/tickets/verify') kind = 'ticket';
  else if (path === '/api/bookings/verify') kind = 'booking';
  else if (path === '/api/payment/verify' && (row.measurementKind === 'post' || row.measurementKind === 'catalog_item')) kind = row.measurementKind;
  else return null;
  const raw = row.measurementAmount;
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(raw))) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) return null;
  return {id: row.transactionId.toLowerCase(), amount, kind};
}
export function approvedListing(row: unknown, owner: string): {id:string; pending:boolean} | null {
  if (!row || typeof row !== 'object' || !UUID.test(owner)) return null;
  const post = row as Record<string, unknown>;
  if (typeof post.id !== 'string' || !UUID.test(post.id) || post.user_id !== owner ||
      !['For Sale','Giveaway'].includes(String(post.category)) || post.visibility !== 'public' ||
      post.is_sold === true || !['approved','pending'].includes(String(post.moderation_status))) return null;
  return {id:post.id.toLowerCase(),pending:post.moderation_status === 'pending'};
}
export function purchaseParams(transactionId: string, amount: number, kind: PurchaseKind) {
  if (!HASH.test(transactionId)) throw new Error('Invalid measurement transaction hash');
  return {transaction_id:transactionId,currency:'NGN',value:amount,items:[{item_id:kind === 'post' ? 'marketplace_listing' : kind,price:amount,quantity:1}]};
}
