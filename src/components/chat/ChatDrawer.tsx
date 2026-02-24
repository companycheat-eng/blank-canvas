import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  id: string;
  texto: string;
  autor_id: string;
  autor_tipo: "cliente" | "motorista" | "sistema";
  created_at: string;
}

interface ChatDrawerProps {
  corridaId: string;
  currentUserId: string;
  currentUserType: "cliente" | "motorista";
}

export function ChatDrawer({ corridaId, currentUserId, currentUserType }: ChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const lsKey = `chat-seen-${corridaId}`;

  const getLastSeenId = () => localStorage.getItem(lsKey) || "";
  const setLastSeenId = (id: string) => localStorage.setItem(lsKey, id);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  // Load messages
  useEffect(() => {
    if (!corridaId) return;

    const loadMessages = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const res = await fetch(
        `${baseUrl}/rest/v1/chat_mensagens?select=*&corrida_id=eq.${corridaId}&order=created_at.asc`,
        { headers: { apikey, Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        // Count unread: messages from other party after last seen
        const lastSeen = getLastSeenId();
        const otherMessages = data.filter((m: ChatMessage) => m.autor_tipo !== currentUserType);
        if (lastSeen && otherMessages.length > 0) {
          const lastSeenIdx = otherMessages.findIndex((m: ChatMessage) => m.id === lastSeen);
          setUnreadCount(lastSeenIdx === -1 ? otherMessages.length : otherMessages.length - lastSeenIdx - 1);
        } else if (!lastSeen) {
          setUnreadCount(otherMessages.length);
        }
      }
    };

    loadMessages();
  }, [corridaId]);

  // Realtime subscription
  useEffect(() => {
    if (!corridaId) return;

    const channel = supabase
      .channel(`chat-${corridaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensagens",
          filter: `corrida_id=eq.${corridaId}`,
        },
        (payload: any) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (!wasOpenRef.current && msg.autor_tipo !== currentUserType) {
            setUnreadCount((c) => c + 1);
          }
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [corridaId, currentUserType, scrollToBottom]);

  // Track open state and mark as seen
  useEffect(() => {
    wasOpenRef.current = open;
    if (open) {
      setUnreadCount(0);
      // Mark last message from other party as seen
      const otherMsgs = messages.filter((m) => m.autor_tipo !== currentUserType);
      if (otherMsgs.length > 0) {
        setLastSeenId(otherMsgs[otherMsgs.length - 1].id);
      }
      scrollToBottom();
    }
  }, [open, messages, scrollToBottom]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const res = await fetch(`${baseUrl}/rest/v1/chat_mensagens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${token}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          corrida_id: corridaId,
          autor_id: currentUserId,
          autor_tipo: currentUserType,
          texto: trimmed,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Erro ao enviar mensagem:", err);
        return;
      }
      setNewMessage("");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendMessage(newMessage);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="icon" variant="outline" className="relative h-12 w-12 rounded-full shadow-lg bg-background">
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col h-[60vh] px-4 pb-4">
          {/* Quick replies */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1 scrollbar-none">
            {(currentUserType === "motorista"
              ? ["Estou a caminho!", "Cheguei no local!", "Aguardando você", "Pode descer?", "Obrigado!"]
              : ["Estou descendo!", "Pode aguardar um momento?", "Onde você está?", "Obrigado!", "Já estou no local"]
            ).map((text) => (
              <button
                key={text}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendMessage(text); }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border"
              >
                {text}
              </button>
            ))}
          </div>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma mensagem ainda. Diga olá!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.autor_tipo === currentUserType;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="break-words">{msg.texto}</p>
                    <p className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form
            id="chat-form"
            onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleSend(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
