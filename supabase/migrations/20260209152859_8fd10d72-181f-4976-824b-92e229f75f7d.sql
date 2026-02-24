-- Add lat/lng columns to bairros for geographic center
ALTER TABLE public.bairros ADD COLUMN lat double precision;
ALTER TABLE public.bairros ADD COLUMN lng double precision;
