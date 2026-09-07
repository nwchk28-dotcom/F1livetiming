import type { CompetitionState, OfficialRaceResult, RaceWeekend, SessionState } from '../types'

export function competitionFromSession(session?:SessionState,event?:RaceWeekend,now=new Date()):CompetitionState{
  if(!session)return'IDLE'
  const name=session.sessionName.toLowerCase()
  const qualifying=name.includes('qualifying')&&!name.includes('sprint')
  const race=(name==='race'||name.includes('grand prix'))&&!name.includes('sprint')
  // During a red flag F1 publishes Aborted until the race is restarted. Keep
  // the live classification visible throughout that suspension.
  if(session.status==='STARTED'||session.status==='ABORTED')return qualifying?'QUALIFYING':race?'RACE':'IDLE'
  if(race&&session.status==='FINISHED'){
    const feedEnd=Date.parse(session.sessionEnd??''),scheduledStart=Date.parse(event?.raceStart??''),end=Number.isFinite(feedEnd)?feedEnd:scheduledStart+3*60*60*1000,time=now.getTime()
    if(Number.isFinite(end)&&time>=end&&time<end+48*60*60*1000)return'RACE'
  }
  // F1 marks each qualifying segment as FINISHED during the Q1→Q2 and Q2→Q3
  // breaks. Keep the timing screen active for the whole qualifying window.
  if(qualifying&&session.status==='FINISHED'){
    const feedStart=Date.parse(session.sessionStart??''),feedEnd=Date.parse(session.sessionEnd??''),time=now.getTime()
    if(Number.isFinite(feedStart)&&Number.isFinite(feedEnd)&&time>=feedStart&&time<=feedEnd+3*60*60*1000)return'QUALIFYING'
    if(event){const start=new Date(event.qualifyingStart).getTime(),end=Math.min(new Date(event.raceStart).getTime(),start+3*60*60*1000);if(time>=start&&time<=end)return'QUALIFYING'}
  }
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

export function applyRaceGrid(session:SessionState,grid:Record<string,number>):SessionState{
  return{...session,drivers:session.drivers.map(d=>({...d,gridPosition:grid[d.number]??d.gridPosition}))}
}

export function applyOfficialRaceResults(session:SessionState,results:OfficialRaceResult[]):SessionState{
  if(!results.length)return session
  const byNumber=Object.fromEntries(session.drivers.map(d=>[d.number,d]))
  return{...session,status:'FINISHED',phase:'FINISHED',drivers:results.map(r=>{const live=byNumber[r.number];return{...(live??{position:r.position,previousPosition:r.position,gridPosition:r.gridPosition,number:r.number,code:r.number,fullName:`CAR ${r.number}`,team:'',teamColor:'#aeb3bc',bestLap:'—',lastLap:'—',gap:'—',interval:'—',sectors:[],tyre:{compound:'SOFT' as const,laps:0},pitStops:0,status:r.status}),position:r.position,previousPosition:live?.position??r.position,gridPosition:r.gridPosition,status:r.status,gap:r.gap,interval:r.interval,points:r.points,bestLap:r.bestLap??live?.bestLap??'—'}})}
}

export function isQualifyingComplete(session:SessionState,now=Date.now()):boolean{
  if(session.status!=='FINISHED'||!session.sessionName.toLowerCase().includes('qualifying'))return false
  const end=Date.parse(session.sessionEnd??'')
  return Number.isFinite(end)&&now>=end-2*60*1000
}

export function sessionTimeRemaining(session:SessionState,now=Date.now()):string{
  if(!session.clockRunning||!session.clockUpdatedAt)return session.timeRemaining
  const match=session.timeRemaining.match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/)
  if(!match)return session.timeRemaining
  const received=Date.parse(session.clockUpdatedAt)
  if(!Number.isFinite(received))return session.timeRemaining
  const initial=(Number(match[1])*3600+Number(match[2])*60+Number(match[3]))*1000
  const remaining=Math.max(0,initial-Math.max(0,now-received)),seconds=Math.ceil(remaining/1000)
  return`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
}

const normalise=(value:string)=>value.toLowerCase().replace(/grand prix|グランプリ|[^a-z0-9]/g,'')
