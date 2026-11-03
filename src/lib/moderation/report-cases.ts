import { api } from '../network/api';
export type ReportKind = 'general' | 'post' | 'comment';
export type ReportAction =
  'resolve' | 'dismiss' | 'reopen' | 'hide' | 'restore' | 'suspend' | 'ban' | 'unsuspend';
export type ReportCase = {
  id: string;
  kind: ReportKind;
  status: string;
  category: string;
  subject: string;
  description: string;
  createdAt: string;
  sensitive: boolean;
  media?: string[];
  reporter: { id: string; name: string } | null;
  reportedAccount: { id: string; name: string; isSuspended: boolean; isBanned: boolean } | null;
  content: {
    id: string;
    type: 'post' | 'comment';
    text: string;
    hidden: boolean;
    postId?: string;
  } | null;
  history: { id: string; action: string; reason: string; createdAt: string; actorName: string }[];
};
const base = '/api/admin/reports';
export function listReportCases(
  kind: ReportKind,
  status: string,
  page: number,
  childOnly: boolean,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ kind, status, page: String(page) });
  if (childOnly) params.set('category', 'Child safety');
  return api.get<{ data: ReportCase[]; count: number }>(`${base}?${params}`, signal);
}
export function getReportCase(kind: ReportKind, id: string, signal?: AbortSignal) {
  return api.get<ReportCase>(`${base}/${kind}/${encodeURIComponent(id)}`, signal);
}
export function actOnReport(report: ReportCase, action: ReportAction, reason: string) {
  return api.post(`${base}/${report.kind}/${report.id}`, {
    action,
    reason: reason.trim(),
    expectedStatus: report.status,
  });
}
export function reportTitle(report: ReportCase) {
  return report.kind === 'post' || report.content?.type === 'post'
    ? 'Reported post'
    : report.kind === 'comment' || report.content?.type === 'comment'
      ? 'Reported comment'
      : report.subject || 'Account or safety report';
}
