CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  has_owner BOOLEAN;
  assigned_role public.app_role;
  is_oauth BOOLEAN;
BEGIN
  is_oauth := COALESCE(NEW.raw_app_meta_data->>'provider', 'email') <> 'email';

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='proprietario') INTO has_owner;

  INSERT INTO public.profiles (id, nome, email, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    CASE WHEN is_oauth AND has_owner THEN false ELSE true END
  );

  IF NOT has_owner THEN
    assigned_role := 'proprietario';
  ELSE
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'funcionario');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $function$;