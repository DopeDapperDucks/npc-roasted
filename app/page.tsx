"use client";
import { useState } from "react";

type RoastResult = { tokenId: string; collection: string; imageDataUrl: string; roast: string; headline: string; stats: { label: string; value: string }[]; traitsSeen: string[] };
const LEVELS = ["Mild", "Spicy", "Absolutely Cooked"] as const;
export default function Home() {
  const [tokenId, setTokenId] = useState("");
  const [collection, setCollection] = useState("npc");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Spicy");
  const [result, setResult] = useState<RoastResult|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function roast() {
setError(""); setResult(null); setBusy(true);
    try {
      const res = await fetch("/api/roast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tokenId,collection,level})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not roast that NFT.");
      setResult(data);
    } catch (e) {setError(e instanceof Error ? e.message : "Something went wrong.");}
    finally {setBusy(false);}
  }
  async function downloadCard() {
    if (!result) return;
    try {
      const c = document.createElement("canvas"); c.width=1200; c.height=1500;
      const ctx=c.getContext("2d"); if(!ctx) return;
      ctx.fillStyle="#101014";ctx.fillRect(0,0,1200,1500);
      ctx.fillStyle="#ff6b29";ctx.fillRect(0,0,1200,22);
      ctx.fillStyle="#ffffff";ctx.font="bold 85px Arial";ctx.fillText("NPC ROASTED.",72,128);
      ctx.fillStyle="#a5a5ab";ctx.font="32px Arial";ctx.fillText(`${result.collection.toUpperCase()} #${result.tokenId}  /  ${level.toUpperCase()}`,74,180);
      const image=new Image();image.src=result.imageDataUrl; await new Promise<void>((resolve,reject)=>{ image.onload=()=>resolve();image.onerror=reject; });
      ctx.fillStyle="#23232a";ctx.fillRect(72,220,1056,720);
      const scale=Math.min(1056/image.width,720/image.height);const w=image.width*scale,h=image.height*scale;
      ctx.drawImage(image,72+(1056-w)/2,220+(720-h)/2,w,h);
      ctx.fillStyle="#ff6b29";ctx.font="bold 32px Arial";ctx.fillText("THE VERDICT",74,1012);
      ctx.fillStyle="#ffffff";ctx.font="bold 46px Arial";
      const words=result.roast.split(/\s+/);let line="",y=1075;
      for (const word of words){const t=line?line+" "+word:word;if(ctx.measureText(t).width>1040 && line){ctx.fillText(line,74,y);line=word;y+=59;}else line=t;}
      if(line)ctx.fillText(line,74,y);
      ctx.fillStyle="#85858d";ctx.font="28px Arial";ctx.fillText("NO WALLET. NO MERCY. JUST BAD DECISIONS.",74,1444);
      const link=document.createElement("a");link.download=`npc-roasted-${result.tokenId}.png`;link.href=c.toDataURL("image/png");link.click();
    } catch {setError("Could not export the image. Please try again.");}
  }
  function share() { if(!result)return; const text=`NPC #${result.tokenId} just got roasted 🔥\n\n“${result.roast}”\n\n#NPCRoasted`;window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer"); }
  return <main className="shell"><header><div className="brand"><span className="flame">🔥</span> NPC ROASTED<span className="dot">.</span></div><div className="tag">YOUR JPEG HAS FEELINGS. WE DON'T.</div></header>
    <section className="hero"><div className="eyebrow">THE MOST UNNECESSARY NFT UTILITY EVER</div><h1>YOUR NFT IS ABOUT TO GET <em>COOKED.</em></h1><p>Enter a token ID. Our AI examines the actual artwork and delivers a roast as questionable as your character's fashion sense.</p></section>
    <div className="columns"><section className="panel"><div className="heading">01 / CHOOSE YOUR VICTIM</div><label htmlFor="collection">COLLECTION</label><select id="collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="npc">Non-Playable Characters (NPC)</option><option value="pc">Playable Characters (PC)</option></select><label htmlFor="token">TOKEN ID</label><input id="token" inputMode="numeric" pattern="[0-9]*" maxLength={30} placeholder="e.g. 8458" value={tokenId} onChange={e=>setTokenId(e.target.value.replace(/[^0-9]/g,""))}/><label>BRUTALITY LEVEL</label><div className="levels">{LEVELS.map(l=><button type="button" key={l} className={l===level?"active":""} onClick={()=>setLevel(l)}>{l}</button>)}</div><button className="primary" disabled={busy||!tokenId} onClick={roast}>{busy?"PREPARING THE DAMAGE...":"🔥 ROAST MY NPC"}</button><p className="hint">100% free to try · No wallet connection · Original artwork stays intact</p>{error&&<p role="alert" className="error">{error}</p>}</section>
    <section className="panel result"><div className="heading">02 / THE DAMAGE REPORT</div>{result?<><div className="art"><img src={result.imageDataUrl} alt={`${result.collection} #${result.tokenId}`} /></div><div className="victim">{result.collection.toUpperCase()} #{result.tokenId} · {result.headline}</div><blockquote>“{result.roast}”</blockquote><div className="stats">{result.stats.map((s,i)=><div key={i}><small>{s.label}</small><strong>{s.value}</strong></div>)}</div><div className="actions"><button onClick={downloadCard}>↓ DOWNLOAD CARD</button><button onClick={share}>↗ SHARE TO X</button><button onClick={roast} disabled={busy}>↻ ROAST AGAIN</button></div></>:<div className="empty"><span>💀</span><h2>NO VICTIMS YET</h2><p>Pick an NPC. We'll judge their life choices based on their appearance.</p></div>}</section></div><footer>NPC ROASTED · BUILT FOR LAUGHS, NOT FINANCIAL ADVICE · Unofficial MVP placeholder branding</footer></main>;
}
