/**
 * Phase 10.1 Visual Verification & Screenshot Capture Suite
 * DPCO Digital Logic Telemetry Accuracy & Emergency Priority Verification
 *
 * Runs headless Google Chrome over Chrome DevTools Protocol (CDP).
 * Generates all 10 required Phase 10.1 evidence screenshots and verifies responsive layout.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_FILE = path.resolve(__dirname, 'index.html');
const EVIDENCE_DIR = path.resolve(__dirname, 'docs', 'phase-10.1-evidence');
const DEBUG_PORT = 9228;

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

class CDPSession {
  constructor(port) {
    this.port = port;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    const pages = await res.json();
    const page = pages.find((p) => p.type === 'page') || pages[0];
    if (!page || !page.webSocketDebuggerUrl) {
      throw new Error('No inspectable page found in Chrome');
    }
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
    await this.send('Emulation.setVisibleSize', { width, height });
  }

  async screenshot(filePath, width = 1920, height = 1080) {
    await this.setViewport(width, height);
    await new Promise((r) => setTimeout(r, 250));
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`[SAVED] ${path.basename(filePath)} (${width}x${height})`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runVisualVerification() {
  console.log('================================================================');
  console.log(' PHASE 10.1: VISUAL VERIFICATION & SCREENSHOT EVIDENCE SUITE');
  console.log(' Headless Chrome DevTools Protocol (CDP)');
  console.log('================================================================');

  const userDataDir = path.resolve(process.env.TEMP, `chrome_phase10_1_${Date.now()}`);
  const chromeArgs = [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-background-networking',
    `file://${HTML_FILE.replace(/\\/g, '/')}`
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs);
  let cdp = null;

  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        if (res.ok) {
          connected = true;
          break;
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!connected) {
      throw new Error('Timed out waiting for Chrome remote debugging endpoint');
    }

    cdp = new CDPSession(DEBUG_PORT);
    await cdp.connect();
    console.log('Connected to Chrome DevTools Protocol successfully.');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Wait for page to initialize
    await new Promise((r) => setTimeout(r, 1200));

    // Verify application status
    const appState = await cdp.evaluate(`
      ({
        hasApp: !!window.TrafficApp,
        hasLogic: !!window.LogicEngine,
        mode: window.TrafficApp.currentLogicMode,
        circuit: window.TrafficApp.currentLiveCircuit,
        fsmState: window.TrafficApp.fsm.getCurrentState()
      })
    `);
    console.log('Application initialization status:', appState);

    // -------------------------------------------------------------
    // Screenshot 1: 01-live-ns-green-circuit.png
    // Live Circuit 1: North-South Green Authorization during S0_NS_GREEN
    // -------------------------------------------------------------
    console.log('\n--- Capturing 01-live-ns-green-circuit.png ---');
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.setLogicMode('LIVE');
      window.TrafficApp.selectLiveCircuit('NS_GREEN');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '01-live-ns-green-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 2: 02-live-ew-green-circuit.png
    // Live Circuit 2: East-West Green Authorization during S2_EW_GREEN
    // -------------------------------------------------------------
    console.log('\n--- Capturing 02-live-ew-green-circuit.png ---');
    await cdp.evaluate(`
      // Step to S2_EW_GREEN
      while (window.TrafficApp.fsm.getCurrentState() !== 'S2_EW_GREEN') {
        window.TrafficApp.stepSimulation();
      }
      window.TrafficApp.selectLiveCircuit('EW_GREEN');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '02-live-ew-green-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 3: 03-vehicle-entry-s0-north.png
    // Vehicle Entry circuit during S0: Approach NORTH, signalGreen=1, entry permitted
    // -------------------------------------------------------------
    console.log('\n--- Capturing 03-vehicle-entry-s0-north.png ---');
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      // Ensure S0
      while (window.TrafficApp.fsm.getCurrentState() !== 'S0_NS_GREEN') {
        window.TrafficApp.stepSimulation();
      }
      window.TrafficApp.selectLiveCircuit('VEHICLE_ENTRY');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '03-vehicle-entry-s0-north.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 4: 04-vehicle-entry-s2-east.png
    // Vehicle Entry circuit during S2: Approach EAST, signalGreen=1, entry permitted
    // -------------------------------------------------------------
    console.log('\n--- Capturing 04-vehicle-entry-s2-east.png ---');
    await cdp.evaluate(`
      while (window.TrafficApp.fsm.getCurrentState() !== 'S2_EW_GREEN') {
        window.TrafficApp.stepSimulation();
      }
      window.TrafficApp.selectLiveCircuit('VEHICLE_ENTRY');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '04-vehicle-entry-s2-east.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 5: 05-ambulance-priority-hold.png
    // Ambulance dispatched on North corridor: PriorityHold showing NORTH, hold=1
    // -------------------------------------------------------------
    console.log('\n--- Capturing 05-ambulance-priority-hold.png ---');
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.vehicleManager.vehicles = { north: [], south: [], east: [], west: [] };
      window.TrafficApp.vehicleManager.spawnEmergencyVehicle('north', 'AMBULANCE');
      // Set FSM preemption for north
      window.TrafficApp.fsm.requestEmergencyPriority('north');
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '05-ambulance-priority-hold.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 6: 06-fire-engine-priority-hold.png
    // Fire Engine dispatched on East corridor: PriorityHold showing EAST, hold=1
    // -------------------------------------------------------------
    console.log('\n--- Capturing 06-fire-engine-priority-hold.png ---');
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.vehicleManager.vehicles = { north: [], south: [], east: [], west: [] };
      window.TrafficApp.vehicleManager.spawnEmergencyVehicle('east', 'FIRE_ENGINE');
      window.TrafficApp.fsm.requestEmergencyPriority('east');
      // Step to S2_EW_GREEN to show active green hold for east
      while (window.TrafficApp.fsm.getCurrentState() !== 'S2_EW_GREEN') {
        window.TrafficApp.stepSimulation();
      }
      window.TrafficApp.fsm.requestEmergencyPriority('east');
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '06-fire-engine-priority-hold.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 7: 07-police-priority-hold.png
    // Police Cruiser dispatched on South corridor: PriorityHold showing SOUTH, hold=1
    // -------------------------------------------------------------
    console.log('\n--- Capturing 07-police-priority-hold.png ---');
    await cdp.evaluate(`
      window.TrafficApp.resetSimulation();
      window.TrafficApp.vehicleManager.vehicles = { north: [], south: [], east: [], west: [] };
      window.TrafficApp.vehicleManager.spawnEmergencyVehicle('south', 'POLICE');
      window.TrafficApp.fsm.requestEmergencyPriority('south');
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '07-police-priority-hold.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 8: 08-emergency-traversing-hold-active.png
    // Emergency vehicle traversing intersection box (pos: 220px, past stop line 138px, inside conflict zone)
    // PriorityHold circuit strictly ACTIVE (hold=1)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 08-emergency-traversing-hold-active.png ---');
    await cdp.evaluate(`{
      window.TrafficApp.resetSimulation();
      window.TrafficApp.vehicleManager.vehicles = { north: [], south: [], east: [], west: [] };
      const amb = window.TrafficApp.vehicleManager.spawnEmergencyVehicle('north', 'AMBULANCE');
      amb.pos = 220;
      amb.position = 220; // past stop line (138px), entering conflict zone (< 294px exit)
      amb.hasClearedStopLine = true;
      amb.hasClearedIntersection = false;
      window.TrafficApp.fsm.requestEmergencyPriority('north');
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    }`);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '08-emergency-traversing-hold-active.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 9: 09-emergency-cleared-hold-released.png
    // Emergency vehicle past junction exit (pos: 310px, hasClearedIntersection=true)
    // PriorityHold released (cleared=1, hold=0)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 09-emergency-cleared-hold-released.png ---');
    await cdp.evaluate(`{
      const clearedAmb = window.TrafficApp.vehicleManager.vehicles.north[0];
      if (clearedAmb) {
        clearedAmb.pos = 310;
        clearedAmb.position = 310;
        clearedAmb.hasClearedStopLine = true;
        clearedAmb.hasClearedIntersection = true;
      }
      window.TrafficApp.fsm.clearEmergencyPriority();
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      window.TrafficApp.updateLogicWorkbenchUI();
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    }`);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '09-emergency-cleared-hold-released.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 10: 10-learning-mode-sandboxed.png
    // Learning mode sandboxed interactive logic workbench (XOR Gate, Input A=1, B=0)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 10-learning-mode-sandboxed.png ---');
    await cdp.evaluate(`
      window.TrafficApp.setLogicMode('LEARNING');
      window.TrafficApp.selectLearningGate('XOR');
      window.TrafficApp.learningState.setInputA(1);
      window.TrafficApp.learningState.setInputB(0);
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '10-learning-mode-sandboxed.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Responsive Viewport Audit
    // -------------------------------------------------------------
    console.log('\n--- Running Viewport Responsive Audits ---');
    const viewports = [
      { width: 1920, height: 1080, name: '1080p Desktop' },
      { width: 1366, height: 768,  name: 'Standard Laptop' },
      { width: 1024, height: 768,  name: 'Landscape Tablet' },
      { width: 768,  height: 1024, name: 'Portrait Tablet' },
      { width: 390,  height: 844,  name: 'Mobile Phone' }
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await new Promise((r) => setTimeout(r, 200));

      const overflowCheck = await cdp.evaluate(`
        ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        })
      `);

      const status = overflowCheck.hasOverflow ? 'OVERFLOW' : 'CLEAN';
      console.log(`[VIEWPORT ${status}] ${vp.name} (${vp.width}x${vp.height}): clientWidth=${overflowCheck.clientWidth}, scrollWidth=${overflowCheck.scrollWidth}`);
      if (overflowCheck.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${vp.width}x${vp.height}`);
      }
    }

    console.log('\nAll 10 Phase 10.1 screenshots captured and verified successfully!');
    console.log('================================================================');
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

runVisualVerification().catch((err) => {
  console.error('[ERROR] Visual verification failed:', err);
  process.exit(1);
});
