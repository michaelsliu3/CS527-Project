import React, { useState } from "react";

const CATEGORIES = [
  { label: "Computers", value: "computers" },
  { label: "Clothing", value: "clothing" },
  { label: "Vehicles", value: "vehicles" },
];

const SUBCATEGORIES: Record<string, string[]> = {
  computers: ["Laptops", "Desktops", "Tablets", "Components"],
  clothing: ["Shirts", "Pants", "Shoes", "Accessories"],
  vehicles: ["Cars", "Motorcycles", "Trucks", "Boats"],
};

export const WatchAlertForm: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [status, setStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords && !category) { setStatus("error"); return; }
    setStatus("saving");
    try {
      const res = await fetch("/api/alerts/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ keywords: keywords||null, category: category||null, subcategory: subcategory||null, maxPrice: maxPrice?parseFloat(maxPrice):null }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved"); onCreated?.();
    } catch { setStatus("error"); }
  };

  return (
    <form className="watch-alert-form" onSubmit={handleSubmit}>
      <h3>Set Item Watch Alert</h3>
      <p className="form-hint">Get notified when a matching item goes up for auction.</p>
      <label>Keywords<inzn´ype="text" placeholder='e.g. "RTX 4080"' value={keywords} onChange={e => setKeywords(enet.target.value)} /></label>
      <label>Category<select value={category} onChange={e => {setCategory(e.target.value);setSubcategory("");}}><option value="">Any</option>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      {category && <label>Subcategory<select value={subcategory} onChange={e => setSubcategory(e.target.value)}><option value="">Any</option>{(SUBCATEGORIES[category]||[]).map(s => <option key={s} value={s}>{s}</option>)}</select></label>}
      <label>Max Price ($)<input type="number" min="0" step="0.01" placeholder="No limit" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
      <button type="submit" disabled={status==="saving"}>{ status==="saving"?"Savingâ¦":"ð Set Alert"}</button>
      {status==="saved"&&<p className="form-success">Alert saved!</p>}
      {status==="error"&&<p className="form-error">Please enter at least a keyword or category.</p>}
    </form>
  );
};
