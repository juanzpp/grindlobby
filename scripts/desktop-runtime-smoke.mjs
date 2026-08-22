const DEBUG_URL = process.env.GRIND_DESKTOP_DEBUG_URL || "http://127.0.0.1:9222";
const deadline = Date.now() + 90_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForTarget() {
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${DEBUG_URL}/json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`DevTools returned ${response.status}`);
      const targets = await response.json();
      const target = targets.find((entry) => entry.type === "page" && entry.url?.startsWith("https://grindlobby.onrender.com"));
      if (target?.webSocketDebuggerUrl) return target;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for GrindLobby WebView2 target${lastError ? `: ${lastError.message}` : ""}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to WebView2 DevTools")), 15_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Failed to connect to WebView2 DevTools"));
      }, { once: true });
      this.socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      });
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result?.value;
}

const target = await waitForTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.connect();
await client.call("Runtime.enable");

try {
  const capabilities = await evaluate(client, `(() => ({
    url: location.href,
    origin: location.origin,
    readyState: document.readyState,
    secureContext: window.isSecureContext,
    desktopMarker: window.__GRIND_DESKTOP__ === true,
    desktopClass: document.documentElement.classList.contains('grind-desktop-runtime'),
    rtcPeerConnection: typeof RTCPeerConnection === 'function',
    mediaStream: typeof MediaStream === 'function',
    audioContext: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
    mediaDevices: !!navigator.mediaDevices,
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    getDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    webSocket: typeof WebSocket === 'function',
    localStorageWritable: (() => {
      try { localStorage.setItem('__grind_desktop_smoke__', '1'); localStorage.removeItem('__grind_desktop_smoke__'); return true; }
      catch { return false; }
    })()
  }))()`);

  assert(capabilities.origin === "https://grindlobby.onrender.com", `Unexpected origin: ${capabilities.origin}`);
  assert(capabilities.secureContext, "Desktop WebView is not a secure context");
  assert(capabilities.desktopMarker, "Native desktop marker was not injected");
  assert(capabilities.desktopClass, "Desktop runtime CSS mode was not activated");
  assert(capabilities.rtcPeerConnection, "RTCPeerConnection is unavailable in the desktop WebView");
  assert(capabilities.mediaStream, "MediaStream is unavailable in the desktop WebView");
  assert(capabilities.audioContext, "Web Audio API is unavailable in the desktop WebView");
  assert(capabilities.mediaDevices, "navigator.mediaDevices is unavailable in the desktop WebView");
  assert(capabilities.getUserMedia, "getUserMedia is unavailable in the desktop WebView");
  assert(capabilities.getDisplayMedia, "getDisplayMedia is unavailable in the desktop WebView");
  assert(capabilities.webSocket, "WebSocket is unavailable in the desktop WebView");
  assert(capabilities.localStorageWritable, "localStorage is not writable in the desktop WebView");

  const health = await evaluate(client, `fetch('/api/health', {cache:'no-store'})
    .then(async response => ({status: response.status, ok: response.ok, body: await response.text()}))`, true);
  assert(health.ok && health.status === 200, `Backend health failed inside desktop WebView: ${health.status} ${health.body}`);

  const devices = await evaluate(client, `navigator.mediaDevices.enumerateDevices()
    .then(devices => ({ok:true, count:devices.length}))
    .catch(error => ({ok:false, name:error.name, message:error.message}))`, true);
  assert(devices.ok, `enumerateDevices failed: ${devices.name || "Error"} ${devices.message || ""}`);

  console.log(JSON.stringify({ capabilities, health: { status: health.status }, devices }, null, 2));
} finally {
  client.close();
}
