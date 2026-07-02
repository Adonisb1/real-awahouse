import { hmacSha512, handleError, query, readRaw, send } from "./_lib.mjs";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const raw = await readRaw(req);
    const signature = req.headers["x-paystack-signature"];
    if (!process.env.PAYSTACK_SECRET_KEY || hmacSha512(process.env.PAYSTACK_SECRET_KEY, raw) !== signature) {
      return send(res, 401, { error: "Invalid Paystack signature" });
    }
    const event = JSON.parse(raw.toString("utf8"));
    const reference = event?.data?.reference;
    if (event.event === "charge.success" && reference) {
      await query(
        "update public.escrow_transactions set status='paid', updated_at=now() where paystack_reference=$1",
        [reference]
      );
    }
    send(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
}

