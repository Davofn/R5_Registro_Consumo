const BATTERY_KWH = 52;
const DEFAULT_HOME_PRICE = 0.1176;
const STORAGE_KEY = "r5_consumo_log_history";

const $ = (id) => document.getElementById(id);

function clamp(n, min, max){
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function autofillKmStart(){
  const history = getHistory();
  if (!history.length) return;

  const last = history[history.length - 1];
  if (Number.isFinite(last.kmEnd)){
    const input = $("kmStart");
    if (input && !input.value){
      input.value = last.kmEnd;
    }
  }
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
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveHistory(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function setMessage(text){
  const el = $("msg");
  if (el) el.textContent = text || "";
}

function computeCurrent(){
  const kmStart = parseFloat($("kmStart").value);
  const kmEnd = parseFloat($("kmEnd").value);

  const socStart = clamp(parseFloat($("socStart").value), 0, 100);
  const socEnd = clamp(parseFloat($("socEnd").value), 0, 100);

  $("socStart").value = socStart;
  $("socEnd").value = socEnd;

  const kmTrip = (Number.isFinite(kmStart) && Number.isFinite(kmEnd)) ? (kmEnd - kmStart) : NaN;
  const socUsed = socStart - socEnd;
  const kwhUsed = (Number.isFinite(socUsed) ? Math.max(0, socUsed) : NaN) / 100 * BATTERY_KWH;

  const avg = (Number.isFinite(kmTrip) && kmTrip > 0 && Number.isFinite(kwhUsed))
    ? (kwhUsed / kmTrip) * 100
    : NaN;

  const price = Math.max(0, parseFloat($("price").value));
  const cost = Number.isFinite(kwhUsed) ? (kwhUsed * price) : NaN;

  $("kmTrip").textContent = fmtKm(kmTrip);
  $("kwhUsed").textContent = fmtKwh(kwhUsed);
  $("avg").textContent = fmtAvg(avg);
  $("cost").textContent = fmtEUR(cost);

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

// ===== filtros =====
function getFilteredHistory(all){
  const type = $("filterType")?.value || "Todos";
  const extras = $("filterExtras")?.value || "Todos";

  return all.filter(e => {
    if (type !== "Todos" && e.tripType !== type) return false;

    const hasClimate = e.climate === "Sí";
    const hasSeats = e.seatsHeat === "Sí";

    if (extras === "Clima" && !hasClimate) return false;
    if (extras === "Asientos" && !hasSeats) return false;
    if (extras === "Ambos" && !(hasClimate && hasSeats)) return false;

    return true;
  });
}
function updateOdometerUI(history){
  const el = $("odoNow");
  if (!el) return;

  if (!history.length){
    el.textContent = "—";
    return;
  }

  const last = history[history.length - 1];
  el.textContent = Number.isFinite(last.kmEnd) ? fmtKm(last.kmEnd) : "—";
}

function autofillKmStartFromHistory(history){
  if (!history.length) return;
  const last = history[history.length - 1];
  if (!Number.isFinite(last.kmEnd)) return;

  const input = $("kmStart");
  if (input && !input.value){
    input.value = last.kmEnd;
  }
}
function renderHistory(){
  const table = $("historyTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const allHistory = getHistory();
  updateOdometerUI(allHistory);
  autofillKmStartFromHistory(allHistory);
  autofillSocStartFromHistory(allHistory);
  const history = getFilteredHistory(allHistory);
  

  let totalKm = 0;
  let totalKwh = 0;
  let totalCost = 0;

  const byType = {
    "Ciudad": { km: 0, kwh: 0 },
    "Mixto": { km: 0, kwh: 0 },
    "Autopista": { km: 0, kwh: 0 }
  };

  history.forEach(e => {
    totalKm += e.kmTrip;
    totalKwh += e.kwhUsed;
    totalCost += e.cost;

    if (byType[e.tripType]) {
      byType[e.tripType].km += e.kmTrip;
      byType[e.tripType].kwh += e.kwhUsed;
    }

    const tr = document.createElement("tr");
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
}

// ===== CSV =====
function csvEsc(v){
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function exportCSV(){
  const h = getHistory(); // exporta todo (no filtrado)
  if (!h.length){
    setMessage("No hay datos para exportar.");
    return;
  }

  const headers = [
    "Fecha","Tipo","Km inicio","Km fin","Km",
    "% inicio","% final","% usado",
    "kWh","kWh/100km",
    "Carga exterior","Precio €/kWh","Coste €",
    "Climatización","Asientos calefactables",
    "Notas"
  ];

  const rows = h.map(e => ([
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

// ===== Importar CSV =====
function parseCSV(text){
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++){
    const ch = text[i];

    if (inQuotes){
      if (ch === '"'){
        if (text[i + 1] === '"'){
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"'){
        inQuotes = true;
      } else if (ch === ","){
        row.push(cur); cur = "";
      } else if (ch === "\n"){
        row.push(cur); rows.push(row);
        row = []; cur = "";
      } else if (ch === "\r"){
        // ignore
      } else {
        cur += ch;
      }
    }
  }

  if (cur.length > 0 || row.length > 0){
    row.push(cur);
    rows.push(row);
  }

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
    if (!text){
      setMessage("El CSV está vacío.");
      return;
    }

    const rows = parseCSV(text);
    if (rows.length < 2){
      setMessage("CSV sin datos (solo cabecera).");
      return;
    }

    const replace = $("replaceOnImport")?.checked;
    let history = replace ? [] : getHistory();
    const existing = new Set(history.map(entryKey));

    let imported = 0;
    let skipped = 0;

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

      // compatibilidad con CSV antiguos:
      const climate = (cols[13] || "").trim() || "No";
      const seatsHeat = (cols[14] || "").trim() || "No";
      const notes = (cols[15] || "").trim();

      if (!date || !Number.isFinite(kmStart) || !Number.isFinite(kmEnd) || !Number.isFinite(kmTrip)) continue;

      const entry = {
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

  const dateInput = $("date").value;
  const date = dateInput
    ? dateInput.split("-").reverse().join("/")
    : new Date().toLocaleDateString("es-ES");

  const entry = {
    date,
    tripType: $("tripType").value,
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
    notes: $("notes").value.trim()
  };

  const history = getHistory();
  history.push(entry);
  saveHistory(history);
  renderHistory();

  // UX: siguiente trayecto empieza con el Km fin anterior
  $("kmStart").value = c.kmEnd;
  $("kmEnd").value = "";
  $("notes").value = "";

  setMessage("Trayecto guardado. Km inicio actualizado con el Km fin anterior.");
  computeCurrent();
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  setMessage("Histórico borrado.");
}

function init(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  if ($("date")) $("date").value = `${yyyy}-${mm}-${dd}`;

  applyPriceUI();
  computeCurrent();
  renderHistory();
  autofillKmStart();

  ["kmStart","kmEnd","socStart","socEnd","notes","tripType","date","climate","seatsHeat"].forEach(id => {
    if (!$(id)) return;
    $(id).addEventListener("input", computeCurrent);
    $(id).addEventListener("change", computeCurrent);
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

  // filtros
  if ($("filterType")) $("filterType").addEventListener("change", renderHistory);
  if ($("filterExtras")) $("filterExtras").addEventListener("change", renderHistory);

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}


window.addEventListener("load", init);

