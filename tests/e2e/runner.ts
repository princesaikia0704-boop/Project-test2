/**
 * Standalone E2E Test Runner Engine
 * Pure TypeScript/Node execution with zero external test runner dependencies.
 */

import { Assertions, SuiteSummary, TestCase, TestContext, TestResult, TestSuite } from './types';
import { TestClient } from './test-client';
import { getAllSuites } from './test-registry';

// ANSI terminal color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function createAssertions(): Assertions {
  return {
    equal: <T>(actual: T, expected: T, message?: string) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    notEqual: <T>(actual: T, expected: T, message?: string) => {
      if (actual === expected) {
        throw new Error(message || `Expected value NOT to equal ${JSON.stringify(actual)}`);
      }
    },
    deepEqual: <T>(actual: T, expected: T, message?: string) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(message || `Deep equal mismatch:\nExpected: ${b}\nReceived: ${a}`);
      }
    },
    ok: (value: any, message?: string) => {
      if (!value) {
        throw new Error(message || `Expected truthy value, but got ${JSON.stringify(value)}`);
      }
    },
    isTrue: (value: boolean, message?: string) => {
      if (value !== true) {
        throw new Error(message || `Expected true, but got ${JSON.stringify(value)}`);
      }
    },
    isFalse: (value: boolean, message?: string) => {
      if (value !== false) {
        throw new Error(message || `Expected false, but got ${JSON.stringify(value)}`);
      }
    },
    greaterThan: (actual: number, threshold: number, message?: string) => {
      if (!(actual > threshold)) {
        throw new Error(message || `Expected ${actual} > ${threshold}`);
      }
    },
    greaterThanOrEqual: (actual: number, threshold: number, message?: string) => {
      if (!(actual >= threshold)) {
        throw new Error(message || `Expected ${actual} >= ${threshold}`);
      }
    },
    lessThan: (actual: number, threshold: number, message?: string) => {
      if (!(actual < threshold)) {
        throw new Error(message || `Expected ${actual} < ${threshold}`);
      }
    },
    lessThanOrEqual: (actual: number, threshold: number, message?: string) => {
      if (!(actual <= threshold)) {
        throw new Error(message || `Expected ${actual} <= ${threshold}`);
      }
    },
    includes: (container: string | any[], item: any, message?: string) => {
      if (typeof container === 'string') {
        if (!container.includes(item)) {
          throw new Error(message || `Expected string "${container}" to include "${item}"`);
        }
      } else if (Array.isArray(container)) {
        if (!container.includes(item)) {
          throw new Error(message || `Expected array to include ${JSON.stringify(item)}`);
        }
      }
    },
    matchRegex: (value: string, pattern: RegExp, message?: string) => {
      if (!pattern.test(value)) {
        throw new Error(message || `Expected "${value}" to match regex ${pattern}`);
      }
    },
    rejects: async (promise: Promise<any>, expectedError?: string | RegExp, message?: string) => {
      try {
        await promise;
        throw new Error(message || 'Expected promise to reject, but it resolved successfully');
      } catch (err: any) {
        if (expectedError) {
          if (typeof expectedError === 'string' && !err.message.includes(expectedError)) {
            throw new Error(message || `Expected rejection message to contain "${expectedError}", got "${err.message}"`);
          }
          if (expectedError instanceof RegExp && !expectedError.test(err.message)) {
            throw new Error(message || `Expected rejection message to match ${expectedError}, got "${err.message}"`);
          }
        }
      }
    },
  };
}

export class TestRunner {
  private suites: TestSuite[] = [];
  private client: TestClient;
  private assert: Assertions;

  constructor() {
    this.client = new TestClient();
    this.assert = createAssertions();
    this.suites = getAllSuites();
  }

  public async run(options: { tier?: number; feature?: string; verbose?: boolean; bail?: boolean } = {}): Promise<SuiteSummary> {
    const startTime = Date.now();
    let suitesToRun = this.suites;

    if (options.tier) {
      suitesToRun = suitesToRun.filter((s) => s.tier === options.tier);
    }
    if (options.feature) {
      suitesToRun = suitesToRun.filter((s) => s.featureId.toUpperCase() === options.feature?.toUpperCase());
    }

    const results: TestResult[] = [];
    const tierCounts: Record<number, { total: number; passed: number; failed: number }> = {
      1: { total: 0, passed: 0, failed: 0 },
      2: { total: 0, passed: 0, failed: 0 },
      3: { total: 0, passed: 0, failed: 0 },
      4: { total: 0, passed: 0, failed: 0 },
    };

    console.log(`${COLORS.bright}${COLORS.cyan}=================================================================${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}  CLOUD-NATIVE CORPORATE OFFICE STORE — OPAQUE-BOX E2E TEST RUNNER${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}=================================================================${COLORS.reset}`);
    console.log(`${COLORS.gray}Target Mode:${COLORS.reset} ${process.env.API_BASE_URL ? 'Live URL (' + process.env.API_BASE_URL + ')' : 'High-Fidelity Protocol Simulator'}`);
    console.log(`${COLORS.gray}Active Filter:${COLORS.reset} ${options.tier ? 'Tier ' + options.tier : 'All Tiers'} ${options.feature ? '| Feature: ' + options.feature : ''}`);
    console.log(`${COLORS.gray}Suites to execute:${COLORS.reset} ${suitesToRun.length} suites\n`);

    for (const suite of suitesToRun) {
      if (options.verbose) {
        console.log(`${COLORS.bright}${COLORS.blue}[Tier ${suite.tier}] [${suite.featureId}] ${suite.featureName}${COLORS.reset}`);
      }

      for (const test of suite.tests) {
        tierCounts[suite.tier].total++;
        const testStartTime = Date.now();
        const ctx: TestContext = {
          client: this.client,
          assert: this.assert,
          resetState: () => this.client.reset(),
          mockDriver: this.client.getMockDriver(),
        };

        // Reset state before each test to ensure strict test isolation
        ctx.resetState();

        try {
          await test.run(ctx);
          const duration = Date.now() - testStartTime;
          tierCounts[suite.tier].passed++;
          results.push({
            testId: test.id,
            testName: test.name,
            featureId: suite.featureId,
            tier: suite.tier,
            status: 'PASS',
            durationMs: duration,
          });

          if (options.verbose) {
            console.log(`  ${COLORS.green}✓${COLORS.reset} ${test.id}: ${test.name} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
          } else {
            process.stdout.write(`${COLORS.green}.${COLORS.reset}`);
          }
        } catch (err: any) {
          const duration = Date.now() - testStartTime;
          tierCounts[suite.tier].failed++;
          results.push({
            testId: test.id,
            testName: test.name,
            featureId: suite.featureId,
            tier: suite.tier,
            status: 'FAIL',
            durationMs: duration,
            error: err?.message || String(err),
            stack: err?.stack,
          });

          if (options.verbose) {
            console.log(`  ${COLORS.red}✗${COLORS.reset} ${test.id}: ${test.name} ${COLORS.red}(FAILED)${COLORS.reset}`);
            console.log(`    ${COLORS.red}Error: ${err?.message}${COLORS.reset}`);
          } else {
            process.stdout.write(`${COLORS.red}F${COLORS.reset}`);
          }

          if (options.bail) {
            console.log(`\n${COLORS.red}Bailing early after first failure.${COLORS.reset}`);
            break;
          }
        }
      }
      if (options.bail && results.some((r) => r.status === 'FAIL')) break;
    }

    const totalDuration = Date.now() - startTime;
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const skipped = results.filter((r) => r.status === 'SKIP').length;

    console.log('\n\n' + `${COLORS.bright}${COLORS.cyan}-----------------------------------------------------------------${COLORS.reset}`);
    console.log(`${COLORS.bright}  E2E TEST EXECUTION SUMMARY${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}-----------------------------------------------------------------${COLORS.reset}`);

    console.log(`Tier 1 (Feature Coverage):        ${tierCounts[1].passed}/${tierCounts[1].total} passed ${tierCounts[1].failed > 0 ? COLORS.red + '(' + tierCounts[1].failed + ' failed)' + COLORS.reset : COLORS.green + '✓' + COLORS.reset}`);
    console.log(`Tier 2 (Boundary & Corner Cases): ${tierCounts[2].passed}/${tierCounts[2].total} passed ${tierCounts[2].failed > 0 ? COLORS.red + '(' + tierCounts[2].failed + ' failed)' + COLORS.reset : COLORS.green + '✓' + COLORS.reset}`);
    console.log(`Tier 3 (Cross-Feature Combos):    ${tierCounts[3].passed}/${tierCounts[3].total} passed ${tierCounts[3].failed > 0 ? COLORS.red + '(' + tierCounts[3].failed + ' failed)' + COLORS.reset : COLORS.green + '✓' + COLORS.reset}`);
    console.log(`Tier 4 (Real-World Scenarios):    ${tierCounts[4].passed}/${tierCounts[4].total} passed ${tierCounts[4].failed > 0 ? COLORS.red + '(' + tierCounts[4].failed + ' failed)' + COLORS.reset : COLORS.green + '✓' + COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}-----------------------------------------------------------------${COLORS.reset}`);
    console.log(`Total Tests:    ${results.length}`);
    console.log(`Passed:         ${COLORS.green}${passed}${COLORS.reset}`);
    console.log(`Failed:         ${failed > 0 ? COLORS.red + failed + COLORS.reset : '0'}`);
    console.log(`Duration:       ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`${COLORS.bright}${COLORS.cyan}=================================================================${COLORS.reset}`);

    if (failed > 0) {
      console.log(`\n${COLORS.bright}${COLORS.red}FAILED TESTS DETAILS:${COLORS.reset}`);
      results
        .filter((r) => r.status === 'FAIL')
        .forEach((f) => {
          console.log(`- [${f.featureId}] ${f.testId}: ${f.testName}`);
          console.log(`  ${COLORS.red}${f.error}${COLORS.reset}`);
        });
    }

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      durationMs: totalDuration,
      tierCounts,
      results,
    };
  }
}

// CLI Execution Entrypoint
if (typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  const options: any = { verbose: false };

  for (const arg of args) {
    if (arg.startsWith('--tier=')) options.tier = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--feature=')) options.feature = arg.split('=')[1];
    if (arg === '--verbose' || arg === '-v') options.verbose = true;
    if (arg === '--bail') options.bail = true;
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx tests/e2e/runner.ts [options]

Options:
  --tier=<1|2|3|4>     Run tests for specific tier
  --feature=<code >    Filter by feature code (e.g. F08, F17)
  --verbose, -v        Display detailed per-test outputs
  --bail               Stop execution on first failure
  --help, -h           Show this help message
`);
      process.exit(0);
    }
  }

  const runner = new TestRunner();
  runner
    .run(options)
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal Runner Error:', err);
      process.exit(1);
    });
}
