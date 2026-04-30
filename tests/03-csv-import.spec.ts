import { test, expect } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CSV Import Tests
<<<<<<< splitBill
 * Tests bulk importing and previewing transactions from CSV files
=======
 * Tests the preview-then-commit import flow.
>>>>>>> main
 */

test.describe('CSV Import', () => {
  test.beforeEach(async ({ transactionsPage }) => {
    await transactionsPage.goto();
  });

  test('should import valid CSV file', async ({ page, transactionsPage }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Grocery Store,45.50,expense,food,2024-01-15,weekly',
      'Salary Payment,3000.00,income,salary,2024-01-01,',
      'Gas Station,60.00,expense,transport,2024-01-10,car',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-valid.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      // Preview container should appear
      const previewContainer = page.locator('#csv-preview-container');
      await expect(previewContainer).toBeVisible({ timeout: 5_000 });

      // All 3 rows should be present and valid (no error rows)
      const rows = page.locator('#preview-tbody tr[data-idx]');
      await expect(rows).toHaveCount(3);
      await expect(page.locator('#preview-tbody .preview-row-error')).toHaveCount(0);

      // Badge should show 3 valid
      await expect(page.locator('#badge-valid')).toContainText('3 valid');

      // Commit
      await page.locator('#csv-preview-container .btn').first().click();
      await expect(page.locator('#commit-result')).toContainText('Successfully imported 3 transaction(s)', { timeout: 5_000 });
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should handle CSV with validation errors', async ({ page, transactionsPage }) => {
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
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      const previewContainer = page.locator('#csv-preview-container');
      await expect(previewContainer).toBeVisible({ timeout: 5_000 });

      // 1 valid, 3 error rows
      await expect(page.locator('#badge-valid')).toContainText('1 valid');
      await expect(page.locator('#badge-errors')).toContainText('3 with errors');

      const errorRows = page.locator('#preview-tbody .preview-row-error');
      await expect(errorRows).toHaveCount(3);
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should reject non-CSV files', async ({ page, transactionsPage }) => {
    const txtPath = path.join(__dirname, 'temp-file.txt');
    fs.writeFileSync(txtPath, 'This is not a CSV file');

    try {
      await transactionsPage.csvFile.setInputFiles(txtPath);
      await transactionsPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      // Preview container should NOT appear
      await expect(page.locator('#csv-preview-container')).not.toBeVisible();
      await expect(page.locator('#import-result')).toContainText('must be a CSV');
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  test('should handle empty CSV file', async ({ page, transactionsPage }) => {
    const csvContent = 'description,amount,type,category,date,tags';
    const csvPath = path.join(__dirname, 'temp-empty.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();
      await page.waitForLoadState('networkidle');

      // Preview container should NOT appear — no data rows
      await expect(page.locator('#csv-preview-container')).not.toBeVisible();
      await expect(page.locator('#import-result')).toContainText('no data rows');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should refresh transaction list after import', async ({ page, transactionsPage }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Imported Item,99.99,expense,food,2024-02-01,imported',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-refresh.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      const previewContainer = page.locator('#csv-preview-container');
      await expect(previewContainer).toBeVisible({ timeout: 5_000 });

      // Commit import
      await page.locator('#csv-preview-container .btn').first().click();
      await expect(page.locator('#commit-result')).toContainText('Successfully imported 1 transaction(s)', { timeout: 5_000 });

      // Transaction list should update automatically
      await expect(page.locator('#transactions-list')).toContainText('Imported Item', { timeout: 5_000 });
      await expect(page.locator('#transactions-list')).not.toContainText('Loading');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('can edit a row in the preview before committing', async ({ page, transactionsPage }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Original Description,10.00,expense,food,2024-03-01,',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-edit.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      await expect(page.locator('#csv-preview-container')).toBeVisible({ timeout: 5_000 });

      // Edit the description cell
      const descInput = page.locator('#preview-tbody [data-field="description"]').first();
      await descInput.fill('Edited Description');

      // Row should no longer be marked as error
      await expect(page.locator('#preview-tbody tr[data-idx="0"]')).not.toHaveClass(/preview-row-error/);

      // Commit and verify the edited description was saved
      await page.locator('#csv-preview-container .btn').first().click();
      await expect(page.locator('#commit-result')).toContainText('Successfully imported 1', { timeout: 5_000 });
      await expect(page.locator('#transactions-list')).toContainText('Edited Description', { timeout: 5_000 });
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('can remove a row in the preview before committing', async ({ page, transactionsPage }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Keep Me,20.00,expense,food,2024-03-01,',
      'Remove Me,30.00,expense,food,2024-03-02,',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-remove.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      await expect(page.locator('#csv-preview-container')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('#preview-tbody tr[data-idx]')).toHaveCount(2);

      // Remove second row
      await page.locator('#preview-tbody tr[data-idx="1"] button').click();
      await expect(page.locator('#badge-removed')).toContainText('1 removed');

      // Commit — only 1 row imported
      await page.locator('#csv-preview-container .btn').first().click();
      await expect(page.locator('#commit-result')).toContainText('Successfully imported 1', { timeout: 5_000 });
      await expect(page.locator('#transactions-list')).toContainText('Keep Me', { timeout: 5_000 });
      await expect(page.locator('#transactions-list')).not.toContainText('Remove Me');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('cancel button hides preview without importing', async ({ page, transactionsPage }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Cancelled Import,50.00,expense,food,2024-03-01,',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-cancel.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await transactionsPage.csvFile.setInputFiles(csvPath);
      await transactionsPage.importCSVBtn.click();

      await expect(page.locator('#csv-preview-container')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.locator('#csv-preview-container')).not.toBeVisible();
      await expect(page.locator('#transactions-list')).not.toContainText('Cancelled Import');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });
});
