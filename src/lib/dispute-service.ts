import { disputeApiFetch } from './dispute-api';

export interface DisputeEvidence {
  photos?: string[];
  description?: string;
  chatScreenshots?: string[];
  additionalNotes?: string;
}

export interface DisputeData {
  id: string;
  transactionId: string;
  transaction_id?: string;
  openedBy?: string;
  opened_by?: string;
  disputeReason: string;
  dispute_reason?: string;
  reason?: string;
  buyerEvidence?: DisputeEvidence;
  buyer_evidence?: DisputeEvidence;
  sellerEvidence?: DisputeEvidence;
  seller_evidence?: DisputeEvidence;
  adminNotes?: string;
  admin_notes?: string;
  admin_note?: string;
  description?: string;
  evidence_urls?: string[];
  resolution?: string;
  resolutionOperation?: { status: string; isStale?: boolean; errorMessage?: string; resolution?: string; refundAmount?: number; sellerAmount?: number; createdAt?: string; updatedAt?: string } | null;
  providerSubmissionStatus?: 'not_required' | 'processing' | 'submitted' | 'needs_reconciliation';
  providerSubmissionError?: string | null;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  refundAmount?: number;
  refund_amount?: number;
  sellerAmount?: number;
  seller_amount?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolved_at?: string;
  transaction?: {
    id: string;
    amount: number;
    buyer_id: string;
    seller_id: string;
    item?: { id: string; title?: string; image_urls?: string[] };
    catalog_item?: { id: string; title?: string; name?: string; images?: string[] };
    buyer?: { id: string; name: string; avatar_url?: string; email?: string };
    seller?: { id: string; name: string; avatar_url?: string; email?: string };
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((result as any).error || 'Dispute request failed.');
  return result as T;
}

export class DisputeService {
  static async openDispute(
    transactionId: string,
    userId: string,
    reason: string,
    evidence: DisputeEvidence,
  ): Promise<{ id: string; providerSubmissionStatus?: string }> {
    void userId;
    const response = await disputeApiFetch('/api/disputes', {
      method: 'POST',
      body: JSON.stringify({ transactionId, reason, evidence }),
    });
    const result = await readResponse<{ id: string }>(response);
    return result;
  }

  static async submitEvidence(disputeId: string, userId: string, evidence: DisputeEvidence): Promise<void> {
    void userId;
    const response = await disputeApiFetch(`/api/disputes/${disputeId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
    await readResponse(response);
  }

  static async resolveDispute(
    disputeId: string,
    adminId: string,
    resolution: string,
    refundAmount: number,
    sellerAmount: number,
  ): Promise<{ success: boolean; resolutionStatus?: string; error?: string }> {
    void adminId;
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, refundAmount, sellerAmount }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 202) throw new Error(result.error || 'Could not resolve dispute.');
    return { success: Boolean(result.success), resolutionStatus: result.resolutionStatus, error: result.error };
  }

  static async getDisputesByUser(_userId: string): Promise<DisputeData[]> {
    const response = await disputeApiFetch('/api/disputes');
    const result = await readResponse<{ data: DisputeData[] }>(response);
    return result.data || [];
  }

  static async getDisputesByStatus(status: string, page = 1, limit = 20): Promise<{ data: DisputeData[]; count: number }> {
    const params = new URLSearchParams({ status: status || 'all', page: String(page), limit: String(limit) });
    const response = await disputeApiFetch(`/api/admin/disputes?${params.toString()}`);
    return readResponse(response);
  }

  static async getDisputeDetails(disputeId: string): Promise<DisputeData | null> {
    const response = await disputeApiFetch(`/api/disputes/${disputeId}`);
    if (response.status === 404) return null;
    return readResponse(response);
  }

  static async addAdminNotes(disputeId: string, notes: string): Promise<void> {
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
    await readResponse(response);
  }

  static async markUnderReview(disputeId: string, notes?: string): Promise<void> {
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'under_review', notes }),
    });
    await readResponse(response);
  }

  static async reconcileResolution(disputeId: string, outcome: 'applied' | 'not_applied', providerReference?: string): Promise<void> {
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ outcome, providerReference }),
    });
    await readResponse(response);
  }

  static async confirmPaylukSubmission(disputeId: string): Promise<void> {
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ providerSubmissionStatus: 'submitted' }),
    });
    await readResponse(response);
  }

  static async retryPaylukSubmission(disputeId: string): Promise<void> {
    const response = await disputeApiFetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ providerSubmissionStatus: 'retry' }),
    });
    await readResponse(response);
  }
}
