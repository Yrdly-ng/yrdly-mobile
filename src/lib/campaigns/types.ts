export interface CampaignEntry {
  rank: number;
  businessId: string;
  name: string;
  logoUrl: string | null;
  profilePath: string;
  completedSales: number;
}
export interface CampaignData {
  campaign: {
    id: string;
    slug: string;
    title: string;
    status: 'upcoming' | 'active' | 'review' | 'finalized';
    startsAt: string;
    endsAt: string;
    timezone: string;
    reviewEndsAt: string;
    prizePoolNaira: number;
    rulesVersion: string;
    integrityReviewRequired: boolean;
  };
  snapshot: {
    id: string;
    updatedAt: string;
    provisional: boolean;
    entries: CampaignEntry[];
    participantCount: number;
    prizeAllocations: { businessId: string; amountKobo: number }[];
  };
}
export interface ParticipantData extends CampaignData {
  businesses: { id: string; name: string; logoUrl: string | null }[];
  ownEntries: CampaignEntry[];
  snapshotId: string;
  updatedAt: string;
}
