/**
 * DPCO — Digital Logic Gate Engine & Telemetry Interface
 * Intelligent Traffic Management System (ITMS)
 *
 * Implements:
 * 1. Standard 7-Gate Boolean Logic Library (AND, OR, NOT, NAND, NOR, XOR, XNOR)
 * 2. Truth Table Evaluators & Active Row Trackers
 * 3. Grounded Production Traffic Controller Boolean Decision Circuits:
 *    - Circuit 1: North-South Green Authorization (S0 ∧ ¬AllRed ∧ ¬Fault)
 *    - Circuit 2: East-West Green Authorization (S2 ∧ ¬AllRed ∧ ¬Fault)
 *    - Circuit 3: All-Red Safety Interlock & Fault Detection (EmergencyAllRed ∨ InvariantViolation)
 *    - Circuit 4: Vehicle Entry Authorization (SignalGreen ∧ ¬ConflictingOccupied)
 *    - Circuit 5: Emergency Priority Hold Interlock (ActiveEmergency ∧ TargetGreenActive ∧ ¬VehicleCleared)
 *    - Circuit 6: Conflicting Green Invariant Defense ((NS_Green ∨ NS_Yellow) ∧ (EW_Green ∨ EW_Yellow))
 * 4. Read-Only Telemetry Bridge: Authoritative extraction from running FSM & VehicleManager
 * 5. Standalone SVG ANSI/IEEE Gate & Circuit Renderers
 * 6. Isolated Learning Mode State Sandboxing (Guaranteed zero side-effects on simulation)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./fsm.js'), require('./vehicles.js'));
  } else {
    root.LogicEngine = factory(root.TrafficFSM, root.VehicleManager);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLightFSM, VehicleManager) {
  'use strict';

  // -------------------------------------------------------------
  // 1. STANDARD 7 BASIC LOGIC GATES
  // -------------------------------------------------------------

  const GATES = Object.freeze({
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT',
    NAND: 'NAND',
    NOR: 'NOR',
    XOR: 'XOR',
    XNOR: 'XNOR'
  });

  const GATE_METADATA = Object.freeze({
    [GATES.AND]: {
      id: GATES.AND,
      name: 'AND Gate',
      inputs: 2,
      expression: 'Y = A · B',
      booleanAlgebra: 'Y = A ∧ B',
      description: 'Output is HIGH (1) only if BOTH inputs A and B are HIGH (1). Used for joint conditions and authorization interlocks.',
      dpcoContext: 'Fundamental product term in Sum-of-Products (SOP) digital logic. Implements hardware coincidence detection.',
      truthTable: [
        { a: 0, b: 0, y: 0 },
        { a: 0, b: 1, y: 0 },
        { a: 1, b: 0, y: 0 },
        { a: 1, b: 1, y: 1 }
      ]
    },
    [GATES.OR]: {
      id: GATES.OR,
      name: 'OR Gate',
      inputs: 2,
      expression: 'Y = A + B',
      booleanAlgebra: 'Y = A ∨ B',
      description: 'Output is HIGH (1) if AT LEAST ONE input is HIGH (1). Used for alternative triggers and multi-source emergency interrupts.',
      dpcoContext: 'Fundamental sum term in Product-of-Sums (POS) logic. Implements inclusive disjunction in digital computers.',
      truthTable: [
        { a: 0, b: 0, y: 0 },
        { a: 0, b: 1, y: 1 },
        { a: 1, b: 0, y: 1 },
        { a: 1, b: 1, y: 1 }
      ]
    },
    [GATES.NOT]: {
      id: GATES.NOT,
      name: 'NOT Gate (Inverter)',
      inputs: 1,
      expression: 'Y = A̅',
      booleanAlgebra: 'Y = ¬A',
      description: 'Output is the inverse of the input. Output is HIGH (1) when input is LOW (0), and vice versa. Used for active-low signals and prohibition checks.',
      dpcoContext: 'Logic inversion (complement). Fundamental CMOS building block consisting of a PMOS pull-up and NMOS pull-down pair.',
      truthTable: [
        { a: 0, y: 1 },
        { a: 1, y: 0 }
      ]
    },
    [GATES.NAND]: {
      id: GATES.NAND,
      name: 'NAND Gate',
      inputs: 2,
      expression: 'Y = (A · B)̅',
      booleanAlgebra: 'Y = ¬(A ∧ B)',
      description: 'Output is LOW (0) only if BOTH inputs are HIGH (1). Universal gate capable of synthesizing any Boolean function.',
      dpcoContext: 'Universal logic gate. Basis of flash memory (NAND flash) and modern VLSI standard cell libraries due to fast CMOS layout.',
      truthTable: [
        { a: 0, b: 0, y: 1 },
        { a: 0, b: 1, y: 1 },
        { a: 1, b: 0, y: 1 },
        { a: 1, b: 1, y: 0 }
      ]
    },
    [GATES.NOR]: {
      id: GATES.NOR,
      name: 'NOR Gate',
      inputs: 2,
      expression: 'Y = (A + B)̅',
      booleanAlgebra: 'Y = ¬(A ∨ B)',
      description: 'Output is HIGH (1) only if ALL inputs are LOW (0). Universal gate frequently used in SR latches and memory cells.',
      dpcoContext: 'Universal logic gate. Basis of NOR flash memory and classic ECL/RTL computing architectures.',
      truthTable: [
        { a: 0, b: 0, y: 1 },
        { a: 0, b: 1, y: 0 },
        { a: 1, b: 0, y: 0 },
        { a: 1, b: 1, y: 0 }
      ]
    },
    [GATES.XOR]: {
      id: GATES.XOR,
      name: 'XOR Gate (Exclusive OR)',
      inputs: 2,
      expression: 'Y = A ⊕ B = A̅B + AB̅',
      booleanAlgebra: 'Y = (A ∧ ¬B) ∨ (¬A ∧ B)',
      description: 'Output is HIGH (1) if inputs are DIFFERENT. Used in binary adders (half/full adders), parity checkers, and arithmetic logic units (ALUs).',
      dpcoContext: 'Modulo-2 addition. Forms the sum bit of binary adders and pseudo-random number generator feedback in LFSRs.',
      truthTable: [
        { a: 0, b: 0, y: 0 },
        { a: 0, b: 1, y: 1 },
        { a: 1, b: 0, y: 1 },
        { a: 1, b: 1, y: 0 }
      ]
    },
    [GATES.XNOR]: {
      id: GATES.XNOR,
      name: 'XNOR Gate (Equivalence)',
      inputs: 2,
      expression: 'Y = (A ⊕ B)̅ = AB + A̅B̅',
      booleanAlgebra: 'Y = (A ∧ B) ∨ (¬A ∧ ¬B)',
      description: 'Output is HIGH (1) if inputs are IDENTICAL. Used in digital comparators to test for equality between binary registers.',
      dpcoContext: 'Bitwise equivalence comparator. Output indicates whether two binary signals match.',
      truthTable: [
        { a: 0, b: 0, y: 1 },
        { a: 0, b: 1, y: 0 },
        { a: 1, b: 0, y: 0 },
        { a: 1, b: 1, y: 1 }
      ]
    }
  });

  /**
   * Pure standard gate evaluator
   * @param {string} gate Gate type (AND, OR, NOT, NAND, NOR, XOR, XNOR)
   * @param {number} a Input A (0 or 1)
   * @param {number} [b] Input B (0 or 1, ignored for NOT)
   * @returns {number} 0 or 1
   */
  function evaluateGate(gate, a, b = 0) {
    const valA = a ? 1 : 0;
    const valB = b ? 1 : 0;

    switch (gate) {
      case GATES.AND:
        return (valA & valB) ? 1 : 0;
      case GATES.OR:
        return (valA | valB) ? 1 : 0;
      case GATES.NOT:
        return valA ? 0 : 1;
      case GATES.NAND:
        return !(valA & valB) ? 1 : 0;
      case GATES.NOR:
        return !(valA | valB) ? 1 : 0;
      case GATES.XOR:
        return (valA ^ valB) ? 1 : 0;
      case GATES.XNOR:
        return !(valA ^ valB) ? 1 : 0;
      default:
        throw new Error(`Unknown logic gate: ${gate}`);
    }
  }

  // -------------------------------------------------------------
  // 2. CONTROLLER PRODUCTION BOOLEAN CIRCUITS
  // -------------------------------------------------------------

  const CONTROLLER_CIRCUITS = Object.freeze({
    NS_GREEN: 'NS_GREEN',
    EW_GREEN: 'EW_GREEN',
    SAFETY_HALT: 'SAFETY_HALT',
    VEHICLE_ENTRY: 'VEHICLE_ENTRY',
    EMERGENCY_HOLD: 'EMERGENCY_HOLD',
    INVARIANT_DEFENSE: 'INVARIANT_DEFENSE'
  });

  const CONTROLLER_CIRCUIT_METADATA = Object.freeze({
    [CONTROLLER_CIRCUITS.NS_GREEN]: {
      id: CONTROLLER_CIRCUITS.NS_GREEN,
      title: 'North-South Green Authorization Circuit',
      shortName: 'NS Green Auth',
      booleanEquation: 'NS_Green = S0 ∧ ¬AllRed ∧ ¬Fault',
      latexEquation: 'NS_{Green} = S_0 \\cdot \\overline{\\text{AllRed}} \\cdot \\overline{\\text{Fault}}',
      gatesUsed: ['NOT', 'NOT', 'AND (3-Input)'],
      description: 'Grants GREEN signal to North-South corridor only when FSM is in state S0 (NS Green), Fail-Safe All-Red is NOT asserted, and Safety Invariant verification reports zero hazards.',
      hardwareAnalogy: 'Synchronous Output Logic in a Moore Finite State Machine combined with asynchronous active-low trip interlocks.',
      inputs: [
        { id: 's0', label: 'State S0 Active', desc: 'FSM currentState == S0_NS_GREEN' },
        { id: 'allRed', label: 'All-Red Halt Asserted', desc: 'fsm.isAllRedHalt()' },
        { id: 'fault', label: 'Safety Fault Active', desc: 'Invariant violation detected' }
      ]
    },
    [CONTROLLER_CIRCUITS.EW_GREEN]: {
      id: CONTROLLER_CIRCUITS.EW_GREEN,
      title: 'East-West Green Authorization Circuit',
      shortName: 'EW Green Auth',
      booleanEquation: 'EW_Green = S2 ∧ ¬AllRed ∧ ¬Fault',
      latexEquation: 'EW_{Green} = S_2 \\cdot \\overline{\\text{AllRed}} \\cdot \\overline{\\text{Fault}}',
      gatesUsed: ['NOT', 'NOT', 'AND (3-Input)'],
      description: 'Grants GREEN signal to East-West corridor only when FSM is in state S2 (EW Green), Fail-Safe All-Red is NOT asserted, and Safety Invariant verification passes.',
      hardwareAnalogy: 'Orthogonal phase authorization logic ensuring mutually exclusive corridor green drive signals.',
      inputs: [
        { id: 's2', label: 'State S2 Active', desc: 'FSM currentState == S2_EW_GREEN' },
        { id: 'allRed', label: 'All-Red Halt Asserted', desc: 'fsm.isAllRedHalt()' },
        { id: 'fault', label: 'Safety Fault Active', desc: 'Invariant violation detected' }
      ]
    },
    [CONTROLLER_CIRCUITS.SAFETY_HALT]: {
      id: CONTROLLER_CIRCUITS.SAFETY_HALT,
      title: 'Fail-Safe All-Red Interlock & Fault Detector',
      shortName: 'Safety Interlock',
      booleanEquation: 'Halt = EmergencyAllRed ∨ InvariantViolation',
      latexEquation: '\\text{Halt} = \\text{EmergencyTrigger} + \\text{InvariantFault}',
      gatesUsed: ['OR'],
      description: 'Forces an immediate junction-wide RED signal if the operator/traffic engineer triggers Emergency All-Red OR if the formal invariant monitor detects a dual-active hazard.',
      hardwareAnalogy: 'Asynchronous Master Trip Circuit / Emergency Stop (E-Stop) hardwired to bypass controller register clocking.',
      inputs: [
        { id: 'emergencyAllRed', label: 'Operator / Auto All-Red', desc: 'fsm.currentState == EMERGENCY_ALL_RED' },
        { id: 'invariantViolation', label: 'Dual Active / Green Fault', desc: '!fsm.validateSafety().isSafe' }
      ]
    },
    [CONTROLLER_CIRCUITS.VEHICLE_ENTRY]: {
      id: CONTROLLER_CIRCUITS.VEHICLE_ENTRY,
      title: 'Junction Vehicle Entry Permission Circuit',
      shortName: 'Vehicle Entry Perm',
      booleanEquation: 'EntryGranted = SignalGreen ∧ ¬ConflictingOccupied',
      latexEquation: '\\text{EntryGranted} = \\text{SignalGreen} \\cdot \\overline{\\text{ConflictZoneBlocked}}',
      gatesUsed: ['NOT', 'AND'],
      description: 'Authorizes an approaching lead vehicle to advance beyond the stop line only if its corridor signal is GREEN AND the central intersection conflict box is completely clear of cross-traffic.',
      hardwareAnalogy: 'Inductive loop detector sensor interlock combined with traffic signal state bit.',
      inputs: [
        { id: 'signalGreen', label: 'Corridor Signal is GREEN', desc: 'Current lane signal == GREEN' },
        { id: 'conflictingOccupied', label: 'Conflict Box Occupied', desc: 'vehicles.isConflictingAxisInIntersection(dir)' }
      ]
    },
    [CONTROLLER_CIRCUITS.EMERGENCY_HOLD]: {
      id: CONTROLLER_CIRCUITS.EMERGENCY_HOLD,
      title: 'Emergency Vehicle Priority Hold Interlock',
      shortName: 'Priority Hold',
      booleanEquation: 'PriorityHold = ActiveEmergency ∧ TargetGreenActive ∧ ¬VehicleCleared',
      latexEquation: '\\text{PriorityHold} = \\text{Emergency} \\cdot \\text{GreenActive} \\cdot \\overline{\\text{VehicleCleared}}',
      gatesUsed: ['NOT', 'AND (3-Input)'],
      description: 'Freezes the FSM cycle timer and extends green authorization when an approaching emergency vehicle (Ambulance, Fire Engine, or Police Cruiser) has achieved green clearance and has not yet traversed past the intersection exit line.',
      hardwareAnalogy: 'Preemption hold latch with automatic acoustic/optical sensor reset on exit line detector trigger.',
      inputs: [
        { id: 'activeEmergency', label: 'Emergency Vehicle Present', desc: 'Emergency vehicle active in queue' },
        { id: 'targetGreenActive', label: 'Emergency Corridor Green', desc: 'FSM currentState matches emergency corridor' },
        { id: 'vehicleCleared', label: 'Vehicle Cleared Exit Line', desc: 'Emergency vehicle has completed junction passage' }
      ]
    },
    [CONTROLLER_CIRCUITS.INVARIANT_DEFENSE]: {
      id: CONTROLLER_CIRCUITS.INVARIANT_DEFENSE,
      title: 'Conflicting Green Invariant Defense Monitor',
      shortName: 'Conflict Monitor',
      booleanEquation: 'Hazard = (NS_Green ∨ NS_Yellow) ∧ (EW_Green ∨ EW_Yellow)',
      latexEquation: '\\text{Hazard} = (NS_{G} + NS_{Y}) \\cdot (EW_{G} + EW_{Y})',
      gatesUsed: ['OR', 'OR', 'AND'],
      description: 'Continuous combinatorial verification circuit: detects if North-South and East-West corridors ever exhibit concurrent active clearance (Green or Yellow). Under normal operation, Hazard is strictly 0 (LOW).',
      hardwareAnalogy: 'Conflict Monitor Unit (CMU) / Malfunction Management Unit (MMU) standard in NEMA TS-2 traffic signal cabinets.',
      inputs: [
        { id: 'nsActive', label: 'NS Corridor Active (Green | Yellow)', desc: 'North or South signal active' },
        { id: 'ewActive', label: 'EW Corridor Active (Green | Yellow)', desc: 'East or West signal active' }
      ]
    }
  });

  // -------------------------------------------------------------
  // 3. CIRCUIT EVALUATION FUNCTIONS (GROUNDED IN PRODUCTION LOGIC)
  // -------------------------------------------------------------

  /**
   * Evaluate Circuit 1: NS Green Authorization
   * NS_Green = S0 ∧ ¬AllRed ∧ ¬Fault
   */
  function evaluateNSGreenCircuit(inputs) {
    const s0 = inputs.s0 ? 1 : 0;
    const allRed = inputs.allRed ? 1 : 0;
    const fault = inputs.fault ? 1 : 0;

    const notAllRed = evaluateGate(GATES.NOT, allRed);
    const notFault = evaluateGate(GATES.NOT, fault);
    const output = (s0 && notAllRed && notFault) ? 1 : 0;

    return {
      output,
      subTerms: {
        s0,
        allRed,
        notAllRed,
        fault,
        notFault
      }
    };
  }

  /**
   * Evaluate Circuit 2: EW Green Authorization
   * EW_Green = S2 ∧ ¬AllRed ∧ ¬Fault
   */
  function evaluateEWGreenCircuit(inputs) {
    const s2 = inputs.s2 ? 1 : 0;
    const allRed = inputs.allRed ? 1 : 0;
    const fault = inputs.fault ? 1 : 0;

    const notAllRed = evaluateGate(GATES.NOT, allRed);
    const notFault = evaluateGate(GATES.NOT, fault);
    const output = (s2 && notAllRed && notFault) ? 1 : 0;

    return {
      output,
      subTerms: {
        s2,
        allRed,
        notAllRed,
        fault,
        notFault
      }
    };
  }

  /**
   * Evaluate Circuit 3: All-Red Safety Interlock
   * Halt = EmergencyAllRed ∨ InvariantViolation
   */
  function evaluateSafetyHaltCircuit(inputs) {
    const emergencyAllRed = inputs.emergencyAllRed ? 1 : 0;
    const invariantViolation = inputs.invariantViolation ? 1 : 0;
    const output = evaluateGate(GATES.OR, emergencyAllRed, invariantViolation);

    return {
      output,
      subTerms: {
        emergencyAllRed,
        invariantViolation
      }
    };
  }

  /**
   * Evaluate Circuit 4: Vehicle Entry Permission
   * EntryGranted = SignalGreen ∧ ¬ConflictingOccupied
   */
  function evaluateVehicleEntryCircuit(inputs) {
    const signalGreen = inputs.signalGreen ? 1 : 0;
    const conflictingOccupied = inputs.conflictingOccupied ? 1 : 0;
    const entryDir = inputs.entryDir || 'north';
    const notConflicting = evaluateGate(GATES.NOT, conflictingOccupied);
    const output = evaluateGate(GATES.AND, signalGreen, notConflicting);

    return {
      output,
      entryDir,
      subTerms: {
        signalGreen,
        conflictingOccupied,
        notConflicting,
        entryDir
      }
    };
  }

  /**
   * Evaluate Circuit 5: Emergency Priority Hold Interlock
   * PriorityHold = ActiveEmergency ∧ TargetGreenActive ∧ ¬VehicleCleared
   */
  function evaluateEmergencyHoldCircuit(inputs) {
    const activeEmergency = inputs.activeEmergency ? 1 : 0;
    const targetGreenActive = inputs.targetGreenActive ? 1 : 0;
    const vehicleCleared = inputs.vehicleCleared ? 1 : 0;
    const notCleared = evaluateGate(GATES.NOT, vehicleCleared);
    const output = (activeEmergency && targetGreenActive && notCleared) ? 1 : 0;

    return {
      output,
      subTerms: {
        activeEmergency,
        targetGreenActive,
        vehicleCleared,
        notCleared
      }
    };
  }

  /**
   * Evaluate Circuit 6: Conflicting Green Invariant Defense
   * Hazard = (NS_Green ∨ NS_Yellow) ∧ (EW_Green ∨ EW_Yellow)
   */
  function evaluateInvariantDefenseCircuit(inputs) {
    const nsGreen = inputs.nsGreen ? 1 : 0;
    const nsYellow = inputs.nsYellow ? 1 : 0;
    const ewGreen = inputs.ewGreen ? 1 : 0;
    const ewYellow = inputs.ewYellow ? 1 : 0;

    const nsActive = evaluateGate(GATES.OR, nsGreen, nsYellow);
    const ewActive = evaluateGate(GATES.OR, ewGreen, ewYellow);
    const output = evaluateGate(GATES.AND, nsActive, ewActive);

    return {
      output,
      subTerms: {
        nsGreen,
        nsYellow,
        nsActive,
        ewGreen,
        ewYellow,
        ewActive
      }
    };
  }

  // -------------------------------------------------------------
  // 4. AUTHORITATIVE READ-ONLY TELEMETRY BRIDGE
  // -------------------------------------------------------------

  /**
   * Extract authoritative telemetry snapshot from running simulation
   * Does NOT alter FSM or vehicle state in any way.
   *
   * @param {Object} fsm TrafficLightFSM instance
   * @param {Object} [vehicleManager] VehicleManager instance
   * @param {Object} [adaptiveController] AdaptiveController instance
   * @returns {Object} Full logic telemetry snapshot
   */
  function getLogicTelemetry(fsm, vehicleManager = null, adaptiveController = null) {
    if (!fsm) {
      return {
        timestamp: Date.now(),
        fsmRunning: false,
        state: 'S0_NS_GREEN',
        circuits: {}
      };
    }

    const state = fsm.getCurrentState ? fsm.getCurrentState() : 'S0_NS_GREEN';
    const signals = fsm.getSignals ? fsm.getSignals() : { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' };

    // Strictly read-only invariant safety evaluation without mutating internal FSM state
    let safety = { isSafe: true, code: 'SAFE' };
    const FsmClass = TrafficLightFSM || (typeof root !== 'undefined' ? root.TrafficFSM : null) || (fsm ? fsm.constructor : null);
    if (FsmClass && typeof FsmClass.checkSignalsSafety === 'function') {
      safety = FsmClass.checkSignalsSafety(signals);
    } else if (fsm && typeof fsm.validateSafety === 'function') {
      safety = fsm.validateSafety(signals, false);
    } else if (fsm && fsm.lastSafetyCheck) {
      safety = fsm.lastSafetyCheck;
    }

    const isAllRed = fsm.isAllRedHalt ? fsm.isAllRedHalt() : false;

    // FSM State Bits
    const isS0 = state === 'S0_NS_GREEN' ? 1 : 0;
    const isS1 = state === 'S1_NS_YELLOW' ? 1 : 0;
    const isS2 = state === 'S2_EW_GREEN' ? 1 : 0;
    const isS3 = state === 'S3_EW_YELLOW' ? 1 : 0;

    // Signal Bits
    const nsGreen = (signals.north === 'GREEN' || signals.south === 'GREEN') ? 1 : 0;
    const nsYellow = (signals.north === 'YELLOW' || signals.south === 'YELLOW') ? 1 : 0;
    const nsRed = (signals.north === 'RED' && signals.south === 'RED') ? 1 : 0;

    const ewGreen = (signals.east === 'GREEN' || signals.west === 'GREEN') ? 1 : 0;
    const ewYellow = (signals.east === 'YELLOW' || signals.west === 'YELLOW') ? 1 : 0;
    const ewRed = (signals.east === 'RED' && signals.west === 'RED') ? 1 : 0;

    const invariantViolation = (!safety.isSafe) ? 1 : 0;

    // Vehicle Conflict Zone Occupancy
    let nsConflictOccupied = 0;
    let ewConflictOccupied = 0;
    let activeEmergency = 0;
    let emergencyDirection = null;
    let emergencyVehicleType = null;
    let emergencyCleared = 0;

    if (vehicleManager) {
      // Check if EW vehicles occupy conflict zone (blocking NS entry)
      if (typeof vehicleManager.isConflictingAxisInIntersection === 'function') {
        nsConflictOccupied = vehicleManager.isConflictingAxisInIntersection('north') ? 1 : 0;
        ewConflictOccupied = vehicleManager.isConflictingAxisInIntersection('east') ? 1 : 0;
      }
    }

    // Authoritative Emergency Vehicle Detection & Multi-Class Identification
    // 1. Prefer active FSM emergency preemption request if registered
    const fsmPriority = (fsm && typeof fsm.getEmergencyPriority === 'function')
      ? fsm.getEmergencyPriority()
      : (fsm && fsm.emergencyPriority ? fsm.emergencyPriority : null);

    const hasFsmActivePriority = !!(fsmPriority && fsmPriority.active);
    if (hasFsmActivePriority) {
      activeEmergency = 1;
      emergencyDirection = fsmPriority.direction;
    }

    // 2. Scan VehicleManager for active emergency vehicles across lanes
    const EMERGENCY_CLASSES = ['AMBULANCE', 'FIRE_ENGINE', 'POLICE'];
    let matchedVehicle = null;

    if (vehicleManager && vehicleManager.lanes) {
      const dirs = ['north', 'south', 'east', 'west'];
      // Prioritize searching the active FSM requested corridor first
      const searchDirs = emergencyDirection
        ? [emergencyDirection, ...dirs.filter(d => d !== emergencyDirection)]
        : dirs;

      for (let d = 0; d < searchDirs.length; d++) {
        const dir = searchDirs[d];
        const lane = vehicleManager.lanes[dir] || [];

        for (let v = 0; v < lane.length; v++) {
          const veh = lane[v];
          // Authoritative check: must be explicitly an emergency vehicle class
          const isEmerg = veh.isEmergency === true || (veh.type && EMERGENCY_CLASSES.includes(veh.type.toUpperCase()));
          if (isEmerg) {
            if (!activeEmergency) {
              activeEmergency = 1;
              emergencyDirection = dir;
            }
            if (dir === emergencyDirection && !matchedVehicle) {
              matchedVehicle = veh;
              emergencyVehicleType = veh.type;
              break;
            }
          }
        }
        if (matchedVehicle) break;
      }

      if (matchedVehicle) {
        // Vehicle is still approaching or traversing:
        // Clearance is strictly determined by hasClearedIntersection (pos >= JUNCTION_EXIT),
        // NEVER prematurely released by hasClearedStopLine!
        emergencyCleared = matchedVehicle.hasClearedIntersection ? 1 : 0;
      } else if (hasFsmActivePriority) {
        // Active FSM request exists, but vehicle may have just cleared or despawned
        if (vehicleManager.emergencyEvents && vehicleManager.emergencyEvents.length > 0) {
          const ev = vehicleManager.emergencyEvents.find(e => e.direction === emergencyDirection);
          if (ev && ev.cleared) {
            emergencyCleared = 1;
          } else {
            emergencyCleared = 0;
          }
        } else {
          emergencyCleared = 0;
        }
      } else {
        emergencyCleared = 0;
      }
    } else if (hasFsmActivePriority) {
      emergencyCleared = 0;
    }

    const isEmergencyNorthSouth = emergencyDirection === 'north' || emergencyDirection === 'south';
    const emergencyTargetGreenActive = activeEmergency
      ? ((isEmergencyNorthSouth && isS0) || (!isEmergencyNorthSouth && isS2) ? 1 : 0)
      : 0;

    // Choose active corridor for Vehicle Entry demonstration:
    // If East-West has green (S2) or yellow (S3), evaluate East approach.
    // If North-South has green (S0) or yellow (S1), evaluate North approach.
    // In All-Red or stopped states, default to North approach.
    let entryDir = 'north';
    if (isS2 || isS3 || signals.east === 'GREEN' || signals.east === 'YELLOW') {
      entryDir = 'east';
    } else {
      entryDir = 'north';
    }

    const entrySignalGreen = (entryDir === 'east') ? ewGreen : nsGreen;
    const entryConflictingOccupied = (entryDir === 'east') ? ewConflictOccupied : nsConflictOccupied;

    // Evaluate all 6 circuits with authentic live data
    const evalNSGreen = evaluateNSGreenCircuit({
      s0: isS0,
      allRed: isAllRed ? 1 : 0,
      fault: invariantViolation
    });

    const evalEWGreen = evaluateEWGreenCircuit({
      s2: isS2,
      allRed: isAllRed ? 1 : 0,
      fault: invariantViolation
    });

    const evalSafetyHalt = evaluateSafetyHaltCircuit({
      emergencyAllRed: isAllRed ? 1 : 0,
      invariantViolation
    });

    const evalVehicleEntry = evaluateVehicleEntryCircuit({
      signalGreen: entrySignalGreen,
      conflictingOccupied: entryConflictingOccupied,
      entryDir
    });

    const evalEmergencyHold = evaluateEmergencyHoldCircuit({
      activeEmergency,
      targetGreenActive: emergencyTargetGreenActive,
      vehicleCleared: emergencyCleared
    });

    const evalInvariantDefense = evaluateInvariantDefenseCircuit({
      nsGreen,
      nsYellow,
      ewGreen,
      ewYellow
    });

    return {
      timestamp: Date.now(),
      state,
      stateBits: { isS0, isS1, isS2, isS3, isAllRed: isAllRed ? 1 : 0 },
      signals,
      signalBits: { nsGreen, nsYellow, nsRed, ewGreen, ewYellow, ewRed },
      safety: { isSafe: safety.isSafe, violation: invariantViolation },
      conflictOccupancy: { ns: nsConflictOccupied, ew: ewConflictOccupied },
      emergency: {
        active: activeEmergency,
        direction: emergencyDirection,
        targetGreenActive: emergencyTargetGreenActive,
        cleared: emergencyCleared
      },
      circuits: {
        [CONTROLLER_CIRCUITS.NS_GREEN]: evalNSGreen,
        [CONTROLLER_CIRCUITS.EW_GREEN]: evalEWGreen,
        [CONTROLLER_CIRCUITS.SAFETY_HALT]: evalSafetyHalt,
        [CONTROLLER_CIRCUITS.VEHICLE_ENTRY]: { ...evalVehicleEntry, entryDir },
        [CONTROLLER_CIRCUITS.EMERGENCY_HOLD]: evalEmergencyHold,
        [CONTROLLER_CIRCUITS.INVARIANT_DEFENSE]: evalInvariantDefense
      }
    };
  }

  // -------------------------------------------------------------
  // 5. ISOLATED LEARNING MODE ENGINE (SANDBOXED)
  // -------------------------------------------------------------

  class LearningModeState {
    constructor() {
      this.selectedGate = GATES.AND;
      this.inputA = 0;
      this.inputB = 0;
    }

    setGate(gate) {
      if (!GATE_METADATA[gate]) {
        throw new Error(`Invalid gate: ${gate}`);
      }
      this.selectedGate = gate;
      return this.getState();
    }

    toggleInputA() {
      this.inputA = this.inputA ? 0 : 1;
      return this.getState();
    }

    toggleInputB() {
      this.inputB = this.inputB ? 0 : 1;
      return this.getState();
    }

    setInputA(val) {
      this.inputA = val ? 1 : 0;
      return this.getState();
    }

    setInputB(val) {
      this.inputB = val ? 1 : 0;
      return this.getState();
    }

    getState() {
      const meta = GATE_METADATA[this.selectedGate];
      const output = evaluateGate(this.selectedGate, this.inputA, this.inputB);

      // Identify active truth table row
      let activeRowIndex = -1;
      if (meta.inputs === 1) {
        activeRowIndex = meta.truthTable.findIndex(row => row.a === this.inputA);
      } else {
        activeRowIndex = meta.truthTable.findIndex(row => row.a === this.inputA && row.b === this.inputB);
      }

      return {
        selectedGate: this.selectedGate,
        metadata: meta,
        inputA: this.inputA,
        inputB: this.inputB,
        output,
        activeRowIndex
      };
    }
  }

  // -------------------------------------------------------------
  // 6. SVG RENDERING UTILITIES (IEEE/ANSI STANDARD SCHEMATICS)
  // -------------------------------------------------------------

  /**
   * Helper: Generate SVG Path for IEEE/ANSI Logic Gates
   * Rendered in a standard normalized coordinate frame [0, 0, 100, 60]
   */
  function getGateSymbolSvgPath(gateType) {
    switch (gateType) {
      case GATES.AND:
      case GATES.NAND:
        // ANSI AND: Flat back from y=10 to y=50 at x=20, straight top/bottom to x=45, circular arc to apex at (75, 30)
        return 'M 20,10 L 45,10 A 25,25 0 0,1 45,50 L 20,50 Z';

      case GATES.OR:
      case GATES.NOR:
        // ANSI OR: Curved concave back from (20,10) to (20,50) curving right to x=28; pointed apex at (78, 30)
        return 'M 18,10 Q 28,30 18,50 Q 50,48 78,30 Q 50,12 18,10 Z';

      case GATES.NOT:
        // ANSI NOT: Equilateral triangle from (22, 10) to (22, 50) pointing right to (64, 30)
        return 'M 22,10 L 22,50 L 64,30 Z';

      case GATES.XOR:
      case GATES.XNOR:
        // ANSI XOR: Same as OR but body offset slightly right, with a secondary curved spine at x=14
        return 'M 22,10 Q 32,30 22,50 Q 52,48 80,30 Q 52,12 22,10 Z';

      default:
        return 'M 20,10 L 70,10 L 70,50 L 20,50 Z';
    }
  }

  /**
   * Generate complete SVG for a single basic gate in Learning Mode
   * Dimensions: 380x160 viewBox
   */
  function renderSingleGateSvg(gateType, inputA, inputB, output) {
    const meta = GATE_METADATA[gateType] || GATE_METADATA[GATES.AND];
    const isSingleInput = meta.inputs === 1;

    // Signal styles
    const wireHighClass = 'logic-wire logic-wire-high';
    const wireLowClass = 'logic-wire logic-wire-low';

    const wireAClass = inputA ? wireHighClass : wireLowClass;
    const wireBClass = inputB ? wireHighClass : wireLowClass;
    const wireYClass = output ? wireHighClass : wireLowClass;

    const strokeA = inputA ? '#38bdf8' : '#334155';
    const strokeB = inputB ? '#38bdf8' : '#334155';
    const strokeY = output ? '#4ade80' : '#334155';

    const hasBubble = (gateType === GATES.NAND || gateType === GATES.NOR || gateType === GATES.NOT || gateType === GATES.XNOR);
    const bubbleX = (gateType === GATES.NOT) ? 68 : (gateType === GATES.XNOR ? 84 : 79);
    const bubbleR = 4;
    const wireYStart = hasBubble ? bubbleX + bubbleR * 2 : (gateType === GATES.XOR ? 80 : 75);

    let xorSpine = '';
    if (gateType === GATES.XOR || gateType === GATES.XNOR) {
      xorSpine = '<path d="M 16,10 Q 26,30 16,50" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>';
    }

    let bubbleSvg = '';
    if (hasBubble) {
      bubbleSvg = `<circle cx="${bubbleX}" cy="30" r="${bubbleR}" fill="#0f172a" stroke="#94a3b8" stroke-width="2"/>`;
    }

    // Input wires
    let inputWiresSvg = '';
    if (isSingleInput) {
      inputWiresSvg = `
        <!-- Wire A -->
        <line x1="10" y1="30" x2="22" y2="30" class="${wireAClass}" stroke="${strokeA}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="10" cy="30" r="3.5" fill="${strokeA}"/>
        <text x="6" y="22" class="gate-pin-label">A = ${inputA}</text>
      `;
    } else {
      inputWiresSvg = `
        <!-- Wire A -->
        <line x1="5" y1="20" x2="20" y2="20" class="${wireAClass}" stroke="${strokeA}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="5" cy="20" r="3.5" fill="${strokeA}"/>
        <text x="4" y="14" class="gate-pin-label">A = ${inputA}</text>

        <!-- Wire B -->
        <line x1="5" y1="40" x2="20" y2="40" class="${wireBClass}" stroke="${strokeB}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="5" cy="40" r="3.5" fill="${strokeB}"/>
        <text x="4" y="54" class="gate-pin-label">B = ${inputB}</text>
      `;
    }

    const gatePath = getGateSymbolSvgPath(gateType);

    return `
      <svg class="gate-workbench-svg" viewBox="0 0 135 60" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${meta.name} Logic Diagram">
        <defs>
          <filter id="glowGate" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Wires -->
        ${inputWiresSvg}

        <!-- Output Wire -->
        <line x1="${wireYStart}" y1="30" x2="128" y2="30" class="${wireYClass}" stroke="${strokeY}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="128" cy="30" r="3.5" fill="${strokeY}"/>
        <text x="100" y="24" class="gate-pin-label" style="fill:${strokeY}; font-weight:700;">Y = ${output}</text>

        <!-- XOR Secondary Spine if applicable -->
        ${xorSpine}

        <!-- Gate Main Body -->
        <path d="${gatePath}" fill="#1e293b" stroke="#64748b" stroke-width="2.2" stroke-linejoin="round" />

        <!-- Inversion Bubble if applicable -->
        ${bubbleSvg}

        <!-- Center Gate Label -->
        <text x="${isSingleInput ? 34 : 38}" y="34" class="gate-center-type">${gateType}</text>
      </svg>
    `;
  }

  /**
   * Render Multi-Gate Production Controller Circuit Schematic as Inline SVG
   * @param {string} circuitId
   * @param {Object} telemetry Authoritative telemetry snapshot
   */
  function renderControllerCircuitSvg(circuitId, telemetry) {
    const circMeta = CONTROLLER_CIRCUIT_METADATA[circuitId] || CONTROLLER_CIRCUIT_METADATA[CONTROLLER_CIRCUITS.NS_GREEN];
    const data = telemetry.circuits[circuitId] || { output: 0, subTerms: {} };
    const out = data.output ? 1 : 0;
    const sub = data.subTerms || {};

    const highWire = 'stroke="#38bdf8" stroke-width="2.5" class="logic-wire logic-wire-high"';
    const lowWire = 'stroke="#334155" stroke-width="2" class="logic-wire logic-wire-low"';
    const greenWire = 'stroke="#4ade80" stroke-width="3" class="logic-wire logic-wire-high"';
    const redWire = 'stroke="#ef4444" stroke-width="3" class="logic-wire logic-wire-high"';

    switch (circuitId) {
      case CONTROLLER_CIRCUITS.NS_GREEN: {
        const s0 = sub.s0;
        const allRed = sub.allRed;
        const notAllRed = sub.notAllRed;
        const fault = sub.fault;
        const notFault = sub.notFault;

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="NS Green Circuit">
            <!-- Labels for Inputs -->
            <text x="8" y="23" class="circ-pin-text">S0 State: <tspan fill="${s0 ? '#38bdf8' : '#64748b'}">${s0}</tspan></text>
            <text x="8" y="63" class="circ-pin-text">All-Red: <tspan fill="${allRed ? '#f87171' : '#64748b'}">${allRed}</tspan></text>
            <text x="8" y="103" class="circ-pin-text">Safety Fault: <tspan fill="${fault ? '#f87171' : '#64748b'}">${fault}</tspan></text>

            <!-- Input Wire 1: S0 directly to AND gate -->
            <path d="M 85,20 L 210,20" fill="none" ${s0 ? highWire : lowWire}/>

            <!-- Input Wire 2: AllRed to NOT Gate 1 -->
            <path d="M 85,60 L 105,60" fill="none" ${allRed ? highWire : lowWire}/>
            <!-- NOT Gate 1 -->
            <path d="M 105,48 L 105,72 L 127,60 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="131" cy="60" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- NOT Gate 1 output to AND gate -->
            <path d="M 135,60 L 210,60" fill="none" ${notAllRed ? highWire : lowWire}/>

            <!-- Input Wire 3: Fault to NOT Gate 2 -->
            <path d="M 85,100 L 105,100" fill="none" ${fault ? highWire : lowWire}/>
            <!-- NOT Gate 2 -->
            <path d="M 105,88 L 105,112 L 127,100 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="131" cy="100" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- NOT Gate 2 output to AND gate -->
            <path d="M 135,100 L 175,100 L 175,80 L 210,80" fill="none" ${notFault ? highWire : lowWire}/>

            <!-- 3-Input AND Gate -->
            <path d="M 210,12 L 235,12 A 40,40 0 0,1 235,88 L 210,88 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="222" y="54" class="circ-gate-label">AND</text>

            <!-- Output Wire -->
            <path d="M 268,50 L 305,50" fill="none" ${out ? greenWire : lowWire}/>
            <circle cx="305" cy="50" r="4.5" fill="${out ? '#4ade80' : '#334155'}"/>
            <text x="245" y="105" class="circ-out-text">NS_Green = <tspan fill="${out ? '#4ade80' : '#94a3b8'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      case CONTROLLER_CIRCUITS.EW_GREEN: {
        const s2 = sub.s2;
        const allRed = sub.allRed;
        const notAllRed = sub.notAllRed;
        const fault = sub.fault;
        const notFault = sub.notFault;

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="EW Green Circuit">
            <!-- Labels for Inputs -->
            <text x="8" y="23" class="circ-pin-text">S2 State: <tspan fill="${s2 ? '#38bdf8' : '#64748b'}">${s2}</tspan></text>
            <text x="8" y="63" class="circ-pin-text">All-Red: <tspan fill="${allRed ? '#f87171' : '#64748b'}">${allRed}</tspan></text>
            <text x="8" y="103" class="circ-pin-text">Safety Fault: <tspan fill="${fault ? '#f87171' : '#64748b'}">${fault}</tspan></text>

            <!-- Input Wire 1: S2 directly to AND gate -->
            <path d="M 85,20 L 210,20" fill="none" ${s2 ? highWire : lowWire}/>

            <!-- Input Wire 2: AllRed to NOT Gate 1 -->
            <path d="M 85,60 L 105,60" fill="none" ${allRed ? highWire : lowWire}/>
            <!-- NOT Gate 1 -->
            <path d="M 105,48 L 105,72 L 127,60 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="131" cy="60" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- NOT Gate 1 output to AND gate -->
            <path d="M 135,60 L 210,60" fill="none" ${notAllRed ? highWire : lowWire}/>

            <!-- Input Wire 3: Fault to NOT Gate 2 -->
            <path d="M 85,100 L 105,100" fill="none" ${fault ? highWire : lowWire}/>
            <!-- NOT Gate 2 -->
            <path d="M 105,88 L 105,112 L 127,100 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="131" cy="100" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- NOT Gate 2 output to AND gate -->
            <path d="M 135,100 L 175,100 L 175,80 L 210,80" fill="none" ${notFault ? highWire : lowWire}/>

            <!-- 3-Input AND Gate -->
            <path d="M 210,12 L 235,12 A 40,40 0 0,1 235,88 L 210,88 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="222" y="54" class="circ-gate-label">AND</text>

            <!-- Output Wire -->
            <path d="M 268,50 L 305,50" fill="none" ${out ? greenWire : lowWire}/>
            <circle cx="305" cy="50" r="4.5" fill="${out ? '#4ade80' : '#334155'}"/>
            <text x="245" y="105" class="circ-out-text">EW_Green = <tspan fill="${out ? '#4ade80' : '#94a3b8'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      case CONTROLLER_CIRCUITS.SAFETY_HALT: {
        const emergencyAllRed = sub.emergencyAllRed;
        const invariantViolation = sub.invariantViolation;

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Safety Halt Circuit">
            <!-- Inputs -->
            <text x="8" y="38" class="circ-pin-text">All-Red Cmd: <tspan fill="${emergencyAllRed ? '#f87171' : '#64748b'}">${emergencyAllRed}</tspan></text>
            <text x="8" y="88" class="circ-pin-text">Invariant Fault: <tspan fill="${invariantViolation ? '#f87171' : '#64748b'}">${invariantViolation}</tspan></text>

            <!-- Input Wires -->
            <path d="M 115,35 L 170,35" fill="none" ${emergencyAllRed ? highWire : lowWire}/>
            <path d="M 115,85 L 170,85" fill="none" ${invariantViolation ? highWire : lowWire}/>

            <!-- 2-Input OR Gate -->
            <path d="M 166,20 Q 182,60 166,100 Q 212,96 245,60 Q 212,24 166,20 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="188" y="64" class="circ-gate-label">OR</text>

            <!-- Output Wire -->
            <path d="M 245,60 L 305,60" fill="none" ${out ? redWire : lowWire}/>
            <circle cx="305" cy="60" r="5" fill="${out ? '#ef4444' : '#334155'}"/>
            <text x="220" y="105" class="circ-out-text">Halt Active = <tspan fill="${out ? '#ef4444' : '#4ade80'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      case CONTROLLER_CIRCUITS.VEHICLE_ENTRY: {
        const signalGreen = sub.signalGreen !== undefined ? sub.signalGreen : (data.signalGreen ? 1 : 0);
        const conflictingOccupied = sub.conflictingOccupied !== undefined ? sub.conflictingOccupied : (data.conflictingOccupied ? 1 : 0);
        const notConflicting = sub.notConflicting !== undefined ? sub.notConflicting : (conflictingOccupied ? 0 : 1);
        const activeDir = (sub.entryDir || data.entryDir || 'north').toUpperCase();

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Vehicle Entry Circuit">
            <!-- Active Corridor Indicator -->
            <text x="8" y="16" class="circ-pin-text" style="font-weight:700; fill:#38bdf8;">Approach: ${activeDir}</text>

            <!-- Inputs -->
            <text x="8" y="38" class="circ-pin-text">Signal GREEN: <tspan fill="${signalGreen ? '#4ade80' : '#64748b'}">${signalGreen}</tspan></text>
            <text x="8" y="88" class="circ-pin-text">Conflict Blocked: <tspan fill="${conflictingOccupied ? '#f87171' : '#64748b'}">${conflictingOccupied}</tspan></text>

            <!-- Wire 1: Signal Green to AND gate pin 1 -->
            <path d="M 115,35 L 200,35" fill="none" ${signalGreen ? highWire : lowWire}/>

            <!-- Wire 2: Conflicting to NOT Gate -->
            <path d="M 115,85 L 135,85" fill="none" ${conflictingOccupied ? highWire : lowWire}/>
            <!-- NOT Gate -->
            <path d="M 135,73 L 135,97 L 157,85 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="161" cy="85" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- NOT Gate to AND gate pin 2 -->
            <path d="M 165,85 L 200,85" fill="none" ${notConflicting ? highWire : lowWire}/>

            <!-- 2-Input AND Gate -->
            <path d="M 200,20 L 225,20 A 35,35 0 0,1 225,95 L 200,95 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="210" y="62" class="circ-gate-label">AND</text>

            <!-- Output Wire -->
            <path d="M 255,60 L 305,60" fill="none" ${out ? greenWire : lowWire}/>
            <circle cx="305" cy="60" r="5" fill="${out ? '#4ade80' : '#334155'}"/>
            <text x="210" y="112" class="circ-out-text">Entry Granted = <tspan fill="${out ? '#4ade80' : '#94a3b8'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      case CONTROLLER_CIRCUITS.EMERGENCY_HOLD: {
        const activeEmergency = sub.activeEmergency;
        const targetGreenActive = sub.targetGreenActive;
        const vehicleCleared = sub.vehicleCleared;
        const notCleared = sub.notCleared;

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Emergency Priority Hold Circuit">
            <!-- Inputs -->
            <text x="8" y="23" class="circ-pin-text">Emergency: <tspan fill="${activeEmergency ? '#ef4444' : '#64748b'}">${activeEmergency}</tspan></text>
            <text x="8" y="63" class="circ-pin-text">Green Active: <tspan fill="${targetGreenActive ? '#4ade80' : '#64748b'}">${targetGreenActive}</tspan></text>
            <text x="8" y="103" class="circ-pin-text">Exit Cleared: <tspan fill="${vehicleCleared ? '#38bdf8' : '#64748b'}">${vehicleCleared}</tspan></text>

            <!-- Wire 1: Emergency directly to 3-Input AND -->
            <path d="M 95,20 L 210,20" fill="none" ${activeEmergency ? highWire : lowWire}/>

            <!-- Wire 2: Target Green directly to 3-Input AND -->
            <path d="M 95,60 L 210,60" fill="none" ${targetGreenActive ? highWire : lowWire}/>

            <!-- Wire 3: Cleared to Inverter -->
            <path d="M 95,100 L 120,100" fill="none" ${vehicleCleared ? highWire : lowWire}/>
            <path d="M 120,88 L 120,112 L 142,100 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <circle cx="146" cy="100" r="3.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- Inverter output to AND -->
            <path d="M 150,100 L 180,100 L 180,80 L 210,80" fill="none" ${notCleared ? highWire : lowWire}/>

            <!-- 3-Input AND Gate -->
            <path d="M 210,12 L 235,12 A 40,40 0 0,1 235,88 L 210,88 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="222" y="54" class="circ-gate-label">AND</text>

            <!-- Output Wire -->
            <path d="M 268,50 L 305,50" fill="none" ${out ? greenWire : lowWire}/>
            <circle cx="305" cy="50" r="4.5" fill="${out ? '#4ade80' : '#334155'}"/>
            <text x="210" y="108" class="circ-out-text">Hold Active = <tspan fill="${out ? '#f59e0b' : '#94a3b8'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      case CONTROLLER_CIRCUITS.INVARIANT_DEFENSE: {
        const nsGreen = sub.nsGreen;
        const nsYellow = sub.nsYellow;
        const nsActive = sub.nsActive;
        const ewGreen = sub.ewGreen;
        const ewYellow = sub.ewYellow;
        const ewActive = sub.ewActive;

        return `
          <svg class="circuit-schematic-svg" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Invariant Defense Circuit">
            <!-- Inputs NS -->
            <text x="6" y="20" class="circ-pin-text">NS_G: <tspan fill="${nsGreen ? '#4ade80' : '#64748b'}">${nsGreen}</tspan></text>
            <text x="6" y="45" class="circ-pin-text">NS_Y: <tspan fill="${nsYellow ? '#facc15' : '#64748b'}">${nsYellow}</tspan></text>

            <!-- Inputs EW -->
            <text x="6" y="78" class="circ-pin-text">EW_G: <tspan fill="${ewGreen ? '#4ade80' : '#64748b'}">${ewGreen}</tspan></text>
            <text x="6" y="103" class="circ-pin-text">EW_Y: <tspan fill="${ewYellow ? '#facc15' : '#64748b'}">${ewYellow}</tspan></text>

            <!-- NS OR Gate -->
            <path d="M 52,18 L 85,18" fill="none" ${nsGreen ? highWire : lowWire}/>
            <path d="M 52,43 L 85,43" fill="none" ${nsYellow ? highWire : lowWire}/>
            <path d="M 83,10 Q 94,30 83,50 Q 112,48 130,30 Q 112,12 83,10 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <text x="96" y="33" class="circ-gate-label" style="font-size:7px;">OR</text>

            <!-- EW OR Gate -->
            <path d="M 52,76 L 85,76" fill="none" ${ewGreen ? highWire : lowWire}/>
            <path d="M 52,101 L 85,101" fill="none" ${ewYellow ? highWire : lowWire}/>
            <path d="M 83,68 Q 94,88 83,108 Q 112,106 130,88 Q 112,70 83,68 Z" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
            <text x="96" y="91" class="circ-gate-label" style="font-size:7px;">OR</text>

            <!-- Connect to 2-Input AND Gate -->
            <path d="M 130,30 L 175,30 L 175,45 L 210,45" fill="none" ${nsActive ? highWire : lowWire}/>
            <path d="M 130,88 L 175,88 L 175,70 L 210,70" fill="none" ${ewActive ? highWire : lowWire}/>

            <!-- Main AND Gate -->
            <path d="M 210,32 L 232,32 A 26,26 0 0,1 232,84 L 210,84 Z" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
            <text x="218" y="61" class="circ-gate-label">AND</text>

            <!-- Output Wire -->
            <path d="M 255,58 L 305,58" fill="none" ${out ? redWire : lowWire}/>
            <circle cx="305" cy="58" r="5" fill="${out ? '#ef4444' : '#4ade80'}"/>
            <text x="210" y="106" class="circ-out-text">Hazard Trip = <tspan fill="${out ? '#ef4444' : '#4ade80'}" font-weight="700">${out}</tspan></text>
          </svg>
        `;
      }

      default:
        return `<svg viewBox="0 0 100 50"><text x="10" y="25" fill="#fff">Unknown Circuit</text></svg>`;
    }
  }

  // -------------------------------------------------------------
  // 7. PUBLIC API & EXPORT
  // -------------------------------------------------------------

  return {
    GATES,
    GATE_METADATA,
    CONTROLLER_CIRCUITS,
    CONTROLLER_CIRCUIT_METADATA,
    evaluateGate,
    evaluateNSGreenCircuit,
    evaluateEWGreenCircuit,
    evaluateSafetyHaltCircuit,
    evaluateVehicleEntryCircuit,
    evaluateEmergencyHoldCircuit,
    evaluateInvariantDefenseCircuit,
    getLogicTelemetry,
    LearningModeState,
    renderSingleGateSvg,
    renderControllerCircuitSvg
  };
});
