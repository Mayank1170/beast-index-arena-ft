# Beast Index Arena - Frontend

A real-time blockchain battle arena where players bet on mythical creatures fighting in turn-based combat. Built on Solana devnet.

## Overview

This is the frontend application for Beast Index Arena, a decentralized betting platform where users can:
- Watch live battles between four mythical creatures (Yeti, Mapinguari, Zmey, and Naga)
- Place bets on creatures during active battles
- Track positions and claim winnings
- View real-time battle logs and creature stats

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Blockchain**: Solana (Anchor framework)
- **Wallet**: Solana Wallet Adapter
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## How It Works

1. **Connect Wallet**: Connect your Solana wallet using the button in the top right
2. **Watch Battles**: Each battle lasts until only one creature survives
3. **Place Bets**: Bet on any alive creature during an active battle (minimum 0.01 SOL)
4. **Track Positions**: View your active positions in the "Your Positions" section
5. **Claim Winnings**: When your creature wins, claim your share of the prize pool

## Features

- Real-time battle updates (5-second polling)
- Live battle logs showing attacks and eliminations
- Automatic position updates after transactions
- Responsive design for mobile and desktop
- Battle history and unclaimed winnings tracker

## Project Structure

```
src/
├── app/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   ├── idl/            # Anchor program IDL
│   └── api/            # Next.js API routes
└── public/             # Static assets
```

## Development

The application polls the blockchain every 5 seconds to fetch:
- Current battle state
- Creature HP and status
- User positions
- Market data

All transactions are signed through your connected wallet and confirmed on Solana devnet.

## License

MIT
