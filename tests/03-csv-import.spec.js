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
  });

  test('should import valid CSV file', async ({ page }) => {
    // Create a temporary CSV file
    const csvContent = `description,amount,type,category,date,tags
Grocery Store,45.50,expense,food,2024-01-15,weekly
Salary Payment,3000.00,income,salary,2024-01-01,
Gas Station,60.00,expense,transport,2024-01-10,car`;
    
    const csvPath = path.join(__dirname, 'temp-valid.csv');
    fs.writeFileSync(csvPath, csvContent);
    
    try {
      // Upload CSV file
      const fileInput = page.locator('#csv_file');
      await fileInput.setInputFiles(csvPath);
      
      // Click import button
      await page.click('button:has-text("Import CSV")');
      
      // Wait for import to complete
      await page.waitForTimeout(2000);
      
      // Check for success message
      await expect(page.locator('#import-result')).toContainText('Successfully imported 3 transaction(s)');
      
      // Verify transactions appear in list
      await expect(page.locator('text=Grocery Store')).toBeVisible();
      await expect(page.locator('text=Salary Payment')).toBeVisible();
      await expect(page.locator('text=Gas Station')).toBeVisible();
    } finally {
      // Cleanup
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    }
  });

  test('should handle CSV with validation errors', async ({ page }) => {
    // Create CSV with some invalid rows
    const csvContent = `description,amount,type,category,date,tags
Valid Transaction,25.00,expense,food,2024-01-15,
Invalid Amount,abc,expense,food,2024-01-15,
Missing Description,,50.00,expense,food,2024-01-15,
Invalid Date,30.00,expense,food,2024-13-45,`;
    
    const csvPath = path.join(__dirname, 'temp-invalid.csv');
    fs.writeFileSync(csvPath, csvContent);
    
    try {
      const fileInput = page.locator('#csv_file');
      await fileInput.setInputFiles(csvPath);
      
      await page.click('button:has-text("Import CSV")');
      await page.waitForTimeout(2000);
      
      // Should show partial success
      await expect(page.locator('#import-result')).toContainText('Successfully imported 1 transaction(s)');
      
      // Should show error count
      await expect(page.locator('#import-result')).toContainText('3 error(s)');
      
      // Valid transaction should be imported
      await expect(page.locator('text=Valid Transaction')).toBeVisible();
    } finally {
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    }
  });

  test('should reject non-CSV files', async ({ page }) => {
    // Create a text file
    const txtPath = path.join(__dirname, 'temp-file.txt');
    fs.writeFileSync(txtPath, 'This is not a CSV file');
    
    try {
      const fileInput = page.locator('#csv_file');
      await fileInput.setInputFiles(txtPath);
      
      await page.click('button:has-text("Import CSV")');
      await page.waitForTimeout(1000);
      
      // Should show error
      await expect(page.locator('#import-result')).toContainText('must be a CSV');
    } finally {
      if (fs.existsSync(txtPath)) {
        fs.unlinkSync(txtPath);
      }
    }
  });

  test('should handle empty CSV file', async ({ page }) => {
    const csvContent = `description,amount,type,category,date,tags`;
    
    const csvPath = path.join(__dirname, 'temp-empty.csv');
    fs.writeFileSync(csvPath, csvContent);
    
    try {
      const fileInput = page.locator('#csv_file');
      await fileInput.setInputFiles(csvPath);
      
      await page.click('button:has-text("Import CSV")');
      await page.waitForTimeout(1000);
      
      // Should succeed but import 0 transactions
      await expect(page.locator('#import-result')).toContainText('Successfully imported 0 transaction(s)');
    } finally {
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    }
  });
});
