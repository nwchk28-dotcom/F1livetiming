import type {RaceWeekend,SessionState,WeekendSession} from '../types'
import {hasQualifyingEnded} from './lifecycle'
import {qualifyingBelongsToEvent} from './qualifyingResult'
export type Completion = Record<string,true>
const storageKey=(event:RaceWeekend)=>`f1-schedule-completion-v1-${event.season}-${event.round}`
export function sessionKey(row:WeekendSession):string{return row.kind==='practice'?`practice${row.name.match(/[123]/)?.[0]??''}`:row.kind}
export function nameKey(name:string):string|undefined{
 const n=name.trim().toLowerCase(),practice=n.match(/^(?:free )?practice ([123])$/)
 if(practice)return `practice${practice[1]}`
 return ({qualifying:'qualifying',race:'race','sprint qualifying':'sprintQualifying','sprint shootout':'sprintQualifying',sprint:'sprintRace','sprint race':'sprintRace'} as Record<string,string>)[n]
}
export function readCompletion(event:RaceWeekend):Completion{
 try{const value=JSON.parse(localStorage.getItem(storageKey(event))??'{}');return Object.fromEntries(Object.entries(value).filter(([,v])=>v===true)) as Completion}catch{return {}}
}
export function saveCompletion(event:RaceWeekend,completed:Completion):Completion{
 const merged={...readCompletion(event),...completed}
 try{localStorage.setItem(storageKey(event),JSON.stringify(merged))}catch{/* storage optional */}
 return merged
}
export function recordSessionCompletion(event:RaceWeekend,session:SessionState):Completion{
 const key=nameKey(session.sessionName),qualifying=key==='qualifying'||key==='sprintQualifying'
 if(!key||!qualifyingBelongsToEvent(session,event)||(qualifying?!hasQualifyingEnded(session):session.status!=='FINISHED'))return readCompletion(event)
 return saveCompletion(event,{[key]:true})
}
const normal=(name:string)=>name.toLowerCase().replace(/grand prix|[^a-z0-9]/g,'')
const bases=['https://pitwall-live-proxy.nwchk28-f1.workers.dev/static','https://livetiming.formula1.com/static']
async function officialJson(path:string):Promise<any>{
 for(const base of bases)try{const response=await fetch(`${base}/${path}`,{signal:AbortSignal.timeout(12000)});if(response.ok)return JSON.parse((await response.text()).replace(/^\uFEFF/,''))}catch{/* try next origin */}
 throw new Error('Session status unavailable')
}
/** Retain confirmed completion from feeds or published results, never from scheduled end times. */
export async function loadCompletion(event:RaceWeekend):Promise<Completion>{
 let completed=readCompletion(event)
 try{const response=await fetch(`${import.meta.env.BASE_URL}archives/${event.season}/completion.json`,{cache:'no-store'});if(response.ok){const data=await response.json();const stored=data[String(event.round)];if(stored&&typeof stored==='object')completed=saveCompletion(event,Object.fromEntries(Object.entries(stored).filter(([,v])=>v===true)) as Completion)}}catch{/* live official fallback */}
 const expected=event.sessions?.map(sessionKey)??['qualifying','race']
 if(expected.every(key=>completed[key]))return completed
 // Published OpenF1 session results confirm completion even when F1 static access fails.
 try{
  const response=await fetch(`https://api.openf1.org/v1/sessions?year=${event.season}`,{signal:AbortSignal.timeout(12000)})
  if(!response.ok)throw new Error('Sessions unavailable')
  const sessions=await response.json() as Array<{session_key:number;meeting_key:number;session_name:string;date_start:string;is_cancelled?:boolean}>
  const race=sessions.find(s=>s.session_name==='Race'&&Math.abs(Date.parse(s.date_start)-Date.parse(event.raceStart))<24*3600000)
  if(race){
   const missing=sessions.filter(s=>s.meeting_key===race.meeting_key&&!s.is_cancelled&&nameKey(s.session_name)&&!completed[nameKey(s.session_name)!])
   if(missing.length){
    const resultsResponse=await fetch(`https://api.openf1.org/v1/session_result?meeting_key=${race.meeting_key}`,{signal:AbortSignal.timeout(12000)})
    if(resultsResponse.ok){
     const results=await resultsResponse.json() as Array<{session_key:number}>
     const keys=new Set(results.map(r=>r.session_key))
     for(const entry of missing)if(keys.has(entry.session_key))completed=saveCompletion(event,{[nameKey(entry.session_name)!]:true})
    }
   }
  }
 }catch{/* F1 static fallback */}
 if(expected.every(key=>completed[key]))return completed
 try{
  const index=await officialJson(`${event.season}/Index.json`)
  const meeting=index.Meetings?.find((m:{Name?:string})=>normal(m.Name??'')===normal(event.meetingName))
  await Promise.all((meeting?.Sessions??[]).map(async(entry:{Name?:string;Path?:string})=>{
   const key=nameKey(entry.Name??'');if(!key||!entry.Path||completed[key])return
   try{const info=await officialJson(`${entry.Path}SessionInfo.json`);if(/^(finalised|finalized|ends)$/i.test(info.SessionStatus??''))completed=saveCompletion(event,{[key]:true})}catch{/* retain known completion */}
  }))
 }catch{/* retain known completion */}
 return completed
}
