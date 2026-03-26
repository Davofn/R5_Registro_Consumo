let trips = [];

const modal = document.getElementById("modal");

document.getElementById("openModal").onclick = () => {
  modal.classList.remove("hidden");
};

document.getElementById("closeModal").onclick = () => {
  modal.classList.add("hidden");
};

document.getElementById("toggleAdvanced").onclick = () => {
  document.getElementById("advanced").classList.toggle("hidden");
};

document.getElementById("save").onclick = () => {

  const kmStart = +document.getElementById("kmStart").value;
  const kmEnd = +document.getElementById("kmEnd").value;
  const socStart = +document.getElementById("socStart").value;
  const socEnd = +document.getElementById("socEnd").value;

  const km = kmEnd - kmStart;
  const kwh = ((socStart - socEnd) / 100) * 52;
  const avg = (kwh / km) * 100;

  trips.push({ km, kwh, avg, socStart, socEnd });

  modal.classList.add("hidden");

  render();
};

function render() {

  const history = document.getElementById("history");
  history.innerHTML = "";

  trips.forEach((t, i) => {

    const div = document.createElement("div");
    div.className = "card-trip";

    div.innerHTML = `
      <div class="trip-main">
        🔋 ${t.socStart}% → ${t.socEnd}%
      </div>
      <div class="trip-sub">
        ${t.km.toFixed(1)} km · ${t.avg.toFixed(1)} kWh/100
      </div>
      <div class="trip-details">
        Energía: ${t.kwh.toFixed(2)} kWh
      </div>
    `;

    div.onclick = () => {
      const details = div.querySelector(".trip-details");
      details.style.display =
        details.style.display === "block" ? "none" : "block";
    };

    history.appendChild(div);
  });

  updateStats();
}

function updateStats() {
  if (trips.length === 0) return;

  let totalKm = 0;
  let totalKwh = 0;

  trips.forEach(t => {
    totalKm += t.km;
    totalKwh += t.kwh;
  });

  const avg = (totalKwh / totalKm) * 100;
  const range = (52 / avg) * 100;

  document.getElementById("avg").innerText = avg.toFixed(1);
  document.getElementById("range").innerText = Math.round(range);
  document.getElementById("cost100").innerText = (avg * 0.2).toFixed(2);
  document.getElementById("odometer").innerText = totalKm.toFixed(0) + " km";
}

/* TABS */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});
