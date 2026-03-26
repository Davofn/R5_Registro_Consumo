import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://fzsioxqmpjmunaszrjdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_lPgxna3-91FskASGGI854g_RZndEz2S";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
  let trips = [];
  let chartInstance = null;

  const BATTERY_KWH = 52;
  const DEFAULT_HOME_PRICE = 0.1176;
  const DEFAULT_EXTERNAL_PRICE = 0.45;

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
    return `${formatNumber(value, 1)} kWh`;
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
      socUsed: Number(row.soc_used),
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
      avg: entry.avg,
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

  function getComputedFromForm() {
    const kmStart = parseFloat(kmStartEl.value);
    const kmEnd = parseFloat(kmEndEl.value);

    const socStart = clamp(parseFloat(socStartEl.value), 0, 100);
    const socEnd = clamp(parseFloat(socEndEl.value), 0, 100);

    socStartEl.value = socStart;
    socEndEl.value = socEnd;

    const kmTrip = Number.isFinite(kmStart) && Number.isFinite(kmEnd) ? kmEnd - kmStart : NaN;
    const socUsed = socStart - socEnd;
    const kwhUsed = (Number.isFinite(socUsed) ? Math.max(0, socUsed) : NaN) / 100 * BATTERY_KWH;
    const avg = Number.isFinite(kmTrip) && kmTrip > 0 && Number.isFinite(kwhUsed)
      ? (kwhUsed / kmTrip) * 100
      : NaN;

    const price = Math.max(0, parseFloat(priceEl.value));
    const cost = Number.isFinite(kwhUsed) ? kwhUsed * price : NaN;

    return { kmStart, kmEnd, socStart, socEnd, socUsed, kmTrip, kwhUsed, avg, price, cost };
  }

  function updateComputedCards() {
    const { kmTrip, kwhUsed, avg, cost } = getComputedFromForm();

    kmTripEl.textContent = Number.isFinite(kmTrip) && kmTrip > 0 ? formatKm(kmTrip) : "—";
    kwhUsedEl.textContent = Number.isFinite(kwhUsed) ? formatKwh(kwhUsed) : "—";
    avgEl.textContent = Number.isFinite(avg) ? formatAvg(avg) : "—";
    costEl.textContent = Number.isFinite(cost) ? formatEuro(cost) : "—";
  }

  function clearForm() {
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
    const totalKm = stint.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalKwh = stint.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = stint.reduce((sum, t) => sum + t.cost, 0);

    const socStart = stint[0].socStart;
    const socEnd = stint[stint.length - 1].socEnd;
    const socUsed = socStart - socEnd;
    const avg = safeAvg(totalKwh, totalKm);

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
    const totalKm = trips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalKwh = trips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);
    const avg = safeAvg(totalKwh, totalKm);
    const range = avg > 0 ? (BATTERY_KWH / avg) * 100 : 0;
    const lastOdo = trips.length ? trips[trips.length - 1].kmEnd : 0;
    const costPer100 = totalKm > 0 ? (totalCost / totalKm) * 100 : 0;

    odoNowEl.textContent = trips.length ? `${formatNumber(lastOdo, 1)} km` : "—";
    globalAvgEl.textContent = trips.length ? formatAvg(avg) : "—";
    realRangeEl.textContent = trips.length ? `${Math.round(range)} km` : "—";
    costPer100El.textContent = trips.length ? formatEuro(costPer100) : "—";
    totalKmEl.textContent = trips.length ? formatKm(totalKm) : "—";
  }

  function renderSummary() {
    const totalKm = trips.reduce((sum, t) => sum + t.kmTrip, 0);
    const totalKwh = trips.reduce((sum, t) => sum + t.kwhUsed, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    totalKwhEl.textContent = trips.length ? formatKwh(totalKwh) : "—";
    totalCostEl.textContent = trips.length ? formatEuro(totalCost) : "—";
    //tripCountEl.textContent = String(trips.length);

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
        <div class="stat-row"><span>Consumo medio</span><strong>${formatAvg(last.avg)}</strong></div>
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
        const asientosIcon = trip.seatsHeat === "Sí" ? "🪑" : "—";
        const typeClass = trip.tripType === "Ciudad" ? "type-city" : trip.tripType === "Mixto" ? "type-mixed" : "type-highway";
        return `
        <div class="trip-detail-row">
          <div class="trip-detail-line1">
            <span class="trip-detail-date">${trip.date}</span>
            <span class="type-chip ${typeClass}">${trip.tripType}</span>
            <span class="trip-detail-soc">🔋 ${trip.socStart}% → ${trip.socEnd}%</span>
          </div>
          <div class="trip-detail-line2">
            <span><strong>${formatKm(trip.kmTrip)}</strong></span>
            <span><strong>${formatAvg(trip.avg)}</strong><small>/100km</small></span>
            <span>${climaIcon} <small>clima</small></span>
            <span>${asientosIcon} <small>asientos</small></span>
            <span><strong>${formatEuro(trip.cost)}</strong></span>
          </div>
          ${trip.notes ? `<div class="trip-detail-notes">${trip.notes}</div>` : ""}
        </div>
      `}).join("");

      card.innerHTML = `
        <div class="stint-summary">
          <div class="stint-main">
            <div class="stint-title">🔋 ${summary.socStart}% → ${summary.socEnd}%</div>
            <div class="stint-sub">
              ${formatKm(summary.totalKm)} · ${formatAvg(summary.avg)} · ${formatEuro(summary.totalCost)}
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
  }

  function renderChart() {
    const labels = trips.map((t, i) => `${i + 1}`);
    const data = trips.map(t => Number(t.avg.toFixed(1)));

    const pointColors = trips.map(t => {
      if (t.tripType === "Ciudad") return "#34d399";
      if (t.tripType === "Mixto") return "#60a5fa";
      return "#f59e0b";
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "kWh/100 km",
          data,
          borderColor: "#ffd400",
          backgroundColor: "rgba(255,212,0,0.15)",
          tension: 0.25,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: pointColors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false
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

  externalChargeEl.addEventListener("change", () => {
    priceEl.value = externalChargeEl.checked
      ? String(DEFAULT_EXTERNAL_PRICE)
      : String(DEFAULT_HOME_PRICE);
    updateComputedCards();
  });

  saveTripBtn.addEventListener("click", async () => {
    const { kmStart, kmEnd, socStart, socEnd, socUsed, kmTrip, kwhUsed, avg, price, cost } = getComputedFromForm();

    if (!dateEl.value) {
      alert("Introduce una fecha.");
      return;
    }
    if (kmEnd <= kmStart) {
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
      await insertTripToSupabase(trip);
      trips = await fetchTripsFromSupabase();
      closeModal();
      renderAll();
      showMsg("Trayecto guardado en Supabase.");
    } catch (err) {
      alert("No se pudo guardar el trayecto en Supabase.");
    }
  });

  toggleFiltersBtn.addEventListener("click", () => {
    filtersPanel.classList.toggle("hidden");
  });

  [filterTypeEl, filterExtrasEl].forEach(el => {
    el.addEventListener("change", renderHistory);
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
          trips.map(t => `${t.date}|${t.kmStart}|${t.kmEnd}|${t.socStart}|${t.socEnd}`)
        );

        const uniqueToInsert = imported.filter(t => {
          const key = `${t.date}|${t.kmStart}|${t.kmEnd}|${t.socStart}|${t.socEnd}`;
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
        setTimeout(renderChart, 50);
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
