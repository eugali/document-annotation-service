import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function createXlsxFixture(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['Name', 'Amount', 'Date']);
  sheet.addRow(['Acme Corp', 50000, '2024-01-15']);
  sheet.addRow(['Bob Smith', 12000, '2024-02-20']);
  await workbook.xlsx.writeFile(
    path.join(__dirname, 'fixtures/sample.xlsx'),
  );
}

createXlsxFixture()
  .then(() => {
    process.stdout.write('sample.xlsx fixture created\n');
  })
  .catch((err) => {
    process.stderr.write(`Failed to create fixture: ${err}\n`);
    process.exit(1);
  });
