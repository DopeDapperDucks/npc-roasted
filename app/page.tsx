"use client";
import { useState } from "react";

type Stat = {label:string; value:string; score:number};
type RoastResult = {tokenId:string; collection:string; imageDataUrl:string; roast:string; headline:string; stats:Stat[]; cookedLevel:number; traitsSeen:string[]};
const LEVELS = ["Mild", "Spicy", "Absolutely Cooked"] as const;
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;
const INK = "#202321", PAPER = "#f4f3ed", PALE = "#e7e7df", ACCENT = "#bd5a40";

// Canvas helpers receive a non-null context explicitly: no ctx! assertions needed.
function box(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function fitted(ctx:CanvasRenderingContext2D,text:string,maxW:number,start:number,min:number,weight="700"){
  let size=start;
  while(size>min){ctx.font=`${weight} ${size}px Arial, sans-serif`;if(ctx.measureText(text).width<=maxW)break;size-=2;}
  return size;
}
function lines(ctx:CanvasRenderingContext2D,text:string,maxW:number,size:number,maxLines:number){
  ctx.font=`700 ${size}px Arial, sans-serif`;
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
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas is unavailable");
  ctx.fillStyle="#d6d5cf";ctx.fillRect(0,0,1200,1600);
  box(ctx,35,35,1130,1530,30,PAPER,INK);
  box(ctx,55,55,1090,88,13,INK);
  ctx.fillStyle=PAPER;ctx.font="700 38px Arial, sans-serif";ctx.fillText("non playable character.",83,112);
  ctx.textAlign="right";ctx.font="700 24px Arial, sans-serif";ctx.fillText("ROAST SERIES 001",1112,108);ctx.textAlign="left";
  const img=new Image();img.src=result.imageDataUrl;
  await new Promise<void>((ok,bad)=>{if(img.complete&&img.naturalWidth){ok();return;}img.onload=()=>ok();img.onerror=()=>bad(new Error("Artwork failed to load"));});
  // Keep NFT artwork original and uncropped within a square viewport.
  box(ctx,74,153,1052,752,16,PALE,INK);
  const fit=Math.min(1018/img.naturalWidth,718/img.naturalHeight);
  const iw=img.naturalWidth*fit,ih=img.naturalHeight*fit;
  ctx.drawImage(img,600-iw/2,529-ih/2,iw,ih);
  ctx.fillStyle=INK;ctx.font="700 27px Arial, sans-serif";ctx.fillText(`${result.collection.toUpperCase()} #${result.tokenId}`,80,948);
  ctx.textAlign="right";ctx.fillStyle=ACCENT;ctx.fillText("CERTIFIED COOKED",1118,948);ctx.textAlign="left";
  ctx.fillStyle=INK;
  const title=(result.headline||"ABSOLUTELY COOKED").toUpperCase();
  const titleSize=fitted(ctx,title,1030,53,30);ctx.font=`700 ${titleSize}px Arial, sans-serif`;ctx.fillText(title,80,1008,1030);
  ctx.fillStyle="#3c403d";
  let roastSize=34;let roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,10);
  while(roastLines.length>2&&roastSize>25){roastSize-=2;roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,10);}
  roastLines=lines(ctx,`“${result.roast}”`,1020,roastSize,2);
  ctx.font=`700 ${roastSize}px Arial, sans-serif`;roastLines.forEach((line,i)=>ctx.fillText(line,80,1060+i*43,1020));
  const statY=Math.max(1140,1060+(roastLines.length-1)*43+44),statW=505,statH=101;
  for(let i=0;i<4;i++){
    const s=result.stats[i]||{label:"UNKNOWN",value:"N/A",score:0};
    const score=clamp(Number(s.score));
    const x=78+(i%2)*539,y=statY+Math.floor(i/2)*114;
    box(ctx,x,y,statW,statH,10,PALE,"#c3c4bc");
    ctx.fillStyle=ACCENT;ctx.fillRect(x+16,y+15,5,statH-30);
    ctx.textAlign="right";ctx.fillStyle="#8a8c84";ctx.font="700 16px Arial, sans-serif";
    ctx.fillText(`${score}/100`,x+statW-18,y+28);ctx.textAlign="left";
    ctx.fillStyle="#767a74";ctx.font="700 18px Arial, sans-serif";
    ctx.fillText(s.label.toUpperCase(),x+34,y+27,statW-146);
    ctx.fillStyle=INK;const size=fitted(ctx,s.value,statW-65,27,17);
    ctx.font=`700 ${size}px Arial, sans-serif`;ctx.fillText(s.value,x+34,y+61,statW-60);
    ctx.fillStyle="#cacbc2";ctx.fillRect(x+34,y+79,statW-68,8);
    ctx.fillStyle=ACCENT;ctx.fillRect(x+34,y+79,(statW-68)*score/100,8);
  }
  const cook=clamp(Number(result.cookedLevel));
  const cookY=statY+2*114+10;
  box(ctx,78,cookY,1040,86,11,INK);
  ctx.fillStyle=PAPER;ctx.font="700 23px Arial, sans-serif";ctx.fillText("COOKED LEVEL",101,cookY+30);
  ctx.textAlign="right";ctx.fillStyle="#ffc1a9";ctx.font="700 29px Arial, sans-serif";
  ctx.fillText(`${cook}/100`,1090,cookY+32);ctx.textAlign="left";
  ctx.fillStyle="#525653";ctx.fillRect(101,cookY+51,990,12);
  ctx.fillStyle=ACCENT;ctx.fillRect(101,cookY+51,990*cook/100,12);
  ctx.fillStyle=INK;ctx.fillRect(78,1520,1040,2);
  ctx.font="700 21px Arial, sans-serif";ctx.fillText("NPC ROASTED  /  NO WALLET. NO MERCY.",78,1549);
  ctx.textAlign="right";ctx.fillStyle=ACCENT;ctx.fillText("npconchain.com",1120,1549);ctx.textAlign="left";
  return canvas;
}

export default function Home(){
  const [tokenId,setTokenId]=useState("");
  const [collection,setCollection]=useState("npc");
  const [level,setLevel]=useState<(typeof LEVELS)[number]>("Spicy");
  const [result,setResult]=useState<RoastResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function roast(){
    setError("");setResult(null);setBusy(true);
    try{const res=await fetch("/api/roast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tokenId,collection,level})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not roast that NFT.");setResult(data);
    }catch(e){setError(e instanceof Error?e.message:"Something went wrong.");}finally{setBusy(false);}
  }
  async function downloadCard(){if(!result)return;try{
    const canvas=await makeCard(result);const link=document.createElement("a");
    link.download=`npc-roasted-${result.collection}-${result.tokenId}.png`;
    link.href=canvas.toDataURL("image/png");document.body.appendChild(link);link.click();link.remove();
  }catch(e){console.error(e);setError("Unable to export the card. Please try again.");}}
  function share(){if(!result)return;const text=`NPC #${result.tokenId} just got roasted 🔥\n\n“${result.roast}”\n\nTry yours: https://npconchain.com\n#NPCRoasted`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");}
  return <main className="shell">
    <header><div className="brand">non playable character<span className="dot">.</span> <span className="brand-accent">ROASTED</span></div><div className="tag">NPC WORLD / LAB 001</div></header>
    <section className="hero"><div className="eyebrow">YOUR CHARACTER. OUR BAD ATTITUDE.</div><h1>you're about to get <em>roasted.</em></h1><p>Pick a character. We analyze the actual NFT artwork, deliver a short roast, and make a collectible damage report. No wallet required.</p></section>
    <div className="columns"><section className="panel"><div className="heading">01 / CHOOSE YOUR VICTIM</div>
      <label htmlFor="collection">COLLECTION</label><select id="collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="npc">Non-Playable Characters (NPC)</option><option value="pc">Playable Characters (PC)</option></select>
      <label htmlFor="token">TOKEN ID</label><input id="token" inputMode="numeric" pattern="[0-9]*" maxLength={30} placeholder="e.g. 8458" value={tokenId} onChange={e=>setTokenId(e.target.value.replace(/[^0-9]/g,""))}/>
      <label>BRUTALITY LEVEL</label><div className="levels">{LEVELS.map(l=><button type="button" key={l} className={l===level?"active":""} onClick={()=>setLevel(l)}>{l}</button>)}</div>
      <button className="primary" disabled={busy||!tokenId} onClick={roast}>{busy?"PREPARING THE DAMAGE...":"ROAST MY NPC →"}</button>
      <p className="hint">Free to try · No wallet required · Original NFT artwork</p>{error&&<p role="alert" className="error">{error}</p>}</section>
      <section className="panel result"><div className="heading">02 / THE DAMAGE REPORT</div>{result?<>
        <div className="art"><img src={result.imageDataUrl} alt={`${result.collection} #${result.tokenId}`} /></div>
        <div className="victim">{result.collection.toUpperCase()} #{result.tokenId} · {result.headline}</div>
        <blockquote>“{result.roast}”</blockquote>
        <div className="stats">{result.stats.map((s,i)=><div key={i}><small>{s.label} · {clamp(Number(s.score))}/100</small><strong>{s.value}</strong><div aria-label={`${s.label}: ${clamp(Number(s.score))} out of 100`} style={{height:7,background:"#cccfc7",marginTop:9,borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${clamp(Number(s.score))}%`,background:ACCENT,borderRadius:8}} /></div></div>)}</div>
        <div style={{background:INK,color:PAPER,padding:"17px 20px",borderRadius:12,marginTop:15,display:"flex",flexDirection:"column",gap:10}}><div style={{display:"flex",justifyContent:"space-between",fontWeight:800}}><span>COOKED LEVEL</span><span>{clamp(Number(result.cookedLevel))}/100</span></div><div style={{height:10,background:"#505451",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${clamp(Number(result.cookedLevel))}%`,background:ACCENT}} /></div></div>
        <div className="actions"><button onClick={downloadCard}>↓ DOWNLOAD CARD</button><button onClick={share}>↗ SHARE TO X</button><button onClick={roast} disabled={busy}>↻ ROAST AGAIN</button></div>
      </>:<div className="empty"><span>◉</span><h2>no victims yet.</h2><p>Enter a token ID. We're judging the character, not the owner.</p></div>}</section>
    </div><footer>NPC ROASTED · BUILT FOR THE CULTURE · npconchain.com</footer>
  </main>;
}
