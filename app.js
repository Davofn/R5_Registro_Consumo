import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://fzsioxqmpjmunaszrjdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_lPgxna3-91FskASGGI854g_RZndEz2S";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  let trips = [];
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

  // COSTS
  const costsTotalCostEl = document.getElementById("costsTotalCost");
  const costsTotalKwhEl = document.getElementById("costsTotalKwh");
  const costsPer100El = document.getElementById("costsPer100");
  const costsAvgPriceEl = document.getElementById("costsAvgPrice");
  const homeKwhEl = document.getElementById("homeKwh");
  const homeCostEl = document.getElementById("homeCost");
  const homeAvgPriceEl = document.getElementById("homeAvgPrice");
  const homeEnergyPctEl = document.getElementById("homeEnergyPct");
  const awayKwhEl = document.getElementById("awayKwh");
  const awayCostEl = document.getElementById("awayCost");
  const awayAvgPriceEl = document.getElementById("awayAvgPrice");
  const awayEnergyPctEl = document.getElementById("awayEnergyPct");
  const homeSessionsEl = document.getElementById("homeSessions");
  const homeAvgDaysEl = document.getElementById("homeAvgDays");
  const awaySessionsEl = document.getElementById("awaySessions");
  const awayAvgDaysEl = document.getElementById("awayAvgDays");
  const monthlyCostsEl = document.getElementById("monthlyCosts");

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

  // MSG
  const msgEl = document.getElementById("msg");

  // INSIGHTS
  const monthlyInsightsEl = document.getElementById("monthlyInsights");
  const typeInsightsEl = document.getElementById("typeInsights");

  // TABS
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");

  const required = [
    tripModal, openTripModalBtn, closeTripModalBtn, closeTripModalBackdrop,
    toggleAdvancedBtn, advancedFields, saveTripBtn,
    historyListEl, monthlyInsightsEl, typeInsightsEl, monthlyCostsEl
  ];

  if (required.some(el => !el)) {
    console.error("Faltan elementos del DOM. Revisa IDs del HTML.");
    return;
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

  function formatAvgCompact(value) {
    return `${formatNumber(value, 1)} kWh`;
  }

  function formatEuro(value) {
    return `${formatNumber(value, 2)} €`;
  }

  function formatPricePerKwh(value) {
    return Number.isFinite(value) && value > 0 ? `${formatNumber(value, 3)} €/kWh` : "—";
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? `${formatNumber(value, 0)}%` : "—";
  }

  function formatDays(value) {
    return Number.isFinite(value) ? `${formatNumber(value, 1)} días` : "—";
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

  function getYearFromDate(dateStr) {
    const [, , y] = dateStr.split("/");
    return Number(y);
  }

  function getMonthKeyFromDate(dateStr) {
    const [, m, y] = dateStr.split("/");
    return `${y}-${m}`;
  }

  function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-");
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return `${monthNames[Number(month) - 1]} ${year}`;
  }

  function getCurrentAppYear() {
    if (!trips.length) return new Date().getFullYear();

    const years = trips
      .filter(t => t.date)
      .map(t => getYearFromDate(t.date))
      .filter(Number.isFinite);

    return years.length ? Math.max(...years) : new Date().getFullYear();
  }

  function sortTrips(a, b) {
    const da = sortDateValue(a.date);
    const db = sortDateValue(b.date);
    if (da !== db) return da - db;

    if (a.socStart !== b.socStart) return b.socStart - a.socStart;

    return a.created_at - b.created_at;
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
      avg: Number.isFinite(entry.avg) ? entry.avg : 0,
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
      .sort(sortTrips);
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

  async function deleteTripFromSupabase(id) {
    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error borrando trip en Supabase:", error);
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
      const last = [...trips].sort(sortTrips)[trips.length - 1];
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

    const sorted = [...filteredTrips].sort(sortTrips);
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

    const startDate = stint[0].date;
    const endDate = stint[stint.length - 1].date;

    return {
      count: stint.length,
      totalKm,
      totalKwh,
      totalCost,
      socStart,
      socEnd,
      socUsed,
      avg,
      startDate,
      endDate,
      trips: stint
    };
  }

  function getComparableTrips() {
    return trips.filter(t => String(t.id) !== String(editingTripId)).sort(sortTrips);
  }

  function getCandidateCreatedAt() {
    if (!editingTripId) return Date.now();
    const current = trips.find(t => String(t.id) === String(editingTripId));
    return current?.created_at ?? Date.now();
  }

  function findPreviousTripForCandidate(candidate) {
    const comparable = getComparableTrips();
    const combined = [...comparable, candidate].sort(sortTrips);
    const idx = combined.findIndex(t => String(t.id) === "__candidate__");
    if (idx <= 0) return null;
    return combined[idx - 1];
  }

  function analyzeTripConsistency(candidate) {
    const warnings = [];
    const prev = findPreviousTripForCandidate(candidate);

    if (candidate.tripType === GHOST_TYPE && candidate.kmStart !== candidate.kmEnd) {
      warnings.push("Consumo fantasma debería tener Km inicio y Km fin iguales.");
    }

    if (!candidate.tripType || !Number.isFinite(candidate.kmStart) || !Number.isFinite(candidate.kmEnd)) {
      return warnings;
    }

    if (prev) {
      if (Math.abs(candidate.kmStart - prev.kmEnd) > 0.05) {
        warnings.push(
          `El Km inicio (${formatNumber(candidate.kmStart, 1)}) no coincide con el odómetro anterior (${formatNumber(prev.kmEnd, 1)}).`
        );
      }

      if (candidate.socStart < prev.socEnd) {
        warnings.push(
          `La batería inicial (${candidate.socStart}%) es menor que la final del trayecto anterior (${prev.socEnd}%). Puede faltar un consumo fantasma o haber un dato incorrecto.`
        );
      } else if (candidate.socStart > prev.socEnd) {
        warnings.push(
          `La batería inicial (${candidate.socStart}%) es mayor que la final del trayecto anterior (${prev.socEnd}%). Parece que hubo una recarga entre ambos trayectos.`
        );
      }
    }

    if (candidate.tripType !== GHOST_TYPE && Number.isFinite(candidate.avg)) {
      if (candidate.avg > 35) {
        warnings.push(`Consumo muy alto (${formatNumber(candidate.avg, 1)} kWh/100 km). Revisa si el trayecto o los porcentajes son correctos.`);
      }
      if (candidate.avg > 0 && candidate.avg < 5) {
        warnings.push(`Consumo muy bajo (${formatNumber(candidate.avg, 1)} kWh/100 km). Puede haber algún dato mal introducido.`);
      }
    }

    if (candidate.tripType === GHOST_TYPE && candidate.socUsed > 15) {
      warnings.push(`Consumo fantasma alto (${candidate.socUsed}%). Comprueba que los porcentajes sean correctos.`);
    }

    return warnings;
  }

  function getInferredChargeEvents(arr = trips) {
    const sorted = [...arr].sort(sortTrips);
    const events = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (curr.socStart > prev.socEnd) {
        events.push({
          date: curr.date,
          external: !!curr.external,
          socFrom: prev.socEnd,
          socTo: curr.socStart,
          socGained: curr.socStart - prev.socEnd,
          linkedTripId: curr.id
        });
      }
    }

    return events;
  }

  function getDateDiffDays(dateA, dateB) {
    const ms = Math.abs(sortDateValue(dateB) - sortDateValue(dateA));
    return ms / (1000 * 60 * 60 * 24);
  }

  function getAverageGapDays(arr) {
    if (arr.length < 2) return NaN;
    const sorted = [...arr].sort((a, b) => sortDateValue(a.date) - sortDateValue(b.date));
    let totalDays = 0;

    for (let i = 1; i < sorted.length; i++) {
      totalDays += getDateDiffDays(sorted[i - 1].date, sorted[i].date);
    }

    return totalDays / (sorted.length - 1);
  }

  function renderHero() {
    const drivingTrips = getDrivingTrips(trips);

    const totalKm = drivingTrips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalDrivingKwh = drivingTrips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    const avg = safeAvg(totalDrivingKwh, totalKm);
    const range = avg > 0 ? (BATTERY_KWH / avg) * 100 : 0;
    const lastOdo = trips.length ? [...trips].sort(sortTrips)[trips.length - 1].kmEnd : 0;
    const costPer100 = totalKm > 0 ? (totalCost / totalKm) * 100 : 0;

    odoNowEl.textContent = trips.length ? `${formatNumber(lastOdo, 1)} km` : "—";
    globalAvgEl.textContent = totalKm > 0 ? formatAvgCompact(avg) : "—";
    realRangeEl.textContent = totalKm > 0 ? `${Math.round(range)} km` : "—";
    costPer100El.textContent = totalKm > 0 ? formatEuro(costPer100) : "—";
    totalKmEl.textContent = totalKm > 0 ? formatKm(totalKm) : "—";
  }

  function renderSummary() {
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

  function renderStintCard(stint, idx, isCurrent = false) {
    const summary = summarizeStint(stint);
    const card = document.createElement("article");
    card.className = "stint-card panel-card";

    const detailsId = `stint-details-${isCurrent ? "current" : idx}`;

    const detailRows = summary.trips.map(trip => {
      const climaIcon = trip.climate === "Sí" ? "❄️" : "—";
      const asientosIcon = trip.seatsHeat === "Sí" ? "🔥" : "—";

      let typeClass = "type-highway";
      if (trip.tripType === "Ciudad") typeClass = "type-city";
      if (trip.tripType === "Mixto") typeClass = "type-mixed";
      if (trip.tripType === GHOST_TYPE) typeClass = "type-ghost";

      return `
  <div class="trip-detail-row">
    <div class="trip-detail-line1">
      <div class="trip-detail-line1-left">
        <span class="trip-detail-date">${trip.date}</span>
        <span class="type-chip ${typeClass}">${trip.tripType}</span>
        <span class="trip-detail-soc">🔋 ${trip.socStart}% → ${trip.socEnd}%</span>
      </div>

      <div class="trip-detail-actions">
        <button
          class="ghost trip-edit-btn"
          data-trip-id="${trip.id}"
          aria-label="Editar trayecto"
          title="Editar trayecto"
        >✏️</button>

        <button
          class="ghost trip-delete-btn"
          data-trip-id="${trip.id}"
          aria-label="Eliminar trayecto"
          title="Eliminar trayecto"
        >🗑️</button>
      </div>
    </div>
    <div class="trip-detail-line2">
      <span>${formatKm(trip.kmTrip)}</span>
      <span>${Number.isFinite(trip.avg) && trip.avg > 0 ? formatAvg(trip.avg) : "—"}<small>${Number.isFinite(trip.avg) && trip.avg > 0 ? "/100km" : ""}</small></span>
      <span>${climaIcon} <small>clima</small></span>
      <span>${asientosIcon} <small>asientos</small></span>
      <span>${formatEuro(trip.cost)}</span>
    </div>
    ${trip.notes ? `<div class="trip-detail-notes">${trip.notes}</div>` : ""}
  </div>
`;
    }).join("");

    const dateRange = summary.startDate === summary.endDate
      ? summary.startDate
      : `${summary.startDate} - ${summary.endDate}`;

    card.innerHTML = `
      <div class="stint-summary">
        <div class="stint-main">
          <div class="stint-title">${isCurrent ? `<span class="current-stint-badge">Actual</span>` : ""}${summary.socStart}% → ${summary.socEnd}%</div>
          <div class="stint-sub">
            ${formatKm(summary.totalKm)} · ${summary.avg > 0 ? formatAvg(summary.avg) : "—"} · ${formatEuro(summary.totalCost)}
          </div>
          <div class="stint-meta">${summary.count} trayectos · ${dateRange}</div>
        </div>
        <button class="ghost toggle-details" data-target="${detailsId}">Ver detalle</button>
      </div>
      <div id="${detailsId}" class="stint-details hidden">
        ${detailRows}
      </div>
    `;

    return card;
  }

  function wireHistoryActionButtons() {
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

    historyListEl.querySelectorAll(".trip-delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const trip = trips.find(t => String(t.id) === String(btn.dataset.tripId));
        if (!trip) return;

        const ok = confirm(
          `¿Seguro que quieres eliminar este trayecto?\n\n` +
          `${trip.date} · ${trip.tripType} · ${trip.socStart}% → ${trip.socEnd}%`
        );

        if (!ok) return;

        try {
          await deleteTripFromSupabase(trip.id);
          trips = await fetchTripsFromSupabase();
          renderAll();
          showMsg("Trayecto eliminado.");
        } catch (err) {
          console.error(err);
          alert("No se pudo eliminar el trayecto en Supabase.");
        }
      });
    });
  }

  function renderHistory() {
    historyListEl.innerHTML = "";

    const filtered = trips.filter(passesFilters);
    const stints = buildStints(filtered);

    if (!stints.length) {
      historyListEl.innerHTML = `<div class="panel-card">No hay trayectos para mostrar.</div>`;
      return;
    }

    const currentStint = stints[stints.length - 1];
    const closedStints = stints.slice(0, -1).reverse();

    if (currentStint?.length) {
      const currentCard = renderStintCard(currentStint, "current", true);
      historyListEl.appendChild(currentCard);
    }

    closedStints.forEach((stint, idx) => {
      const card = renderStintCard(stint, idx, false);
      historyListEl.appendChild(card);
    });

    wireHistoryActionButtons();
  }

  function getWeightedAvg(arr) {
    const driving = getDrivingTrips(arr);
    const km = driving.reduce((sum, t) => sum + t.kmTrip, 0);
    const kwh = driving.reduce((sum, t) => sum + t.kwhUsed, 0);
    return km > 0 ? safeAvg(kwh, km) : NaN;
  }

  function formatDeltaPercent(base, current) {
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(current)) return "—";
    const delta = ((current - base) / base) * 100;
    if (Math.abs(delta) < 0.05) return "Base";
    return `${delta > 0 ? "+" : ""}${formatNumber(delta, 0)}%`;
  }

  function formatRangeFromAvg(avg) {
    if (!Number.isFinite(avg) || avg <= 0) return "—";
    const range = (BATTERY_KWH / avg) * 100;
    return `${Math.round(range)} km`;
  }

  function renderInsights() {
    const drivingTrips = getDrivingTrips(trips);

    const monthMap = new Map();

    drivingTrips.forEach(trip => {
      if (!trip.date) return;

      const monthKey = getMonthKeyFromDate(trip.date);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          km: 0,
          kwh: 0,
          year: getYearFromDate(trip.date)
        });
      }

      const data = monthMap.get(monthKey);
      data.km += Number(trip.kmTrip) || 0;
      data.kwh += Number(trip.kwhUsed) || 0;
    });

    const monthEntries = Array.from(monthMap.entries())
      .map(([monthKey, data]) => ({
        monthKey,
        year: data.year,
        km: data.km,
        kwh: data.kwh,
        avg: data.km > 0 ? safeAvg(data.kwh, data.km) : NaN
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    const currentYear = getCurrentAppYear();
    const currentYearMonths = monthEntries.filter(m => m.year === currentYear);
    const previousYears = [...new Set(monthEntries.map(m => m.year).filter(y => y < currentYear))].sort((a, b) => b - a);

    function renderMonthRow(month) {
      return `
        <div class="stat-row monthly-detail-row">
          <span>${formatMonthLabel(month.monthKey)}</span>
          <strong>${Number.isFinite(month.avg) ? formatAvg(month.avg) : "—"} · ${formatKm(month.km)}</strong>
        </div>
      `;
    }

    const currentYearHtml = currentYearMonths.map(renderMonthRow).join("");

    const previousYearsHtml = previousYears.map(year => {
      const yearMonths = monthEntries.filter(m => m.year === year);
      const totalKm = yearMonths.reduce((sum, m) => sum + m.km, 0);
      const totalKwh = yearMonths.reduce((sum, m) => sum + m.kwh, 0);
      const avg = totalKm > 0 ? safeAvg(totalKwh, totalKm) : NaN;
      const detailsId = `year-details-${year}`;

      return `
        <div class="year-summary-block">
          <button class="year-summary-toggle" data-target="${detailsId}" type="button">
            <span>Resumen ${year}</span>
            <strong>${Number.isFinite(avg) ? formatAvg(avg) : "—"} · ${formatKm(totalKm)}</strong>
          </button>
          <div id="${detailsId}" class="year-month-details hidden">
            ${yearMonths.map(renderMonthRow).join("")}
          </div>
        </div>
      `;
    }).join("");

    monthlyInsightsEl.innerHTML =
      (currentYearHtml || previousYearsHtml)
        ? `${currentYearHtml}${previousYearsHtml}`
        : `<div class="stat-row"><span>Sin datos</span><strong>—</strong></div>`;

    monthlyInsightsEl.querySelectorAll(".year-summary-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        target.classList.toggle("hidden");
        btn.classList.toggle("open");
      });
    });

    const byType = {
      Ciudad: drivingTrips.filter(t => t.tripType === "Ciudad"),
      Mixto: drivingTrips.filter(t => t.tripType === "Mixto"),
      Autopista: drivingTrips.filter(t => t.tripType === "Autopista")
    };

    const totalDrivingKm = drivingTrips.reduce((sum, t) => sum + t.kmTrip, 0);

    const typeStats = Object.entries(byType).map(([name, arr]) => {
      const km = arr.reduce((sum, t) => sum + t.kmTrip, 0);
      const avg = getWeightedAvg(arr);
      const usagePct = totalDrivingKm > 0 ? (km / totalDrivingKm) * 100 : NaN;
      return { name, km, avg, usagePct };
    });

    const validTypeStats = typeStats.filter(t => Number.isFinite(t.avg) && t.avg > 0);
    const bestAvg = validTypeStats.length ? Math.min(...validTypeStats.map(t => t.avg)) : NaN;

    function renderTypeLine(stat) {
      if (!Number.isFinite(stat.avg) || stat.avg <= 0) {
        return `<div class="stat-row"><span>${stat.name}</span><strong>—</strong></div>`;
      }

      const usageText = Number.isFinite(stat.usagePct) ? `${formatNumber(stat.usagePct, 0)}% uso` : "—";
      const penaltyText = formatDeltaPercent(bestAvg, stat.avg);
      const rangeText = formatRangeFromAvg(stat.avg);

      return `
        <div class="stat-row">
          <span>${stat.name}</span>
          <strong>${usageText} · ${penaltyText} · ${rangeText}</strong>
        </div>
      `;
    }

    typeInsightsEl.innerHTML = `
      ${renderTypeLine(typeStats.find(t => t.name === "Ciudad"))}
      ${renderTypeLine(typeStats.find(t => t.name === "Mixto"))}
      ${renderTypeLine(typeStats.find(t => t.name === "Autopista"))}
    `;
    const chargeEvents = getInferredChargeEvents(trips);
const homeChargeEvents = chargeEvents.filter(e => !e.external);
const awayChargeEvents = chargeEvents.filter(e => e.external);

if (homeSessionsEl) homeSessionsEl.textContent = String(homeChargeEvents.length);
if (awaySessionsEl) awaySessionsEl.textContent = String(awayChargeEvents.length);
if (homeAvgDaysEl) homeAvgDaysEl.textContent = formatDays(getAverageGapDays(homeChargeEvents));
if (awayAvgDaysEl) awayAvgDaysEl.textContent = formatDays(getAverageGapDays(awayChargeEvents));
  }

  function renderCosts() {
    const drivingTrips = getDrivingTrips(trips);
    const totalKm = drivingTrips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalKwh = trips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    const costPer100 = totalKm > 0 ? (totalCost / totalKm) * 100 : NaN;
    const avgPrice = totalKwh > 0 ? totalCost / totalKwh : NaN;

    if (costsTotalCostEl) costsTotalCostEl.textContent = totalCost > 0 ? formatEuro(totalCost) : "—";
    if (costsTotalKwhEl) costsTotalKwhEl.textContent = totalKwh > 0 ? formatKwh(totalKwh) : "—";
    if (costsPer100El) costsPer100El.textContent = Number.isFinite(costPer100) ? formatEuro(costPer100) : "—";
    if (costsAvgPriceEl) costsAvgPriceEl.textContent = formatPricePerKwh(avgPrice);

    const homeTrips = trips.filter(t => !t.external);
    const awayTrips = trips.filter(t => !!t.external);

    const homeKwh = homeTrips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const homeCost = homeTrips.reduce((sum, t) => sum + t.cost, 0);
    const awayKwh = awayTrips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const awayCost = awayTrips.reduce((sum, t) => sum + t.cost, 0);

    const homeAvgPrice = homeKwh > 0 ? homeCost / homeKwh : NaN;
    const awayAvgPrice = awayKwh > 0 ? awayCost / awayKwh : NaN;

    const homeEnergyPct = totalKwh > 0 ? (homeKwh / totalKwh) * 100 : NaN;
    const awayEnergyPct = totalKwh > 0 ? (awayKwh / totalKwh) * 100 : NaN;

    if (homeKwhEl) homeKwhEl.textContent = homeKwh > 0 ? formatKwh(homeKwh) : "—";
    if (homeCostEl) homeCostEl.textContent = homeCost > 0 ? formatEuro(homeCost) : "—";
    if (homeAvgPriceEl) homeAvgPriceEl.textContent = formatPricePerKwh(homeAvgPrice);
    if (homeEnergyPctEl) homeEnergyPctEl.textContent = formatPercent(homeEnergyPct);

    if (awayKwhEl) awayKwhEl.textContent = awayKwh > 0 ? formatKwh(awayKwh) : "—";
    if (awayCostEl) awayCostEl.textContent = awayCost > 0 ? formatEuro(awayCost) : "—";
    if (awayAvgPriceEl) awayAvgPriceEl.textContent = formatPricePerKwh(awayAvgPrice);
    if (awayEnergyPctEl) awayEnergyPctEl.textContent = formatPercent(awayEnergyPct);

    const monthMap = new Map();

    trips.forEach(trip => {
      if (!trip.date) return;
      const monthKey = getMonthKeyFromDate(trip.date);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          year: getYearFromDate(trip.date),
          kwh: 0,
          cost: 0
        });
      }

      const data = monthMap.get(monthKey);
      data.kwh += Number(trip.kwhUsed) || 0;
      data.cost += Number(trip.cost) || 0;
    });

    const monthEntries = Array.from(monthMap.entries())
      .map(([monthKey, data]) => ({
        monthKey,
        year: data.year,
        kwh: data.kwh,
        cost: data.cost
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    const currentYear = getCurrentAppYear();
    const currentYearMonths = monthEntries.filter(m => m.year === currentYear);
    const previousYears = [...new Set(monthEntries.map(m => m.year).filter(y => y < currentYear))].sort((a, b) => b - a);

 function renderCostMonthRow(month) {
  return `
    <div class="stat-row monthly-cost-row">
      <span>${formatMonthLabel(month.monthKey)}</span>
      <strong>${formatKwh(month.kwh)} · ${formatEuro(month.cost)}</strong>
    </div>
  `;
}

    const currentYearHtml = currentYearMonths.map(renderCostMonthRow).join("");

    const previousYearsHtml = previousYears.map(year => {
      const yearMonths = monthEntries.filter(m => m.year === year);
      const totalYearKwh = yearMonths.reduce((sum, m) => sum + m.kwh, 0);
      const totalYearCost = yearMonths.reduce((sum, m) => sum + m.cost, 0);
      const detailsId = `cost-year-details-${year}`;

      return `
        <div class="year-summary-block">
          <button class="year-summary-toggle" data-target="${detailsId}" type="button">
            <span>Resumen ${year}</span>
            <strong>${formatKwh(totalYearKwh)} · ${formatEuro(totalYearCost)}</strong>
          </button>
          <div id="${detailsId}" class="year-month-details hidden">
            ${yearMonths.map(renderCostMonthRow).join("")}
          </div>
        </div>
      `;
    }).join("");

    if (monthlyCostsEl) {
      monthlyCostsEl.innerHTML =
        (currentYearHtml || previousYearsHtml)
          ? `${currentYearHtml}${previousYearsHtml}`
          : `<div class="stat-row"><span>Sin datos</span><strong>—</strong></div>`;

      monthlyCostsEl.querySelectorAll(".year-summary-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = document.getElementById(btn.dataset.target);
          if (!target) return;
          target.classList.toggle("hidden");
          btn.classList.toggle("open");
        });
      });
    }
  }

  function renderAll() {
    renderHero();
    renderSummary();
    renderHistory();
    renderInsights();
    renderCosts();
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
    if (!isGhost && !Number.isFinite(kmEnd)) {
      alert("Introduce el km fin.");
      return;
    }
    if (!isGhost && kmEnd <= kmStart) {
      alert("El km fin debe ser mayor que el km inicio.");
      return;
    }
    if (isGhost && kmEnd !== kmStart) {
      alert("En Consumo fantasma, Km inicio y Km fin deben ser iguales.");
      return;
    }
    if (socStart <= socEnd) {
      alert("La batería inicial debe ser mayor que la final.");
      return;
    }

    const currentCreatedAt = getCandidateCreatedAt();

    const trip = {
      id: "__candidate__",
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
      created_at: currentCreatedAt
    };

    const warnings = analyzeTripConsistency(trip);

    if (warnings.length) {
      const ok = confirm(
        `Se han detectado posibles incoherencias:\n\n` +
        warnings.map(w => `- ${w}`).join("\n") +
        `\n\n¿Quieres guardar de todos modos?`
      );
      if (!ok) return;
    }

    try {
      const wasEditing = !!editingTripId;
      const rowTrip = { ...trip };
      delete rowTrip.id;

      if (editingTripId) {
        await updateTripInSupabase(editingTripId, rowTrip);
      } else {
        await insertTripToSupabase(rowTrip);
      }

      trips = await fetchTripsFromSupabase();
      closeModal();
      clearForm();
      renderAll();
      showMsg(wasEditing ? "Trayecto actualizado." : "Trayecto guardado en Supabase.");
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
