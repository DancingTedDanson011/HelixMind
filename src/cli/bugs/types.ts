export type BugStatus = 'open' | 'investigating' | 'fixed' | 'verified';

export interface BugEvidence {
  type: 'error_message' | 'stack_trace' | 'user_report' | 'screenshot' | 'test_result';
  content: string;
  timestamp: number;
}

export interface BugEntry {
  id: number;
  description: string;
  file?: string;
  line?: number;
  status: BugStatus;
  createdAt: number;
  updatedAt: number;
  fixedAt?: number;
  verifiedAt?: number;
  evidence: BugEvidence[];
  relatedFiles: string[];
  spiralNodeId?: string;
  fixDescription?: string;
}

export interface BugJournalData {
  version: 1;
  nextId: number;
  bugs: BugEntry[];
}
