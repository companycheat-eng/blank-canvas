import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { User } from "lucide-react";

interface ZoomableAvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg";
  fallbackIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function ZoomableAvatar({ src, alt, size = "md", fallbackIcon }: ZoomableAvatarProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-secondary flex items-center justify-center shrink-0`}>
        {fallbackIcon || <User className="h-6 w-6 text-muted-foreground" />}
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-primary/20 cursor-pointer hover:ring-2 ring-primary/40 transition-all shrink-0`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-2 bg-transparent border-none shadow-none [&>button]:text-white">
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
