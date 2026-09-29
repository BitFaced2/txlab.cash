// Real-time headless screenshot via the Chrome DevTools Protocol.
// usage: node cdp-shot.mjs <url> <out.png> [waitMs] [width] [height]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [url, out, waitMs = "12000", width = "1240", height = "730"] = process.argv.slice(2);
const port = 9333;
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--window-size=${width},${height}`,
  "--user-data-dir=" + process.env.TEMP + "\\txlab-cdp-profile", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(250);
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* not up yet */ }
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled") logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") logs.push(`EXCEPTION: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ""}`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(+waitMs);
  const status = await send("Runtime.evaluate", { expression: "JSON.stringify({status: document.getElementById('txstatus')?.textContent, mode: document.body.dataset.mode, step: document.querySelector('svg.stage')?.dataset.step, title: document.title})", returnByValue: true });
  console.log("page:", status.result?.result?.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("saved", out);
  if (logs.length) console.log("console:\n  " + logs.slice(0, 20).join("\n  "));
  ws.close();
} finally {
  chrome.kill();
}
