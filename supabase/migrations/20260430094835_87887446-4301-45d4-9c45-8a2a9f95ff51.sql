
DO $$
DECLARE
  user_ids uuid[] := ARRAY[
    '67aa0503-aef4-4030-9f0f-7a3f1601036f',
    '5caa23b8-e788-41ed-bc9d-3b008fa18e9a',
    '36d14453-856f-46ef-bd5c-8d79adedc139',
    '11179df9-a1df-4050-b7d0-e00c4e361baf'
  ];
BEGIN
  DELETE FROM public.user_roles WHERE user_id = ANY(user_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(user_ids);
  UPDATE public.customers SET auth_user_id = NULL WHERE auth_user_id = ANY(user_ids);
  DELETE FROM auth.users WHERE id = ANY(user_ids);
END $$;
