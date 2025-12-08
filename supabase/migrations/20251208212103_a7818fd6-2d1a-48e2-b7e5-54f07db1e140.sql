-- Create storage bucket for service gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-gallery', 'service-gallery', true);

-- Create table for gallery images
CREATE TABLE public.service_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_gallery ENABLE ROW LEVEL SECURITY;

-- Anyone can view gallery images
CREATE POLICY "Anyone can view gallery images"
ON public.service_gallery
FOR SELECT
USING (true);

-- Only admins can manage gallery images
CREATE POLICY "Admins can manage gallery images"
ON public.service_gallery
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for service-gallery bucket
CREATE POLICY "Anyone can view service gallery images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'service-gallery');

CREATE POLICY "Admins can upload service gallery images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'service-gallery' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service gallery images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'service-gallery' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service gallery images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'service-gallery' AND has_role(auth.uid(), 'admin'::app_role));