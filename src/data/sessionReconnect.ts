import type {RaceWeekend,SessionState} from '../types'
import {isSprintQualifying,isSprintRace} from './sprint'
export function shouldReconnectForScheduledSession(event:RaceWeekend|undefined,session:SessionState,now:number):boolean {
  if(!event||session.status==='STARTED'||session.status==='ABORTED')return false
  const starts=[
    {start:event.sprintQualifyingStart,name:'sprintQualifying'},
    {start:event.sprintStart,name:'sprintRace'},
    {start:event.qualifyingStart,name:'qualifying'},
    {start:event.raceStart,name:'race'},
  ].filter(s=>s.start&&Date.parse(s.start)<=now).sort((a,b)=>Date.parse(b.start!)-Date.parse(a.start!))
  const expected=starts[0]
  if(!expected||now-Date.parse(expected.start!)>3*3600000)return false
  const name=session.sessionName.toLowerCase().trim()
  const matches=expected.name==='sprintQualifying'?isSprintQualifying(name):expected.name==='sprintRace'?isSprintRace(name):name===expected.name
  return !matches
}
