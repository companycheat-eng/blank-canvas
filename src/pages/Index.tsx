import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import splashGif from "@/assets/splash.gif";

// Duration must match the GIF length exactly
const GIF_DURATION_MS = 8000;

export default function Index() {
  const { user, userType, loading } = useAuth();
  const navigate = useNavigate();
  const [gifDone, setGifDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Start fade-out slightly before redirect for a smooth transition
    timerRef.current = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setGifDone(true), 400);
    }, GIF_DURATION_MS - 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gifDone || loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    switch (userType) {
      case "admin_geral":
      case "admin_bairro":
        navigate("/admin", { replace: true });
        break;
      case "motorista":
        navigate("/motorista", { replace: true });
        break;
      case "cliente":
        navigate("/cliente", { replace: true });
        break;
      default:
        navigate("/login", { replace: true });
    }
  }, [user, userType, loading, navigate, gifDone]);

  return (
    <div
      className={`min-h-screen flex items-center justify-center transition-opacity duration-400 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#fcfcff" }}
    >
      <img
        src={splashGif}
        alt="Carreto App"
        style={{
          width: "min(95vw, 95vh)",
          height: "min(95vw, 95vh)",
          objectFit: "contain",
        }}
        draggable={false}
      />
    </div>
  );
}
