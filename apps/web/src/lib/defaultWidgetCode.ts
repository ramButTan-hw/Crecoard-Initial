export const DEFAULT_WIDGET_CODE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: transparent;
    color: #f2f2f2;
    padding: 16px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 { font-size: 18px; font-weight: 700; }
  .value { font-size: 40px; font-weight: 800; color: #d59ee8; }
  .hint { font-size: 12px; opacity: 0.5; line-height: 1.5; }
</style>
</head>
<body>
  <h2>Custom Widget</h2>
  <div class="value" id="val">--</div>
  <p class="hint" id="info">
    Switch to Code tab to edit this widget.<br>
    Variable items in this block are sent automatically.
  </p>

  <script>
    window.addEventListener("message", function(e) {
      if (!e.data || e.data.type !== "plancraft-vars") return;
      var vars = e.data.vars;
      var keys = Object.keys(vars);
      if (keys.length > 0) {
        document.getElementById("val").textContent = vars[keys[0]];
        document.getElementById("info").textContent =
          keys.map(function(k) { return k + " = " + vars[k]; }).join("  /  ");
      }
    });
  </script>
</body>
</html>`;

/**
 * Desk Pet — example custom item exercising the widget state bridge.
 * State persists via plancraft-save-state → item.widgetState → board sync,
 * so the pet survives reloads and follows the board across devices.
 * Hunger/affection decay from timestamps, so time passes even while closed.
 */
export const PET_WIDGET_CODE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: transparent; color: #f2f2f2;
    height: 100vh; overflow: hidden;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px; padding: 10px;
    user-select: none;
  }
  .name { font-size: 13px; font-weight: 700; outline: none; border-bottom: 1px dashed transparent; }
  .name:focus { border-bottom-color: #d59ee8; }
  .pet { font-size: 56px; cursor: pointer; animation: bob 2.4s ease-in-out infinite; position: relative; }
  @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
  .pet.eating { animation: chomp 0.5s ease; }
  @keyframes chomp { 0%,100% { transform: scale(1) } 50% { transform: scale(1.25) rotate(-8deg) } }
  .bars { display: flex; flex-direction: column; gap: 4px; width: 82%; max-width: 220px; }
  .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.12); overflow: hidden; }
  .bar > div { height: 100%; border-radius: 3px; transition: width 0.4s; }
  .fill-food { background: #48cfa6; }
  .fill-love { background: #eb5757; }
  .row { display: flex; gap: 8px; }
  button {
    border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
    color: #f2f2f2; border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer;
  }
  button:hover { border-color: #d59ee8; color: #d59ee8; }
  .meta { font-size: 10px; opacity: 0.55; }
  .heart { position: absolute; font-size: 16px; pointer-events: none; animation: rise 0.9s ease-out forwards; }
  @keyframes rise { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(-34px) } }
</style>
</head>
<body>
  <div class="name" id="name" contenteditable spellcheck="false">Mochi</div>
  <div class="pet" id="pet">🐣</div>
  <div class="bars">
    <div class="bar"><div class="fill-food" id="food"></div></div>
    <div class="bar"><div class="fill-love" id="love"></div></div>
  </div>
  <div class="row">
    <button id="feed">🍙 Feed</button>
    <button id="cuddle">❤ Pet</button>
  </div>
  <div class="meta" id="meta"></div>

  <script>
    // Hunger empties over 8h, affection over 12h — derived from timestamps,
    // so the pet gets hungry even while the board is closed.
    var FOOD_MS = 8 * 3600000, LOVE_MS = 12 * 3600000;
    var s = { name: "Mochi", xp: 0, fedAt: Date.now(), pettedAt: Date.now() };
    var restored = false;

    function save() { parent.postMessage({ type: "plancraft-save-state", state: s }, "*"); }
    function pct(since, span) { return Math.max(0, 1 - (Date.now() - since) / span); }
    function level() { return Math.floor(s.xp / 50) + 1; }

    function face() {
      var food = pct(s.fedAt, FOOD_MS), love = pct(s.pettedAt, LOVE_MS);
      var l = level();
      var base = l >= 8 ? "🐉" : l >= 5 ? "🐥" : l >= 3 ? "🐤" : "🐣";
      if (food < 0.15) return "😵";
      if (food < 0.4) return "🥺";
      if (love < 0.25) return "😢";
      return base;
    }

    function render() {
      document.getElementById("pet").textContent = face();
      document.getElementById("food").style.width = (pct(s.fedAt, FOOD_MS) * 100) + "%";
      document.getElementById("love").style.width = (pct(s.pettedAt, LOVE_MS) * 100) + "%";
      document.getElementById("meta").textContent = "Lv " + level() + " · " + s.xp + " xp";
      if (document.activeElement !== document.getElementById("name"))
        document.getElementById("name").textContent = s.name;
    }

    function burst(emoji) {
      var el = document.createElement("span");
      el.className = "heart"; el.textContent = emoji;
      el.style.left = (30 + Math.random() * 40) + "%"; el.style.top = "0";
      document.getElementById("pet").appendChild(el);
      setTimeout(function() { el.remove(); }, 900);
    }

    document.getElementById("feed").onclick = function() {
      s.fedAt = Date.now(); s.xp += 5;
      var p = document.getElementById("pet");
      p.classList.remove("eating"); void p.offsetWidth; p.classList.add("eating");
      burst("🍙"); render(); save();
    };
    document.getElementById("cuddle").onclick = function() {
      s.pettedAt = Date.now(); s.xp += 3;
      burst("❤"); render(); save();
    };
    document.getElementById("pet").onclick = function() { burst("✨"); };
    document.getElementById("name").addEventListener("blur", function() {
      s.name = (this.textContent || "Mochi").trim().slice(0, 20) || "Mochi";
      render(); save();
    });

    // Restore persisted state from the host (sent on iframe load)
    window.addEventListener("message", function(e) {
      if (!e.data || e.data.type !== "plancraft-state" || restored) return;
      restored = true;
      if (e.data.state && typeof e.data.state === "object") {
        var st = e.data.state;
        if (typeof st.name === "string") s.name = st.name;
        if (typeof st.xp === "number") s.xp = st.xp;
        if (typeof st.fedAt === "number") s.fedAt = st.fedAt;
        if (typeof st.pettedAt === "number") s.pettedAt = st.pettedAt;
      }
      render();
    });

    render();
    setInterval(render, 30000); // bars drift down while the board is open
  </script>
</body>
</html>`;
