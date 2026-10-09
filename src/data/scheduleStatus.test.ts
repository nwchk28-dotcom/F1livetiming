import {expect,it} from 'vitest'
import type {SessionState,WeekendSession} from '../types'
import {emptySession,mergeFeed} from './sources'
import {scheduleSessionStatus} from './scheduleStatus'
const now=Date.parse('2026-10-09T12:50:00Z')
const start='2026-10-09T12:30:00Z'
it.each(['qualifying','sprintQualifying'] as const)('keeps %s segment breaks and final attacks distinct from completion',kind=>{
 const row:WeekendSession={kind,name:kind,start}
 const prefix=kind==='qualifying'?'Q':'SQ'
 let session:SessionState={...emptySession(),sessionName:kind==='qualifying'?'Qualifying':'Sprint Qualifying',phase:'Q1',status:'FINISHED',qualifyingPartStarted:true}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}1終了・${prefix}2開始待ち`)
 expect(scheduleSessionStatus(row,{...session,status:'INACTIVE'},true,now)).toBe(`${prefix}1終了・${prefix}2開始待ち`)
 session={...session,phase:'Q2',qualifyingPartStarted:false,status:'INACTIVE'}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}1終了・${prefix}2開始待ち`)
 session={...session,qualifyingPartStarted:true,status:'STARTED'}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}2 進行中`)
 session={...session,status:'FINISHED'}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}2終了・${prefix}3開始待ち`)
 session={...session,phase:'Q3',status:'INACTIVE',qualifyingPartStarted:false}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}2終了・${prefix}3開始待ち`)
 session={...session,status:'FINISHED',qualifyingPartStarted:true}
 expect(scheduleSessionStatus(row,session,true,now)).toBe(`${prefix}3 チェッカー・最終アタック中`)
 expect(scheduleSessionStatus(row,{...session,status:'INACTIVE'},true,now)).toBe(`${prefix}3終了・結果確定待ち`)
 session={...session,qualifyingFinalised:true}
 expect(scheduleSessionStatus(row,session,true,now)).toBe('終了')
})
it.each(['Qualifying','Sprint Qualifying','Sprint Shootout'])('shows red flag suspension in %s as awaiting restart',sessionName=>{
 const row:WeekendSession={name:'予選',kind:sessionName==='Qualifying'?'qualifying':'sprintQualifying',start}
 const session:SessionState={...emptySession(),sessionName,phase:'Q2',status:'ABORTED',qualifyingPartStarted:true}
 expect(scheduleSessionStatus(row,session,true,now)).toContain('中断中・再開待ち')
})
it.each([['race','Race'],['sprintRace','Sprint'],['practice','Practice 1']] as const)('keeps %s suspension separate from finish', (kind,sessionName)=>{
 const row:WeekendSession={name:kind==='practice'?'フリー走行1':kind,kind,start}
 const session:SessionState={...emptySession(),sessionName,status:'ABORTED'}
 expect(scheduleSessionStatus(row,session,true,now)).toBe('中断中・再開待ち')
 expect(scheduleSessionStatus(row,{...session,status:'STARTED'},true,now)).toBe('開催中')
 expect(scheduleSessionStatus(row,{...session,status:'FINISHED'},true,now)).toBe('終了')
 expect(scheduleSessionStatus(row,{...session,status:'INACTIVE'},true,now)).toBe('待機中')
})
it('does not apply the current feed to another GP or session',()=>{
 const session:SessionState={...emptySession(),sessionName:'Sprint Qualifying',phase:'Q1',status:'FINISHED'}
 expect(scheduleSessionStatus({name:'スプリント予選',kind:'sprintQualifying',start:'2026-10-16T12:30:00Z'},session,false,now)).toBe('開始前')
 expect(scheduleSessionStatus({name:'予選',kind:'qualifying',start:'2026-10-10T13:00:00Z'},session,true,now)).toBe('開始前')
})
it('uses real feed segment and finalisation messages',()=>{
 const row:WeekendSession={name:'スプリント予選',kind:'sprintQualifying',start}
 let session=mergeFeed(emptySession(),'SessionInfo',{Name:'Sprint Qualifying'})
 session=mergeFeed(session,'TimingData',{SessionPart:1})
 session=mergeFeed(session,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'},1:{SessionStatus:'Finished'}}})
 expect(scheduleSessionStatus(row,session,true,now)).toBe('SQ1終了・SQ2開始待ち')
 session=mergeFeed(session,'TimingData',{SessionPart:3})
 session=mergeFeed(session,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'},1:{SessionStatus:'Finished'},2:{SessionStatus:'Finished'},3:{SessionStatus:'Finished'}}})
 expect(scheduleSessionStatus(row,session,true,now)).toContain('最終アタック中')
 session=mergeFeed(session,'SessionData',{StatusSeries:{4:{SessionStatus:'Finalised'}}})
 expect(scheduleSessionStatus(row,session,true,now)).toBe('終了')
})

it.each(['Qualifying','Sprint Qualifying','Sprint Shootout'])('ends %s after the final chequered flag when all cars are in pit',sessionName=>{
 const row:WeekendSession={name:'予選',kind:sessionName==='Qualifying'?'qualifying':'sprintQualifying',start}
 let session=mergeFeed(emptySession(),'SessionInfo',{Name:sessionName})
 session=mergeFeed(session,'TimingData',{SessionPart:3,Lines:{1:{Position:'1',InPit:true},2:{Position:'2',InPit:false}}})
 session={...session,status:'FINISHED',flag:'CHEQUERED',qualifyingPartStarted:true}
 expect(scheduleSessionStatus(row,session,true,now)).toContain('最終アタック中')
 session=mergeFeed(session,'TimingData',{Lines:{2:{InPit:true}}})
 expect(scheduleSessionStatus(row,session,true,now)).toBe('終了')
 expect(scheduleSessionStatus(row,{...session,phase:'Q1'},true,now)).not.toBe('終了')
 expect(scheduleSessionStatus(row,{...session,phase:'Q2'},true,now)).not.toBe('終了')
 expect(scheduleSessionStatus(row,{...session,status:'ABORTED',flag:'RED'},true,now)).toContain('再開待ち')
 expect(scheduleSessionStatus(row,{...session,status:'STARTED',flag:'GREEN'},true,now)).not.toBe('終了')
 expect(scheduleSessionStatus(row,{...session,drivers:[]},true,now)).not.toBe('終了')
 expect(scheduleSessionStatus(row,{...session,qualifyingPartStarted:false},true,now)).not.toBe('終了')
 expect(scheduleSessionStatus(row,{...session,drivers:session.drivers.map((d,i)=>({...d,status:i===0?'PIT':'OUT'}))},true,now)).toBe('終了')
})
