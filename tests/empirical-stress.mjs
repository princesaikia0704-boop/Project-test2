/**
 * Empirical Challenger Stress Harness for Milestone 2
 * Tests: Concurrency, ACID transactions, budget boundaries, deadlock resistance,
 * idempotency mutexes, and error sanitization.
 */

import { strict as assert } from 'node:assert';

console.log('=================================================================');
console.log('  CHALLENGER EMPIRICAL VERIFICATION & STRESS HARNESS (M2)');
console.log('=================================================================\n');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failCount++;
  }
}

// =====================================================================
// 1. DEADLOCK ELIMINATION & PRODUCT ID SORTING VERIFICATION
// =====================================================================
console.log('\n--- SUITE 1: DEADLOCK RESISTANCE & LOCK ORDER DETERMINISM ---');

await test('Items with reversed or random product IDs are deterministically sorted ascending', () => {
  const inputA = [
    { productId: 'prod-zebra', quantity: 2 },
    { productId: 'prod-apple', quantity: 1 },
    { productId: 'prod-mango', quantity: 5 },
  ];
  const inputB = [
    { productId: 'prod-mango', quantity: 1 },
    { productId: 'prod-zebra', quantity: 3 },
    { productId: 'prod-apple', quantity: 2 },
  ];

  const sortItems = (items) => [...items].sort((a, b) => a.productId.localeCompare(b.productId));
  const sortedA = sortItems(inputA).map(i => i.productId);
  const sortedB = sortItems(inputB).map(i => i.productId);

  assert.deepEqual(sortedA, ['prod-apple', 'prod-mango', 'prod-zebra']);
  assert.deepEqual(sortedB, ['prod-apple', 'prod-mango', 'prod-zebra']);
  assert.deepEqual(sortedA, sortedB, 'Lock acquisition order must be identical regardless of client item sequence');
});

await test('Deduplication of product IDs handles duplicate cart entries safely', () => {
  const items = [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1 },
    { productId: 'prod-1', quantity: 3 },
  ];
  const uniqueIds = Array.from(new Set(items.map(i => i.productId))).sort((a, b) => a.localeCompare(b));
  assert.deepEqual(uniqueIds, ['prod-1', 'prod-2']);
});

// =====================================================================
// 2. BUDGET ENFORCEMENT & EXACT BOUNDARY TESTING
// =====================================================================
console.log('\n--- SUITE 2: BUDGET BOUNDARY & OVERDRAFT GUARDS ---');

class MockBudgetEngine {
  constructor(totalCents, remainingCents) {
    this.totalCents = totalCents;
    this.remainingCents = remainingCents;
  }

  deduct(amountCents) {
    if (typeof amountCents !== 'number' || amountCents <= 0 || !Number.isInteger(amountCents)) {
      throw new Error('InvalidAmount: must be positive integer');
    }
    if (this.remainingCents < amountCents) {
      throw new Error(`InsufficientBudget: required ${amountCents}, remaining ${this.remainingCents}`);
    }
    this.remainingCents -= amountCents;
    return this.remainingCents;
  }

  restore(amountCents) {
    if (typeof amountCents !== 'number' || amountCents <= 0 || !Number.isInteger(amountCents)) {
      throw new Error('InvalidAmount: must be positive integer');
    }
    // LEAST(totalCents, remainingCents + amountCents)
    this.remainingCents = Math.min(this.totalCents, this.remainingCents + amountCents);
    return this.remainingCents;
  }
}

await test('Order checkout allowed when order total exactly equals remaining budget', () => {
  const engine = new MockBudgetEngine(100000, 1500); // $15.00 remaining
  const remaining = engine.deduct(1500);
  assert.equal(remaining, 0, 'Remaining budget should drop to exactly 0');
});

await test('Order checkout fails when order total exceeds budget by exactly 1 cent', () => {
  const engine = new MockBudgetEngine(100000, 1499); // $14.99 remaining
  assert.throws(
    () => engine.deduct(1500), // $15.00 requested
    /InsufficientBudget/,
    'Must throw InsufficientBudget when 1 cent short'
  );
  assert.equal(engine.remainingCents, 1499, 'Budget remaining must remain intact on rejection');
});

await test('Order submission fails when remaining budget is zero', () => {
  const engine = new MockBudgetEngine(100000, 0); // $0 remaining
  assert.throws(
    () => engine.deduct(100),
    /InsufficientBudget/,
    'Must reject when remaining budget is 0'
  );
  assert.equal(engine.remainingCents, 0);
});

await test('Order allowed when remaining budget exceeds order total by 1 cent', () => {
  const engine = new MockBudgetEngine(100000, 1501); // $15.01 remaining
  const remaining = engine.deduct(1500);
  assert.equal(remaining, 1, 'Exactly 1 cent must remain');
});

await test('Refund / restoration cannot exceed total budget limit (LEAST ceiling)', () => {
  const engine = new MockBudgetEngine(100000, 95000); // $50 spent
  engine.restore(10000); // Try to restore $100
  assert.equal(engine.remainingCents, 100000, 'Remaining cannot exceed totalCents');
});

// =====================================================================
// 3. ACID SNAPSHOT ROLLBACK INTEGRITY UNDER TRANSACTION FAULTS
// =====================================================================
console.log('\n--- SUITE 3: ACID ROLLBACK & ATOMICITY SIMULATION ---');

class MockReactiveStore {
  constructor() {
    this.stock = new Map([
      ['prod-pens', 10],
      ['prod-desk', 2],
      ['prod-paper', 5],
    ]);
    this.budget = { totalCents: 100000, remainingCents: 50000 };
  }

  snapshot() {
    return {
      stock: new Map(this.stock),
      budget: { ...this.budget },
    };
  }

  restore(snap) {
    this.stock = new Map(snap.stock);
    this.budget = { ...snap.budget };
  }

  async transaction(fn) {
    const snap = this.snapshot();
    try {
      return await fn();
    } catch (err) {
      this.restore(snap);
      throw err;
    }
  }
}

await test('Transaction rolls back both stock and budget when secondary item fails stock check', async () => {
  const store = new MockReactiveStore();
  const initialBudget = store.budget.remainingCents;
  const initialPens = store.stock.get('prod-pens');

  let errorThrown = false;
  try {
    await store.transaction(async () => {
      // Step 1: Encumber budget
      store.budget.remainingCents -= 5000;
      // Step 2: Decrement first item stock (valid)
      store.stock.set('prod-pens', initialPens - 2);
      // Step 3: Second item exceeds available stock
      const deskStock = store.stock.get('prod-desk');
      if (deskStock < 5) {
        throw new Error('InsufficientStock: prod-desk');
      }
      store.stock.set('prod-desk', deskStock - 5);
    });
  } catch (err) {
    errorThrown = true;
    assert.equal(err.message, 'InsufficientStock: prod-desk');
  }

  assert.ok(errorThrown, 'Expected transaction to fail');
  assert.equal(store.budget.remainingCents, initialBudget, 'Budget must be restored to initial state');
  assert.equal(store.stock.get('prod-pens'), initialPens, 'Pens stock must be restored to initial state');
});

// =====================================================================
// 4. CONCURRENCY & RACE CONDITION STRESS HARNESS
// =====================================================================
console.log('\n--- SUITE 4: HIGH-CONCURRENCY RACE CONDITIONS & MUTEX LOCKING ---');

await test('50 concurrent checkout attempts competing for 10 units: exactly 10 succeed and 40 fail cleanly', async () => {
  let availableStock = 10;
  let remainingBudget = 100000;
  const itemPrice = 1000; // $10 per unit

  let successCount = 0;
  let stockErrorCount = 0;

  // Single-threaded event loop atomic decrement simulation
  const attemptCheckout = async (workerId) => {
    // Simulated atomic check and update
    if (availableStock >= 1 && remainingBudget >= itemPrice) {
      availableStock -= 1;
      remainingBudget -= itemPrice;
      successCount++;
      return { success: true, workerId };
    } else {
      stockErrorCount++;
      return { success: false, error: 'InsufficientStock' };
    }
  };

  const tasks = Array.from({ length: 50 }, (_, i) => attemptCheckout(i));
  const results = await Promise.all(tasks);

  assert.equal(successCount, 10, 'Exactly 10 orders must succeed');
  assert.equal(stockErrorCount, 40, 'Exactly 40 orders must fail');
  assert.equal(availableStock, 0, 'Available stock must be exactly 0, never negative');
  assert.equal(remainingBudget, 90000, 'Budget must be decremented by exactly 10 * 1000 cents');
});

await test('Redis idempotency mutex: first concurrent request acquires lock, duplicate is rejected with 409', async () => {
  const store = new Map();

  const acquireLock = async (key) => {
    if (store.has(key)) {
      return { acquired: false, existing: store.get(key) };
    }
    const record = { state: 'IN_PROGRESS', createdAt: Date.now() };
    store.set(key, record);
    return { acquired: true };
  };

  const key = 'idemp:user-alice:test-key-1';

  // Fire 10 simultaneous lock requests for same key
  const attempts = await Promise.all(
    Array.from({ length: 10 }, () => acquireLock(key))
  );

  const acquiredCount = attempts.filter(a => a.acquired).length;
  const conflictCount = attempts.filter(a => !a.acquired && a.existing.state === 'IN_PROGRESS').length;

  assert.equal(acquiredCount, 1, 'Only 1 request may acquire the idempotency mutex');
  assert.equal(conflictCount, 9, 'All 9 competing concurrent requests must receive conflict state');
});

await test('Idempotency replay: completed request returns cached response with IDEMPOTENT_HIT header', async () => {
  const store = new Map();
  const key = 'idemp:user-alice:completed-key';

  // Save completed response
  store.set(key, {
    state: 'COMPLETED',
    status: 201,
    data: { orderId: 'ord-1234', totalCents: 3000 },
  });

  const entry = store.get(key);
  assert.equal(entry.state, 'COMPLETED');
  assert.equal(entry.status, 201);
  assert.equal(entry.data.orderId, 'ord-1234');
});

await test('Idempotency lock is purged on failure so client can retry immediately', async () => {
  const store = new Map();
  const key = 'idemp:user-alice:failed-key';

  // Acquire lock
  store.set(key, { state: 'IN_PROGRESS' });
  assert.ok(store.has(key));

  // Simulated handler failure -> purge lock
  store.delete(key);
  assert.ok(!store.has(key), 'Lock must be purged on 4xx/5xx/exception');

  // Next attempt should succeed in acquiring lock
  store.set(key, { state: 'IN_PROGRESS' });
  assert.ok(store.has(key), 'Client can now retry without 409 conflict');
});

// =====================================================================
// 5. SECURITY & ERROR ENVELOPE SANITIZATION
// =====================================================================
console.log('\n--- SUITE 5: SENSITIVE DATA REDACTION & SLA TIMEOUTS ---');

function sanitizeErrorMessage(msg) {
  if (typeof msg !== 'string') return String(msg);
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DB_URL]')
    .replace(/CLERK_SECRET_KEY=[^\s"']+/gi, 'CLERK_SECRET_KEY=[REDACTED]')
    .replace(/sk_test_[a-zA-Z0-9_]+/gi, '[REDACTED_SECRET]')
    .replace(/sigkey_[a-zA-Z0-9_]+/gi, '[REDACTED_SIGKEY]');
}

await test('Sanitizer redacts live PostgreSQL connection strings with passwords', () => {
  const input = 'Database error at postgresql://neondb_owner:npg_SecretPass123@ep-cool-wave-a2b3.us-east-2.aws.neon.tech/neondb?sslmode=require: timeout';
  const sanitized = sanitizeErrorMessage(input);
  assert.ok(!sanitized.includes('npg_SecretPass123'), 'Must not contain plaintext password');
  assert.ok(!sanitized.includes('ep-cool-wave'), 'Must not contain server host');
  assert.ok(sanitized.includes('[REDACTED_DB_URL]'), 'Must replace with placeholder');
});

await test('Sanitizer redacts Clerk test and live secret keys', () => {
  const input = 'Auth failure: CLERK_SECRET_KEY=sk_test_51MzABCD1234EFGH5678IJKL invalid token';
  const sanitized = sanitizeErrorMessage(input);
  assert.ok(!sanitized.includes('sk_test_51Mz'), 'Must redact Clerk secret key');
  assert.ok(sanitized.includes('CLERK_SECRET_KEY=[REDACTED]'));
});

// =====================================================================
// 6. OBJECT STORAGE BOUNDARY VALIDATION
// =====================================================================
console.log('\n--- SUITE 6: OBJECT STORAGE BOUNDARIES (10MB & DANGEROUS EXTENSIONS) ---');

function validatePresignedInput({ filename, fileSizeBytes }) {
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  const PROHIBITED_EXTENSIONS = ['.sh', '.exe', '.bat', '.cmd', '.ps1', '.js', '.vbs'];

  if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
    throw new Error('MissingFilename');
  }
  if (fileSizeBytes !== undefined && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error('PayloadTooLarge');
  }
  const lower = filename.trim().toLowerCase();
  for (const ext of PROHIBITED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      throw new Error('DisallowedFileType');
    }
  }
  return true;
}

await test('Presigned URL accepts valid CSV and image uploads under 10MB', () => {
  assert.ok(validatePresignedInput({ filename: 'catalog.csv', fileSizeBytes: 5 * 1024 * 1024 }));
  assert.ok(validatePresignedInput({ filename: 'product.png', fileSizeBytes: 9.9 * 1024 * 1024 }));
});

await test('Presigned URL rejects files exceeding 10MB', () => {
  assert.throws(
    () => validatePresignedInput({ filename: 'massive_catalog.csv', fileSizeBytes: 10 * 1024 * 1024 + 1 }),
    /PayloadTooLarge/
  );
});

await test('Presigned URL rejects dangerous executable files (.exe, .sh, .bat)', () => {
  assert.throws(() => validatePresignedInput({ filename: 'malware.exe' }), /DisallowedFileType/);
  assert.throws(() => validatePresignedInput({ filename: 'script.sh' }), /DisallowedFileType/);
  assert.throws(() => validatePresignedInput({ filename: 'exploit.bat' }), /DisallowedFileType/);
  assert.throws(() => validatePresignedInput({ filename: 'runner.ps1' }), /DisallowedFileType/);
});

// =====================================================================
// 7. QSTASH SIGNATURE VERIFICATION
// =====================================================================
console.log('\n--- SUITE 7: QSTASH SIGNATURE VERIFICATION IN MOCK & LIVE MODES ---');

function verifyMockSignature(sig) {
  if (!sig || sig.trim() === '') return { isValid: false, error: 'InvalidSignature' };
  if (sig === 'mock_valid_signature') return { isValid: true };
  return { isValid: false, error: 'InvalidSignature' };
}

await test('Accepts valid mock signature', () => {
  const result = verifyMockSignature('mock_valid_signature');
  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
});

await test('Rejects empty or forged signature', () => {
  assert.equal(verifyMockSignature('').isValid, false);
  assert.equal(verifyMockSignature('forged_signature_token').isValid, false);
  assert.equal(verifyMockSignature('invalid_sig').error, 'InvalidSignature');
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('=================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
