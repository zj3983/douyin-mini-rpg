# Douyin Mini RPG Prototype

A single-player mobile-first xianxia action RPG prototype built with Vite and TypeScript.

## Features

- Side-scrolling auto-battle loop with click-to-move control.
- Dungeon extraction flow with daily entry limits.
- Artifact-driven auto skills: artifacts unlock and power combat effects.
- Gacha tickets earned from dungeon extraction and clears.
- Character shards, equipment, backpack, settlement, and artifact panels.
- Generated xianxia character, map, and action sprite assets.

## Development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Build:

```bash
npm run build
```

Run the game-playing test agent:

```bash
npm run agent:test
```

The agent starts an isolated local game server on `127.0.0.1:5179`, opens Chrome with Playwright, enters as a guest, creates a character when needed, checks battle rendering, switches account-center tabs, visits dungeon/gacha/equipment/backpack/artifact pages, performs random exploration, and writes a Markdown report plus screenshots under `artifacts/game-agent/`.

Useful options:

```bash
# Watch the browser while it plays
GAME_AGENT_HEADLESS=0 npm run agent:test

# Run longer random exploration
GAME_AGENT_RANDOM_MS=120000 npm run agent:test
```

## Notes

Third-party and generated asset credits are listed under `public/assets`.
