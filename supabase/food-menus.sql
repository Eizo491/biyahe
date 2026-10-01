-- Biyahe: richer menus (sections, descriptions, emoji) + sample stores. Works on its own (also adds the food-tracking columns). Safe to re-run.
alter table public.restaurants
  add column if not exists category text, add column if not exists lat double precision, add column if not exists lng double precision,
  add column if not exists emoji text;
alter table public.menu_items add column if not exists section text, add column if not exists description text, add column if not exists emoji text;

-- Sample stores near San Jose, Occidental Mindoro. Edit names, prices and lat/lng to your real partners.
-- Assumes menu_items.restaurant_id points to restaurants.id.
do $$
declare rid uuid;
begin
  if not exists (select 1 from public.restaurants where name = 'Jolly Bite') then
    insert into public.restaurants (name, cuisine, eta_minutes, category, emoji, lat, lng) values ('Jolly Bite', 'Burgers & chicken', 20, 'Fast food', '🍔', 12.3541, 121.0689) returning id into rid;
    insert into public.menu_items (restaurant_id, name, price, section, description, emoji) values
      (rid, 'Cheesy Burger', 79, 'Burgers', 'Beef patty, cheese, house sauce', '🍔'),
      (rid, 'Double Burger', 129, 'Burgers', 'Two patties, double cheese', '🍔'),
      (rid, 'Fried Chicken 1pc', 89, 'Chicken', 'Crispy, with rice', '🍗'),
      (rid, 'Fried Chicken 2pc', 159, 'Chicken', 'Crispy, with rice', '🍗'),
      (rid, 'Fries (M)', 55, 'Sides & drinks', 'Salted, crispy', '🍟'),
      (rid, 'Iced Tea', 35, 'Sides & drinks', 'Cold, refillable size', '🥤');
  end if;
  if not exists (select 1 from public.restaurants where name = 'Lola''s Kitchen') then
    insert into public.restaurants (name, cuisine, eta_minutes, category, emoji, lat, lng) values ('Lola''s Kitchen', 'Filipino home cooking', 30, 'Restaurants', '🍲', 12.3502, 121.0651) returning id into rid;
    insert into public.menu_items (restaurant_id, name, price, section, description, emoji) values
      (rid, 'Chicken Adobo + Rice', 120, 'Meals', 'Soy-vinegar braised chicken', '🍛'),
      (rid, 'Pork Sinigang + Rice', 140, 'Meals', 'Sour tamarind soup with veggies', '🍲'),
      (rid, 'Pancit Canton', 95, 'Meals', 'Stir-fried noodles, good for 2', '🍜'),
      (rid, 'Lumpiang Shanghai (8pc)', 80, 'Starters', 'Crispy pork spring rolls', '🥟'),
      (rid, 'Halo-halo', 75, 'Desserts', 'Shaved ice, sweet beans, leche flan', '🍧'),
      (rid, 'Extra Rice', 20, 'Desserts', '', '🍚');
  end if;
  if not exists (select 1 from public.restaurants where name = 'Kape Kubo') then
    insert into public.restaurants (name, cuisine, eta_minutes, category, emoji, lat, lng) values ('Kape Kubo', 'Coffee, milk tea & snacks', 15, 'Cafés & drinks', '☕', 12.3560, 121.0662) returning id into rid;
    insert into public.menu_items (restaurant_id, name, price, section, description, emoji) values
      (rid, 'Iced Americano', 85, 'Coffee', '16oz, double shot', '☕'),
      (rid, 'Caramel Latte', 110, 'Coffee', 'Iced or hot, 16oz', '🥛'),
      (rid, 'Classic Milk Tea', 75, 'Milk tea', 'Pearls, 50% sugar default', '🧋'),
      (rid, 'Wintermelon Milk Tea', 80, 'Milk tea', 'Pearls, 50% sugar default', '🧋'),
      (rid, 'Banana Cake Slice', 65, 'Snacks', 'Moist, baked daily', '🍰'),
      (rid, 'Ham & Cheese Sandwich', 90, 'Snacks', 'Toasted', '🥪');
  end if;
  if not exists (select 1 from public.restaurants where name = 'Mindoro Fresh Mart') then
    insert into public.restaurants (name, cuisine, eta_minutes, category, emoji, lat, lng) values ('Mindoro Fresh Mart', 'Groceries & essentials', 30, 'Groceries', '🛒', 12.3515, 121.0710) returning id into rid;
    insert into public.menu_items (restaurant_id, name, price, section, description, emoji) values
      (rid, 'Eggs (dozen)', 120, 'Fresh', 'Medium size', '🥚'),
      (rid, 'Rice 5kg', 285, 'Pantry', 'Well-milled', '🍚'),
      (rid, 'Cooking Oil 1L', 105, 'Pantry', '', '🫒'),
      (rid, 'Instant Noodles (6pk)', 78, 'Pantry', 'Assorted flavors', '🍜'),
      (rid, 'Bottled Water 1L (6pk)', 90, 'Drinks', '', '💧'),
      (rid, 'Laundry Detergent 1kg', 135, 'Household', '', '🧺');
  end if;
  if not exists (select 1 from public.restaurants where name = 'Botica Bayan') then
    insert into public.restaurants (name, cuisine, eta_minutes, category, emoji, lat, lng) values ('Botica Bayan', 'Pharmacy & health', 25, 'Pharmacy', '💊', 12.3533, 121.0640) returning id into rid;
    insert into public.menu_items (restaurant_id, name, price, section, description, emoji) values
      (rid, 'Paracetamol 500mg (10 tabs)', 30, 'Over the counter', 'For fever and mild pain', '💊'),
      (rid, 'Vitamin C 500mg (10 caps)', 55, 'Vitamins', '', '🍊'),
      (rid, 'Oral Rehydration Salts (5pk)', 45, 'Over the counter', '', '🧂'),
      (rid, 'Adhesive Bandages (20pc)', 40, 'First aid', '', '🩹'),
      (rid, 'Alcohol 70% 250ml', 65, 'First aid', '', '🧴'),
      (rid, 'Face Masks (10pc)', 50, 'First aid', '', '😷');
  end if;
end $$;
