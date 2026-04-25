import React, { useEffect, useState } from "react";

interface BidEntry {
  id: number;
  bidder: string;
  amount: number;
  placedAt: string;
  isAutoBid: boolean;
}

export const BidHistoryPanel: React.FC<{ auctionId: number }> = ({ auctionId }) => {
  const [bids, setBids] = useState<BidEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/auctions/${auctionId}/bids`)
      .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setBids).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [auctionId]);

  if (loading) return <div className="bid-history-loading">Loading bidsâ¦</div>;
  if (error) return <div className="bid-history-error">{error}</div>;
  if (bids.length === 0) return <div className="bid-history-empty">No bids yet. Be the first!</div>;

  return (
    <div className="bid-history-panel">
      <h3 className="bid-history-title">Bid History ({bids.length})</h3>
      <table className="bid-history-table">
        <thead><tr><th>#</th><th>Bidder</th><th>Amount</th><th>Time</th><th>Type</th></tr></thead>
        <tbody>
          {bids.map((bid, i) => (
            <tr key={bid.id} className={i === 0 ? "bid-row-top" : "bid-row"}>
              <td>{bids.length - i}</td>
              <td className="bid-bidder">{bid.bidder}</td>
              <td className="bid-amount">${bid.amount.toFixed(2)}</td>
              <td className="bid-time">{new Date(bid.placedAt).toLocaleString()}</td>
              <td><span className={`bid-type-badge ${bid.isAutoBid ? "auto" : "manual"}`}>{bid.isAutoBid ? "Auto" : "Manual"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
