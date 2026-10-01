// Supabase Edge Function "push": sends phone notifications when a booking is created or changes.
// Deploy:   supabase functions deploy push --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com PUSH_SECRET=<same as in push.sql>
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

type B = Record<string, any>;
const key = (b: B) => `${b.status}|${b.details?.stage ?? ""}`;

// What the customer hears about when their booking changes.
function forCustomer(n: B): [string, string] | null {
  const food = n.type === "food", rn = n.details?.restaurant?.name ?? "the store", stage = n.details?.stage;
  if (n.status === "cancelled") return ["Booking cancelled", food ? `Your order from ${rn} was cancelled.` : "Your booking was cancelled."];
  if (n.status === "done") return [food ? "Order delivered" : "Trip completed", "Thanks for using Biyahe."];
  if (n.status === "on_the_way") return [food ? "Order picked up" : "Trip started", food ? "Your rider is on the way to you." : "Enjoy your ride."];
  if (n.status === "accepted" && stage === "at_rest") return ["Rider at the restaurant", `Your rider is collecting your order at ${rn}.`];
  if (n.status === "accepted") return ["Rider accepted", food ? `Your rider is heading to ${rn}.` : "Your rider is on the way."];
  return null;
}

async function send(rows: B[] | null, title: string, body: string, tag: string) {
  const payload = JSON.stringify({ title, body, tag, url: "index.html" });
  await Promise.all((rows ?? []).map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); }
    catch (e) { if ([404, 410].includes((e as B).statusCode)) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
  }));
}

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { type, record: n, old_record: o } = await req.json();
  if (!n) return new Response("ok");
  const subs = (q: string, v: string) => sb.from("push_subscriptions").select("*").eq(q, v).then((r) => r.data);

  if (type === "INSERT" && n.status === "searching") {   // a new job: tell every rider who turned phone alerts on
    const food = n.type === "food", from = food && n.details?.restaurant ? `${n.details.restaurant.name} → ` : "";
    await send(await subs("role", "rider"), "New job available", `${n.type} · ₱${Math.round(n.amount)} · ${from}${n.dropoff ?? ""}`, "job-" + n.id);
  } else if (type === "UPDATE" && o && key(o) !== key(n)) {
    if (n.status === "cancelled" && n.rider_id) await send(await subs("user_id", n.rider_id), "Job cancelled", `The customer cancelled: ${n.details?.summary ?? n.dropoff ?? "a booking"}.`, "job-" + n.id);
    const m = forCustomer(n), customer = n.user_id ?? n.customer_id;
    if (m && customer) await send(await subs("user_id", customer), m[0], m[1], "order-" + n.id);
  }
  return new Response("ok");
});
