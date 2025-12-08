import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Camera, LogOut, Calendar, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export const ProfileMenu = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);

    try {
      // Upload to storage with user's folder
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      await supabase.storage.from("avatars").remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Erro ao fazer upload da imagem");
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl + "?t=" + Date.now() })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Update error:", updateError);
        toast.error("Erro ao atualizar perfil");
        setUploading(false);
        return;
      }

      toast.success("Foto atualizada com sucesso!");
      fetchProfile();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao atualizar foto");
    }

    setUploading(false);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
            <Avatar className="h-10 w-10 border-2 border-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Usuário"} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="cursor-pointer"
          >
            <Camera className="w-4 h-4 mr-2" />
            {uploading ? "Enviando..." : "Alterar Foto"}
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => navigate("/my-appointments")}
            className="cursor-pointer"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Meus Agendamentos
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
};
