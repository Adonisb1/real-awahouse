insert into public.profiles (id, full_name, email, role, nin_status, nin_last4, rent_score)
select gen_random_uuid(), 'Awahouse Admin', 'admin@awahouse.ng', 'admin', 'approved', '0000', 800
where not exists (select 1 from public.profiles where email = 'admin@awahouse.ng');

