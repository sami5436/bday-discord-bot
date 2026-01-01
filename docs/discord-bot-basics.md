# How a Discord Bot Works (Interactions-Based)

This project uses Discord "application commands" (slash commands) and the Interactions API. That means Discord sends a signed HTTP request to your endpoint whenever a user invokes a slash command, and your server returns a JSON response that Discord displays to the user.

## Core Pieces

- Application (bot) in the Discord Developer Portal
- Public key for verifying request signatures
- An HTTPS endpoint that receives interaction payloads
- A JSON response that tells Discord what to show

## Interaction Types (High Level)

- PING: Discord sends this to verify the endpoint, and you reply with PONG.
- COMMAND: Slash commands like `/add` arrive as interaction payloads.

## Security (Why Signatures Matter)

Discord signs every interaction request with Ed25519 and includes headers for the signature and timestamp (for example, `X-Signature-Ed25519` and `X-Signature-Timestamp`). Your endpoint must verify this signature before doing any work. This prevents forged requests from being accepted.

## Why This Pattern

- No long-lived bot connection required for commands
- Simple HTTP serverless endpoint is enough
- Works well with Cloudflare Workers and other edge runtimes
