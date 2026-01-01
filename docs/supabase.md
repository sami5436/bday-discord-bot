# Supabase

Supabase provides a hosted Postgres database plus a REST API layer (PostgREST), which this project uses for simple read/write access.

## How It’s Used Here

- `birthdays` table stores the saved birthdays per Discord user.
- `sent_log` prevents sending multiple reminders in the same day.
- The Worker uses the REST API for inserts, updates, and queries.
- The Python reminder script uses the same API for daily lookups and logging.

## Keys and Security

- `SUPABASE_SERVICE_ROLE_KEY` is a high-privilege key and must only be used server-side.
- The Worker uses the service role key so it can write to the database.
- GitHub Actions uses the same key for the daily reminder job.

## API Shape

Supabase exposes a PostgREST endpoint under:

- `/rest/v1/<table>` for CRUD operations

Requests are authorized using the service role key in both `apikey` and `Authorization` headers.
