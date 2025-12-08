import { useState } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReviewFormProps {
  appointmentId: string;
  serviceName: string;
  onReviewSubmitted?: () => void;
}

export const ReviewForm = ({ appointmentId, serviceName, onReviewSubmitted }: ReviewFormProps) => {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma nota");
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Você precisa estar logado");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      appointment_id: appointmentId,
      rating,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Você já avaliou este serviço");
      } else {
        console.error("Review error:", error);
        toast.error("Erro ao enviar avaliação");
      }
      return;
    }

    toast.success("Avaliação enviada com sucesso!");
    setOpen(false);
    setRating(0);
    setComment("");
    onReviewSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/30 hover:bg-primary/10">
          <Star className="w-4 h-4 mr-2 text-primary" />
          Avaliar
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle>Avaliar Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Como foi seu {serviceName}?</p>
            
            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            
            {rating > 0 && (
              <p className="mt-2 text-sm text-primary font-medium">
                {rating === 1 && "Ruim"}
                {rating === 2 && "Regular"}
                {rating === 3 && "Bom"}
                {rating === 4 && "Muito Bom"}
                {rating === 5 && "Excelente!"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Textarea
              placeholder="Deixe um comentário sobre sua experiência (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting || rating === 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Avaliação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
