-- Biyahe: icons replace emoji. Run once after food-menus.sql. Safe to re-run.
-- `icon` is a key from js/icons.js (burger, chicken, fries, drink, milktea, rice, soup, noodles, dumpling, dessert, coffee, cake, sandwich,
-- egg, oil, water, laundry, pill, vitamin, salts, bandage, sanitizer, mask, food, cart, cross). Leave it empty to let the app pick one from the item name.
alter table public.restaurants add column if not exists icon text;
alter table public.menu_items  add column if not exists icon text;
update public.restaurants set icon = case emoji when '🍔' then 'burger' when '🍲' then 'food' when '☕' then 'coffee' when '🛒' then 'cart' when '💊' then 'cross' end
  where icon is null and emoji is not null;
update public.menu_items set icon = case emoji
  when '🍔' then 'burger' when '🍗' then 'chicken' when '🍟' then 'fries' when '🥤' then 'drink' when '🍛' then 'rice' when '🍲' then 'soup' when '🍜' then 'noodles'
  when '🥟' then 'dumpling' when '🍧' then 'dessert' when '🍚' then 'rice' when '☕' then 'coffee' when '🥛' then 'coffee' when '🧋' then 'milktea' when '🍰' then 'cake'
  when '🥪' then 'sandwich' when '🥚' then 'egg' when '🫒' then 'oil' when '💧' then 'water' when '🧺' then 'laundry' when '💊' then 'pill' when '🍊' then 'vitamin'
  when '🧂' then 'salts' when '🩹' then 'bandage' when '🧴' then 'sanitizer' when '😷' then 'mask' end
  where icon is null and emoji is not null;
