import type { CompetitionState, RaceWeekend, SessionState } from '../types'

export function competitionFromSession(session?:SessionState,event?:RaceWeekend,now=new Date()):CompetitionState{
  if(!session)return'IDLE'
  const name=session.sessionName.toLowerCase()
  const qualifying=name.includes('qualifying')&&!name.includes('sprint')
  const race=(name==='race'||name.includes('grand prix'))&&!name.includes('sprint')
  if(session.status==='STARTED')return qualifying?'QUALIFYING':race?'RACE':'IDLE'
  // F1 marks each qualifying segment as FINISHED during the Q1→Q2 and Q2→Q3
  // breaks. Keep the timing screen active for the whole qualifying window.
  if(qualifying&&session.status==='FINISHED'&&event){const start=new Date(event.qualifyingStart).getTime(),end=Math.min(new Date(event.raceStart).getTime(),start+3*60*60*1000),time=now.getTime();if(time>=start&&time<=end)return'QUALIFYING'}
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
