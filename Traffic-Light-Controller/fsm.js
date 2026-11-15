/**
 * Finite State Machine (FSM) for 4-Way Traffic Light Controller
 *
 * State Definitions:
 * - S0_NS_GREEN : North/South = GREEN, East/West = RED
 * - S1_NS_YELLOW: North/South = YELLOW, East/West = RED
 * - S2_EW_GREEN : East/West = GREEN, North/South = RED
 * - S3_EW_YELLOW: East/West = YELLOW, North/South = RED
 *
 * Safety Invariant:
 * Conflicting directions (North-South vs East-West) MUST NEVER receive
 * green (or active clearance) simultaneously.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TrafficFSM = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIGHTS = Object.freeze({
    RED: 'RED',
    YELLOW: 'YELLOW',
    GREEN: 'GREEN'
  });

  const STATES = Object.freeze({
    S0_NS_GREEN: 'S0_NS_GREEN',
    S1_NS_YELLOW: 'S1_NS_YELLOW',
    S2_EW_GREEN: 'S2_EW_GREEN',
    S3_EW_YELLOW: 'S3_EW_YELLOW'
  });

  const STATE_ORDER = [
    STATES.S0_NS_GREEN,
    STATES.S1_NS_YELLOW,
    STATES.S2_EW_GREEN,
    STATES.S3_EW_YELLOW
  ];

  const DEFAULT_DURATIONS = Object.freeze({
    [STATES.S0_NS_GREEN]: 10,
    [STATES.S1_NS_YELLOW]: 3,
    [STATES.S2_EW_GREEN]: 10,
    [STATES.S3_EW_YELLOW]: 3
  });

  const STATE_METADATA = Object.freeze({
    [STATES.S0_NS_GREEN]: {
      id: 0,
      code: 'S0',
      title: 'NS GREEN / EW RED',
      axisActive: 'North-South',
      northSouth: LIGHTS.GREEN,
      eastWest: LIGHTS.RED,
      nextState: STATES.S1_NS_YELLOW,
      description: 'North and South corridors flow. East and West corridors hold at red.'
    },
    [STATES.S1_NS_YELLOW]: {
      id: 1,
      code: 'S1',
      title: 'NS YELLOW / EW RED',
      axisActive: 'North-South (Clearance)',
      northSouth: LIGHTS.YELLOW,
      eastWest: LIGHTS.RED,
      nextState: STATES.S2_EW_GREEN,
      description: 'North and South traffic prepares to stop. East and West corridors hold at red.'
    },
    [STATES.S2_EW_GREEN]: {
      id: 2,
      code: 'S2',
      title: 'EW GREEN / NS RED',
      axisActive: 'East-West',
      northSouth: LIGHTS.RED,
      eastWest: LIGHTS.GREEN,
      nextState: STATES.S3_EW_YELLOW,
      description: 'East and West corridors flow. North and South corridors hold at red.'
    },
    [STATES.S3_EW_YELLOW]: {
      id: 3,
      code: 'S3',
      title: 'EW YELLOW / NS RED',
      axisActive: 'East-West (Clearance)',
      northSouth: LIGHTS.RED,
      eastWest: LIGHTS.YELLOW,
      nextState: STATES.S0_NS_GREEN,
      description: 'East and West traffic prepares to stop. North and South corridors hold at red.'
    }
  });

  class TrafficLightFSM {
    /**
     * @param {Object} [customDurations] Optional duration overrides in seconds
     */
    constructor(customDurations = {}) {
      this.durations = { ...DEFAULT_DURATIONS, ...customDurations };
      this.currentState = STATES.S0_NS_GREEN;
      this.transitionCount = 0;
      this.history = [];
      this.maxHistoryLength = 50;
      this.lastSafetyCheck = null;

      // Verify initial state integrity
      this.validateSafety();
    }

    /**
     * Check safety invariants:
     * 1. North/South GREEN or YELLOW cannot coincide with East/West GREEN or YELLOW.
     * 2. Conflicting directions never receive green simultaneously.
     * @param {Object} [signals] Optional signals to test; defaults to current state.
     * @returns {Object} { isSafe: boolean, reason: string }
     */
    validateSafety(signals = null) {
      const currentSignals = signals || this.getSignals();
      const { north, south, east, west } = currentSignals;

      const nsGreen = north === LIGHTS.GREEN || south === LIGHTS.GREEN;
      const ewGreen = east === LIGHTS.GREEN || west === LIGHTS.GREEN;
      const nsActive = nsGreen || north === LIGHTS.YELLOW || south === LIGHTS.YELLOW;
      const ewActive = ewGreen || east === LIGHTS.YELLOW || west === LIGHTS.YELLOW;

      // Primary requirement: Conflicting directions never receive green simultaneously
      if (nsGreen && ewGreen) {
        const failure = {
          isSafe: false,
          code: 'ERR_DUAL_GREEN',
          reason: 'CRITICAL HAZARD: North-South and East-West directions have GREEN simultaneously!'
        };
        this.lastSafetyCheck = failure;
        return failure;
      }

      // Secondary clearance invariant: An active direction cannot overlap with another active direction
      if (nsActive && ewActive) {
        const failure = {
          isSafe: false,
          code: 'ERR_DUAL_ACTIVE',
          reason: 'CRITICAL HAZARD: Both corridors have active clearance (Green/Yellow) concurrently!'
        };
        this.lastSafetyCheck = failure;
        return failure;
      }

      const pass = {
        isSafe: true,
        code: 'SAFE',
        reason: 'Invariant verified: Conflicting directions are strictly isolated.'
      };
      this.lastSafetyCheck = pass;
      return pass;
    }

    /**
     * Return light status for each of the four directions
     * @returns {{ north: string, south: string, east: string, west: string }}
     */
    getSignals() {
      const meta = STATE_METADATA[this.currentState];
      return {
        north: meta.northSouth,
        south: meta.northSouth,
        east: meta.eastWest,
        west: meta.eastWest
      };
    }

    /**
     * Get current state key
     * @returns {string}
     */
    getCurrentState() {
      return this.currentState;
    }

    /**
     * Get current state metadata
     * @returns {Object}
     */
    getCurrentStateMetadata() {
      const meta = STATE_METADATA[this.currentState];
      return {
        ...meta,
        duration: this.durations[this.currentState]
      };
    }

    /**
     * Get duration in seconds for a specific state
     * @param {string} stateKey
     * @returns {number}
     */
    getDurationForState(stateKey) {
      return this.durations[stateKey] || DEFAULT_DURATIONS[stateKey] || 10;
    }

    /**
     * Update duration in seconds for a specific state
     * @param {string} stateKey
     * @param {number} seconds
     */
    setDuration(stateKey, seconds) {
      if (typeof seconds !== 'number' || seconds <= 0 || isNaN(seconds)) {
        throw new Error('Duration must be a positive integer');
      }
      if (!STATES[stateKey]) {
        throw new Error(`Invalid state key: ${stateKey}`);
      }
      this.durations[stateKey] = Math.max(1, Math.round(seconds));
    }

    /**
     * Execute one state transition in the 4-state cyclic FSM
     * S0 -> S1 -> S2 -> S3 -> S0
     * @returns {Object} { previousState, currentState, signals, safety }
     */
    step() {
      const previousState = this.currentState;
      const nextState = STATE_METADATA[this.currentState].nextState;

      // Perform state transition
      this.currentState = nextState;
      this.transitionCount++;

      // Verify safety invariant immediately on target state
      const safety = this.validateSafety();
      if (!safety.isSafe) {
        // Failsafe: roll back or force all-red emergency if safety fails
        throw new Error(`FSM Safety Invariant Violation: ${safety.reason}`);
      }

      const logEntry = {
        transitionId: this.transitionCount,
        from: previousState,
        to: this.currentState,
        timestamp: Date.now(),
        safety: safety.code
      };

      this.history.unshift(logEntry);
      if (this.history.length > this.maxHistoryLength) {
        this.history.pop();
      }

      return {
        previousState,
        currentState: this.currentState,
        signals: this.getSignals(),
        metadata: this.getCurrentStateMetadata(),
        safety
      };
    }

    /**
     * Reset FSM to initial state S0 (NS Green / EW Red)
     */
    reset() {
      this.currentState = STATES.S0_NS_GREEN;
      this.transitionCount = 0;
      this.history = [];
      const safety = this.validateSafety();
      return {
        currentState: this.currentState,
        signals: this.getSignals(),
        metadata: this.getCurrentStateMetadata(),
        safety
      };
    }

    /**
     * Return all states and their metadata (useful for rendering state tables and inspectors)
     */
    getAllStateMetadata() {
      return STATE_ORDER.map(stateKey => ({
        key: stateKey,
        ...STATE_METADATA[stateKey],
        duration: this.durations[stateKey]
      }));
    }
  }

  TrafficLightFSM.LIGHTS = LIGHTS;
  TrafficLightFSM.STATES = STATES;
  TrafficLightFSM.STATE_ORDER = STATE_ORDER;
  TrafficLightFSM.DEFAULT_DURATIONS = DEFAULT_DURATIONS;
  TrafficLightFSM.STATE_METADATA = STATE_METADATA;

  return TrafficLightFSM;
});
