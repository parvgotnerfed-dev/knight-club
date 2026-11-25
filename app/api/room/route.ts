import {presets,newClock,remaining,switchClock,type Preset} from "../../../lib/clock";
import { env } from "cloudflare:workers";
import { position, ending, type Side } from "../../../lib/rules";
export const dynamic = "force-dynamic";
type Row = {clock:string|null;id:string; white:string; black:string|null; moves:string; resigned:Side|null; revision:number};
function reply(data:unknown,status=200) {return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
async function route(request:Request) {
  const db=env.DB;
  if (!db) return reply({error:"Room service is unavailable."},503);
  const input=request.method === "POST" ? await request.json() as Record<string,unknown> : {};
  const key=request.headers.get("Authorization")?.replace(/^Bearer /,"") || "";
  if (!/^[a-f0-9-]{36}$/.test(key)) return reply({error:"Reopen the room to reconnect."},401);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,"0")).join("");
  let id=new URL(request.url).searchParams.get("id") || "";
  if (input.action==="create") {
    const preset=input.preset??"untimed";
    if(typeof preset!=="string"||!Object.hasOwn(presets,preset))return reply({error:"Unknown time control."},400);
    const clock=newClock(preset as Preset,false);
    id=crypto.randomUUID();
    await db.prepare("INSERT INTO chess_rooms (id,white,clock) VALUES (?,?,?)").bind(id,hash,JSON.stringify(clock)).run();
  }
  if (!/^[a-f0-9-]{36}$/.test(id)) return reply({error:"This room link is invalid."},404);
  const read=()=>db.prepare("SELECT * FROM chess_rooms WHERE id=?").bind(id).first<Row>();
  let row=await read();
  if (!row) return reply({error:"This room could not be found."},404);
  const player=()=>row!.white===hash?"w":row!.black===hash?"b":null;
  if(input.action==="join" && !player()) {
    const clock=JSON.parse(row.clock||"null");
    if(clock){clock.active="w";clock.since=Date.now()}
    const change=await db.prepare("UPDATE chess_rooms SET black=?,clock=?,revision=revision+1 WHERE id=? AND black IS NULL").bind(hash,JSON.stringify(clock),id).run();
    if(!change.meta.changes) return reply({error:"Both seats are taken."},409);
    row=(await read())!;
  } else if(input.action==="move" || input.action==="resign") {
    const side=player();
    if(!side || !row.black) return reply({error:"Two seated players are required."},403);
    if(input.revision!==row.revision) return reply({error:"The board has changed. Try again."},409);
    const moves:string[]=JSON.parse(row.moves);
    const game=position(moves);
    if(ending(game,row.resigned)) return reply({error:"This game is over."},409);
    const now=Date.now(), clock=JSON.parse(row.clock||"null");
    if(clock?.active && remaining(clock,game.turn(),now)===0)return reply({error:"Time expired."},409);
    let resigned:Side|null=null;
    if(input.action==="move") {
      if(game.turn()!==side) return reply({error:"Wait for your turn."},409);
      if(typeof input.san!=="string" || input.san.length>14) return reply({error:"Invalid move."},400);
      try{moves.push(game.move(input.san,{strict:true}).san);}catch{return reply({error:"That move is illegal."},400);}
    } else resigned=side;
    const change=await db.prepare("UPDATE chess_rooms SET moves=?,resigned=?,clock=?,revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify(moves),resigned,JSON.stringify(switchClock(clock,now,!resigned,!!ending(game,resigned))),id,row.revision).run();
    if(!change.meta.changes) return reply({error:"The board changed. Try again."},409);
    row=(await read())!;
  }
  return reply({id,clock:JSON.parse(row.clock||"null"),serverNow:Date.now(),moves:JSON.parse(row.moves),joined:!!row.black,resigned:row.resigned,revision:row.revision,side:player()});
}
export const GET=route;
export const POST=route;
