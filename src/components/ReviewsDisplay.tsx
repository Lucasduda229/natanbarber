import { useState, useEffect } from "react";
import { Star, MessageSquare, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const ReviewsDisplay = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ average: 0, total: 0 });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    // Fetch reviews with profile data (name and avatar)
    const { data: reviewsData, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching reviews:", error);
      setLoading(false);
      return;
    }

    if (!reviewsData || reviewsData.length === 0) {
      setLoading(false);
      return;
    }

    // Use secure function to get only safe profile fields (no phone/admin_notes)
    const userIds = reviewsData.map(r => r.user_id);
    const { data: profilesData } = await supabase
      .rpc("get_reviewer_profiles", { reviewer_user_ids: userIds });

    // Map profiles to reviews
    const reviewsWithProfiles = reviewsData.map(review => ({
      ...review,
      profiles: profilesData?.find((p: { user_id: string }) => p.user_id === review.user_id) || null,
    }));

    setReviews(reviewsWithProfiles);

    // Calculate stats
    const total = reviewsData.length;
    const average = reviewsData.reduce((sum, r) => sum + r.rating, 0) / total;
    setStats({ average, total });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-card/60 rounded-xl animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 bg-card/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <MessageSquare className="w-5 h-5 text-primary" />
          Avaliações dos Clientes
        </h3>
        <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
          <CardContent className="p-6 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Ainda não há avaliações.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Seja o primeiro a avaliar nosso serviço!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <MessageSquare className="w-5 h-5 text-primary" />
        Avaliações dos Clientes
      </h3>

      {/* Stats Card */}
      <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
        <CardContent className="p-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-primary">{stats.average.toFixed(1)}</p>
            <div className="flex justify-center mt-1">
              {renderStars(Math.round(stats.average))}
            </div>
          </div>
          <div className="h-12 w-px bg-border" />
          <div>
            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">
              {stats.total === 1 ? "avaliação" : "avaliações"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((review) => (
          <Card key={review.id} className="bg-card/60 backdrop-blur-xl border-primary/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {review.profiles?.avatar_url ? (
                    <img 
                      src={review.profiles.avatar_url} 
                      alt={review.profiles?.full_name || "Cliente"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground truncate">
                      {review.profiles?.full_name || "Cliente"}
                    </p>
                    {renderStars(review.rating)}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      "{review.comment}"
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {format(parseISO(review.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
