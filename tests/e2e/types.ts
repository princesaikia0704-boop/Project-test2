/**
 * Core Types and Interfaces for E2E Test Suite
 * Follows Dual Track Principles: Opaque-Box, Zero Internal Coupling
 */

export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export interface UserPersona {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: any;
  timeoutMs?: number;
  idempotencyKey?: string;
  persona?: UserPersona;
  rawSignature?: string;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  durationMs: number;
}

export interface Assertions {
  equal: <T>(actual: T, expected: T, message?: string) => void;
  notEqual: <T>(actual: T, expected: T, message?: string) => void;
  deepEqual: <T>(actual: T, expected: T, message?: string) => void;
  ok: (value: any, message?: string) => void;
  isTrue: (value: boolean, message?: string) => void;
  isFalse: (value: boolean, message?: string) => void;
  greaterThan: (actual: number, threshold: number, message?: string) => void;
  greaterThanOrEqual: (actual: number, threshold: number, message?: string) => void;
  lessThan: (actual: number, threshold: number, message?: string) => void;
  lessThanOrEqual: (actual: number, threshold: number, message?: string) => void;
  includes: (container: string | any[], item: any, message?: string) => void;
  matchRegex: (value: string, pattern: RegExp, message?: string) => void;
  rejects: (promise: Promise<any>, expectedError?: string | RegExp, message?: string) => Promise<void>;
}

export interface TestContext {
  client: any;
  assert: Assertions;
  resetState: () => void;
  mockDriver?: any;
}

export interface TestCase {
  id: string;
  name: string;
  feature: string;
  tier: 1 | 2 | 3 | 4;
  run: (ctx: TestContext) => Promise<void> | void;
}

export interface TestSuite {
  featureId: string;
  featureName: string;
  tier: 1 | 2 | 3 | 4;
  description: string;
  tests: TestCase[];
}

export interface TestResult {
  testId: string;
  testName: string;
  featureId: string;
  tier: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface SuiteSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  tierCounts: Record<number, { total: number; passed: number; failed: number }>;
  results: TestResult[];
}
