import { supabase } from '../supabase/supabase';
import { api } from '../network/api';

export const CHILD_SAFETY_REPORT_CATEGORY = 'Child safety';
export const CHILD_SAFETY_PAGE_SIZE = 20;

export type ChildSafetyReport = {
  id: string;
  user_id: string | null;
  reported_user_id: string | null;
  reported_post_id: string | null;
  subject: string | null;
  description: string | null;
  created_at: string;
};

export async function fetchChildSafetyReports(page: number) {
  const first = Math.max(0, Math.floor(page)) * CHILD_SAFETY_PAGE_SIZE;
  // Access is enforced by reports RLS. Never use a service-role key in the app.
  // Attachments are deliberately excluded from this initial triage view.
  const { data, count, error } = await supabase
    .from('reports')
    .select('id,user_id,reported_user_id,reported_post_id,subject,description,created_at', { count: 'exact' })
    .eq('category', CHILD_SAFETY_REPORT_CATEGORY)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(first, first + CHILD_SAFETY_PAGE_SIZE - 1);
  if (error) throw error;
  return { reports: (data ?? []) as ChildSafetyReport[], count: count ?? 0 };
}

export async function enforceChildSafetyAccountAction(
  targetUserId: string,
  reportId: string,
  action: 'suspend' | 'ban'
) {
  return api.post('/api/admin/users/suspend', {
    targetUserId,
    action,
    reportId,
    reason: `Child safety report ${reportId}`,
  });
}

export async function hideChildSafetyReportedPost(reportId: string) {
  return api.post('/api/admin/reports/hide-post', { reportId });
}
