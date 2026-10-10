import {expect,it} from 'vitest'
import {emptySession} from './sources'
import {shouldReconnectForScheduledSession} from './sessionReconnect'
const event={season:2026,round:17,meetingName:'Singapore Grand Prix',circuit:'Singapore',locality:'Singapore',country:'Singapore',qualifyingStart:'2026-10-10T13:00:00Z',raceStart:'2026-10-11T12:00:00Z',sprintStart:'2026-10-10T09:00:00Z',sprintQualifyingStart:'2026-10-09T12:30:00Z',timeZone:'Asia/Singapore'}
it('reconnects a previous finished sprint when main qualifying is due',()=>{
 const session={...emptySession(),sessionName:'Sprint',status:'FINISHED' as const}
 expect(shouldReconnectForScheduledSession(event,session,Date.parse('2026-10-10T13:15:00Z'))).toBe(true)
 expect(shouldReconnectForScheduledSession(event,session,Date.parse('2026-10-10T12:59:59Z'))).toBe(false)
})
it('does not interrupt active races, red flags or qualifying segment breaks',()=>{
 const now=Date.parse('2026-10-10T13:15:00Z')
 for(const status of ['STARTED','ABORTED'] as const)expect(shouldReconnectForScheduledSession(event,{...emptySession(),sessionName:'Sprint',status},now)).toBe(false)
 expect(shouldReconnectForScheduledSession(event,{...emptySession(),sessionName:'Qualifying',status:'FINISHED',phase:'Q1'},now)).toBe(false)
})
it('reconnects qualifying for race start and avoids retrying out of the session window',()=>{
 const session={...emptySession(),sessionName:'Qualifying',status:'FINISHED' as const}
 expect(shouldReconnectForScheduledSession(event,session,Date.parse('2026-10-11T12:15:00Z'))).toBe(true)
 expect(shouldReconnectForScheduledSession(event,session,Date.parse('2026-10-11T16:00:00Z'))).toBe(false)
})
