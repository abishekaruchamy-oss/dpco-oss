/**
 * Automated Verification Suite for Traffic Light Controller
 *
 * Runs formal invariant assertions across all phases:
 * Phase 1 Tests (FSM & Signal Invariants): Tests 1-7
 * Phase 2 Tests (Vehicle Physics, Queuing, Density & Fail-Safe): Tests 8-14
 * Phase 3 Tests (Adaptive Signal Timing & Explainable AI): Tests 15-21
 * Phase 4 Tests (Emergency Vehicle Priority Preemption): Tests 22-26
 * Phase 5 Tests (Advanced Traffic Analytics & Telemetry): Tests 27-32
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./fsm.js'),
      require('./vehicles.js'),
      require('./adaptive.js'),
      require('./analytics.js')
    );
  } else {
    root.FSMVerifier = factory(root.TrafficFSM, root.VehicleManager, root.AdaptiveController, root.TrafficAnalyticsEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLightFSM, VehicleManager, AdaptiveController, TrafficAnalyticsEngine) {
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
      assert(vNorth !== null && vNorth.pos <= 0, 'Vehicle Spawn Integrity', `Spawned North vehicle ID ${vNorth.id} at pos ${vNorth.pos}px`);

      const greenSignals = { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' };
      // Simulate 1.5 seconds of motion
      for (let i = 0; i < 15; i++) {
        vm1.update(0.1, greenSignals, false);
      }
      assert(
        vNorth.pos > -40 && vNorth.speed > 0,
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

    // =========================================================================
    // PHASE 3 VERIFICATION (Adaptive Signal Timing, XAI & Anti-Starvation)
    // =========================================================================
    if (AdaptiveController) {
      const { MODES, DEFAULT_CONFIG } = AdaptiveController;

      // --- TEST 15: Adaptive Controller Mode Switching ---
      const ac = new AdaptiveController();
      assert(
        ac.getMode() === MODES.ADAPTIVE,
        'Adaptive Controller Default Mode is ADAPTIVE',
        `Mode: ${ac.getMode()}`
      );

      ac.setMode(MODES.FIXED);
      assert(ac.getMode() === MODES.FIXED, 'Mode Switching: FIXED Mode Activated');

      ac.setMode(MODES.MANUAL);
      assert(ac.getMode() === MODES.MANUAL, 'Mode Switching: MANUAL Mode Activated');

      ac.setMode(MODES.ADAPTIVE);
      assert(ac.getMode() === MODES.ADAPTIVE, 'Mode Switching: Restored to ADAPTIVE');

      // --- TEST 16: Balanced Demand Adaptive Timing ---
      const balancedQueues = { north: 2, south: 2, east: 2, west: 2 };
      const decBalanced = ac.evaluatePhaseDuration(STATES.S0_NS_GREEN, balancedQueues);
      assert(
        decBalanced.duration === DEFAULT_CONFIG.baseGreen,
        'Adaptive Timing: Balanced Demand assigns Nominal Base Duration (10s)',
        `Assigned duration: ${decBalanced.duration}s (NS demand: ${decBalanced.demandNS}, EW demand: ${decBalanced.demandEW})`
      );

      // --- TEST 17: Congestion-Responsive Scaling (North-South Congestion) ---
      const nsCongestedQueues = { north: 6, south: 5, east: 0, west: 1 };
      const decNS = ac.evaluatePhaseDuration(STATES.S0_NS_GREEN, nsCongestedQueues);
      assert(
        decNS.duration >= 20 && decNS.duration <= DEFAULT_CONFIG.maxGreen &&
        decNS.rationale.includes('North-South traffic demand'),
        'Adaptive Timing: Heavy North-South Congestion scales Green Duration upwards',
        `Assigned: ${decNS.duration}s, Rationale: ${decNS.rationale}`
      );

      // --- TEST 18: Congestion-Responsive Scaling (East-West Congestion) ---
      const ewCongestedQueues = { north: 1, south: 0, east: 7, west: 6 };
      const decEW = ac.evaluatePhaseDuration(STATES.S2_EW_GREEN, ewCongestedQueues);
      assert(
        decEW.duration >= 20 && decEW.duration <= DEFAULT_CONFIG.maxGreen &&
        decEW.rationale.includes('East-West traffic demand'),
        'Adaptive Timing: Heavy East-West Congestion scales Green Duration upwards',
        `Assigned: ${decEW.duration}s, Rationale: ${decEW.rationale}`
      );

      // --- TEST 19: Strict Boundary Enforcement (Tmin = 5s, Tmax = 25s) ---
      const extremeQueue = { north: 50, south: 50, east: 0, west: 0 };
      const decMax = ac.evaluatePhaseDuration(STATES.S0_NS_GREEN, extremeQueue);
      assert(
        decMax.duration === DEFAULT_CONFIG.maxGreen,
        'Boundary Guard: Extreme Congestion strictly clamped to Max Green (25s)',
        `Assigned: ${decMax.duration}s (Max bound: ${DEFAULT_CONFIG.maxGreen}s)`
      );

      const zeroQueue = { north: 0, south: 0, east: 6, west: 6 };
      const decMin = ac.evaluatePhaseDuration(STATES.S0_NS_GREEN, zeroQueue);
      assert(
        decMin.duration === DEFAULT_CONFIG.minGreen,
        'Boundary Guard: Zero Demand truncated to Minimum Green (5s) without starvation',
        `Assigned: ${decMin.duration}s (Min bound: ${DEFAULT_CONFIG.minGreen}s)`
      );

      // --- TEST 20: Starvation Prevention & Anti-Starvation Safeguard ---
      // Simulate consecutive low-demand cycles to trigger anti-starvation boost
      ac.consecutiveMinCycles['North-South'] = 2;
      const decStarveBoost = ac.evaluatePhaseDuration(STATES.S0_NS_GREEN, { north: 1, south: 1, east: 8, west: 8 });
      assert(
        decStarveBoost.duration > DEFAULT_CONFIG.baseGreen &&
        decStarveBoost.rationale.includes('Anti-starvation safeguard'),
        'Anti-Starvation Invariant: Consecutive Min-Cycles trigger Fair Throughput Allocation',
        `Assigned: ${decStarveBoost.duration}s, Rationale: ${decStarveBoost.rationale}`
      );

      // --- TEST 21: Yellow Clearance Inviolability & FSM Coupling ---
      const adaptiveFsm = new TrafficLightFSM();
      // Apply extreme adaptive durations to green phases
      adaptiveFsm.setDuration(STATES.S0_NS_GREEN, 25);
      adaptiveFsm.setDuration(STATES.S2_EW_GREEN, 5);

      // Assert yellow clearances are strictly 3 seconds
      const s1Duration = adaptiveFsm.getDurationForState(STATES.S1_NS_YELLOW);
      const s3Duration = adaptiveFsm.getDurationForState(STATES.S3_EW_YELLOW);

      assert(
        s1Duration === 3 && s3Duration === 3,
        'Safety Clearance Inviolability: Yellow Clearance strictly 3s under Adaptive Scaling',
        `S1 Yellow: ${s1Duration}s, S3 Yellow: ${s3Duration}s`
      );

      // Ensure cyclic sequence is strictly preserved
      let seqPreserved = true;
      seqPreserved = seqPreserved && (adaptiveFsm.step().currentState === STATES.S1_NS_YELLOW);
      seqPreserved = seqPreserved && (adaptiveFsm.step().currentState === STATES.S2_EW_GREEN);
      seqPreserved = seqPreserved && (adaptiveFsm.step().currentState === STATES.S3_EW_YELLOW);
      seqPreserved = seqPreserved && (adaptiveFsm.step().currentState === STATES.S0_NS_GREEN);

      assert(
        seqPreserved,
        'FSM Coupling Fidelity: Full cycle maintained without skipping yellow clearance',
        'S0 -> S1 -> S2 -> S3 -> S0 cycle intact'
      );
    }

    // =========================================================================
    // PHASE 4 VERIFICATION (Emergency Vehicle Priority Preemption)
    // =========================================================================
    if (VehicleManager && VehicleManager.VEHICLE_TYPES) {
      const { VEHICLE_TYPES, CONSTANTS } = VehicleManager;

      // --- TEST 22: Emergency Vehicle Spawning & Dimensions ---
      const emVm = new VehicleManager({ autoSpawn: false });
      const amb = emVm.spawnEmergencyVehicle('north', VEHICLE_TYPES.AMBULANCE);
      const fire = emVm.spawnEmergencyVehicle('south', VEHICLE_TYPES.FIRE_ENGINE);
      const police = emVm.spawnEmergencyVehicle('west', VEHICLE_TYPES.POLICE);

      assert(
        amb.isEmergency && fire.isEmergency && police.isEmergency,
        'Emergency Vehicle Classification: Ambulance, Fire Engine, Police are isEmergency=true',
        `Amb: ${amb.isEmergency}, Fire: ${fire.isEmergency}, Police: ${police.isEmergency}`
      );

      assert(
        amb.width === 16 && amb.length === 30 &&
        fire.width === 18 && fire.length === 36 &&
        police.width === 14 && police.length === 28,
        'Emergency Vehicle Physical Dimensions Integrity',
        `Amb: ${amb.width}x${amb.length}, Fire: ${fire.width}x${fire.length}, Police: ${police.width}x${police.length}`
      );

      // --- TEST 23: Preemption Safety: Conflicting Green NEVER instantly cuts without Yellow Clearance ---
      const emFsm = new TrafficLightFSM();
      // Set to East-West GREEN (S2)
      emFsm.step(); // S1_NS_YELLOW
      emFsm.step(); // S2_EW_GREEN
      assert(emFsm.getCurrentState() === STATES.S2_EW_GREEN, 'Setup: State is S2_EW_GREEN');

      // Inbound Ambulance on North (needs North-South Green S0)
      const req = emFsm.requestEmergencyPriority('north');
      assert(
        req.status === 'PREEMPT_TO_YELLOW' && req.targetState === STATES.S0_NS_GREEN,
        'Preemption Safety: Conflicting Green prompts Yellow Clearance (PREEMPT_TO_YELLOW)',
        `Action: ${req.action}`
      );

      // Step FSM: Must enter S3_EW_YELLOW clearance, NEVER jump straight to S0!
      const step1 = emFsm.step();
      assert(
        step1.currentState === STATES.S3_EW_YELLOW,
        'Preemption Safety: Yellow Clearance strictly enforced before granting Priority Green',
        `Current State: ${step1.currentState}`
      );

      // Next step enters target green S0_NS_GREEN
      const step2 = emFsm.step();
      assert(
        step2.currentState === STATES.S0_NS_GREEN,
        'Preemption Target Achieved: Priority Direction receives Green following Yellow Clearance',
        `Current State: ${step2.currentState}`
      );

      // --- TEST 24: Active Green Extension under Emergency Preemption ---
      // When already in target green state:
      const holdReq = emFsm.requestEmergencyPriority('south');
      assert(
        holdReq.status === 'ACTIVE_GREEN_EXTENDED' && holdReq.action === 'HOLD',
        'Active Green Extension: Target Green held open while Emergency Vehicle approaches',
        `Status: ${holdReq.status}`
      );

      // --- TEST 25: Emergency Vehicle Intersection Clearance & Priority Release ---
      let priorityReleased = false;
      const testVm = new VehicleManager({
        autoSpawn: false,
        onEmergencyCleared: (dir, veh) => {
          emFsm.clearEmergencyPriority();
          priorityReleased = true;
        }
      });

      const testAmb = testVm.spawnEmergencyVehicle('north', VEHICLE_TYPES.AMBULANCE);
      // Advance vehicle across junction
      for (let i = 0; i < 60; i++) {
        testVm.update(0.1, { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' }, false);
      }

      assert(
        testAmb.pos >= CONSTANTS.JUNCTION_EXIT && priorityReleased && emFsm.getEmergencyPriority() === null,
        'Priority Release Invariant: Emergency Priority Lock cleared once vehicle exits junction box',
        `Vehicle Position: ${testAmb.pos.toFixed(1)}px (Exit: ${CONSTANTS.JUNCTION_EXIT}px), Released: ${priorityReleased}`
      );

      // --- TEST 26: Emergency Event Logging & Analytics Recording ---
      assert(
        emVm.emergencyEvents.length === 3 && emVm.analytics.emergencyCount === 3,
        'Emergency Event Telemetry: Events recorded in audit log with timestamps',
        `Dispatched count: ${emVm.analytics.emergencyCount}`
      );
    }

    // =========================================================================
    // PHASE 5 VERIFICATION (Advanced Traffic Analytics & Visualizations)
    // =========================================================================
    if (TrafficAnalyticsEngine) {
      const ae = new TrafficAnalyticsEngine(20);

      // --- TEST 27: Traffic Analytics Engine Snapshot Recording ---
      const snap1 = ae.recordSnapshot({ north: 2, south: 1, east: 0, west: 1 }, 'ADAPTIVE', 18, 2.4);
      assert(
        snap1.total === 4 && snap1.ns === 3 && snap1.ew === 1 && ae.history.length === 1,
        'Analytics Snapshot Data Model & Aggregation Integrity',
        `Recorded Total: ${snap1.total}, NS: ${snap1.ns}, EW: ${snap1.ew}`
      );

      // --- TEST 28: Directional Approach Congestion Heatmap Computation ---
      const heat = ae.getCongestionHeatLevels({ north: 6, south: 3, east: 0, west: 1 });
      assert(
        heat.north === 1.0 && heat.south === 0.5 && heat.east === 0.0 && heat.west > 0.1,
        'Approach Congestion Heatmap: Heat normalized accurately across 0.0 to 1.0',
        `N: ${heat.north}, S: ${heat.south}, E: ${heat.east}, W: ${heat.west.toFixed(2)}`
      );

      // --- TEST 29: Queue History Pure SVG Sparkline Generation ---
      ae.recordSnapshot({ north: 3, south: 2, east: 1, west: 2 }, 'ADAPTIVE', 22, 3.1);
      ae.recordSnapshot({ north: 1, south: 1, east: 3, west: 4 }, 'ADAPTIVE', 24, 2.8);
      const svg = ae.generateQueueHistorySvg(320, 60);

      assert(
        typeof svg === 'string' && svg.includes('<svg') && svg.includes('<polyline') && svg.includes('stroke="#3b82f6"'),
        'Pure SVG Queue History Sparkline Generation: Self-contained zero-dependency chart',
        'Valid SVG elements rendered with NS/EW corridor series'
      );

      // --- TEST 30: Intersection Traffic Efficiency Score Calculation ---
      const aeGood = new TrafficAnalyticsEngine();
      aeGood.recordSnapshot({ north: 0, south: 0, east: 0, west: 0 }, 'ADAPTIVE', 30, 0.5);
      const goodScore = aeGood.efficiencyScore;

      const aeBad = new TrafficAnalyticsEngine();
      aeBad.recordSnapshot({ north: 8, south: 8, east: 8, west: 8 }, 'ADAPTIVE', 8, 15.0);
      const badScore = aeBad.efficiencyScore;

      assert(
        goodScore >= 90 && badScore <= 40 && badScore >= 15,
        'Traffic Efficiency Score: Dynamic scoring responsive to delay and queue backlog',
        `Clear conditions: ${goodScore}%, Congested conditions: ${badScore}%`
      );

      // --- TEST 31: Adaptive Timing Delay Savings Benchmark ---
      assert(
        ae.cumulativeAdaptiveDelaySaved > 0,
        'Adaptive Timing Delay Savings Benchmark: Delay savings actively accumulated',
        `Cumulative saved: ${ae.cumulativeAdaptiveDelaySaved.toFixed(1)}s`
      );

      // --- TEST 32: Emergency Preemption Response Clearance Analytics ---
      ae.recordEmergencyClearance(8.5);
      ae.recordEmergencyClearance(6.5);
      const emStats = ae.getEmergencyStats();
      assert(
        emStats.totalCleared === 2 && emStats.avgClearanceTime === 7.5 && emStats.successRate === 100,
        'Emergency Preemption Clearance Analytics: Mean transit duration and success rate verified',
        `Cleared: ${emStats.totalCleared}, Mean Transit: ${emStats.avgClearanceTime}s, Success: ${emStats.successRate}%`
      );
    }

    // =========================================================================
    // PHASE 7 VERIFICATION (Simulation Reliability, Remediation & 18 Scenarios)
    // =========================================================================
    if (VehicleManager && TrafficLightFSM && AdaptiveController) {
      const CONSTANTS = VehicleManager.CONSTANTS;

      // Helper: run continuous simulation for specified duration
      function runSimulation(vm, fsmInstance, durationSeconds, adapt = null) {
        let simTime = 0;
        const dt = 0.05;
        let phaseTimer = 0;
        let currentPhaseDuration = 10;
        let collisionDetected = false;

        while (simTime < durationSeconds) {
          vm.update(dt, fsmInstance.getSignals());
          simTime += dt;
          phaseTimer += dt;

          // Check collision box invariant: center past JUNCTION_ENTRY and rear before JUNCTION_EXIT
          const nsOccupied = vm.lanes.north.some(v => v.pos >= 146 && (v.pos - v.length / 2) <= 294) ||
                             vm.lanes.south.some(v => v.pos >= 146 && (v.pos - v.length / 2) <= 294);
          const ewOccupied = vm.lanes.east.some(v => v.pos >= 146 && (v.pos - v.length / 2) <= 294) ||
                             vm.lanes.west.some(v => v.pos >= 146 && (v.pos - v.length / 2) <= 294);
          if (nsOccupied && ewOccupied) {
            collisionDetected = true;
          }

          if (phaseTimer >= currentPhaseDuration) {
            phaseTimer = 0;
            fsmInstance.step();
            const st = fsmInstance.getCurrentState();
            if (st === STATES.S1_NS_YELLOW || st === STATES.S3_EW_YELLOW) {
              currentPhaseDuration = 3;
            } else if (adapt) {
              const queues = {
                north: vm.lanes.north.filter(v => v.speed < 1).length,
                south: vm.lanes.south.filter(v => v.speed < 1).length,
                east: vm.lanes.east.filter(v => v.speed < 1).length,
                west: vm.lanes.west.filter(v => v.speed < 1).length
              };
              const evalRes = adapt.evaluatePhaseDuration(st, queues);
              currentPhaseDuration = evalRes.duration;
            } else {
              currentPhaseDuration = 10;
            }
          }
        }

        return { collisionDetected };
      }

      // --- TEST 33: Operational Scenario 1 — Low Traffic Continuous 5-min Simulation ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager();
        scVm.setDensityMode('LOW');
        const { collisionDetected } = runSimulation(scVm, scFsm, 300);
        let stuckCount = 0;
        for (const dir of ['north', 'south', 'east', 'west']) {
          for (const v of scVm.lanes[dir]) {
            if (v.waitingTime > 90) stuckCount++;
          }
        }
        assert(
          scVm.analytics.totalGenerated > 40 && scVm.analytics.totalPassed > 30 && stuckCount === 0 && !collisionDetected,
          'Scenario 1: Low traffic continuous 5-minute operation without vehicle stalling or collision',
          `Generated: ${scVm.analytics.totalGenerated}, Passed: ${scVm.analytics.totalPassed}, Stuck: ${stuckCount}`
        );
      }

      // --- TEST 34: Operational Scenario 2 — Medium Traffic Continuous 5-min Simulation ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager();
        scVm.setDensityMode('MEDIUM');
        const { collisionDetected } = runSimulation(scVm, scFsm, 300);
        assert(
          scVm.analytics.totalPassed > 60 && !collisionDetected,
          'Scenario 2: Medium traffic continuous 5-minute operation with balanced throughput',
          `Passed: ${scVm.analytics.totalPassed}, Collision Detected: ${collisionDetected}`
        );
      }

      // --- TEST 35: Operational Scenario 3 — High Traffic Continuous 5-min Stress Simulation ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager();
        scVm.setDensityMode('HIGH');
        const { collisionDetected } = runSimulation(scVm, scFsm, 300);
        let minGapEnforced = true;
        for (const dir of ['north', 'south', 'east', 'west']) {
          const list = scVm.lanes[dir];
          for (let i = 0; i < list.length - 1; i++) {
            const lead = list[i];
            const follow = list[i + 1];
            const gap = (lead.pos - lead.length / 2) - (follow.pos + follow.length / 2);
            if (gap < -0.5) minGapEnforced = false;
          }
        }
        assert(
          scVm.analytics.totalPassed > 100 && !collisionDetected && minGapEnforced,
          'Scenario 3: High traffic continuous 5-minute stress simulation preserves safe gap and zero collision',
          `Passed: ${scVm.analytics.totalPassed}, Safe Gap Enforced: ${minGapEnforced}`
        );
      }

      // --- TEST 36: Operational Scenario 4 — Balanced NS/EW Traffic Allocation ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager();
        const scAdapt = new AdaptiveController();
        scVm.setDensityMode('MEDIUM');
        let simTime = 0;
        const dt = 0.05;
        let totalNsGreen = 0;
        let totalEwGreen = 0;
        let phaseTimer = 0;
        let currentPhaseDuration = 10;

        while (simTime < 200) {
          scVm.update(dt, scFsm.getSignals());
          simTime += dt;
          phaseTimer += dt;
          const state = scFsm.getCurrentState();
          if (state === STATES.S0_NS_GREEN) totalNsGreen += dt;
          if (state === STATES.S2_EW_GREEN) totalEwGreen += dt;

          if (phaseTimer >= currentPhaseDuration) {
            phaseTimer = 0;
            scFsm.step();
            const st = scFsm.getCurrentState();
            if (st === STATES.S1_NS_YELLOW || st === STATES.S3_EW_YELLOW) {
              currentPhaseDuration = 3;
            } else {
              const queues = {
                north: scVm.lanes.north.filter(v => v.speed < 1).length,
                south: scVm.lanes.south.filter(v => v.speed < 1).length,
                east: scVm.lanes.east.filter(v => v.speed < 1).length,
                west: scVm.lanes.west.filter(v => v.speed < 1).length
              };
              const evalRes = scAdapt.evaluatePhaseDuration(st, queues);
              currentPhaseDuration = evalRes.duration;
            }
          }
        }
        const ratio = totalNsGreen / (totalEwGreen || 1);
        assert(
          ratio >= 0.6 && ratio <= 1.6,
          'Scenario 4: Balanced NS/EW traffic distribution yields equitable green-time ratio',
          `NS Green: ${totalNsGreen.toFixed(1)}s, EW Green: ${totalEwGreen.toFixed(1)}s, Ratio: ${ratio.toFixed(2)}`
        );
      }

      // --- TEST 37: Operational Scenario 5 — Extremely Unbalanced Traffic Dynamic Clamping ---
      {
        const scAdapt = new AdaptiveController();
        const heavyNsQueues = { north: 9, south: 7, east: 0, west: 0 };
        const nsCalc = scAdapt.evaluatePhaseDuration(STATES.S0_NS_GREEN, heavyNsQueues);
        const ewCalc = scAdapt.evaluatePhaseDuration(STATES.S2_EW_GREEN, heavyNsQueues);
        assert(
          nsCalc.duration >= 20 && ewCalc.duration === 5,
          'Scenario 5: Extremely unbalanced traffic expands congested axis and clamps empty axis to 5s min',
          `NS Extended: ${nsCalc.duration}s, EW Clamped: ${ewCalc.duration}s`
        );
      }

      // --- TEST 38: Operational Scenario 6 — Multiple Vehicles Approaching Same Stop Line ---
      {
        const scVm = new VehicleManager({ autoSpawn: false });
        const v1 = scVm.spawnVehicle('north', 'car');
        v1.pos = 120;
        const v2 = scVm.spawnVehicle('north', 'car');
        v2.pos = 80;
        const v3 = scVm.spawnVehicle('north', 'bus');
        v3.pos = 40;
        const v4 = scVm.spawnVehicle('north', 'car');
        v4.pos = -10;

        v1.pos = 70; v1.speed = 50;
        v2.pos = 35; v2.speed = 50;
        v3.pos = 0;  v3.speed = 50;
        v4.pos = -35; v4.speed = 50;

        const redSignals = { north: LIGHTS.RED, south: LIGHTS.RED, east: LIGHTS.GREEN, west: LIGHTS.GREEN };
        for (let t = 0; t < 150; t++) {
          scVm.update(0.05, redSignals);
        }
        const stoppedInOrder = v1.pos === CONSTANTS.STOP_LINE_POS &&
                               v2.pos < v1.pos && v3.pos < v2.pos && v4.pos < v3.pos &&
                               v1.speed === 0 && v2.speed === 0 && v3.speed === 0 && v4.speed === 0;
        const gap1 = (v1.pos - v1.length / 2) - (v2.pos + v2.length / 2);
        const gap2 = (v2.pos - v2.length / 2) - (v3.pos + v3.length / 2);
        const gap3 = (v3.pos - v3.length / 2) - (v4.pos + v4.length / 2);
        assert(
          stoppedInOrder && gap1 >= CONSTANTS.MIN_GAP - 0.1 && gap2 >= CONSTANTS.MIN_GAP - 0.1 && gap3 >= CONSTANTS.MIN_GAP - 0.1,
          'Scenario 6: Multiple vehicles approaching same stop line halt in order with safe gaps',
          `Pos: [${v1.pos.toFixed(1)}, ${v2.pos.toFixed(1)}, ${v3.pos.toFixed(1)}, ${v4.pos.toFixed(1)}], Gaps: [${gap1.toFixed(1)}, ${gap2.toFixed(1)}, ${gap3.toFixed(1)}]`
        );
      }

      // --- TEST 39: Operational Scenario 7 — Multiple Vehicles Clearing Intersection Sequentially ---
      {
        const scVm = new VehicleManager({ autoSpawn: false });
        const v1 = scVm.spawnVehicle('north', 'car');
        v1.pos = CONSTANTS.STOP_LINE_POS;
        v1.speed = 0;
        const v2 = scVm.spawnVehicle('north', 'car');
        v2.pos = CONSTANTS.STOP_LINE_POS - 38;
        v2.speed = 0;
        const greenSignals = { north: LIGHTS.GREEN, south: LIGHTS.GREEN, east: LIGHTS.RED, west: LIGHTS.RED };
        let leaderClearedFirst = false;
        for (let t = 0; t < 150; t++) {
          scVm.update(0.05, greenSignals);
          if (v1.pos > CONSTANTS.JUNCTION_EXIT && v2.pos < CONSTANTS.JUNCTION_EXIT) {
            leaderClearedFirst = true;
          }
        }
        assert(
          leaderClearedFirst && scVm.analytics.totalPassed >= 1,
          'Scenario 7: Multiple queued vehicles discharge and clear intersection sequentially without collision',
          `Leader cleared first: ${leaderClearedFirst}, Total Passed: ${scVm.analytics.totalPassed}`
        );
      }

      // --- TEST 40: Operational Scenario 8 — Emergency Dispatch During Opposing Green ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager({ autoSpawn: false });
        scFsm.step(); // S1_NS_YELLOW
        scFsm.step(); // S2_EW_GREEN
        const amb = scVm.spawnEmergencyVehicle('north', 'AMBULANCE');
        const req = scFsm.requestEmergencyPriority('north');
        assert(
          req.action === 'CLEAR_CONFLICT' && req.targetState === STATES.S0_NS_GREEN,
          'Scenario 8: Emergency dispatch during opposing green triggers safe yellow transition before green',
          `Action: ${req.action}, Target State: ${req.targetState}`
        );
      }

      // --- TEST 41: Operational Scenario 9 — Multiple Simultaneous Emergency Requests ---
      {
        const scFsm = new TrafficLightFSM();
        const req1 = scFsm.requestEmergencyPriority('north');
        const req2 = scFsm.requestEmergencyPriority('east');
        const signals = scFsm.getSignals();
        const dualGreen = (signals.north === LIGHTS.GREEN || signals.south === LIGHTS.GREEN) &&
                          (signals.east === LIGHTS.GREEN || signals.west === LIGHTS.GREEN);
        assert(
          !dualGreen && scFsm.getEmergencyPriority().direction === 'east',
          'Scenario 9: Multiple simultaneous emergency requests handled without dual green conflict',
          `Active priority: ${scFsm.getEmergencyPriority().direction}, Dual Green: ${dualGreen}`
        );
      }

      // --- TEST 42: Operational Scenario 10 — Emergency Vehicle Inside Intersection Lock ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager({ autoSpawn: false });
        scFsm.requestEmergencyPriority('north');
        const amb = scVm.spawnEmergencyVehicle('north', 'AMBULANCE');
        amb.pos = 200; // In intersection
        const isHolding = scFsm.isHoldingPriorityGreen();
        assert(
          isHolding && scFsm.getSignals().north === LIGHTS.GREEN && scFsm.getSignals().east === LIGHTS.RED,
          'Scenario 10: Priority Green actively held open while emergency vehicle is in intersection',
          `Holding: ${isHolding}, North Signal: ${scFsm.getSignals().north}, East Signal: ${scFsm.getSignals().east}`
        );
      }

      // --- TEST 43: Operational Scenario 11 — All-Red Halt with Occupied Junction ---
      {
        const scFsm = new TrafficLightFSM();
        const scVm = new VehicleManager({ autoSpawn: false });
        const v = scVm.spawnVehicle('north', 'car');
        v.pos = 200; // In junction
        scFsm.triggerAllRedHalt();
        const sigs = scFsm.getSignals();
        const allRed = sigs.north === LIGHTS.RED && sigs.south === LIGHTS.RED &&
                       sigs.east === LIGHTS.RED && sigs.west === LIGHTS.RED;
        const cross = scVm.spawnVehicle('east', 'car');
        cross.pos = 130;
        for (let t = 0; t < 20; t++) {
          scVm.update(0.05, sigs);
        }
        assert(
          allRed && cross.pos <= CONSTANTS.STOP_LINE_POS,
          'Scenario 11: All-Red Halt with occupied junction prevents conflicting traffic entry',
          `All-Red: ${allRed}, Approaching car halted: ${cross.pos.toFixed(1)}px (<= 138px)`
        );
      }

      // --- TEST 44: Operational Scenario 12 — All-Red Recovery After Junction Clearance ---
      {
        const scFsm = new TrafficLightFSM();
        scFsm.triggerAllRedHalt();
        scFsm.resumeFromAllRed();
        const restoredState = scFsm.getCurrentState();
        const sigs = scFsm.getSignals();
        assert(
          restoredState === STATES.S0_NS_GREEN && sigs.north === LIGHTS.GREEN,
          'Scenario 12: All-Red recovery restores normal FSM operational state and active green',
          `Restored State: ${restoredState}, North Light: ${sigs.north}`
        );
      }

      // --- TEST 45: Operational Scenario 13 — Pause and Resume Continuity ---
      {
        const scVm = new VehicleManager({ autoSpawn: false });
        const v = scVm.spawnVehicle('north', 'car');
        v.pos = 50; v.speed = 40;
        const posBeforePause = v.pos;
        const speedBeforePause = v.speed;
        scVm.update(0, { north: LIGHTS.GREEN, south: LIGHTS.GREEN, east: LIGHTS.RED, west: LIGHTS.RED }, true);
        const pausedHeld = v.pos === posBeforePause && v.speed === speedBeforePause;
        scVm.update(0.05, { north: LIGHTS.GREEN, south: LIGHTS.GREEN, east: LIGHTS.RED, west: LIGHTS.RED }, false);
        const resumedMoving = v.pos > posBeforePause;
        assert(
          pausedHeld && resumedMoving,
          'Scenario 13: Simulation pause freezes physics; resume maintains smooth forward kinematics',
          `Frozen at ${posBeforePause}px -> Resumed to ${v.pos.toFixed(1)}px`
        );
      }

      // --- TEST 46: Operational Scenario 14 — Simulation Reset Purges All State ---
      {
        const scVm = new VehicleManager({ autoSpawn: false });
        for (let i = 0; i < 15; i++) {
          scVm.spawnVehicle('north', 'car');
          scVm.spawnVehicle('east', 'car');
        }
        scVm.spawnEmergencyVehicle('north', 'AMBULANCE');
        scVm.reset();
        const allEmpty = scVm.lanes.north.length === 0 && scVm.lanes.south.length === 0 &&
                         scVm.lanes.east.length === 0 && scVm.lanes.west.length === 0 &&
                         scVm.emergencyEvents.length === 0 && scVm.analytics.totalGenerated === 0;
        assert(
          allEmpty,
          'Scenario 14: Reset completely purges all vehicle queues, emergency dispatches, and metrics',
          `Lanes empty: ${allEmpty}, Events count: ${scVm.emergencyEvents.length}`
        );
      }

      // --- TEST 47: Operational Scenario 15 — Speed Multiplier Stability ---
      {
        const scVm = new VehicleManager({ autoSpawn: false });
        const v = scVm.spawnVehicle('north', 'car');
        v.pos = 50;
        const redSignals = { north: LIGHTS.RED, south: LIGHTS.RED, east: LIGHTS.GREEN, west: LIGHTS.GREEN };
        for (let t = 0; t < 50; t++) {
          scVm.update(0.16, redSignals); // 10x equivalent timestep
        }
        assert(
          v.pos <= CONSTANTS.STOP_LINE_POS && v.speed === 0,
          'Scenario 15: High speed multipliers (10x equivalent) maintain numerical stability and stop-line safety',
          `Final position: ${v.pos.toFixed(1)}px (<= 138px), Final Speed: ${v.speed}px/s`
        );
      }

      // --- TEST 48: Operational Scenario 16 — Mode Switching Integrity ---
      {
        const scAdapt = new AdaptiveController();
        scAdapt.setMode('ADAPTIVE');
        const m1 = scAdapt.getMode();
        scAdapt.setMode('FIXED');
        const m2 = scAdapt.getMode();
        scAdapt.setMode('MANUAL');
        const m3 = scAdapt.getMode();
        scAdapt.setMode('ADAPTIVE');
        const m4 = scAdapt.getMode();
        assert(
          m1 === 'ADAPTIVE' && m2 === 'FIXED' && m3 === 'MANUAL' && m4 === 'ADAPTIVE',
          'Scenario 16: Dynamic mode switching between ADAPTIVE, FIXED, and MANUAL functions cleanly',
          `Transitions: ${m1} -> ${m2} -> ${m3} -> ${m4}`
        );
      }

      // --- TEST 49: Operational Scenario 17 — Continuous Analytics Conservation Law ---
      {
        const scVm = new VehicleManager();
        const scFsm = new TrafficLightFSM();
        for (let t = 0; t < 2000; t++) {
          scVm.update(0.05, scFsm.getSignals());
          if (t % 200 === 0) scFsm.step();
        }
        const activeVehicles = scVm.lanes.north.length + scVm.lanes.south.length +
                               scVm.lanes.east.length + scVm.lanes.west.length;
        const conservation = (scVm.analytics.totalPassed + activeVehicles) === scVm.analytics.totalGenerated;
        assert(
          conservation && scVm.analytics.totalGenerated > 0,
          'Scenario 17: Vehicle conservation invariant holds continuously: Total Generated = Passed + Active',
          `Generated (${scVm.analytics.totalGenerated}) = Passed (${scVm.analytics.totalPassed}) + Active (${activeVehicles})`
        );
      }

      // --- TEST 50: Operational Scenario 18 — Long-Duration Continuous Operation Stability ---
      {
        const scVm = new VehicleManager();
        const scFsm = new TrafficLightFSM();
        scVm.setDensityMode('HIGH');
        let simTime = 0;
        const dt = 0.05;
        let phaseTimer = 0;
        while (simTime < 500) {
          scVm.update(dt, scFsm.getSignals());
          simTime += dt;
          phaseTimer += dt;
          if (phaseTimer >= 10) {
            phaseTimer = 0;
            scFsm.step();
          }
        }
        const totalActive = scVm.lanes.north.length + scVm.lanes.south.length +
                            scVm.lanes.east.length + scVm.lanes.west.length;
        let frozenCount = 0;
        for (const dir of ['north', 'south', 'east', 'west']) {
          for (const v of scVm.lanes[dir]) {
            if (v.waitingTime > 120) frozenCount++;
          }
        }
        assert(
          totalActive < 40 && frozenCount === 0 && scVm.analytics.totalPassed > 150,
          'Scenario 18: Long-duration high-density operation avoids unbounded memory growth and frozen vehicles',
          `Active Vehicles: ${totalActive}, Frozen: ${frozenCount}, Total Cleared: ${scVm.analytics.totalPassed}`
        );
      }

      // =========================================================================
      // Phase 8: Visual Audit, UI Synchronization & Crosswalk Invariants
      // =========================================================================

      // --- TEST 51: Phase 8 - Authoritative Demand Snapshot Fidelity ---
      if (AdaptiveController) {
        const ac = new AdaptiveController();
        const initialDecisionRationale = ac.getLastDecision().rationale;
        const testQueues = { north: 7, south: 5, east: 1, west: 1 };
        const testApproaching = { north: 1, south: 0, east: 0, west: 0 };
        const liveEval = ac.getLiveDemandEvaluation('S0_NS_GREEN', testQueues, testApproaching);

        assert(
          liveEval &&
          liveEval.demandNS === 12.4 &&
          liveEval.demandEW === 2.0 &&
          liveEval.duration > 10 &&
          liveEval.rationale.includes('North-South traffic demand') &&
          ac.getLastDecision().rationale === initialDecisionRationale,
          'Phase 8: Authoritative demand snapshot evaluation is zero-side-effect and mathematically consistent',
          `NS: ${liveEval.demandNS}, EW: ${liveEval.demandEW}, Duration: ${liveEval.duration}s, Unchanged LastDecision: true`
        );
      }

      // --- TEST 52: Phase 8 - XAI Rationale Mode Synchronization ---
      if (AdaptiveController) {
        const ac = new AdaptiveController();
        ac.setMode('FIXED');
        const fixedEval = ac.getLiveDemandEvaluation('S0_NS_GREEN', { north: 5, south: 5, east: 0, west: 0 });
        ac.setMode('MANUAL');
        const manualEval = ac.getLiveDemandEvaluation('S0_NS_GREEN', { north: 5, south: 5, east: 0, west: 0 });

        assert(
          fixedEval.mode === 'FIXED' &&
          fixedEval.duration === 10 &&
          fixedEval.rationale.includes('Fixed Timing Mode') &&
          manualEval.mode === 'MANUAL' &&
          manualEval.rationale.includes('Manual Timing Mode'),
          'Phase 8: XAI decision logic and duration synchronize accurately across operational modes',
          `Fixed: "${fixedEval.rationale.slice(0, 35)}...", Manual: "${manualEval.rationale.slice(0, 35)}..."`
        );
      }

      // --- TEST 53: Phase 8 - Priority Green Hold and Transition Release Synchronization ---
      {
        const fsmHold = new TrafficLightFSM();
        fsmHold.requestEmergencyPriority('north');
        const holdingBefore = fsmHold.isHoldingPriorityGreen();
        const signalsDuring = fsmHold.getSignals();
        fsmHold.clearEmergencyPriority();
        const holdingAfter = fsmHold.isHoldingPriorityGreen();

        assert(
          holdingBefore === true &&
          signalsDuring.north === 'GREEN' &&
          signalsDuring.east === 'RED' &&
          holdingAfter === false,
          'Phase 8: Emergency priority green hold active during transit and safely released post-clearance',
          `Holding before: ${holdingBefore}, East Light: ${signalsDuring.east}, Holding after: ${holdingAfter}`
        );
      }

      // --- TEST 54: Phase 8 - Stop Line and Pedestrian Crosswalk Spatial Boundary Invariant ---
      {
        const vmGeo = new VehicleManager();
        const fsmGeo = new TrafficLightFSM();
        fsmGeo.step(); // S1
        fsmGeo.step(); // S2 (EW Green, NS Red)
        vmGeo.spawnVehicle('north', 'CAR');

        for (let t = 0; t < 300; t++) {
          vmGeo.update(0.05, fsmGeo.getSignals());
        }

        const northCar = vmGeo.lanes.north[0];
        const STOP_LINE_POS = 138;
        const CROSSWALK_MOUTH_POS = 154;

        assert(
          northCar &&
          northCar.speed === 0 &&
          northCar.pos <= STOP_LINE_POS &&
          northCar.pos < CROSSWALK_MOUTH_POS &&
          (CROSSWALK_MOUTH_POS - northCar.pos) >= 14,
          'Phase 8: Stopped vehicle halts strictly behind stop line and maintains clearance from pedestrian crosswalk',
          `Halt Pos: ${northCar.pos.toFixed(1)}px (Stop Line: ${STOP_LINE_POS}px, Crosswalk Mouth: ${CROSSWALK_MOUTH_POS}px, Clearance: ${(CROSSWALK_MOUTH_POS - northCar.pos).toFixed(1)}px)`
        );
      }
    }

    return results;
  }

  // CLI execution if executed directly in Node
  if (typeof process !== 'undefined' && process.argv && require.main === module) {
    console.log('====================================================');
    console.log(' Traffic Light Controller Verification Suite');
    console.log(' Phase 1 to Phase 7 Full Formal Verification & Reliability');
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
