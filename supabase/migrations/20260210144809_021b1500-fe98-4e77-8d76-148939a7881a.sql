
-- Bucket para ícones de marcadores do mapa
INSERT INTO storage.buckets (id, name, public)
VALUES ('marker-icons', 'marker-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Política: admins gerais podem fazer upload
CREATE POLICY "Admins can upload marker icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'marker-icons'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_geral'
  )
);

-- Política: qualquer pessoa pode ler (público)
CREATE POLICY "Anyone can read marker icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'marker-icons');

-- Política: admins gerais podem deletar
CREATE POLICY "Admins can delete marker icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'marker-icons'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_geral'
  )
);

-- Política: admins gerais podem atualizar
CREATE POLICY "Admins can update marker icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'marker-icons'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_geral'
  )
);
