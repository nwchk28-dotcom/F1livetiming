import {afterEach,expect,it,vi} from 'vitest'
import {emptySession,mergeFeed,F1ArchiveSource} from './sources'
import {readWeekendResults,saveWeekendResult,weekendExpiry} from './weekendResults'
import {selectCurrentEvent} from './lifecycle'
const event={season:2026,round:17,meetingName:'Singapore Grand Prix',circuit:'Singapore',locality:'Singapore',country:'Singapore',qualifyingStart:'2026-10-10T13:00:00Z',raceStart:'2026-10-11T12:00:00Z',timeZone:'Asia/Singapore'}
afterEach(()=>{localStorage.clear();vi.unstubAllGlobals();vi.useRealTimers()})
const result=(name:string)=>({...mergeFeed(emptySession(),'TimingData',{Lines:{1:{Position:'1',BestLapTime:{Value:'1:30.000'}}}}),meetingName:event.meetingName,sessionName:name,status:'FINISHED' as const,phase:name.includes('Qualifying')?'Q3' as const:'RACE' as const,qualifyingFinalised:true,qualifyingPartStarted:true})
it('retains all four final classifications independently across session switches and reloads',()=>{
 const now=Date.parse('2026-10-11T13:00:00Z')
 for(const name of ['Sprint Qualifying','Sprint','Qualifying','Race'])saveWeekendResult(event,result(name),now)
 const saved=readWeekendResults(event,now)
 expect(Object.keys(saved).sort()).toEqual(['qualifying','race','sprintQualifying','sprintRace'])
 expect(saved.sprintQualifying?.drivers[0].bestLap).toBe('1:30.000')
 expect(saved.sprintRace?.drivers[0].position).toBe(1)
 expect(saved.qualifying?.sessionName).toBe('Qualifying')
})
it('expires all results exactly 48 hours after main race finish, not sprint finish or race start',()=>{
 const finish=Date.parse('2026-10-11T15:45:00Z'),now=finish+1
 saveWeekendResult(event,result('Sprint'),now)
 saveWeekendResult(event,{...result('Race'),sessionFinishedAt:new Date(finish).toISOString()},now)
 expect(weekendExpiry(event)).toBe(finish+48*3600000)
 expect(readWeekendResults(event,finish+48*3600000-1).sprintRace).toBeTruthy()
 expect(selectCurrentEvent([event],undefined,new Date(finish+48*3600000-1))).toEqual(event)
 expect(readWeekendResults(event,finish+48*3600000)).toEqual({})
 expect(selectCurrentEvent([event],undefined,new Date(finish+48*3600000))).toBeUndefined()
})
it('does not save segment breaks, active sessions or a different GP',()=>{
 const now=Date.parse('2026-10-10T13:00:00Z')
 saveWeekendResult(event,{...result('Sprint Qualifying'),phase:'Q1',qualifyingFinalised:false},now)
 saveWeekendResult(event,{...result('Sprint'),status:'STARTED'},now)
 saveWeekendResult(event,{...result('Race'),meetingName:'Other Grand Prix'},now)
 expect(readWeekendResults(event,now)).toEqual({})
})
it('restores a sprint archive bundled with the site without requiring browser cross-origin access',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-11T13:00:00Z'))
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>result('Sprint')})
 vi.stubGlobal('fetch',fetch)
 expect((await new F1ArchiveSource().loadWeekendSession(event,'sprintRace'))?.drivers[0].position).toBe(1)
 expect(fetch).toHaveBeenCalledTimes(1)
 expect(fetch.mock.calls[0][0]).toContain('/archives/2026/17/sprintRace.json')
})

it('replays archived qualifying without clearing the final lap times with old segment markers',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-11T13:00:00Z'))
 const fetch=vi.fn(async(url:string)=>{
  if(url.includes('/archives/'))return {ok:false}
  let raw='{}'
  if(url.endsWith('Index.json'))raw=JSON.stringify({Meetings:[{Name:event.meetingName,Sessions:[{Name:'Sprint Qualifying',Path:'sprint-qualifying/'}]}]})
  else if(url.endsWith('SessionData.jsonStream'))raw=[{Series:{0:{QualifyingPart:1}},StatusSeries:{0:{SessionStatus:'Started'}}},{Series:{1:{QualifyingPart:2}}},{Series:{2:{QualifyingPart:3}},StatusSeries:{0:{SessionStatus:'Started'},1:{SessionStatus:'Finished'},2:{SessionStatus:'Finished'},3:{SessionStatus:'Finalised'}}}].map(v=>JSON.stringify(v)).join('\n')
  else if(url.endsWith('TimingData.jsonStream'))raw=[1,2,3].map(part=>JSON.stringify({SessionPart:part,Lines:{1:{Position:'1',BestLapTime:{Value:`1:${33-part}.000`}}}})).join('\n')
  return {ok:true,text:async()=>raw}
 })
 vi.stubGlobal('fetch',fetch)
 const loaded=await new F1ArchiveSource().loadWeekendSession(event,'sprintQualifying')
 expect(loaded?.drivers[0].bestLap).toBe('1:30.000')
 expect(loaded?.qualifyingFinalised).toBe(true)
})
