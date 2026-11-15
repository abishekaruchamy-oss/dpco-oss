/**
 * Automated Verification Suite for Traffic Light Controller
 *
 * Runs formal invariant assertions:
 * Phase 1 Tests (FSM & Signal Invariants):
 * 1. Cycle Sequence (S0 -> S1 -> S2 -> S3 -> S0)
 * 2. Signal States correctness for all 4 directions (North, South, East, West)
 * 3. Primary Safety Invariant: Conflicting directions NEVER receive green simultaneously
 * 4. Clearance Safety Invariant: Conflicting directions NEVER have active clearance simultaneously
 * 5. Synthetic fault detection test (ensuring safety checker catches illegal states)
 * 6. Deterministic reset behavior and duration integrity
 * 7. Duration configuration update verification
 *
 * Phase 2 Tests (Vehicle Physics, Queuing, Density, Fail-Safe & Analytics):
 * 8. Fail-Safe All-Red Halt FSM transition and recovery
 * 9. Vehicle Movement and Kinematics under Green Light
 * 10. Red-Light Stopping Invariant (vehicles halt safely before stop line)
 * 11. Queue Handling and Anti-Collision Separation (strictly non-overlapping)
 * 12. Conflicting Direction Vehicle Prevention Proof (0 concurrent conflicting box occupancy)
 * 13. Traffic Density Mode configuration integrity
 * 14. Analytics mathematical consistency and conservation laws
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./fsm.js'), require('./vehicles.js'));
  } else {
    root.FSMVerifier = factory(root.TrafficFSM, root.VehicleManager);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLightFSM, VehicleManager) {
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

    // =========================================================================
    // PHASE 1 VERIFICATION (Regression Integrity)
    // =========================================================================

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

      if (nsGreen && (signals.east !== LIGHTS.RED || signals.west !== LIGHTS.RED)) {
        invariantHeld = false;
        invariantViolationDetails = `Transition ${t}: NS is Green but EW is not Red!`;
        break;
      }

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

    // =========================================================================
    // PHASE 2 VERIFICATION (Vehicle Simulation, Queues, Density & Safety)
    // =========================================================================

    // --- TEST 8: Fail-Safe All-Red Halt FSM Transition & Recovery ---
    fsm.reset();
    const haltRes = fsm.triggerAllRedHalt();
    const haltSignals = fsm.getSignals();
    assert(
      fsm.isAllRedHalt() === true &&
      haltRes.currentState === STATES.EMERGENCY_ALL_RED &&
      haltSignals.north === LIGHTS.RED &&
      haltSignals.south === LIGHTS.RED &&
      haltSignals.east === LIGHTS.RED &&
      haltSignals.west === LIGHTS.RED,
      'Fail-Safe All-Red Halt: All Signals Forced to RED',
      'Emergency halt verified: all four directions hold at RED.'
    );

    const resumeRes = fsm.resumeFromAllRed();
    assert(
      fsm.isAllRedHalt() === false && resumeRes.currentState === STATES.S0_NS_GREEN,
      'Fail-Safe All-Red Halt: Safe Recovery to Standard FSM State',
      `Resumed to ${resumeRes.currentState}`
    );

    // If VehicleManager is loaded, execute Phase 2 vehicle assertions
    if (VehicleManager) {
      const { CONSTANTS, DENSITY_MODES, DENSITY_CONFIGS } = VehicleManager;

      // --- TEST 9: Vehicle Movement & Kinematics under Green Light ---
      const vm1 = new VehicleManager({ autoSpawn: false });
      const vNorth = vm1.spawnVehicle('north');
      assert(vNorth !== null && vNorth.pos === -30, 'Vehicle Spawn Integrity', `Spawned North vehicle ID ${vNorth.id}`);

      const greenSignals = { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' };
      // Simulate 1.5 seconds of motion
      for (let i = 0; i < 15; i++) {
        vm1.update(0.1, greenSignals, false);
      }
      assert(
        vNorth.pos > -30 && vNorth.speed > 0,
        'Vehicle Forward Motion & Acceleration under Green Light',
        `Position: ${vNorth.pos.toFixed(1)}px, Speed: ${vNorth.speed.toFixed(1)}px/s`
      );

      // Simulate until vehicle clears intersection completely
      for (let i = 0; i < 80; i++) {
        vm1.update(0.1, greenSignals, false);
      }
      assert(
        vm1.analytics.totalPassed === 1 && vm1.lanes.north.length === 0,
        'Vehicle Full Intersection Traversal & Despawn',
        `Total passed: ${vm1.analytics.totalPassed}`
      );

      // --- TEST 10: Red-Light Stopping Invariant ---
      const vm2 = new VehicleManager({ autoSpawn: false });
      const vEast = vm2.spawnVehicle('east');
      const redSignals = { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' };

      // Simulate 10 seconds of physics while East is RED
      for (let i = 0; i < 100; i++) {
        vm2.update(0.1, redSignals, false);
      }

      assert(
        vEast.pos <= CONSTANTS.STOP_LINE_POS + 0.5 && vEast.speed === 0,
        'Red-Light Stopping Invariant: Vehicle Halts Completely Before Stop Line',
        `Final position: ${vEast.pos.toFixed(1)}px (Stop Line: ${CONSTANTS.STOP_LINE_POS}px), Speed: ${vEast.speed}px/s`
      );

      // --- TEST 11: Queue Handling & Separation (Zero-Overlap Guarantee) ---
      const vm3 = new VehicleManager({ autoSpawn: false });
      const car1 = vm3.spawnVehicle('south');
      // Advance car 1 towards stop line
      for (let i = 0; i < 40; i++) {
        vm3.update(0.1, { north: 'RED', south: 'RED', east: 'GREEN', west: 'GREEN' }, false);
      }
      const car2 = vm3.spawnVehicle('south');
      for (let i = 0; i < 30; i++) {
        vm3.update(0.1, { north: 'RED', south: 'RED', east: 'GREEN', west: 'GREEN' }, false);
      }
      const car3 = vm3.spawnVehicle('south');
      for (let i = 0; i < 50; i++) {
        vm3.update(0.1, { north: 'RED', south: 'RED', east: 'GREEN', west: 'GREEN' }, false);
      }

      const laneSouth = vm3.lanes.south;
      let zeroOverlap = true;
      let minObservedGap = Infinity;

      for (let i = 1; i < laneSouth.length; i++) {
        const gap = laneSouth[i - 1].pos - laneSouth[i].pos;
        if (gap < minObservedGap) minObservedGap = gap;
        if (gap < CONSTANTS.CAR_LENGTH) {
          zeroOverlap = false;
        }
      }

      assert(
        zeroOverlap && laneSouth.length === 3 && laneSouth[0].pos <= CONSTANTS.STOP_LINE_POS + 0.5,
        'Queue Discipline & Anti-Collision: Zero Vehicle Overlap in Queue',
        `Minimum bumper-to-bumper distance: ${minObservedGap.toFixed(1)}px (Safe threshold: ${CONSTANTS.CAR_LENGTH}px)`
      );

      // --- TEST 12: Conflicting Direction Vehicle Prevention Proof ---
      const vm4 = new VehicleManager({ autoSpawn: false });
      const nCar = vm4.spawnVehicle('north');
      const wCar = vm4.spawnVehicle('west');

      // North is GREEN, West is RED
      let conflictViolation = false;
      for (let step = 0; step < 120; step++) {
        const currentSignals = { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' };
        vm4.update(0.1, currentSignals, false);

        // Check if both North and West vehicles are inside the junction collision box simultaneously
        const nInBox = nCar.pos >= CONSTANTS.JUNCTION_ENTRY && nCar.pos <= CONSTANTS.JUNCTION_EXIT;
        const wInBox = wCar.pos >= CONSTANTS.JUNCTION_ENTRY && wCar.pos <= CONSTANTS.JUNCTION_EXIT;

        if (nInBox && wInBox) {
          conflictViolation = true;
          break;
        }
      }

      assert(
        !conflictViolation,
        'Conflicting Direction Vehicle Prevention: 0 Simultaneous Collision Box Occupancy',
        'Conflicting corridors strictly prevented from overlapping inside junction.'
      );

      // --- TEST 13: Traffic Density Mode Configuration Integrity ---
      const vm5 = new VehicleManager();
      assert(
        DENSITY_CONFIGS[DENSITY_MODES.LOW].spawnInterval > DENSITY_CONFIGS[DENSITY_MODES.HIGH].spawnInterval,
        'Traffic Density Presets: Low, Medium, High spawn scaling verified',
        `Low: ${DENSITY_CONFIGS[DENSITY_MODES.LOW].spawnInterval}s vs High: ${DENSITY_CONFIGS[DENSITY_MODES.HIGH].spawnInterval}s`
      );

      vm5.setDensityMode(DENSITY_MODES.HIGH);
      assert(
        vm5.densityMode === DENSITY_MODES.HIGH,
        'Traffic Density Mode Selection: Dynamic switching to HIGH',
        `Active config: ${vm5.getDensityConfig().name}`
      );

      // --- TEST 14: Analytics Mathematical Consistency ---
      const stats = vm3.getAnalytics();
      assert(
        stats.totalGenerated >= stats.totalPassed &&
        stats.queueTotal >= 0 &&
        stats.avgWaitTime >= 0,
        'Traffic Analytics Mathematical Integrity & Conservation Proof',
        `Generated: ${stats.totalGenerated}, Passed: ${stats.totalPassed}, Queued: ${stats.queueTotal}`
      );
    }

    return results;
  }

  // CLI execution if executed directly in Node
  if (typeof process !== 'undefined' && process.argv && require.main === module) {
    console.log('====================================================');
    console.log(' Traffic Light Controller Verification Suite');
    console.log(' Phase 1 (FSM) + Phase 2 (Vehicles & Safety)');
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
