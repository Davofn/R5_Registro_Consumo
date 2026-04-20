import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://fzsioxqmpjmunaszrjdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_lPgxna3-91FskASGGI854g_RZndEz2S";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  let trips = [];
  let chartInstance = null;
  let editingTripId = null;

  const BATTERY_KWH = 52;
  const DEFAULT_HOME_PRICE = 0.1176;
  const DEFAULT_EXTERNAL_PRICE = 0.45;
  const GHOST_TYPE = "Consumo fantasma";

  // HERO
  const odoNowEl = document.getElementById("odoNow");
  const globalAvgEl = document.getElementById("globalAvg");
  const realRangeEl = document.getElementById("realRange");
  const costPer100El = document.getElementById("costPer100");
  const totalKmEl = document.getElementById("totalKm");

  // SUMMARY
  const totalKwhEl = document.getElementById("totalKwh");
  const totalCostEl = document.getElementById("totalCost");
  const tripCountEl = document.getElementById("tripCount");
  const avgCityEl = document.getElementById("avgCity");
  const avgMixedEl = document.getElementById("avgMixed");
  const avgHighwayEl = document.getElementById("avgHighway");
  const lastStintSummaryEl = document.getElementById("lastStintSummary");

  // MODAL
  const tripModal = document.getElementById("tripModal");
  const openTripModalBtn = document.getElementById("openTripModal");
  const closeTripModalBtn = document.getElementById("closeTripModal");
  const closeTripModalBackdrop = document.getElementById("closeTripModalBackdrop");
  const toggleAdvancedBtn = document.getElementById("toggleAdvanced");
  const advancedFields = document.getElementById("advancedFields");
  const saveTripBtn = document.getElementById("saveTrip");

  // FORM
  const dateEl = document.getElementById("date");
  const tripTypeEl = document.getElementById("tripType");
  const kmStartEl = document.getElementById("kmStart");
  const kmEndEl = document.getElementById("kmEnd");
  const socStartEl = document.getElementById("socStart");
  const socEndEl = document.getElementById("socEnd");
  const climateEl = document.getElementById("climate");
  const seatsHeatEl = document.getElementById("seatsHeat");
  const externalChargeEl = document.getElementById("externalCharge");
  const priceEl = document.getElementById("price");
  const notesEl = document.getElementById("notes");

  // COMPUTED
  const kmTripEl = document.getElementById("kmTrip");
  const kwhUsedEl = document.getElementById("kwhUsed");
  const avgEl = document.getElementById("avg");
  const costEl = document.getElementById("cost");

  // HISTORY / FILTERS
  const historyListEl = document.getElementById("historyList");
  const toggleFiltersBtn = document.getElementById("toggleFilters");
  const filtersPanel = document.getElementById("filtersPanel");
  const filterTypeEl = document.getElementById("filterType");
  const filterExtrasEl = document.getElementById("filterExtras");

  // IMPORT / EXPORT
  const exportCSVBtn = document.getElementById("exportCSV");
  const importCSVBtn = document.getElementById("importCSV");
  const csvFileEl = document.getElementById("csvFile");
  const replaceOnImportEl = document.getElementById("replaceOnImport");

  // MSG
  const msgEl = document.getElementById("msg");

  // CHART
  const chartCanvas = document.getElementById("consumptionChart");
  const chartAvgEl = document.getElementById("chartAvg");
  const chartMinEl = document.getElementById("chartMin");
  const chartMaxEl = document.getElementById("chartMax");

  // TABS
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");

  const required = [
    tripModal, openTripModalBtn, closeTripModalBtn, closeTripModalBackdrop,
    toggleAdvancedBtn, advancedFields, saveTripBtn,
    historyListEl, chartCanvas
  ];

  if (required.some(el => !el)) {
    console.error("Faltan elementos del DOM. Revisa IDs del HTML.");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showMsg(text) {
    if (!msgEl) return;
    msgEl.textContent = text;
    setTimeout(() => {
      if (msgEl.textContent === text) msgEl.textContent = "";
    }, 2500);
  }

  function formatNumber(value, digits = 1) {
    return Number(value).toFixed(digits).replace(".", ",");
  }

  function formatKm(value) {
    return `${formatNumber(value, 1)} km`;
  }

  function formatKwh(value) {
    return `${formatNumber(value, 2)} kWh`;
  }

  function formatAvg(value) {
    return `${formatNumber(value, 1)} kWh/100 km`;
  }

  function formatEuro(value) {
    return `${formatNumber(value, 2)} €`;
  }

  function safeAvg(totalKwh, totalKm) {
    return totalKm > 0 ? (totalKwh / totalKm) * 100 : 0;
  }

  function clamp(n, min, max) {
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function isGhostTrip(trip) {
    return trip?.tripType === GHOST_TYPE;
  }

  function getDrivingTrips(arr = trips) {
    return arr.filter(t => !isGhostTrip(t));
  }

  function toDbDate(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

  function dbDateToInput(dbDate) {
    if (!dbDate) return "";
    if (dbDate.includes("-")) return dbDate;
    const [d, m, y] = dbDate.split("/");
    return `${y}-${m}-${d}`;
  }

  function sortDateValue(dateStr) {
    if (!dateStr) return 0;
    if (dateStr.includes("-")) return new Date(dateStr).getTime();
    const [d, m, y] = dateStr.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  function normalizeTripFromRow(row) {
    return {
      kind: "trip",
      id: row.id,
      date: row.trip_date,
      tripType: row.trip_type,
      climate: row.climate || "No",
      seatsHeat: row.seats_heat || "No",
      kmStart: Number(row.km_start),
      kmEnd: Number(row.km_end),
      kmTrip: Number(row.km_trip),
      socStart: Number(row.soc_start),
      socEnd: Number(row.soc_end),
      socUsed: Number(row.soc_start) - Number(row.soc_end),
      kwhUsed: Number(row.kwh_used),
      avg: Number(row.avg),
      external: !!row.external,
      price: Number(row.price ?? DEFAULT_HOME_PRICE),
      cost: Number(row.cost ?? 0),
      notes: row.notes || "",
      created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  function tripToRow(entry) {
    return {
      trip_date: entry.date,
      trip_type: entry.tripType,
      climate: entry.climate || "No",
      seats_heat: entry.seatsHeat || "No",
      km_start: entry.kmStart,
      km_end: entry.kmEnd,
      km_trip: entry.kmTrip,
      soc_start: entry.socStart,
      soc_end: entry.socEnd,
      soc_used: entry.socUsed,
      kwh_used: entry.kwhUsed,
      avg: Number.isFinite(entry.avg) ? entry.avg : null,
      external: entry.external || false,
      price: entry.price ?? DEFAULT_HOME_PRICE,
      cost: entry.cost ?? 0,
      notes: entry.notes || ""
    };
  }

  async function fetchTripsFromSupabase() {
    const { data, error } = await supabase
      .from("trips")
      .select("*");

    if (error) {
      console.error("Error cargando trips desde Supabase:", error);
      throw error;
    }

    return (data || [])
      .map(normalizeTripFromRow)
      .sort((a, b) => {
        const da = sortDateValue(a.date);
        const db = sortDateValue(b.date);
        if (da !== db) return da - db;
        return a.created_at - b.created_at;
      });
  }

  async function insertTripToSupabase(entry) {
    const row = tripToRow(entry);
    const { error } = await supabase.from("trips").insert([row]);

    if (error) {
      console.error("Error insertando trip en Supabase:", error);
      throw error;
    }
  }
  async function updateTripInSupabase(id, entry) {
    const row = tripToRow(entry);
    const { error } = await supabase
      .from("trips")
      .update(row)
      .eq("id", id);

    if (error) {
      console.error("Error actualizando trip en Supabase:", error);
      throw error;
    }
  }
  async function importTripsToSupabase(entries) {
    if (!entries.length) return { inserted: 0 };

    const rows = entries.map(tripToRow);
    const { error } = await supabase.from("trips").insert(rows);

    if (error) {
      console.error("Error importando CSV a Supabase:", error);
      throw error;
    }

    return { inserted: rows.length };
  }

  async function deleteAllTripsFromSupabase() {
    const { error } = await supabase
      .from("trips")
      .delete()
      .not("id", "is", null);

    if (error) {
      console.error("Error borrando histórico en Supabase:", error);
      throw error;
    }
  }

  function syncGhostTripUi() {
    const isGhost = tripTypeEl.value === GHOST_TYPE;

    if (isGhost && kmStartEl.value) {
      kmEndEl.value = kmStartEl.value;
    }

    if (isGhost) {
      kmEndEl.setAttribute("readonly", "readonly");
    } else {
      kmEndEl.removeAttribute("readonly");
    }

    updateComputedCards();
  }

  function getComputedFromForm() {
    const isGhost = tripTypeEl.value === GHOST_TYPE;

    const kmStart = parseFloat(kmStartEl.value);
    let kmEnd = parseFloat(kmEndEl.value);

    const socStart = clamp(parseFloat(socStartEl.value), 0, 100);
    const socEnd = clamp(parseFloat(socEndEl.value), 0, 100);

    socStartEl.value = socStart;
    socEndEl.value = socEnd;

    if (isGhost && Number.isFinite(kmStart)) {
      kmEnd = kmStart;
      kmEndEl.value = kmStart;
    }

    const kmTrip = isGhost
      ? 0
      : (Number.isFinite(kmStart) && Number.isFinite(kmEnd) ? kmEnd - kmStart : NaN);

    const socUsed = socStart - socEnd;
    const kwhUsed = (Number.isFinite(socUsed) ? Math.max(0, socUsed) : NaN) / 100 * BATTERY_KWH;
    const avg = !isGhost && Number.isFinite(kmTrip) && kmTrip > 0 && Number.isFinite(kwhUsed)
      ? (kwhUsed / kmTrip) * 100
      : NaN;

    const price = Math.max(0, parseFloat(priceEl.value));
    const cost = Number.isFinite(kwhUsed) ? kwhUsed * price : NaN;

    return { kmStart, kmEnd, socStart, socEnd, socUsed, kmTrip, kwhUsed, avg, price, cost, isGhost };
  }

  function updateComputedCards() {
    const { kmTrip, kwhUsed, avg, cost } = getComputedFromForm();

    kmTripEl.textContent = Number.isFinite(kmTrip) ? formatKm(kmTrip) : "—";
    kwhUsedEl.textContent = Number.isFinite(kwhUsed) ? formatKwh(kwhUsed) : "—";
    avgEl.textContent = Number.isFinite(avg) ? formatAvg(avg) : "—";
    costEl.textContent = Number.isFinite(cost) ? formatEuro(cost) : "—";
  }

  function clearForm() {
    editingTripId = null;
    document.getElementById("tripModalTitle").textContent = "Añadir trayecto";
    saveTripBtn.textContent = "Guardar trayecto";
    const today = new Date().toISOString().slice(0, 10);
    dateEl.value = today;
    tripTypeEl.value = "Mixto";
    climateEl.value = "No";
    seatsHeatEl.value = "No";
    externalChargeEl.checked = false;
    priceEl.value = String(DEFAULT_HOME_PRICE);
    notesEl.value = "";
    advancedFields.classList.add("hidden");
    toggleAdvancedBtn.setAttribute("aria-expanded", "false");
    toggleAdvancedBtn.textContent = "Mostrar opciones avanzadas";

    if (trips.length > 0) {
      const last = trips[trips.length - 1];
      kmStartEl.value = last.kmEnd;
      socStartEl.value = last.socEnd;
      dateEl.value = new Date().toISOString().slice(0, 10);
    } else {
      kmStartEl.value = "";
      socStartEl.value = 80;
    }

    kmEndEl.value = "";
    socEndEl.value = 60;

    syncGhostTripUi();
  }
  function fillFormForEdit(trip) {
    editingTripId = trip.id;

    dateEl.value = dbDateToInput(trip.date);
    tripTypeEl.value = trip.tripType;
    kmStartEl.value = trip.kmStart;
    kmEndEl.value = trip.kmEnd;
    socStartEl.value = trip.socStart;
    socEndEl.value = trip.socEnd;
    climateEl.value = trip.climate || "No";
    seatsHeatEl.value = trip.seatsHeat || "No";
    externalChargeEl.checked = !!trip.external;
    priceEl.value = String(trip.price ?? DEFAULT_HOME_PRICE);
    notesEl.value = trip.notes || "";

    advancedFields.classList.remove("hidden");
    toggleAdvancedBtn.setAttribute("aria-expanded", "true");
    toggleAdvancedBtn.textContent = "Ocultar opciones avanzadas";

    document.getElementById("tripModalTitle").textContent = "Editar trayecto";
    saveTripBtn.textContent = "Guardar cambios";

    syncGhostTripUi();
    updateComputedCards();
  }
  function openModal() {
    tripModal.classList.remove("hidden");
    tripModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    tripModal.classList.add("hidden");
    tripModal.setAttribute("aria-hidden", "true");
  }

  function buildStints(filteredTrips = trips) {
    if (!filteredTrips.length) return [];

    const sorted = [...filteredTrips].sort((a, b) => {
      const da = sortDateValue(a.date);
      const db = sortDateValue(b.date);
      if (da !== db) return da - db;
      return a.created_at - b.created_at;
    });

    const stints = [];
    let current = [];

    for (let i = 0; i < sorted.length; i++) {
      const trip = sorted[i];

      if (i > 0) {
        const prev = sorted[i - 1];
        if (trip.socStart > prev.socEnd) {
          if (current.length) stints.push([...current]);
          current = [];
        }
      }

      current.push(trip);
    }

    if (current.length) stints.push([...current]);
    return stints;
  }

  function summarizeStint(stint) {
    const drivingTrips = getDrivingTrips(stint);

    const totalKm = stint.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalKwh = stint.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = stint.reduce((sum, t) => sum + t.cost, 0);

    const totalDrivingKm = drivingTrips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalDrivingKwh = drivingTrips.reduce((sum, t) => sum + t.kwhUsed, 0);

    const socStart = stint[0].socStart;
    const socEnd = stint[stint.length - 1].socEnd;
    const socUsed = socStart - socEnd;
    const avg = safeAvg(totalDrivingKwh, totalDrivingKm);

    return {
      count: stint.length,
      totalKm,
      totalKwh,
      totalCost,
      socStart,
      socEnd,
      socUsed,
      avg,
      trips: stint
    };
  }

  function renderHero() {
    const drivingTrips = getDrivingTrips(trips);

    const totalKm = drivingTrips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalDrivingKwh = drivingTrips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    const avg = safeAvg(totalDrivingKwh, totalKm);
    const range = avg > 0 ? (BATTERY_KWH / avg) * 100 : 0;
    const lastOdo = trips.length ? trips[trips.length - 1].kmEnd : 0;
    const costPer100 = totalKm > 0 ? (totalCost / totalKm) * 100 : 0;

    odoNowEl.textContent = trips.length ? `${formatNumber(lastOdo, 1)} km` : "—";
    globalAvgEl.textContent = totalKm > 0 ? formatAvg(avg) : "—";
    realRangeEl.textContent = totalKm > 0 ? `${Math.round(range)} km` : "—";
    costPer100El.textContent = totalKm > 0 ? formatEuro(costPer100) : "—";
    totalKmEl.textContent = totalKm > 0 ? formatKm(totalKm) : "—";
  }

  function renderSummary() {
    const drivingTrips = getDrivingTrips(trips);

    const totalKwh = trips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    totalKwhEl.textContent = trips.length ? formatKwh(totalKwh) : "—";
    totalCostEl.textContent = trips.length ? formatEuro(totalCost) : "—";
    if (tripCountEl) tripCountEl.textContent = String(trips.length);

    const byType = {
      Ciudad: trips.filter(t => t.tripType === "Ciudad"),
      Mixto: trips.filter(t => t.tripType === "Mixto"),
      Autopista: trips.filter(t => t.tripType === "Autopista")
    };

    function typeAvg(arr) {
      const km = arr.reduce((sum, t) => sum + t.kmTrip, 0);
      const kwh = arr.reduce((sum, t) => sum + t.kwhUsed, 0);
      return km > 0 ? formatAvg(safeAvg(kwh, km)) : "—";
    }

    avgCityEl.textContent = typeAvg(byType.Ciudad);
    avgMixedEl.textContent = typeAvg(byType.Mixto);
    avgHighwayEl.textContent = typeAvg(byType.Autopista);

    const stints = buildStints(trips);
    if (!stints.length) {
      lastStintSummaryEl.innerHTML = "Aún no hay datos suficientes.";
      return;
    }

    const last = summarizeStint(stints[stints.length - 1]);
    lastStintSummaryEl.innerHTML = `
      <div class="stats-list">
        <div class="stat-row"><span>Rango batería</span><strong>${last.socStart}% → ${last.socEnd}%</strong></div>
        <div class="stat-row"><span>Trayectos</span><strong>${last.count}</strong></div>
        <div class="stat-row"><span>Km totales</span><strong>${formatKm(last.totalKm)}</strong></div>
        <div class="stat-row"><span>Energía</span><strong>${formatKwh(last.totalKwh)}</strong></div>
        <div class="stat-row"><span>Consumo medio</span><strong>${last.avg > 0 ? formatAvg(last.avg) : "—"}</strong></div>
        <div class="stat-row"><span>Coste total</span><strong>${formatEuro(last.totalCost)}</strong></div>
      </div>
    `;
  }

  function passesFilters(trip) {
    const typeFilter = filterTypeEl.value;
    const extrasFilter = filterExtrasEl.value;

    let typeOk = typeFilter === "Todos" || trip.tripType === typeFilter;
    let extrasOk = true;

    if (extrasFilter === "Clima") extrasOk = trip.climate === "Sí";
    if (extrasFilter === "Asientos") extrasOk = trip.seatsHeat === "Sí";
    if (extrasFilter === "Ambos") extrasOk = trip.climate === "Sí" && trip.seatsHeat === "Sí";

    return typeOk && extrasOk;
  }

  function renderHistory() {
    historyListEl.innerHTML = "";

    const filtered = trips.filter(passesFilters);
    const stints = buildStints(filtered);

    if (!stints.length) {
      historyListEl.innerHTML = `<div class="panel-card">No hay trayectos para mostrar.</div>`;
      return;
    }

    stints.reverse().forEach((stint, idx) => {
      const summary = summarizeStint(stint);
      const card = document.createElement("article");
      card.className = "stint-card panel-card";

      const detailsId = `stint-details-${idx}`;

      const detailRows = summary.trips.map(trip => {
        const climaIcon = trip.climate === "Sí" ? "❄️" : "—";
        const asientosIcon = trip.seatsHeat === "Sí" ? "🔥" : "—";

        let typeClass = "type-highway";
        if (trip.tripType === "Ciudad") typeClass = "type-city";
        if (trip.tripType === "Mixto") typeClass = "type-mixed";
        if (trip.tripType === GHOST_TYPE) typeClass = "type-ghost";

        return `
                return `
        <div class="trip-detail-row">
          <div class="trip-detail-line1">
            <div class="trip-detail-line1-left">
              <span class="trip-detail-date">${trip.date}</span>
              <span class="type-chip ${typeClass}">${trip.tripType}</span>
              <span class="trip-detail-soc">🔋 ${trip.socStart}% → ${trip.socEnd}%</span>
            </div>
            <button class="ghost trip-edit-btn" data-trip-id="${trip.id}" aria-label="Editar trayecto" title="Editar trayecto">✏️</button>
          </div>
          <div class="trip-detail-line2">
            <span>${formatKm(trip.kmTrip)}</span>
            <span>${Number.isFinite(trip.avg) ? formatAvg(trip.avg) : "—"}<small>${Number.isFinite(trip.avg) ? "/100km" : ""}</small></span>
            <span>${climaIcon} <small>clima</small></span>
            <span>${asientosIcon} <small>asientos</small></span>
            <span>${formatEuro(trip.cost)}</span>
          </div>
          ${trip.notes ? `<div class="trip-detail-notes">${trip.notes}</div>` : ""}
        </div>
      `;
      }).join("");

      card.innerHTML = `
        <div class="stint-summary">
          <div class="stint-main">
            <div class="stint-title">🔋 ${summary.socStart}% → ${summary.socEnd}%</div>
            <div class="stint-sub">
              ${formatKm(summary.totalKm)} · ${summary.avg > 0 ? formatAvg(summary.avg) : "—"} · ${formatEuro(summary.totalCost)}
            </div>
            <div class="stint-meta">${summary.count} trayectos</div>
          </div>
          <button class="ghost toggle-details" data-target="${detailsId}">Ver detalle</button>
        </div>
        <div id="${detailsId}" class="stint-details hidden">
          ${detailRows}
        </div>
      `;

      historyListEl.appendChild(card);
    });

    historyListEl.querySelectorAll(".toggle-details").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;

        const isHidden = target.classList.contains("hidden");
        target.classList.toggle("hidden");
        btn.textContent = isHidden ? "Ocultar detalle" : "Ver detalle";
      });
    });
        historyListEl.querySelectorAll(".trip-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const trip = trips.find(t => String(t.id) === String(btn.dataset.tripId));
        if (!trip) return;
        fillFormForEdit(trip);
        openModal();
      });
    });
  }

  function getFilteredTripsForChart() {
    return getDrivingTrips(trips.filter(passesFilters));
  }

  function updateChartStats(values) {
    if (!chartAvgEl && !chartMinEl && !chartMaxEl) return;

    if (!values.length) {
      if (chartAvgEl) chartAvgEl.textContent = "—";
      if (chartMinEl) chartMinEl.textContent = "—";
      if (chartMaxEl) chartMaxEl.textContent = "—";
      return;
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (chartAvgEl) chartAvgEl.textContent = `${formatNumber(avg, 1)} kWh/100 km`;
    if (chartMinEl) chartMinEl.textContent = `${formatNumber(min, 1)} kWh/100 km`;
    if (chartMaxEl) chartMaxEl.textContent = `${formatNumber(max, 1)} kWh/100 km`;
  }

  function renderChart() {
    if (!chartCanvas) return;

    const filteredTrips = getFilteredTripsForChart();
    const dataValues = filteredTrips
      .map(t => Number(t.avg))
      .filter(v => Number.isFinite(v) && v > 0);

    updateChartStats(dataValues);

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (!dataValues.length) {
      const ctx = chartCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
      return;
    }

    const labels = filteredTrips.map((trip, index) => {
      const date = trip.date || "";
      return date || `${index + 1}`;
    });

    const pointColors = dataValues.map(v => {
      if (v < 14) return "#39d353";
      if (v < 20) return "#f4c430";
      return "#4e8cff";
    });

    const pointBorderColors = dataValues.map(v => {
      if (v < 14) return "#39d353";
      if (v < 20) return "#f4c430";
      return "#4e8cff";
    });

    const avg = dataValues.reduce((a, b) => a + b, 0) / dataValues.length;
    const ctx = chartCanvas.getContext("2d");

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "kWh/100 km",
            data: dataValues,
            borderColor: "#ffd43b",
            backgroundColor: "rgba(255, 212, 59, 0.10)",
            tension: 0.35,
            fill: true,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: `Media: ${formatNumber(avg, 1)} kWh`,
            data: Array(dataValues.length).fill(avg),
            borderColor: "#ff6b8a",
            borderDash: [6, 6],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false
        },
        plugins: {
          legend: {
            labels: {
              color: "#b8c2d9",
              boxWidth: 18,
              boxHeight: 10,
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: "rgba(12,18,30,0.95)",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            titleColor: "#eef4ff",
            bodyColor: "#d8e1f5",
            callbacks: {
              title(items) {
                const idx = items[0]?.dataIndex ?? 0;
                const trip = filteredTrips[idx];
                return trip?.date ? `Trayecto ${idx + 1} · ${trip.date}` : `Trayecto ${idx + 1}`;
              },
              label(context) {
                return `Consumo: ${formatNumber(context.raw, 1)} kWh/100 km`;
              },
              afterBody(items) {
                const idx = items[0]?.dataIndex ?? 0;
                const trip = filteredTrips[idx];
                if (!trip) return [];

                return [
                  `Tipo: ${trip.tripType}`,
                  `Distancia: ${formatNumber(trip.kmTrip, 1)} km`,
                  `Coste: ${formatNumber(trip.cost, 2)} €`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#7f8ca8",
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              color: "rgba(255,255,255,0.03)"
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#7f8ca8",
              callback(value) {
                return value;
              }
            },
            grid: {
              color: "rgba(255,255,255,0.05)"
            }
          }
        }
      }
    });
  }

  function renderAll() {
    renderHero();
    renderSummary();
    renderHistory();
    renderChart();
  }

  openTripModalBtn.addEventListener("click", () => {
    clearForm();
    openModal();
  });

  closeTripModalBtn.addEventListener("click", closeModal);
  closeTripModalBackdrop.addEventListener("click", closeModal);

  toggleAdvancedBtn.addEventListener("click", () => {
    const expanded = toggleAdvancedBtn.getAttribute("aria-expanded") === "true";
    advancedFields.classList.toggle("hidden");
    toggleAdvancedBtn.setAttribute("aria-expanded", String(!expanded));
    toggleAdvancedBtn.textContent = expanded
      ? "Mostrar opciones avanzadas"
      : "Ocultar opciones avanzadas";
  });

  [kmStartEl, kmEndEl, socStartEl, socEndEl, priceEl].forEach(el => {
    el.addEventListener("input", updateComputedCards);
  });

  tripTypeEl.addEventListener("change", syncGhostTripUi);
  kmStartEl.addEventListener("input", () => {
    if (tripTypeEl.value === GHOST_TYPE && kmStartEl.value) {
      kmEndEl.value = kmStartEl.value;
    }
    updateComputedCards();
  });

  externalChargeEl.addEventListener("change", () => {
    priceEl.value = externalChargeEl.checked
      ? String(DEFAULT_EXTERNAL_PRICE)
      : String(DEFAULT_HOME_PRICE);
    updateComputedCards();
  });

  saveTripBtn.addEventListener("click", async () => {
    const { kmStart, kmEnd, socStart, socEnd, socUsed, kmTrip, kwhUsed, avg, price, cost, isGhost } = getComputedFromForm();

    if (!dateEl.value) {
      alert("Introduce una fecha.");
      return;
    }
    if (!Number.isFinite(kmStart)) {
      alert("Introduce el km inicio.");
      return;
    }
    if (!isGhost && kmEnd <= kmStart) {
      alert("El km fin debe ser mayor que el km inicio.");
      return;
    }
    if (socStart <= socEnd) {
      alert("La batería inicial debe ser mayor que la final.");
      return;
    }

    const trip = {
      date: toDbDate(dateEl.value),
      tripType: tripTypeEl.value,
      kmStart,
      kmEnd,
      kmTrip,
      socStart,
      socEnd,
      socUsed,
      kwhUsed,
      avg,
      external: externalChargeEl.checked,
      price,
      cost,
      climate: climateEl.value,
      seatsHeat: seatsHeatEl.value,
      notes: notesEl.value.trim(),
      created_at: Date.now()
    };

    try {
      if (editingTripId) {
        await updateTripInSupabase(editingTripId, trip);
      } else {
        await insertTripToSupabase(trip);
      }

      trips = await fetchTripsFromSupabase();
      closeModal();
      clearForm();
      renderAll();
      showMsg(editingTripId ? "Trayecto actualizado." : "Trayecto guardado en Supabase.");
    } catch (err) {
      console.error(err);
      alert(editingTripId
        ? "No se pudo actualizar el trayecto en Supabase."
        : "No se pudo guardar el trayecto en Supabase.");
    }
  });

  toggleFiltersBtn.addEventListener("click", () => {
    filtersPanel.classList.toggle("hidden");
  });

  [filterTypeEl, filterExtrasEl].forEach(el => {
    el.addEventListener("change", renderAll);
  });

  exportCSVBtn.addEventListener("click", () => {
    if (!trips.length) {
      alert("No hay trayectos para exportar.");
      return;
    }

    const headers = [
      "date","tripType","kmStart","kmEnd","kmTrip","socStart","socEnd","socUsed",
      "kwhUsed","avg","price","cost","climate","seatsHeat","notes","created_at"
    ];

    const rows = trips.map(t =>
      headers.map(h => `"${String(t[h] ?? "").replaceAll('"', '""')}"`).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "trips.csv";
    a.click();

    URL.revokeObjectURL(url);
  });

  importCSVBtn.addEventListener("click", () => {
    csvFileEl.click();
  });

  csvFileEl.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
      alert("CSV vacío o inválido.");
      return;
    }

    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, ""));
    const imported = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const row = {};

      headers.forEach((header, idx) => {
        row[header] = (values[idx] || "").replace(/^"|"$/g, "").replace(/""/g, '"');
      });

      imported.push({
        date: row.date,
        tripType: row.tripType,
        kmStart: Number(row.kmStart),
        kmEnd: Number(row.kmEnd),
        kmTrip: Number(row.kmTrip),
        socStart: Number(row.socStart),
        socEnd: Number(row.socEnd),
        socUsed: Number(row.socUsed),
        kwhUsed: Number(row.kwhUsed),
        avg: Number(row.avg),
        external: row.external === "true",
        price: Number(row.price),
        cost: Number(row.cost),
        climate: row.climate || "No",
        seatsHeat: row.seatsHeat || "No",
        notes: row.notes || "",
        created_at: Number(row.created_at || Date.now() + i)
      });
    }

    try {
      if (replaceOnImportEl.checked) {
        await deleteAllTripsFromSupabase();
        await importTripsToSupabase(imported);
      } else {
        const existingKeys = new Set(
          trips.map(t => `${t.date}|${t.kmStart}|${t.kmEnd}|${t.socStart}|${t.socEnd}|${t.tripType}`)
        );

        const uniqueToInsert = imported.filter(t => {
          const key = `${t.date}|${t.kmStart}|${t.kmEnd}|${t.socStart}|${t.socEnd}|${t.tripType}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        await importTripsToSupabase(uniqueToInsert);
      }

      trips = await fetchTripsFromSupabase();
      renderAll();
      showMsg("Importación completada.");
    } catch (err) {
      console.error(err);
      alert("Error importando CSV a Supabase.");
    } finally {
      csvFileEl.value = "";
    }
  });

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });

      panels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.add("active");

      if (btn.dataset.tab === "chart") {
        setTimeout(() => {
          renderChart();
        }, 80);
      }
    });
  });

  async function init() {
    clearForm();

    try {
      trips = await fetchTripsFromSupabase();
      renderAll();
      showMsg(`Cargados ${trips.length} trayectos desde Supabase.`);
    } catch (err) {
      console.error(err);
      showMsg("No se pudieron cargar los datos de Supabase.");
    }
  }

  init();
});
