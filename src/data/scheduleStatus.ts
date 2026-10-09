import type {SessionState,WeekendSession} from '../types'
import {hasQualifyingEnded,qualifyingPhaseLabel} from './lifecycle'

/** Finished can mean a qualifying segment has ended, not the whole session. */
export function scheduleSessionStatus(row:WeekendSession,session:SessionState,sameEvent:boolean,now:number):string {
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
      const completedPart=session.status==='INACTIVE'&&session.qualifyingPartStarted===true&&['Q1','Q2','Q3'].includes(session.phase)
      const label=completedPart?(session.phase==='Q3'?'Q3終了・結果確定待ち':`${session.phase}終了・Q${Number(session.phase.slice(1))+1}開始待ち`):qualifyingPhaseLabel(session,now)
      return row.kind==='sprintQualifying'?label.replace(/Q([123])/g,'SQ$1'):label
    }
    if(session.status==='STARTED')return '開催中'
    if(session.status==='ABORTED')return '中断中・再開待ち'
    if(session.status==='FINISHED')return '終了'
    if(row.start&&Date.parse(row.start)<=now)return '待機中'
  }
  if(!row.start)return '時刻未発表'
  return Date.parse(row.start)>now?'開始前':'開始時刻経過'
}
