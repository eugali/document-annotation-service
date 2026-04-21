import { parseCsv } from '../../../src/processing/pipeline/steps/parse-csv.step';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('parseCsv', () => {
  const tmpDir = os.tmpdir();

  function writeTmpCsv(name: string, content: string): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  it('parses CSV with headers into col: val format', async () => {
    const filePath = writeTmpCsv(
      'test-headers.csv',
      'Name,Amount,Date\nJohn,500,2026-01-01\nJane,300,2026-02-15',
    );

    const result = await parseCsv(filePath);

    expect(result.type).toBe('csv');
    expect(result.fullText).toContain(
      'Name: John, Amount: 500, Date: 2026-01-01',
    );
    expect(result.fullText).toContain(
      'Name: Jane, Amount: 300, Date: 2026-02-15',
    );
  });

  it('handles CSV without headers using Column1, Column2, etc.', async () => {
    const filePath = writeTmpCsv(
      'test-no-headers.csv',
      'John,500\nJane,300',
    );

    const result = await parseCsv(filePath);

    expect(result.type).toBe('csv');
    expect(result.fullText).toContain('Column1: John, Column2: 500');
    expect(result.fullText).toContain('Column1: Jane, Column2: 300');
  });

  it('throws on missing file', async () => {
    await expect(parseCsv('/tmp/nonexistent.csv')).rejects.toThrow();
  });
});
