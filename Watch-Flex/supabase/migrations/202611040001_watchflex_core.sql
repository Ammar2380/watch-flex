-- Watch Flex PK persistent commerce schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create sequence if not exists public.wf_order_ref_seq;

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null default '',
  model text not null default '',
  price bigint not null check (price >= 0),
  images text[] not null default '{}',
  category text not null default 'Watches',
  specs text[] not null default '{}',
  stock text not null default 'unknown' check (stock in ('in','out','unknown')),
  stock_quantity integer null check (stock_quantity is null or stock_quantity >= 0),
  featured boolean not null default false,
  is_new boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Backward-compatible upgrade for the earlier Watch Flex table shape:
-- public.products(id, data jsonb, created_at). Keep the original JSONB column
-- and rows, but add the typed columns required for secure stock/order RPCs.
-- All changes are additive; no existing product row is deleted or replaced.
alter table public.products
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists name text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists model text not null default '',
  add column if not exists price bigint not null default 0,
  add column if not exists images text[] not null default '{}',
  add column if not exists category text not null default 'Watches',
  add column if not exists specs text[] not null default '{}',
  add column if not exists stock text not null default 'unknown',
  add column if not exists stock_quantity integer,
  add column if not exists featured boolean not null default false,
  add column if not exists is_new boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Supabase projects created by the previous version may have used json instead
-- of jsonb. Convert in place so JSON operators and the sync trigger are stable.
alter table public.products alter column data type jsonb using coalesce(data::jsonb, '{}'::jsonb);
alter table public.products alter column data set default '{}'::jsonb;
update public.products set data='{}'::jsonb where data is null;
alter table public.products alter column data set not null;

-- Populate typed columns from the original JSON payload. Numeric and boolean
-- fields are validated before casting so malformed optional values cannot
-- abort the migration or invent a product price/stock quantity.
update public.products p set
  name = coalesce(nullif(p.data->>'name',''), p.name, ''),
  brand = coalesce(p.data->>'brand', p.brand, ''),
  model = coalesce(p.data->>'model', p.model, ''),
  price = case when coalesce(p.data->>'price','') ~ '^\d+(\.\d+)?$'
    then greatest(0, round((p.data->>'price')::numeric)::bigint) else coalesce(p.price,0) end,
  images = case when jsonb_typeof(p.data->'images')='array'
    then array(select jsonb_array_elements_text(p.data->'images'))
    when coalesce(p.data->>'image','') <> '' then array[p.data->>'image']
    else coalesce(p.images,'{}'::text[]) end,
  category = coalesce(nullif(p.data->>'category',''), p.category, 'Watches'),
  specs = case when jsonb_typeof(p.data->'specs')='array'
    then array(select jsonb_array_elements_text(p.data->'specs'))
    when jsonb_typeof(p.data->'specs')='string'
    then array(select btrim(x) from regexp_split_to_table(p.data->>'specs', ',') as x where btrim(x) <> '')
    else coalesce(p.specs,'{}'::text[]) end,
  stock_quantity = case
    when coalesce(p.data->>'stockQuantity', p.data->>'stock_quantity','') ~ '^\d+$'
      then (coalesce(p.data->>'stockQuantity', p.data->>'stock_quantity'))::integer
    when p.data ? 'stockQuantity' or p.data ? 'stock_quantity' then null
    else p.stock_quantity end,
  stock = case
    when coalesce(p.data->>'stockQuantity', p.data->>'stock_quantity','') ~ '^\d+$'
      then case when (coalesce(p.data->>'stockQuantity', p.data->>'stock_quantity'))::integer > 0 then 'in' else 'out' end
    when p.data->>'stock' in ('in','out','unknown') then p.data->>'stock'
    when p.stock in ('in','out','unknown') then p.stock else 'unknown' end,
  featured = case when lower(coalesce(p.data->>'featured','')) in ('true','1','yes') then true
    when lower(coalesce(p.data->>'featured','')) in ('false','0','no') then false else coalesce(p.featured,false) end,
  is_new = case when lower(coalesce(p.data->>'isNew',p.data->>'is_new','')) in ('true','1','yes') then true
    when lower(coalesce(p.data->>'isNew',p.data->>'is_new','')) in ('false','0','no') then false else coalesce(p.is_new,false) end,
  sort_order = case when coalesce(p.data->>'sortOrder',p.data->>'sort_order','') ~ '^-?\d+$'
    then (coalesce(p.data->>'sortOrder',p.data->>'sort_order'))::integer else coalesce(p.sort_order,0) end,
  created_at = coalesce(p.created_at, now()),
  updated_at = coalesce(p.updated_at, now());

-- Keep the old id/data interface useful in Supabase Table Editor and ensure
-- new products created through the admin panel also populate the JSON payload.
update public.products p set data = (coalesce(p.data,'{}'::jsonb) - 'image') || jsonb_build_object(
  'id', p.id, 'name', p.name, 'brand', p.brand, 'model', p.model, 'price', p.price,
  'images', to_jsonb(p.images), 'category', p.category, 'specs', to_jsonb(p.specs),
  'stock', p.stock, 'stockQuantity', p.stock_quantity, 'featured', p.featured, 'isNew', p.is_new
);

create or replace function public.wf_sync_product_data()
returns trigger language plpgsql set search_path = public as $$
declare
  v_data_changed boolean := false;
  v_columns_changed boolean := false;
  v_stock_qty text;
  v_price text;
  v_order text;
begin
  if TG_OP = 'INSERT' then
    v_data_changed := NEW.data is not null and NEW.data <> '{}'::jsonb;
  else
    v_data_changed := NEW.data is distinct from OLD.data;
    v_columns_changed := row(NEW.name, NEW.brand, NEW.model, NEW.price, NEW.images, NEW.category,
      NEW.specs, NEW.stock, NEW.stock_quantity, NEW.featured, NEW.is_new, NEW.sort_order)
      is distinct from row(OLD.name, OLD.brand, OLD.model, OLD.price, OLD.images, OLD.category,
      OLD.specs, OLD.stock, OLD.stock_quantity, OLD.featured, OLD.is_new, OLD.sort_order);
  end if;

  if v_data_changed and not v_columns_changed then
    NEW.name := coalesce(nullif(NEW.data->>'name',''), NEW.name, '');
    NEW.brand := coalesce(NEW.data->>'brand', NEW.brand, '');
    NEW.model := coalesce(NEW.data->>'model', NEW.model, '');
    v_price := NEW.data->>'price';
    if coalesce(v_price,'') ~ '^\d+(\.\d+)?$' then NEW.price := greatest(0, round(v_price::numeric)::bigint); end if;
    if jsonb_typeof(NEW.data->'images')='array' then
      NEW.images := array(select jsonb_array_elements_text(NEW.data->'images'));
    elsif coalesce(NEW.data->>'image','') <> '' then
      NEW.images := array[NEW.data->>'image'];
    end if;
    NEW.category := coalesce(nullif(NEW.data->>'category',''), NEW.category, 'Watches');
    if NEW.data ? 'specs' then
      NEW.specs := case when jsonb_typeof(NEW.data->'specs')='array'
        then array(select jsonb_array_elements_text(NEW.data->'specs'))
        when jsonb_typeof(NEW.data->'specs')='string'
        then array(select btrim(x) from regexp_split_to_table(NEW.data->>'specs', ',') as x where btrim(x) <> '')
        else '{}'::text[] end;
    end if;
    if NEW.data ? 'stockQuantity' or NEW.data ? 'stock_quantity' then
      v_stock_qty := coalesce(NEW.data->>'stockQuantity', NEW.data->>'stock_quantity');
      NEW.stock_quantity := case when coalesce(v_stock_qty,'') ~ '^\d+$' then v_stock_qty::integer else null end;
    end if;
    if NEW.stock_quantity is not null then
      NEW.stock := case when NEW.stock_quantity > 0 then 'in' else 'out' end;
    elsif NEW.data->>'stock' in ('in','out','unknown') then
      NEW.stock := NEW.data->>'stock';
    end if;
    if NEW.data ? 'featured' then NEW.featured := coalesce(lower(NEW.data->>'featured') in ('true','1','yes'), false); end if;
    if NEW.data ? 'isNew' or NEW.data ? 'is_new' then NEW.is_new := coalesce(lower(coalesce(NEW.data->>'isNew',NEW.data->>'is_new')) in ('true','1','yes'), false); end if;
    v_order := coalesce(NEW.data->>'sortOrder',NEW.data->>'sort_order');
    if coalesce(v_order,'') ~ '^-?\d+$' then NEW.sort_order := v_order::integer; end if;
  end if;

  -- Normalized columns are canonical for application writes and inventory RPCs;
  -- JSON data remains synchronized for the previous Table Editor workflow.
  NEW.data := (coalesce(NEW.data,'{}'::jsonb) - 'image') || jsonb_build_object(
    'id', NEW.id, 'name', NEW.name, 'brand', NEW.brand, 'model', NEW.model, 'price', NEW.price,
    'images', to_jsonb(NEW.images), 'category', NEW.category, 'specs', to_jsonb(NEW.specs),
    'stock', NEW.stock, 'stockQuantity', NEW.stock_quantity, 'featured', NEW.featured, 'isNew', NEW.is_new
  );
  if TG_OP = 'UPDATE' then NEW.updated_at := now(); end if;
  return NEW;
end;
$$;
drop trigger if exists wf_products_sync_data on public.products;
create trigger wf_products_sync_data before insert or update on public.products
for each row execute function public.wf_sync_product_data();

create unique index if not exists wf_products_id_unique_idx on public.products(id);
create index if not exists wf_products_sort_order_idx on public.products(sort_order, created_at);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='wf_products_price_nonnegative' and conrelid='public.products'::regclass) then
    alter table public.products add constraint wf_products_price_nonnegative check (price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='wf_products_stock_valid' and conrelid='public.products'::regclass) then
    alter table public.products add constraint wf_products_stock_valid check (stock in ('in','out','unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname='wf_products_stock_quantity_nonnegative' and conrelid='public.products'::regclass) then
    alter table public.products add constraint wf_products_stock_quantity_nonnegative check (stock_quantity is null or stock_quantity >= 0);
  end if;
end $$;

create table if not exists public.promos (
  code text primary key,
  type text not null check (type in ('percent','fixed')),
  value integer not null check (value > 0),
  min_amount bigint not null default 0 check (min_amount >= 0),
  max_uses integer not null default 0 check (max_uses >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.promos(code,type,value,min_amount,max_uses,used_count,active)
values ('WELCOME10','percent',10,0,0,0,true) on conflict (code) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  date timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  customer jsonb not null,
  items jsonb not null,
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  promo text not null default '',
  delivery_fee bigint not null default 0 check (delivery_fee >= 0),
  total bigint not null check (total >= 0),
  payment text not null default 'Cash on delivery',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  shipping jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  email text primary key,
  name text not null default '',
  phone text not null default '',
  city text not null default '',
  postal text not null default '',
  address text not null default '',
  order_count integer not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.site_settings(key, value) values ('delivery_fee', '0'::jsonb)
on conflict (key) do nothing;

create table if not exists public.email_verifications (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started timestamptz not null default now(),
  attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (bucket, subject_hash)
);

create or replace function public.wf_check_rate_limit(
  p_bucket text, p_subject_hash text, p_limit integer,
  p_window_seconds integer, p_block_seconds integer
) returns text language plpgsql security definer set search_path = public as $$
declare
  v public.rate_limits%rowtype;
  v_attempts integer;
begin
  if length(coalesce(p_bucket,'')) < 1 or length(coalesce(p_subject_hash,'')) < 16
     or p_limit < 1 or p_window_seconds < 1 or p_block_seconds < 1 then
    raise exception 'Invalid rate-limit parameters.' using errcode = '22023';
  end if;
  insert into public.rate_limits(bucket,subject_hash) values (p_bucket,p_subject_hash)
  on conflict (bucket,subject_hash) do nothing;
  select * into v from public.rate_limits where bucket=p_bucket and subject_hash=p_subject_hash for update;
  if v.blocked_until is not null and v.blocked_until > now() then return 'rate_limited'; end if;
  if v.window_started <= now()-make_interval(secs => p_window_seconds) then
    v_attempts := 0;
    v.window_started := now();
  else
    v_attempts := v.attempts;
  end if;
  v_attempts := v_attempts + 1;
  if v_attempts > p_limit then
    update public.rate_limits set attempts=v_attempts, blocked_until=now()+make_interval(secs => p_block_seconds),
      window_started=v.window_started, updated_at=now()
      where bucket=p_bucket and subject_hash=p_subject_hash;
    return 'rate_limited';
  end if;
  update public.rate_limits set attempts=v_attempts, blocked_until=null,
    window_started=v.window_started, updated_at=now()
    where bucket=p_bucket and subject_hash=p_subject_hash;
  return 'ok';
end;
$$;

create or replace function public.wf_reset_rate_limit(p_bucket text, p_subject_hash text)
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where bucket=p_bucket and subject_hash=p_subject_hash;
$$;

create or replace function public.wf_sync_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customers(email, name, phone, city, postal, address, order_count, last_order_at, updated_at)
  values (
    lower(coalesce(new.customer->>'email','')),
    coalesce(new.customer->>'name',''), coalesce(new.customer->>'phone',''),
    coalesce(new.customer->>'city',''), coalesce(new.customer->>'postal',''),
    coalesce(new.customer->>'address',''), 1, new.date, now()
  )
  on conflict (email) do update set
    name = excluded.name, phone = excluded.phone, city = excluded.city,
    postal = excluded.postal, address = excluded.address,
    order_count = public.customers.order_count + 1,
    last_order_at = greatest(public.customers.last_order_at, excluded.last_order_at),
    updated_at = now();
  return new;
end;
$$;
drop trigger if exists wf_orders_customer_sync on public.orders;
create trigger wf_orders_customer_sync after insert on public.orders
for each row execute function public.wf_sync_customer();

create or replace function public.wf_create_order(
  p_items jsonb,
  p_customer jsonb,
  p_promo text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_promo public.promos%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_qty integer;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_delivery bigint := 0;
  v_total bigint := 0;
  v_code text := '';
  v_ref text;
  v_existing public.orders%rowtype;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 120 then
    raise exception 'Invalid checkout request key.' using errcode = '22023';
  end if;
  if p_customer is null or coalesce(p_customer->>'email','') = '' then
    raise exception 'Customer details are required.' using errcode = '22023';
  end if;
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if lower(coalesce(v_existing.customer->>'email','')) is distinct from lower(coalesce(p_customer->>'email','')) then
      raise exception 'Invalid checkout request key.' using errcode = '22023';
    end if;
    return jsonb_build_object('ref',v_existing.ref,'discount',v_existing.discount,'delivery_fee',v_existing.delivery_fee,'total',v_existing.total);
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your bag is empty or contains too many items.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'Invalid item quantity.' using errcode = '22023'; end if;
    select * into v_product from public.products where id = v_item->>'id' for update;
    if not found or v_product.stock = 'out' then raise exception 'An item in your bag is no longer available.' using errcode = 'P0001'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
      raise exception 'An item in your bag does not have enough stock.' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_product.price * v_qty;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('id',v_product.id,'name',v_product.name,'price',v_product.price,'qty',v_qty));
    if v_product.stock_quantity is not null then
      update public.products set stock_quantity = stock_quantity - v_qty, updated_at = now() where id = v_product.id;
      if v_product.stock_quantity - v_qty = 0 then
        update public.products set stock = 'out' where id = v_product.id;
      end if;
    end if;
  end loop;

  if p_promo is not null and btrim(p_promo) <> '' then
    select * into v_promo from public.promos where code = upper(btrim(p_promo)) for update;
    if not found or not v_promo.active then raise exception 'This promo code is not valid.' using errcode = 'P0001'; end if;
    if v_promo.max_uses > 0 and v_promo.used_count >= v_promo.max_uses then raise exception 'This promo code has been fully used.' using errcode = 'P0001'; end if;
    if v_subtotal < v_promo.min_amount then raise exception 'This order does not meet the promo minimum.' using errcode = 'P0001'; end if;
    v_discount := least(v_subtotal, case when v_promo.type = 'percent' then round(v_subtotal * v_promo.value / 100.0)::bigint else v_promo.value::bigint end);
    v_code := v_promo.code;
    update public.promos set used_count = used_count + 1 where code = v_promo.code;
  end if;

  select coalesce((value #>> '{}')::bigint,0) into v_delivery from public.site_settings where key = 'delivery_fee';
  v_delivery := greatest(coalesce(v_delivery,0),0);
  v_total := v_subtotal - v_discount + v_delivery;
  v_ref := 'WF-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('public.wf_order_ref_seq')::text,6,'0');
  insert into public.orders(ref,status,customer,items,subtotal,discount,promo,delivery_fee,total,payment,payment_status,idempotency_key)
  values (v_ref,'pending',p_customer,v_rows,v_subtotal,v_discount,v_code,v_delivery,v_total,'Cash on delivery','pending',p_idempotency_key);
  return jsonb_build_object('ref',v_ref,'discount',v_discount,'delivery_fee',v_delivery,'total',v_total);
exception when unique_violation then
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if lower(coalesce(v_existing.customer->>'email','')) is distinct from lower(coalesce(p_customer->>'email','')) then
      raise exception 'Invalid checkout request key.' using errcode = '22023';
    end if;
    return jsonb_build_object('ref',v_existing.ref,'discount',v_existing.discount,'delivery_fee',v_existing.delivery_fee,'total',v_existing.total);
  end if;
  raise;
end;
$$;

create or replace function public.wf_cancel_order(p_ref text, p_customer_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
begin
  select * into v_order from public.orders where ref=p_ref for update;
  if not found then return null; end if;
  if p_customer_email is not null and lower(v_order.customer->>'email') <> lower(p_customer_email) then return null; end if;
  if v_order.status not in ('pending','confirmed') then
    raise exception 'Only pending or confirmed orders can be cancelled.' using errcode = 'P0001';
  end if;
  update public.orders set status='cancelled',updated_at=now() where ref=p_ref returning * into v_order;
  for v_item in select value from jsonb_array_elements(v_order.items) loop
    update public.products
      set stock_quantity=stock_quantity + (v_item->>'qty')::integer,
          stock=case when stock_quantity + (v_item->>'qty')::integer > 0 then 'in' else stock end,
          updated_at=now()
      where id=v_item->>'id' and stock_quantity is not null;
  end loop;
  if v_order.promo <> '' then
    update public.promos set used_count=greatest(0,used_count-1) where code=v_order.promo;
  end if;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.wf_issue_email_code(p_email text, p_code_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_sent timestamptz[];
begin
  insert into public.email_verifications(email,code_hash,expires_at,attempts,sent_at)
  values (lower(p_email),p_code_hash,now()+interval '10 minutes',0,array[]::timestamptz[])
  on conflict (email) do nothing;
  select sent_at into v_sent from public.email_verifications where email=lower(p_email) for update;
  v_sent := coalesce(v_sent,'{}'::timestamptz[]);
  v_sent := array(select x from unnest(v_sent) x where x > now()-interval '1 hour');
  if cardinality(v_sent) >= 5 then return 'rate_limited'; end if;
  v_sent := array_append(v_sent,now());
  update public.email_verifications set code_hash=p_code_hash,expires_at=now()+interval '10 minutes',attempts=0,sent_at=v_sent,updated_at=now() where email=lower(p_email);
  return 'ok';
end;
$$;

create or replace function public.wf_consume_email_code(p_email text, p_code_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v public.email_verifications%rowtype;
begin
  select * into v from public.email_verifications where email=lower(p_email) for update;
  if not found then return 'expired'; end if;
  if v.expires_at <= now() then delete from public.email_verifications where email=lower(p_email); return 'expired'; end if;
  if v.attempts >= 5 then delete from public.email_verifications where email=lower(p_email); return 'rate_limited'; end if;
  if v.code_hash <> p_code_hash then
    if v.attempts + 1 >= 5 then
      delete from public.email_verifications where email=lower(p_email);
      return 'rate_limited';
    end if;
    update public.email_verifications set attempts=attempts+1,updated_at=now() where email=lower(p_email);
    return 'invalid';
  end if;
  delete from public.email_verifications where email=lower(p_email);
  return 'ok';
end;
$$;

create or replace function public.wf_invalidate_email_code(p_email text)
returns void language sql security definer set search_path = public as $$
  delete from public.email_verifications where email=lower(p_email);
$$;

-- Only the server's service-role client may read/write private commerce records.
alter table public.products enable row level security;
alter table public.promos enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;
alter table public.site_settings enable row level security;
alter table public.email_verifications enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.products, public.promos, public.orders, public.customers, public.site_settings, public.email_verifications, public.rate_limits from anon, authenticated;
grant all on public.products, public.promos, public.orders, public.customers, public.site_settings, public.email_verifications, public.rate_limits to service_role;
revoke all on function public.wf_create_order(jsonb,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.wf_issue_email_code(text,text) from public, anon, authenticated;
revoke all on function public.wf_cancel_order(text,text) from public, anon, authenticated;
revoke all on function public.wf_consume_email_code(text,text) from public, anon, authenticated;
revoke all on function public.wf_invalidate_email_code(text) from public, anon, authenticated;
revoke all on function public.wf_check_rate_limit(text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.wf_reset_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.wf_create_order(jsonb,jsonb,text,text) to service_role;
grant execute on function public.wf_issue_email_code(text,text) to service_role;
grant execute on function public.wf_cancel_order(text,text) to service_role;
grant execute on function public.wf_consume_email_code(text,text) to service_role;
grant execute on function public.wf_invalidate_email_code(text) to service_role;
grant execute on function public.wf_check_rate_limit(text,text,integer,integer,integer) to service_role;
grant execute on function public.wf_reset_rate_limit(text,text) to service_role;

-- Public product images; writes are performed only through authenticated server API routes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,4194304,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true,file_size_limit=4194304,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif'];
