// Biyahe icon set: 24x24 outline icons (same look as the drawer icons). Use ico("burger") to get an <svg>.
const ICONS = {
  burger:   '<path d="M4 11a8 6 0 0 1 16 0z"/><path d="M3 14h18"/><path d="M4 17h16v1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18z"/><path d="M9 8h.01M13 7h.01M16 9h.01"/>',
  chicken:  '<circle cx="15" cy="9" r="5.5"/><path d="M11 13l-5 5"/><circle cx="5" cy="19" r="1.6"/><path d="M13 7.5a2.5 2.5 0 0 1 2-1"/>',
  fries:    '<path d="M6 11h12l-1.5 10h-9z"/><path d="M8.5 11V5.5M12 11V3.5M15.5 11V5.5"/>',
  drink:    '<path d="M6 8h12l-1.5 13h-9z"/><path d="M5 8h14"/><path d="M12 8l1.5-5H17"/>',
  milktea:  '<path d="M6 8h12l-1.5 13h-9z"/><path d="M5 8h14"/><path d="M12 8l1.5-5H17"/><path d="M9.5 18h.01M12 17h.01M14.5 18h.01M11 14.5h.01"/>',
  rice:     '<path d="M3 12h18c0 4.5-4 8-9 8s-9-3.5-9-8z"/><path d="M6 12a6 5 0 0 1 12 0"/>',
  soup:     '<path d="M3 12h18c0 4.5-4 8-9 8s-9-3.5-9-8z"/><path d="M9 3c-1.5 1.5 1.5 2.5 0 5M14 3c-1.5 1.5 1.5 2.5 0 5"/>',
  noodles:  '<path d="M3 12h18c0 4.5-4 8-9 8s-9-3.5-9-8z"/><path d="M7 12c0-2 2-2 2-4M11 12c0-2 2-2 2-4"/><path d="M14 10l5-7M16.5 11l4-6"/>',
  dumpling: '<path d="M5 15l9-9 5 5-9 9z"/><path d="M14 6l5 5"/><path d="M5 15l-1.5 1.5M19 11l1.5-1.5"/>',
  dessert:  '<path d="M6 11h12l-1.5 10h-9z"/><path d="M6 11a6 5 0 0 1 12 0"/><path d="M15 5l3-3"/>',
  coffee:   '<path d="M5 10h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 12h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/>',
  cake:     '<path d="M4 20h16v-7H4z"/><path d="M4 13c3 0 3-2 4-2s2 2 4 2 3-2 4-2 2 2 4 2"/><circle cx="12" cy="6.5" r="1.6"/>',
  sandwich: '<path d="M3 12l9-7 9 7"/><path d="M5 12v7h14v-7"/><path d="M5 15.5h14"/>',
  egg:      '<path d="M12 3c4 0 6.5 5 6.5 9a6.5 6.5 0 0 1-13 0c0-4 2.5-9 6.5-9z"/>',
  oil:      '<path d="M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
  water:    '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  laundry:  '<path d="M6 9h12v12H6z"/><path d="M9 3h6v6H9z"/><path d="M6 14h12"/>',
  pill:     '<path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
  vitamin:  '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  salts:    '<path d="M6 4h12v16H6z"/><path d="M6 8h12"/><path d="M12 11v6M9 14h6"/>',
  bandage:  '<path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z"/><path d="M9 11.5h.01M11.5 9h.01M12.5 15h.01M15 12.5h.01"/>',
  sanitizer:'<path d="M8 21V10a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v11z"/><path d="M12 9V5h4"/><path d="M10 14.5h4"/>',
  mask:     '<path d="M3 9c3-2 15-2 18 0v4c0 3-4 5-9 5s-9-2-9-5z"/><path d="M7 12h10M7.5 14.5h9"/>',
  // store types
  food:     '<path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7a2 2 0 0 1-2 2M17 3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5V21"/>',
  cart:     '<path d="M3 4h2l2.5 11h10l2-8H6.5"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  cross:    '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  scooter:  '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h5l-2.5-9H9M14 8h3l1 9"/>',
  bag:      '<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  box:      '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  nav:      '<path d="M4 11l16-7-7 16-2-7z"/>',
  bell:     '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const ico = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.food}</svg>`;

// Pick an icon for a menu item: its own `icon` column, else a guess from its name, else the store type's icon.
const ICON_GUESS = [[/burger/i, "burger"], [/chicken|drumstick/i, "chicken"], [/fries/i, "fries"], [/milk ?tea|pearl|boba/i, "milktea"], [/coffee|latte|americano|espresso|cappuccino/i, "coffee"],
  [/tea|juice|soda|shake|cola|drink/i, "drink"], [/pancit|noodle|pasta|spaghetti/i, "noodles"], [/sinigang|soup|tinola|arroz caldo/i, "soup"], [/rice|adobo|silog/i, "rice"],
  [/lumpia|siomai|dumpling|roll/i, "dumpling"], [/halo|ice cream|dessert|flan|leche/i, "dessert"], [/cake|bread|pastry|donut/i, "cake"], [/sandwich|toast/i, "sandwich"],
  [/egg/i, "egg"], [/oil|vinegar|sauce/i, "oil"], [/water/i, "water"], [/detergent|soap|laundry|tissue/i, "laundry"], [/paracetamol|tablet|tabs|capsule|caps|medicine/i, "pill"],
  [/vitamin/i, "vitamin"], [/rehydration|salts/i, "salts"], [/bandage|plaster/i, "bandage"], [/alcohol|sanitizer/i, "sanitizer"], [/mask/i, "mask"]];
const STORE_ICON = { "Fast food": "burger", "Restaurants": "food", "Cafés & drinks": "coffee", "Groceries": "cart", "Pharmacy": "cross" };
const itemIcon = (m, cat) => m.icon || (ICON_GUESS.find(([re]) => re.test(m.name)) || [])[1] || STORE_ICON[cat] || "food";
