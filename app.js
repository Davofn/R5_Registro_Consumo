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
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}
function fmtKwh(n){ return Number.isFinite(n) ? `${fmtNum(n,2)} kWh` : "—"; }
function fmtKm(n){ return Number.isFinite(n) ? `${fmtNum(n,1)} km` : "—"; }
function fmtAvg(n){ return Number.isFinite(n) ? `${fmtNum(n,1)} kWh/100km` : "—"; }
function fmtEUR(n){
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n);
}

function getHistory(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function saveHistory(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

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
  const avg = (Number.isFinite(kmTrip) && kmTrip > 0 && Number.isFinite(kwhUsed)) ? (kwhUsed / kmTrip) * 100 : NaN;

  const price = Math.max(0, parseFloat($("price").value));
  const cost = Number.isFinite(kwhUsed) ? (kwhUsed * price) : NaN;

  $("kmTrip").textContent = fmtKm(kmTrip);
  $("kwhUsed").textContent = fmtKwh(kwhUsed);
  $("avg").textContent = fmtAvg(avg);
  $("cost").textContent = fmtEUR(cost);

  return { kmStart, kmEnd, kmTrip, socStart, socEnd, socUsed, kwhUsed, avg, price, cost };
}

function setMessage(text){ $("msg").textContent = text || ""; }

function renderHistory(){
  const tbody = $("historyTable").querySelector("tbody");
  tbody.innerHTML = "";
  const history = getHistory();

  let totalKm = 0, totalKwh = 0, totalCost = 0;

  history.forEach(e => {
    totalKm += e.kmTrip;
    totalKwh += e.kwhUsed;
    totalCost += e.cost;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.tripType}</td>
      <td>${fmtNum(e.kmTrip,1)}</td>
      <td>${e.socStart}-${e.socEnd}</td>
      <td>${fmtNum(e.kwhUsed,2)}</td>
      <td>${fmtNum(e.avg,1)}</td>
      <td>${fmtNum(e.cost,2)}</td>
      <td>${(e.notes || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td>
    `;
    tbody.appendChild(tr);
  });

  const globalAvg = totalKm > 0 ? (totalKwh / totalKm) * 100 : NaN;

  $("totalKm").textContent = fmtKm(totalKm);
  $("totalKwh").textContent = fmtKwh(totalKwh);
  $("globalAvg").textContent = fmtAvg(globalAvg);
  $("totalCost").textContent = fmtEUR(totalCost);
}

function exportCSV(){
  const h = getHistory();
  if (!h.length){ setMessage("No hay datos para exportar."); return; }

  const headers = ["Fecha","Tipo","Km inicio","Km fin","Km","% inicio","% final","% usado","kWh","kWh/100km","Carga exterior","Precio €/kWh","Coste €","Notas"];
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };

  const rows = h.map(e => [
    e.date, e.tripType, e.kmStart, e.kmEnd, e.kmTrip.toFixed(1),
    e.socStart, e.socEnd, e.socUsed,
    e.kwhUsed.toFixed(2), e.avg.toFixed(1),
    e.external ? "Sí" : "No",
    e.price.toFixed(4), e.cost.toFixed(2),
    e.notes || ""
  ].map(esc).join(","));

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

function applyPriceUI(){
  const external = $("externalCharge").checked;
  const priceInput = $("price");
  if (!external){
    priceInput.value = DEFAULT_HOME_PRICE.toString();
    priceInput.disabled = true;
  } else {
    if (priceInput.disabled) priceInput.value = "0.45";
    priceInput.disabled = false;
  }
}

function saveTrip(){
  const c = computeCurrent();

  if (!Number.isFinite(c.kmStart) || !Number.isFinite(c.kmEnd)){
    setMessage("Rellena Km inicio y Km fin."); return;
  }
  if (c.kmTrip <= 0){
    setMessage("Km fin debe ser mayor que Km inicio."); return;
  }
  if (c.socStart < c.socEnd){
    setMessage("% inicio no puede ser menor que % final."); return;
  }

  const dateInput = $("date").value;
  const date = dateInput ? dateInput.split("-").reverse().join("/") : new Date().toLocaleDateString("es-ES");

  const entry = {
    date,
    tripType: $("tripType").value,
    kmStart: c.kmStart,
    kmEnd: c.kmEnd,
    kmTrip: c.kmTrip,
    socStart: c.socStart,
    socEnd: c.socEnd,
    socUsed: Math.max(0, c.socUsed),
    kwhUsed: c.kwhUsed,
    avg: c.avg,
    external: $("externalCharge").checked,
    price: c.price,
    cost: c.cost,
    notes: $("notes").value.trim()
  };

  const history = getHistory();
  history.push(entry);
  saveHistory(history);
  renderHistory();

  // ✅ tu UX: km fin → siguiente km inicio
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
  $("date").value = `${yyyy}-${mm}-${dd}`;

  applyPriceUI();
  computeCurrent();
  renderHistory();

  ["kmStart","kmEnd","socStart","socEnd","notes","tripType","date"].forEach(id => {
    $(id).addEventListener("input", computeCurrent);
    $(id).addEventListener("change", computeCurrent);
  });

  $("externalCharge").addEventListener("change", () => { applyPriceUI(); computeCurrent(); });
  $("price").addEventListener("input", computeCurrent);

  $("saveTrip").addEventListener("click", saveTrip);
  $("exportCSV").addEventListener("click", exportCSV);
  $("clearHistory").addEventListener("click", clearHistory);

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

window.addEventListener("load", init);