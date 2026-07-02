const demoListings = [
  {
    id: "demo-1",
    title: "Eko Atlantic 3-Bed Penthouse",
    location: "Victoria Island, Lagos",
    lga: "Eti-Osa",
    price_kobo: 1200000000,
    rent_period: "yearly",
    bedrooms: 3,
    bathrooms: 4,
    property_type: "Penthouse",
    rating: "4.9",
    agent_name: "Amina J.",
    title_status: "verified",
    tags: ["title", "serviced"],
    image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "demo-2",
    title: "The Ivory 2-Bedroom Suite",
    location: "Lekki Phase 1, Lagos",
    lga: "Eti-Osa",
    price_kobo: 450000000,
    rent_period: "yearly",
    bedrooms: 2,
    bathrooms: 3,
    property_type: "Serviced Apartment",
    rating: "4.7",
    agent_name: "Obinna K.",
    title_status: "verified",
    tags: ["title", "monthly", "serviced"],
    image_url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "demo-3",
    title: "Yaba Direct Landlord Mini Flat",
    location: "Sabo, Yaba",
    lga: "Lagos Mainland",
    price_kobo: 180000000,
    rent_period: "yearly",
    bedrooms: 1,
    bathrooms: 1,
    property_type: "Mini flat",
    rating: "4.6",
    agent_name: "Direct landlord",
    title_status: "pending",
    tags: ["monthly", "direct"],
    image_url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  },
];

const state = {
  config: {},
  token: localStorage.getItem("awahouse_token") || "",
  profile: null,
  listings: [],
  watchlist: new Set(),
  dashboard: null,
  selected: null,
  activeFilter: "all",
  savedDemo: 1,
};

const $ = (selector) => document.querySelector(selector);
const rail = $("#listingRail");
const search = $("#searchInput");
const watchCount = $("#watchCount");

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 3200);
}

function money(kobo) {
  return `NGN ${Math.round(Number(kobo || 0) / 100).toLocaleString("en-NG")}`;
}

function period(periodValue) {
  if (periodValue === "sale") return "";
  return periodValue === "monthly" ? "/mo" : "/yr";
}

async function jsonFetch(url, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function authFetch(path, body) {
  const response = await fetch(`${state.config.supabaseUrl}${path}`, {
    method: "POST",
    headers: {
      apikey: state.config.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Authentication failed");
  return data;
}

function parseOauthHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access_token");
  if (token) {
    state.token = token;
    localStorage.setItem("awahouse_token", token);
    history.replaceState(null, "", location.pathname);
  }
}

function updateIdentity() {
  $("#profileName").textContent = state.profile?.full_name || state.profile?.email || "Guest";
  $("#profileStatus").textContent = state.profile ? `${state.profile.role} · ${state.profile.nin_status || "NIN pending"}` : "Sign in for pilot access";
  $("#authToggle").textContent = state.profile ? state.profile.full_name?.slice(0, 2).toUpperCase() || "AW" : "IN";
  $("#auth-panel").classList.toggle("is-hidden", Boolean(state.profile));
}

function activeRoute() {
  const id = (location.hash || "#explore").replace("#", "");
  const allowed = new Set(["auth-panel", "explore", "property", "escrow", "verification", "list-property", "dashboard"]);
  return allowed.has(id) ? id : "explore";
}

function renderRoute() {
  const id = activeRoute();
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  document.querySelectorAll(".desktop-nav a, .bottom-nav a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
}

function normalizedListings() {
  return (state.listings.length ? state.listings : demoListings).map((item) => ({
    ...item,
    tags: item.tags || [
      item.title_status === "verified" ? "title" : "",
      item.rent_monthly_enabled ? "monthly" : "",
      item.source === "landlord" ? "direct" : "",
      /serviced/i.test(item.property_type || "") ? "serviced" : "",
    ].filter(Boolean),
  }));
}

function renderListings() {
  const q = (search.value || "").toLowerCase();
  const visible = normalizedListings().filter((item) => {
    const matchesFilter = state.activeFilter === "all" || item.tags.includes(state.activeFilter);
    const matchesQuery = !q || `${item.title} ${item.location} ${item.property_type}`.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
  rail.innerHTML = visible.map((item) => {
    const watched = state.watchlist.has(item.id);
    return `
      <article class="listing-card">
        <div class="listing-image">
          <img src="${item.image_url}" alt="${item.title}">
          <span class="status-badge ${item.title_status === "verified" ? "success" : "warn"}">${item.title_status === "verified" ? "TITLE VERIFIED" : "TITLE PENDING"}</span>
          <span class="escrow-mini">ESCROW</span>
        </div>
        <div class="listing-body">
          <span class="price">${money(item.price_kobo)} ${period(item.rent_period)}</span>
          <button class="title-button" type="button" data-open-property="${item.id}">${item.title}</button>
          <div class="meta">${item.location} · ${item.bedrooms} bed · ${item.bathrooms} bath · ${item.property_type}</div>
          <div class="listing-agent">
            <span class="agent-dot">${(item.agent_name || item.owner_name || "A").slice(0, 1)}</span>
            <span>${item.agent_name || item.owner_name || "Awahouse partner"}</span>
            <span class="meta">★ ${item.agent_rating || item.review_rating || item.rating || "4.8"}</span>
          </div>
          <div class="card-actions">
            <button class="secondary save-button" type="button" data-watch="${item.id}">${watched ? "Saved" : "Save"}</button>
            <button class="primary enquire-button" type="button" data-enquire="${item.id}">Enquire</button>
          </div>
        </div>
      </article>
    `;
  }).join("") || `<article class="listing-card"><div class="listing-body"><h3>No matching verified listing yet.</h3><p class="meta">Try Lekki, Ikoyi, Yaba, serviced, or Rent Monthly.</p></div></article>`;
}

function renderProperty(item = normalizedListings()[0], reviews = []) {
  state.selected = item;
  $("#property").innerHTML = `
    <div class="property-hero">
      <img src="${item.image_url}" alt="${item.title}">
      <span class="image-counter">1/12 Images</span>
    </div>
    <div class="property-layout">
      <article class="detail-card">
        <div>
          <p class="overline">Property Detail</p>
          <h2>${item.title}</h2>
          <p class="price">${money(item.price_kobo)} ${period(item.rent_period)}</p>
          <p class="meta">${item.location}</p>
        </div>
        <div class="trust-pills">
          <span class="trust-pill status-badge ${item.title_status === "verified" ? "success" : "warn"}">${item.title_status === "verified" ? "Title Verified" : "Title Pending"}</span>
          <span class="trust-pill status-badge success">Agent/Landlord KYC</span>
          <span class="trust-pill status-badge warn">Manual verification</span>
          <span class="trust-pill">Registry ${item.registry_reference || "Pending"}</span>
        </div>
        <div class="spec-grid">
          <div><b>${item.bedrooms}</b><span class="meta">Bedrooms</span></div>
          <div><b>${item.bathrooms}</b><span class="meta">Bathrooms</span></div>
          <div><b>${item.rent_monthly_enabled ? "Yes" : "No"}</b><span class="meta">Rent Monthly</span></div>
          <div><b>48h</b><span class="meta">Escrow hold</span></div>
        </div>
        <div class="description">
          <h3>Property Description</h3>
          <p>${item.description || "Verified Awahouse property with visible trust trail before payment."}</p>
        </div>
        <form id="reviewForm" class="pilot-form inline-form">
          <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
          <input name="comment" placeholder="Write a transaction-gated review">
          <button class="secondary" type="submit">Write review</button>
        </form>
        <div class="description">
          <h3>Verified Reviews</h3>
          ${(reviews || []).map((review) => `<div class="activity-card"><b>${review.rating}/5 · ${review.reviewer_name}</b><span>${review.comment}</span>${review.response ? `<p>${review.response}</p>` : ""}</div>`).join("") || `<p class="meta">No reviews yet.</p>`}
        </div>
      </article>
      <aside class="booking-card">
        <span class="status-badge success">Awahouse Verified</span>
        <h3>${item.agent_name || item.owner_name || "Awahouse partner"}</h3>
        <p class="meta">${item.association || "Manual approval required"} · ${item.owner_email || "Verified profile"}</p>
        <dl>
          <div><dt class="meta">Viewing window</dt><dd>Saturday morning</dd></div>
          <div><dt class="meta">Escrow eligible</dt><dd>${item.escrow_enabled === false ? "No" : "Yes"}</dd></div>
          <div><dt class="meta">Service charge</dt><dd>Disclosed</dd></div>
        </dl>
        <button class="primary" type="button" data-escrow="${item.id}">Start escrow</button>
        <button class="secondary" type="button" data-enquire="${item.id}">Request viewing</button>
      </aside>
    </div>
  `;
}

function renderDashboard() {
  const approvals = state.dashboard?.approvals || [];
  $("#approvalQueue").innerHTML = approvals.length ? approvals.map((item) => `
    <div class="activity-card">
      <b>${item.entity_type}: ${item.label}</b>
      <span>${item.status}</span>
      <div class="card-actions">
        <button class="primary" data-approve="${item.entity_type}:${item.id}:approved">Approve</button>
        <button class="secondary" data-approve="${item.entity_type}:${item.id}:rejected">Reject</button>
      </div>
    </div>
  `).join("") : `
    <div class="activity-card"><b>Admin queue</b><span>${state.profile?.role === "admin" ? "No pending approvals." : "Admin approvals appear here for admin users."}</span></div>
  `;
}

async function bootstrap() {
  try {
    state.config = await jsonFetch("/api/config");
    parseOauthHash();
    const data = await jsonFetch("/api/app?action=bootstrap");
    state.profile = data.profile;
    state.listings = data.listings || [];
    state.dashboard = data.dashboard;
    state.watchlist = new Set(data.watchlist || []);
  } catch (error) {
    toast(`Demo mode: ${error.message}`);
  }
  updateIdentity();
  renderListings();
  renderProperty();
  renderDashboard();
  renderRoute();
}

async function openProperty(id) {
  const fallback = normalizedListings().find((item) => item.id === id) || normalizedListings()[0];
  if (!id.startsWith("demo")) {
    try {
      const data = await jsonFetch(`/api/app?action=listing&id=${encodeURIComponent(id)}`);
      return renderProperty(data.listing || fallback, data.reviews || []);
    } catch (error) {
      toast(error.message);
    }
  }
  renderProperty(fallback);
}

function requireSignedIn() {
  if (!state.token || !state.profile) {
    location.hash = "auth-panel";
    toast("Please sign in first.");
    return false;
  }
  return true;
}

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    state.activeFilter = button.dataset.filter;
    renderListings();
  });
});

document.addEventListener("click", async (event) => {
  const openId = event.target.dataset.openProperty;
  const watchId = event.target.dataset.watch;
  const enquireId = event.target.dataset.enquire;
  const escrowId = event.target.dataset.escrow;
  const approval = event.target.dataset.approve;
  try {
    if (event.target.id === "authToggle") location.hash = state.profile ? "dashboard" : "auth-panel";
    if (event.target.id === "askAwaTop") {
      search.value = "Lekki escrow monthly";
      state.activeFilter = "monthly";
      document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === "monthly"));
      renderListings();
    }
    if (openId) {
      location.hash = "property";
      await openProperty(openId);
    }
    if (watchId) {
      if (!requireSignedIn()) return;
      if (watchId.startsWith("demo")) {
        state.savedDemo += 1;
        watchCount.textContent = `${state.savedDemo} saved`;
        return toast("Saved locally. Real watchlist works on approved database listings.");
      }
      const data = await jsonFetch("/api/app?action=watchlist", { method: "POST", body: JSON.stringify({ listing_id: watchId }) });
      data.watched ? state.watchlist.add(watchId) : state.watchlist.delete(watchId);
      renderListings();
      toast(data.watched ? "Saved to watchlist" : "Removed from watchlist");
    }
    if (enquireId) {
      if (!requireSignedIn()) return;
      if (enquireId.startsWith("demo")) return toast("Use a real approved listing to submit enquiries.");
      await jsonFetch("/api/app?action=enquiry", { method: "POST", body: JSON.stringify({ listing_id: enquireId, message: "I want a viewing and trust breakdown.", preferred_time: "This week" }) });
      toast("Viewing request sent");
    }
    if (escrowId) {
      if (!requireSignedIn()) return;
      if (escrowId.startsWith("demo")) return toast("Use a real approved listing to start escrow.");
      const data = await jsonFetch("/api/app?action=escrow-init", { method: "POST", body: JSON.stringify({ listing_id: escrowId }) });
      toast("Escrow created. Redirecting to Paystack...");
      if (data.authorization_url) location.href = data.authorization_url;
    }
    if (approval) {
      if (!requireSignedIn()) return;
      const [entity_type, entity_id, status] = approval.split(":");
      await jsonFetch("/api/app?action=admin-approve", { method: "POST", body: JSON.stringify({ entity_type, entity_id, status }) });
      toast(`Marked ${entity_type} ${status}`);
      const data = await jsonFetch("/api/app?action=dashboard");
      state.dashboard = data.dashboard;
      renderDashboard();
    }
  } catch (error) {
    toast(error.message);
  }
});

search.addEventListener("input", renderListings);

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await authFetch("/auth/v1/signup", {
      email: form.email,
      password: form.password,
      data: { full_name: form.full_name, role: form.role },
    });
    if (data.session?.access_token) {
      state.token = data.session.access_token;
      localStorage.setItem("awahouse_token", state.token);
      await jsonFetch("/api/app?action=profile", { method: "POST", body: JSON.stringify({ full_name: form.full_name, role: form.role }) });
      await bootstrap();
      toast("Account created");
    } else {
      toast("Check your email to confirm your account, then sign in.");
    }
  } catch (error) {
    toast(error.message);
  }
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await authFetch("/auth/v1/token?grant_type=password", { email: form.email, password: form.password });
    state.token = data.access_token;
    localStorage.setItem("awahouse_token", state.token);
    await bootstrap();
    toast("Signed in");
  } catch (error) {
    toast(error.message);
  }
});

$("#googleLogin").addEventListener("click", () => {
  const redirect = encodeURIComponent(state.config.appUrl || location.origin);
  location.href = `${state.config.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
});

$("#verificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireSignedIn()) return;
  const body = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await jsonFetch("/api/app?action=verification", { method: "POST", body: JSON.stringify(body) });
    event.currentTarget.reset();
    toast("Verification submitted for admin review");
  } catch (error) {
    toast(error.message);
  }
});

$("#listingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireSignedIn()) return;
  const body = Object.fromEntries(new FormData(event.currentTarget).entries());
  body.amenities = ["Escrow", "Rent Monthly", "Verified profile"];
  body.rent_monthly_enabled = true;
  try {
    await jsonFetch("/api/app?action=listing", { method: "POST", body: JSON.stringify(body) });
    toast("Listing submitted for admin approval");
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "reviewForm") return;
  event.preventDefault();
  if (!requireSignedIn()) return;
  if (!state.selected || String(state.selected.id).startsWith("demo")) return toast("Use a real approved listing to review.");
  const body = Object.fromEntries(new FormData(event.target).entries());
  body.listing_id = state.selected.id;
  try {
    await jsonFetch("/api/app?action=review", { method: "POST", body: JSON.stringify(body) });
    toast("Review submitted");
    await openProperty(state.selected.id);
  } catch (error) {
    toast(error.message);
  }
});

window.addEventListener("hashchange", renderRoute);
bootstrap();
renderRoute();
