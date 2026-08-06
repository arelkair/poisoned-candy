# Poisoned Candy

A multiplayer board game for 2-5 players. Play locally on the same device, or online through P2P rooms with an invite code. Find the poisoned candy before it finds you.

**[Play](#)** *(add the link here once deployed, e.g. via GitHub Pages or Vercel)*

## How to play

Each round, players secretly choose which board tiles hold poisoned candy. Taking turns, players eat candy from the board: pick a poisoned one and you lose a life. Before each round there's a shop phase where players can buy wildcards with special effects (vision, protection, forced moves...) from a limited stock per match.

Whoever's left standing with the most lives when the match ends wins.

## Game modes

- **Local**: 2 to 5 players on the same device, passing the turn.
- **Online**: a room with its own code, peer-to-peer connection with no external server required (via [PeerJS](https://peerjs.com/)).

## Room settings

Every room is configurable before starting:

- Board size (rows x columns, 2-10)
- Number and stock of wildcards per player
- Time to act and time to pick poison
- Poisoned candy count per player
- Starting lives
- Candy visual skin
- "Random wildcards" mode (no shop, random distribution)

## Stack

Plain HTML, CSS, and JavaScript — no frameworks, no build step. P2P connections via PeerJS.

## Run locally

No installation or dependencies required. Just open `index.html` in your browser, or serve it with any static server:

\`\`\`bash
npx serve .
\`\`\`
