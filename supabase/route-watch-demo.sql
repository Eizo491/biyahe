-- Biyahe: Route Watch DEMO data. Run in the Supabase SQL editor, AFTER route-watch.sql.
-- It takes your most recent RIDE that has a rider and coordinates, draws a fake GPS trail that starts on the route and
-- then drifts about 2 km sideways, and raises three sample alerts so the owner console has something to show.
-- (Make one ride first: customer books, rider accepts. It can be any status.)
-- To remove the demo afterwards, run the two lines at the bottom of this file.

do $$
declare
  b record; a_lat float; a_lng float; b_lat float; b_lng float;
  i int; f float; lat float; lng float; drift float;
begin
  select x.id::text as id, x.rider_id, x.details into b
    from public.bookings x
   where x.rider_id is not null and x.details ? 'pickup_geo' and x.details ? 'dropoff_geo'
   order by x.created_at desc limit 1;
  if b.id is null then raise exception 'No ride with a rider found. Book a ride as a customer and accept it as a rider first.'; end if;

  a_lat := (b.details #>> '{pickup_geo,lat}')::float;  a_lng := (b.details #>> '{pickup_geo,lng}')::float;
  b_lat := (b.details #>> '{dropoff_geo,lat}')::float; b_lng := (b.details #>> '{dropoff_geo,lng}')::float;

  delete from public.trip_track where booking_id = b.id;
  for i in 0..12 loop
    f := least(i, 6) / 10.0;                       -- first 7 points follow the route...
    drift := greatest(0, i - 6) * 0.0035;          -- ...then it veers away (~400 m more per point)
    lat := a_lat + (b_lat - a_lat) * f + drift;
    lng := a_lng + (b_lng - a_lng) * f;
    insert into public.trip_track (booking_id, rider_id, lat, lng, at) values (b.id, b.rider_id, lat, lng, now() - make_interval(secs => (13 - i) * 10));
  end loop;

  perform public.rw_flag(b.id, b.rider_id, 'off_route',  'high', '[DEMO] Rider is about 1800 m away from the planned route (allowed 700 m).', a_lat + (b_lat - a_lat) * 0.6 + 0.021, a_lng + (b_lng - a_lng) * 0.6);
  perform public.rw_flag(b.id, b.rider_id, 'wrong_way',  'warn', '[DEMO] Rider moved 1200 m farther from the drop-off than their closest point.', a_lat + (b_lat - a_lat) * 0.6 + 0.021, a_lng + (b_lng - a_lng) * 0.6);
  perform public.rw_flag(b.id, b.rider_id, 'long_stop',  'warn', '[DEMO] Rider has been stopped for over 5 min away from pickup and drop-off.', a_lat + (b_lat - a_lat) * 0.6, a_lng + (b_lng - a_lng) * 0.6);
  raise notice 'Demo alerts created for booking %', b.id;
end $$;

-- Remove the demo (run these two lines in this order):
-- delete from public.trip_track where booking_id in (select booking_id from public.route_alerts where message like '[DEMO]%');
-- delete from public.route_alerts where message like '[DEMO]%';
