import React, { useEffect, useState } from "react";

interface SimilarAuction {
  auctionId: number;
  title: string;
  category: string;
  subcategory: string;
  currentPrice: number;
  closingTime: string;
  thumbnailUrl?: string;
}

export const SimilarItems: React.FC<{ auctionId: number }> = ({ auctionId }) => {
  const [items, setItems] = useState<SimilarAuction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/auctions/${auctionId}/similar`)
      .then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [auctionId]);

  if (loading || items.length === 0) return null;

  const timeLeft = (t: string) => {
    const ms = new Date(t).getTime() - Date.now();
    if (ms <= 0) return "Closed";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 24 ? `${Math.floor(h / 24)}d left` : `${h}h ${m}m left`;
  };

  return (
    <section className="similar-items-section">
      <h3 className="similar-title">Similar Items (Last 30 Days)</h3>
      <div className="similar-grid">
        {items.map(item => (
          <a key={item.auctionId} href={`/auctions/${item.auctionId}`} className="similar-card">
            <div className="similar-thumb">
              {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} /> : <div className="similar-thumb-placeholder">ð¼</div>}
            </div>
            <div className="similar-info">
              <p className="similar-item-title">{item.title}</p>
              <p className="similar-price">$ {item.currentPrice.toFixed(2)}</p>
              <p className="similar-category">{item.category} âº {item.subcategory}</p>
              <p className="similar-time">{timeLeft(item.closingTime)}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};
