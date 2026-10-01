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
const STATUS = { searching: "Looking for rider", accepted: "Rider accepted", on_the_way: "On the way", done: "Done", cancelled: "Cancelled" };
const SUB = { ride: "Where to?", food: "What are you craving?", deliver: "What are we sending?", activity: "Your bookings" };

let st = { veh: 0, size: null, cart: {}, rests: [], open: null, chan: null };
