import { Star } from "lucide-react";

interface StarRatingProps {
  nota: number;
  size?: "sm" | "md";
}

export function StarRating({ nota, size = "sm" }: StarRatingProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  
  return (
    <span className={`inline-flex items-center gap-0.5 ${textSize}`}>
      <Star className={`${iconSize} fill-warning text-warning`} />
      <span className="font-semibold">{Number(nota).toFixed(1)}</span>
    </span>
  );
}
