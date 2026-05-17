INSERT INTO public.user_roles (user_id, role)
VALUES ('2b7613f8-d073-4a38-8496-7b5ef7a35dd8', 'proprietario')
ON CONFLICT (user_id, role) DO NOTHING;