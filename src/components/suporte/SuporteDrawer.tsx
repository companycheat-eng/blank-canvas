import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Plus, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Ticket {
  id: string;
  assunto: string;
  status: string;
  created_at: string;
}

interface Msg {
  id: string;
  texto: string;
  autor_tipo: string;
  created_at: string;
}

interface SuporteDrawerProps {
  userTipo: "cliente" | "motorista";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuporteDrawer({ userTipo, open, onOpenChange }: SuporteDrawerProps) {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [assunto, setAssunto] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  // Reset view when closed
  useEffect(() => {
    if (!open) { setView("list"); setActiveTicket(null); }
  }, [open]);

  // Load tickets
  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("suporte_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      setTickets((data as Ticket[]) || []);
      setLoading(false);
    };
    load();
  }, [open, user]);

  // Load messages when ticket selected
  useEffect(() => {
    if (view !== "chat" || !activeTicket) return;
    const load = async () => {
      const { data } = await supabase
        .from("suporte_mensagens")
        .select("*")
        .eq("ticket_id", activeTicket.id)
        .order("created_at", { ascending: true });
      setMessages((data as Msg[]) || []);
      scrollToBottom();
    };
    load();

    const channel = supabase
      .channel(`user-suporte-${activeTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "suporte_mensagens", filter: `ticket_id=eq.${activeTicket.id}` }, (payload: any) => {
        const msg = payload.new as Msg;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        scrollToBottom();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [view, activeTicket, scrollToBottom]);

  const createTicket = async () => {
    if (!assunto.trim() || !user) return;
    setSending(true);
    const { data } = await supabase.from("suporte_tickets").insert({
      user_id: user.id,
      user_tipo: userTipo,
      assunto: assunto.trim(),
    }).select().single();
    if (data) {
      setActiveTicket(data as any);
      setView("chat");
      setAssunto("");
    }
    setSending(false);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || sending || !activeTicket || !user) return;
    setSending(true);
    await supabase.from("suporte_mensagens").insert({
      ticket_id: activeTicket.id,
      autor_id: user.id,
      autor_tipo: "usuario",
      texto: newMsg.trim(),
    });
    setNewMsg("");
    setSending(false);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const statusColor = (s: string) => s === "aberto" ? "destructive" : s === "em_andamento" ? "default" : "secondary";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setView("list"); setActiveTicket(null); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DrawerTitle>
              {view === "list" ? "Suporte" : view === "new" ? "Novo Ticket" : activeTicket?.assunto}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex flex-col h-[60vh] px-4 pb-4">
          {view === "list" && (
            <>
              <Button className="mb-3" onClick={() => setView("new")}>
                <Plus className="h-4 w-4 mr-2" /> Novo Ticket
              </Button>
              {loading ? (
                <p className="text-center text-muted-foreground py-8 animate-pulse">Carregando...</p>
              ) : tickets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum ticket ainda.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {tickets.map((t) => (
                    <Card key={t.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setActiveTicket(t); setView("chat"); }}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate flex-1">{t.assunto}</p>
                          <Badge variant={statusColor(t.status) as any} className="text-[10px]">{t.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(t.created_at)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {view === "new" && (
            <div className="space-y-4">
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Descreva seu problema..." maxLength={200} />
              <Button onClick={createTicket} disabled={!assunto.trim() || sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Ticket
              </Button>
            </div>
          )}

          {view === "chat" && activeTicket && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
                {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Envie uma mensagem para iniciar.</p>}
                {messages.map((msg) => {
                  const isMine = msg.autor_tipo === "usuario";
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
              {activeTicket.status !== "fechado" ? (
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} onPointerDown={(e) => e.stopPropagation()} className="flex gap-2">
                  <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Digite sua mensagem..." className="flex-1" autoFocus maxLength={1000} />
                  <Button type="submit" size="icon" disabled={!newMsg.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-2">Ticket fechado.</p>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
