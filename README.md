# NPC ROASTED — starter MVP

A real Next.js prototype for appearance-based roasts of **Non-Playable Characters** and **Playable Characters** on Ethereum. It looks up real token artwork with Alchemy, analyzes the image with an OpenAI vision-capable model, and produces a downloadable PNG roast card. No wallet connection required.

## Start locally

1. Install Node.js 20.9+.
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env.local`.
4. Create API keys from [Alchemy](https://dashboard.alchemy.com/) and [OpenAI](https://platform.openai.com/api-keys). Set `ALCHEMY_API_KEY` and `OPENAI_API_KEY` in `.env.local`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Enter an actual token ID (e.g. a token visible on Etherscan/OpenSea), select its collection, and generate a roast.

## Deploy on Vercel

Push this folder to a GitHub repo, import it in [Vercel](https://vercel.com/), set both environment variables in the Vercel project settings, and deploy. OpenAI API usage is billed separately from ChatGPT subscriptions.

## Before a public launch

- Replace the *in-memory* throttle with a shared service like Upstash Redis; serverless instances do not share in-memory rate limits.
- Add an abuse/bot check (e.g. Cloudflare Turnstile), daily quotas, monitoring, error logs and per-IP spend protection.
- Review your official logo usage and privacy/terms content. Placeholder text is NOT the official NPC logo.
- Add robust IPFS/Arweave fallback and SVG/GIF conversion; current MVP supports PNG, JPEG, and WebP artwork, with Alchemy PNG as a preferred source.
- Consider an image CDN/server proxy to make card exports less expensive in bandwidth. Cache NFT images and stable metadata, but reroll text on demand.
- Consider a separate moderation/review flow for featuring roast cards publicly, especially when supporting outside collections.
- Validate ownership and authorization before enabling holder-only features. Token ID alone is intentionally sufficient for public roasts.
- The source uses `redirect: error` and HTTPS domain checks on image fetching as basic protection. For hardened production, also resolve DNS and block private ranges, and use an allowlisted image proxy.

## Project structure

- `app/page.tsx` — interactive UI, PNG card export, share-to-X action.
- `app/api/roast/route.ts` — server-only Alchemy metadata lookup, image retrieval, AI vision roast endpoint.
- `app/styles.css` — dark branded UI placeholder.

## Notes

The live contract addresses are prefilled from the project team:
- NPC: `0xa2a6063b910fc7a7a286196f6c9b62b2797fa0ae`
- PC: `0xe7d97e9e47ad0640f92f43f204e5fcce2ce8b20e`

This starter has not been exercised against production APIs, and production operation requires valid API keys and follow-up testing. The appearance analysis is probabilistic; review joke quality on a variety of real tokens before launch.
