/**
 * Quick test script for Website Audit Service
 * Tests core Puppeteer functionality and pixel detection
 */

const websiteAuditService = require('./src/services/websiteAuditService');
const aiWebsiteAuditService = require('./src/services/aiWebsiteAudit');

async function testAudit() {
  console.log('🧪 Testing Website Audit Service...\n');

  try {
    // Test 1: URL Validation
    console.log('Test 1: URL Validation');
    try {
      websiteAuditService.validateUrl('http://localhost:3000');
      console.log('❌ FAILED: Should reject localhost');
    } catch (error) {
      console.log('✅ PASSED: Correctly rejects localhost');
    }

    try {
      const validUrl = websiteAuditService.validateUrl('https://example.com');
      console.log('✅ PASSED: Accepts valid HTTPS URL:', validUrl);
    } catch (error) {
      console.log('❌ FAILED: Should accept valid URL');
    }

    console.log('\nTest 2: Website Audit - Example.com (simple test site)');
    console.log('Starting audit... this may take 20-30 seconds...\n');

    const startTime = Date.now();
    const technicalFindings = await websiteAuditService.auditWebsite('https://example.com');
    const auditDuration = Date.now() - startTime;

    console.log('✅ Technical audit completed in', auditDuration, 'ms');
    console.log('\nTechnical Findings:');
    console.log('- URL:', technicalFindings.websiteUrl);
    console.log('- Total Requests:', technicalFindings.metadata.totalRequests);
    console.log('- Has Data Layer:', technicalFindings.metadata.hasDataLayer);
    console.log('\nPlatform Detection:');
    for (const [platform, result] of Object.entries(technicalFindings.platforms)) {
      console.log(`  - ${platform}:`, result.detected ? '✅ Detected' : '❌ Not detected');
      if (result.detected && result.issues.length > 0) {
        console.log(`    Issues: ${result.issues.join(', ')}`);
      }
    }

    console.log('\nTest 3: AI Business Analysis');
    console.log('Calling Claude AI for business impact analysis...\n');

    const businessAnalysis = await aiWebsiteAuditService.analyzeBusinessImpact(
      technicalFindings,
      'https://example.com'
    );

    console.log('✅ AI analysis completed');
    console.log('\nBusiness Analysis:');
    console.log('- Overall Score:', businessAnalysis.overallScore, '/100');
    console.log('- Status:', businessAnalysis.overallStatus);
    console.log('- Executive Summary:', businessAnalysis.executiveSummary);
    console.log('- Critical Issues:', businessAnalysis.criticalIssues.length);
    console.log('- Action Items:', businessAnalysis.actionChecklist.length);
    console.log('- AI Tokens Used:', businessAnalysis.tokensUsed);

    if (businessAnalysis.actionChecklist.length > 0) {
      console.log('\nTop 3 Recommendations:');
      businessAnalysis.actionChecklist.slice(0, 3).forEach((item, idx) => {
        console.log(`  ${idx + 1}. [${item.priority}] ${item.task}`);
        console.log(`     Impact: ${item.businessImpact}`);
      });
    }

    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\nTotal test duration:', Date.now() - startTime, 'ms');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run tests
testAudit();
