import React, { useEffect, useState } from "react";

interface AuctionHistoryEntry {
  auctionId: number;
  title: string;
  role: "Buyer" | "Seller";
  highestBidByUser?: number;
  finalPrice?: number;
  closingTime: string;
  won: boolean;
}

export const AuctionHistoryPage: React.FC<{ userId: number }> = ({ userId }) => {
  const [data, setData] = useState<{asBuyer:AuctionHistoryEntry[];asSeller:AuctionHistoryEntry[]}|null>(null);
  const [tab, setTab] = useState<"buyer"|"seller">("buyer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${userId}/auction-history`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="history-loading">Loading your historyâ¦</div>;
  if (!data) return <div className="history-error">Could not load history.</div>;

  const rows = tab === "buyer" ? data.asBuyer : data.asSeller;
  return (
    <div className="auction-history-page">
      <h2>My Auction History</h2>
      <div className="history-tabs">
        <button className={`tab-btn ${tab==="buyer"?"active":""}`} onClick={()=>setTab("buyer")}>As Buyer ({data.asBuyer.length})</button>
        <button className={`tab-btn ${tab==="seller"?"active":""}`} onClick={()=>setTab("seller")}>As Seller ({data.asSeller.length})</button>
      </div>
      {rows.length===0?(<p className="history-empty">{tab==="buyer"?"You haven't bid on anything yet.":"You haven't listed any auctions yet."}</p>):(table className="history-table">
        <thead><tr><th>Item</th>{tab==="buyer"&&<th>Your High Bid</th>}<th>Final Price</th><th>Closed</th>{tab==="buyer"&&<th>Result</th>}</tr></thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.auctionId}>
              <td><a href={`/auctions/${e.auctionId}`}>{e.title}</a></td>
              {tab==="buyer"&&<td>{e.highestBidByUser!=null?$${e.highestBidByUser.toFixed(2)}:"\u2014"</option>}
              <td>{e.finalPrice!=null?$${e.finalPrice.toFixed(2)}:"No bids"}</td>
              <td>{new Date(e.closingTime).toLocaleDateString()}</td>
              {tab==="buyer"&&<td>{new Date(e.closingTime)>new Date()?(<span className="badge-active">Active</span>):e.won?(<span className="badge-won">ð Won</span>):(<span className="badge-lost">Outbid</span>)}</td>}
            </tr>
          ))}
        </tbody>
        </table>)}
    </div>
  );
};
