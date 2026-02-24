import { useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split("/").pop() || "Página";

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center">
        <p className="text-2xl font-bold capitalize">{pageName}</p>
        <p className="text-muted-foreground mt-2">Em construção</p>
      </div>
    </div>
  );
}
