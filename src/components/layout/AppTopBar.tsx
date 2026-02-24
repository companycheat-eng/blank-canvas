import { Truck, LogOut, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AppTopBarProps {
  title?: string;
  showUser?: boolean;
  onSuporteClick?: () => void;
  showSuporteButton?: boolean;
  variant?: "default" | "admin";
}

export const AppTopBar = ({ title = "Carreto App", showUser = true, onSuporteClick, showSuporteButton = false, variant = "default" }: AppTopBarProps) => {
  const { user, signOut } = useAuth();

  const bgClass = variant === "admin" ? "bg-foreground" : "bg-primary";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 ${bgClass} text-primary-foreground shadow-md`}>
      <div className="absolute left-4 flex items-center gap-2">
        {showSuporteButton && onSuporteClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSuporteClick}
            className="text-primary-foreground hover:bg-primary/20"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Truck className="h-6 w-6 text-primary-foreground" />
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      </div>
      {showUser && user && (
        <div className="absolute right-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-primary-foreground hover:bg-primary/20"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      )}
    </header>
  );
};
