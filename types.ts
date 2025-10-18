
export enum RequestStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  SUBMITTED = 'Submitted',
  FAILED = 'Failed',
}

export interface GeminiAnalysis {
  requestType: string;
  location: string;
  details: string;
  confidence: number;
}

export interface Message {
  id: string;
  from: string;
  timestamp: string;
  text: string;
  analysis: GeminiAnalysis;
  automationLog: string[];
}

export interface Request {
  id: string;
  messageId: string;
  requestType: string;
  status: RequestStatus;
  submittedAt: string;
  sf311CaseId?: string;
}
