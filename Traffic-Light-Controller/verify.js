/**
 * Automated Verification Suite for Traffic Light Controller FSM
 *
 * Runs formal invariant assertions:
 * 1. Cycle Sequence (S0 -> S1 -> S2 -> S3 -> S0)
 * 2. Signal States correctness for all 4 directions (North, South, East, West)
 * 3. Primary Safety Invariant: Conflicting directions NEVER receive green simultaneously
 * 4. Clearance Safety Invariant: Conflicting directions NEVER have active clearance simultaneously
 * 5. Deterministic reset behavior and duration integrity
 * 6. Synthetic fault detection test (ensuring safety checker catches illegal states)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./fsm.js'));
  } else {
    root.FSMVerifier = factory(root.TrafficFSM);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLightFSM) {
  'use strict';

  function runVerificationSuite() {
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };

    function assert(condition, testName, extraInfo = '') {
      results.total++;
      if (condition) {
        results.passed++;
        results.details.push({
          status: 'PASS',
          test: testName,
          info: extraInfo
        });
      } else {
        results.failed++;
        results.details.push({
          status: 'FAIL',
          test: testName,
          info: extraInfo
        });
        console.error(`[FAIL] ${testName}: ${extraInfo}`);
      }
    }

    const { STATES, LIGHTS } = TrafficLightFSM;

    // --- TEST 1: Initial State Initialization ---
    const fsm = new TrafficLightFSM();
    assert(
      fsm.getCurrentState() === STATES.S0_NS_GREEN,
      'Initial State Verification',
      `Expected ${STATES.S0_NS_GREEN}, got ${fsm.getCurrentState()}`
    );

    const initialSignals = fsm.getSignals();
    assert(
      initialSignals.north === LIGHTS.GREEN &&
      initialSignals.south === LIGHTS.GREEN &&
      initialSignals.east === LIGHTS.RED &&
      initialSignals.west === LIGHTS.RED,
      'Initial Signal Configuration (S0: NS Green, EW Red)',
      JSON.stringify(initialSignals)
    );

    // --- TEST 2: Strict 4-State Cycle Sequence ---
    const expectedSequence = [
      STATES.S1_NS_YELLOW,
      STATES.S2_EW_GREEN,
      STATES.S3_EW_YELLOW,
      STATES.S0_NS_GREEN,
      STATES.S1_NS_YELLOW,
      STATES.S2_EW_GREEN,
      STATES.S3_EW_YELLOW,
      STATES.S0_NS_GREEN
    ];

    let cycleValid = true;
    for (let i = 0; i < expectedSequence.length; i++) {
      const stepRes = fsm.step();
      if (stepRes.currentState !== expectedSequence[i]) {
        cycleValid = false;
        break;
      }
    }
    assert(cycleValid, 'Cyclic Transition Fidelity (S0 -> S1 -> S2 -> S3 -> S0 over 2 full cycles)');

    // --- TEST 3: Signal Outputs Per State ---
    fsm.reset();
    const stateChecks = [
      {
        state: STATES.S0_NS_GREEN,
        expected: { north: LIGHTS.GREEN, south: LIGHTS.GREEN, east: LIGHTS.RED, west: LIGHTS.RED }
      },
      {
        state: STATES.S1_NS_YELLOW,
        expected: { north: LIGHTS.YELLOW, south: LIGHTS.YELLOW, east: LIGHTS.RED, west: LIGHTS.RED }
      },
      {
        state: STATES.S2_EW_GREEN,
        expected: { north: LIGHTS.RED, south: LIGHTS.RED, east: LIGHTS.GREEN, west: LIGHTS.GREEN }
      },
      {
        state: STATES.S3_EW_YELLOW,
        expected: { north: LIGHTS.RED, south: LIGHTS.RED, east: LIGHTS.YELLOW, west: LIGHTS.YELLOW }
      }
    ];

    for (let i = 0; i < stateChecks.length; i++) {
      const check = stateChecks[i];
      if (i > 0) fsm.step();
      const current = fsm.getSignals();
      const match =
        current.north === check.expected.north &&
        current.south === check.expected.south &&
        current.east === check.expected.east &&
        current.west === check.expected.west;

      assert(
        match,
        `Directional Lights Mapping for ${check.state}`,
        `Expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(current)}`
      );
    }

    // --- TEST 4: Primary Safety Invariant - No Simultaneous Conflicting Greens ---
    fsm.reset();
    let invariantHeld = true;
    let invariantViolationDetails = '';
    const SIMULATED_TRANSITIONS = 200;

    for (let t = 0; t < SIMULATED_TRANSITIONS; t++) {
      const signals = fsm.getSignals();
      const nsGreen = signals.north === LIGHTS.GREEN || signals.south === LIGHTS.GREEN;
      const ewGreen = signals.east === LIGHTS.GREEN || signals.west === LIGHTS.GREEN;

      if (nsGreen && ewGreen) {
        invariantHeld = false;
        invariantViolationDetails = `Transition ${t}: North/South Green coincided with East/West Green!`;
        break;
      }

      // Also ensure that when NS is green, EW is strictly RED
      if (nsGreen && (signals.east !== LIGHTS.RED || signals.west !== LIGHTS.RED)) {
        invariantHeld = false;
        invariantViolationDetails = `Transition ${t}: NS is Green but EW is not Red!`;
        break;
      }

      // And when EW is green, NS is strictly RED
      if (ewGreen && (signals.north !== LIGHTS.RED || signals.south !== LIGHTS.RED)) {
        invariantHeld = false;
        invariantViolationDetails = `Transition ${t}: EW is Green but NS is not Red!`;
        break;
      }

      const safetyResult = fsm.validateSafety();
      if (!safetyResult.isSafe) {
        invariantHeld = false;
        invariantViolationDetails = `Internal safety validator failed: ${safetyResult.reason}`;
        break;
      }

      fsm.step();
    }

    assert(
      invariantHeld,
      `Safety Invariant Proof (${SIMULATED_TRANSITIONS} continuous transitions checked)`,
      invariantViolationDetails || 'Zero conflicting green signals detected across all transitions.'
    );

    // --- TEST 5: Synthetic Hazard Rejection ---
    // Manually pass illegal signal states to validateSafety to ensure checker works
    const illegalStateDualGreen = {
      north: LIGHTS.GREEN,
      south: LIGHTS.GREEN,
      east: LIGHTS.GREEN,
      west: LIGHTS.RED
    };
    const safetyCheck1 = fsm.validateSafety(illegalStateDualGreen);
    assert(
      safetyCheck1.isSafe === false && safetyCheck1.code === 'ERR_DUAL_GREEN',
      'Synthetic Invariant Defense: Dual Green Caught and Blocked',
      `Reported code: ${safetyCheck1.code}`
    );

    const illegalStateDualActive = {
      north: LIGHTS.YELLOW,
      south: LIGHTS.RED,
      east: LIGHTS.YELLOW,
      west: LIGHTS.RED
    };
    const safetyCheck2 = fsm.validateSafety(illegalStateDualActive);
    assert(
      safetyCheck2.isSafe === false && safetyCheck2.code === 'ERR_DUAL_ACTIVE',
      'Synthetic Invariant Defense: Dual Active Clearance Caught and Blocked',
      `Reported code: ${safetyCheck2.code}`
    );

    // --- TEST 6: Reset Functionality ---
    fsm.step();
    fsm.step();
    const resetRes = fsm.reset();
    assert(
      resetRes.currentState === STATES.S0_NS_GREEN && fsm.transitionCount === 0,
      'Reset Restores Initial State S0 and Clears Counters',
      `State: ${resetRes.currentState}, Transitions: ${fsm.transitionCount}`
    );

    // --- TEST 7: Duration Customization and Invariant Retention ---
    fsm.setDuration(STATES.S0_NS_GREEN, 15);
    fsm.setDuration(STATES.S1_NS_YELLOW, 4);
    assert(
      fsm.getDurationForState(STATES.S0_NS_GREEN) === 15 &&
      fsm.getDurationForState(STATES.S1_NS_YELLOW) === 4,
      'Duration Configuration Update Verification',
      'Custom timing intervals successfully registered.'
    );

    return results;
  }

  // CLI execution if executed directly in Node
  if (typeof process !== 'undefined' && process.argv && require.main === module) {
    console.log('====================================================');
    console.log(' Traffic Light Controller FSM Verification Suite');
    console.log('====================================================');
    const results = runVerificationSuite();
    results.details.forEach(item => {
      const badge = item.status === 'PASS' ? '[PASS]' : '[FAIL]';
      console.log(`${badge} ${item.test} - ${item.info}`);
    });
    console.log('----------------------------------------------------');
    console.log(`Summary: ${results.passed}/${results.total} assertions passed (${results.failed} failed).`);
    console.log('====================================================');
    if (results.failed > 0) {
      process.exit(1);
    }
  }

  return { runVerificationSuite };
});
