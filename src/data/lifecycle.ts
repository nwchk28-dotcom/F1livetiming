import type { CompetitionState, OfficialRaceResult, RaceWeekend, SessionState } from '../types'

export function competitionFromSession(session?:SessionState,event?:RaceWeekend,now=new Date()):CompetitionState{
  const name=session?.sessionName.toLowerCase()??''
  const qualifying=name.includes('qualifying')&&!name.includes('sprint')
  const race=(name==='race'||name.includes('grand prix'))&&!name.includes('sprint')
  // During a red flag F1 publishes Aborted until the race is restarted. Keep
  // the live classification visible throughout that suspension.
  if(session&&(session.status==='STARTED'||session.status==='ABORTED'))return qualifying?'QUALIFYING':race?'RACE':'IDLE'
  if(race&&session?.status==='FINISHED'){
    const finishedAt=Date.parse(session.sessionFinishedAt??''),feedEnd=Date.parse(session.sessionEnd??''),scheduledStart=Date.parse(event?.raceStart??''),end=Number.isFinite(finishedAt)?finishedAt:Number.isFinite(feedEnd)?feedEnd:scheduledStart+3*60*60*1000,time=now.getTime()
    // EndDate is a scheduled boundary, not permission to display results.
    // A received finish signal must retain the classification immediately.
    if(Number.isFinite(end)&&time<end+48*60*60*1000)return'RACE'
    return'IDLE'
  }
  // Segment breaks can publish Finished, Finalised or Inactive. The session
  // identity and qualifying window, not the segment status, own this screen.
  if(qualifying&&session){
    if(session.phase==='Q3'&&session.qualifyingFinalised&&session.qualifyingPartStarted!==false&&(!event||timeBeforeRaceWindowEnd(event,now)))return'PRE_RACE'
    const feedStart=Date.parse(session.sessionStart??''),feedEnd=Date.parse(session.sessionEnd??''),time=now.getTime()
    if(Number.isFinite(feedStart)&&Number.isFinite(feedEnd)&&time>=feedStart&&time<=feedEnd+3*60*60*1000)return'QUALIFYING'
    if(event){const start=new Date(event.qualifyingStart).getTime(),end=Math.min(new Date(event.raceStart).getTime(),start+3*60*60*1000);if(time>=start&&time<=end)return'QUALIFYING'}
  }
  if(event){const time=now.getTime(),qualifyingEnd=Date.parse(event.qualifyingStart)+3*60*60*1000,raceWindowEnd=Date.parse(event.raceStart)+5*60*60*1000;if(time>=qualifyingEnd&&time<raceWindowEnd)return'PRE_RACE'}
  return'IDLE'
}

export function selectNextEvent(schedule:RaceWeekend[],now=new Date()):RaceWeekend|undefined{
  return schedule.find(e=>new Date(e.qualifyingStart).getTime()>now.getTime())
}

export function selectCurrentEvent(schedule:RaceWeekend[],session?:SessionState,now=new Date()):RaceWeekend|undefined{
  const time=now.getTime(),current=schedule.filter(e=>time>=Date.parse(e.qualifyingStart)-3*60*60*1000&&time<Date.parse(e.raceStart)+48*60*60*1000)
  if(session?.meetingName){const target=normalise(session.meetingName);const exact=current.find(e=>normalise(e.meetingName).includes(target)||target.includes(normalise(e.meetingName)));if(exact)return exact}
  return current[0]
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

export function isQualifyingComplete(session:SessionState):boolean{
  return session.sessionName.toLowerCase().includes('qualifying')&&session.phase==='Q3'&&session.qualifyingPartStarted!==false&&session.qualifyingFinalised===true
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

export function shouldProjectChampionship(competition:CompetitionState,status:SessionState['status']):boolean{return competition==='RACE'&&(status==='STARTED'||status==='ABORTED')}

export function displayedSessionFlag(session:SessionState,competition:CompetitionState):SessionState['flag']|'STANDBY'{
  if(competition==='IDLE'||competition==='PRE_RACE')return'STANDBY'
  if(competition==='QUALIFYING'&&(session.status==='INACTIVE'||session.status==='FINISHED')){
    if(session.phase==='Q3'&&session.qualifyingPartStarted===true&&!session.qualifyingFinalised&&session.status==='FINISHED')return'CHEQUERED'
    return'STANDBY'
  }
  if(competition==='QUALIFYING'&&session.status==='STARTED'&&session.flag==='CHEQUERED'){
    const clock=sessionTimeRemaining(session).match(/^(\d+):(\d{2}):(\d{2})/)
    if(clock&&Number(clock[1])*3600+Number(clock[2])*60+Number(clock[3])>0)return session.trackFlag??'GREEN'
  }
  return session.flag
}

export function qualifyingPhaseLabel(session:SessionState,now=Date.now()):string{
  const part=['Q1','Q2','Q3'].includes(session.phase)?session.phase:undefined
  if(!part)return'予選セッション情報を受信中'
  const start=Date.parse(session.sessionStart??'')
  if(part==='Q1'&&session.status!=='STARTED'&&Number.isFinite(start)&&now<start)return'Q1開始待ち'
  if(session.qualifyingPartStarted===false&&session.status!=='STARTED')return part==='Q1'?'Q1開始待ち':`Q${Number(part.slice(1))-1}終了・${part}開始待ち`
  if(session.status==='ABORTED')return`${part} 中断中・再開待ち`
  if(session.status==='STARTED')return`${part} 進行中`
  if(session.status==='INACTIVE')return`${part}開始待ち`
  if(part==='Q3')return session.qualifyingFinalised?'Q3終了・予選終了':'Q3 チェッカー・最終アタック中'
  return`${part}終了・Q${Number(part.slice(1))+1}開始待ち`
}

const normalise=(value:string)=>value.toLowerCase().replace(/grand prix|グランプリ|[^a-z0-9]/g,'')
const timeBeforeRaceWindowEnd=(event:RaceWeekend,now:Date)=>now.getTime()<Date.parse(event.raceStart)+5*60*60*1000
