# Discord Birthday Reminder (Supabase + Cloudflare Worker + GitHub Actions)

This project implements a DM-only Discord birthday reminder system with:

- Supabase (Postgres) for storage
- Cloudflare Worker as the Discord Interactions Endpoint
- GitHub Actions for the daily reminder job

## Files

- `worker/index.ts` — Cloudflare Worker handler for `/add`
- `sql/schema.sql` — Supabase schema
- `scripts/send_reminders.py` — Daily reminder sender (Python)
- `.github/workflows/daily-reminder.yml` — Scheduled GitHub Action

## Environment Variables

Set these in Cloudflare Worker **and** GitHub Actions secrets as appropriate:

- `DISCORD_PUBLIC_KEY` — Discord application public key (for verifying interactions)
- `DISCORD_BOT_TOKEN` — Bot token (used by the reminder script)
- `SUPABASE_URL` — Your Supabase project URL (example: `https://xyz.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)

## Supabase Setup

Run the schema in `sql/schema.sql` in the Supabase SQL editor.

## Discord Slash Command

Register a global slash command named `add` with two string options:

- `name` (required)
- `birthday` (required, format `MM/DD`)

## Cloudflare Worker Setup

1. Deploy `worker/index.ts` as your worker.
2. Configure its environment variables.
3. Set the Interactions Endpoint URL in the Discord Developer Portal.

## GitHub Actions Setup

1. Add the required secrets in your GitHub repo settings:
   - `DISCORD_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. The workflow runs daily at **09:00 AM CST** (15:00 UTC).

## Notes

- The bot is DM-only. If `/add` is used in a server, it responds with:
  `Please DM me to use this.`
- Interaction requests are acknowledged within 3 seconds.
