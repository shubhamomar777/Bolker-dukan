/* ===== AI Agent (alag file) ===== */
var AGENT_URL = "https://dukanshaathi.shubhamomar777.workers.dev";

var TOOL_SCHEMAS = [
  { name: "get_today_summary", description: "Aaj ki bikri, kharcha aur munafa batata hai.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "add_credit", description: "Customer ke naam par udhaar likhta hai. Pehle naam aur rakam dohraakar confirm karo.",
    input_schema: { type: "object", properties: {
      name: { type: "string", description: "Customer ka naam" },
      amount: { type: "number", description: "Rupaye" } }, required: ["name", "amount"] } },
  { name: "check_stock", description: "Kisi saman ka stock batata hai.",
    input_schema: { type: "object", properties: { item: { type: "string", description: "Saman ka naam" } }, required: ["item"] } }
];

var convo = [];

function runTool(name, input) {
  if (name === "get_today_summary") {
    var sales = sum(today(S.bills)) + sum(today(S.qs));
    var exp = sum(today(S.exp));
    return { sales: sales, expense: exp, profit: sales - exp };
  }
  if (name === "add_credit") {
    var amt = parseFloat(input.amount);
    if (!(amt > 0) || !input.name) return { ok: false, error: "naam ya rakam galat" };
    S.led.push({ d: td(), name: input.name, amt: amt, type: "udhaar", note: "" });
    sv(); draw();
    return { ok: true, total_due: bal()[input.name] || 0 };
  }
  if (name === "check_stock") {
    var q = dlKey(input.item);
    var key = Object.keys(S.stock).filter(function (k) { return k.indexOf(q) >= 0; })[0];
    if (!key) return { found: false };
    var st = S.stock[key];
    return { found: true, name: st.n, qty: fmtQ(st.q, st.u), low: isLow(st) };
  }
  return { error: "unknown tool" };
}

function listen(cb) {
  var R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { notify("Is browser me voice nahi chalta. Chrome use karo."); return; }
  var x = new R();
  x.lang = "hi-IN"; x.interimResults = false; x.maxAlternatives = 1; x.continuous = false;
  var done = false;
  x.onresult = function (e) {
    if (done) return; done = true;
    var t = (e.results[e.results.length - 1][0].transcript || "").trim();
    if (t) { vState("ok", t); cb(t); }
  };
  x.onstart = function () { vState("listen"); };
  x.onend = function () { if (!done) { done = true; vState("bad"); } };
  x.onerror = function (e) { done = true; vState("bad"); notify("Voice error: " + e.error); };
  try { x.start(); } catch (er) { notify("Voice shuru nahi hui: " + er.message); }
}

async function agentTurn(userText) {
  var st = document.getElementById("vst");
  if (st) st.textContent = "Agent soch raha hai...";
  try {
    var messages = convo.concat([{ role: "user", content: userText }]);
    for (var i = 0; i < 5; i++) {
      var res = await fetch(AGENT_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages, tools: TOOL_SCHEMAS }) });
      var r = await res.json();
      if (!res.ok || r.error) throw new Error(r.error || ("HTTP " + res.status));
      messages.push({ role: "assistant", content: r.content });
      var uses = r.content.filter(function (b) { return b.type === "tool_use"; });
      if (!uses.length) {
        var text = r.content.filter(function (b) { return b.type === "text"; })
          .map(function (b) { return b.text; }).join(" ") || "Jawab khaali aaya.";
        convo = messages;
        if (st) st.textContent = text;
        notify(text); sayBack(text);
        return;
      }
      var results = uses.map(function (u) {
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(runTool(u.name, u.input)) };
      });
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    var m = "Agent ka jawab nahi aaya: " + err.message;
    if (st) st.textContent = m;
    notify(m);
  }
}

function voiceAssistant() {
  listen(function (raw) { agentTurn(raw); });
}
