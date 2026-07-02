import { send } from "./_lib.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  send(res, 200, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    appUrl: process.env.APP_URL || "https://www.awahouse.ng",
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  });
}

