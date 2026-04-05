import { test, expect } from './fixtures';
//import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
//import { TransactionsPage } from './pages/TransactionsPage';

/**
 * CSV Import Tests
 * Tests bulk importing transactions from CSV files
 */

test.describe('CSV Import', () => {
  //let txPage: TransactionsPage;

  test.beforeEach(async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    //txPage = new TransactionsPage(page);
    await txPage.goto();
  });

  test('should import valid CSV file', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Grocery Store,45.50,expense,food,2024-01-15,weekly',
      'Salary Payment,3000.00,income,salary,2024-01-01,',
      'Gas Station,60.00,expense,transport,2024-01-10,car',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-valid.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await txPage.csvFile.setInputFiles(csvPath);
      //await page.getByLabel('CSV File').setInputFiles(csvPath);
      //await page.getByRole('button', { name: 'Import CSV' }).click();
      await txPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      //await expect(page.locator('#import-result')).toContainText('Successfully imported 3 transaction(s)');
      await expect(txPage.importResult).toContainText('Successfully imported 3 transaction(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should handle CSV with validation errors', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Valid Transaction,25.00,expense,food,2024-01-15,',
      'Invalid Amount,abc,expense,food,2024-01-15,',
      ',50.00,expense,food,2024-01-15,',
      'Invalid Date,30.00,expense,food,2024-13-45,',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-invalid.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await txPage.csvFile.setInputFiles(csvPath);
      //await page.getByLabel('CSV File').setInputFiles(csvPath);
      //await page.getByRole('button', { name: 'Import CSV' }).click();
      await txPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      //await expect(page.locator('#import-result')).toContainText('Successfully imported 1 transaction(s)');
      //await expect(page.locator('#import-result')).toContainText('3 error(s)');
      await expect(txPage.importResult).toContainText('Successfully imported 1 transaction(s)');
      await expect(txPage.importResult).toContainText('3 error(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should reject non-CSV files', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    const txtPath = path.join(__dirname, 'temp-file.txt');
    fs.writeFileSync(txtPath, 'This is not a CSV file');

    try {
      await txPage.csvFile.setInputFiles(txtPath);
      //await page.getByLabel('CSV File').setInputFiles(csvPath);
      //await page.getByRole('button', { name: 'Import CSV' }).click();
      await txPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      //await expect(page.locator('#import-result')).toContainText('must be a CSV');
      await expect(txPage.importResult).toContainText('must be a CSV');
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  test('should handle empty CSV file', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    const csvContent = 'description,amount,type,category,date,tags';
    const csvPath = path.join(__dirname, 'temp-empty.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await txPage.csvFile.setInputFiles(csvPath);
      //await page.getByLabel('CSV File').setInputFiles(csvPath);
      //await page.getByRole('button', { name: 'Import CSV' }).click();
      await txPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      //await expect(page.locator('#import-result')).toContainText('Successfully imported 0 transaction(s)');
      await expect(txPage.importResult).toContainText('Successfully imported 0 transaction(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should refresh transaction list after import', async ({ page, transactionsPage }) => {
    let txPage = transactionsPage;
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Imported Item,99.99,expense,food,2024-02-01,imported',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-refresh.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await txPage.csvFile.setInputFiles(csvPath);
      //await page.getByLabel('CSV File').setInputFiles(csvPath);
      //await page.getByRole('button', { name: 'Import CSV' }).click();
      await txPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      await expect(txPage.importResult).toContainText('Successfully imported 1 transaction(s)');
      //await expect(page.locator('#import-result')).toContainText('Successfully imported 1 transaction(s)');
      // The transactions list should update automatically
      await expect(page.locator('#transactions-list')).not.toContainText('Loading');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });
});
