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
      const c = document.createElement("canvas");
      c.width = 1200; c.height = 1600;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable");
      const orange = "#ff6b29";
      const white = "#f9f7f4";
      const muted = "#a3a3ae";
      const card = "#202027";
      const edge = "#383841";

      function roundedRect(x:number,y:number,w:number,h:number,r:number,fill:string) {
ctx!.beginPath(); ctx!.roundRect(x,y,w,h,r);ctx!.fillStyle=fill;ctx!.fill();
      }
      function fittedLine(text:string,maxWidth:number,size:number,minSize:number,weight="bold") {
        let fontSize=size;
do {ctx!.font=`${weight} ${fontSize}px Arial, sans-serif`;if(ctx!.measureText(text).width<=maxWidth)break;fontSize-=2;} while(fontSize>=minSize);
        return fontSize;
      }
      function wrapText(text:string,maxWidth:number,fontSize:number,maxLines:number):string[] {
        ctx.font=`bold ${fontSize}px Arial, sans-serif`;
        const words=text.trim().split(/\s+/);
        const lines:string[]=[];
        let current="";
        for(const word of words){
          const attempt=current?current+" "+word:word;
          if(ctx.measureText(attempt).width<=maxWidth){current=attempt;continue;}
          if(current){lines.push(current);current=word;}
          else {lines.push(word);current="";}
        }
        if(current)lines.push(current);
        if(lines.length>maxLines){
          const cropped=lines.slice(0,maxLines);
          let last=cropped[maxLines-1];
          while(last.length && ctx.measureText(last+"…").width>maxWidth)last=last.slice(0,-1);
          cropped[maxLines-1]=last.trimEnd()+"…";
          return cropped;
        }
        return lines;
      }

      ctx.fillStyle="#111116";ctx.fillRect(0,0,1200,1600);
      ctx.fillStyle=orange;ctx.fillRect(0,0,1200,18);
      ctx.font="bold 84px Arial, sans-serif";ctx.fillStyle=white;
      ctx.fillText("NPC ROASTED.",64,122);
      ctx.font="bold 25px Arial, sans-serif";ctx.fillStyle=orange;
      ctx.fillText("OFFICIAL DAMAGE REPORT",70,170);
      ctx.font="27px Arial, sans-serif";ctx.fillStyle=muted;
      ctx.textAlign="right";
      ctx.fillText(`${result.collection.toUpperCase()} #${result.tokenId}`,1130,168);
      ctx.textAlign="left";

      // Artwork is drawn inside a fixed viewport without distorting the NFT.
      roundedRect(64,207,1072,694,22,card);
      const nftImage = new Image();
      nftImage.src=result.imageDataUrl;
      await new Promise<void>((resolve,reject)=>{
        if(nftImage.complete && nftImage.naturalWidth>0){resolve();return;}
        nftImage.onload=()=>resolve();nftImage.onerror=()=>reject(new Error("Artwork failed to load"));
      });
      const ratio=Math.min(1072/nftImage.naturalWidth,694/nftImage.naturalHeight);
      const dw=nftImage.naturalWidth*ratio,dh=nftImage.naturalHeight*ratio;
      ctx.drawImage(nftImage,64+(1072-dw)/2,207+(694-dh)/2,dw,dh);
      ctx.strokeStyle=edge;ctx.lineWidth=2;ctx.strokeRect(64,207,1072,694);

      ctx.font="bold 26px Arial, sans-serif";ctx.fillStyle=orange;
      ctx.fillText("THE VERDICT",68,951);
      const headline=(result.headline||"ABSOLUTELY COOKED").toUpperCase();
      const headlineSize=fittedLine(headline,1060,37,22);
      ctx.font=`bold ${headlineSize}px Arial, sans-serif`;ctx.fillStyle=white;
      ctx.fillText(headline,68,1000);

      // Keep the full joke whenever possible; scale it before truncating.
      const roastText=`“${result.roast}”`;
      let roastSize=43;
      let roastLines=wrapText(roastText,1055,roastSize,99);
      while(roastLines.length>4 && roastSize>28){roastSize-=2;roastLines=wrapText(roastText,1055,roastSize,99);}
      roastLines=wrapText(roastText,1055,roastSize,4);
      ctx.font=`bold ${roastSize}px Arial, sans-serif`;ctx.fillStyle=white;
      roastLines.forEach((line,i)=>ctx.fillText(line,68,1062+i*(roastSize+14)));

      // Stat boxes are always included in the PNG, not only on the webpage.
      const statStart=1300,statW=519,statH=104,gapX=26,gapY=16;
      const stats=result.stats.slice(0,4);
      for(let i=0;i<4;i++){
        const stat=stats[i]||{label:"UNKNOWN",value:"N/A"};
        const x=64+(i%2)*(statW+gapX);
        const y=statStart+Math.floor(i/2)*(statH+gapY);
        roundedRect(x,y,statW,statH,15,card);
        ctx.fillStyle=orange;ctx.font="bold 20px Arial, sans-serif";
        ctx.fillText(stat.label.toUpperCase().slice(0,36),x+22,y+35);
        const valueSize=fittedLine(stat.value,statW-44,31,18);
        ctx.fillStyle=white;ctx.font=`bold ${valueSize}px Arial, sans-serif`;
        ctx.fillText(stat.value,x+22,y+78,statW-44);
      }
      ctx.fillStyle=edge;ctx.fillRect(64,1546,1072,2);
      ctx.fillStyle=muted;ctx.font="bold 23px Arial, sans-serif";
      ctx.fillText("NO WALLET. NO MERCY. JUST BAD DECISIONS.",68,1580);
      ctx.textAlign="right";ctx.fillStyle=orange;
      ctx.fillText("#NPCRoasted",1130,1580);
      ctx.textAlign="left";

      const link=document.createElement("a");
      link.download=`npc-roasted-${result.collection}-${result.tokenId}.png`;
      link.href=c.toDataURL("image/png");
      document.body.appendChild(link);link.click();link.remove();
    } catch(e) {
      console.error("Roast card export failed",e);
      setError("Could not export the image. Please try again.");
    }
  }
  function share() { if(!result)return; const text=`NPC #${result.tokenId} just got roasted 🔥\n\n“${result.roast}”\n\n#NPCRoasted`;window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer"); }
  return <main className="shell"><header><div className="brand"><span className="flame">🔥</span> NPC ROASTED<span className="dot">.</span></div><div className="tag">YOUR JPEG HAS FEELINGS. WE DON'T.</div></header>
    <section className="hero"><div className="eyebrow">THE MOST UNNECESSARY NFT UTILITY EVER</div><h1>YOUR NFT IS ABOUT TO GET <em>COOKED.</em></h1><p>Enter a token ID. Our AI examines the actual artwork and delivers a roast as questionable as your character's fashion sense.</p></section>
    <div className="columns"><section className="panel"><div className="heading">01 / CHOOSE YOUR VICTIM</div><label htmlFor="collection">COLLECTION</label><select id="collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="npc">Non-Playable Characters (NPC)</option><option value="pc">Playable Characters (PC)</option></select><label htmlFor="token">TOKEN ID</label><input id="token" inputMode="numeric" pattern="[0-9]*" maxLength={30} placeholder="e.g. 8458" value={tokenId} onChange={e=>setTokenId(e.target.value.replace(/[^0-9]/g,""))}/><label>BRUTALITY LEVEL</label><div className="levels">{LEVELS.map(l=><button type="button" key={l} className={l===level?"active":""} onClick={()=>setLevel(l)}>{l}</button>)}</div><button className="primary" disabled={busy||!tokenId} onClick={roast}>{busy?"PREPARING THE DAMAGE...":"🔥 ROAST MY NPC"}</button><p className="hint">100% free to try · No wallet connection · Original artwork stays intact</p>{error&&<p role="alert" className="error">{error}</p>}</section>
    <section className="panel result"><div className="heading">02 / THE DAMAGE REPORT</div>{result?<><div className="art"><img src={result.imageDataUrl} alt={`${result.collection} #${result.tokenId}`} /></div><div className="victim">{result.collection.toUpperCase()} #{result.tokenId} · {result.headline}</div><blockquote>“{result.roast}”</blockquote><div className="stats">{result.stats.map((s,i)=><div key={i}><small>{s.label}</small><strong>{s.value}</strong></div>)}</div><div className="actions"><button onClick={downloadCard}>↓ DOWNLOAD CARD</button><button onClick={share}>↗ SHARE TO X</button><button onClick={roast} disabled={busy}>↻ ROAST AGAIN</button></div></>:<div className="empty"><span>💀</span><h2>NO VICTIMS YET</h2><p>Pick an NPC. We'll judge their life choices based on their appearance.</p></div>}</section></div><footer>NPC ROASTED · BUILT FOR LAUGHS, NOT FINANCIAL ADVICE · Unofficial MVP placeholder branding</footer></main>;
}
