import type {SessionState,WeekendSession} from '../types'
import {hasQualifyingEnded} from './lifecycle'

/** Finished can mean a qualifying segment has ended, not the whole session. */
export function scheduleSessionStatus(row:WeekendSession,session:SessionState,sameEvent:boolean,now:number,completed=false):string {
  if(completed)return '終了'
  const names:Partial<Record<WeekendSession['kind'],string[]>>={
    qualifying:['qualifying'],race:['race'],
    sprintQualifying:['sprint qualifying','sprint shootout'],sprintRace:['sprint','sprint race'],
  }
  const name=session.sessionName.trim().toLowerCase()
  const practicePart=row.name.match(/[123]/)?.[0]
  const matches=row.kind==='practice'?Boolean(practicePart&&[ `practice ${practicePart}`,`free practice ${practicePart}` ].includes(name)):Boolean(names[row.kind]?.includes(name))
  if(sameEvent&&matches){
    if(row.kind==='qualifying'||row.kind==='sprintQualifying'){
      if(hasQualifyingEnded(session))return '終了'
      if(session.status==='STARTED'||session.status==='ABORTED'||session.status==='FINISHED'||session.qualifyingPartStarted===true||['Q2','Q3'].includes(session.phase))return '速報中'
    }else{
      if(session.status==='FINISHED')return '終了'
      if(session.status==='STARTED'||session.status==='ABORTED')return '速報中'
    }
  }
  if(!row.start)return '時刻未発表'
  return Date.parse(row.start)>now?'開始前':'開始時刻経過・状態未確認'
}
