import { useState, useEffect, useRef } from "react";
import { Image, Upload, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GalleryImage {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  service_id: string | null;
  created_at: string;
}

export const GalleryManager = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newImage, setNewImage] = useState<{ file: File | null; title: string; description: string }>({
    file: null,
    title: "",
    description: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from("service_gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setImages(data);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor, selecione uma imagem válida");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande. Máximo 5MB.");
        return;
      }
      setNewImage({ ...newImage, file });
    }
  };

  const uploadImage = async () => {
    if (!newImage.file) {
      toast.error("Selecione uma imagem");
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = newImage.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("service-gallery")
        .upload(fileName, newImage.file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Erro ao fazer upload da imagem");
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("service-gallery")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase.from("service_gallery").insert({
        image_url: urlData.publicUrl,
        title: newImage.title.trim() || null,
        description: newImage.description.trim() || null,
      });

      if (dbError) {
        console.error("Database error:", dbError);
        toast.error("Erro ao salvar imagem");
        setUploading(false);
        return;
      }

      toast.success("Imagem adicionada com sucesso!");
      setNewImage({ file: null, title: "", description: "" });
      setDialogOpen(false);
      fetchImages();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao adicionar imagem");
    }

    setUploading(false);
  };

  const deleteImage = async (image: GalleryImage) => {
    // Extract file name from URL
    const urlParts = image.image_url.split("/");
    const fileName = urlParts[urlParts.length - 1];

    // Delete from storage
    await supabase.storage.from("service-gallery").remove([fileName]);

    // Delete from database
    const { error } = await supabase.from("service_gallery").delete().eq("id", image.id);

    if (error) {
      toast.error("Erro ao excluir imagem");
      return;
    }

    toast.success("Imagem excluída");
    fetchImages();
  };

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Image className="w-5 h-5 text-primary" />
          Galeria de Trabalhos
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle>Adicionar Imagem à Galeria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label>Imagem</Label>
                <div
                  className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {newImage.file ? (
                    <div className="space-y-2">
                      <img
                        src={URL.createObjectURL(newImage.file)}
                        alt="Preview"
                        className="max-h-40 mx-auto rounded-lg"
                      />
                      <p className="text-sm text-muted-foreground">{newImage.file.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Clique para selecionar uma imagem</p>
                      <p className="text-xs text-muted-foreground/60">Máximo 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título (opcional)</Label>
                <Input
                  id="title"
                  placeholder="Ex: Degradê moderno"
                  value={newImage.title}
                  onChange={(e) => setNewImage({ ...newImage, title: e.target.value })}
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o trabalho..."
                  value={newImage.description}
                  onChange={(e) => setNewImage({ ...newImage, description: e.target.value })}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <Button onClick={uploadImage} disabled={uploading || !newImage.file} className="w-full">
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Adicionar à Galeria
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma imagem na galeria</p>
            <p className="text-sm">Adicione fotos dos seus trabalhos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <div key={image.id} className="group relative aspect-square rounded-lg overflow-hidden border border-primary/10">
                <img
                  src={image.image_url}
                  alt={image.title || "Imagem da galeria"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteImage(image)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {image.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                    <p className="text-xs font-medium text-foreground truncate">{image.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
