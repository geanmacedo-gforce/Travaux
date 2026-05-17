INSERT INTO public.user_roles (user_id, role)
SELECT '2b7613f8-d073-4a38-8496-7b5ef7a35dd8'::uuid, 'proprietario'::app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '2b7613f8-d073-4a38-8496-7b5ef7a35dd8');