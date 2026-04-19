import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fzsioxqmpjmunaszrjdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_lPgxna3-91FskASGGI854g_RZndEz2S";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

let selectedCharger = "A";

const BASE = "https://raw.githubusercontent.com/davofn/CompaCarga_R5/main/icons/brands/";

const BRANDS = [
  { id: "otro",      name: "Otro / Desconocido", logo: null },
  { id: "tesla",     name: "Tesla Supercharger",  logo: BASE + "Tesla.png" },
  { id: "zunder",    name: "Zunder",              logo: BASE + "Zunder.png" },
  { id: "repsol",    name: "Repsol",              logo: BASE + "Repsol.png" },
  { id: "ionity",    name: "Ionity",              logo: BASE + "Ionity.png" },
  { id: "iberdrola", name: "Iberdrola",           logo: BASE + "Iberdrola.png" },
  { id: "wenea",     name: "Wenea",               logo: BASE + "Wenea.png" },
  { id: "powerdot",  name: "PowerDot",            logo: BASE + "powerdot.png" },
  { id: "endesa",    name: "Endesa",              logo: BASE + "endesa.png" },
];

function getBrand(id) {
  return BRANDS.find(b => b.id === id) || BRANDS[0];
}

function clamp(n, min, max){
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function fmtEUR(n){
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(n);
}

function fmtKwh(n){
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2
  }).format(n) + " kWh";
}

function secondsToHMS(totalSeconds){
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function showToast(msg, isError = false) {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove("toast-visible", "toast-error");
  toast.classList.add("toast-visible");
  if (isError) toast.classList.add("toast-error");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("toast-visible"), 2800);
}

/* ── Supabase ── */

async function fetchHistory() {
  const { data, error } = await supabase
    .from("charges")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando histórico:", error);
    return [];
  }
  return data || [];
}

async function insertCharge(entry) {
  const { error } = await supabase.from("charges").insert([{
    fecha:      entry.fecha,
    brand_id:   entry.brandId,
    brand_name: entry.brandName,
    brand_logo: entry.brandLogo,
    tipo:       entry.tipo,
    soc_inicio: entry.socInicio,
    soc_final:  entry.socFinal,
    kwh:        entry.kWh,
    potencia:   entry.potencia,
    precio:     entry.precio,
    tiempo:     entry.tiempo,
    coste:      entry.coste
  }]);
  if (error) throw error;
}

async function deleteCharge(id) {
  const { error } = await supabase.from("charges").delete().eq("id", id);
  if (error) throw error;
}

async function deleteAllCharges() {
  const { error } = await supabase.from("charges").delete().not("id", "is", null);
  if (error) throw error;
}

/* ── UI ── */

function setSelectedCharger(charger){
  selectedCharger = charger;

  const btnA = $("chooseA");
  const btnB = $("chooseB");
  const label = $("selectedChargerLabel");

  if (btnA) btnA.classList.remove("active");
  if (btnB) btnB.classList.remove("active");

  if (charger === "A" && btnA) btnA.classList.add("active");
  if (charger === "B" && btnB) btnB.classList.add("active");

  if (label) label.textContent = charger === "A" ? "Cargador A" : "Cargador B";

  updateBrandPreview();
}

function updateBrandPreview() {
  const select = $("brandSelect");
  const preview = $("brandPreview");
  if (!select || !preview) return;

  const brand = getBrand(select.value);
  if (brand.logo) {
    preview.innerHTML = `<img src="${brand.logo}" alt="${brand.name}" class="brand-logo-preview" onerror="this.outerHTML='<span class=\\'brand-logo-fallback\\'>⚡</span>'">`;
  } else {
    preview.innerHTML = `<span class="brand-logo-fallback">⚡</span>`;
  }
}

function updateWinnerHighlight(winnerCost, winnerTime){
  const cardA = $("chargerCardA");
  const cardB = $("chargerCardB");

  if (cardA) cardA.classList.remove("is-winner-cost", "is-winner-time");
  if (cardB) cardB.classList.remove("is-winner-cost", "is-winner-time");

  if (winnerCost === "Cargador A" && cardA) cardA.classList.add("is-winner-cost");
  if (winnerCost === "Cargador B" && cardB) cardB.classList.add("is-winner-cost");

  if (winnerTime === "Cargador A" && cardA) cardA.classList.add("is-winner-time");
  if (winnerTime === "Cargador B" && cardB) cardB.classList.add("is-winner-time");
}

function getLimitNote(type, power){
  const requestedPower = Number.isFinite(power) ? power : 0;
  if (type === "ac"){
    if (requestedPower > 11) return "Se aplica un máximo de 11 kW por límite del vehículo en AC.";
    return "Modo AC: el vehículo admite hasta 11 kW.";
  }
  if (requestedPower > 100) return "Se aplica un máximo de 100 kW por límite del vehículo en DC.";
  return "Modo DC: el vehículo admite hasta 100 kW y se aplica curva de carga.";
}

function compute(){
  const batteryEl = $("batteryKwh");
  const socStartEl = $("socStart");
  const socEndEl = $("socEnd");
  const kwhToChargeEl = $("kwhToCharge");

  if (!batteryEl || !socStartEl || !socEndEl || !kwhToChargeEl) return;

  const battery = Math.max(0, parseFloat(batteryEl.value));
  const socStart = clamp(parseFloat(socStartEl.value), 0, 100);
  const socEnd = clamp(parseFloat(socEndEl.value), 0, 100);

  socStartEl.value = socStart;
  socEndEl.value = socEnd;

  const deltaSoc = (socEnd - socStart) / 100;
  const kwhToCharge = Math.max(0, deltaSoc * battery);
  kwhToChargeEl.textContent = fmtKwh(kwhToCharge);

  function calculateTime(power, type, start, end){
    if (power <= 0) return NaN;
    if (type === "ac"){
      const maxPower = Math.min(power, 11);
      return (kwhToCharge / maxPower) * 3600;
    }
    const maxPower = Math.min(power, 100);
    const curve = [
      { min: 0,   max: 10,  kw: 60 },
      { min: 10,  max: 13,  kw: 85 },
      { min: 13,  max: 42,  kw: 100 },
      { min: 42,  max: 55,  kw: 78 },
      { min: 55,  max: 70,  kw: 63 },
      { min: 70,  max: 80,  kw: 48 },
      { min: 80,  max: 90,  kw: 28 },
      { min: 90,  max: 96,  kw: 16 },
      { min: 96,  max: 100, kw: 10 }
    ];
    let totalSeconds = 0;
    for (const tramo of curve){
      if (end <= tramo.min || start >= tramo.max) continue;
      const tramoStart = Math.max(start, tramo.min);
      const tramoEnd = Math.min(end, tramo.max);
      const socDelta = (tramoEnd - tramoStart) / 100;
      const kwhTramo = socDelta * battery;
      const effectivePower = Math.min(maxPower, tramo.kw);
      totalSeconds += (kwhTramo / effectivePower) * 3600;
    }
    return totalSeconds;
  }

  const aTypeEl = $("aType");
  const aPowerEl = $("aPower");
  const aPriceEl = $("aPrice");
  const aCostEl = $("aCost");
  const aTimeEl = $("aTime");
  const aLimitNoteEl = $("aLimitNote");

  const bTypeEl = $("bType");
  const bPowerEl = $("bPower");
  const bPriceEl = $("bPrice");
  const bCostEl = $("bCost");
  const bTimeEl = $("bTime");
  const bLimitNoteEl = $("bLimitNote");

  if (!aTypeEl || !aPowerEl || !aPriceEl || !aCostEl || !aTimeEl || !aLimitNoteEl) return;
  if (!bTypeEl || !bPowerEl || !bPriceEl || !bCostEl || !bTimeEl || !bLimitNoteEl) return;

  const aType = aTypeEl.value;
  const aPower = Math.max(0, parseFloat(aPowerEl.value));
  const aPrice = Math.max(0, parseFloat(aPriceEl.value));
  const aCost = kwhToCharge * aPrice;
  const aTimeSec = calculateTime(aPower, aType, socStart, socEnd);

  aCostEl.textContent = fmtEUR(aCost);
  aTimeEl.textContent = secondsToHMS(aTimeSec);
  aLimitNoteEl.textContent = getLimitNote(aType, aPower);

  const bType = bTypeEl.value;
  const bPower = Math.max(0, parseFloat(bPowerEl.value));
  const bPrice = Math.max(0, parseFloat(bPriceEl.value));
  const bCost = kwhToCharge * bPrice;
  const bTimeSec = calculateTime(bPower, bType, socStart, socEnd);

  bCostEl.textContent = fmtEUR(bCost);
  bTimeEl.textContent = secondsToHMS(bTimeSec);
  bLimitNoteEl.textContent = getLimitNote(bType, bPower);

  let winnerCost = "—";
  if (Number.isFinite(aCost) && Number.isFinite(bCost)){
    if (Math.abs(aCost - bCost) < 1e-9) winnerCost = "Empate";
    else winnerCost = aCost < bCost ? "Cargador A" : "Cargador B";
  }

  let winnerTime = "—";
  if (Number.isFinite(aTimeSec) && Number.isFinite(bTimeSec)){
    if (Math.abs(aTimeSec - bTimeSec) < 1e-6) winnerTime = "Empate";
    else winnerTime = aTimeSec < bTimeSec ? "Cargador A" : "Cargador B";
  }

  const winnerCostEl = $("winnerCost");
  const winnerTimeEl = $("winnerTime");
  const diffCostEl = $("diffCost");

  if (winnerCostEl) winnerCostEl.textContent = winnerCost;
  if (winnerTimeEl) winnerTimeEl.textContent = winnerTime;

  const diff = bCost - aCost;
  if (diffCostEl) diffCostEl.textContent = Number.isFinite(diff) ? fmtEUR(diff) : "—";

  updateWinnerHighlight(winnerCost, winnerTime);
}

function wire(){
  const ids = [
    "batteryKwh","socStart","socEnd",
    "aType","aPower","aPrice",
    "bType","bPower","bPrice"
  ];
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  const btnA = $("chooseA");
  const btnB = $("chooseB");
  if (btnA) btnA.addEventListener("click", (e) => { e.preventDefault(); setSelectedCharger("A"); });
  if (btnB) btnB.addEventListener("click", (e) => { e.preventDefault(); setSelectedCharger("B"); });

  const brandSelect = $("brandSelect");
  if (brandSelect) brandSelect.addEventListener("change", updateBrandPreview);

  compute();
}

function getSelectedData(){
  const battery = Math.max(0, parseFloat($("batteryKwh")?.value || 0));
  const socStart = clamp(parseFloat($("socStart")?.value || 0), 0, 100);
  const socEnd = clamp(parseFloat($("socEnd")?.value || 0), 0, 100);
  const kWh = Math.max(0, ((socEnd - socStart) / 100) * battery);
  const brandId = $("brandSelect")?.value || "otro";
  const brand = getBrand(brandId);

  if (selectedCharger === "A"){
    const price = Math.max(0, parseFloat($("aPrice")?.value || 0));
    return {
      elegido: "Cargador A",
      brandId,
      brandName: brand.name,
      brandLogo: brand.logo,
      tipo: ($("aType")?.value || "").toUpperCase(),
      potencia: Math.max(0, parseFloat($("aPower")?.value || 0)),
      precio: price,
      tiempo: $("aTime")?.textContent || "—",
      coste: kWh * price,
      socInicio: socStart,
      socFinal: socEnd,
      kWh
    };
  }

  const price = Math.max(0, parseFloat($("bPrice")?.value || 0));
  return {
    elegido: "Cargador B",
    brandId,
    brandName: brand.name,
    brandLogo: brand.logo,
    tipo: ($("bType")?.value || "").toUpperCase(),
    potencia: Math.max(0, parseFloat($("bPower")?.value || 0)),
    precio: price,
    tiempo: $("bTime")?.textContent || "—",
    coste: kWh * price,
    socInicio: socStart,
    socFinal: socEnd,
    kWh
  };
}

function renderHistory(rows){
  const tbody = document.querySelector("#historyTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px">No hay cargas guardadas aún.</td></tr>`;
    return;
  }

  rows.forEach((e) => {
    const tr = document.createElement("tr");
    const tipoColor = (e.tipo || "").toUpperCase() === "DC" ? "badge-tipo dc" : "badge-tipo ac";
    const tipoLabel = (e.tipo || "").toUpperCase() || "—";

    const logoHtml = e.brand_logo
      ? `<span class="history-brand-wrap"><img src="${e.brand_logo}" alt="${e.brand_name}" class="history-brand-logo" onerror="this.parentElement.innerHTML='<span class=\\'history-brand-fallback\\'>⚡</span>'"></span>`
      : `<span class="history-brand-fallback">⚡</span>`;

    tr.innerHTML = `
      <td>${e.fecha}</td>
      <td class="td-brand"><div class="td-brand-inner">${logoHtml}<span>${e.brand_name || "—"}</span></div></td>
      <td><span class="${tipoColor}">${tipoLabel}</span></td>
      <td>${e.soc_inicio}–${e.soc_final}%</td>
      <td>${Number(e.kwh).toFixed(2)}</td>
      <td>${e.potencia} kW</td>
      <td>${e.tiempo}</td>
      <td>${e.precio != null ? Number(e.precio).toFixed(3) + " €" : "—"}</td>
      <td>${fmtEUR(Number(e.coste))}</td>
      <td><button class="btn-delete" title="Eliminar" data-id="${e.id}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      try {
        await deleteCharge(id);
        const rows = await fetchHistory();
        renderHistory(rows);
        showToast("✓ Registro eliminado");
      } catch {
        showToast("✗ Error al eliminar", true);
      }
    });
  });
}

function exportCSV(rows){
  if (!rows.length) return;
  let csv = "Fecha,Marca,Tipo,SOC Inicio,SOC Final,kWh,Potencia de carga (kW),Tiempo,€/kWh,Coste\n";
  rows.forEach((e) => {
    csv += `${e.fecha},${e.brand_name || ""},${e.tipo},${e.soc_inicio},${e.soc_final},${Number(e.kwh).toFixed(2)},${e.potencia},${e.tiempo},${e.precio != null ? Number(e.precio).toFixed(3) : ""},${Number(e.coste).toFixed(2)}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_compacarga_r5.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function initHistoryActions(){
  $("saveCharge")?.addEventListener("click", async () => {
    const data = getSelectedData();
    try {
      await insertCharge({
        fecha:     new Date().toLocaleString(),
        brandId:   data.brandId,
        brandName: data.brandName,
        brandLogo: data.brandLogo,
        tipo:      data.tipo,
        socInicio: data.socInicio,
        socFinal:  data.socFinal,
        kWh:       data.kWh,
        potencia:  data.potencia,
        precio:    data.precio,
        tiempo:    data.tiempo,
        coste:     data.coste
      });
      const rows = await fetchHistory();
      renderHistory(rows);
      showToast("✓ Carga guardada");
    } catch {
      showToast("✗ Error al guardar", true);
    }
  });

  $("clearHistory")?.addEventListener("click", async () => {
    if (!confirm("¿Limpiar todo el histórico?")) return;
    try {
      await deleteAllCharges();
      renderHistory([]);
      showToast("✓ Histórico limpiado");
    } catch {
      showToast("✗ Error al limpiar", true);
    }
  });

  $("exportCSV")?.addEventListener("click", async () => {
    const rows = await fetchHistory();
    exportCSV(rows);
  });
}

function buildBrandSelect() {
  const select = $("brandSelect");
  if (!select) return;
  select.innerHTML = "";
  BRANDS.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    select.appendChild(opt);
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  buildBrandSelect();
  setSelectedCharger("A");
  wire();
  initHistoryActions();

  try {
    const rows = await fetchHistory();
    renderHistory(rows);
  } catch {
    showToast("✗ Error al cargar el histórico", true);
  }

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
});
