/* =========================================================
   Kayo Vouchers — Vanilla JS + Firebase Authentication (CDN)
   - Email/Password auth + Email verification
   - No demo accounts, no passwords/OTPs stored in localStorage
   ========================================================= */

// ---------- Small helpers ----------
function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// ---------- Theme (OK to persist client-side) ----------
const THEME_KEY = "kayo_theme";

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
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
  // Used on login/signup/forgot pages (any page using data-auth panels)
  const panels = $all("[data-auth]");
  if (panels.length === 0) return;
  panels.forEach((p) => (p.hidden = p.getAttribute("data-auth") !== name));
}

function mapFirebaseAuthError(error) {
  const code = String(error?.code || "");
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/user-not-found") return "No account found with that email. Please sign up.";
  if (code === "auth/wrong-password") return "Incorrect password. Please try again.";
  if (code === "auth/email-already-in-use") return "That email is already in use. Please login instead.";
  if (code === "auth/weak-password") return "Password is too weak. Use at least 6 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  return error?.message || "Something went wrong. Please try again.";
}

function getUserGreeting(user) {
  if (!user) return "";
  if (user.displayName) return user.displayName.split(" ")[0];
  if (user.email) return user.email;
  if (user.phoneNumber) return user.phoneNumber;
  return "User";
}

// ---------- Firebase email action links (verify/reset) ----------
function getDefaultAuthActionUrl() {
  // Firebase hosts the action handler and then redirects to this URL after completion.
  const origin = window.location.origin;
  if (!origin || origin === "null") return "http://localhost:5500/login.html";
  return `${origin}/login.html`;
}

function getActionCodeSettings() {
  return {
    url: getDefaultAuthActionUrl(),
    handleCodeInApp: false
  };
}

// ---------- Firebase (Auth) ----------
// CHANGE: Paste your Firebase config here (Firebase Console → Project settings → SDK setup and configuration)
// IMPORTANT: Do not put secrets here. This config is safe to be public.
const FIREBASE_CONFIG = {
  // CHANGE: Filled from Firebase Console → Project settings → Your apps → Web app → firebaseConfig
  apiKey: "AIzaSyAy804SRJsOeetR7OHA0owsBuaNnLv4wzU",
  authDomain: "kayo-vouchers.firebaseapp.com",
  projectId: "kayo-vouchers",
  storageBucket: "kayo-vouchers.firebasestorage.app",
  messagingSenderId: "982373120706",
  appId: "1:982373120706:web:52f3eb6bcf5a499cb6195b"
};


let auth = null;
let authReady = false;
let currentUser = null;

function hasFirebaseConfig() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

function initFirebase() {
  if (!hasFirebaseConfig()) {
    // Keep site usable, but auth can’t work until config is filled.
    console.warn("[Firebase] Missing FIREBASE_CONFIG values in script.js");
    authReady = true;
    currentUser = null;
    updateNavAuthState();
    updateProductPricingVisibility();
    return;
  }

  if (!window.firebase?.initializeApp || !window.firebase?.auth) {
    console.error("[Firebase] SDK not found. Ensure firebase-app-compat.js and firebase-auth-compat.js are loaded.");
    authReady = true;
    currentUser = null;
    updateNavAuthState();
    updateProductPricingVisibility();
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();

  // CHANGE: Avoid localStorage persistence for auth; use session persistence instead.
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {
    // If persistence fails, Firebase falls back to its default. We still proceed.
  });

  auth.onAuthStateChanged((user) => {
    authReady = true;
    currentUser = user || null;
    updateNavAuthState();
    updateProductPricingVisibility();

    // Convenience: if already logged in, keep users out of auth pages.
    const path = location.pathname.toLowerCase();
    if (currentUser && (path.endsWith("login.html") || path.endsWith("signup.html") || path.endsWith("forgot.html"))) {
      location.href = "index.html";
    }
  });
}

function isLoggedIn() {
  return Boolean(currentUser);
}

function ensureLogoutButton(navUserEl) {
  if (!navUserEl) return;
  if (navUserEl.querySelector("[data-logout]")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  const inSideMenu = Boolean(navUserEl.closest?.(".side-menu"));
  btn.className = inSideMenu ? "btn btn-ghost btn-block" : "btn btn-ghost btn-sm";
  btn.textContent = "Logout";
  btn.setAttribute("data-logout", "");
  navUserEl.appendChild(btn);
}

function updateNavAuthState() {
  const navUsers = $all("[data-nav-user]");
  const navUserTexts = $all("[data-nav-user-text]");
  const authLinks = $all("[data-auth-link]");

  const loggedIn = isLoggedIn();
  document.documentElement.setAttribute("data-auth-state", loggedIn ? "logged-in" : "logged-out");

  if (loggedIn) {
    navUsers.forEach((el) => (el.hidden = false));
    navUserTexts.forEach((el) => (el.textContent = `Welcome, ${getUserGreeting(currentUser)}`));
    authLinks.forEach((el) => (el.hidden = true));
    navUsers.forEach((el) => ensureLogoutButton(el));
  } else {
    navUsers.forEach((el) => {
      el.hidden = true;
      el.querySelector("[data-logout]")?.remove();
    });
    authLinks.forEach((el) => (el.hidden = false));
  }
}

function attachLogout() {
  // Event delegation so Logout works even when the button is injected dynamically
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("[data-logout]");
    if (!btn) return;

    try {
      if (auth) await auth.signOut();
    } finally {
      // Requirement: redirect to login page after logout
      location.href = "login.html";
    }
  });
}

// ---------- Pricing visibility (auth-gated) ----------
function updateProductPricingVisibility() {
  const priceEls = $all(".price");
  if (priceEls.length === 0) return;

  // While auth is loading, keep prices hidden to prevent flashing protected info.
  if (!authReady) {
    priceEls.forEach((el) => el.classList.remove("is-ready"));
    return;
  }

  const loggedIn = isLoggedIn();
  priceEls.forEach((el) => {
    if (!el.dataset.actualPrice) el.dataset.actualPrice = el.textContent.trim();

    if (loggedIn) {
      el.textContent = el.dataset.actualPrice;
      el.classList.remove("is-locked");
    } else {
      el.textContent = "Login to view price";
      el.classList.add("is-locked");
    }

    el.classList.add("is-ready");
  });
}

// ---------- Landing page: Buy Now ----------
const PRODUCT_CATALOG = {
  bece: { name: "BECE Checker", price: "₵ 15.00" },
  wassce: { name: "WASSCE Checker", price: "₵ 25.00" },
  university: { name: "University Voucher", price: "₵ 200.00" }
};

// ---------- Order modal (index.html) ----------
let activeOrderProductKey = null;
let activeOrderQty = 1;
let activeOrderUnitPriceText = "";

function parsePriceAmount(priceText) {
  const raw = String(priceText || "");
  const amount = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : NaN;
}

function getPriceCurrency(priceText) {
  const raw = String(priceText || "").trim();
  const currency = raw.replace(/[0-9.,\s]/g, "").trim();
  return currency || "";
}

function updateOrderTotal() {
  const totalEl = document.querySelector("[data-order-total]");
  if (!totalEl) return;

  const amount = parsePriceAmount(activeOrderUnitPriceText);
  const currency = getPriceCurrency(activeOrderUnitPriceText);
  if (!Number.isFinite(amount)) {
    totalEl.textContent = "—";
    return;
  }

  const total = amount * activeOrderQty;
  totalEl.textContent = `${currency ? currency + " " : ""}${total.toFixed(2)}`;
}

function setOrderQty(nextQty) {
  activeOrderQty = Math.max(1, Number(nextQty) || 1);
  const qtyEl = document.querySelector("[data-qty-value]");
  if (qtyEl) qtyEl.textContent = String(activeOrderQty);
  updateOrderTotal();
}

function setFieldError(target, message) {
  if (!target) return;
  if (!message) {
    target.hidden = true;
    target.textContent = "";
    return;
  }
  target.hidden = false;
  target.textContent = message;
}

function isValidEmail(email) {
  const v = String(email || "").trim();
  if (!v) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function openOrderModal(productKey) {
  const overlay = document.querySelector("[data-modal-overlay]");
  const form = document.querySelector("[data-order-form]");
  if (!overlay || !form) return;

  const product = PRODUCT_CATALOG[productKey] || { name: "Voucher", price: "" };
  activeOrderProductKey = productKey;
  activeOrderUnitPriceText = product.price || "";
  setOrderQty(1);

  document.querySelector("[data-order-product]")?.replaceChildren(document.createTextNode(product.name));
  document.querySelector("[data-order-price]")?.replaceChildren(document.createTextNode(product.price));
  updateOrderTotal();

  form.reset();
  setFieldError(document.querySelector("[data-error-phone]"), "");
  setFieldError(document.querySelector("[data-error-email]"), "");

  document.body.classList.add("is-modal-open");
  overlay.setAttribute("aria-hidden", "false");
  window.setTimeout(() => document.querySelector("#order-phone")?.focus?.(), 0);
}

function closeOrderModal() {
  const overlay = document.querySelector("[data-modal-overlay]");
  if (!overlay) return;
  document.body.classList.remove("is-modal-open");
  overlay.setAttribute("aria-hidden", "true");
  activeOrderProductKey = null;
  activeOrderUnitPriceText = "";
  setOrderQty(1);
}

function initOrderModal() {
  const overlay = document.querySelector("[data-modal-overlay]");
  const closeBtn = document.querySelector("[data-modal-close]");
  const form = document.querySelector("[data-order-form]");
  if (!overlay || !closeBtn || !form) return;

  document.querySelector("[data-qty-minus]")?.addEventListener("click", () => setOrderQty(activeOrderQty - 1));
  document.querySelector("[data-qty-plus]")?.addEventListener("click", () => setOrderQty(activeOrderQty + 1));

  closeBtn.addEventListener("click", closeOrderModal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOrderModal();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const phone = String(form.phone?.value || "").trim();
    const email = String(form.email?.value || "").trim();

    const phoneErr = document.querySelector("[data-error-phone]");
    const emailErr = document.querySelector("[data-error-email]");

    setFieldError(phoneErr, phone ? "" : "Phone number is required.");
    setFieldError(emailErr, isValidEmail(email) ? "" : "Please enter a valid email address (or leave it blank).");

    if (!phone) return;
    if (!isValidEmail(email)) return;

    const product = PRODUCT_CATALOG[activeOrderProductKey] || { name: "Voucher", price: "" };
    const summary = `Order: ${product.name} x${activeOrderQty} (${product.price} each).`;
    const contact = email ? ` We will contact you at ${phone} / ${email}.` : ` We will contact you at ${phone}.`;

    showToast(summary + contact);
    closeOrderModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("is-modal-open")) closeOrderModal();
  });
}

function handleBuy(productKey) {
  const product = PRODUCT_CATALOG[productKey] || { name: "Voucher", price: "" };
  if (!isLoggedIn()) {
    showToast("Please login to continue. Redirecting…");
    window.setTimeout(() => (location.href = "login.html"), 700);
    return;
  }

  openOrderModal(productKey);
}

function initLanding() {
  // Hero CTA (Buy Now / Get Started)
  $all('[data-action="get-started"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isLoggedIn()) {
        showToast("Create an account to continue. Redirecting…");
        window.setTimeout(() => (location.href = "signup.html"), 700);
        return;
      }
      // NEW: Open order modal (default product) when logged in.
      openOrderModal("bece");
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

// ---------- Auth pages (Firebase) ----------
function wireAuthSwitchButtons() {
  // Buttons like: <button data-auth-switch="login-email">Email</button>
  $all("[data-auth-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.getAttribute("data-auth-switch");
      if (!panel) return;
      clearAlert();
      setAuthPanel(panel);
    });
  });
}

function initAuthPages() {
  const hasPanels = document.querySelector("[data-auth]");
  if (!hasPanels) return;

  wireAuthSwitchButtons();

  // ---------- LOGIN: Email ----------
  const loginEmailForm = document.querySelector('[data-auth="login-email"]');
  loginEmailForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    if (!auth) return showAlert("Auth is not configured yet. Add Firebase config in script.js.", "error");

    const form = new FormData(loginEmailForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const user = cred.user;
      if (user && !user.emailVerified) {
        await user.sendEmailVerification(getActionCodeSettings());
        await auth.signOut();
        showAlert("Email not verified. We resent a verification email — please verify before logging in.", "error");
        return;
      }
      location.href = "index.html";
    } catch (err) {
      showAlert(mapFirebaseAuthError(err), "error");
    }
  });

  // ---------- SIGNUP: Email ----------
  const signupEmailForm = document.querySelector('[data-auth="signup-email"]');
  signupEmailForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    if (!auth) return showAlert("Auth is not configured yet. Add Firebase config in script.js.", "error");

    const form = new FormData(signupEmailForm);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) return showAlert("Passwords do not match.", "error");

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;
      if (user && name) await user.updateProfile({ displayName: name });
      if (user) await user.sendEmailVerification(getActionCodeSettings());
      await auth.signOut();

      showAlert("Check your email to verify your account, then come back to login.");
      setAuthPanel("signup-email-verify");
    } catch (err) {
      showAlert(mapFirebaseAuthError(err), "error");
    }
  });

  // ---------- FORGOT PASSWORD (Email) ----------
  const forgotForm = document.querySelector('[data-auth="forgot-email"]');
  forgotForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    if (!auth) return showAlert("Auth is not configured yet. Add Firebase config in script.js.", "error");

    const form = new FormData(forgotForm);
    const email = String(form.get("email") || "").trim();

    try {
      await auth.sendPasswordResetEmail(email, getActionCodeSettings());
      showAlert("Password reset email sent. Check your inbox.");
    } catch (err) {
      showAlert(mapFirebaseAuthError(err), "error");
    }
  });
}

// ---------- Mobile nav toggle (index.html) ----------
function initMobileNav() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const overlay = document.querySelector("[data-menu-overlay]");
  const menu = document.querySelector("[data-side-menu]");
  const closeBtn = document.querySelector("[data-menu-close]");
  if (!toggle || !overlay || !menu) return;

  const openMenu = () => {
    document.body.classList.add("is-menu-open");
    overlay.setAttribute("aria-hidden", "false");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  };

  const closeMenu = () => {
    document.body.classList.remove("is-menu-open");
    overlay.setAttribute("aria-hidden", "true");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  };

  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("is-menu-open")) closeMenu();
    else openMenu();
  });

  closeBtn?.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  // Close after clicking a link in the menu
  $all("[data-menu-link]", menu).forEach((a) => a.addEventListener("click", closeMenu));

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("is-menu-open")) closeMenu();
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

  // Firebase must be initialized BEFORE wiring auth UI.
  initFirebase();
  updateNavAuthState();
  attachLogout();

  initMobileNav();
  initLanding();
  initOrderModal();
  initAuthPages();
});
