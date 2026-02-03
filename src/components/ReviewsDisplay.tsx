import { useState, useEffect, useCallback } from "react";
import { Star, MessageSquare, User, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from "embla-carousel-react";

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
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true, 
    align: "start",
    slidesToScroll: 1,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const updateButtons = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    updateButtons();

    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi]);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
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

    const userIds = reviewsData.map(r => r.user_id);
    const { data: profilesData } = await supabase
      .rpc("get_reviewer_profiles", { reviewer_user_ids: userIds });

    const reviewsWithProfiles = reviewsData.map(review => ({
      ...review,
      profiles: profilesData?.find((p: { user_id: string }) => p.user_id === review.user_id) || null,
    }));

    setReviews(reviewsWithProfiles);

    const total = reviewsData.length;
    const average = reviewsData.reduce((sum, r) => sum + r.rating, 0) / total;
    setStats({ average, total });

    setLoading(false);
  };

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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-card/60 rounded-xl animate-pulse" />
        <div className="h-32 bg-card/60 rounded-xl animate-pulse" />
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

  // Use carousel for 2+ reviews
  const useCarousel = reviews.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <MessageSquare className="w-5 h-5 text-primary" />
          Avaliações dos Clientes
        </h3>
        
        {useCarousel && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-primary/30 hover:bg-primary/10"
              onClick={scrollPrev}
              disabled={!canScrollPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-primary/30 hover:bg-primary/10"
              onClick={scrollNext}
              disabled={!canScrollNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

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

      {/* Reviews Carousel or Single Review */}
      {useCarousel ? (
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_calc(50%-8px)]"
              >
                <Card className="bg-card/60 backdrop-blur-xl border-primary/10 h-full">
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
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="bg-card/60 backdrop-blur-xl border-primary/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {reviews[0].profiles?.avatar_url ? (
                  <img 
                    src={reviews[0].profiles.avatar_url} 
                    alt={reviews[0].profiles?.full_name || "Cliente"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground truncate">
                    {reviews[0].profiles?.full_name || "Cliente"}
                  </p>
                  {renderStars(reviews[0].rating)}
                </div>
                {reviews[0].comment && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                    "{reviews[0].comment}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground/60 mt-2">
                  {format(parseISO(reviews[0].created_at), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
