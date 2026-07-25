'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Custom Jest reporter that emits STRUCTURED, TIMESTAMPED evidence for the OQ.
 *
 * This is the heart of the Computer Software Assurance (CSA) approach: instead of
 * manually captured screenshots, the objective record of the Operational
 * Qualification is machine-generated data — each test case (mapped to an OQ id in
 * its title), its pass/fail status, duration, and the run's UTC timestamps. The
 * file is written to /evidence and retained as the OQ execution record.
 */
class JsonReporter {
  constructor(globalConfig, options) {
    this._outputDir = path.resolve(__dirname, '..', '..', 'evidence');
    if (options && options.outputDir) {
      this._outputDir = path.resolve(__dirname, options.outputDir.replace('<rootDir>', path.join(__dirname, '..')));
    }
  }

  onRunComplete(_contexts, results) {
    const runStartedUTC = new Date(results.startTime).toISOString();
    const runCompletedUTC = new Date().toISOString();

    const cases = [];
    for (const suite of results.testResults) {
      const suiteFile = path.basename(suite.testFilePath);
      for (const t of suite.testResults) {
        cases.push({
          suite: suiteFile,
          // The OQ case id is embedded at the start of each test title.
          testCaseId: (t.title.match(/^OQ-[A-Z]+-\d+/) || [null])[0],
          title: t.fullName,
          status: t.status, // passed | failed | skipped
          durationMs: t.duration || 0,
          failureMessages: t.failureMessages || [],
        });
      }
    }

    const evidence = {
      artefact: 'OQ Execution Record',
      approach: 'Computer Software Assurance (executable evidence, not screenshots)',
      runStartedUTC,
      runCompletedUTC,
      environment: {
        node: process.version,
        platform: process.platform,
      },
      summary: {
        totalSuites: results.numTotalTestSuites,
        totalCases: results.numTotalTests,
        passed: results.numPassedTests,
        failed: results.numFailedTests,
        pending: results.numPendingTests,
        success: results.success,
      },
      cases,
    };

    try {
      fs.mkdirSync(this._outputDir, { recursive: true });
      const stamp = runCompletedUTC.replace(/[:.]/g, '-');
      const file = path.join(this._outputDir, `oq-results-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(evidence, null, 2));
      // Also write a stable "latest" pointer for CI and the RTM.
      fs.writeFileSync(path.join(this._outputDir, 'oq-results-latest.json'), JSON.stringify(evidence, null, 2));
      // eslint-disable-next-line no-console
      console.log(`\n[OQ evidence] written to ${file}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[OQ evidence] failed to write evidence file:', e.message);
    }
  }
}

module.exports = JsonReporter;
