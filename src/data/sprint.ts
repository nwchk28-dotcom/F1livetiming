import type { CompetitionState, SessionState } from '../types'
export const isSprintQualifying=(name:string)=>/sprint/i.test(name)&&/qualifying|shootout/i.test(name)
export const isSprintRace=(name:string)=>/^sprint(?: race)?$/i.test(name.trim())
export function sprintCompetition(session:SessionState,now=Date.now()):CompetitionState {
  const qualifying=isSprintQualifying(session.sessionName),race=isSprintRace(session.sessionName)
  if(!qualifying&&!race)return 'IDLE'
  if(session.status==='STARTED'||session.status==='ABORTED')return qualifying?'QUALIFYING':'RACE'
  const end=Date.parse(session.sessionFinishedAt??session.sessionEnd??'')
  if(race&&session.status==='FINISHED'&&Number.isFinite(end)&&now<end+48*3600000)return 'RACE'
  const start=Date.parse(session.sessionStart??'')
  if(qualifying&&Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end+3*3600000)return 'QUALIFYING'
  return 'IDLE'
}
