/**
 * Phase 10 Visual Verification & Screenshot Capture Suite
 * DPCO Digital Logic Gate Workbench Integration
 *
 * Runs headless Google Chrome over Chrome DevTools Protocol (CDP).
 * Generates all 8 required Phase 10 evidence screenshots and verifies responsive layout.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_FILE = path.resolve(__dirname, 'index.html');
const EVIDENCE_DIR = path.resolve(__dirname, 'docs', 'phase-10-evidence');
const DEBUG_PORT = 9226;

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
    await new Promise((r) => setTimeout(r, 200));
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
  console.log(' PHASE 10: VISUAL VERIFICATION & SCREENSHOT EVIDENCE SUITE');
  console.log(' Headless Chrome DevTools Protocol (CDP)');
  console.log('================================================================');

  const userDataDir = path.resolve(process.env.TEMP, `chrome_phase10_${Date.now()}`);
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
    // Wait for Chrome remote debugging endpoint
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

    // Verify window.TrafficApp and logic workbench
    const appState = await cdp.evaluate(`
      ({
        hasApp: !!window.TrafficApp,
        hasLogic: !!window.LogicEngine,
        mode: window.TrafficApp.currentLogicMode,
        circuit: window.TrafficApp.currentLiveCircuit
      })
    `);
    console.log('Application initialization status:', appState);

    // -------------------------------------------------------------
    // Screenshot 1: Complete Dashboard with New Logic Workbench Panel
    // -------------------------------------------------------------
    await cdp.evaluate(`window.TrafficApp.startSimulation();`);
    await new Promise((r) => setTimeout(r, 600));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '01-complete-dashboard-with-workbench.png'), 1920, 1180);

    // -------------------------------------------------------------
    // Screenshot 2: Standard Gate Workbench in Learning Mode
    // -------------------------------------------------------------
    await cdp.evaluate(`
      window.TrafficApp.setLogicMode('LEARNING');
      window.TrafficApp.selectLearningGate('XOR');
      window.TrafficApp.learningState.setInputA(1);
      window.TrafficApp.learningState.setInputB(0);
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '02-standard-gate-workbench-learning-mode.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 3: Live Circuit 1 — North-South Green Authorization
    // -------------------------------------------------------------
    await cdp.evaluate(`
      window.TrafficApp.setLogicMode('LIVE');
      window.TrafficApp.selectLiveCircuit('NS_GREEN');
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '03-live-ns-green-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 4: Live Circuit 2 — East-West Green Authorization
    // -------------------------------------------------------------
    await cdp.evaluate(`
      // Step to S2 (EW Green)
      while (window.TrafficApp.fsm.getCurrentState() !== 'S2_EW_GREEN') {
        window.TrafficApp.stepSimulation();
      }
      window.TrafficApp.selectLiveCircuit('EW_GREEN');
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '04-live-ew-green-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 5: Live Circuit 3 — All-Red Safety Interlock
    // -------------------------------------------------------------
    await cdp.evaluate(`
      window.TrafficApp.toggleAllRedHalt();
      window.TrafficApp.selectLiveCircuit('SAFETY_HALT');
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '05-all-red-safety-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 6: Live Circuit 5 — Emergency Priority Hold Interlock
    // -------------------------------------------------------------
    await cdp.evaluate(`
      // Resume from All-Red and dispatch ambulance
      window.TrafficApp.toggleAllRedHalt();
      window.TrafficApp.vehicleManager.spawnEmergencyVehicle('north', 'AMBULANCE');
      window.TrafficApp.selectLiveCircuit('EMERGENCY_HOLD');
      document.getElementById('panelLogicWorkbench').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 600));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '06-emergency-priority-circuit.png'), 1920, 1080);

    // -------------------------------------------------------------
    // Screenshot 7: Learning Mode Dynamic Truth Table (Detailed View)
    // -------------------------------------------------------------
    await cdp.evaluate(`
      window.TrafficApp.setLogicMode('LEARNING');
      window.TrafficApp.selectLearningGate('NAND');
      window.TrafficApp.learningState.setInputA(1);
      window.TrafficApp.learningState.setInputB(1);
      document.getElementById('learningTruthTable').scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '07-learning-mode-truth-table.png'), 1366, 768);

    // -------------------------------------------------------------
    // Screenshot 8: Mobile Workbench Responsive Stacked Layout
    // -------------------------------------------------------------
    await cdp.evaluate(`
      window.TrafficApp.setLogicMode('LIVE');
      window.TrafficApp.selectLiveCircuit('NS_GREEN');
      window.scrollTo(0, 360);
    `);
    await new Promise((r) => setTimeout(r, 400));
    await cdp.screenshot(path.join(EVIDENCE_DIR, '08-mobile-workbench-layout.png'), 390, 844);

    // -------------------------------------------------------------
    // Viewport Responsive Audits (1920, 1366, 1024, 768, 390)
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

    console.log('\nAll 8 Phase 10 screenshots captured and verified successfully!');
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
