/**
 * Traffic Light Controller - Application Controller
 * Coordinates UI, DOM updates, countdown timer, FSM transitions,
 * and real-time safety invariant assertions.
 */

(function () {
  'use strict';

  // Simulation status constants
  const SIM_STATUS = {
    STOPPED: 'STOPPED',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED'
  };

  // State instances
  let fsm = null;
  let simStatus = SIM_STATUS.STOPPED;
  let timerInterval = null;
  let remainingSeconds = 10;
  let elapsedSeconds = 0;
  let speedMultiplier = 1;
  let verifiedTransitionCount = 0;
  let violationCount = 0;

  // DOM Elements cache
  const elements = {
    // Buttons & Controls
    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnReset: document.getElementById('btnReset'),
    btnStep: document.getElementById('btnStep'),
    speedSelect: document.getElementById('speedSelect'),
    btnRunVerification: document.getElementById('btnRunVerification'),
    btnClearLog: document.getElementById('btnClearLog'),

    // Badges & Labels
    badgeStatus: document.getElementById('badgeStatus'),
    badgeInvariant: document.getElementById('badgeInvariant'),
    activeAxisLabel: document.getElementById('activeAxisLabel'),

    // Signals & Timers
    timers: {
      north: document.getElementById('timerNorth'),
      south: document.getElementById('timerSouth'),
      east: document.getElementById('timerEast'),
      west: document.getElementById('timerWest')
    },
    lamps: {
      north: {
        red: document.getElementById('lampNorthRed'),
        yellow: document.getElementById('lampNorthYellow'),
        green: document.getElementById('lampNorthGreen')
      },
      south: {
        red: document.getElementById('lampSouthRed'),
        yellow: document.getElementById('lampSouthYellow'),
        green: document.getElementById('lampSouthGreen')
      },
      east: {
        red: document.getElementById('lampEastRed'),
        yellow: document.getElementById('lampEastYellow'),
        green: document.getElementById('lampEastGreen')
      },
      west: {
        red: document.getElementById('lampWestRed'),
        yellow: document.getElementById('lampWestYellow'),
        green: document.getElementById('lampWestGreen')
      }
    },
    flowNS: document.getElementById('flowNS'),
    flowEW: document.getElementById('flowEW'),

    // State Inspection Card
    stateTitle: document.getElementById('stateTitle'),
    stateIdBadge: document.getElementById('stateIdBadge'),
    stateDesc: document.getElementById('stateDesc'),
    countdownSeconds: document.getElementById('countdownSeconds'),
    elapsedSeconds: document.getElementById('elapsedSeconds'),
    progressBarFill: document.getElementById('progressBarFill'),

    // Safety Proof Card
    safetyCard: document.getElementById('safetyCard'),
    safetyStatusLabel: document.getElementById('safetyStatusLabel'),
    safetyEquation: document.getElementById('safetyEquation'),
    safetyMetrics: document.getElementById('safetyMetrics'),

    // State Table
    stateTableBody: document.getElementById('stateTableBody'),

    // Verification Drawer
    verificationList: document.getElementById('verificationList'),
    testSummaryBadge: document.getElementById('testSummaryBadge'),

    // Log
    eventLog: document.getElementById('eventLog')
  };

  /**
   * Initialize Application
   */
  function init() {
    fsm = new window.TrafficFSM();
    const meta = fsm.getCurrentStateMetadata();
    remainingSeconds = meta.duration;
    elapsedSeconds = 0;

    renderStateTable();
    updateUI();
    attachEventListeners();
    logEvent('Controller initialized. Initial state: ' + meta.code + ' (' + meta.title + ')');

    // Run initial verification to assert startup health
    runAutomatedVerification(false);
  }

  /**
   * Render the 4-State Cycle Table
   */
  function renderStateTable() {
    const states = fsm.getAllStateMetadata();
    elements.stateTableBody.innerHTML = '';

    states.forEach((s) => {
      const tr = document.createElement('tr');
      tr.id = `row-${s.key}`;
      if (s.key === fsm.getCurrentState()) {
        tr.classList.add('active-row');
      }

      const nsClass = s.northSouth.toLowerCase();
      const ewClass = s.eastWest.toLowerCase();

      tr.innerHTML = `
        <td><strong style="color:#60a5fa;">${s.code}</strong> (${s.axisActive})</td>
        <td><span class="light-pill ${nsClass}">${s.northSouth}</span></td>
        <td><span class="light-pill ${ewClass}">${s.eastWest}</span></td>
        <td>
          <input type="number" min="1" max="120" value="${s.duration}" 
                 class="duration-input" data-state="${s.key}" aria-label="Duration for ${s.code}">
        </td>
        <td style="font-family:var(--font-mono); color:#94a3b8;">${s.nextState}</td>
      `;
      elements.stateTableBody.appendChild(tr);
    });

    // Listen for duration updates
    const inputs = elements.stateTableBody.querySelectorAll('.duration-input');
    inputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const stateKey = e.target.getAttribute('data-state');
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          fsm.setDuration(stateKey, val);
          if (fsm.getCurrentState() === stateKey && simStatus === SIM_STATUS.STOPPED) {
            remainingSeconds = val;
            updateUI();
          }
          logEvent(`Duration for ${stateKey} updated to ${val}s`);
        }
      });
    });
  }

  /**
   * Update all Visual Lamps based on current FSM signal outputs
   */
  function updateSignalsUI(signals) {
    const directions = ['north', 'south', 'east', 'west'];

    directions.forEach((dir) => {
      const color = signals[dir];
      const lamps = elements.lamps[dir];

      // Reset all lamps in this unit
      lamps.red.classList.remove('active');
      lamps.yellow.classList.remove('active');
      lamps.green.classList.remove('active');

      // Light up the active lamp
      if (color === window.TrafficFSM.LIGHTS.RED) {
        lamps.red.classList.add('active');
      } else if (color === window.TrafficFSM.LIGHTS.YELLOW) {
        lamps.yellow.classList.add('active');
      } else if (color === window.TrafficFSM.LIGHTS.GREEN) {
        lamps.green.classList.add('active');
      }

      // Update countdown display
      elements.timers[dir].textContent = remainingSeconds;
    });

    // Update traffic flow indicators
    const nsActive = signals.north === window.TrafficFSM.LIGHTS.GREEN;
    const nsCaution = signals.north === window.TrafficFSM.LIGHTS.YELLOW;
    const ewActive = signals.east === window.TrafficFSM.LIGHTS.GREEN;
    const ewCaution = signals.east === window.TrafficFSM.LIGHTS.YELLOW;

    if (nsActive) {
      elements.flowNS.className = 'flow-indicator flow-ns flow-active';
      elements.flowNS.textContent = 'NS FLOWING (GREEN)';
    } else if (nsCaution) {
      elements.flowNS.className = 'flow-indicator flow-ns';
      elements.flowNS.style.background = 'rgba(245, 158, 11, 0.25)';
      elements.flowNS.style.color = '#fbbf24';
      elements.flowNS.style.border = '1px solid #f59e0b';
      elements.flowNS.textContent = 'NS CLEARING (YELLOW)';
    } else {
      elements.flowNS.className = 'flow-indicator flow-ns flow-stopped';
      elements.flowNS.style.background = '';
      elements.flowNS.style.color = '';
      elements.flowNS.style.border = '';
      elements.flowNS.textContent = 'NS STOPPED (RED)';
    }

    if (ewActive) {
      elements.flowEW.className = 'flow-indicator flow-ew flow-active';
      elements.flowEW.textContent = 'EW FLOWING (GREEN)';
    } else if (ewCaution) {
      elements.flowEW.className = 'flow-indicator flow-ew';
      elements.flowEW.style.background = 'rgba(245, 158, 11, 0.25)';
      elements.flowEW.style.color = '#fbbf24';
      elements.flowEW.style.border = '1px solid #f59e0b';
      elements.flowEW.textContent = 'EW CLEARING (YELLOW)';
    } else {
      elements.flowEW.className = 'flow-indicator flow-ew flow-stopped';
      elements.flowEW.style.background = '';
      elements.flowEW.style.color = '';
      elements.flowEW.style.border = '';
      elements.flowEW.textContent = 'EW STOPPED (RED)';
    }
  }

  /**
   * Continuous Safety Invariant Monitor & Real-time Formal Assertion
   */
  function checkAndRenderSafety(signals) {
    const safety = fsm.validateSafety(signals);
    verifiedTransitionCount++;

    const nsGreen = signals.north === window.TrafficFSM.LIGHTS.GREEN;
    const ewGreen = signals.east === window.TrafficFSM.LIGHTS.GREEN;
    const conflictOccurred = nsGreen && ewGreen;

    if (!safety.isSafe || conflictOccurred) {
      violationCount++;
      elements.badgeInvariant.className = 'badge badge-invariant violated';
      elements.badgeInvariant.textContent = 'CRITICAL: INVARIANT VIOLATION';

      elements.safetyCard.className = 'invariant-card violation';
      elements.safetyStatusLabel.textContent = 'HAZARD DETECTED';
      elements.safetyEquation.textContent = 'VIOLATION: Conflicting directions have active green!';
      elements.safetyMetrics.textContent = `Checks: ${verifiedTransitionCount} | VIOLATIONS: ${violationCount}`;

      // Failsafe: Emergency pause
      pauseSimulation();
      logEvent(`EMERGENCY: Safety Invariant violated! Execution halted.`);
      return false;
    }

    elements.badgeInvariant.className = 'badge badge-invariant';
    elements.badgeInvariant.textContent = 'INVARIANT: CONFLICT-FREE';

    elements.safetyCard.className = 'invariant-card';
    elements.safetyStatusLabel.textContent = 'ALL CHECKS PASSED';
    elements.safetyEquation.innerHTML = `Condition: (NS == GREEN) &and; (EW == GREEN) &equiv; FALSE &nbsp;&bull;&nbsp; <strong style="color:#6ee7b7;">VERIFIED SAFE</strong>`;
    elements.safetyMetrics.textContent = `Verified continuous cycles: ${verifiedTransitionCount} | Violations: 0 | Conflict isolation: 100%`;

    return true;
  }

  /**
   * Update full UI (cards, table rows, badges, countdowns)
   */
  function updateUI() {
    const meta = fsm.getCurrentStateMetadata();
    const signals = fsm.getSignals();

    // Check safety
    checkAndRenderSafety(signals);

    // Update Signals
    updateSignalsUI(signals);

    // Update State Card
    elements.stateTitle.textContent = `${meta.code}: ${meta.title}`;
    elements.stateIdBadge.textContent = `Phase ${meta.id + 1} of 4`;
    elements.stateDesc.textContent = meta.description;
    elements.activeAxisLabel.textContent = `Active Axis: ${meta.axisActive}`;

    // Countdown and Progress
    elements.countdownSeconds.textContent = `${remainingSeconds}s`;
    elements.elapsedSeconds.textContent = `${elapsedSeconds}s`;
    const totalDuration = meta.duration;
    const percentage = Math.max(0, Math.min(100, (remainingSeconds / totalDuration) * 100));
    elements.progressBarFill.style.width = `${percentage}%`;

    // Active row highlight in state table
    const allRows = elements.stateTableBody.querySelectorAll('tr');
    allRows.forEach((row) => row.classList.remove('active-row'));
    const activeRow = document.getElementById(`row-${meta.nextState ? fsm.getCurrentState() : ''}`);
    if (activeRow) {
      activeRow.classList.add('active-row');
    }

    // Status Badge
    updateStatusBadge();
  }

  function updateStatusBadge() {
    elements.badgeStatus.className = 'badge badge-status';
    if (simStatus === SIM_STATUS.RUNNING) {
      elements.badgeStatus.classList.add('running');
      elements.badgeStatus.textContent = 'SIMULATION: RUNNING';
      elements.btnStart.disabled = true;
      elements.btnPause.disabled = false;
    } else if (simStatus === SIM_STATUS.PAUSED) {
      elements.badgeStatus.classList.add('paused');
      elements.badgeStatus.textContent = 'SIMULATION: PAUSED';
      elements.btnStart.disabled = false;
      elements.btnPause.disabled = true;
    } else {
      elements.badgeStatus.classList.add('stopped');
      elements.badgeStatus.textContent = 'SIMULATION: STOPPED';
      elements.btnStart.disabled = false;
      elements.btnPause.disabled = true;
    }
  }

  /**
   * Simulation Timer Tick Handler (runs once per simulated second)
   */
  function tick() {
    if (simStatus !== SIM_STATUS.RUNNING) return;

    remainingSeconds--;
    elapsedSeconds++;

    if (remainingSeconds <= 0) {
      // Transition to next FSM state
      const res = fsm.step();
      remainingSeconds = res.metadata.duration;
      elapsedSeconds = 0;
      logEvent(`FSM Transition &rarr; ${res.metadata.code} (${res.metadata.title}) [${res.metadata.duration}s]`);
    }

    updateUI();
  }

  /**
   * Start or Resume Simulation
   */
  function startSimulation() {
    if (simStatus === SIM_STATUS.RUNNING) return;

    simStatus = SIM_STATUS.RUNNING;
    updateStatusBadge();

    const intervalMs = Math.round(1000 / speedMultiplier);
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, intervalMs);

    logEvent(`Simulation started at ${speedMultiplier}x speed.`);
  }

  /**
   * Pause Simulation
   */
  function pauseSimulation() {
    if (simStatus !== SIM_STATUS.RUNNING) return;

    simStatus = SIM_STATUS.PAUSED;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateStatusBadge();
    logEvent('Simulation paused.');
  }

  /**
   * Reset Simulation to Initial State (S0)
   */
  function resetSimulation() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    simStatus = SIM_STATUS.STOPPED;
    fsm.reset();
    const meta = fsm.getCurrentStateMetadata();
    remainingSeconds = meta.duration;
    elapsedSeconds = 0;

    updateUI();
    logEvent('Simulation reset to State S0 (NS Green / EW Red).');
  }

  /**
   * Manual Single-Step Transition
   */
  function manualStep() {
    // If running, pause first
    if (simStatus === SIM_STATUS.RUNNING) {
      pauseSimulation();
    }

    const res = fsm.step();
    remainingSeconds = res.metadata.duration;
    elapsedSeconds = 0;

    updateUI();
    logEvent(`Manual Step &rarr; ${res.metadata.code} (${res.metadata.title})`);
  }

  /**
   * Run the formal Verification Suite and display results in UI
   */
  function runAutomatedVerification(logToConsole = true) {
    if (!window.FSMVerifier) return;

    const results = window.FSMVerifier.runVerificationSuite();
    elements.verificationList.innerHTML = '';

    results.details.forEach((item) => {
      const div = document.createElement('div');
      div.className = `test-item ${item.status === 'FAIL' ? 'failed' : ''}`;
      div.innerHTML = `
        <span class="test-badge ${item.status === 'FAIL' ? 'fail' : ''}">[${item.status}]</span>
        <span class="test-name">${item.test}</span>
      `;
      elements.verificationList.appendChild(div);
    });

    if (results.failed === 0) {
      elements.testSummaryBadge.style.background = '#064e3b';
      elements.testSummaryBadge.style.color = '#6ee7b7';
      elements.testSummaryBadge.textContent = `${results.passed}/${results.total} Passed (100%)`;
      if (logToConsole) {
        logEvent(`Verification suite passed: all ${results.total} formal assertions verified.`);
      }
    } else {
      elements.testSummaryBadge.style.background = '#7f1d1d';
      elements.testSummaryBadge.style.color = '#fca5a5';
      elements.testSummaryBadge.textContent = `${results.failed} Failed!`;
      if (logToConsole) {
        logEvent(`Verification suite failed: ${results.failed} tests failed!`);
      }
    }
  }

  /**
   * Event Logging
   */
  function logEvent(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timeStr = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
    elements.eventLog.prepend(entry);

    // Keep log bounded to 50 items
    while (elements.eventLog.children.length > 50) {
      elements.eventLog.removeChild(elements.eventLog.lastChild);
    }
  }

  /**
   * Attach UI Event Listeners
   */
  function attachEventListeners() {
    elements.btnStart.addEventListener('click', startSimulation);
    elements.btnPause.addEventListener('click', pauseSimulation);
    elements.btnReset.addEventListener('click', resetSimulation);
    elements.btnStep.addEventListener('click', manualStep);

    elements.speedSelect.addEventListener('change', (e) => {
      speedMultiplier = parseFloat(e.target.value) || 1;
      logEvent(`Speed changed to ${speedMultiplier}x.`);
      if (simStatus === SIM_STATUS.RUNNING) {
        // Restart interval with new speed
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, Math.round(1000 / speedMultiplier));
      }
    });

    elements.btnRunVerification.addEventListener('click', () => {
      runAutomatedVerification(true);
    });

    elements.btnClearLog.addEventListener('click', () => {
      elements.eventLog.innerHTML = '';
      logEvent('Log cleared.');
    });
  }

  // Self-boot when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
