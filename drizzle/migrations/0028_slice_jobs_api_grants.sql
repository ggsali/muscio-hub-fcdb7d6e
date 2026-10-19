GRANT SELECT ON public.slice_jobs TO authenticated;
GRANT ALL ON public.slice_jobs TO service_role;
NOTIFY pgrst, 'reload schema';