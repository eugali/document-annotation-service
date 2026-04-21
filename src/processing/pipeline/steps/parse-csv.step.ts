import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { ParsedDocument } from '../pipeline.types';

function detectHeaders(firstRow: string[]): boolean {
  return firstRow.every((cell) => /^[a-zA-Z]/.test(cell.trim()));
}

export async function parseCsv(filePath: string): Promise<ParsedDocument> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records: string[][] = parse(content, {
    relax_column_count: true,
    skip_empty_lines: true,
  });

  if (records.length === 0) {
    return { type: 'csv', fullText: '' };
  }

  const hasHeaders = detectHeaders(records[0]);
  const headers = hasHeaders
    ? records[0]
    : records[0].map((_, i) => `Column${i + 1}`);
  const dataRows = hasHeaders ? records.slice(1) : records;

  const lines = dataRows.map((row) =>
    headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', '),
  );

  return {
    type: 'csv',
    fullText: lines.join('\n'),
  };
}
