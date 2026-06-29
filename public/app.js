const state = {
  csrf: "",
  user: null,
  listings: [],
  dashboard: null,
  filter: "",
};

const $ = (selector) => document.querySelector(selector);
const demoUser = {
  id: 1,
  name: "Femi Adebayo",
  email: "tenant@awahouse.ng",
  role: "tenant",
  nin_verified: 1,
  rent_score: 710,
};
const demoListings = [
  {
    id: 1,
    title: "The Obsidian Suite, Ikoyi",
    location: "Old Ikoyi, Lagos",
    lga: "Eti-Osa",
    priceKobo: 18500000000,
    rentPeriod: "sale",
    beds: 4,
    baths: 5,
    type: "Penthouse",
    description: "Sun-drenched luxury penthouse with registry-confirmed title, secure access, and escrow-supported closing.",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
    titleStatus: "verified",
    registryReference: "LS/LR/IKY/2025/10291",
    escrowEnabled: true,
    rentMonthlyEnabled: false,
    source: "agent",
    agentName: "Amina Johnson",
    agentRating: 4.9,
    association: "AEAN",
    amenities: ["Title verified", "Escrow", "24/7 power", "Secure parking"],
    watched: false,
    reviews: [{ rating: 5, reviewer: "Femi Adebayo", comment: "Clear title documents, fast viewing, and no hidden inspection fee." }],
  },
  {
    id: 2,
    title: "Lekki Phase 1 Serviced Apartment",
    location: "Admiralty Way, Lekki",
    lga: "Eti-Osa",
    priceKobo: 850000000,
    rentPeriod: "yearly",
    beds: 3,
    baths: 3,
    type: "Apartment",
    description: "Bright serviced apartment with verified agent, clean service charge history, and 48-hour escrow hold.",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",
    titleStatus: "verified",
    registryReference: "LS/LR/LEK/2025/44821",
    escrowEnabled: true,
    rentMonthlyEnabled: true,
    source: "agent",
    agentName: "Amina Johnson",
    agentRating: 4.9,
    association: "AEAN",
    amenities: ["Rent Monthly", "Escrow", "Serviced", "Verified agent"],
    watched: true,
    reviews: [],
  },
  {
    id: 3,
    title: "Yaba Direct Landlord Mini Flat",
    location: "Sabo, Yaba",
    lga: "Lagos Mainland",
    priceKobo: 180000000,
    rentPeriod: "yearly",
    beds: 1,
    baths: 1,
    type: "Mini flat",
    description: "Landlord-direct listing with title review pending, ideal for young professionals near the mainland tech corridor.",
    imageUrl: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
    titleStatus: "pending",
    registryReference: "PENDING",
    escrowEnabled: true,
    rentMonthlyEnabled: true,
    source: "landlord",
    agentName: null,
    agentRating: null,
    association: null,
    amenities: ["Landlord direct", "Rent Monthly", "Near transit", "Pending title"],
    watched: false,
    reviews: [],
  },
];
const demoDashboard = { listingCount: 0, enquiries: [], escrows: [], verifications: [], activeRentPlans: 1, rentScore: 710 };

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const headers = { "Accept": "application/json" };
  if (options.body) {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = state.csrf;
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function loadDemoState() {
  state.csrf = "demo";
  state.user = { ...demoUser };
  state.listings = demoListings.map((item) => ({ ...item, amenities: [...item.amenities], reviews: [...(item.reviews || [])] }));
  state.dashboard = { ...demoDashboard };
}

function money(kobo) {
  return `NGN ${Math.round(kobo / 100).toLocaleString()}`;
}

function periodLabel(period) {
  if (period === "sale") return "sale";
  return `/${period === "monthly" ? "mo" : "yr"}`;
}

function titleBadge(status) {
  const label = status === "verified" ? "Title verified" : status === "pending" ? "Title pending" : "Title disputed";
  return `<span class="badge ${status}">${label}</span>`;
}

function filteredListings() {
  if (state.filter === "verified") return state.listings.filter((x) => x.titleStatus === "verified");
  if (state.filter === "monthly") return state.listings.filter((x) => x.rentMonthlyEnabled);
  return state.listings;
}

function renderHeader() {
  if (!state.user) return;
  $("#roleSelect").value = state.user.role;
  $("#welcomeName").textContent = `Welcome home, ${state.user.name.split(" ")[0]}`;
  $("#welcomeMeta").textContent = `${state.user.role} account · ${state.user.nin_verified ? "NIN verified" : "NIN pending"}`;
  $("#rentScore").textContent = state.user.rent_score;
  $("#watchCount").textContent = state.listings.filter((x) => x.watched).length;
  $("#rentPlans").textContent = state.dashboard?.activeRentPlans ?? 0;
}

function renderListings() {
  const host = $("#listings");
  const items = filteredListings();
  host.innerHTML = "";
  if (!items.length) {
    host.innerHTML = `<article class="result-card">No matching verified listings yet. Try another location or Ask Awa.</article>`;
    return;
  }
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "listing-card";
    card.innerHTML = `
      <img src="${item.imageUrl}" alt="">
      <div class="listing-body">
        <div class="listing-top">
          <div>
            <div class="price">${money(item.priceKobo)} ${periodLabel(item.rentPeriod)}</div>
            <button class="title-button" data-detail="${item.id}">${item.title}</button>
          </div>
          <button class="ghost" data-watch="${item.id}" aria-label="Save listing">${item.watched ? "Saved" : "Save"}</button>
        </div>
        <div class="meta">${item.location} · ${item.beds} bed · ${item.baths} bath · ${item.type}</div>
        <div class="badges">
          ${titleBadge(item.titleStatus)}
          ${item.escrowEnabled ? `<span class="badge verified">Escrow</span>` : ""}
          ${item.rentMonthlyEnabled ? `<span class="badge pending">Rent Monthly</span>` : ""}
          <span class="badge">${item.source === "agent" ? "Verified agent" : "Landlord direct"}</span>
        </div>
        <div class="meta">${item.agentName || "Direct landlord"} ${item.agentRating ? `· ${item.agentRating} rating · ${item.association}` : ""}</div>
        <div class="card-actions">
          <button data-detail="${item.id}">View trust file</button>
          <button class="ghost" data-enquire="${item.id}">Request viewing</button>
        </div>
      </div>
    `;
    host.appendChild(card);
  }
}

function renderDetail(listing) {
  const detail = $("#detail");
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="detail-grid">
      <img src="${listing.imageUrl}" alt="">
      <aside class="detail-side">
        <div class="badges">${titleBadge(listing.titleStatus)}<span class="badge verified">Registry ${listing.registryReference}</span></div>
        <h2>${listing.title}</h2>
        <div class="price">${money(listing.priceKobo)} ${periodLabel(listing.rentPeriod)}</div>
        <p>${listing.description}</p>
        <div class="meta">${listing.location} · ${listing.lga} · ${listing.beds} bed · ${listing.baths} bath</div>
        <div class="badges">${listing.amenities.map((x) => `<span class="badge">${x}</span>`).join("")}</div>
        <button data-escrow="${listing.id}">Start escrow</button>
        <button class="ghost" data-enquire="${listing.id}">Request viewing</button>
        <form id="reviewForm" class="stack-form">
          <select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
          <input name="comment" placeholder="Leave a transaction-gated review">
          <button type="submit">Submit review</button>
        </form>
        <section>
          <h3>Verified reviews</h3>
          <div class="activity-list">
            ${(listing.reviews || []).map((r) => `<div class="activity-item"><strong>${r.rating}/5 · ${r.reviewer}</strong><br>${r.comment}</div>`).join("") || `<div class="activity-item">No reviews yet.</div>`}
          </div>
        </section>
      </aside>
    </div>
  `;
  $("#reviewForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/reviews", { method: "POST", body: JSON.stringify({ listingId: listing.id, rating: form.get("rating"), comment: form.get("comment") }) });
    toast("Review submitted");
    await showDetail(listing.id);
  });
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDashboard() {
  const d = state.dashboard || {};
  $("#metricListings").textContent = d.listingCount ?? 0;
  $("#metricScore").textContent = d.rentScore ?? 0;
  $("#metricPlans").textContent = d.activeRentPlans ?? 0;
  $("#metricEscrows").textContent = (d.escrows || []).length;
  $("#leadList").innerHTML = (d.enquiries || []).map((x) => `<div class="activity-item"><strong>${x.lead_name}</strong><br>${x.listing_title}<br><span class="meta">${x.status} · ${x.message}</span></div>`).join("") || `<div class="activity-item">No leads yet.</div>`;
  $("#escrowList").innerHTML = (d.escrows || []).map((x) => `<div class="activity-item"><strong>${x.status}</strong><br>${x.listing_title}<br><span class="meta">${money(x.amount_kobo)} · fee ${money(x.fee_kobo)}</span></div>`).join("") || `<div class="activity-item">No escrow transactions yet.</div>`;
  $("#verificationList").innerHTML = (d.verifications || []).map((x) => `<div class="activity-item"><strong>${x.kind}</strong><br>${x.subject_reference}<br><span class="meta">${x.status}</span></div>`).join("") || `<div class="activity-item">No verification requests yet.</div>`;
}

async function showDetail(id) {
  try {
    const data = await api(`/api/listings/${id}`);
    renderDetail(data.listing);
  } catch {
    renderDetail(state.listings.find((item) => item.id === Number(id)));
  }
}

async function refreshDashboard() {
  const data = await api("/api/dashboard");
  state.dashboard = data.dashboard;
  renderHeader();
  renderDashboard();
}

async function bootstrap() {
  try {
    const data = await api("/api/bootstrap");
    state.csrf = data.csrf;
    state.user = data.user;
    state.listings = data.listings;
    state.dashboard = data.dashboard;
  } catch {
    loadDemoState();
  }
  renderHeader();
  renderListings();
  renderDashboard();
}

document.addEventListener("click", async (event) => {
  const detailId = event.target.closest("[data-detail]")?.dataset.detail;
  const watchId = event.target.closest("[data-watch]")?.dataset.watch;
  const enquireId = event.target.closest("[data-enquire]")?.dataset.enquire;
  const escrowId = event.target.closest("[data-escrow]")?.dataset.escrow;
  try {
    if (detailId) await showDetail(Number(detailId));
    if (watchId) {
      const res = await api("/api/watchlist", { method: "POST", body: JSON.stringify({ listingId: Number(watchId) }) });
      const listing = state.listings.find((x) => x.id === Number(watchId));
      if (listing) listing.watched = res.watched;
      renderHeader();
      renderListings();
      toast(res.watched ? "Saved to watchlist" : "Removed from watchlist");
    }
    if (enquireId) {
      await api("/api/enquiries", { method: "POST", body: JSON.stringify({ listingId: Number(enquireId), message: "I want a viewing and trust breakdown.", preferredTime: "This week" }) });
      await refreshDashboard();
      toast("Viewing request sent");
    }
    if (escrowId) {
      await api("/api/escrow/initiate", { method: "POST", body: JSON.stringify({ listingId: Number(escrowId), idempotencyKey: crypto.randomUUID() }) });
      await refreshDashboard();
      toast("Escrow draft created");
    }
  } catch (error) {
    toast(error.message);
  }
});

$("#searchBtn").addEventListener("click", async () => {
  const q = encodeURIComponent($("#searchInput").value.trim());
  const data = await api(`/api/listings?q=${q}`);
  state.listings = data.listings;
  renderHeader();
  renderListings();
});

document.querySelectorAll(".chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    renderListings();
  });
});

$("#roleSelect").addEventListener("change", async (event) => {
  const data = await api("/api/auth/demo", { method: "POST", body: JSON.stringify({ role: event.target.value }) });
  state.csrf = data.csrf;
  await bootstrap();
  toast(`Switched to ${event.target.value}`);
});

$("#askForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/ask-awa", { method: "POST", body: JSON.stringify({ query: form.get("query") }) });
    $("#askResult").innerHTML = `<div class="result-card"><strong>${data.reply}</strong></div>` + data.listings.map((x) => `<div class="result-card">${x.title}<br><span class="meta">${x.location} · ${money(x.priceKobo)}</span></div>`).join("");
  } catch (error) {
    toast(error.message);
  }
});

$("#listingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.amenities = String(payload.amenities || "").split(",").map((x) => x.trim()).filter(Boolean);
  try {
    await api("/api/listings", { method: "POST", body: JSON.stringify(payload) });
    event.currentTarget.reset();
    await refreshDashboard();
    toast("Listing submitted for review");
  } catch (error) {
    toast(error.message);
  }
});

$("#verificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api("/api/verification", { method: "POST", body: JSON.stringify(payload) });
    event.currentTarget.reset();
    await refreshDashboard();
    toast("Verification request submitted");
  } catch (error) {
    toast(error.message);
  }
});

$("#refreshDashboard").addEventListener("click", refreshDashboard);

bootstrap().catch((error) => toast(error.message));
