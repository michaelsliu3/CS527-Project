import React, { useState } from "react";

interface ItemFields {
  title: string;
  category: string;
  subcategory: string;
  condition: string;
  keySpecs: string;
}

interface AiDescriptionAssistantProps {
  itemFields: ItemFields;
  onDescriptionGenerated: (desc: string) => void;
}

/**
 * NOVELTY FEATURE: AI listing description assistant.
 * Sends item fields to the backend AI endpoint (api/ai/describe-item)
 * and returns a polished buyer-focused description.
 */
export const AiDescriptionAssistant: React.FC<AiDescriptionAssistantProps> = ({ itemFields, onDescriptionGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [tone, setTone] = useState<"professional" | "casual" | "enthusiastic">("professional");
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!itemFields.title.trim()) { setError("Please enter an item title first."); return; }
    setError(null); setLoading(true); setPreview(null);
    const prompt = `You are an expert auction listing writer for BuyMe.\nWrite a compelling item description (3-4 sentences, no title).\nItem: ${itemFields.title} | ${itemFields.category} > ${itemFields.subcategory} | ${itemFields.condition}\nSpecs: ${itemFields.keySpecs || "N/A"}\nTone: ${tone}`;
    try {
      const res = await fetch("/api/ai/describe-item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPreview(data.description ?? "");
    } catch { setError("Could not generate description. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <span className="ai-badge">â¦ AI Assist</span>
        <p className="ai-subtitle">Let AI write a compelling description based on your item's details.</p>
      </div>
      <div className="tone-selector">
        <label>Tone:</label>
        {(["professional", "casual", "enthusiastic"] as const).map(t => (
          <button key={t} className={`tone-btn ${tone===t?"active":""}`} onClick={()=>setTone(t)} type="button">{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <button className="generate-btn" onClick={generate} disabled={loading} type="button">
        {loading ? "Generatingâ¦" : "â¦ Generate Description"}
      </button>
      {error && <p className="ai-error">{error}</p>}
      {preview && (
        <div className="ai-preview">
          <div className="ai-preview-label">Preview</div>
          <p className="ai-preview-text">{preview}</p>
          <div className="ai-preview-actions">
            <button onClick={()=>{onDescriptionGenerated(preview);setPreview(null);}} type="button" className="use-btn">Use This</button>
            <button onClick={()=>{setPreview(null);generate();}} type="button" className="regen-btn">Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
};
