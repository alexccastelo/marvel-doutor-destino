/**
 * Vingadores: Doutor Destino — Checklist App
 * Tracks watched movies/series with localStorage persistence.
 */

// ===== Data =====
const MOVIES = [
  {
    id: 1,
    title: "X-Men: O Filme",
    year: 2000,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 2,
    title: "X-Men 2",
    year: 2003,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 3,
    title: "Capitão América: O Primeiro Vingador",
    year: 2011,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 4,
    title: "Os Vingadores",
    year: 2012,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 5,
    title: "Vingadores: Guerra Infinita",
    year: 2018,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 6,
    title: "Vingadores: Ultimato",
    year: 2019,
    type: "filme",
    note: "Relançamento especial nos cinemas com novas cenas",
    streaming: [
      { name: "Disney+", class: "disney" },
      { name: "Cinema", class: "cinema" },
    ],
  },
  {
    id: 7,
    title: "Loki",
    year: "2021–2023",
    type: "série",
    note: "Temporadas 1 e 2",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 8,
    title: "Shang-Chi e a Lenda dos Dez Anéis",
    year: 2021,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 9,
    title: "Homem-Aranha: Sem Volta para Casa",
    year: 2021,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 10,
    title: "Doutor Estranho no Multiverso da Loucura",
    year: 2022,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 11,
    title: "Pantera Negra: Wakanda para Sempre",
    year: 2022,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 12,
    title: "Deadpool e Wolverine",
    year: 2024,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 13,
    title: "Capitão América: Admirável Mundo Novo",
    year: 2025,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 14,
    title: "Thunderbolts*",
    year: 2025,
    type: "filme",
    streaming: [{ name: "Disney+", class: "disney" }],
  },
  {
    id: 15,
    title: "Quarteto Fantástico: Primeiros Passos",
    year: 2025,
    type: "filme",
    streaming: [
      { name: "Disney+", class: "disney" },
      { name: "Cinema", class: "cinema" },
    ],
  },
];

const STORAGE_KEY = "marvel-doomsday-checklist";

// ===== State =====
let watchedMap = loadState();

// ===== DOM Elements =====
const movieListEl = document.getElementById("movieList");
const watchedCountEl = document.getElementById("watchedCount");
const totalCountEl = document.getElementById("totalCount");
const progressFillEl = document.getElementById("progressFill");
const progressBar = progressFillEl.closest('[role="progressbar"]');
const remainingStatEl = document.getElementById("remainingStat");
const percentStatEl = document.getElementById("percentStat");
const completedBannerEl = document.getElementById("completedBanner");
const resetBtn = document.getElementById("resetBtn");

// ===== Init =====
totalCountEl.textContent = MOVIES.length;
renderMovies();
updateProgress();

resetBtn.addEventListener("click", handleReset);

// ===== Functions =====

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(watchedMap));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function renderMovies() {
  movieListEl.innerHTML = "";

  MOVIES.forEach((movie, index) => {
    const isWatched = !!watchedMap[movie.id];
    const watchedDate = watchedMap[movie.id] || null;

    const card = document.createElement("article");
    card.className = `movie-card${isWatched ? " watched" : ""}`;
    card.style.animationDelay = `${index * 0.05}s`;
    card.id = `movie-${movie.id}`;

    // Build streaming badges
    const streamingHTML = movie.streaming
      .map(
        (s) =>
          `<span class="streaming-badge ${s.class}">${s.name}</span>`
      )
      .join("");

    // Type badge
    const typeIcon = movie.type === "série" ? "📺" : "🎬";
    const typeClass = movie.type === "série" ? "serie" : "";

    // Note
    const noteHTML = movie.note
      ? `<span class="card-year" style="color: var(--text-accent); font-style: italic;">⚡ ${movie.note}</span>`
      : "";

    card.innerHTML = `
      <div class="checkbox-wrapper">
        <input
          type="checkbox"
          id="check-${movie.id}"
          ${isWatched ? "checked" : ""}
          aria-label="Marcar ${movie.title} como assistido"
        />
        <div class="checkmark">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 12 10 18 20 6" />
          </svg>
        </div>
      </div>
      <div class="card-content">
        <span class="card-number">#${String(movie.id).padStart(2, "0")} de ${MOVIES.length}</span>
        <span class="card-title">${movie.title}</span>
        <span class="card-year">${movie.year}</span>
        ${noteHTML}
        <div class="card-meta">
          <span class="card-type ${typeClass}">${typeIcon} ${movie.type}</span>
          ${streamingHTML}
        </div>
      </div>
      <div class="card-right">
        <span class="watched-date" id="date-${movie.id}">
          <svg class="watched-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${isWatched ? formatDate(watchedDate) : ""}
        </span>
      </div>
    `;

    // Event: toggle watched
    const checkbox = card.querySelector(`#check-${movie.id}`);
    checkbox.addEventListener("change", () => {
      handleToggle(movie.id, checkbox, card);
    });

    // Clicking the card toggles the checkbox too
    card.addEventListener("click", (e) => {
      if (e.target === checkbox || e.target.closest('.checkbox-wrapper')) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });

    movieListEl.appendChild(card);
  });
}

function handleToggle(movieId, checkbox, card) {
  if (checkbox.checked) {
    const today = getTodayISO();
    watchedMap[movieId] = today;
    card.classList.add("watched");

    // Update date display
    const dateEl = document.getElementById(`date-${movieId}`);
    dateEl.innerHTML = `
      <svg class="watched-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${formatDate(today)}
    `;

    // Micro-animation: confetti ring on checkbox
    const wrapper = checkbox.closest(".checkbox-wrapper");
    const ring = document.createElement("div");
    ring.className = "confetti-ring";
    wrapper.appendChild(ring);
    ring.addEventListener("animationend", () => ring.remove());
  } else {
    delete watchedMap[movieId];
    card.classList.remove("watched");

    const dateEl = document.getElementById(`date-${movieId}`);
    dateEl.innerHTML = `
      <svg class="watched-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    `;
  }

  saveState();
  updateProgress();
}

function updateProgress() {
  const watched = Object.keys(watchedMap).length;
  const total = MOVIES.length;
  const remaining = total - watched;
  const percent = Math.round((watched / total) * 100);

  watchedCountEl.textContent = watched;
  remainingStatEl.textContent = remaining;
  percentStatEl.textContent = `${percent}%`;

  progressFillEl.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", watched);

  // Completed banner
  if (watched === total) {
    completedBannerEl.classList.add("visible");
  } else {
    completedBannerEl.classList.remove("visible");
  }
}

function handleReset() {
  if (!confirm("Tem certeza que deseja resetar todo o progresso?")) return;

  watchedMap = {};
  saveState();

  // Re-render everything
  renderMovies();
  updateProgress();
}
