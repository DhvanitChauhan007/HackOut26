import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Notice({ dot, text }: { dot: string; text: string }) {
  return (
    <div className="flex gap-3 border-t border-foreground/8 py-3 first:border-0">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
      <p className="text-sm leading-snug">{text}</p>
    </div>
  );
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, fetch initial notifications from API here
    // And subscribe to realtime events
    const fetchNotifications = async () => {
      // Mock for now
      setNotifications([
        { id: 1, message: "Carrier GreenMiles assigned to RL-1022.", dot: "bg-primary" },
        { id: 2, message: "Cardboard lot RL-1048 dropped to ₹11.80/kg.", dot: "bg-accent" },
        { id: 3, message: "Bulk lot BL-009 is open for purchase.", dot: "bg-highlight" },
      ]);
    };
    
    fetchNotifications();
  }, []);

  return (
    <div className="absolute right-4 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-2 border-foreground/10 bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <strong className="font-display">Notifications</strong>
        <span className="text-xs text-muted-foreground">{notifications.length} new</span>
      </div>
      {notifications.map((n) => (
        <Notice key={n.id} dot={n.dot || "bg-primary"} text={n.message} />
      ))}
      {notifications.length === 0 && (
        <p className="text-sm text-muted-foreground py-2 text-center">No new notifications</p>
      )}
    </div>
  );
}
