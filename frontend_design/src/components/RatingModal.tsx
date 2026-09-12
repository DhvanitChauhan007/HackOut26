import { useState } from "react";
import { Star, X } from "lucide-react";

export function RatingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  rateeName 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  rateeName: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div 
        role="dialog" 
        aria-modal="true" 
        onMouseDown={(e) => e.stopPropagation()} 
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-panel"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl font-semibold">Rate Transaction</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-foreground/5">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          How was your experience working with {rateeName}?
        </p>
        
        <div className="my-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star 
                className={`size-8 \${(hoverRating || rating) >= star ? "fill-primary text-primary" : "text-foreground/20"}`} 
              />
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Comments (optional)</label>
            <textarea 
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              placeholder="Leave feedback about the material quality, communication, or logistics..."
            />
          </div>
          <button 
            disabled={rating === 0}
            onClick={() => onSubmit(rating, comment)}
            className="w-full rounded-full bg-primary py-3 font-display font-semibold text-primary-foreground disabled:opacity-50 shadow-button-accent"
          >
            Submit Rating
          </button>
        </div>
      </div>
    </div>
  );
}
