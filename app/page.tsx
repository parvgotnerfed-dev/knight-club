"use client";
import {useState,useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {ArrowLeftRight, Moon, Sun, Check, CircleHelp, Copy, Flag, Globe2, History, Infinity as InfinityIcon, Link2, ListOrdered, LoaderCircle, Monitor, Plus, Users, Volume2, VolumeX, X} from "lucide-react";
import {newClock,presets,remaining,switchClock,type Preset,type Clock} from "../lib/clock";
import {position,ending,type Game,type Side} from "../lib/rules";
import type {Square,PieceSymbol} from "../lib/chess/engine.js";
const name={w:"White",b:"Black"};
const pieces:Record<PieceSymbol,string>={p:"pawn",r:"rook",n:"knight",b:"bishop",q:"queen",k:"king"};
const blank:Game={id:"",moves:[],joined:true,resigned:null,revision:0,side:null};
const read=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}};
const save=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}};
function token(){
  const saved=read("kc-player");
  if(saved)return saved;
  const generated=crypto.randomUUID();save("kc-player",generated);
  if(!read("kc-player"))throw Error("Allow browser storage to take a seat in an online room.");
  return generated;
}
async function api(id:string,body?:object):Promise<Game>{
  const res=await fetch("/api/room"+(id?"?id="+encodeURIComponent(id):""),{method:body?"POST":"GET",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token()},body:body?JSON.stringify(body):undefined,cache:"no-store"});
  if(!res.ok){let msg="Could not reach the room. Try again.";try{const details=await res.json() as {error?:string};msg=details.error||msg}catch{}throw Error(msg)}
  return res.json();
}
function loadLocal(){try{const data=JSON.parse(read("kc-local")||"null");if(data && Array.isArray(data.moves)){position(data.moves);return {...blank,moves:data.moves,clock:data.clock,resigned:data.resigned||null}}}catch{}return blank}
function formatTime(ms:number){const sec=Math.ceil(ms/1000);return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")}
function ClockFace({clock,side,offset}:{clock:Clock;side:Side;offset:{current:number}}){
 const [,refresh]=useState(0);
 useEffect(()=>{
   if(clock.active!==side)return;
   let timer:ReturnType<typeof setTimeout>;
   function update(){
     clearTimeout(timer);
     const left=remaining(clock,side,Date.now()+offset.current);
     refresh(n=>n+1);
     if(left>0&&!document.hidden)timer=setTimeout(update,(left%1000||1000)+2);
   }
   update();
   document.addEventListener("visibilitychange",update);
   return ()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",update)};
 },[clock,side,offset]);
 return <>{formatTime(remaining(clock,side,Date.now()+offset.current))}</>;
}
function ThemeButton(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{
   const media=matchMedia("(prefers-color-scheme: dark)");
   function sync(){const mode=read("kc-theme")||(media.matches?"dark":"light");document.documentElement.dataset.theme=mode;setDark(mode==="dark")}
   sync();media.addEventListener("change",sync);window.addEventListener("storage",sync);
   return ()=>{media.removeEventListener("change",sync);window.removeEventListener("storage",sync)};
 },[]);
 return <button className="iconBtn" aria-label="Dark mode" aria-pressed={dark} title={dark?"Switch to light mode":"Switch to dark mode"} onClick={()=>{const mode=dark?"light":"dark";save("kc-theme",mode);document.documentElement.dataset.theme=mode;setDark(!dark)}}>{dark?<Sun/>:<Moon/>}</button>;
}
function Checker(){return <span className="checker" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i}/>)}</span>}
export default function Page(){
 const [table,setTable]=useState<Game>(blank),[room,setRoom]=useState(""),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[issue,setIssue]=useState(""),[msg,setMsg]=useState("");
 const [selection,select]=useState<Square|null>(null),[flip,setFlip]=useState(false),[sound,setSound]=useState(true),[modal,setModal]=useState(""),[promotion,setPromotion]=useState<Square|null>(null),[copied,setCopied]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),history=useRef<HTMLDivElement>(null),active=useRef(""),lastPing=useRef(-1),audio=useRef<AudioContext|null>(null),soundRef=useRef(true),lock=useRef(false);
 const [preset,setPreset]=useState<Preset>("untimed"),[,refreshExpiry]=useState(0);
 const offset=useRef(0);
 useEffect(()=>{
   const clock=table.clock;
   if(!clock?.active)return;
   let timer:ReturnType<typeof setTimeout>;
   function schedule(){
     clearTimeout(timer);refreshExpiry(n=>n+1);
     const left=remaining(clock!,clock!.active!,Date.now()+(room?offset.current:0));
     if(left>0)timer=setTimeout(schedule,left+1);
   }
   schedule();document.addEventListener("visibilitychange",schedule);
   return ()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",schedule)};
 },[table.clock,room]);
 const now=Date.now()+(room?offset.current:0);
 const flagged=table.clock?.active && remaining(table.clock,table.clock.active,now)===0?table.clock.active:null;
 const chess=useMemo(()=>position(table.moves),[table.moves]), turn=chess.turn(),result=ending(chess,table.resigned)||(flagged?(flagged==="w"?"Black":"White")+" wins on time":""),online=!!room;
 const legal=useMemo(()=>selection?chess.moves({square:selection,verbose:true}):[],[chess,selection]);
 const canMove=ready&&!loading&&!busy&&!result&&(!online||(table.joined&&table.side===turn));
 const latest=useMemo(()=>chess.history({verbose:true}).at(-1),[chess]);
 const board=useRef<HTMLDivElement>(null);
 const previous=useRef({id:table.id,count:table.moves.length});
 useLayoutEffect(()=>{
   const prior=previous.current;
   previous.current={id:table.id,count:table.moves.length};
   if(!latest||prior.id!==table.id||table.moves.length!==prior.count+1||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
   const slide=(from:string,to:string)=>{
     const origin=board.current?.querySelector<HTMLElement>('[data-square="'+from+'"]');
     const dest=board.current?.querySelector<HTMLElement>('[data-square="'+to+'"]');
     const img=dest?.querySelector("img");
     if(!origin||!dest||!img)return;
     const a=origin.getBoundingClientRect(),b=dest.getBoundingClientRect();
     const anim=img.animate([{transform:"translate("+ (a.left-b.left)+"px,"+(a.top-b.top)+"px)"},{transform:"translate(0,0)"}],{duration:155,easing:"cubic-bezier(.2,.7,.3,1)"});
     img.style.zIndex="4";anim.onfinish=()=>{img.style.zIndex=""};
   };
   slide(latest.from,latest.to);
   if(latest.isKingsideCastle()||latest.isQueensideCastle()){const rank=latest.to[1];slide((latest.isKingsideCastle()?"h":"a")+rank,(latest.isKingsideCastle()?"f":"d")+rank)}
 },[latest,table.id,table.moves.length]);
 function ping(){const ctx=audio.current;if(!soundRef.current||!ctx||ctx.state!=="running")return;const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(530,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(225,ctx.currentTime+.07);g.gain.setValueAtTime(.085,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1)}
 function unlock(){if(soundRef.current){try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>{})}catch{}}}
 useEffect(()=>{const onLoad=()=>{const id=new URL(location.href).searchParams.get("room")||"";active.current=id;offset.current=0;setRoom(id);setTable(id?blank:loadLocal());setLoading(!!id);setIssue("");setFlip(false);select(null);setModal("");lastPing.current=-1};
 onLoad();setReady(true);soundRef.current=read("kc-sound")!=="off";setSound(soundRef.current);window.addEventListener("popstate",onLoad);return()=>window.removeEventListener("popstate",onLoad)},[]);
 function apply(g:Game){if(active.current!==g.id)return;if(g.serverNow)offset.current=g.serverNow-Date.now();setTable(old=>old.id===g.id&&old.revision>=g.revision?old:g);setIssue("");setLoading(false);if(lastPing.current>=0&&g.moves.length>lastPing.current)ping();lastPing.current=Math.max(lastPing.current,g.moves.length)}
 useEffect(()=>{if(!room)return;let alive=true,inFlight=false,first=true;
 const refresh=async()=>{if(inFlight||(!first&&document.hidden))return;inFlight=true;try{const g=await api(room);if(!alive||active.current!==room)return;apply(g);if(first&&g.side==="b")setFlip(true);first=false}catch(e){if(alive)setIssue((e as Error).message)}finally{inFlight=false}};
 void refresh();const t=setInterval(refresh,1800);document.addEventListener("visibilitychange",refresh);return()=>{alive=false;clearInterval(t);document.removeEventListener("visibilitychange",refresh)}},[room]);
 useEffect(()=>{if(modal&&!dialog.current?.open)dialog.current?.showModal();if(!modal&&dialog.current?.open)dialog.current.close()},[modal]);
 useEffect(()=>{if(history.current)history.current.scrollTop=history.current.scrollHeight;select(null)},[table.moves.length,table.id]);
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(""),3500);return()=>clearTimeout(t)},[msg]);
 useEffect(()=>{if(!copied)return;const t=setTimeout(()=>setCopied(false),2500);return()=>clearTimeout(t)},[copied]);
 function route(id:string){offset.current=0;const u=new URL(location.href);if(id)u.searchParams.set("room",id);else u.searchParams.delete("room");window.history.pushState(null,"",u);active.current=id;lastPing.current=-1;setRoom(id);select(null);setIssue("");setFlip(false)}
 function local(next:Game){setTable(next);save("kc-local",JSON.stringify(next))}
 function leave(){route("");setLoading(false);setTable(loadLocal());setModal("")}
 async function action(body:Record<string,unknown>){if(lock.current)return;lock.current=true;setBusy(true);const origin=active.current;try{const g=await api(origin,{...body,revision:table.revision});if(active.current!==origin)return;if(body.action==="create")route(g.id);apply(g);if(body.action==="join")setFlip(true);setModal(body.action==="create"?"invite":"")}catch(e){setMsg((e as Error).message)}finally{lock.current=false;setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(location.href);setCopied(true)}catch{setModal("invite");setMsg("Select and copy the room link.")}}
 function play(to:Square,piece?:string){const move=legal.find(m=>m.to===to&&(!m.promotion||m.promotion===piece));if(!move||!canMove)return;select(null);setModal("");if(online){void action({action:"move",san:move.san})}else{const at=Date.now();if(table.clock?.active&&remaining(table.clock,turn,at)===0)return;const moves=[...table.moves,move.san];local({...table,moves,clock:switchClock(table.clock,at,true,!!ending(position(moves),null))});ping()}}
 function pick(sq:Square){unlock();if(!canMove)return;if(selection===sq){select(null);return}if(legal.some(m=>m.to===sq)){if(legal.some(m=>m.to===sq&&m.promotion)){setPromotion(sq);setModal("promote")}else play(sq);return}select(chess.get(sq)?.color===turn?sq:null)}
 function player(side:Side){const playing=turn===side&&!result&&(!online||table.joined)&&!loading;return <div className="player"><div className={'avatar '+side}><img src={'/pieces/'+side+'n.svg'} alt=""/></div><strong>{name[side]}</strong>{playing&&<span className="turn"><i/>To move</span>}{online&&table.side===side&&<small>You</small>}{online&&side==="b"&&!table.joined&&<small>Open seat</small>}<span className="time">{table.clock?<ClockFace clock={table.clock} side={side} offset={offset}/>:<><InfinityIcon size={19}/>Untimed</>}</span></div>}
 const state=loading?(issue?"Room unavailable":"Connecting…"):result||(online&&!table.side?(table.joined?"Both seats are taken":"A seat is open"):online&&!table.joined?"Waiting for a friend":chess.isCheck()?name[turn]+" is in check":name[turn]+" to move");
 const rows=flip?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1],files=(flip?"hgfedcba":"abcdefgh").split("");
 return <><header><div className="bar"><div className="brand"><Checker/>Knight Club<span className="brand-dot">.</span></div><nav><ThemeButton/><button className="iconBtn" aria-label={sound?"Mute sound":"Enable sound"} title={sound?"Mute sound":"Enable sound"} onClick={()=>{soundRef.current=!sound;setSound(!sound);save("kc-sound",sound?"off":"on");if(!sound)unlock()}}>{sound?<Volume2/>:<VolumeX/>}</button><span className="divider"/><button className="helpBtn" onClick={()=>setModal("help")}><CircleHelp size={17}/>How to play</button></nav></div></header>
 <main><div className="heading"><h1>The chess room<span>.</span></h1><span className="mode">{online?<Globe2/>:<Monitor/>}{online?"Online room":"Local play"}</span></div>
 <div className="layout"><section className="game" aria-label="Chess game">{player(flip?"w":"b")}
 <div ref={board} className="board" role="group" aria-label="Chessboard">{rows.map((rank,row)=>files.map((file,col)=>{const sq=(file+rank) as Square,p=chess.get(sq),light=(row+col)%2===0,target=legal.some(m=>m.to===sq);return <button data-square={sq} key={sq} className={['sq',light?'light':'dark',latest&&(latest.to===sq||latest.from===sq)?'last':'',selection===sq?'selected':'',p?.type==='k'&&p.color===turn&&chess.isCheck()?'check':''].join(' ')} aria-label={sq+(p?", "+name[p.color]+" "+pieces[p.type]:"")+(target?", legal move":"")} aria-pressed={selection===sq} onClick={()=>pick(sq)}>{p&&<img src={'/pieces/'+p.color+p.type+'.svg'} alt="" draggable="false"/>}{col===0&&<span className="rank">{rank}</span>}{row===7&&<span className="file">{file}</span>}{target&&<i className={p?"capture":"dot"}/>}</button>}))}</div>
 {player(flip?"b":"w")}</section>
 <aside><section className="invite"><img className="art" src="/table-art.svg" alt=""/><div className="inviteText"><span className="eyebrow"><Users size={15}/>MULTIPLAYER</span><h2>{online?"Online room":"Play a friend"}</h2><p>{!online?"Share a link and meet across the board.":loading?"Connecting to your table.":!table.side?(table.joined?"Both players have joined.":"Take the black pieces to play."):(table.joined?"Both players are at the table.":"Your friend can take the black pieces.")}</p><button className="inviteBtn" disabled={!ready||busy||loading} onClick={()=>!online?setModal("create"):!table.side&&!table.joined?action({action:"join"}):setModal("invite")}>{busy?<LoaderCircle size={16}/>:online&&!table.side&&!table.joined?<Users size={16}/>:<Link2 size={17}/>} {!online?"Create invite link":!table.side&&!table.joined?"Join game":"Room link"}</button></div></section>
 <section className="history panel"><div className="panelTitle"><div><ListOrdered/><h2>Move history</h2></div><span className="count">{table.moves.length}</span></div><div className="log" ref={history}>{!table.moves.length?<div className="empty"><div className="emptyIcon"><History size={25}/></div><strong>No moves yet</strong><p>Your moves will appear here.</p></div>:<table aria-label="Move history"><thead><tr><th>#</th><th>White</th><th>Black</th></tr></thead><tbody>{table.moves.filter((_,i)=>i%2===0).map((m,i)=><tr key={i}><td>{i+1}.</td><td>{m}</td><td>{table.moves[i*2+1]||"—"}</td></tr>)}</tbody></table>}</div><div className="status" role="status"><i/>{state}</div></section>
 <section className="controls panel"><div className="panelTitle"><div><img src="/pieces/bp.svg" alt=""/><h2>Table controls</h2></div></div><div className="controlRow"><button onClick={()=>setFlip(!flip)}><ArrowLeftRight/>Flip board</button><button onClick={()=>setModal("new")}><Plus/>New game</button></div>{online&&<div className="extra"><button onClick={leave}>Local board</button>{table.side&&table.joined&&!result&&<button onClick={()=>setModal("resign")}><Flag size={14}/>Resign</button>}</div>}</section>
 {issue&&<div className="error" role="alert">{issue} <button onClick={leave}>Return to local play</button></div>}</aside></div>
 <footer><span><Checker/>Knight Club</span><span>Chess for two</span></footer></main>
 {msg&&<div role="status" className="toast">{msg}</div>}
 <dialog ref={dialog} onCancel={()=>setModal("")} onClick={e=>{if(e.target===dialog.current)setModal("")}}><div className="dialogTop"><Checker/><button className="iconBtn" aria-label="Close" onClick={()=>setModal("")}><X size={20}/></button></div>
 {modal==="help"?<><h2>How to play</h2><p>Pick one of your pieces to see its legal moves. Select a highlighted square to move there. White moves first.</p><h3>Across two screens</h3><p>Create an invite link and send it to your friend. They choose <b>Join game</b> to play Black. Reopen the room in the same browser to resume.</p><h3>On one screen</h3><p>Take turns on the local board. Use <b>Flip board</b> to see the position from the other side.</p><button className="primary" onClick={()=>setModal("")}>Back to the board</button></>:modal==="invite"?<><h2>Invite a friend</h2><p>Send this room link to your friend. The first person to join takes the black pieces.</p><label htmlFor="link">Room link</label><input id="link" readOnly value={typeof location!=="undefined"?location.href:""} onFocus={e=>e.target.select()}/><button className="primary" onClick={copy}>{copied?<Check/>:<Copy/>}{copied?"Copied!":"Copy invite link"}</button></>:modal==="promote"?<><h2>Promote your pawn</h2><p>Choose the piece for your promotion.</p><div className="promos">{(["q","r","b","n"] as const).map(p=><button key={p} aria-label={pieces[p]} onClick={()=>promotion&&play(promotion,p)}><img src={'/pieces/'+turn+p+'.svg'} alt=""/>{pieces[p]}</button>)}</div></>:modal==="resign"?<><h2>Resign this game?</h2><p>Your friend will win by resignation.</p><button className="primary" disabled={busy} onClick={()=>action({action:"resign"})}>Resign game</button></>:(modal==="new"||modal==="create")?<><h2>{modal==="create"?"Create online game":"New game"}</h2><label htmlFor="preset">Time per player</label><select id="preset" value={preset} onChange={e=>setPreset(e.target.value as Preset)}>{Object.entries(presets).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>{preset==="3+2"&&<p>Three minutes each, plus two seconds per move.</p>}<p>{online||modal==="create"?"Create a fresh room and share its new invite link. Your current room stays available at its original link.":table.moves.length?"Start from the opening position? This replaces the game on this device.":"Start a fresh game on this device."}</p><button className="primary" disabled={busy} onClick={()=>{if(online||modal==="create"){void action({action:"create",preset});return}local({...blank,clock:newClock(preset,true)});select(null);setFlip(false);setModal("")}}>{online||modal==="create"?"Create invite link":"Start new game"}</button></>:null}</dialog>
 </>;
}
