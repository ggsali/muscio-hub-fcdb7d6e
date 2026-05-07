
DELETE FROM public.user_roles WHERE user_id IN ('2c7a0640-f44e-4c42-a95d-405927be28fc','20675b65-cf56-4df9-8bef-3fbc37f23c75');
DELETE FROM public.profiles WHERE user_id IN ('2c7a0640-f44e-4c42-a95d-405927be28fc','20675b65-cf56-4df9-8bef-3fbc37f23c75');
UPDATE public.customers SET auth_user_id = NULL WHERE auth_user_id IN ('2c7a0640-f44e-4c42-a95d-405927be28fc','20675b65-cf56-4df9-8bef-3fbc37f23c75');
DELETE FROM auth.users WHERE id IN ('2c7a0640-f44e-4c42-a95d-405927be28fc','20675b65-cf56-4df9-8bef-3fbc37f23c75');
