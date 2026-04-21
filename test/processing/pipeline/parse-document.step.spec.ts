import { parseDocument } from '../../../src/processing/pipeline/steps/parse-document.step';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

jest.mock('../../../src/processing/pipeline/steps/parse-word.step');
jest.mock('../../../src/processing/pipeline/steps/parse-csv.step');

import { parseWord } from '../../../src/processing/pipeline/steps/parse-word.step';
import { parseCsv } from '../../../src/processing/pipeline/steps/parse-csv.step';

const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

describe('parseDocument', () => {
  const fixturesDir = path.join(__dirname, '../../fixtures');

  beforeAll(async () => {
    // Generate sample.xlsx fixture programmatically
    const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
    if (!fs.existsSync(xlsxPath)) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.addRow(['Name', 'Amount', 'Date']);
      sheet.addRow(['Acme Corp', 50000, '2024-01-15']);
      sheet.addRow(['Bob Smith', 12000, '2024-02-20']);
      await workbook.xlsx.writeFile(xlsxPath);
    }
  });

  beforeEach(() => {
    mockGetText.mockReset();
    mockDestroy.mockReset();
    mockDestroy.mockResolvedValue(undefined);
  });

  describe('PDF parsing', () => {
    it('extracts text with page boundaries from a PDF', async () => {
      mockGetText.mockResolvedValue({
        total: 2,
        pages: [
          { num: 1, text: 'Page one content' },
          { num: 2, text: 'Page two content' },
        ],
        text: 'Page one content\n\n-- 1 of 2 --\n\nPage two content\n\n-- 2 of 2 --\n\n',
      });

      const filePath = path.join(fixturesDir, 'sample.pdf');
      const result = await parseDocument(filePath, 'application/pdf');

      expect(result.type).toBe('pdf');
      expect(result.pages).toHaveLength(2);
      expect(result.pages![0].pageNumber).toBe(1);
      expect(result.pages![0].text).toBe('Page one content');
      expect(result.fullText).toContain('Page one content');
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe('Word parsing', () => {
    it('routes .docx MIME type to parseWord', async () => {
      const mockResult = { type: 'word' as const, fullText: 'word content' };
      (parseWord as jest.Mock).mockResolvedValue(mockResult);

      const result = await parseDocument(
        '/tmp/test.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      expect(result.type).toBe('word');
      expect(parseWord).toHaveBeenCalledWith('/tmp/test.docx');
    });
  });

  describe('CSV parsing', () => {
    it('routes text/csv MIME type to parseCsv', async () => {
      const mockResult = { type: 'csv' as const, fullText: 'csv content' };
      (parseCsv as jest.Mock).mockResolvedValue(mockResult);

      const result = await parseDocument('/tmp/test.csv', 'text/csv');

      expect(result.type).toBe('csv');
      expect(parseCsv).toHaveBeenCalledWith('/tmp/test.csv');
    });
  });

  describe('Spreadsheet parsing', () => {
    it('extracts cells with sheet and cell references', async () => {
      const filePath = path.join(fixturesDir, 'sample.xlsx');
      const result = await parseDocument(
        filePath,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      expect(result.type).toBe('spreadsheet');
      expect(result.cells).toBeDefined();
      expect(result.cells!.length).toBeGreaterThan(0);
      expect(result.cells![0]).toHaveProperty('sheet');
      expect(result.cells![0]).toHaveProperty('cell');
      expect(result.cells![0]).toHaveProperty('value');
      expect(result.fullText).toContain('Sheet');
    });
  });
});
