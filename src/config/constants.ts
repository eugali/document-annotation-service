export const MAX_CONCURRENT_JOBS = parseInt(
  process.env.MAX_CONCURRENT_JOBS || '3',
  10,
);

export const QUEUE_NAME = 'document-processing';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

export const SUPPORTED_EXTENSIONS = ['.pdf', '.xlsx', '.xls'] as const;

export const WEBHOOK_TIMEOUT_MS = 5000;
export const WEBHOOK_MAX_RETRIES = 1;
