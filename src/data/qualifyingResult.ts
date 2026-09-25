import type {RaceWeekend,SessionState} from '../types'
import {isQualifyingComplete} from './lifecycle'

const KEY='f1-final-qualifying-v1'
const RETENTION=48*60*60*1000
type SavedResult={season:number;round:number;raceStart:string;session:SessionState}

export function finalQualifyingSession(session:SessionState):SessionState|undefined{
  if(!isQualifyingComplete(session)||!session.drivers.some(driver=>driver.position<99))return undefined
  return {...session,drivers:session.drivers.map(driver=>({...driver,status:driver.status==='OUT'?'OUT' as const:'FINISHED' as const,timingImprovedAt:undefined}))}
}

export function qualifyingBelongsToEvent(session:SessionState,event:RaceWeekend):boolean{
  const normalise=(value:string)=>value.toLowerCase().replace(/grand prix|グランプリ|[^a-z0-9]/g,'')
  const sessionName=normalise(session.meetingName),eventName=normalise(event.meetingName)
  return Boolean(sessionName&&eventName&&(sessionName.includes(eventName)||eventName.includes(sessionName)))
}

export function readFinalQualifying(event:RaceWeekend,now=Date.now()):SessionState|undefined{
  try{
    const raw=localStorage.getItem(KEY)
    if(!raw)return undefined
    const saved=JSON.parse(raw) as SavedResult
    const expires=Date.parse(saved.raceStart)+RETENTION
    if(!Number.isFinite(expires)||now>=expires){localStorage.removeItem(KEY);return undefined}
    if(saved.season!==event.season||saved.round!==event.round||saved.raceStart!==event.raceStart)return undefined
    return finalQualifyingSession(saved.session)
  }catch{return undefined}
}

export function pruneFinalQualifying(now=Date.now()):void{
  try{
    const raw=localStorage.getItem(KEY)
    if(!raw)return
    const saved=JSON.parse(raw) as SavedResult
    if(!Number.isFinite(Date.parse(saved.raceStart))||now>=Date.parse(saved.raceStart)+RETENTION)localStorage.removeItem(KEY)
  }catch{try{localStorage.removeItem(KEY)}catch{/* storage may be unavailable */}}
}

export function saveFinalQualifying(event:RaceWeekend,session:SessionState):SessionState|undefined{
  const result=finalQualifyingSession(session)
  if(!result||!qualifyingBelongsToEvent(result,event)||Date.now()>=Date.parse(event.raceStart)+RETENTION)return undefined
  const selected=bestAvailableQualifying(readFinalQualifying(event),result)??result
  try{localStorage.setItem(KEY,JSON.stringify({season:event.season,round:event.round,raceStart:event.raceStart,session:selected} satisfies SavedResult))}catch{/* storage may be unavailable */}
  return selected
}

export function saveArchivedQualifying(event:RaceWeekend,session:SessionState):SessionState|undefined{
  return saveFinalQualifying(event,{...session,meetingName:event.meetingName,sessionName:'Qualifying',phase:'Q3',status:'FINISHED',qualifyingPartStarted:true,qualifyingFinalised:true})
}

export function bestAvailableQualifying(live?:SessionState,archive?:SessionState):SessionState|undefined{
  if(!archive?.drivers.length)return live
  if(!live)return archive
  const ranked=(session:SessionState)=>session.drivers.filter(driver=>driver.position<99).length
  const measured=(session:SessionState)=>session.drivers.reduce((count,driver)=>count+driver.sectors.filter(sector=>sector.value!=='—').length,0)
  return ranked(archive)>ranked(live)||ranked(archive)===ranked(live)&&measured(archive)>=measured(live)?archive:live
}
