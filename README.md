# PathPilot Growth App

PathPilot is a personal growth planning app for long-term career migration goals. It combines daily task planning, learning tracks, portfolio progress, opportunity review, visa-material tracking, and an optional local agent workflow.

The repository is public-safe by default: runtime state, screenshots, logs, dependency folders, build output, and environment files are ignored.

## Features

- Daily execution board with XP, streaks, and progress summaries
- Three-year roadmap with milestones and risk hints
- Learning center for exam study, language practice, career positioning, and portfolio work
- Portfolio tracker with case-study fields
- Opportunity radar backed by public job APIs
- Visa points and materials planning view
- Optional AI Coach panel that can call a locally configured Hermes agent
- Local JSON persistence through the bundled Express server

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- Lucide React

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app and API server together:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Serve the API server:

```bash
npm run serve
```

## Local Data

The server writes runtime state to:

```text
data/state.json
```

This file is intentionally ignored because it can contain personal planning data, progress history, agent outputs, and imported state. If it does not exist, the server creates a fresh default state on first run.

## Optional Agent Setup

The app can call a local Hermes agent when these environment variables are configured:

```text
HERMES_HOME
HERMES_CWD
HERMES_BIN
HERMES_LAUNCH_CMD
HERMES_WSL_DISTRO
```

If the agent environment is not configured, the app still runs and falls back to local planning behavior.

Example PowerShell setup:

```powershell
$env:HERMES_HOME="..."
$env:HERMES_CWD="..."
$env:HERMES_BIN="..."
$env:HERMES_LAUNCH_CMD="..."
$env:HERMES_WSL_DISTRO="Ubuntu"
npm run dev
```

Do not commit real API keys, local paths, exported state, or `.env` files.

## Versioning

The baseline public version is tagged as:

```text
v0.1.0
```

Use small commits and tags for future release points.
