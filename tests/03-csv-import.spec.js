const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * CSV Import Tests
 * Tests bulk importing transactions from CSV files
 */

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should import valid CSV file', async ({ page }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Grocery Store,45.50,expense,food,2024-01-15,weekly',
      'Salary Payment,3000.00,income,salary,2024-01-01,',
      'Gas Station,60.00,expense,transport,2024-01-10,car',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-valid.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await page.locator('#csv_file').setInputFiles(csvPath);
      await page.click('button:has-text("Import CSV")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#import-result')).toContainText('Successfully imported 3 transaction(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should handle CSV with validation errors', async ({ page }) => {
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
      await page.locator('#csv_file').setInputFiles(csvPath);
      await page.click('button:has-text("Import CSV")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#import-result')).toContainText('Successfully imported 1 transaction(s)');
      await expect(page.locator('#import-result')).toContainText('3 error(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should reject non-CSV files', async ({ page }) => {
    const txtPath = path.join(__dirname, 'temp-file.txt');
    fs.writeFileSync(txtPath, 'This is not a CSV file');

    try {
      await page.locator('#csv_file').setInputFiles(txtPath);
      await page.click('button:has-text("Import CSV")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#import-result')).toContainText('must be a CSV');
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  test('should handle empty CSV file', async ({ page }) => {
    const csvContent = 'description,amount,type,category,date,tags';
    const csvPath = path.join(__dirname, 'temp-empty.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await page.locator('#csv_file').setInputFiles(csvPath);
      await page.click('button:has-text("Import CSV")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#import-result')).toContainText('Successfully imported 0 transaction(s)');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });

  test('should refresh transaction list after import', async ({ page }) => {
    const csvContent = [
      'description,amount,type,category,date,tags',
      'Imported Item,99.99,expense,food,2024-02-01,imported',
    ].join('\n');

    const csvPath = path.join(__dirname, 'temp-refresh.csv');
    fs.writeFileSync(csvPath, csvContent);

    try {
      await page.locator('#csv_file').setInputFiles(csvPath);
      await page.click('button:has-text("Import CSV")');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#import-result')).toContainText('Successfully imported 1 transaction(s)');
      // The transactions list should update automatically
      await expect(page.locator('#transactions-list')).not.toContainText('Loading');
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  });
});
