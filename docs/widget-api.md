# Widget Plugin API

Custom Widget items run your HTML/CSS/JS inside a **sandboxed iframe** (opaque origin — no
cookies, no storage, no access to the app). You have full creative control over your UI;
everything else goes through a message-based API that the host validates.

## How calls work

Send a request, get a response with the same `id`:

```js
// you → host
parent.postMessage({ type: "plancraft-api", id: 1, method: "self.move", args: { x: 100, y: 200 } }, "*");

// host → you
// { type: "plancraft-api-result", id: 1, ok: true, data: { x: 100, y: 200 } }
// { type: "plancraft-api-result", id: 1, ok: false, error: "Permission \"self:move\" not granted — ..." }
```

Paste-able promise helper:

```js
var apiSeq = 0, apiPending = {};
function pc(method, args) {
  return new Promise(function (resolve, reject) {
    var id = ++apiSeq;
    apiPending[id] = { resolve: resolve, reject: reject };
    parent.postMessage({ type: "plancraft-api", id: id, method: method, args: args || {} }, "*");
    setTimeout(function () {
      if (apiPending[id]) { delete apiPending[id]; reject(new Error("timeout")); }
    }, 3000);
  });
}
window.addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.type !== "plancraft-api-result") return;
  var p = apiPending[d.id];
  if (p) { delete apiPending[d.id]; d.ok ? p.resolve(d.data) : p.reject(new Error(d.error || "error")); }
});

// usage:  await pc("board.getRects")
```

## Permissions

Widgets start with **zero** permissions. A board editor grants them in the widget's
**Permissions** tab. Granted permissions travel with the item when published to the
community — but installers see the list and must approve it, otherwise permissions are
stripped on install. Design your widget to degrade gracefully when a call is denied.

| Permission | Unlocks |
|---|---|
| *(none)* | `self.getRect` — a widget may always inspect itself |
| `self:move` | `self.move`, `self.resize` |
| `board:read` | `board.getRects` |
| `members:read` | `members.list` |

## Methods

### `self.getRect` → `{ x, y, width, height, container }`
Your own position/size. `container` is `"box"` (widget lives inside a block) or
`"canvas"` (placed directly on the board — recommended for roaming widgets).

### `self.move { x, y }` → `{ x, y }`
Move your block/item on the board. Coordinates are rounded, clamped to ±50 000, and the
move is visible to everyone (in-box moves broadcast live to collaborators). Fails on
locked boards.

### `self.resize { width, height }` → `{ width, height }`
Resize yourself. Clamped to 40–4000 px.

### `board.getRects` → `{ rects: [{ id, kind, x, y, width, height, title, self }] }`
Layout of the board: block and canvas-item rectangles plus block titles — **never their
contents**. `kind` is `"box"` or `"item"`; `self` marks your own container. Capped at
200 entries per kind.

### `members.list` → `{ members: [{ userId, username, avatar, role, online }] }`
Server members (empty on personal boards). Calls run **as the viewing user** — you only
ever see what the person looking at the board could already see.

## Limits & rules

- **Rate limit:** ~10 calls/second (burst 20) per widget. Excess calls fail with
  `Rate limit exceeded` — pace movement animations accordingly (≤ 4 moves/sec is smooth).
- **Locked boards** reject mutating calls; reads still work.
- Responses only ever go to your own iframe; you never see other widgets' traffic.

## Persistence & inputs (existing bridges)

- **State** (your only storage — the sandbox has no localStorage):
  save with `parent.postMessage({ type: "plancraft-save-state", state: anyJson }, "*")`
  (≤ 8 KB, debounced). The host replays `{ type: "plancraft-state", state }` on every load.
  State syncs with the board across devices and collaborators.
- **Variables:** number variables in your block arrive as `{ type: "plancraft-vars", vars }`.

## Pet sprites (reskinning the Board Pet)

The bundled Board Pet keeps its art in a plain-data `SPRITES` section: three 16×16
matrices (`baby`, `teen`, `adult`) of palette indices drawn onto a pixelated canvas.

- Each row is a 16-character string; each character indexes `PAL` (`"0"` = transparent).
- Add or change colors by editing `PAL`.
- `scale` controls on-screen size per stage (baby 4× → adult 6×).

To publish a reskin: paste the pet code into a Custom Widget, redraw the matrices, then
**Share → One item** in the Community modal. Logic, roaming, and care mechanics come along
unchanged — you only touched data.
