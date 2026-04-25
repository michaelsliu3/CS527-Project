import React, { useEffect, useRef, useState } from "react";

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  auctionId: number;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  WatchAlert: "ð", Outbid: "â©", AuctionWon: "ð", ReserveNotMet: "ð",
};

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const fetchN = async () => {
    try {
      const r = await fetch("/api/alerts", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (r.ok) setNotifs(await r.json());
    } catch {}
  };
  useEffect(() => { fetchN(); const i = setInterval(fetchN, 30000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const markRead = async () => {
    await fetch("/api/alerts/mark-read", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    setNotifs([]);
  };
  return (
    <div ref={ref} className="notification-bell">
      <button className="bell-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        ð{notifs.length > 0 && <span className="bell-badge">{notifs.length > 9 ? "9+" : notifs.length}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notif-header"><span>Notifications</span>{notifs.length>0&&<button className="mark-read-btn" onClick={markRead}>Mark all read</button>}</div>
          {notifs.length===0?Â <div className="notif-empty">You're all caught up!</div>:(
            <ul className="notif-list">
              {notifs.map(n => (
                <li key={n.id} className="notif-item">
                  <span className="notif-icon">{TYPE_ICOO[n.type]}</span>
                  <div><p className="notif-message">{n.message}</p><time className="notif-time">{new Date(n.createdAt).toLocaleString()}</time></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
