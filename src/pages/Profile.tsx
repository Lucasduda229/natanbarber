import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Calendar, Shield, ArrowLeft, User, Mail, Phone, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AnimatedBackground from "@/components/AnimatedBackground";

interface Profile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchProfile();
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

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      await supabase.storage.from("avatars").remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.error("Erro ao fazer upload da imagem");
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl + "?t=" + Date.now() })
        .eq("user_id", user.id);

      if (updateError) {
        toast.error("Erro ao atualizar perfil");
        setUploading(false);
        return;
      }

      toast.success("Foto atualizada com sucesso!");
      fetchProfile();
    } catch {
      toast.error("Erro ao atualizar foto");
    }

    setUploading(false);
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
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>

        {/* Avatar Section */}
        <Card className="bg-card/80 backdrop-blur-sm border-border mb-4">
          <CardContent className="flex flex-col items-center py-8">
            <div className="relative group mb-4">
              <Avatar className="h-24 w-24 border-4 border-primary/30">
                <AvatarImage
                  src={profile?.avatar_url || undefined}
                  alt={profile?.full_name || "Usuário"}
                />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:opacity-90 transition-opacity"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {profile?.full_name || "Usuário"}
            </h2>
            {uploading && (
              <p className="text-xs text-muted-foreground mt-1">Enviando foto...</p>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="bg-card/80 backdrop-blur-sm border-border mb-4">
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm text-foreground">{user.email}</p>
              </div>
            </div>
            {profile?.phone && (
              <>
                <Separator className="bg-border" />
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm text-foreground">{profile.phone}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="bg-card/80 backdrop-blur-sm border-border mb-4">
          <CardContent className="py-2">
            <button
              onClick={() => navigate("/my-appointments")}
              className="flex items-center gap-3 w-full py-3 px-1 text-foreground hover:text-primary transition-colors"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">Meus Agendamentos</span>
            </button>

            {isAdmin && (
              <>
                <Separator className="bg-border" />
                <button
                  onClick={() => navigate("/admin")}
                  className="flex items-center gap-3 w-full py-3 px-1 text-primary hover:opacity-80 transition-opacity"
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-medium">Painel Admin</span>
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Logout */}
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="py-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full py-3 px-1 text-destructive hover:opacity-80 transition-opacity"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Sair da conta</span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default Profile;
