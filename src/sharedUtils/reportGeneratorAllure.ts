// src/utils/reportGeneratorAllure.ts

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyHistoryToResults() {
  const from = path.join(process.cwd(), 'allure-report', 'history');
  const to = path.join(process.cwd(), 'allure-results', 'history');

  if (fs.existsSync(from) && fs.readdirSync(from).length > 0) {
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    console.log('Copied previous report history to allure-results for trend calculation.');
    // console.log('Contents of allure-report/history:', fs.readdirSync(from));
    // console.log('Contents of allure-results/history after copy:', fs.readdirSync(to));
  } else {
    console.log('No previous report history found to copy. Trend will start from this run.');
  }
}

function generateReport() {
  try {
    execSync('npx allure generate allure-results --clean -o allure-report', { stdio: 'inherit' });
    console.log('Allure report generated.');
  } catch (error: any) {
    console.error('Error generating Allure report:', error.message);
    process.exit(1);
  }
}

function openReport() {
  try {
    execSync('npx allure open allure-report', { stdio: 'inherit' });
  } catch (error: any) {
    console.error('Error opening Allure report:', error.message);
    process.exit(1);
  }
}

// Copy history before generating the new report for accurate trend calculation
copyHistoryToResults();
generateReport();
openReport();
