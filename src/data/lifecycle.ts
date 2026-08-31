import type { CompetitionState, RaceWeekend, SessionState } from '../types'

export function competitionFromSession(session?:SessionState):CompetitionState{
  if(!session||session.status!=='STARTED')return'IDLE'
  const name=session.sessionName.toLowerCase()
  if(name.includes('qualifying')&&!name.includes('sprint'))return'QUALIFYING'
  if((name==='race'||name.includes('grand prix'))&&!name.includes('sprint'))return'RACE'
  return'IDLE'
}

export function selectNextEvent(schedule:RaceWeekend[],now=new Date()):RaceWeekend|undefined{
  return schedule.find(e=>new Date(e.qualifyingStart).getTime()>now.getTime())
}

export function selectCurrentEvent(schedule:RaceWeekend[],session?:SessionState):RaceWeekend|undefined{
  if(session?.meetingName){const target=normalise(session.meetingName);const exact=schedule.find(e=>normalise(e.meetingName).includes(target)||target.includes(normalise(e.meetingName)));if(exact)return exact}
  const now=Date.now();return schedule.find(e=>now>=new Date(e.qualifyingStart).getTime()-3*60*60*1000&&now<=new Date(e.raceStart).getTime()+5*60*60*1000)
}

export function attachGrid(qualifying:SessionState,grid:Record<string,number>,reasons:Record<string,string>={}):SessionState{
  return {...qualifying,drivers:qualifying.drivers.map(d=>{const gridPosition=grid[d.number]??d.position;return{...d,qualifyingPosition:d.position,gridPosition,gridChange:gridPosition-d.position,penaltyReason:gridPosition!==d.position?(reasons[d.number]??'確定グリッド変更'):undefined}})}
}

const normalise=(value:string)=>value.toLowerCase().replace(/grand prix|グランプリ|[^a-z0-9]/g,'')
