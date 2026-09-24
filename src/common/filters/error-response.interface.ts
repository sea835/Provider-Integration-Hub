export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  timestamp: string;
  path: string;
  requestId?: string;
}
