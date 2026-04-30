/* Evosmos Fast Delivery — script.js
   Pure vanilla JS. All data lives in localStorage. */

const LS_USERS = "evo_users";
const LS_ORDERS = "evo_orders";
const LS_SESSION = "evo_session";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const getUsers = () => JSON.parse(localStorage.getItem(LS_USERS) || "[]");
const setUsers = (u) => localStorage.setItem(LS_USERS, JSON.stringify(u));
const getOrders = () => JSON.parse(localStorage.getItem(LS_ORDERS) || "[]");
const setOrders = (o) => localStorage.setItem(LS_ORDERS, JSON.stringify(o));
const getSession = () => JSON.parse(localStorage.getItem(LS_SESSION) || "null");
const setSession = (s) => localStorage.setItem(LS_SESSION, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(LS_SESSION);

const findUser = (username) =>
  getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());

const updateUser = (username, patch) => {
  const users = getUsers();
  const idx = users.findIndex(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  setUsers(users);
  return users[idx];
};

const uid = () =>
  "ORD-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  Math.random().toString(36).slice(2, 6).toUpperCase();

let toastTimer = null;
function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 2800);
}

// Seed admin
(function seedAdmin() {
  const users = getUsers();
  if (!users.find((u) => u.username === "admin")) {
    users.push({
      username: "admin",
      email: "admin@evosmos.local",
      password: "admin123",
      totalSpent: 0,
      subscription: null,
      createdAt: Date.now(),
    });
    setUsers(users);
  }
})();

// Captcha
let captchaAnswer = 0;
function newCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  captchaAnswer = a + b;
  $("#captcha-question").textContent = `${a} + ${b} = ?`;
}

// Auth tabs
$$(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    const tab = t.dataset.tab;
    $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
    $$(".auth-form").forEach((f) =>
      f.classList.toggle("active", f.id === `${tab}-form`)
    );
    $("#login-error").textContent = "";
    $("#register-error").textContent = "";
    if (tab === "register") newCaptcha();
  });
});

// Register
$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("#reg-email").value.trim();
  const username = $("#reg-username").value.trim();
  const password = $("#reg-password").value;
  const confirm = $("#reg-confirm").value;
  const captcha = Number($("#reg-captcha").value);
  const err = $("#register-error");

  if (!email || !username || !password) {
    err.textContent = "All fields are required."; return;
  }
  if (username.length < 3) {
    err.textContent = "Username must be at least 3 characters."; return;
  }
  if (password.length < 4) {
    err.textContent = "Password must be at least 4 characters."; return;
  }
  if (password !== confirm) {
    err.textContent = "Passwords do not match."; return;
  }
  if (captcha !== captchaAnswer) {
    err.textContent = "Captcha incorrect. Try again.";
    newCaptcha(); $("#reg-captcha").value = ""; return;
  }
  if (findUser(username)) {
    err.textContent = "Username already taken."; return;
  }

  const users = getUsers();
  users.push({
    username, email, password,
    totalSpent: 0, subscription: null,
    createdAt: Date.now(),
  });
  setUsers(users);

  err.textContent = "";
  toast("Account created — please log in.", "success");

  $$(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === "login"));
  $$(".auth-form").forEach((f) =>
    f.classList.toggle("active", f.id === "login-form")
  );
  $("#login-username").value = username;
  $("#reg-email").value = "";
  $("#reg-username").value = "";
  $("#reg-password").value = "";
  $("#reg-confirm").value = "";
  $("#reg-captcha").value = "";
});

// Login
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = $("#login-username").value.trim();
  const password = $("#login-password").value;
  const err = $("#login-error");

  const user = findUser(username);
  if (!user || user.password !== password) {
    err.textContent = "Invalid username or password.";
    return;
  }

  err.textContent = "";
  setSession({ username: user.username, loginAt: Date.now() });
  toast(`Welcome back, ${user.username}.`, "success");
  enterApp();
});

// Logout
$("#logout-btn").addEventListener("click", () => {
  clearSession();
  $("#user-menu").classList.remove("show");
  $("#app-screen").classList.remove("active");
  $("#auth-screen").classList.add("active");
  $("#login-username").value = "";
  $("#login-password").value = "";
  toast("Logged out.", "");
});

// Navigation
$$(".nav-link").forEach((n) => {
  n.addEventListener("click", () => {
    const page = n.dataset.page;
    $$(".nav-link").forEach((x) => x.classList.toggle("active", x === n));
    $$(".page").forEach((p) =>
      p.classList.toggle("active", p.id === `page-${page}`)
    );
    if (page === "admin") renderAdmin();
  });
});

// User menu
$("#user-menu-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  $("#user-menu").classList.toggle("show");
});
document.addEventListener("click", (e) => {
  const menu = $("#user-menu");
  if (
    menu &&
    !menu.contains(e.target) &&
    !$("#user-menu-toggle").contains(e.target)
  ) {
    menu.classList.remove("show");
  }
});

// Place orders
$$(".order-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const session = getSession();
    if (!session) return;
    const item = btn.dataset.item;
    const price = parseFloat(btn.dataset.price);
    const sub = btn.dataset.sub || null;

    const order = {
      id: uid(),
      user: session.username,
      item,
      type: sub ? "Subscription" : "Casual",
      subPlan: sub,
      price,
      status: "pending",
      createdAt: Date.now(),
    };
    const orders = getOrders();
    orders.unshift(order);
    setOrders(orders);

    toast(`Order placed — awaiting admin confirmation.`, sub ? "gold" : "success");
    refreshUserMenu();
  });
});

// Card hover glow
$$(".card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

// Admin filter
let adminFilter = "all";
$$(".chip").forEach((c) => {
  c.addEventListener("click", () => {
    $$(".chip").forEach((x) => x.classList.toggle("active", x === c));
    adminFilter = c.dataset.filter;
    renderAdmin();
  });
});

// Enter app
function enterApp() {
  const session = getSession();
  if (!session) return;
  const user = findUser(session.username);
  if (!user) { clearSession(); return; }

  $("#auth-screen").classList.remove("active");
  $("#app-screen").classList.add("active");

  $("#top-username").textContent = user.username;
  $("#avatar-letter").textContent = user.username[0].toUpperCase();
  $("#avatar-letter-lg").textContent = user.username[0].toUpperCase();

  const isAdmin = user.username === "admin";
  $(".admin-only").classList.toggle("show", isAdmin);

  $$(".nav-link").forEach((x) => x.classList.toggle("active", x.dataset.page === "home"));
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-home"));

  refreshUserMenu();
}

// User menu refresh
function refreshUserMenu() {
  const session = getSession();
  if (!session) return;
  const user = findUser(session.username);
  if (!user) return;

  $("#um-username").textContent = user.username;
  $("#um-email").textContent = user.email;
  $("#um-spent").textContent = `$${(user.totalSpent || 0).toFixed(2)}`;

  const subEl = $("#um-sub");
  if (user.subscription && user.subscription.expiresAt > Date.now()) {
    const days = Math.ceil(
      (user.subscription.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)
    );
    subEl.textContent = `${user.subscription.plan} · ${days}d`;
    subEl.classList.add("active");
  } else {
    subEl.textContent = "None";
    subEl.classList.remove("active");
  }

  const list = $("#um-orders-list");
  const orders = getOrders().filter((o) => o.user === user.username);
  list.innerHTML = "";
  if (orders.length === 0) {
    list.innerHTML = `<div class="empty-note">No orders yet.</div>`;
  } else {
    orders.forEach((o) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${o.item}</span>
        <span class="badge ${o.status}">${o.status}</span>
      `;
      list.appendChild(li);
    });
  }
}

// Admin render
function renderAdmin() {
  const session = getSession();
  if (!session) return;
  if (session.username !== "admin") return;

  const tbody = $("#admin-tbody");
  let orders = getOrders();
  if (adminFilter !== "all") orders = orders.filter((o) => o.status === adminFilter);

  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">No orders to show.</td></tr>`;
    return;
  }

  orders.forEach((o) => {
    let actionHTML = "";
    if (o.status === "pending") {
      actionHTML = `
        <div class="action-group">
          <button class="confirm-btn" data-action="confirm" data-id="${o.id}">Confirm</button>
          <button class="decline-btn" data-action="decline" data-id="${o.id}">Decline</button>
        </div>
      `;
    } else if (o.status === "confirmed") {
      actionHTML = `<span class="done-tag">DONE</span>`;
    } else if (o.status === "declined") {
      actionHTML = `<span class="declined-tag">DECLINED</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="order-id">${o.id}</td>
      <td>${o.user}</td>
      <td>${o.item}</td>
      <td><span class="type-tag ${o.type === "Subscription" ? "sub" : ""}">${o.type}</span></td>
      <td>$${o.price.toFixed(2)}</td>
      <td><span class="badge ${o.status}">${o.status}</span></td>
      <td>${actionHTML}</td>
    `;
    tbody.appendChild(tr);
  });

  $$(".confirm-btn", tbody).forEach((b) => {
    b.addEventListener("click", () => confirmOrder(b.dataset.id));
  });
  $$(".decline-btn", tbody).forEach((b) => {
    b.addEventListener("click", () => declineOrder(b.dataset.id));
  });
}

// Confirm order
function confirmOrder(id) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "pending") return;

  order.status = "confirmed";
  order.confirmedAt = Date.now();

  const user = findUser(order.user);
  if (user) {
    const newSpent = (user.totalSpent || 0) + order.price;
    const patch = { totalSpent: newSpent };
    if (order.type === "Subscription") {
      const days =
        order.subPlan === "monthly" ? 30 :
        order.subPlan === "6months" ? 180 : 365;
      const base =
        user.subscription && user.subscription.expiresAt > Date.now()
          ? user.subscription.expiresAt
          : Date.now();
      patch.subscription = {
        plan: order.subPlan,
        expiresAt: base + days * 24 * 60 * 60 * 1000,
      };
    }
    updateUser(order.user, patch);
  }

  setOrders(orders);
  toast(`Order ${order.id} confirmed.`, "success");
  renderAdmin();
  refreshUserMenu();
}

// Decline order
function declineOrder(id) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "pending") return;

  order.status = "declined";
  order.declinedAt = Date.now();
  // No money added. No subscription activated.

  setOrders(orders);
  toast(`Order ${order.id} declined.`, "error");
  renderAdmin();
  refreshUserMenu();
}

// Init
(function init() {
  newCaptcha();
  const session = getSession();
  if (session && findUser(session.username)) {
    enterApp();
  } else {
    $("#auth-screen").classList.add("active");
  }
})();
