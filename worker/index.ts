// Cloudflare Worker: Discord Interactions Endpoint for /add
// - Verifies Discord signatures (Ed25519)
// - Handles PINGs
// - Accepts /add in DMs only and stores birthdays in Supabase
// - Responds within 3 seconds

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const DISCORD_INTERACTION_PING = 1;
const DISCORD_INTERACTION_COMMAND = 2;

// Discord interaction response types
const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;

// Ephemeral flag (visible only to command invoker)
const EPHEMERAL = 1 << 6;
const SIGNATURE_MAX_SKEW_SECONDS = 5 * 60;

// Basic month/day validation map (Feb allows 29)
const DAYS_IN_MONTH = [
  31, // Jan
  29, // Feb (allow leap day since no year is provided)
  31, // Mar
  30, // Apr
  31, // May
  30, // Jun
  31, // Jul
  31, // Aug
  30, // Sep
  31, // Oct
  30, // Nov
  31, // Dec
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Read raw body as text for signature verification and JSON parsing
    const bodyText = await request.text();

    // Verify Discord signature (required for ALL interactions)
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");

    if (!signature || !timestamp) {
      return new Response("Missing signature", { status: 401 });
    }

    // Reject old/replayed requests by checking timestamp skew
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) {
      return new Response("Bad signature timestamp", { status: 401 });
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_MAX_SKEW_SECONDS) {
      return new Response("Stale signature timestamp", { status: 401 });
    }

    const isValid = await verifyDiscordSignature({
      publicKey: env.DISCORD_PUBLIC_KEY,
      signature,
      timestamp,
      body: bodyText,
    });

    if (!isValid) {
      return new Response("Bad signature", { status: 401 });
    }

    let interaction: any;
    try {
      interaction = JSON.parse(bodyText);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // Respond to Discord's PINGs
    if (interaction.type === DISCORD_INTERACTION_PING) {
      return json({ type: RESPONSE_PONG });
    }

    // Only handle slash commands
    if (interaction.type !== DISCORD_INTERACTION_COMMAND) {
      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: { content: "Unsupported interaction type." },
      });
    }

    // If invoked in a guild/server, instruct user to DM the bot
    if (interaction.guild_id) {
      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: {
          content: "Please DM me to use this.",
          flags: EPHEMERAL,
        },
      });
    }

    const userId = interaction?.user?.id ?? interaction?.member?.user?.id;
    if (!userId) {
      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: { content: "Missing user information." },
      });
    }

    const commandName = interaction?.data?.name;

    if (commandName === "add") {
      const { name, birthday, error } = parseAddOptions(interaction?.data?.options ?? []);
      if (error) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: error },
        });
      }

      const validation = validateBirthday(birthday);
      if (!validation.ok) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: validation.error },
        });
      }

      const { month, day } = validation;

      // Upsert into Supabase using PostgREST
      const upsertResult = await upsertBirthday({
        env,
        owner_user_id: userId,
        name,
        month,
        day,
      });

      if (!upsertResult.ok) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: "Failed to save birthday. Please try again." },
        });
      }

      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: {
          content: `Saved ${name}'s birthday as ${birthday}.`,
        },
      });
    }

    if (commandName === "list") {
      const list = await listBirthdays({ env, owner_user_id: userId });
      if (!list.ok) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: "Failed to fetch birthdays. Please try again." },
        });
      }

      if (list.items.length === 0) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: "You have no birthdays saved yet." },
        });
      }

      const lines = list.items
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => `${row.name}: ${pad2(row.month)}/${pad2(row.day)}`)
        .join("\n");

      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: { content: `Your saved birthdays:\n${lines}` },
      });
    }

    if (commandName === "remove") {
      const { name, error } = parseRemoveOptions(interaction?.data?.options ?? []);
      if (error) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: error },
        });
      }

      const removed = await removeBirthday({ env, owner_user_id: userId, name });
      if (!removed.ok) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: "Failed to remove birthday. Please try again." },
        });
      }

      if (removed.deletedCount === 0) {
        return json({
          type: RESPONSE_CHANNEL_MESSAGE,
          data: { content: `No birthday found for ${name}.` },
        });
      }

      return json({
        type: RESPONSE_CHANNEL_MESSAGE,
        data: { content: `Removed ${name} from your birthdays.` },
      });
    }

    return json({
      type: RESPONSE_CHANNEL_MESSAGE,
      data: { content: "Unknown command." },
    });
  },
};

// -----------------------------
// Helper functions (commented)
// -----------------------------

// Parse /add options into name + birthday strings
function parseAddOptions(options: any[]): { name: string; birthday: string; error?: string } {
  let name = "";
  let birthday = "";

  for (const opt of options) {
    if (opt?.name === "name") {
      name = String(opt.value ?? "").trim();
    } else if (opt?.name === "birthday") {
      birthday = String(opt.value ?? "").trim();
    }
  }

  if (!name) {
    return { name, birthday, error: "Missing name. Usage: /add <name> <birthday>" };
  }

  if (name.length > 100) {
    return { name, birthday, error: "Name is too long (max 100 characters)." };
  }

  if (!birthday) {
    return { name, birthday, error: "Missing birthday. Usage: /add <name> <birthday>" };
  }

  return { name, birthday };
}

// Parse /remove options into name
function parseRemoveOptions(options: any[]): { name: string; error?: string } {
  let name = "";

  for (const opt of options) {
    if (opt?.name === "name") {
      name = String(opt.value ?? "").trim();
    }
  }

  if (!name) {
    return { name, error: "Missing name. Usage: /remove <name>" };
  }

  if (name.length > 100) {
    return { name, error: "Name is too long (max 100 characters)." };
  }

  return { name };
}

// Validate MM/DD input and return parsed month/day
function validateBirthday(input: string):
  | { ok: true; month: number; day: number }
  | { ok: false; error: string } {
  const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.exec(input);
  if (!match) {
    return { ok: false, error: "Birthday must be in MM/DD format (example: 12/31)." };
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const maxDay = DAYS_IN_MONTH[month - 1];

  if (day > maxDay) {
    return { ok: false, error: "Invalid day for the given month." };
  }

  return { ok: true, month, day };
}

// Upsert birthday row into Supabase (PostgREST)
async function upsertBirthday(params: {
  env: Env;
  owner_user_id: string;
  name: string;
  month: number;
  day: number;
}): Promise<{ ok: boolean }>
{
  const { env, owner_user_id, name, month, day } = params;

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/birthdays`);
  url.searchParams.set("on_conflict", "owner_user_id,name");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      owner_user_id,
      name,
      month,
      day,
    }),
  });

  return { ok: res.ok };
}

// List birthdays for a user
async function listBirthdays(params: {
  env: Env;
  owner_user_id: string;
}): Promise<{ ok: boolean; items: Array<{ name: string; month: number; day: number }> }> {
  const { env, owner_user_id } = params;

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/birthdays`);
  url.searchParams.set("select", "name,month,day");
  url.searchParams.set("owner_user_id", `eq.${owner_user_id}`);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    return { ok: false, items: [] };
  }

  const items = await res.json();
  return { ok: true, items };
}

// Remove a birthday for a user/name
async function removeBirthday(params: {
  env: Env;
  owner_user_id: string;
  name: string;
}): Promise<{ ok: boolean; deletedCount: number }> {
  const { env, owner_user_id, name } = params;

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/birthdays`);
  url.searchParams.set("owner_user_id", `eq.${owner_user_id}`);
  url.searchParams.set("name", `eq.${encodeURIComponent(name)}`);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
    },
  });

  if (!res.ok) {
    return { ok: false, deletedCount: 0 };
  }

  const rows = await res.json();
  return { ok: true, deletedCount: Array.isArray(rows) ? rows.length : 0 };
}

// Pad a number to 2 digits
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// Verify Discord interaction signature using Ed25519
async function verifyDiscordSignature(params: {
  publicKey: string;
  signature: string;
  timestamp: string;
  body: string;
}): Promise<boolean> {
  const { publicKey, signature, timestamp, body } = params;

  const message = new TextEncoder().encode(timestamp + body);
  const signatureBytes = hexToBytes(signature);
  const publicKeyBytes = hexToBytes(publicKey);

  const key = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("Ed25519", key, signatureBytes, message);
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// JSON response helper
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
