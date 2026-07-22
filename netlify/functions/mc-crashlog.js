// Crash telemetry — fire-and-forget error logger
// POST-only, inserts to client_errors via Supabase REST (service-role key)

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  try {
    var body = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers: CORS, body: "Bad JSON" };
  }

  if (!body.message) {
    return { statusCode: 400, headers: CORS, body: "Missing message" };
  }

  var row = {
    message: String(body.message).slice(0, 2000),
    stack: body.stack ? String(body.stack).slice(0, 500) : null,
    url: body.url ? String(body.url).slice(0, 2000) : null,
    ua: body.ua ? String(body.ua).slice(0, 500) : null,
    ts: body.ts || new Date().toISOString(),
  };

  var res = await fetch(SB_URL + "/rest/v1/client_errors", {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    var errText = await res.text();
    console.error("Supabase insert failed:", res.status, errText);
    return { statusCode: 500, headers: CORS, body: "Insert failed" };
  }

  return { statusCode: 204, headers: CORS, body: "" };
};
