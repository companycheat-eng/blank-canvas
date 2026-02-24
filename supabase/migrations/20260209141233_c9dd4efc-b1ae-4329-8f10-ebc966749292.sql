-- Grant SELECT on bairros to anon and authenticated roles
GRANT SELECT ON public.bairros TO anon;
GRANT SELECT ON public.bairros TO authenticated;

-- Also grant needed permissions for admin inserts/updates
GRANT INSERT, UPDATE ON public.bairros TO authenticated;