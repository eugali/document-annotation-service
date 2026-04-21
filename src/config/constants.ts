export const MAX_CONCURRENT_JOBS = parseInt(
  process.env.MAX_CONCURRENT_JOBS || '3',
  10,
);

export const QUEUE_NAME = 'document-processing';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
] as const;

export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.xlsx',
  '.xls',
  '.docx',
  '.csv',
] as const;

export const CHUNK_TARGET_TOKENS = 100_000;
