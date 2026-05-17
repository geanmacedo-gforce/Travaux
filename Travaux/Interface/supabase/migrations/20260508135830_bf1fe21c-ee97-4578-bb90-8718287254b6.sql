DROP POLICY IF EXISTS roles_all_owner ON public.user_roles;
CREATE POLICY roles_all_owner ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS roles_select_own_or_owner ON public.user_roles;
CREATE POLICY roles_select_own_or_owner ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS profiles_select_own_or_owner ON public.profiles;
CREATE POLICY profiles_select_own_or_owner ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));

DROP POLICY IF EXISTS profiles_update_own_or_owner ON public.profiles;
CREATE POLICY profiles_update_own_or_owner ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS profiles_insert_owner ON public.profiles;
CREATE POLICY profiles_insert_owner ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'admin') OR id = auth.uid());