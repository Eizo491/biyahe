// Constants and app state for the customer app.
const VEH = [
  { n: "Motorcycle", d: "Fastest, 1 rider", base: 40, km: 10 },
  { n: "Tricycle", d: "Up to 3 riders", base: 50, km: 12 },
  { n: "Car", d: "Up to 4 riders", base: 80, km: 16 }
];
const SIZES = [
  { n: "Small", d: "Fits in a bag", p: 60 },
  { n: "Medium", d: "Box or groceries", p: 100 },
  { n: "Large", d: "Bulky, two hands", p: 180 }
];
// Payment choices for a ride. The choice is saved on the booking (details.pay) and shown to the customer and the rider.
const PAY = [{ k: "cash", n: "Cash" }, { k: "gcash", n: "GCash" }, { k: "maya", n: "Maya" }, { k: "card", n: "Card" }];
const PAYN = { cash: "Cash", gcash: "GCash", maya: "Maya", card: "Card" };
const payCust = (k, amt) => k === "cash" ? `Payment: Cash. Pay your rider ${peso(amt)} when you arrive.` : `Payment: ${PAYN[k]}. Settle ${peso(amt)} with your rider before the trip ends.`;
const payRider = (k, amt) => !PAYN[k] ? "" : k === "cash" ? `Cash: collect ${peso(amt)} from the customer` : `Customer pays by ${PAYN[k]}. Make sure you received ${peso(amt)} before you finish`;
const STATUS = { searching: "Looking for rider", accepted: "Rider accepted", on_the_way: "On the way", done: "Done", cancelled: "Cancelled" };
const SUB = { ride: "Where to?", food: "What are you craving?", deliver: "What are we sending?", activity: "Your bookings" };

let st = { pay: "cash", veh: 0, size: null, cart: {}, rests: [], open: null, chan: null };
