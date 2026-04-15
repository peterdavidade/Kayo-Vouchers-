/* =========================================================
   Kayo Vouchers — Vanilla JS (localStorage demo auth)
   Notes:
   - This is a front-end-only demo. In real apps, NEVER store
     passwords or OTPs in localStorage. Use a secure backend.
   ========================================================= */

// ---------- LocalStorage keys ----------
const STORAGE_KEYS = {
  accounts: "kayo_accounts",
  session: "kayo_session",
  theme: "kayo_theme",
  pendingSignup: "kayo_pending_signup",
  pendingForgot: "kayo_pending_forgot",
  purchases: "kayo_purchases" // demo purchase history per user
};

// ---------- Small helpers ----------
function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readStorage(key, fallback) {
  return safeJsonParse(localStorage.getItem(key), fallback);
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeIdentifier(raw) {
  const trimmed = String(raw || "").trim();
  // If it looks like an email, lower-case it. Otherwise treat as phone-ish and remove spaces.
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return trimmed.replace(/\s+/g, "");
}

function generateOtp() {
  // Random 6-digit OTP (000000–999999), padded to 6 digits.
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function createId() {
  // Good enough for a demo.
  return `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- Accounts + session ----------
function getAccounts() {
  return readStorage(STORAGE_KEYS.accounts, []);
}

function setAccounts(accounts) {
  writeStorage(STORAGE_KEYS.accounts, accounts);
}

function findAccountByIdentifier(identifier) {
  const needle = normalizeIdentifier(identifier);
  return getAccounts().find((a) => a.contactNormalized === needle) || null;
}

function getSession() {
  return readStorage(STORAGE_KEYS.session, null);
}

function setSession(session) {
  writeStorage(STORAGE_KEYS.session, session);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function getCurrentUser() {
  const session = getSession();
  if (!session?.userId) return null;
  const accounts = getAccounts();
  return accounts.find((a) => a.id === session.userId) || null;
}

// ---------- Theme ----------
function getTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "light";
}

function setTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector("[data-theme-icon]");
  if (!icon) return;
  // Light theme shows moon (switch to dark). Dark theme shows sun (switch to light).
  icon.textContent = theme === "dark" ? "\u2600" : "\u263E";
}

// ---------- UI helpers ----------
function setYear() {
  const year = new Date().getFullYear();
  $all("[data-year]").forEach((el) => (el.textContent = String(year)));
}

function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function showAlert(message, type = "info") {
  const alert = document.querySelector("[data-alert]");
  if (!alert) return;
  alert.hidden = false;
  alert.textContent = message;
  alert.classList.toggle("is-error", type === "error");
}

function clearAlert() {
  const alert = document.querySelector("[data-alert]");
  if (!alert) return;
  alert.hidden = true;
  alert.textContent = "";
  alert.classList.remove("is-error");
}

function setAuthPanel(name) {
  // Used on signup.html and forgot.html (and any auth pages using data-auth panels)
  const panels = $all("[data-auth]");
  if (panels.length === 0) return;
  panels.forEach((p) => (p.hidden = p.getAttribute("data-auth") !== name));
}

function updateNavAuthState() {
  const user = getCurrentUser();
  const navUser = document.querySelector("[data-nav-user]");
  const navUserText = document.querySelector("[data-nav-user-text]");
  const authLink = document.querySelector("[data-auth-link]");

  if (user) {
    if (navUser) navUser.hidden = false;
    if (navUserText) navUserText.textContent = `Welcome, ${user.name.split(" ")[0]}`;
    if (authLink) authLink.hidden = true;
  } else {
    if (navUser) navUser.hidden = true;
    if (authLink) authLink.hidden = false;
  }
}

function attachLogout() {
  $all("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearSession();
      updateNavAuthState();
      // If user logs out on login page, stay there. On index, show feedback.
      if (location.pathname.toLowerCase().endsWith("index.html") || location.pathname === "/") {
        showToast("You have been logged out.");
      }
    });
  });
}

// ---------- Landing page: Buy Now ----------
const PRODUCT_CATALOG = {
  bece: { name: "BECE Checker", price: "₵ 15.00" },
  wassce: { name: "WASSCE Checker", price: "₵ 25.00" },
  university: { name: "University Voucher", price: "₵ 200.00" }
};

function savePurchase(userId, purchase) {
  const allPurchases = readStorage(STORAGE_KEYS.purchases, {});
  const list = Array.isArray(allPurchases[userId]) ? allPurchases[userId] : [];
  list.unshift(purchase);
  allPurchases[userId] = list.slice(0, 10); // keep latest 10 (demo)
  writeStorage(STORAGE_KEYS.purchases, allPurchases);
}

function handleBuy(productKey) {
  const user = getCurrentUser();
  const product = PRODUCT_CATALOG[productKey] || { name: "Voucher", price: "" };

  if (!user) {
    showToast("Please login to buy. Redirecting…");
    window.setTimeout(() => (location.href = "login.html"), 700);
    return;
  }

  // Demo: generate a fake voucher code
  const code = `KAYO-${Math.random().toString(36).toUpperCase().slice(2, 6)}-${generateOtp().slice(0, 4)}`;
  savePurchase(user.id, {
    id: `p_${Date.now()}`,
    productKey,
    productName: product.name,
    price: product.price,
    code,
    createdAt: new Date().toISOString()
  });

  showToast(`Purchase successful! Your code: ${code}`);
}

function initLanding() {
  // Hero CTA (Buy Now / Get Started)
  $all('[data-action="get-started"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) {
        showToast("Create an account to continue. Redirecting…");
        window.setTimeout(() => (location.href = "login.html"), 700);
        return;
      }
      // Scroll to products when already logged in.
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  // Buy buttons
  $all("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-product]");
      const productKey = card?.getAttribute("data-product") || "bece";
      handleBuy(productKey);
    });
  });
}

// ---------- Auth page: login/signup/forgot flows ----------
function initAuth() {
  const hasAuthPanels = document.querySelector("[data-auth]");
  if (!hasAuthPanels) return;

  // If already logged in, redirect to landing page for convenience.
  if (getCurrentUser()) {
    location.href = "index.html";
    return;
  }

  // Resume any pending OTP steps (refresh-friendly)
  const pendingSignup = readStorage(STORAGE_KEYS.pendingSignup, null);
  if (pendingSignup?.otp && document.querySelector('[data-auth="signup-otp"]')) {
    const hint = document.querySelector("[data-otp-hint]");
    if (hint) hint.textContent = `Demo OTP: ${pendingSignup.otp}`;
    setAuthPanel("signup-otp");
  }

  const pendingForgot = readStorage(STORAGE_KEYS.pendingForgot, null);
  if (pendingForgot?.otp && document.querySelector('[data-auth="forgot-reset"]')) {
    const hint = document.querySelector("[data-forgot-otp-hint]");
    if (hint) hint.textContent = `Demo OTP: ${pendingForgot.otp}`;
    setAuthPanel("forgot-reset");
  }

  // LOGIN submit (login.html)
  const loginForm = document.querySelector('[data-auth="login"]');
  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAlert();

    const form = new FormData(loginForm);
    const identifier = String(form.get("identifier") || "");
    const password = String(form.get("password") || "");

    const account = findAccountByIdentifier(identifier);
    if (!account || account.password !== password) {
      showAlert("Invalid login details. Check your email/phone and password.", "error");
      return;
    }

    setSession({ userId: account.id, loggedInAt: new Date().toISOString() });
    location.href = "index.html";
  });

  // SIGNUP submit (signup.html - step 1)
  const signupForm = document.querySelector('[data-auth="signup"]');
  signupForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAlert();

    const form = new FormData(signupForm);
    const name = String(form.get("name") || "").trim();
    const contact = String(form.get("contact") || "").trim();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (!name || !contact) {
      showAlert("Please enter your name and email/phone.", "error");
      return;
    }
    if (password.length < 6) {
      showAlert("Password should be at least 6 characters (demo rule).", "error");
      return;
    }
    if (password !== confirm) {
      showAlert("Passwords do not match.", "error");
      return;
    }

    const contactNormalized = normalizeIdentifier(contact);
    const exists = getAccounts().some((a) => a.contactNormalized === contactNormalized);
    if (exists) {
      showAlert("An account with that email/phone already exists. Please login instead.", "error");
      window.setTimeout(() => (location.href = "login.html"), 800);
      return;
    }

    const otp = generateOtp();
    writeStorage(STORAGE_KEYS.pendingSignup, {
      name,
      contact,
      contactNormalized,
      password,
      otp,
      createdAt: new Date().toISOString()
    });

    const hint = document.querySelector("[data-otp-hint]");
    if (hint) hint.textContent = `Demo OTP: ${otp}`;
    setAuthPanel("signup-otp");
    showAlert("We sent an OTP to your contact (simulated). Enter it below to finish signup.");
  });

  // SIGNUP OTP submit (signup.html - step 2)
  const signupOtpForm = document.querySelector('[data-auth="signup-otp"]');
  signupOtpForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAlert();

    const pending = readStorage(STORAGE_KEYS.pendingSignup, null);
    if (!pending?.otp) {
      showAlert("No pending signup found. Please try signing up again.", "error");
      setAuthPanel("signup");
      return;
    }

    const form = new FormData(signupOtpForm);
    const otp = String(form.get("otp") || "").trim();
    if (otp !== pending.otp) {
      showAlert("Incorrect OTP. Please try again.", "error");
      return;
    }

    const account = {
      id: createId(),
      name: pending.name,
      contact: pending.contact,
      contactNormalized: pending.contactNormalized,
      password: pending.password,
      createdAt: new Date().toISOString()
    };

    const accounts = getAccounts();
    accounts.push(account);
    setAccounts(accounts);
    localStorage.removeItem(STORAGE_KEYS.pendingSignup);

    setSession({ userId: account.id, loggedInAt: new Date().toISOString() });
    location.href = "index.html";
  });

  // Cancel signup OTP
  const cancelOtp = document.querySelector("[data-cancel-otp]");
  cancelOtp?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.pendingSignup);
    clearAlert();
    setAuthPanel("signup");
  });

  // FORGOT submit (forgot.html - step 1)
  const forgotForm = document.querySelector('[data-auth="forgot"]');
  forgotForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAlert();

    const form = new FormData(forgotForm);
    const contact = String(form.get("contact") || "").trim();
    const account = findAccountByIdentifier(contact);
    if (!account) {
      showAlert("No account found with that email/phone.", "error");
      return;
    }

    const otp = generateOtp();
    writeStorage(STORAGE_KEYS.pendingForgot, {
      userId: account.id,
      contactNormalized: account.contactNormalized,
      otp,
      createdAt: new Date().toISOString()
    });

    const hint = document.querySelector("[data-forgot-otp-hint]");
    if (hint) hint.textContent = `Demo OTP: ${otp}`;
    setAuthPanel("forgot-reset");
    showAlert("OTP generated (simulated). Enter it below to reset your password.");
  });

  // FORGOT reset submit (forgot.html - step 2)
  const forgotResetForm = document.querySelector('[data-auth="forgot-reset"]');
  forgotResetForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearAlert();

    const pending = readStorage(STORAGE_KEYS.pendingForgot, null);
    if (!pending?.otp || !pending?.userId) {
      showAlert("No pending reset found. Please request a new OTP.", "error");
      setAuthPanel("forgot");
      return;
    }

    const form = new FormData(forgotResetForm);
    const otp = String(form.get("otp") || "").trim();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (otp !== pending.otp) {
      showAlert("Incorrect OTP. Please try again.", "error");
      return;
    }
    if (password.length < 6) {
      showAlert("Password should be at least 6 characters (demo rule).", "error");
      return;
    }
    if (password !== confirm) {
      showAlert("Passwords do not match.", "error");
      return;
    }

    const accounts = getAccounts();
    const idx = accounts.findIndex((a) => a.id === pending.userId);
    if (idx === -1) {
      showAlert("Account no longer exists. Please sign up again.", "error");
      localStorage.removeItem(STORAGE_KEYS.pendingForgot);
      window.setTimeout(() => (location.href = "signup.html"), 900);
      return;
    }

    accounts[idx] = { ...accounts[idx], password };
    setAccounts(accounts);
    localStorage.removeItem(STORAGE_KEYS.pendingForgot);

    showAlert("Password reset successful. You can now login.");
    window.setTimeout(() => (location.href = "login.html"), 900);
  });

  // Cancel forgot reset
  const cancelForgot = document.querySelector("[data-cancel-forgot]");
  cancelForgot?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.pendingForgot);
    clearAlert();
    setAuthPanel("forgot");
  });
}

// ---------- Mobile nav toggle (index.html) ----------
function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const links = document.querySelector("[data-nav-links]");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("is-open");
    toggle.setAttribute("aria-label", links.classList.contains("is-open") ? "Close menu" : "Open menu");
  });

  // Close after clicking a link (mobile)
  $all("a", links).forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("is-open"));
  });
}

// ---------- Theme toggle ----------
function initTheme() {
  // Apply saved theme ASAP
  setTheme(getTheme());
  $all("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      setTheme(next);
    });
  });
}

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  setYear();
  initTheme();
  updateNavAuthState();
  attachLogout();
  initMobileNav();
  initLanding();
  initAuth();
});
