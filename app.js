const BATTERY_KWH = 52;
const DEFAULT_HOME_PRICE = 0.1176;
const STORAGE_KEY = "r5_consumo_log_history";

const $ = (id) => document.getElementById(id);

function clamp(n, min, max){
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function fmtNum(n, digits=2){
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(n);
}
function fmtKwh(n){ return Number.isFinite(n) ? `${fmtNum(n,2)} kWh` : "—"; }
function fmtKm(n){ return Number.isFinite(n) ? `${fmtNum(n,1)} km` : "—"; }
function fmtAvg(n){ return Number.isFinite(n) ? `${fmtNum(n,1)} kWh/100km` : "—"; }
function fmtEUR(n){
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n);
}

function getHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function setMessage(text){
  const el = $("msg");
  if (el) el.textContent = text || "";
}

function isTripRow(e){
  return !e.kind || e.kind === "trip";
}

function computeCurrent(){
  const kmStart = parseFloat($("kmStart")?.value);
  const kmEnd = parseFloat($("kmEnd")?.value);

  const socStart = clamp(parseFloat($("socStart")?.value), 0, 100);
  const socEnd = clamp(parseFloat($("socEnd")?.value), 0, 100);

  if ($("socStart")) $("socStart").value = socStart;
  if ($("socEnd")) $("socEnd").value = socEnd;

  const kmTrip = (Number.isFinite(kmStart) && Number.isFinite(kmEnd)) ? (kmEnd - kmStart) : NaN;
  const socUsed = socStart - socEnd;
  const kwhUsed = (Number.isFinite(socUsed) ? Math.max(0, socUsed) : NaN) / 100 * BATTERY_KWH;

  const avg = (Number.isFinite(kmTrip) && kmTrip > 0 && Number.isFinite(kwhUsed))
    ? (kwhUsed / kmTrip) * 100
    : NaN;

  const price = Math.max(0, parseFloat($("price")?.value));
  const cost = Number.isFinite(kwhUsed) ? (kwhUsed * price) : NaN;

  if ($("kmTrip")) $("kmTrip").textContent = fmtKm(kmTrip);
  if ($("kwhUsed")) $("kwhUsed").textContent = fmtKwh(kwhUsed);
  if ($("avg")) $("avg").textContent = fmtAvg(avg);
  if ($("cost")) $("cost").textContent = fmtEUR(cost);

  return { kmStart, kmEnd, kmTrip, socStart, socEnd, socUsed, kwhUsed, avg, price, cost };
}

function applyPriceUI(){
  const external = $("externalCharge")?.checked;
  const priceInput = $("price");
  if (!priceInput) return;

  if (!external){
    priceInput.value = DEFAULT_HOME_PRICE.toString();
    priceInput.disabled = true;
  } else {
    if (priceInput.disabled) priceInput.value = "0.45";
    priceInput.disabled = false;
  }
}

// ===== Filtros (las filas de resumen SIEMPRE se muestran) =====
function getFilteredHistory(all){
  const type = $("filterType")?.value || "Todos";
  const extras = $("filterExtras")?.value || "Todos";

  return all.filter(e => {
    if (e.kind === "stintSummary") return true;

    if (type !== "Todos" && e.tripType !== type) return false;

    const hasClimate = e.climate === "Sí";
    const hasSeats = e.seatsHeat === "Sí";

    if (extras === "Clima" && !hasClimate) return false;
    if (extras === "Asientos" && !hasSeats) return false;
    if (extras === "Ambos" && !(hasClimate && hasSeats)) return false;

    return true;
  });
}

// ===== Odómetro + autorellenos (siempre usando histórico completo sin filtros) =====
function updateOdometerUI(allHistory){
  const el = $("odoNow");
  if (!el) return;

  // buscar último trayecto real
  for (let i = allHistory.length - 1; i >= 0; i--){
    const e = allHistory[i];
    if (isTripRow(e) && Number.isFinite(e.kmEnd)){
      el.textContent = fmtKm(e.kmEnd);
      return;
    }
  }
  el.textContent = "—";
}

function autofillKmStartFromHistory(allHistory){
  // último kmEnd del último trayecto
  let lastKmEnd = null;
  for (let i = allHistory.length - 1; i >= 0; i--){
    const e = allHistory[i];
    if (isTripRow(e) && Number.isFinite(e.kmEnd)){
      lastKmEnd = e.kmEnd;
      break;
    }
  }
  const input = $("kmStart");
  if (input && !String(input.value ?? "").trim() && Number.isFinite(lastKmEnd)){
    input.value = lastKmEnd;
  }
}

function autofillSocStartFromHistory(allHistory){
  // último socEnd del último trayecto
  let lastSocEnd = null;
  for (let i = allHistory.length - 1; i >= 0; i--){
    const e = allHistory[i];
    if (isTripRow(e) && Number.isFinite(e.socEnd)){
      lastSocEnd = e.socEnd;
      break;
    }
  }
  const input = $("socStart");
  if (!input || !Number.isFinite(lastSocEnd)) return;

  const v = String(input.value ?? "").trim();
  if (v === "" || v === "80"){ // no pisar si el usuario ya puso otro valor
    input.value = lastSocEnd;
  }
}

// ===== Resumen por batería (“stint”) =====
function getLastTrip(allHistory){
  for (let i = allHistory.length - 1; i >= 0; i--){
    if (isTripRow(allHistory[i])) return allHistory[i];
  }
  return null;
}

// encuentra el inicio del bloque actual desde la última recarga
function findCurrentStintStartIndex(allHistory){
  const tripsIdx = [];
  for (let i = 0; i < allHistory.length; i++){
    if (isTripRow(allHistory[i])) tripsIdx.push(i);
  }
  if (!tripsIdx.length) return -1;
  if (tripsIdx.length === 1) return tripsIdx[0];

  for (let t = tripsIdx.length - 1; t >= 1; t--){
    const cur = allHistory[tripsIdx[t]];
    const prev = allHistory[tripsIdx[t - 1]];
    if (Number.isFinite(cur.socStart) && Number.isFinite(prev.socEnd) && cur.socStart > prev.socEnd + 1){
      return tripsIdx[t];
    }
  }
  return tripsIdx[0];
}

function buildStintSummary(allHistory, stintStartIndex){
  const trips = allHistory.slice(stintStartIndex).filter(isTripRow);
  if (!trips.length) return null;

  const first = trips[0];
  const last = trips[trips.length - 1];

  let km = 0, kwh = 0, cost = 0;
  for (const t of trips){
    km += Number(t.kmTrip) || 0;
    kwh += Number(t.kwhUsed) || 0;
    cost += Number(t.cost) || 0;
  }

  const avg = km > 0 ? (kwh / km) * 100 : NaN;
  const socUsed = (Number(first.socStart) || 0) - (Number(last.socEnd) || 0);

  return {
    kind: "stintSummary",
    date: last.date,
    trips: trips.length,
    km,
    kwh,
    avg,
    socUsed,
    cost,
    socFrom: first.socStart,
    socTo: last.socEnd
  };
}

// ===== Histórico =====
function renderHistory(){
  const table = $("historyTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const allHistory = getHistory();

  // UI helpers (no dependen de filtros)
  updateOdometerUI(allHistory);
  autofillKmStartFromHistory(allHistory);
  autofillSocStartFromHistory(allHistory);

  const visible = getFilteredHistory(allHistory);

  // stats: SOLO trayectos (nunca sumar resúmenes)
  const visibleTrips = visible.filter(isTripRow);

  let totalKm = 0, totalKwh = 0, totalCost = 0;
  const byType = {
    "Ciudad": { km: 0, kwh: 0 },
    "Mixto": { km: 0, kwh: 0 },
    "Autopista": { km: 0, kwh: 0 }
  };

  for (const e of visibleTrips){
    totalKm += Number(e.kmTrip) || 0;
    totalKwh += Number(e.kwhUsed) || 0;
    totalCost += Number(e.cost) || 0;

    if (byType[e.tripType]){
      byType[e.tripType].km += Number(e.kmTrip) || 0;
      byType[e.tripType].kwh += Number(e.kwhUsed) || 0;
    }
  }

  const globalAvg = totalKm > 0 ? (totalKwh / totalKm) * 100 : NaN;
  const avgCity = byType["Ciudad"].km > 0 ? (byType["Ciudad"].kwh / byType["Ciudad"].km) * 100 : NaN;
  const avgMixed = byType["Mixto"].km > 0 ? (byType["Mixto"].kwh / byType["Mixto"].km) * 100 : NaN;
  const avgHighway = byType["Autopista"].km > 0 ? (byType["Autopista"].kwh / byType["Autopista"].km) * 100 : NaN;

  if ($("totalKm")) $("totalKm").textContent = fmtKm(totalKm);
  if ($("totalKwh")) $("totalKwh").textContent = fmtKwh(totalKwh);
  if ($("globalAvg")) $("globalAvg").textContent = fmtAvg(globalAvg);
  if ($("totalCost")) $("totalCost").textContent = fmtEUR(totalCost);

  if ($("avgCity")) $("avgCity").textContent = fmtAvg(avgCity);
  if ($("avgMixed")) $("avgMixed").textContent = fmtAvg(avgMixed);
  if ($("avgHighway")) $("avgHighway").textContent = fmtAvg(avgHighway);

  // render filas
  visible.forEach(e => {
    const tr = document.createElement("tr");

    if (e.kind === "stintSummary"){
      tr.className = "stint-summary";
      tr.innerHTML = `
        <td>🔋 Resumen batería</td>
        <td>${e.trips} tray.</td>
        <td>${fmtNum(e.km,1)}</td>
        <td>${fmtNum(e.socUsed,0)}%</td>
        <td>${fmtNum(e.kwh,2)}</td>
        <td>${fmtNum(e.avg,1)}</td>
        <td>—</td>
        <td>—</td>
        <td>${fmtNum(e.cost,2)}</td>
        <td>${fmtNum(e.socFrom,0)}→${fmtNum(e.socTo,0)}%</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.tripType}</td>
      <td>${fmtNum(e.kmTrip,1)}</td>
      <td>${e.socStart}-${e.socEnd}</td>
      <td>${fmtNum(e.kwhUsed,2)}</td>
      <td>${fmtNum(e.avg,1)}</td>
      <td>${e.climate === "Sí" ? "❄️" : "—"}</td>
      <td>${e.seatsHeat === "Sí" ? "🔥" : "—"}</td>
      <td>${fmtNum(e.cost,2)}</td>
      <td>${(e.notes || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== CSV =====
function csvEsc(v){
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function exportCSV(){
  const h = getHistory();
  if (!h.length){
    setMessage("No hay datos para exportar.");
    return;
  }

  // exporta SOLO trayectos (para CSV limpio)
  const trips = h.filter(isTripRow);

  const headers = [
    "Fecha","Tipo","Km inicio","Km fin","Km",
    "% inicio","% final","% usado",
    "kWh","kWh/100km",
    "Carga exterior","Precio €/kWh","Coste €",
    "Climatización","Asientos calefactables",
    "Notas"
  ];

  const rows = trips.map(e => ([
    e.date,
    e.tripType,
    e.kmStart,
    e.kmEnd,
    Number(e.kmTrip).toFixed(1),
    e.socStart,
    e.socEnd,
    e.socUsed,
    Number(e.kwhUsed).toFixed(2),
    Number(e.avg).toFixed(1),
    e.external ? "Sí" : "No",
    Number(e.price).toFixed(4),
    Number(e.cost).toFixed(2),
    e.climate || "No",
    e.seatsHeat || "No",
    e.notes || ""
  ].map(csvEsc).join(",")));

  const csv = headers.join(",") + "\n" + rows.join("\n") + "\n";
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "r5_consumo_log.csv";
  a.click();

  URL.revokeObjectURL(url);
  setMessage("CSV exportado.");
}

function parseCSV(text){
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (inQuotes){
      if (ch === '"'){
        if (text[i + 1] === '"'){ cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ","){ row.push(cur); cur = ""; }
      else if (ch === "\n"){ row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r"){ /* ignore */ }
      else cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0){ row.push(cur); rows.push(row); }
  return rows;
}

function entryKey(e){
  return [
    e.date, e.tripType,
    Number(e.kmStart).toFixed(1),
    Number(e.kmEnd).toFixed(1),
    Number(e.socStart).toFixed(0),
    Number(e.socEnd).toFixed(0),
    e.climate || "No",
    e.seatsHeat || "No"
  ].join("|");
}

function importCSVFile(file){
  const reader = new FileReader();

  reader.onload = (ev) => {
    const text = String(ev.target.result || "").trim();
    if (!text){ setMessage("El CSV está vacío."); return; }

    const rows = parseCSV(text);
    if (rows.length < 2){ setMessage("CSV sin datos (solo cabecera)."); return; }

    const replace = $("replaceOnImport")?.checked;
    let history = replace ? [] : getHistory();
    history = history.filter(isTripRow); // al importar, nos quedamos con trips

    const existing = new Set(history.map(entryKey));
    let imported = 0, skipped = 0;

    for (let r = 1; r < rows.length; r++){
      const cols = rows[r];
      if (!cols || cols.length < 10) continue;

      const date = (cols[0] || "").trim();
      const tripType = (cols[1] || "").trim() || "Mixto";
      const kmStart = parseFloat(cols[2]);
      const kmEnd = parseFloat(cols[3]);
      const kmTrip = parseFloat(cols[4]);
      const socStart = parseFloat(cols[5]);
      const socEnd = parseFloat(cols[6]);
      const socUsed = parseFloat(cols[7]);
      const kwhUsed = parseFloat(cols[8]);
      const avg = parseFloat(cols[9]);
      const external = (cols[10] || "").trim().toLowerCase() === "sí";
      const price = parseFloat(cols[11]);
      const cost = parseFloat(cols[12]);

      const climate = (cols[13] || "").trim() || "No";
      const seatsHeat = (cols[14] || "").trim() || "No";
      const notes = (cols[15] || "").trim();

      if (!date || !Number.isFinite(kmStart) || !Number.isFinite(kmEnd) || !Number.isFinite(kmTrip)) continue;

      const entry = {
        kind: "trip",
        date,
        tripType,
        kmStart,
        kmEnd,
        kmTrip,
        socStart: Number.isFinite(socStart) ? socStart : 0,
        socEnd: Number.isFinite(socEnd) ? socEnd : 0,
        socUsed: Number.isFinite(socUsed) ? socUsed : 0,
        kwhUsed: Number.isFinite(kwhUsed) ? kwhUsed : 0,
        avg: Number.isFinite(avg) ? avg : 0,
        external,
        price: Number.isFinite(price) ? price : DEFAULT_HOME_PRICE,
        cost: Number.isFinite(cost) ? cost : 0,
        climate: climate === "Sí" ? "Sí" : "No",
        seatsHeat: seatsHeat === "Sí" ? "Sí" : "No",
        notes
      };

      const key = entryKey(entry);
      if (existing.has(key)){ skipped++; continue; }
      existing.add(key);
      history.push(entry);
      imported++;
    }

    saveHistory(history);
    renderHistory();

    setMessage(
      replace
        ? `Importación completada (reemplazado). Importados: ${imported}.`
        : `Importación completada. Importados: ${imported}. Duplicados omitidos: ${skipped}.`
    );
  };

  reader.readAsText(file, "utf-8");
}

// ===== Guardar / Limpiar =====
function saveTrip(){
  const c = computeCurrent();

  if (!Number.isFinite(c.kmStart) || !Number.isFinite(c.kmEnd)){
    setMessage("Rellena Km inicio y Km fin.");
    return;
  }
  if (c.kmTrip <= 0){
    setMessage("Km fin debe ser mayor que Km inicio.");
    return;
  }
  if (c.socStart < c.socEnd){
    setMessage("% inicio no puede ser menor que % final.");
    return;
  }

  const dateInput = $("date")?.value;
  const date = dateInput
    ? dateInput.split("-").reverse().join("/")
    : new Date().toLocaleDateString("es-ES");

  const entry = {
    kind: "trip",
    date,
    tripType: $("tripType")?.value || "Mixto",
    climate: $("climate")?.value || "No",
    seatsHeat: $("seatsHeat")?.value || "No",
    kmStart: c.kmStart,
    kmEnd: c.kmEnd,
    kmTrip: c.kmTrip,
    socStart: c.socStart,
    socEnd: c.socEnd,
    socUsed: Math.max(0, c.socUsed),
    kwhUsed: c.kwhUsed,
    avg: c.avg,
    external: $("externalCharge")?.checked || false,
    price: c.price,
    cost: c.cost,
    notes: ($("notes")?.value || "").trim()
  };

  const history = getHistory();

  // detectar recarga: socStart nuevo > socEnd del último trayecto
  const lastTrip = getLastTrip(history);
  if (lastTrip && Number.isFinite(lastTrip.socEnd) && entry.socStart > lastTrip.socEnd + 1){
    const startIdx = findCurrentStintStartIndex(history);
    if (startIdx >= 0){
      const summary = buildStintSummary(history, startIdx);
      if (summary){
        // ✅ resumen ANTES del trayecto que inicia tras recarga
        history.push(summary);
      }
    }
  }

  history.push(entry);
  saveHistory(history);
  renderHistory();

  // UX: siguiente trayecto empieza con el Km fin anterior
  if ($("kmStart")) $("kmStart").value = c.kmEnd;
  if ($("kmEnd")) $("kmEnd").value = "";
  if ($("notes")) $("notes").value = "";

  setMessage("Trayecto guardado.");
  computeCurrent();
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  setMessage("Histórico borrado.");
}

function init(){
  const dateEl = $("date");
  if (dateEl){
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,"0");
    const dd = String(today.getDate()).padStart(2,"0");
    dateEl.value = `${yyyy}-${mm}-${dd}`;
  }

  applyPriceUI();
  computeCurrent();
  renderHistory();

  const watchIds = ["kmStart","kmEnd","socStart","socEnd","notes","tripType","date","climate","seatsHeat"];
  watchIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", computeCurrent);
    el.addEventListener("change", computeCurrent);
  });

  if ($("externalCharge")){
    $("externalCharge").addEventListener("change", () => {
      applyPriceUI();
      computeCurrent();
    });
  }
  if ($("price")) $("price").addEventListener("input", computeCurrent);

  if ($("saveTrip")) $("saveTrip").addEventListener("click", saveTrip);
  if ($("exportCSV")) $("exportCSV").addEventListener("click", exportCSV);
  if ($("clearHistory")) $("clearHistory").addEventListener("click", clearHistory);

  if ($("importCSV") && $("csvFile")){
    $("importCSV").addEventListener("click", () => $("csvFile").click());
    $("csvFile").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      importCSVFile(file);
      e.target.value = "";
    });
  }

  if ($("filterType")) $("filterType").addEventListener("change", renderHistory);
  if ($("filterExtras")) $("filterExtras").addEventListener("change", renderHistory);

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

window.addEventListener("load", init);
