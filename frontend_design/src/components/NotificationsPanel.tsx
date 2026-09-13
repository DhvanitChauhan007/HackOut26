import { useEffect, useRef, useState } from "react";
import { Bell, Check, Package, Truck, TrendingDown, X } from "lucide-react";

type Notification = {
  id: number;
  message: string;
  sub?: string;
  dot: string;
  icon: React.ReactNode;
  time: string;
  read: boolean;
};

const INITIAL: Notification[] = [
  {
    id: 1,
    message: "Carrier GreenMiles assigned",
    sub: "Lot RL-1022 has a carrier en route.",
    dot: "bg-primary",
    icon: <Truck className="size-4 text-primary" />,
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    message: "Price drop on Cardboard",
    sub: "Lot RL-1048 dropped to ₹11.80/kg.",
    dot: "bg-accent",
    icon: <TrendingDown className="size-4 text-accent-foreground" />,
    time: "18 min ago",
    read: false,
  },
  {
    id: 3,
    message: "Bulk lot BL-009 is live",
    sub: "Open for purchase — 3,200 kg available.",
    dot: "bg-highlight",
    icon: <Package className="size-4 text-foreground" />,
    time: "1 hr ago",
    read: false,
  },
];

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const dismiss = (id: number) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-[calc(100%+8px)] z-50 w-[min(22rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-top-2 duration-200 rounded-2xl border-2 border-foreground/10 bg-card shadow-panel overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <strong className="font-display text-sm">Notifications</strong>
          {unreadCount > 0 && (
            <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/10"
            >
              <Check className="size-3" /> Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-full bg-foreground/5 text-muted-foreground transition-colors hover:bg-foreground/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[22rem] overflow-y-auto divide-y divide-foreground/6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="grid size-10 place-items-center rounded-2xl bg-foreground/5">
              <Bell className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-semibold">All caught up!</p>
            <p className="text-xs text-muted-foreground">No new notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${
                n.read ? "opacity-60" : ""
              }`}
            >
              <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${n.read ? "bg-foreground/5" : "bg-foreground/8"}`}>
                {n.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug ${n.read ? "" : "font-semibold"}`}>
                  {n.message}
                </p>
                {n.sub && (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                    {n.sub}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground/70">{n.time}</p>
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="mt-0.5 hidden shrink-0 group-hover:grid size-6 place-items-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-foreground/8 px-4 py-2.5 text-center">
          <button className="text-xs font-semibold text-primary hover:underline">
            View all activity
          </button>
        </div>
      )}
    </div>
  );
}
