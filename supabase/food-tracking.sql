-- Biyahe: food categories + restaurant map positions for live order tracking. Safe to re-run.
alter table public.restaurants
  add column if not exists category text,   -- 'Fast food' | 'Restaurants' | 'Cafés & drinks' (guessed from cuisine if empty)
  add column if not exists lat double precision,
  add column if not exists lng double precision;
-- Set each restaurant's real position (right-click the place in Google Maps to copy lat, lng):
-- update public.restaurants set category='Fast food', lat=12.3541, lng=121.0689 where name='Your restaurant';
-- Rider GPS uses Realtime Broadcast (no table). Riders must already be allowed to UPDATE bookings (status + details).
