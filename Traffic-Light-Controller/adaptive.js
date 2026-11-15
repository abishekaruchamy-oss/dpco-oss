/**
 * Adaptive Signal Control Engine for Traffic Light Controller
 *
 * Implements intelligent, demand-responsive traffic signal timing:
 * - Dynamic queue length & approach demand calculation
 * - Congestion-responsive green duration optimization
 * - Strict min (5s) and max (25s) green duration boundaries
 * - Anti-starvation safeguards for low-demand approaches
 * - Inviolable yellow clearance preservation (3s)
 * - Explainable AI (XAI) rationale generation
 * - Operating modes: FIXED, ADAPTIVE, MANUAL
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./fsm.js'));
  } else {
    root.AdaptiveController = factory(root.TrafficFSM);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLightFSM) {
  'use strict';

  const MODES = Object.freeze({
    FIXED: 'FIXED',
    ADAPTIVE: 'ADAPTIVE',
    MANUAL: 'MANUAL'
  });

  const DEFAULT_CONFIG = Object.freeze({
    minGreen: 5,        // Absolute minimum green duration (prevent short-cycle hazards)
    maxGreen: 25,       // Maximum green duration (prevent cross-corridor starvation)
    baseGreen: 10,      // Nominal green duration for balanced demand
    yellowClearance: 3, // Inviolable yellow clearance duration
    secondsPerQueuedCar: 2.0 // Additional clearance time per queued vehicle
  });

  class AdaptiveSignalController {
    /**
     * @param {Object} [configOverrides]
     */
    constructor(configOverrides = {}) {
      this.config = { ...DEFAULT_CONFIG, ...configOverrides };
      this.mode = MODES.ADAPTIVE;
      this.lastDecision = {
        axis: 'North-South',
        duration: this.config.baseGreen,
        rationale: 'System initialized. Default balanced green timing active.',
        demandNS: 0,
        demandEW: 0,
        timestamp: Date.now()
      };

      // Starvation tracking counters
      this.consecutiveMinCycles = {
        'North-South': 0,
        'East-West': 0
      };
    }

    /**
     * Set operating mode (FIXED, ADAPTIVE, MANUAL)
     * @param {string} mode
     */
    setMode(mode) {
      if (!MODES[mode]) {
        throw new Error(`Invalid operating mode: ${mode}`);
      }
      this.mode = mode;
      return this.mode;
    }

    getMode() {
      return this.mode;
    }

    /**
     * Calculate traffic demand metrics from current queue lengths and approach densities
     * @param {Object} queues { north, south, east, west }
     * @param {Object} [approaching] Optional inbound counts { north, south, east, west }
     * @returns {Object} { demandNS, demandEW, dominantAxis, congestionLevel }
     */
    analyzeTrafficDemand(queues, approaching = { north: 0, south: 0, east: 0, west: 0 }) {
      const qN = (queues && queues.north) || 0;
      const qS = (queues && queues.south) || 0;
      const qE = (queues && queues.east) || 0;
      const qW = (queues && queues.west) || 0;

      const aN = (approaching && approaching.north) || 0;
      const aS = (approaching && approaching.south) || 0;
      const aE = (approaching && approaching.east) || 0;
      const aW = (approaching && approaching.west) || 0;

      // Primary demand: queued stopped vehicles (weight 1.0) + approaching vehicles (weight 0.4)
      const demandNS = (qN + qS) + (aN + aS) * 0.4;
      const demandEW = (qE + qW) + (aE + aW) * 0.4;

      let dominantAxis = 'Balanced';
      if (demandNS > demandEW + 0.5) dominantAxis = 'North-South';
      else if (demandEW > demandNS + 0.5) dominantAxis = 'East-West';

      const totalDemand = demandNS + demandEW;
      let congestionLevel = 'Low';
      if (totalDemand > 8) congestionLevel = 'High';
      else if (totalDemand > 3) congestionLevel = 'Moderate';

      return {
        demandNS,
        demandEW,
        dominantAxis,
        congestionLevel,
        queues: { north: qN, south: qS, east: qE, west: qW }
      };
    }

    /**
     * Get live demand evaluation and rationale without advancing cycle/starvation state
     * @param {string} stateKey S0_NS_GREEN, S1_NS_YELLOW, S2_EW_GREEN, S3_EW_YELLOW
     * @param {Object} queues { north, south, east, west }
     * @param {Object} [approaching] { north, south, east, west }
     * @returns {Object} Authoritative snapshot: { axis, duration, rationale, demandNS, demandEW, dominantAxis, congestionLevel, mode }
     */
    getLiveDemandEvaluation(stateKey, queues, approaching = null) {
      const isNorthSouth = (stateKey === TrafficLightFSM.STATES.S0_NS_GREEN || stateKey === TrafficLightFSM.STATES.S1_NS_YELLOW);
      const axisName = isNorthSouth ? 'North-South' : 'East-West';
      const opposingAxisName = isNorthSouth ? 'East-West' : 'North-South';

      const analysis = this.analyzeTrafficDemand(queues, approaching);
      const activeDemand = isNorthSouth ? analysis.demandNS : analysis.demandEW;
      const opposingDemand = isNorthSouth ? analysis.demandEW : analysis.demandNS;

      // Handle FIXED mode
      if (this.mode === MODES.FIXED) {
        return {
          axis: axisName,
          duration: this.config.baseGreen,
          rationale: `Fixed Timing Mode: Static nominal duration (${this.config.baseGreen}s) allocated regardless of queue density.`,
          demandNS: analysis.demandNS,
          demandEW: analysis.demandEW,
          dominantAxis: analysis.dominantAxis,
          congestionLevel: analysis.congestionLevel,
          mode: this.mode,
          timestamp: Date.now()
        };
      }

      // Handle MANUAL mode
      if (this.mode === MODES.MANUAL) {
        return {
          axis: axisName,
          duration: this.config.baseGreen,
          rationale: `Manual Timing Mode: User-configured duration table active.`,
          demandNS: analysis.demandNS,
          demandEW: analysis.demandEW,
          dominantAxis: analysis.dominantAxis,
          congestionLevel: analysis.congestionLevel,
          mode: this.mode,
          timestamp: Date.now()
        };
      }

      // Handle ADAPTIVE mode
      let computedDuration = this.config.baseGreen;
      let rationale = '';

      if (this.consecutiveMinCycles[axisName] >= 2 && activeDemand > 0) {
        computedDuration = Math.min(this.config.maxGreen, this.config.baseGreen + 4);
        rationale = `Anti-starvation safeguard triggered for ${axisName} (held at min for consecutive cycles). Duration increased to ${computedDuration}s to guarantee fair throughput.`;
      } else if (activeDemand === 0 && opposingDemand > 0) {
        computedDuration = this.config.minGreen;
        rationale = `Zero queued vehicles detected on ${axisName}. Green truncated to minimum threshold (${this.config.minGreen}s) to expedite clearance for ${opposingAxisName} (${opposingDemand.toFixed(1)} demand).`;
      } else if (activeDemand > opposingDemand + 0.5) {
        const demandDelta = activeDemand - opposingDemand;
        const additionalSeconds = Math.round(demandDelta * this.config.secondsPerQueuedCar);
        computedDuration = Math.min(this.config.maxGreen, this.config.baseGreen + additionalSeconds);
        rationale = `${axisName} traffic demand (${activeDemand.toFixed(1)}) exceeds ${opposingAxisName} (${opposingDemand.toFixed(1)}). Green extended to ${computedDuration}s (+${additionalSeconds}s) to disperse queue.`;
      } else if (opposingDemand > activeDemand + 1.5) {
        const reductionSeconds = Math.round((opposingDemand - activeDemand) * 1.2);
        computedDuration = Math.max(this.config.minGreen, this.config.baseGreen - reductionSeconds);
        rationale = `${opposingAxisName} has heavy queue backlog (${opposingDemand.toFixed(1)} vs ${activeDemand.toFixed(1)}). ${axisName} green reduced to ${computedDuration}s to grant cross-street priority sooner.`;
      } else {
        computedDuration = this.config.baseGreen;
        rationale = `Demand is balanced (${axisName}: ${activeDemand.toFixed(1)}, ${opposingAxisName}: ${opposingDemand.toFixed(1)}). Standard nominal green duration (${computedDuration}s) assigned.`;
      }

      computedDuration = Math.max(this.config.minGreen, Math.min(this.config.maxGreen, computedDuration));

      return {
        axis: axisName,
        duration: computedDuration,
        rationale,
        demandNS: analysis.demandNS,
        demandEW: analysis.demandEW,
        dominantAxis: analysis.dominantAxis,
        congestionLevel: analysis.congestionLevel,
        mode: this.mode,
        timestamp: Date.now()
      };
    }

    /**
     * Compute adaptive green duration for the upcoming active phase
     * @param {string} stateKey S0_NS_GREEN or S2_EW_GREEN
     * @param {Object} queues { north, south, east, west }
     * @param {Object} [approaching] { north, south, east, west }
     * @returns {Object} { duration, rationale, demandNS, demandEW, mode }
     */
    evaluatePhaseDuration(stateKey, queues, approaching = null) {
      const decision = this.getLiveDemandEvaluation(stateKey, queues, approaching);
      const isNorthSouth = (stateKey === TrafficLightFSM.STATES.S0_NS_GREEN);
      const axisName = isNorthSouth ? 'North-South' : 'East-West';

      if (this.mode === MODES.ADAPTIVE) {
        const activeDemand = isNorthSouth ? decision.demandNS : decision.demandEW;
        const opposingDemand = isNorthSouth ? decision.demandEW : decision.demandNS;

        if (this.consecutiveMinCycles[axisName] >= 2 && activeDemand > 0) {
          this.consecutiveMinCycles[axisName] = 0;
        } else if (activeDemand === 0 && opposingDemand > 0) {
          this.consecutiveMinCycles[axisName]++;
        } else if (opposingDemand > activeDemand + 1.5 && decision.duration === this.config.minGreen) {
          this.consecutiveMinCycles[axisName]++;
        } else {
          this.consecutiveMinCycles[axisName] = 0;
        }
      }

      this.lastDecision = decision;
      return decision;
    }

    /**
     * Get the most recent timing decision metadata for UI presentation
     */
    getLastDecision() {
      return this.lastDecision;
    }
  }

  AdaptiveSignalController.MODES = MODES;
  AdaptiveSignalController.DEFAULT_CONFIG = DEFAULT_CONFIG;

  return AdaptiveSignalController;
});
