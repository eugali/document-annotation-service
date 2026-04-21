import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';
import * as ExcelJS from 'exceljs';
import { ParsedDocument, ParsedCell } from '../pipeline.types';
import { parseWord } from './parse-word.step';
import { parseCsv } from './parse-csv.step';

export async function parseDocument(
  filePath: string,
  mimeType: string,
): Promise<ParsedDocument> {
  if (mimeType === 'application/pdf') {
    return parsePdf(filePath);
  }
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return parseWord(filePath);
  }
  if (mimeType === 'text/csv') {
    return parseCsv(filePath);
  }
  return parseSpreadsheet(filePath);
}

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();

    const pages = result.pages.map((p) => ({
      pageNumber: p.num,
      text: p.text.trim(),
    }));

    return {
      type: 'pdf',
      pages,
      fullText: result.text,
    };
  } finally {
    await parser.destroy();
  }
}

async function parseSpreadsheet(filePath: string): Promise<ParsedDocument> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const cells: ParsedCell[] = [];
  const textParts: string[] = [];

  workbook.eachSheet((sheet) => {
    textParts.push(`[Sheet: ${sheet.name}]`);
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        const cellRef = `${String.fromCharCode(64 + colNumber)}${rowNumber}`;
        const value = cell.value;
        const stringValue =
          value !== null && value !== undefined ? String(value) : null;
        cells.push({
          sheet: sheet.name,
          cell: cellRef,
          value: typeof value === 'number' ? value : stringValue,
        });
        if (stringValue) {
          textParts.push(`${sheet.name}!${cellRef}: ${stringValue}`);
        }
      });
    });
  });

  return {
    type: 'spreadsheet',
    cells,
    fullText: textParts.join('\n'),
  };
}
