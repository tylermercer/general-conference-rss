# General Conference RSS Feed

A build-time-generated RSS feed of LDS General Conference talk links.

Deploys to Cloudflare Workers via Astro and rebuilds daily using GitHub Actions cron.

## Features

- **RSS Feed (`/rss.xml`)**: Generates an RSS 2.0 feed of General Conference talks (English, 2026 onwards).
- **RSS Autodiscovery**: Readers can discover the feed automatically by using the root site URL.
- **Drip-Feed Pacing**: Talks from eligible conferences (released at least 1 week post-conference) are scheduled evenly across the calendar window until the next conference in broadcast order.
- **Content Collections & Custom Loader**: Conference talks are managed via Astro Content Collections (`talks`) with a custom loader that fetches eligible talks at build time.
- **Build-Time Filtering**: Talks are withheld from the RSS feed until their scheduled `pubDate` arrives.
- **Landing Page (`/`)**: Explains how to subscribe, how drip-feeding works, and displays live build-time statistics on talk releases.
- **Audio Enclosures**: Stubbed in schema for future per-talk audio scraping.

## Getting Started

```bash
pnpm install
pnpm dev
```

To build for production:

```bash
pnpm build
```
