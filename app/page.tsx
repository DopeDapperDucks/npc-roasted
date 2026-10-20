"use client";
import { useState } from "react";

type Stat = {label:string; value:string; score:number};
type RoastResult = {tokenId:string; collection:string; imageDataUrl:string; roast:string; headline:string; stats:Stat[]; cookedLevel:number; traitsSeen:string[]};
const LEVELS = ["Mild", "Spicy", "Absolutely Cooked"] as const;
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;
const INK = "#ffffff", PAPER = "#1a1a1a", PALE = "#252525", ACCENT = "#ffffff";

// Canvas helpers receive a non-null context explicitly: no ctx! assertions needed.
function box(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function fitted(ctx:CanvasRenderingContext2D,text:string,maxW:number,start:number,min:number,weight="700"){
  let size=start;
  while(size>min){ctx.font=`${weight} ${size}px Inter, sans-serif`;if(ctx.measureText(text).width<=maxW)break;size-=2;}
  return size;
}
function lines(ctx:CanvasRenderingContext2D,text:string,maxW:number,size:number,maxLines:number){
  ctx.font=`700 ${size}px Inter, sans-serif`;
  const words=text.split(/\s+/).filter(Boolean),out:string[]=[];let line="";
  for(const word of words){const candidate=line?`${line} ${word}`:word;
    if(ctx.measureText(candidate).width<=maxW){line=candidate;continue;}
    if(line)out.push(line);line=word;
  }
  if(line)out.push(line);
  if(out.length<=maxLines)return out;
  const cut=out.slice(0,maxLines);let end=cut[maxLines-1];
  while(end.length && ctx.measureText(end+"…").width>maxW)end=end.slice(0,-1);
  cut[maxLines-1]=end.trimEnd()+"…";return cut;
}
async function makeCard(result:RoastResult){
  const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=1600;
  await Promise.all([document.fonts.load("400 53px Sigmar"),document.fonts.load("700 34px Inter"),document.fonts.load("500 24px JetBrains Mono")]);
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas is unavailable");
  ctx.fillStyle="#1a1a1a";ctx.fillRect(0,0,1200,1600);
  box(ctx,35,35,1130,1530,30,PAPER,INK);
  box(ctx,55,55,1090,88,13,PALE);
  ctx.fillStyle=INK;ctx.font="400 38px Sigmar, sans-serif";ctx.fillText("NPC Roasted.",150,112);
  const logo=new Image();logo.src="/npc/npc-logo.png";await logo.decode();ctx.drawImage(logo,83,73,52,52);
  ctx.textAlign="right";ctx.font="500 24px JetBrains Mono, monospace";ctx.fillText("ROAST SERIES 001",1112,108);ctx.textAlign="left";
  const img=new Image();img.src=result.imageDataUrl;
  await new Promise<void>((ok,bad)=>{if(img.complete&&img.naturalWidth){ok();return;}img.onload=()=>ok();img.onerror=()=>bad(new Error("Artwork failed to load"));});
  // Keep NFT artwork original and uncropped within a square viewport.
  box(ctx,74,153,1052,752,16,PALE,INK);
  const fit=Math.min(1018/img.naturalWidth,718/img.naturalHeight);
  const iw=img.naturalWidth*fit,ih=img.naturalHeight*fit;
  ctx.drawImage(img,600-iw/2,529-ih/2,iw,ih);
  ctx.fillStyle=INK;ctx.font="500 27px JetBrains Mono, monospace";ctx.fillText(`${result.collection.toUpperCase()} #${result.tokenId}`,80,948);
  ctx.textAlign="right";ctx.fillStyle=ACCENT;ctx.fillText("CERTIFIED COOKED",1118,948);ctx.textAlign="left";
  ctx.fillStyle=INK;
  const title=(result.headline||"roasted").replace(/[.!?]+$/, "")+".";
  const titleSize=44;ctx.font=`400 ${titleSize}px Sigmar, sans-serif`;ctx.fillText(title,80,1008,1030);
  ctx.fillStyle="#ffffffbf";
  let roastSize=34;let roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,10);
  while(roastLines.length>2&&roastSize>25){roastSize-=2;roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,10);}
  roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,2);
  ctx.font=`700 ${roastSize}px Inter, sans-serif`;roastLines.forEach((line,i)=>ctx.fillText(line,80,1060+i*43,1020));
  const statY=Math.max(1140,1060+(roastLines.length-1)*43+44),statW=505,statH=101;
  for(let i=0;i<4;i++){
    const s=result.stats[i]||{label:"UNKNOWN",value:"N/A",score:0};
    const score=clamp(Number(s.score));
    const x=78+(i%2)*539,y=statY+Math.floor(i/2)*114;
    box(ctx,x,y,statW,statH,10,PALE,"#ffffff26");
    ctx.fillStyle=ACCENT;ctx.fillRect(x+16,y+15,5,statH-30);
    ctx.textAlign="right";ctx.fillStyle="#bfbfbf";ctx.font="500 16px JetBrains Mono, monospace";
    ctx.fillText(`${score}/100`,x+statW-18,y+28);ctx.textAlign="left";
    ctx.fillStyle="#bfbfbf";ctx.font="500 18px JetBrains Mono, monospace";
    ctx.fillText(s.label.toUpperCase(),x+34,y+27,statW-146);
    ctx.fillStyle=INK;const size=fitted(ctx,s.value,statW-65,27,17);
    ctx.font=`700 ${size}px Inter, sans-serif`;ctx.fillText(s.value,x+34,y+61,statW-60);
    ctx.fillStyle="#454545";ctx.fillRect(x+34,y+79,statW-68,8);
    ctx.fillStyle=ACCENT;ctx.fillRect(x+34,y+79,(statW-68)*score/100,8);
  }
  const cook=clamp(Number(result.cookedLevel));
  const cookY=statY+2*114+10;
  box(ctx,78,cookY,1040,86,11,INK);
  ctx.fillStyle=PAPER;ctx.font="700 23px Inter, sans-serif";ctx.fillText("COOKED LEVEL",101,cookY+30);
  ctx.textAlign="right";ctx.fillStyle="#1a1a1a";ctx.font="500 29px JetBrains Mono, monospace";
  ctx.fillText(`${cook}/100`,1090,cookY+32);ctx.textAlign="left";
  ctx.fillStyle="#b0b0b0";ctx.fillRect(101,cookY+51,990,12);
  ctx.fillStyle=PAPER;ctx.fillRect(101,cookY+51,990*cook/100,12);
  ctx.fillStyle=INK;ctx.fillRect(78,1520,1040,2);
  ctx.font="700 21px Inter, sans-serif";ctx.fillText("NPC ROASTED / CHARACTER REPORT",78,1549);
  ctx.textAlign="right";ctx.fillStyle=ACCENT;ctx.fillText("npconchain.xyz",1120,1549);ctx.textAlign="left";
  return canvas;
}

export default function Home(){
  const [tokenId,setTokenId]=useState("");
  const [collection,setCollection]=useState("npc");
  const [level,setLevel]=useState<(typeof LEVELS)[number]>("Spicy");
  const [result,setResult]=useState<RoastResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [exporting,setExporting]=useState(false);
  const [notice,setNotice]=useState("");
  async function roast(){
    if(busy)return;setError("");setNotice("");setBusy(true);
    try{const res=await fetch("/api/roast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tokenId,collection,level})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not roast that NFT.");setResult(data);
    }catch(e){setError(e instanceof Error?e.message:"Something went wrong.");}finally{setBusy(false);}
  }
  async function downloadCard(){if(!result||exporting)return;setExporting(true);setError("");try{
    const canvas=await makeCard(result);const link=document.createElement("a");
    link.download=`npc-roasted-${result.collection}-${result.tokenId}.png`;
    link.href=canvas.toDataURL("image/png");document.body.appendChild(link);link.click();link.remove();setNotice("Card downloaded.");
  }catch(e){console.error(e);setError("Unable to export the card. Please try again.");}finally{setExporting(false);}}
  function share(){if(!result)return;const text=`${result.collection.toUpperCase()} #${result.tokenId} got a character report.\n\n“${result.roast}”\n\nTry yours: ${window.location.origin}\n#NPCRoasted`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");}
  return <main className="shell">
    <a className="skip" href="#roast-form">Skip to roast form</a>
    <header className="nav"><a className="brand" href="/" aria-label="NPC Roasted home"><img src="/npc/npc-logo.png" alt="" width="40" height="40"/><span>NPC Roasted.</span></a><a className="nav-link" href="https://npconchain.xyz" target="_blank" rel="noopener noreferrer">NPC world ↗</a></header>
    <section className="hero"><p className="eyebrow">NPC / CHARACTER REPORT</p><h1>standing there.<br/>getting roasted.</h1><p>Pick an NPC or PC. Get a roast based on its artwork and a card to keep. No wallet needed.</p></section>
    <div className="columns">
      <form id="roast-form" className="panel controls" onSubmit={e=>{e.preventDefault();void roast();}}>
        <p className="eyebrow">STEP 01 / THE CHARACTER</p><h2>pick an extra.</h2>
        <fieldset disabled={busy}><legend className="sr-only">Character and roast settings</legend>
          <label htmlFor="collection">Collection</label><select id="collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="npc">Non Playable Character · NPC</option><option value="pc">Playable Character · PC</option></select>
          <label htmlFor="token">Token ID</label><input id="token" required inputMode="numeric" pattern="[0-9]*" maxLength={30} placeholder="e.g. 777" aria-describedby="token-help" value={tokenId} onChange={e=>setTokenId(e.target.value.replace(/[^0-9]/g,""))}/><p id="token-help" className="hint">Enter a token ID from your chosen collection.</p>
          <fieldset className="intensity"><legend>Roast level</legend><div className="levels">{LEVELS.map(l=><label key={l} className={l===level?"level active":"level"}><input type="radio" name="level" value={l} checked={l===level} onChange={()=>setLevel(l)}/><span>{l}</span></label>)}</div></fieldset>
          <button className="primary" disabled={busy||!tokenId} type="submit">{busy?"Generating roast…":"Generate roast"}<span aria-hidden="true">→</span></button>
        </fieldset><p className="hint reassurance">Original artwork. Fictional ratings. No wallet connection.</p>
        <div role="status" aria-live="polite" className="status">{busy?"Loading artwork and generating your report. This may take a moment.":notice}</div>{error&&<p role="alert" className="error">{error}</p>}
      </form>
      <section className="panel report" aria-labelledby="report-title" aria-busy={busy}>
        <div className="report-heading"><p className="eyebrow">STEP 02 / THE REPORT</p><span className="badge">{busy?"Generating":result?"Roasted":"Awaiting character"}</span></div>
        {result?<><div className="art"><img src={result.imageDataUrl} alt={`${result.collection.toUpperCase()} #${result.tokenId} original artwork`}/></div>
          <p className="eyebrow identity">{result.collection.toUpperCase()} #{result.tokenId}</p><h2 id="report-title">{result.headline.replace(/[.!?]+$/, "")}.</h2><blockquote>“{result.roast}”</blockquote>
          <div className="stats">{result.stats.map((s,i)=><div className="stat" key={i}><div className="stat-label"><span>{s.label}</span><span>{clamp(Number(s.score))}/100</span></div><strong>{s.value}</strong><meter min="0" max="100" value={clamp(Number(s.score))} aria-label={s.label}/></div>)}</div>
          <div className="cooked"><div className="stat-label"><span>Cooked level</span><span>{clamp(Number(result.cookedLevel))}/100</span></div><meter min="0" max="100" value={clamp(Number(result.cookedLevel))} aria-label="Cooked level"/></div>
          <div className="actions"><button onClick={downloadCard} disabled={exporting||busy}>{exporting?"Exporting…":"Download card ↓"}</button><button onClick={share} disabled={busy}>Share to X ↗</button><button onClick={roast} disabled={busy}>Roast again ↻</button></div>
        </>:<div className="empty"><div className="character-stage"><img src="/npc/tier-6-white.png" alt="Official white Playable Character, standing still" width="240" height="360"/></div><h2 id="report-title">nothing to report.</h2><p>they've said nothing.<br/>we'll take it from here.</p><span className="eyebrow">Your report appears here</span></div>}
      </section>
    </div><aside className="footnote"><span className="eyebrow">SMALL PRINT / BIG HEADS</span><p>AI-generated jokes about fictional characters. The character gets roasted. The holder doesn't.</p></aside>
    <footer><img src="/npc/npc-logo.png" alt="NPC" width="28" height="28"/><span>NPC Roasted / background checks.</span><a href="https://npconchain.xyz">npconchain.xyz ↗</a></footer>
  </main>;
}
