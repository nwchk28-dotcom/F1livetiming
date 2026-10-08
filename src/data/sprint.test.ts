import {expect,it} from 'vitest'
import {emptySession,mergeFeed} from './sources'
import {isSprintQualifying,isSprintRace,sprintCompetition} from './sprint'
import {finalQualifyingSession} from './qualifyingResult'
it('recognises sprint variants without treating qualifying as a race',()=>{
 expect(isSprintQualifying('Sprint Qualifying')).toBe(true)
 expect(isSprintQualifying('Sprint Shootout')).toBe(true)
 expect(isSprintRace('Sprint')).toBe(true)
 expect(isSprintRace('Sprint Race')).toBe(true)
 expect(isSprintRace('Sprint Qualifying')).toBe(false)
})
it('uses race phase, grid and finish status for Sprint',()=>{
 let s=mergeFeed(emptySession(),'SessionInfo',{Name:'Sprint'})
 s=mergeFeed(s,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'}}})
 s=mergeFeed(s,'TimingData',{Lines:{1:{Position:'2'},2:{Position:'1'}}})
 s=mergeFeed(s,'TimingAppData',{Lines:{1:{GridPos:'1'}}})
 expect(s.phase).toBe('RACE')
 expect(sprintCompetition(s)).toBe('RACE')
 expect(s.drivers[0].number).toBe('2')
 expect(s.drivers.find(d=>d.number==='1')?.gridPosition).toBe(1)
 s=mergeFeed(s,'SessionData',{StatusSeries:{0:{SessionStatus:'Finished'}}})
 expect(s.drivers.every(d=>d.status==='FINISHED')).toBe(true)
 expect(sprintCompetition(s)).toBe('RACE')
})
it('updates Sprint Qualifying times and never saves them as main qualifying',()=>{
 let s=mergeFeed(emptySession(),'SessionInfo',{Name:'Sprint Qualifying'})
 s=mergeFeed(s,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'}}})
 s=mergeFeed(s,'TimingData',{SessionPart:3,Lines:{1:{Position:'1',BestLapTime:{Value:'1:30.000'}},2:{Position:'2',BestLapTime:{Value:'1:30.250'}}}})
 expect(sprintCompetition(s)).toBe('QUALIFYING')
 expect(s.drivers[0].bestLap).toBe('1:30.000')
 expect(s.drivers[1].gap).toContain('0.250')
 s=mergeFeed(s,'SessionData',{StatusSeries:{0:{SessionStatus:'Finalised'}}})
 expect(s.qualifyingFinalised).toBe(true)
 expect(finalQualifyingSession(s)).toBeUndefined()
})
