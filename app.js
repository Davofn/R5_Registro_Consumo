document.addEventListener("DOMContentLoaded", () => {
  let trips = [];

  const modal = document.getElementById("modal");
  const openModalBtn = document.getElementById("openModal");
  const closeModalBtn = document.getElementById("closeModal");
  const toggleAdvancedBtn = document.getElementById("toggleAdvanced");
  const advanced = document.getElementById("advanced");
  const saveBtn = document.getElementById("save");
  const history = document.getElementById("history");

  const avgEl = document.getElementById("avg");
  const rangeEl = document.getElementById("range");
  const cost100El = document.getElementById("cost100");
  const odometerEl = document.getElementById("odometer");

  if (!modal || !openModalBtn || !closeModalBtn || !toggleAdvancedBtn || !advanced || !saveBtn || !history) {
    console.error("Faltan elementos del DOM. Revisa que los IDs del HTML coincidan con el JS.");
    return;
  }

  openModalBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  toggleAdvancedBtn.addEventListener("click", () => {
    advanced.classList.toggle("hidden");
  });

  saveBtn.addEventListener("click", () => {
    const kmStart = Number(document.getElementById("kmStart")?.value || 0);
    const kmEnd = Number(document.getElementById("kmEnd")?.value || 0);
    const socStart = Number(document.getElementById("socStart")?.value || 0);
    const socEnd = Number(document.getElementById("socEnd")?.value || 0);
    const tripType = document.getElementById("tripType")?.value || "Mixto";
    const price = Number(document.getElementById("price")?.value || 0);
    const climate = document.getElementById("climate")?.checked || false;
    const seats = document.getElementById("seats")?.checked || false;
    const notes = document.getElementById("notes")?.value || "";

    if (kmEnd <= kmStart) {
      alert("El km fin debe ser mayor que el km inicio.");
      return;
    }

    if (socStart <= socEnd) {
      alert("La batería inicial debe ser mayor que la final.");
      return;
    }

    const km = kmEnd - kmStart;
    const kwh = ((socStart - socEnd) / 100) * 52;
    const avg = (kwh / km) * 100;
    const cost = kwh * price;

    trips.push({
      km,
      kwh,
      avg,
      socStart,
      socEnd,
      tripType,
      price,
      cost,
      climate,
      seats,
      notes
    });

    modal.classList.add("hidden");
    clearForm();
    render();
  });

  function clearForm() {
    const ids = ["kmStart", "kmEnd", "socStart", "socEnd", "price", "notes"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const climateEl = document.getElementById("climate");
    const seatsEl = document.getElementById("seats");
    const tripTypeEl = document.getElementById("tripType");

    if (climateEl) climateEl.checked = false;
    if (seatsEl) seatsEl.checked = false;
    if (tripTypeEl) tripTypeEl.value = "Ciudad";
  }

  function render() {
    history.innerHTML = "";

    trips.forEach((t) => {
      const div = document.createElement("div");
      div.className = "card-trip";

      div.innerHTML = `
        <div class="trip-main">🔋 ${t.socStart}% → ${t.socEnd}%</div>
        <div class="trip-sub">${t.km.toFixed(1)} km · ${t.avg.toFixed(1)} kWh/100 · ${t.tripType}</div>
        <div class="trip-details">
          <div>Energía: ${t.kwh.toFixed(2)} kWh</div>
          <div>Coste: ${t.cost.toFixed(2)} €</div>
          <div>Precio: ${t.price.toFixed(2)} €/kWh</div>
          <div>Clima: ${t.climate ? "Sí" : "No"}</div>
          <div>Asientos: ${t.seats ? "Sí" : "No"}</div>
          <div>Notas: ${t.notes || "-"}</div>
        </div>
      `;

      div.addEventListener("click", () => {
        const details = div.querySelector(".trip-details");
        if (!details) return;
        details.style.display = details.style.display === "block" ? "none" : "block";
      });

      history.appendChild(div);
    });

    updateStats();
  }

  function updateStats() {
    if (trips.length === 0) {
      if (avgEl) avgEl.textContent = "0";
      if (rangeEl) rangeEl.textContent = "0";
      if (cost100El) cost100El.textContent = "0";
      if (odometerEl) odometerEl.textContent = "0 km";
      return;
    }

    const totalKm = trips.reduce((sum, t) => sum + t.km, 0);
    const totalKwh = trips.reduce((sum, t) => sum + t.kwh, 0);
    const totalCost = trips.reduce((sum, t) => sum + t.cost, 0);

    const avg = (totalKwh / totalKm) * 100;
    const range = avg > 0 ? (52 / avg) * 100 : 0;
    const cost100 = totalKm > 0 ? (totalCost / totalKm) * 100 : 0;

    if (avgEl) avgEl.textContent = avg.toFixed(1);
    if (rangeEl) rangeEl.textContent = Math.round(range);
    if (cost100El) cost100El.textContent = cost100.toFixed(2);
    if (odometerEl) odometerEl.textContent = `${totalKm.toFixed(0)} km`;
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  updateStats();
});
