/**
 * Test Registry: Central Catalog of all E2E Test Suites Across Tiers 1-4
 */

import { TestSuite } from './types';

// Tier 1 Suites
import { m1FoundationSuites } from './tier1-features/m1-foundation';
import { m2ReliabilitySuites } from './tier1-features/m2-reliability';
import { m2ServicesSuites } from './tier1-features/m2-services';
import { m3StorefrontSuites } from './tier1-features/m3-storefront';
import { m4AdminSuites } from './tier1-features/m4-admin';
import { m5m6WorkersAndTestSuites } from './tier1-features/m5-m6-workers-and-test';

// Tier 2 Suites
import { m1FoundationBoundarySuites } from './tier2-boundaries/m1-foundation-bnd';
import { m2ReliabilityBoundarySuites } from './tier2-boundaries/m2-reliability-bnd';
import { m2ServicesBoundarySuites } from './tier2-boundaries/m2-services-bnd';
import { m3StorefrontBoundarySuites } from './tier2-boundaries/m3-storefront-bnd';
import { m4AdminBoundarySuites } from './tier2-boundaries/m4-admin-bnd';
import { m5m6WorkersBoundarySuites } from './tier2-boundaries/m5-m6-workers-bnd';

// Tier 3 Suites
import { tier3CombinationSuites } from './tier3-combinations/comb-suites';

// Tier 4 Suites
import { tier4ScenarioSuites } from './tier4-scenarios/real-world-scenarios';

export function getAllSuites(): TestSuite[] {
  return [
    // Tier 1: Feature Coverage (30 features, >= 5 tests each -> 150 tests)
    ...m1FoundationSuites,
    ...m2ReliabilitySuites,
    ...m2ServicesSuites,
    ...m3StorefrontSuites,
    ...m4AdminSuites,
    ...m5m6WorkersAndTestSuites,

    // Tier 2: Boundary & Corner Cases (30 features, >= 5 tests each -> 150 tests)
    ...m1FoundationBoundarySuites,
    ...m2ReliabilityBoundarySuites,
    ...m2ServicesBoundarySuites,
    ...m3StorefrontBoundarySuites,
    ...m4AdminBoundarySuites,
    ...m5m6WorkersBoundarySuites,

    // Tier 3: Cross-Feature Combinations (10 pairwise suites -> 30 tests)
    ...tier3CombinationSuites,

    // Tier 4: Real-World Scenarios (5 multi-persona journeys -> 15 tests)
    ...tier4ScenarioSuites,
  ];
}
