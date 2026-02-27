import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Prometheus metrics generation...');

const jsonReportPath = path.resolve('playwright-report/results.json');
const outputPath = path.resolve('metrics/playwright-metrics.prom');

// Ensure metrics directory exists
const metricsDir = path.dirname(outputPath);
if (!fs.existsSync(metricsDir)) {
    console.log(`📁 Creating metrics directory: ${metricsDir}`);
    fs.mkdirSync(metricsDir, { recursive: true });
}

// Clean up existing file
if (fs.existsSync(outputPath)) {
    console.log('🗑️ Removing existing file:', outputPath);
    fs.unlinkSync(outputPath);
}

if (!fs.existsSync(jsonReportPath)) {
    console.error(`❌ JSON report not found: ${jsonReportPath}`);
    console.log('💡 Please run tests first: npx playwright test --reporter=json');
    process.exit(1);
}

try {
    console.log(`📄 Reading JSON report from: ${jsonReportPath}`);
    const reportData = fs.readFileSync(jsonReportPath, 'utf8');
    const report = JSON.parse(reportData);
    
    const metrics: string[] = [];
    const timestamp = Math.floor(Date.now() / 1000);

    let totalTests = 0;
    let passedTests = 0;

    console.log(`📁 Processing test suites...`);
    
    // Navigate through the nested structure: suites -> suites -> specs -> tests
    if (report.suites && Array.isArray(report.suites)) {
        report.suites.forEach((topLevelSuite: any) => {
            if (topLevelSuite.suites && Array.isArray(topLevelSuite.suites)) {
                topLevelSuite.suites.forEach((suite: any) => {
                    if (suite.specs && Array.isArray(suite.specs)) {
                        suite.specs.forEach((spec: any) => {
                            if (spec.tests && Array.isArray(spec.tests)) {
                                spec.tests.forEach((test: any) => {
                                    const { testStatus, isPassed } = processTest(test, spec, suite, metrics, timestamp);
                                    totalTests++;
                                    if (isPassed) passedTests++;
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // Summary metrics
    metrics.push(`playwright_tests_total{} ${totalTests}`);
    metrics.push(`playwright_tests_passed{} ${passedTests}`);
    metrics.push(`playwright_tests_failed{} ${totalTests - passedTests}`);
    metrics.push(`playwright_test_run_timestamp{} ${timestamp} ${timestamp}`);

    // Save to file
    const content = metrics.join('\n') + '\n';
    fs.writeFileSync(outputPath, content);
    
    console.log(`✅ Metrics generation completed!`);
    console.log(`📊 Generated ${metrics.length} metric lines`);
    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`📈 Test summary: ${passedTests}/${totalTests} passed`);

} catch (error: any) {
    console.error('❌ Error generating metrics:', error.message);
    process.exit(1);
}

function processTest(test: any, spec: any, suite: any, metrics: string[], timestamp: number): { testStatus: string; isPassed: boolean } {
    // Use the spec title for test name (since test.title might not exist)
    const testName = sanitizeLabel(spec.title || 'unknown_test');
    const suiteName = sanitizeLabel(suite.title || 'unknown_suite');
    const fileName = sanitizeLabel(path.basename(spec.file || 'unknown_file'));

    // Get the actual test result from the first result object
    let testStatus = 'unknown';
    let testDuration = 0;
    let isPassed = false;

    if (test.results && test.results.length > 0) {
        const result = test.results[0];
        testStatus = result.status || 'unknown';
        testDuration = result.duration || 0;
        isPassed = testStatus === 'passed';
    } else {
        // Fallback to test-level status
        testStatus = test.status || 'unknown';
        testDuration = test.duration || 0;
        isPassed = testStatus === 'passed';
    }

    console.log(`🔍 Processing test: "${testName}", status: ${testStatus}, passed: ${isPassed}`);

    // Test duration metric
    if (testDuration > 0) {
        metrics.push(
            `playwright_test_duration_seconds{test="${testName}",suite="${suiteName}",file="${fileName}",status="${testStatus}"} ${testDuration / 1000}`
        );
    }

    // Test result metric (1=pass, 0=fail)
    const resultValue = isPassed ? 1 : 0;
    metrics.push(
        `playwright_test_result{test="${testName}",suite="${suiteName}",file="${fileName}",status="${testStatus}"} ${resultValue}`
    );

    // Error metrics
    if (test.results && test.results.length > 0) {
        const result = test.results[0];
        if (result.errors && result.errors.length > 0) {
            const errorMessage = result.errors[0]?.message || 'unknown_error';
            const errorType = sanitizeLabel(errorMessage.split('\n')[0]);
            metrics.push(
                `playwright_test_error{test="${testName}",error_type="${errorType}"} 1 ${timestamp}`
            );
        }
    }

    return { testStatus, isPassed };
}

function sanitizeLabel(label: string): string {
    return label.replace(/[^\w]/g, '_').substring(0, 100); // Increased limit for longer test names
}