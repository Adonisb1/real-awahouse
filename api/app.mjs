import { audit, clean, ensureProfile, handleError, migrate, moneyKobo, newReference, query, readJson, requireAdmin, requireUser, send } from "./_lib.mjs";

function listingSelect() {
  return `select l.*, p.full_name owner_name, p.email owner_email, ap.display_name agent_name, ap.rating agent_rating, ap.association,
    coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.listing_id = l.id), 0) review_rating
    from public.listings l
    join public.profiles p on p.id = l.owner_id
    left join public.agent_profiles ap on ap.id = l.agent_profile_id`;
}

async function publicListings(params) {
  const q = `%${String(params.get("q") || "").trim()}%`;
  const status = params.get("status") || "approved";
  const values = [status];
  let where = "where l.approval_status = $1";
  if ((params.get("q") || "").trim()) {
    values.push(q);
    where += ` and (l.title ilike $2 or l.location ilike $2 or l.lga ilike $2 or l.property_type ilike $2)`;
  }
  const result = await query(`${listingSelect()} ${where} order by l.created_at desc limit 50`, values);
  return result.rows;
}

async function dashboard(profile) {
  const listings = await query("select * from public.listings where owner_id = $1 order by created_at desc limit 20", [profile.id]);
  const enquiries = await query(
    `select e.*, l.title listing_title, p.full_name tenant_name
     from public.enquiries e
     join public.listings l on l.id = e.listing_id
     join public.profiles p on p.id = e.tenant_id
     where l.owner_id = $1 or $2 = 'admin'
     order by e.created_at desc limit 30`,
    [profile.id, profile.role]
  );
  const approvals = profile.role === "admin"
    ? await query(
      `select 'listing' entity_type, id, title label, approval_status status, created_at from public.listings where approval_status = 'pending_review'
       union all
       select 'verification' entity_type, id, kind || ': ' || subject_reference label, status, created_at from public.verification_requests where status = 'pending_review'
       order by created_at desc limit 30`
    )
    : { rows: [] };
  const escrows = await query(
    `select et.*, l.title listing_title from public.escrow_transactions et join public.listings l on l.id = et.listing_id
     where et.tenant_id = $1 or et.owner_id = $1 or $2 = 'admin'
     order by et.created_at desc limit 20`,
    [profile.id, profile.role]
  );
  return { listings: listings.rows, enquiries: enquiries.rows, approvals: approvals.rows, escrows: escrows.rows };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const action = url.searchParams.get("action") || "bootstrap";

    if (req.method === "GET" && action === "bootstrap") {
      let profile = null;
      try { profile = await requireUser(req); } catch {}
      let listings;
      try {
        listings = await publicListings(url.searchParams);
      } catch (error) {
        if (error.code !== "42P01" && error.code !== "42704") throw error;
        await migrate();
        listings = await publicListings(url.searchParams);
      }
      const dash = profile ? await dashboard(profile) : null;
      const watch = profile ? await query("select listing_id from public.watchlists where user_id = $1", [profile.id]) : { rows: [] };
      return send(res, 200, { profile, listings, dashboard: dash, watchlist: watch.rows.map((row) => row.listing_id) });
    }

    if (req.method === "GET" && action === "listing") {
      const id = clean(url.searchParams.get("id"), 80, "Listing id");
      const result = await query(`${listingSelect()} where l.id = $1`, [id]);
      const reviews = await query(
        `select r.*, reviewer.full_name reviewer_name, reviewee.full_name reviewee_name
         from public.reviews r
         join public.profiles reviewer on reviewer.id = r.reviewer_id
         join public.profiles reviewee on reviewee.id = r.reviewee_id
         where r.listing_id = $1 order by r.created_at desc`,
        [id]
      );
      return send(res, 200, { listing: result.rows[0] || null, reviews: reviews.rows });
    }

    if (req.method === "GET" && action === "dashboard") {
      const profile = await requireUser(req);
      return send(res, 200, { profile, dashboard: await dashboard(profile) });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const body = await readJson(req);

    if (action === "profile") {
      const authProfile = await requireUser(req);
      const profile = await ensureProfile({ id: authProfile.id, email: authProfile.email }, {
        full_name: clean(body.full_name || authProfile.full_name, 120, "Full name"),
        role: ["tenant", "agent", "landlord"].includes(body.role) ? body.role : authProfile.role,
        phone: body.phone ? clean(body.phone, 40, "Phone") : null,
      });
      return send(res, 200, { profile });
    }

    const profile = await requireUser(req);

    if (action === "agent-profile") {
      const result = await query(
        `insert into public.agent_profiles (user_id, display_name, lasrera_number, scuml_number, association, neighbourhoods, bio)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (user_id) do update set display_name=$2, lasrera_number=$3, scuml_number=$4, association=$5, neighbourhoods=$6, bio=$7, approval_status='pending_review'
         returning *`,
        [
          profile.id,
          clean(body.display_name || profile.full_name, 120, "Display name"),
          body.lasrera_number || null,
          body.scuml_number || null,
          body.association || null,
          body.neighbourhoods || [],
          clean(body.bio || "Awahouse verified partner application.", 500, "Bio"),
        ]
      );
      return send(res, 200, { agent_profile: result.rows[0] });
    }

    if (action === "listing") {
      if (!["agent", "landlord", "admin"].includes(profile.role)) return send(res, 403, { error: "Only agents and landlords can list property" });
      const agent = await query("select id from public.agent_profiles where user_id = $1", [profile.id]);
      const result = await query(
        `insert into public.listings (owner_id, agent_profile_id, title, location, lga, price_kobo, rent_period, bedrooms, bathrooms, property_type, description, amenities, image_url, source, rent_monthly_enabled)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         returning *`,
        [
          profile.id,
          agent.rows[0]?.id || null,
          clean(body.title, 140, "Title"),
          clean(body.location, 140, "Location"),
          clean(body.lga, 80, "LGA"),
          moneyKobo(body.price),
          ["monthly", "yearly", "sale"].includes(body.rent_period) ? body.rent_period : "yearly",
          Number(body.bedrooms || 0),
          Number(body.bathrooms || 0),
          clean(body.property_type, 60, "Property type"),
          clean(body.description, 1200, "Description"),
          Array.isArray(body.amenities) ? body.amenities.slice(0, 16) : [],
          body.image_url || undefined,
          agent.rows[0]?.id ? "agent" : "landlord",
          Boolean(body.rent_monthly_enabled),
        ]
      );
      return send(res, 200, { listing: result.rows[0] });
    }

    if (action === "watchlist") {
      const listingId = clean(body.listing_id, 80, "Listing id");
      const exists = await query("select 1 from public.watchlists where user_id=$1 and listing_id=$2", [profile.id, listingId]);
      if (exists.rows.length) await query("delete from public.watchlists where user_id=$1 and listing_id=$2", [profile.id, listingId]);
      else await query("insert into public.watchlists (user_id, listing_id) values ($1,$2)", [profile.id, listingId]);
      return send(res, 200, { watched: !exists.rows.length });
    }

    if (action === "enquiry") {
      const listingId = clean(body.listing_id, 80, "Listing id");
      const result = await query(
        "insert into public.enquiries (listing_id, tenant_id, message, preferred_time) values ($1,$2,$3,$4) returning *",
        [listingId, profile.id, clean(body.message, 600, "Message"), body.preferred_time || null]
      );
      return send(res, 200, { enquiry: result.rows[0] });
    }

    if (action === "verification") {
      const kind = clean(body.kind, 40, "Verification type");
      if (!["nin", "lasrera", "scuml", "title", "landlord_direct"].includes(kind)) return send(res, 400, { error: "Invalid verification type" });
      let reference = clean(body.reference, 140, "Reference");
      if (kind === "nin") reference = `NIN-****${reference.slice(-4)}`;
      const result = await query(
        `insert into public.verification_requests (user_id, listing_id, kind, subject_reference, consent_text)
         values ($1,$2,$3,$4,$5) returning *`,
        [profile.id, body.listing_id || null, kind, reference, "User consents to Awahouse processing verification data for trust and safety under NDPR principles."]
      );
      return send(res, 200, { verification: result.rows[0] });
    }

    if (action === "review") {
      const listingId = clean(body.listing_id, 80, "Listing id");
      const listing = await query("select owner_id from public.listings where id=$1", [listingId]);
      if (!listing.rows[0]) return send(res, 404, { error: "Listing not found" });
      const result = await query(
        "insert into public.reviews (listing_id, reviewer_id, reviewee_id, rating, comment) values ($1,$2,$3,$4,$5) returning *",
        [listingId, profile.id, listing.rows[0].owner_id, Math.max(1, Math.min(5, Number(body.rating || 5))), clean(body.comment, 600, "Review")]
      );
      return send(res, 200, { review: result.rows[0] });
    }

    if (action === "review-response") {
      const reviewId = clean(body.review_id, 80, "Review id");
      const result = await query(
        `update public.reviews r set response=$1, response_at=now()
         from public.listings l
         where r.id=$2 and r.listing_id=l.id and (l.owner_id=$3 or $4='admin') returning r.*`,
        [clean(body.response, 600, "Response"), reviewId, profile.id, profile.role]
      );
      return send(res, 200, { review: result.rows[0] });
    }

    if (action === "escrow-init") {
      const listingId = clean(body.listing_id, 80, "Listing id");
      const listing = await query("select * from public.listings where id=$1 and escrow_enabled=true", [listingId]);
      if (!listing.rows[0]) return send(res, 404, { error: "Escrow is not available for this listing" });
      const amount = Number(body.amount_kobo || listing.rows[0].price_kobo);
      const fee = Math.floor(amount * 0.03);
      const reference = newReference("AWA_ESCROW");
      let paystack = {};
      if (process.env.PAYSTACK_SECRET_KEY) {
        const response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: profile.email,
            amount: amount + fee,
            reference,
            callback_url: `${process.env.APP_URL || "https://www.awahouse.ng"}/#escrow-receipt`,
            metadata: { listing_id: listingId, tenant_id: profile.id, owner_id: listing.rows[0].owner_id },
          }),
        });
        const data = await response.json();
        if (!response.ok) return send(res, 502, { error: data.message || "Paystack initialization failed" });
        paystack = data.data || {};
      }
      const result = await query(
        `insert into public.escrow_transactions (listing_id, tenant_id, owner_id, amount_kobo, fee_kobo, status, paystack_reference, paystack_access_code, paystack_authorization_url, idempotency_key)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [listingId, profile.id, listing.rows[0].owner_id, amount, fee, "awaiting_payment", reference, paystack.access_code || null, paystack.authorization_url || null, body.idempotency_key || reference]
      );
      return send(res, 200, { escrow: result.rows[0], authorization_url: paystack.authorization_url || null });
    }

    if (action === "admin-approve") {
      const admin = await requireAdmin(req);
      const entity = clean(body.entity_type, 40, "Entity type");
      const id = clean(body.entity_id, 80, "Entity id");
      const status = body.status === "rejected" ? "rejected" : "approved";
      let table;
      if (entity === "listing") table = "public.listings";
      else if (entity === "agent") table = "public.agent_profiles";
      else if (entity === "verification") table = "public.verification_requests";
      else return send(res, 400, { error: "Invalid entity type" });
      const result = await query(`update ${table} set ${entity === "verification" ? "status" : "approval_status"}=$1 where id=$2 returning *`, [status, id]);
      await audit(admin.id, `${entity}_${status}`, entity, id, { note: body.note || null });
      return send(res, 200, { item: result.rows[0] });
    }

    return send(res, 404, { error: "Unknown action" });
  } catch (error) {
    handleError(res, error);
  }
}
