-- VOAS AI — dev seed data.
-- Applied automatically by `supabase db reset`. Safe to re-run; uses upserts.
--
-- This file intentionally does NOT seed auth.users — Supabase manages that.
-- After running `supabase start`, create a test user via the Studio UI
-- (http://localhost:54323) or the signup page, then run this seed to attach
-- a sample workspace to that user.

------------------------------------------------------------
-- Sample workspace + V1 entities (requires at least one auth user)
------------------------------------------------------------

do $$
declare
  v_user_id uuid;
  v_workspace_id uuid;
  v_location_id uuid;
  -- V2 demo data
  v_cat_pizza uuid;
  v_cat_sides uuid;
  v_cat_drinks uuid;
  v_cat_desserts uuid;
  v_cat_salads uuid;
  v_item_margherita uuid;
  v_item_pepperoni uuid;
  v_item_garlic_knots uuid;
  v_item_coke uuid;
  v_item_tiramisu uuid;
  v_group_size uuid;
  v_group_toppings uuid;
  v_cust_alice uuid;
  v_cust_bob uuid;
  v_cust_carol uuid;
  v_conv_1 uuid;
  v_conv_2 uuid;
  v_conv_3 uuid;
  v_conv_4 uuid;
  v_conv_5 uuid;
begin
  select id into v_user_id from auth.users order by created_at desc limit 1;

  if v_user_id is null then
    raise notice 'No auth users exist yet — skipping workspace seed. Sign up a user, then re-run.';
    return;
  end if;

  -- V1: Workspace, owner, location, ticket
  insert into public.workspaces (name, slug, plan, vertical)
  values ('Pino''s Pizza', 'pinos-pizza', 'professional', 'restaurant')
  on conflict (slug) do update set updated_at = now()
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, joined_at)
  values (v_workspace_id, v_user_id, 'owner', now())
  on conflict (workspace_id, user_id) do nothing;

  insert into public.locations (workspace_id, name, address, city, state, postal_code, phone, hours)
  values (
    v_workspace_id,
    'Pino''s Pizza — Downtown',
    '123 Main St',
    'Brooklyn',
    'NY',
    '11201',
    '+1-555-0100',
    jsonb_build_object(
      'mon', jsonb_build_object('open', '11:00', 'close', '22:00'),
      'tue', jsonb_build_object('open', '11:00', 'close', '22:00'),
      'wed', jsonb_build_object('open', '11:00', 'close', '22:00'),
      'thu', jsonb_build_object('open', '11:00', 'close', '22:00'),
      'fri', jsonb_build_object('open', '11:00', 'close', '23:00'),
      'sat', jsonb_build_object('open', '12:00', 'close', '23:00'),
      'sun', jsonb_build_object('open', '12:00', 'close', '21:00')
    )
  )
  on conflict do nothing
  returning id into v_location_id;

  if v_location_id is null then
    select id into v_location_id from public.locations
    where workspace_id = v_workspace_id limit 1;
  end if;

  insert into public.support_tickets (workspace_id, created_by, subject, category, priority)
  values (
    v_workspace_id,
    v_user_id,
    'How do I customize the greeting message?',
    'feature_request',
    'normal'
  )
  on conflict do nothing;

  ------------------------------------------------------------
  -- V2 SEED — skip if menu already exists
  ------------------------------------------------------------
  if exists (select 1 from public.menu_categories where workspace_id = v_workspace_id) then
    raise notice 'V2 demo data already seeded — skipping.';
    return;
  end if;

  -- Menu categories
  insert into public.menu_categories (workspace_id, name, description, sort_order)
  values (v_workspace_id, 'Pizzas', 'Hand-tossed, stone-baked.', 1)
  returning id into v_cat_pizza;

  insert into public.menu_categories (workspace_id, name, description, sort_order)
  values (v_workspace_id, 'Sides', 'Garlic knots, mozz sticks, more.', 2)
  returning id into v_cat_sides;

  insert into public.menu_categories (workspace_id, name, description, sort_order)
  values (v_workspace_id, 'Drinks', 'Soda, sparkling water, juice.', 3)
  returning id into v_cat_drinks;

  insert into public.menu_categories (workspace_id, name, description, sort_order)
  values (v_workspace_id, 'Desserts', 'Tiramisu, cannoli, gelato.', 4)
  returning id into v_cat_desserts;

  insert into public.menu_categories (workspace_id, name, description, sort_order)
  values (v_workspace_id, 'Salads', 'Fresh greens, Italian dressings.', 5)
  returning id into v_cat_salads;

  -- Menu items (with prices in cents)
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_pizza, 'Margherita', 'San Marzano, fresh mozz, basil.', 1599, 1)
  returning id into v_item_margherita;

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_pizza, 'Pepperoni', 'Cup-and-char pepperoni, mozzarella.', 1799, 2)
  returning id into v_item_pepperoni;

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_pizza, 'White Pie', 'Ricotta, garlic, olive oil, rosemary.', 1699, 3);
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_pizza, 'Hawaiian', 'Ham, pineapple, mozzarella. Yes, really.', 1899, 4);

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_sides, 'Garlic Knots', 'Six knots, garlic-parm butter.', 699, 1)
  returning id into v_item_garlic_knots;
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_sides, 'Mozz Sticks', 'Five, with marinara.', 899, 2);
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_sides, 'Caesar Salad', 'Hearts of romaine, parm, croutons.', 999, 3);

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_drinks, 'Coke', '12oz can.', 299, 1)
  returning id into v_item_coke;
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_drinks, 'Diet Coke', '12oz can.', 299, 2);
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_drinks, 'San Pellegrino', '500ml.', 399, 3);
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_drinks, 'Iced Tea', 'House-brewed, unsweetened.', 349, 4);

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_desserts, 'Tiramisu', 'Made in-house daily.', 799, 1)
  returning id into v_item_tiramisu;
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_desserts, 'Cannoli', 'Three, dusted with pistachio.', 699, 2);

  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_salads, 'House Salad', 'Mixed greens, balsamic.', 899, 1);
  insert into public.menu_items (workspace_id, category_id, name, description, price_cents, sort_order)
  values (v_workspace_id, v_cat_salads, 'Caprese', 'Tomato, mozzarella, basil, balsamic.', 1199, 2);

  -- Modifier groups + options on Margherita (size + toppings)
  insert into public.menu_modifier_groups (item_id, name, min_select, max_select, required, sort_order)
  values (v_item_margherita, 'Size', 1, 1, true, 1)
  returning id into v_group_size;

  insert into public.menu_modifier_options (group_id, name, price_delta_cents, is_default, sort_order)
  values
    (v_group_size, '12"', 0, true, 1),
    (v_group_size, '14"', 400, false, 2),
    (v_group_size, '18"', 900, false, 3);

  insert into public.menu_modifier_groups (item_id, name, min_select, max_select, required, sort_order)
  values (v_item_margherita, 'Extra toppings', 0, 5, false, 2)
  returning id into v_group_toppings;

  insert into public.menu_modifier_options (group_id, name, price_delta_cents, sort_order)
  values
    (v_group_toppings, 'Extra mozzarella', 250, 1),
    (v_group_toppings, 'Mushrooms', 200, 2),
    (v_group_toppings, 'Pepperoni', 300, 3),
    (v_group_toppings, 'Olives', 200, 4),
    (v_group_toppings, 'Bell peppers', 200, 5);

  -- Customers
  insert into public.customers (workspace_id, phone, name, total_orders, total_spent_cents, first_seen, last_seen)
  values (v_workspace_id, '+1-555-0201', 'Alice Johnson', 4, 8240, now() - interval '60 days', now() - interval '2 hours')
  returning id into v_cust_alice;
  insert into public.customers (workspace_id, phone, name, total_orders, total_spent_cents, first_seen, last_seen)
  values (v_workspace_id, '+1-555-0202', 'Bob Martinez', 1, 1699, now() - interval '3 days', now() - interval '3 days')
  returning id into v_cust_bob;
  insert into public.customers (workspace_id, phone, name, total_orders, total_spent_cents, first_seen, last_seen)
  values (v_workspace_id, '+1-555-0203', 'Carol Singh', 12, 32450, now() - interval '180 days', now() - interval '20 minutes')
  returning id into v_cust_carol;

  -- Conversations (mix of channels + statuses)
  insert into public.conversations (workspace_id, location_id, customer_id, channel, customer_phone, customer_name,
    started_at, ended_at, duration_seconds, status, sentiment, summary, outcome)
  values (v_workspace_id, v_location_id, v_cust_alice, 'voice', '+1-555-0201', 'Alice Johnson',
    now() - interval '2 hours', now() - interval '2 hours' + interval '3 minutes', 187, 'ended', 0.72,
    'Alice ordered a 14" pepperoni for pickup at 7pm. Confirmed phone-in payment on arrival.',
    'order_placed')
  returning id into v_conv_1;

  insert into public.conversations (workspace_id, location_id, customer_id, channel, customer_phone, customer_name,
    started_at, ended_at, duration_seconds, status, sentiment, summary, outcome)
  values (v_workspace_id, v_location_id, v_cust_carol, 'whatsapp', '+1-555-0203', 'Carol Singh',
    now() - interval '20 minutes', now() - interval '15 minutes', 312, 'ended', 0.45,
    'Asked about gluten-free options. Agent confirmed cauliflower crust available on Margherita and Pepperoni.',
    'question_answered')
  returning id into v_conv_2;

  insert into public.conversations (workspace_id, location_id, customer_id, channel, customer_phone, customer_name,
    started_at, ended_at, duration_seconds, status, sentiment, summary, outcome)
  values (v_workspace_id, v_location_id, v_cust_bob, 'voice', '+1-555-0202', 'Bob Martinez',
    now() - interval '3 days', now() - interval '3 days' + interval '5 minutes', 290, 'escalated', -0.55,
    'Bob complained about a missing item in last week''s delivery. Escalated to human.',
    'escalated')
  returning id into v_conv_3;

  insert into public.conversations (workspace_id, location_id, channel, customer_phone, customer_name,
    started_at, status, sentiment)
  values (v_workspace_id, v_location_id, 'chat', null, 'Anonymous web visitor',
    now() - interval '5 minutes', 'active', null)
  returning id into v_conv_4;

  insert into public.conversations (workspace_id, location_id, channel, customer_phone, customer_name,
    started_at, ended_at, duration_seconds, status, sentiment, summary, outcome)
  values (v_workspace_id, v_location_id, 'sms', '+1-555-0204', 'Unknown',
    now() - interval '7 hours', now() - interval '7 hours' + interval '30 seconds', 28, 'abandoned', -0.1,
    'Customer asked if open but never replied to confirmation.',
    'no_resolution')
  returning id into v_conv_5;

  -- Conversation messages
  insert into public.conversation_messages (conversation_id, role, content, created_at) values
    (v_conv_1, 'agent', 'Hi, thanks for calling Pino''s. What can I get started for you?', now() - interval '2 hours'),
    (v_conv_1, 'customer', 'Yeah, can I get a 14-inch pepperoni for pickup?', now() - interval '2 hours' + interval '8 seconds'),
    (v_conv_1, 'agent', 'Absolutely. Anything else with that?', now() - interval '2 hours' + interval '20 seconds'),
    (v_conv_1, 'customer', 'Add a Coke and some garlic knots.', now() - interval '2 hours' + interval '32 seconds'),
    (v_conv_1, 'agent', 'Got it — 14" pepperoni, garlic knots, a Coke. Total is $27.97. Ready for pickup at 7pm. Sound good?', now() - interval '2 hours' + interval '52 seconds'),
    (v_conv_1, 'customer', 'Perfect, thanks.', now() - interval '2 hours' + interval '70 seconds');

  insert into public.conversation_messages (conversation_id, role, content, created_at) values
    (v_conv_2, 'customer', 'Hi! Do you do gluten-free crust?', now() - interval '20 minutes'),
    (v_conv_2, 'agent', 'Yes! We have cauliflower crust on our Margherita and Pepperoni pies, +$3 per pizza. Would you like to place an order?', now() - interval '19 minutes'),
    (v_conv_2, 'customer', 'Maybe later, thanks!', now() - interval '18 minutes'),
    (v_conv_2, 'agent', 'Sounds good — call or message anytime.', now() - interval '17 minutes');

  insert into public.conversation_messages (conversation_id, role, content, created_at) values
    (v_conv_3, 'agent', 'Hi, thanks for calling Pino''s. How can I help?', now() - interval '3 days'),
    (v_conv_3, 'customer', 'I ordered last Friday and you guys forgot the mozz sticks. I want a refund.', now() - interval '3 days' + interval '12 seconds'),
    (v_conv_3, 'agent', 'I''m really sorry about that. Let me get a manager on the line for you.', now() - interval '3 days' + interval '40 seconds'),
    (v_conv_3, 'system', 'Conversation escalated to support', now() - interval '3 days' + interval '50 seconds');

  insert into public.conversation_messages (conversation_id, role, content, created_at) values
    (v_conv_4, 'customer', 'are you guys open?', now() - interval '5 minutes'),
    (v_conv_4, 'agent', 'Yes, we''re open until 10pm tonight. Anything I can help with?', now() - interval '4 minutes');

  insert into public.conversation_messages (conversation_id, role, content, created_at) values
    (v_conv_5, 'customer', 'open?', now() - interval '7 hours'),
    (v_conv_5, 'agent', 'Yes — open until 10pm. Want to order?', now() - interval '7 hours' + interval '20 seconds');

  -- Orders linked to conversations
  insert into public.orders (workspace_id, location_id, conversation_id, customer_id, status,
    subtotal_cents, tax_cents, total_cents, items_json, customer_phone, customer_name, payment_status)
  values (v_workspace_id, v_location_id, v_conv_1, v_cust_alice, 'fulfilled',
    2598, 199, 2797,
    jsonb_build_array(
      jsonb_build_object('item_id', v_item_pepperoni::text, 'name', 'Pepperoni', 'quantity', 1, 'unit_price_cents', 1799, 'modifiers', jsonb_build_array(jsonb_build_object('name', '14"', 'price_delta_cents', 400)), 'notes', null),
      jsonb_build_object('item_id', v_item_garlic_knots::text, 'name', 'Garlic Knots', 'quantity', 1, 'unit_price_cents', 699, 'modifiers', '[]'::jsonb, 'notes', null),
      jsonb_build_object('item_id', v_item_coke::text, 'name', 'Coke', 'quantity', 1, 'unit_price_cents', 299, 'modifiers', '[]'::jsonb, 'notes', null)
    ),
    '+1-555-0201', 'Alice Johnson', 'paid');

  insert into public.orders (workspace_id, location_id, customer_id, status,
    subtotal_cents, tax_cents, total_cents, items_json, customer_phone, customer_name, payment_status)
  values (v_workspace_id, v_location_id, v_cust_carol, 'preparing',
    1599, 132, 1731,
    jsonb_build_array(
      jsonb_build_object('item_id', v_item_margherita::text, 'name', 'Margherita', 'quantity', 1, 'unit_price_cents', 1599, 'modifiers', '[]'::jsonb, 'notes', 'No basil please')
    ),
    '+1-555-0203', 'Carol Singh', 'paid');

  insert into public.orders (workspace_id, location_id, customer_id, status,
    subtotal_cents, tax_cents, total_cents, items_json, customer_phone, customer_name, payment_status)
  values (v_workspace_id, v_location_id, v_cust_bob, 'refunded',
    1699, 140, 1839,
    jsonb_build_array(
      jsonb_build_object('item_id', null, 'name', 'White Pie', 'quantity', 1, 'unit_price_cents', 1699, 'modifiers', '[]'::jsonb, 'notes', null)
    ),
    '+1-555-0202', 'Bob Martinez', 'refunded');

  raise notice 'Seeded workspace % with V2 demo data', v_workspace_id;
end $$;

------------------------------------------------------------
-- Sample contact submission (no user dependency)
------------------------------------------------------------

insert into public.contact_submissions (name, email, company, message, source)
values (
  'Test Inbound',
  'test-inbound@example.com',
  'Test Co.',
  'Hi — interested in a pilot for a 12-location chain.',
  '/contact'
)
on conflict do nothing;
