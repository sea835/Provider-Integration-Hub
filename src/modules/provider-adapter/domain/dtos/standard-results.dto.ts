export interface StandardCheckResult {
  isEligible: boolean;
  reason?: string;
  rawResponse?: any;
}

export interface StandardOrderResult {
  supplierTransId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  suggestedPollDelaySec?: number;
  message?: string;
  rawResponse?: any;
}

export interface StandardStatusResult {
  supplierTransId: string;
  requestId?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  completedAt?: string;
  costAmount?: number;
  msisdn?: string;
  serial?: string;
  lpaString?: string;
  qrUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}
