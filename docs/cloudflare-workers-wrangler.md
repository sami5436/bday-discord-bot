# Cloudflare Workers + Wrangler

This project runs the Discord interactions endpoint as a Cloudflare Worker. Wrangler is the CLI used to develop, configure, and deploy Workers.

## What Cloudflare Is

Cloudflare is a global network that provides CDN, security, and compute services. Workers run on Cloudflare’s edge network, close to users, so requests can be handled with very low latency.

## What Workers Are

Workers are serverless functions that run on Cloudflare’s edge. You deploy JavaScript/TypeScript code and Cloudflare handles scaling, routing, and runtime execution.

## Why Workers Fit This Bot

- The bot needs a fast HTTP endpoint for Discord interactions.
- The workload is short-lived and request-driven.
- Scaling is automatic, and there is no server to keep running.

## Wrangler (CLI)

Wrangler is the official CLI for Workers.

Common tasks:

- `wrangler dev` — run locally against the Worker runtime
- `wrangler deploy` — publish changes to Cloudflare
- `wrangler whoami` — confirm account/project access

Configuration is stored in `wrangler.toml` (name, entrypoint, environment variables, etc.).

## Cost and Usage Notes (Workers vs Render)

High-level comparison:

- Workers is usage-based, with a free tier and pay-as-you-go requests/CPU time after that.
- Render offers a free tier for some service types, but it is geared toward hobby use; the model is still a running service/instance.
- Render free web services spin down after periods of inactivity and can take up to about a minute to spin back up.
- Render charges for outbound bandwidth beyond included limits, which can matter if you serve large responses.
- Workers can be cheaper for a lightweight webhook endpoint because there’s no always-on instance cost.

Practical takeaway: a low-traffic Discord interactions endpoint usually maps well to Workers’ request-based pricing, while a constantly running web service is where Render’s model typically makes more sense.

This makes Workers a good fit for a Discord interactions endpoint that only receives occasional requests.
