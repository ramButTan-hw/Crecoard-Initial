# Crecoard

**A collaborative visual workspace — an infinite board canvas where you build your workflow out of drag-and-drop blocks, custom widgets, and shared spaces.**

Crecoard blends a freeform board with real-time collaboration, a server model, a sandboxed widget platform, and a community marketplace for sharing what you build. It ships as both a web app and a native desktop app.

> **Live:** [crecoard.com](https://crecoard.com)
<img width="1468" height="833" alt="image" src="https://github.com/user-attachments/assets/64f56e8e-5907-4759-aa9c-2533e4ec02a6" />
<img width="1468" height="833" alt="image" src="https://github.com/user-attachments/assets/5efdd8fe-b253-4e80-a245-f46877317fa1" />
<img width="1468" height="833" alt="image" src="https://github.com/user-attachments/assets/1f7214d8-d1b2-49f7-9e72-3a78d95754c1" />

---

## Features

**Board canvas**
- Infinite, pannable/zoomable canvas with drag-and-drop blocks and rich item types — tasks, kanban, calendars, notes, media/playlists, images, and audio visualizers.
- Custom backgrounds, live wallpapers, and per-board themes.

**Real-time collaboration & servers**
- Discord-style server sidebar with shared "server boards."
- Roles and permissions, plus in-canvas chat with @mentions, reactions, replies, pins, and moderation.

**Widget / plugin platform**
- Sandboxed custom widgets governed by a capability-based **permission model** with an install-time consent gate.
- Installable community items and a bots REST API for programmatic board access.(WIP)

**Community marketplace**
- Publish whole boards, single blocks, or individual items.
- Browse by category with search, star ratings, likes, download counts, a featured spotlight, and cover + screenshot galleries.

**Desktop app (Electron)**
- The desktop app allows Crecoard to gain extra features such as direct OS notifications, a background mode (WIP), audio reactive effects, and 

**Reminders & scheduling**
- Email + web-push notifications and a one-way ICS calendar feed.

**Onboarding**
- First-run guided tour and a curated starter palette to avoid blank-canvas overwhelm.

---

## Tech stack

| Layer | Tools |
| --- | --- |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Zustand |
| Backend | Supabase — Postgres with Row-Level Security, Auth, Storage, Realtime; SQL migrations, RPC functions, and triggers |
| Desktop | Electron, electron-builder, electron-updater |
| Tooling | Turborepo, npm workspaces |

## Engineering

Some of the more interesting systems behind Crecoard:

- **Real-time synchronization** — Supabase Realtime channels and Postgres change subscriptions keep collaborative boards synchronized across clients.
- **Database security** — Row-Level Security policies protect server, marketplace, and user data, with `SECURITY DEFINER` RPCs for controlled privileged operations.
- **Widget sandboxing** — Third-party widgets run behind a capability-based permission model with install-time consent.
- **Board serialization** — Entire boards can be serialized, published, downloaded, and reconstructed through the marketplace.
- **Shared architecture** — Turborepo packages power both the Next.js web client and Electron desktop application.
---

## Running locally

Requires **Node 20+** and a free [Supabase](https://supabase.com) project.

```bash
npm install

# Configure the web app
cp apps/web/.env.example apps/web/.env.local
# → fill in your Supabase URL + anon key (and any optional service keys)

# Apply the database schema to your Supabase project
# (run the files in supabase/migrations/ in order via the Supabase SQL editor)

npm run dev        # starts the web app via Turborepo
```

Other scripts: `npm run build`, `npm run lint`, `npm run type-check`.

---

## License

[MIT](LICENSE) © Jintian Wu
