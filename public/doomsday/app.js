/**
 * Vingadores: Doutor Destino — Checklist App
 * Multi-usuário com persistência em Postgres (Neon) e sessão por cookie,
 * Autenticação simples (Nome, E-mail e WhatsApp),
 * Contador regressivo para 17/12/2026 às 00:00 e edição de datas.
 */

// ===== Filmes e Séries Essenciais =====
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

const USER_SESSION_KEY = "marvel_doomsday_user";
const STORAGE_PREFIX = "marvel_user_data_";
const API_MOVIES = "/doomsday/api/movies";
const API_AUTH = "/doomsday/api/auth";

// Data de Estreia: 17 de dezembro de 2026 às 00:00 (Horário de Brasília UTC-3)
const TARGET_RELEASE_DATE = new Date("2026-12-17T00:00:00-03:00").getTime();

// ===== Estado Global =====
let currentUser = loadSavedUser();
let watchedMap = {};
let watchedOrders = {};
let editingMovieId = null;

// ===== Elementos do DOM =====
const movieListEl = document.getElementById("movieList");
const watchedCountEl = document.getElementById("watchedCount");
const totalCountEl = document.getElementById("totalCount");
const progressFillEl = document.getElementById("progressFill");
const progressBar = progressFillEl.closest('[role="progressbar"]');
const remainingStatEl = document.getElementById("remainingStat");
const percentStatEl = document.getElementById("percentStat");
const completedBannerEl = document.getElementById("completedBanner");
const resetBtn = document.getElementById("resetBtn");
const dbStatusBadge = document.getElementById("dbStatusBadge");
const dbStatusText = document.getElementById("dbStatusText");

// Elementos da Barra de Usuário
const userNameDisplay = document.getElementById("userNameDisplay");
const userSubDisplay = document.getElementById("userSubDisplay");
const btnOpenAuthModal = document.getElementById("btnOpenAuthModal");
const userLoggedActions = document.getElementById("userLoggedActions");
const btnSwitchUser = document.getElementById("btnSwitchUser");
const btnLogout = document.getElementById("btnLogout");

// Elementos do Modal de Autenticação
const authModal = document.getElementById("authModal");
const authModalClose = document.getElementById("authModalClose");
const tabBtnLogin = document.getElementById("tabBtnLogin");
const tabBtnRegister = document.getElementById("tabBtnRegister");
const formLogin = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");
const authModalDesc = document.getElementById("authModalDesc");
const inputLoginEmail = document.getElementById("inputLoginEmail");
const inputLoginWhatsapp = document.getElementById("inputLoginWhatsapp");
const inputRegName = document.getElementById("inputRegName");
const inputRegEmail = document.getElementById("inputRegEmail");
const inputRegWhatsapp = document.getElementById("inputRegWhatsapp");
const loginErrorBox = document.getElementById("loginErrorBox");
const regErrorBox = document.getElementById("regErrorBox");
const linkToRegister = document.getElementById("linkToRegister");
const linkToLogin = document.getElementById("linkToLogin");

// Elementos do Modal de Edição de Data
const dateModal = document.getElementById("dateModal");
const dateModalForm = document.getElementById("dateModalForm");
const dateModalClose = document.getElementById("dateModalClose");
const dateModalCancel = document.getElementById("dateModalCancel");
const dateModalMovieName = document.getElementById("dateModalMovieName");
const dateModalInput = document.getElementById("dateModalInput");
const toastEl = document.getElementById("toastNotification");

// Elementos da Contagem Regressiva
const cdDaysEl = document.getElementById("cdDays");
const cdHoursEl = document.getElementById("cdHours");
const cdMinutesEl = document.getElementById("cdMinutes");
const cdSecondsEl = document.getElementById("cdSeconds");

// ===== Inicialização =====
totalCountEl.textContent = MOVIES.length;
initCountdown();
updateUserUI();
initPhoneMasks();

if (currentUser) {
  loadUserData(currentUser.id);
  verifySession();
} else {
  showVisitorMode();
}

// ===== Eventos =====
resetBtn.addEventListener("click", handleReset);
btnOpenAuthModal.addEventListener("click", () => openAuthModal("login"));
btnSwitchUser.addEventListener("click", () => openAuthModal("login"));
btnLogout.addEventListener("click", handleLogout);

authModalClose.addEventListener("click", closeAuthModal);
tabBtnLogin.addEventListener("click", () => switchAuthTab("login"));
tabBtnRegister.addEventListener("click", () => switchAuthTab("register"));
linkToRegister.addEventListener("click", (e) => {
  e.preventDefault();
  switchAuthTab("register");
});
linkToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  switchAuthTab("login");
});

formLogin.addEventListener("submit", handleLoginSubmit);
formRegister.addEventListener("submit", handleRegisterSubmit);

dateModalClose.addEventListener("click", closeDateModal);
dateModalCancel.addEventListener("click", closeDateModal);
dateModalForm.addEventListener("submit", handleSaveEditedDate);

// Fechar modais ao clicar fora
[authModal, dateModal].forEach((dialog) => {
  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  });
});

// ===== 1. Gestão de Usuários e Autenticação =====

function loadSavedUser() {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUserSession(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_SESSION_KEY);
  }
  updateUserUI();
}

function updateUserUI() {
  if (currentUser) {
    userNameDisplay.textContent = currentUser.name;
    userSubDisplay.textContent = `${currentUser.email} • ${formatPhone(currentUser.whatsapp)}`;
    btnOpenAuthModal.style.display = "none";
    userLoggedActions.style.display = "flex";
  } else {
    userNameDisplay.textContent = "Visitante";
    userSubDisplay.textContent = "Faça login para salvar seu progresso";
    btnOpenAuthModal.style.display = "inline-flex";
    userLoggedActions.style.display = "none";
  }
}

function openAuthModal(defaultTab = "login") {
  loginErrorBox.style.display = "none";
  regErrorBox.style.display = "none";
  switchAuthTab(defaultTab);

  if (typeof authModal.showModal === "function") {
    authModal.showModal();
  } else {
    authModal.setAttribute("open", "true");
  }
}

function closeAuthModal() {
  if (typeof authModal.close === "function") {
    authModal.close();
  } else {
    authModal.removeAttribute("open");
  }
}

function switchAuthTab(tab) {
  loginErrorBox.style.display = "none";
  regErrorBox.style.display = "none";

  if (tab === "login") {
    tabBtnLogin.classList.add("active");
    tabBtnLogin.setAttribute("aria-selected", "true");
    tabBtnRegister.classList.remove("active");
    tabBtnRegister.setAttribute("aria-selected", "false");
    formLogin.style.display = "flex";
    formRegister.style.display = "none";
    authModalDesc.textContent = "Acesse com seu e-mail e WhatsApp para carregar seus filmes assistidos.";
    inputLoginEmail.focus();
  } else {
    tabBtnRegister.classList.add("active");
    tabBtnRegister.setAttribute("aria-selected", "true");
    tabBtnLogin.classList.remove("active");
    tabBtnLogin.setAttribute("aria-selected", "false");
    formRegister.style.display = "flex";
    formLogin.style.display = "none";
    authModalDesc.textContent = "Crie seu perfil em poucos segundos para salvar seu progresso (sem necessidade de senha).";
    inputRegName.focus();
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  loginErrorBox.style.display = "none";

  const email = inputLoginEmail.value.trim();
  const whatsapp = inputLoginWhatsapp.value.trim();

  if (!email || !whatsapp) {
    showError(loginErrorBox, "Por favor, preencha o e-mail e o WhatsApp.");
    return;
  }

  setDbStatus("syncing", "Autenticando...");

  try {
    const res = await fetch(API_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, whatsapp }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showError(loginErrorBox, data.error || "Erro ao realizar login.");
      setDbStatus("offline", "Erro no login");
      return;
    }

    saveUserSession(data.user);
    closeAuthModal();
    showToast(`Bem-vindo, ${data.user.name}!`);
    await loadUserData(data.user.id);
  } catch (err) {
    console.error("Erro no login:", err);
    showError(loginErrorBox, "Erro de comunicação com o servidor.");
    setDbStatus("offline", "Falha de conexão");
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  regErrorBox.style.display = "none";

  const name = inputRegName.value.trim();
  const email = inputRegEmail.value.trim();
  const whatsapp = inputRegWhatsapp.value.trim();

  if (!name || !email || !whatsapp) {
    showError(regErrorBox, "Por favor, preencha todos os campos.");
    return;
  }

  setDbStatus("syncing", "Criando perfil...");

  try {
    const res = await fetch(API_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", name, email, whatsapp }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showError(regErrorBox, data.error || "Erro ao cadastrar.");
      setDbStatus("offline", "Erro no cadastro");
      return;
    }

    saveUserSession(data.user);
    closeAuthModal();
    showToast(`Perfil criado com sucesso! Olá, ${data.user.name}.`);
    await loadUserData(data.user.id);
  } catch (err) {
    console.error("Erro no cadastro:", err);
    showError(regErrorBox, "Erro de comunicação com o servidor.");
    setDbStatus("offline", "Falha de conexão");
  }
}

async function handleLogout() {
  try {
    await fetch(API_AUTH, { method: "DELETE" });
  } catch (err) {
    console.warn("Erro ao encerrar sessão no servidor:", err);
  }
  saveUserSession(null);
  showVisitorMode("Desconectado");
  showToast("Você saiu da conta.");
}

// Confere no servidor se o cookie de sessão ainda é válido
async function verifySession() {
  try {
    const res = await fetch(API_AUTH, { cache: "no-store" });
    if (res.status === 401) {
      handleSessionExpired();
      return;
    }
    const data = await res.json();
    if (data.success && data.user) saveUserSession(data.user);
  } catch (err) {
    console.warn("Não foi possível verificar a sessão:", err);
  }
}

function handleSessionExpired() {
  if (!currentUser) return;
  saveUserSession(null);
  showVisitorMode("Sessão expirada");
  showToast("Sua sessão expirou. Entre novamente para continuar.");
}

function showVisitorMode(statusText = "Modo Visitante (Faça Login)") {
  watchedMap = {};
  watchedOrders = {};
  renderMovies();
  updateProgress();
  setDbStatus("offline", statusText);
}

function showError(box, msg) {
  box.textContent = msg;
  box.style.display = "block";
}

// ===== 2. Carregamento e Sincronização de Filmes por Usuário =====

async function loadUserData(userId) {
  setDbStatus("syncing", "Carregando seu checklist...");

  // Fallback rápido local enquanto a API responde
  const local = loadLocalUserData(userId);
  watchedMap = local.map;
  watchedOrders = local.orders;
  renderMovies();
  updateProgress();

  try {
    const res = await fetch(API_MOVIES, { cache: "no-store" });
    if (res.status === 401) {
      handleSessionExpired();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();
    if (result.success && result.data) {
      // O servidor é a fonte da verdade: substitui o cache local em vez de mesclar,
      // para que filmes desmarcados em outro dispositivo não reapareçam.
      watchedMap = { ...result.data };
      watchedOrders = { ...(result.orders || {}) };
      saveLocalUserData(userId, { map: watchedMap, orders: watchedOrders });
      renderMovies();
      updateProgress();
      setDbStatus("online", "Sincronizado");
    } else {
      setDbStatus("online", "Conectado");
    }
  } catch (err) {
    console.warn("Aviso ao carregar do servidor:", err);
    setDbStatus("offline", "Usando cache local");
  }
}

async function saveMovie(movieId, watchedDate, watchedOrder) {
  if (!currentUser) {
    openAuthModal("login");
    showToast("Faça login para salvar seus filmes!");
    return;
  }

  setDbStatus("syncing", "Salvando...");
  try {
    const res = await fetch(API_MOVIES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: movieId,
        watched_date: watchedDate,
        watched_order: watchedOrder,
      }),
    });
    if (res.status === 401) {
      handleSessionExpired();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.item && data.item.watched_order) {
      watchedOrders[movieId] = data.item.watched_order;
      saveLocalUserData(currentUser.id, { map: watchedMap, orders: watchedOrders });
      const orderBadgeEl = document.getElementById(`order-badge-${movieId}`);
      if (orderBadgeEl) {
        orderBadgeEl.textContent = `★ ${data.item.watched_order}º assistido`;
        orderBadgeEl.style.display = "inline-flex";
      }
    }
    setDbStatus("online", "Sincronizado");
  } catch (err) {
    console.warn("Erro ao salvar no servidor:", err);
    setDbStatus("offline", "Salvo no cache local");
  }
}

async function removeMovie(movieId) {
  if (!currentUser) return;

  setDbStatus("syncing", "Atualizando...");
  try {
    const res = await fetch(`${API_MOVIES}?id=${movieId}`, {
      method: "DELETE",
    });
    if (res.status === 401) {
      handleSessionExpired();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setDbStatus("online", "Sincronizado");
  } catch (err) {
    console.warn("Erro ao remover no servidor:", err);
    setDbStatus("offline", "Atualizado no cache");
  }
}

async function resetAll() {
  if (!currentUser) {
    watchedMap = {};
    watchedOrders = {};
    saveLocalUserData(0, { map: {}, orders: {} });
    renderMovies();
    updateProgress();
    showToast("Progresso limpo.");
    return;
  }

  if (!confirm(`Deseja resetar todo o progresso do perfil de ${currentUser.name}?`)) return;

  watchedMap = {};
  watchedOrders = {};
  saveLocalUserData(currentUser.id, { map: {}, orders: {} });
  renderMovies();
  updateProgress();
  showToast("Progresso resetado!");

  setDbStatus("syncing", "Limpando...");
  try {
    const res = await fetch(`${API_MOVIES}?action=reset`, {
      method: "DELETE",
    });
    if (res.status === 401) {
      handleSessionExpired();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setDbStatus("online", "Progresso limpo");
  } catch (err) {
    console.warn("Erro ao limpar no servidor:", err);
    setDbStatus("offline", "Cache limpo");
  }
}

function loadLocalUserData(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return { map: {}, orders: {} };
    const parsed = JSON.parse(raw);
    if (parsed.map && parsed.orders) return parsed;
    return { map: parsed, orders: {} };
  } catch {
    return { map: {}, orders: {} };
  }
}

function saveLocalUserData(userId, data) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.error("Erro ao salvar dados locais", err);
  }
}

function setDbStatus(status, text) {
  dbStatusBadge.className = `db-badge ${status}`;
  dbStatusText.textContent = text;
}

// ===== 3. Edição de Data Assistida =====

function openDateModal(movieId) {
  if (!currentUser) {
    openAuthModal("login");
    showToast("Identifique-se para gerenciar as datas!");
    return;
  }

  const movie = MOVIES.find((m) => m.id === movieId);
  if (!movie) return;

  editingMovieId = movieId;
  dateModalMovieName.textContent = `#${movie.id} — ${movie.title} (${movie.year})`;

  const currentDate = watchedMap[movieId] || getTodayISO();
  dateModalInput.value = currentDate;

  if (typeof dateModal.showModal === "function") {
    dateModal.showModal();
  } else {
    dateModal.setAttribute("open", "true");
  }
}

function closeDateModal() {
  if (typeof dateModal.close === "function") {
    dateModal.close();
  } else {
    dateModal.removeAttribute("open");
  }
  editingMovieId = null;
}

async function handleSaveEditedDate(e) {
  e.preventDefault();
  if (!editingMovieId || !currentUser) return;

  const newDate = dateModalInput.value;
  if (!newDate) return;

  const movieId = editingMovieId;
  watchedMap[movieId] = newDate;
  saveLocalUserData(currentUser.id, { map: watchedMap, orders: watchedOrders });

  const dateTextEl = document.getElementById(`date-text-${movieId}`);
  if (dateTextEl) {
    dateTextEl.textContent = formatDate(newDate);
  }

  closeDateModal();
  showToast(`Data atualizada para ${formatDate(newDate)}!`);

  await saveMovie(movieId, newDate, watchedOrders[movieId]);
}

// ===== 4. Renderização da Lista de Filmes =====

function renderMovies() {
  movieListEl.innerHTML = "";

  MOVIES.forEach((movie, index) => {
    const isWatched = !!watchedMap[movie.id];
    const watchedDate = watchedMap[movie.id] || null;
    const orderNum = watchedOrders[movie.id] || null;

    const card = document.createElement("article");
    card.className = `movie-card${isWatched ? " watched" : ""}`;
    card.style.animationDelay = `${index * 0.03}s`;
    card.id = `movie-${movie.id}`;

    const streamingHTML = movie.streaming
      .map((s) => `<span class="streaming-badge ${s.class}">${s.name}</span>`)
      .join("");

    const typeIcon = movie.type === "série" ? "📺" : "🎬";
    const typeClass = movie.type === "série" ? "serie" : "";

    const noteHTML = movie.note
      ? `<span class="card-year" style="color: var(--text-accent); font-style: italic;">⚡ ${movie.note}</span>`
      : "";

    const orderBadgeHTML = isWatched && orderNum
      ? `<span class="watched-order-badge" id="order-badge-${movie.id}">★ ${orderNum}º assistido</span>`
      : `<span class="watched-order-badge" id="order-badge-${movie.id}" style="display: none;"></span>`;

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
        <div class="card-number-wrapper">
          <span class="card-number">#${String(movie.id).padStart(2, "0")} de ${MOVIES.length}</span>
          ${orderBadgeHTML}
        </div>
        <span class="card-title">${movie.title}</span>
        <span class="card-year">${movie.year}</span>
        ${noteHTML}
        <div class="card-meta">
          <span class="card-type ${typeClass}">${typeIcon} ${movie.type}</span>
          ${streamingHTML}
        </div>
      </div>
      <div class="card-right">
        <div class="watched-date-wrapper" id="date-wrapper-${movie.id}">
          <button 
            type="button" 
            class="watched-date" 
            id="btn-date-${movie.id}" 
            title="Clique para alterar a data assistida"
          >
            <svg class="watched-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span id="date-text-${movie.id}">${isWatched ? formatDate(watchedDate) : ""}</span>
          </button>
          <button 
            type="button" 
            class="btn-edit-date" 
            id="btn-edit-${movie.id}" 
            title="Alterar data" 
            aria-label="Alterar data em que assistiu ${movie.title}"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
      </div>
    `;

    const checkbox = card.querySelector(`#check-${movie.id}`);
    checkbox.addEventListener("change", () => {
      handleToggle(movie.id, checkbox, card);
    });

    const dateBtn = card.querySelector(`#btn-date-${movie.id}`);
    const editBtn = card.querySelector(`#btn-edit-${movie.id}`);

    dateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDateModal(movie.id);
    });

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDateModal(movie.id);
    });

    card.addEventListener("click", (e) => {
      if (
        e.target === checkbox ||
        e.target.closest(".checkbox-wrapper") ||
        e.target.closest(".watched-date-wrapper")
      ) {
        return;
      }
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });

    movieListEl.appendChild(card);
  });
}

async function handleToggle(movieId, checkbox, card) {
  if (!currentUser) {
    checkbox.checked = !checkbox.checked;
    openAuthModal("login");
    showToast("Cadastre-se ou faça login para salvar seu progresso!");
    return;
  }

  if (checkbox.checked) {
    const today = getTodayISO();
    watchedMap[movieId] = today;
    card.classList.add("watched");

    // Calcula a próxima ordem de visualização
    const currentOrders = Object.values(watchedOrders).filter(v => typeof v === 'number');
    const nextOrder = (currentOrders.length > 0 ? Math.max(...currentOrders) : 0) + 1;
    watchedOrders[movieId] = nextOrder;

    // Atualiza a data no card
    const dateTextEl = document.getElementById(`date-text-${movieId}`);
    if (dateTextEl) {
      dateTextEl.textContent = formatDate(today);
    }

    // Atualiza o badge de ordem assistida
    const orderBadgeEl = document.getElementById(`order-badge-${movieId}`);
    if (orderBadgeEl) {
      orderBadgeEl.textContent = `★ ${nextOrder}º assistido`;
      orderBadgeEl.style.display = "inline-flex";
    }

    const wrapper = checkbox.closest(".checkbox-wrapper");
    const ring = document.createElement("div");
    ring.className = "confetti-ring";
    wrapper.appendChild(ring);
    ring.addEventListener("animationend", () => ring.remove());

    showToast(`Marcado como ${nextOrder}º assistido!`);
    saveLocalUserData(currentUser.id, { map: watchedMap, orders: watchedOrders });
    updateProgress();

    await saveMovie(movieId, today, nextOrder);
  } else {
    delete watchedMap[movieId];
    delete watchedOrders[movieId];
    card.classList.remove("watched");

    const dateTextEl = document.getElementById(`date-text-${movieId}`);
    if (dateTextEl) {
      dateTextEl.textContent = "";
    }

    const orderBadgeEl = document.getElementById(`order-badge-${movieId}`);
    if (orderBadgeEl) {
      orderBadgeEl.style.display = "none";
    }

    // Renumera as ordens dos filmes restantes para manter sequência 1, 2, 3...
    const sortedIds = Object.keys(watchedOrders).sort((a, b) => watchedOrders[a] - watchedOrders[b]);
    sortedIds.forEach((id, idx) => {
      watchedOrders[id] = idx + 1;
    });

    renderMovies();
    saveLocalUserData(currentUser.id, { map: watchedMap, orders: watchedOrders });
    updateProgress();

    await removeMovie(movieId);
  }
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

  if (watched === total) {
    completedBannerEl.classList.add("visible");
  } else {
    completedBannerEl.classList.remove("visible");
  }
}

function handleReset() {
  resetAll();
}

// ===== 5. Contador Regressivo =====

function initCountdown() {
  function updateTimer() {
    const now = new Date().getTime();
    const distance = TARGET_RELEASE_DATE - now;

    if (distance <= 0) {
      cdDaysEl.textContent = "00";
      cdHoursEl.textContent = "00";
      cdMinutesEl.textContent = "00";
      cdSecondsEl.textContent = "00";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    cdDaysEl.textContent = String(days).padStart(2, "0");
    cdHoursEl.textContent = String(hours).padStart(2, "0");
    cdMinutesEl.textContent = String(minutes).padStart(2, "0");
    cdSecondsEl.textContent = String(seconds).padStart(2, "0");
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// ===== 6. Utilitários e Máscaras =====

function initPhoneMasks() {
  [inputLoginWhatsapp, inputRegWhatsapp].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.substring(0, 11);

      if (v.length > 10) {
        // (11) 98765-4321
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      } else if (v.length > 6) {
        // (11) 9876-5432 ou parcial
        v = v.replace(/^(\d{2})(\d{4,5})(\d{0,4})$/, "($1) $2-$3");
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
      }
      e.target.value = v;
    });
  });
}

function formatPhone(phone) {
  if (!phone) return "";
  const v = String(phone).replace(/\D/g, "");
  if (v.length === 11) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (v.length === 10) {
    return v.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return phone;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const months = [
      "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${day} de ${monthName}. de ${year}`;
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let toastTimeout = null;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}
