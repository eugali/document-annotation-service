import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = __dirname;

function generateContractPdf(): Promise<void> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(
      path.join(OUTPUT_DIR, 'test-contract.pdf'),
    );
    doc.pipe(stream);

    doc.fontSize(18).text('LOAN AGREEMENT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(
      `This Loan Agreement ("Agreement") is entered into on March 15, 2025 ` +
        `by and between Global Finance Ltd, a company incorporated in ` +
        `London, United Kingdom ("Lender"), and Marco Rossi, residing in ` +
        `Milan, Italy ("Borrower").`,
    );
    doc.moveDown();
    doc.fontSize(14).text('1. LOAN TERMS');
    doc.fontSize(11).text(
      `The Lender agrees to provide the Borrower with a loan in the principal ` +
        `amount of 250000 EUR (two hundred fifty thousand euros). The loan ` +
        `shall bear interest at a fixed rate of 4.5% per annum, calculated ` +
        `on the outstanding principal balance.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('2. REPAYMENT SCHEDULE');
    doc.fontSize(11).text(
      `The Borrower shall repay the loan in quarterly installments. ` +
        `Payment is due within 30 days of each quarter end. ` +
        `The loan matures on March 15, 2030.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('3. ADMINISTRATION FEE');
    doc.fontSize(11).text(
      `An administration fee of 5000 EUR shall be deducted from the initial ` +
        `disbursement and retained by Northern Trust Bank, the designated ` +
        `payment agent for this Agreement.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('4. EARLY TERMINATION');
    doc.fontSize(11).text(
      `Early termination of this Agreement requires 90 days written notice ` +
        `from the Borrower to the Lender. Elena Bianchi, acting as legal ` +
        `counsel for the Lender, shall be notified of any such request.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('SIGNATURES');
    doc.moveDown();
    doc.fontSize(11).text('Lender: Global Finance Ltd');
    doc.text('Borrower: Marco Rossi');
    doc.text('Witness: Elena Bianchi');

    doc.end();
    stream.on('finish', resolve);
  });
}

function generateReportPdf(): Promise<void> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(
      path.join(OUTPUT_DIR, 'test-report.pdf'),
    );
    doc.pipe(stream);

    doc.fontSize(18).text('ANNUAL FINANCIAL REPORT', { align: 'center' });
    doc.fontSize(12).text('TechVentures Inc — Fiscal Year 2025', {
      align: 'center',
    });
    doc.moveDown();
    doc.fontSize(14).text('EXECUTIVE SUMMARY');
    doc.fontSize(11).text(
      `This report covers the fiscal year from January 1, 2025 to ` +
        `December 31, 2025. TechVentures Inc, headquartered in ` +
        `San Francisco, California, achieved total revenue of 1200000 USD, ` +
        `representing an 18% year-over-year revenue growth compared to the ` +
        `prior fiscal year.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('FINANCIAL HIGHLIGHTS');
    doc.fontSize(11).text(
      `The company reported an operating margin of 12% for the fiscal year. ` +
        `Research and development expenditure totaled 350000 USD, focused ` +
        `primarily on the expansion of our Berlin, Germany engineering ` +
        `office led by David Müller, VP of Engineering.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('STRATEGIC PARTNERSHIPS');
    doc.fontSize(11).text(
      `In Q3 2025, TechVentures Inc secured a strategic investment from ` +
        `Apex Capital Partners. Sarah Chen, CEO of TechVentures Inc, ` +
        `noted that the partnership will accelerate international expansion ` +
        `efforts across European markets.`,
    );
    doc.moveDown();
    doc.fontSize(14).text('OUTLOOK');
    doc.fontSize(11).text(
      `Management expects continued growth in fiscal year 2026, with ` +
        `projected revenue increase of 22% driven by new product launches ` +
        `and expanded market presence.`,
    );

    doc.end();
    stream.on('finish', resolve);
  });
}

async function generateEmployeesXlsx(): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Employees');
  sheet.columns = [
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Title', key: 'title', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Organization', key: 'org', width: 25 },
    { header: 'Office Location', key: 'location', width: 25 },
    { header: 'Annual Salary', key: 'salary', width: 15 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'Annual Raise', key: 'raise', width: 15 },
  ];

  sheet.addRow({
    name: 'John Williams',
    title: 'Senior Engineer',
    department: 'Engineering',
    org: 'Acme Corporation',
    location: 'New York, USA',
    salary: 85000,
    currency: 'USD',
    startDate: '2023-06-01',
    raise: '3% annual raise',
  });
  sheet.addRow({
    name: 'Maria Garcia',
    title: 'Product Manager',
    department: 'Product',
    org: 'Acme Corporation',
    location: 'Madrid, Spain',
    salary: 92000,
    currency: 'USD',
    startDate: '2022-01-15',
    raise: '3% annual raise',
  });
  sheet.addRow({
    name: 'Kenji Tanaka',
    title: 'Data Analyst',
    department: 'Analytics',
    org: 'Pacific Dynamics',
    location: 'Tokyo, Japan',
    salary: 78000,
    currency: 'USD',
    startDate: '2024-03-10',
    raise: '3% annual raise',
  });

  await workbook.xlsx.writeFile(
    path.join(OUTPUT_DIR, 'test-employees.xlsx'),
  );
}

async function generateTransactionsXlsx(): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Transactions');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'From', key: 'from', width: 25 },
    { header: 'To', key: 'to', width: 25 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Location', key: 'location', width: 25 },
  ];

  sheet.addRow({
    date: '2025-02-28',
    from: 'Summit Logistics',
    to: 'Oceanic Trading Co',
    amount: 47500,
    currency: 'USD',
    description:
      'Freight shipment payment approved by Robert Taylor, ' +
      'includes 2.5% transaction fee',
    location: 'Singapore',
  });
  sheet.addRow({
    date: '2025-03-15',
    from: 'Oceanic Trading Co',
    to: 'First National Bank',
    amount: 120000,
    currency: 'EUR',
    description:
      'Quarterly trade settlement processed by Aisha Patel',
    location: 'Mumbai, India',
  });
  sheet.addRow({
    date: '2025-04-01',
    from: 'First National Bank',
    to: 'Summit Logistics',
    amount: 89000,
    currency: 'GBP',
    description: 'Insurance premium and operational funding transfer',
    location: 'Dubai, UAE',
  });

  await workbook.xlsx.writeFile(
    path.join(OUTPUT_DIR, 'test-transactions.xlsx'),
  );
}

async function main() {
  console.log('Generating test documents...');

  await Promise.all([
    generateContractPdf(),
    generateReportPdf(),
    generateEmployeesXlsx(),
    generateTransactionsXlsx(),
  ]);

  console.log('Generated:');
  console.log('  - test-contract.pdf');
  console.log('  - test-report.pdf');
  console.log('  - test-employees.xlsx');
  console.log('  - test-transactions.xlsx');
}

main().catch(console.error);
