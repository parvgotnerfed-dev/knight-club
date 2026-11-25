import type { Side } from "./rules";
export const presets = {"untimed":"Untimed","3":"3 min","3+2":"3 + 2","5":"5 min","10":"10 min"} as const;
export type Preset = keyof typeof presets;
export type Clock = {preset: Preset; w:number; b:number; active:Side|null; since:number};
export function newClock(preset:Preset, start:boolean, now=Date.now()):Clock|null {
  if(preset==="untimed") return null;
  const ms=parseInt(preset,10)*60000;
  return {preset,w:ms,b:ms,active:start?"w":null,since:now};
}
export function remaining(clock:Clock, side:Side, now:number) {
  return Math.max(0,clock[side]-(clock.active===side?Math.max(0,now-clock.since):0));
}
export function switchClock(clock:Clock|null|undefined, now:number, moved:boolean, finished:boolean){
  if(!clock?.active)return clock??null;
  const side=clock.active;
  const next:Side=side==="w"?"b":"w";
  return {...clock,[side]:remaining(clock,side,now)+(moved&&clock.preset==="3+2"?2000:0),active:finished?null:next,since:now};
}
