const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_EMAIL = process.env.SUPABASE_EMAIL;
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD;
const RENAULT_BACKEND_URL =
  process.env.RENAULT_BACKEND_URL || "https://r5-renault-backend.onrender.com";

function getMadridNowParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function isMadridRefreshWindow() {
  const { weekday, hour, minute } = getMadridNowParts();

  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  const minutesNow = hour * 60 + minute;

  const start = 8 * 60 + 15;
  const end = 8 * 60 + 45;

  return isWeekday && minutesNow >= start && minutesNow <= end;
}

async function loginToSupabase() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY
    },
    body: JSON.stringify({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Error login Supabase ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);

  if (!data.access_token) {
    throw new Error("Supabase no devolvió access_token.");
  }

  return data.access_token;
}

async function refreshRenaultStatus(token) {
  const response = await fetch(`${RENAULT_BACKEND_URL}/renault/status`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const text = await response.text();

  console.log(`Backend status: ${response.status}`);
  console.log(text);

  if (!response.ok) {
    throw new Error(`Backend respondió ${response.status}: ${text}`);
  }
}

async function main() {
  const { weekday, hour, minute } = getMadridNowParts();
  console.log(`Hora Madrid detectada: ${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);

  if (!isMadridRefreshWindow()) {
    console.log("Fuera de ventana 08:15-08:45 Europe/Madrid. No hago nada.");
    return;
  }

  const requiredVars = {
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_EMAIL,
    SUPABASE_PASSWORD
  };

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }

  const token = await loginToSupabase();
  await refreshRenaultStatus(token);

  console.log("Refresco MyRenault solicitado correctamente.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
