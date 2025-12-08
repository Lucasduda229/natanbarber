import { useState, useEffect } from "react";
import { Image, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface GalleryImage {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  service_id: string | null;
}

export const ServiceGallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGalleryImages();
  }, []);

  const fetchGalleryImages = async () => {
    const { data, error } = await supabase
      .from("service_gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setImages(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-card/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <Image className="w-5 h-5 text-primary" />
        Galeria de Trabalhos
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-primary/10 hover:border-primary/40 transition-all"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image.image_url}
              alt={image.title || "Trabalho da barbearia"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {image.title && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3">
                <p className="text-sm font-medium text-foreground truncate">{image.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-background/95 backdrop-blur-xl border-primary/20">
          <VisuallyHidden>
            <DialogTitle>{selectedImage?.title || "Imagem da galeria"}</DialogTitle>
          </VisuallyHidden>
          {selectedImage && (
            <div className="relative">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title || "Trabalho da barbearia"}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              {(selectedImage.title || selectedImage.description) && (
                <div className="p-6">
                  {selectedImage.title && (
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      {selectedImage.title}
                    </h4>
                  )}
                  {selectedImage.description && (
                    <p className="text-muted-foreground">{selectedImage.description}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
