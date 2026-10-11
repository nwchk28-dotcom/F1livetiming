import type {RaceWeekend,SessionState} from '../types'
import {hasQualifyingEnded} from './lifecycle'
import {qualifyingBelongsToEvent} from './qualifyingResult'
import {isSprintQualifying,isSprintRace} from './sprint'
export type ResultKind='qualifying'|'race'|'sprintQualifying'|'sprintRace'
export type WeekendResults=Partial<Record<ResultKind,SessionState>>
const key=(event:RaceWeekend)=>`f1-weekend-results-${event.season}-${event.round}`
export function resultKind(session:SessionState):ResultKind|undefined {
 const name=session.sessionName.toLowerCase()
 return isSprintQualifying(name)?'sprintQualifying':isSprintRace(name)?'sprintRace':name==='qualifying'?'qualifying':name==='race'?'race':undefined
}
export function weekendExpiry(event:RaceWeekend):number {
 let finish=NaN
 try{finish=Date.parse(localStorage.getItem(`${key(event)}-finish`)??'')}catch{/* optional storage */}
 return (Number.isFinite(finish)?finish:Date.parse(event.raceStart)+5*3600000)+48*3600000
}
export function readWeekendResults(event:RaceWeekend,now=Date.now()):WeekendResults {
 try{
  if(now>=weekendExpiry(event)){localStorage.removeItem(key(event));return {}}
  return JSON.parse(localStorage.getItem(key(event))??'{}') as WeekendResults
 }catch{return {}}
}
export function saveWeekendResult(event:RaceWeekend,session:SessionState,now=Date.now()):WeekendResults {
 const kind=resultKind(session)
 const results=readWeekendResults(event,now)
 if(!kind||!qualifyingBelongsToEvent(session,event)||!session.drivers.length)return results
 const qualifying=kind==='qualifying'||kind==='sprintQualifying'
 if(qualifying?!hasQualifyingEnded(session):session.status!=='FINISHED')return results
 if(kind==='race'){
  const finish=Date.parse(session.sessionFinishedAt??session.sessionEnd??'')
  if(Number.isFinite(finish)&&finish>=Date.parse(event.raceStart))try{localStorage.setItem(`${key(event)}-finish`,new Date(finish).toISOString())}catch{/* optional storage */}
 }
 if(now>=weekendExpiry(event))return {}
 const completed:SessionState={...session,status:'FINISHED',flag:'CHEQUERED',drivers:session.drivers.map(d=>({...d,timingImprovedAt:undefined,status:d.status==='OUT'?'OUT':'FINISHED'})),...(qualifying?{qualifyingFinalised:true,qualifyingPartStarted:true}:{})}
 results[kind]=completed
 try{localStorage.setItem(key(event),JSON.stringify(results))}catch{/* optional storage */}
 return results
}
