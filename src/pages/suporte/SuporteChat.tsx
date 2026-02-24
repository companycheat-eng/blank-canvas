import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, ArrowLeft, CheckCircle } from "lucide-react";

interface Msg {
  id: string;
  texto: string;
  autor_id: string;
  autor_tipo: string;
  created_at: string;
}

interface Ticket {
  id: string;
  assunto: string;
  status: string;
  user_tipo: string;
  user_id: string;
}

export default function SuporteChat() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    const load = async () => {
      const [ticketRes, msgsRes] = await Promise.all([
        supabase.from("suporte_tickets").select("*").eq("id", ticketId).single(),
        supabase.from("suporte_mensagens").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      ]);
      if (ticketRes.data) setTicket(ticketRes.data as any);
      if (msgsRes.data) setMessages(msgsRes.data as Msg[]);
      scrollToBottom();

      // Mark as em_andamento if aberto
      if (ticketRes.data && (ticketRes.data as any).status === "aberto") {
        await supabase.from("suporte_tickets").update({ status: "em_andamento" }).eq("id", ticketId);
      }
    };
    load();

    const channel = supabase
      .channel(`suporte-chat-${ticketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "suporte_mensagens", filter: `ticket_id=eq.${ticketId}` }, (payload: any) => {
        const msg = payload.new as Msg;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        scrollToBottom();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId, scrollToBottom]);

  const handleSend = async () => {
    if (!newMsg.trim() || sending || !ticketId || !user) return;
    setSending(true);
    await supabase.from("suporte_mensagens").insert({
      ticket_id: ticketId,
      autor_id: user.id,
      autor_tipo: "suporte",
      texto: newMsg.trim(),
    });
    setNewMsg("");
    setSending(false);
  };

  const handleClose = async () => {
    if (!ticketId) return;
    await supabase.from("suporte_tickets").update({ status: "fechado" }).eq("id", ticketId);
    setTicket((t) => t ? { ...t, status: "fechado" } : t);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (!ticket) return <div className="py-8 text-center text-muted-foreground animate-pulse">Carregando...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] py-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suporte")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{ticket.assunto}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{ticket.user_tipo}</Badge>
            <Badge variant={ticket.status === "fechado" ? "secondary" : "default"}>{ticket.status}</Badge>
          </div>
        </div>
        {ticket.status !== "fechado" && (
          <Button variant="outline" size="sm" onClick={handleClose}>
            <CheckCircle className="h-4 w-4 mr-1" /> Fechar
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem.</p>}
        {messages.map((msg) => {
          const isMine = msg.autor_tipo === "suporte";
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
                <p className="break-words">{msg.texto}</p>
                <p className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      {ticket.status !== "fechado" && (
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Responder..." className="flex-1" />
          <Button type="submit" size="icon" disabled={!newMsg.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}
