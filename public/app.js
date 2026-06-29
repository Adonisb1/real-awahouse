const listings = [
  {
    id: 1,
    title: "Eko Atlantic 3-Bed Penthouse",
    location: "Victoria Island, Lagos",
    price: "NGN 12,000,000 /yr",
    beds: 3,
    baths: 4,
    type: "Penthouse",
    rating: "4.9",
    agent: "Amina J.",
    status: "TITLE VERIFIED",
    tags: ["title", "serviced"],
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 2,
    title: "The Ivory 2-Bedroom Suite",
    location: "Lekki Phase 1, Lagos",
    price: "NGN 4,500,000 /yr",
    beds: 2,
    baths: 3,
    type: "Serviced Apartment",
    rating: "4.7",
    agent: "Obinna K.",
    status: "TITLE VERIFIED",
    tags: ["title", "monthly", "serviced"],
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    title: "Yaba Direct Landlord Mini Flat",
    location: "Sabo, Yaba",
    price: "NGN 1,800,000 /yr",
    beds: 1,
    baths: 1,
    type: "Mini flat",
    rating: "4.6",
    agent: "Direct landlord",
    status: "TITLE PENDING",
    tags: ["monthly", "direct"],
    image: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 4,
    title: "Oniru Waterfront 2-Bed",
    location: "Oniru, Victoria Island",
    price: "NGN 6,200,000 /yr",
    beds: 2,
    baths: 2,
    type: "Waterfront Apartment",
    rating: "4.8",
    agent: "Amina J.",
    status: "TITLE VERIFIED",
    tags: ["title"],
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
];

const rail = document.querySelector("#listingRail");
const search = document.querySelector("#searchInput");
const watchCount = document.querySelector("#watchCount");
let saved = 1;
let activeFilter = "all";

function renderListings() {
  const q = (search.value || "").toLowerCase();
  const visible = listings.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.tags.includes(activeFilter);
    const matchesQuery = !q || `${item.title} ${item.location} ${item.type}`.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
  rail.innerHTML = visible.map((item) => `
    <article class="listing-card">
      <div class="listing-image">
        <img src="${item.image}" alt="${item.title}">
        <span class="status-badge ${item.status.includes("VERIFIED") ? "success" : "warn"}">${item.status}</span>
        <span class="escrow-mini">ESCROW</span>
      </div>
      <div class="listing-body">
        <span class="price">${item.price}</span>
        <button class="title-button" type="button" data-open-property>${item.title}</button>
        <div class="meta">${item.location} · ${item.beds} bed · ${item.baths} bath · ${item.type}</div>
        <div class="listing-agent">
          <span class="agent-dot">${item.agent.slice(0, 1)}</span>
          <span>${item.agent}</span>
          <span class="meta">★ ${item.rating}</span>
          <button class="secondary save-button" type="button">Save</button>
        </div>
      </div>
    </article>
  `).join("") || `<article class="listing-card"><div class="listing-body"><h3>No matching verified listing yet.</h3><p class="meta">Try Lekki, Ikoyi, Yaba, serviced, or Rent Monthly.</p></div></article>`;
}

function renderProperty() {
  document.querySelector("#property").innerHTML = `
    <div class="property-hero">
      <img src="https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80" alt="The Obsidian Suite, Ikoyi">
      <span class="image-counter">1/12 Images</span>
    </div>
    <div class="property-layout">
      <article class="detail-card">
        <div>
          <p class="overline">Property Detail</p>
          <h2>The Obsidian Suite, Ikoyi</h2>
          <p class="price">NGN 185,000,000</p>
          <p class="meta">Old Ikoyi, Lagos, Nigeria</p>
        </div>
        <div class="trust-pills">
          <span class="trust-pill status-badge success">Title Verified</span>
          <span class="trust-pill status-badge success">Agent Verified · LASRERA</span>
          <span class="trust-pill status-badge warn">SCUML checked</span>
          <span class="trust-pill">Registry LS/LR/IKY/2025/10291</span>
        </div>
        <div class="spec-grid">
          <div><b>4</b><span class="meta">En-suite beds</span></div>
          <div><b>5.5</b><span class="meta">Bathrooms</span></div>
          <div><b>420</b><span class="meta">sqm area</span></div>
          <div><b>48h</b><span class="meta">Escrow hold</span></div>
        </div>
        <div class="description">
          <h3>Property Description</h3>
          <p>Experience the zenith of Lagos luxury in this meticulously crafted suite. The residence blends modern Nigerian heritage, custom mahogany joinery, imported marble, smart-home controls, and a verified trust trail before payment.</p>
        </div>
        <div class="description">
          <h3>Premium Amenities</h3>
          <p>24/7 power, secure parking, water treatment, private elevator, estate security, lagoon views, facility management, and escrow-backed closing.</p>
        </div>
      </article>
      <aside class="booking-card">
        <span class="status-badge success">Awahouse Verified</span>
        <h3>Amina Johnson</h3>
        <p class="meta">AEAN · LASRERA/BRK/24/00831 · 43 verified deals · 4.9 rating</p>
        <dl>
          <div><dt class="meta">Viewing window</dt><dd>Saturday morning</dd></div>
          <div><dt class="meta">Escrow eligible</dt><dd>Yes</dd></div>
          <div><dt class="meta">Service charge</dt><dd>Disclosed</dd></div>
        </dl>
        <a class="primary" href="#escrow">Start escrow</a>
        <a class="secondary" href="#verification">View verification center</a>
      </aside>
    </div>
  `;
}

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderListings();
  });
});

document.addEventListener("click", (event) => {
  if (event.target.matches("[data-open-property]")) {
    location.hash = "property";
  }
  if (event.target.matches(".save-button")) {
    saved += 1;
    watchCount.textContent = `${saved} saved`;
    event.target.textContent = "Saved";
  }
  if (event.target.id === "askAwaTop") {
    search.value = "Lekki escrow monthly";
    activeFilter = "monthly";
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === "monthly"));
    renderListings();
  }
});

search.addEventListener("input", renderListings);
renderListings();
renderProperty();
