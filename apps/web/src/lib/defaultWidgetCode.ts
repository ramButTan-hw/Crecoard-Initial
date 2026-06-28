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
