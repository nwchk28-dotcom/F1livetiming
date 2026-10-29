import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {emptySession} from './sources'
import {loadCompletion,readCompletion,recordSessionCompletion,saveCompletion,sessionKey} from './scheduleCompletion'
import type {RaceWeekend} from '../types'
const event:RaceWeekend={season:2026,round:1,meetingName:'Test Grand Prix',circuit:'Track',country:'Country',locality:'City',timeZone:'UTC',qualifyingStart:'2026-03-01T10:00:00Z',raceStart:'2026-03-02T10:00:00Z'}
beforeEach(()=>localStorage.clear())
afterEach(()=>vi.unstubAllGlobals())
it('retains practice completion after result retention expires and separates rounds',()=>{
 recordSessionCompletion(event,{...emptySession(),meetingName:event.meetingName,sessionName:'Practice 1',status:'FINISHED'})
 expect(readCompletion(event)).toEqual({practice1:true})
 expect(readCompletion({...event,round:2})).toEqual({})
 expect(sessionKey({name:'フリー走行2',kind:'practice'})).toBe('practice2')
})
it('does not treat another meeting, red flags or qualifying segment finishes as completion',()=>{
 for(const session of [
  {...emptySession(),meetingName:'Another Grand Prix',sessionName:'Race',status:'FINISHED' as const},
  {...emptySession(),meetingName:event.meetingName,sessionName:'Practice 1',status:'ABORTED' as const},
  {...emptySession(),meetingName:event.meetingName,sessionName:'Qualifying',status:'FINISHED' as const,phase:'Q1' as const},
 ])recordSessionCompletion(event,session)
 expect(readCompletion(event)).toEqual({})
})
it('loads old GP practice status without classification or an active event',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  if(input.endsWith('completion.json'))return new Response('{}')
  if(input.endsWith('Index.json'))return new Response(JSON.stringify({Meetings:[{Name:event.meetingName,Sessions:[{Name:'Practice 1',Path:'p1/'},{Name:'Practice 2',Path:'p2/'}]}]}))
  return new Response(JSON.stringify({SessionStatus:input.includes('p1/')?'Finalised':'Started'}))
 }))
 expect(await loadCompletion(event)).toEqual({practice1:true})
})
it('preserves confirmed status during network failures',async()=>{
 saveCompletion(event,{race:true})
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
 expect(await loadCompletion(event)).toEqual({race:true})
})
it('uses bundled completion without trusting non-boolean fields',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  if(input.endsWith('completion.json'))return new Response(JSON.stringify({'1':{practice3:true,race:false}}))
  throw new Error('offline')
 }))
 expect(await loadCompletion(event)).toEqual({practice3:true})
})
it('confirms all practice sessions from published results and ignores cancelled or resultless sessions',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  if(input.endsWith('completion.json'))return new Response('{}')
  if(input.includes('/sessions?'))return new Response(JSON.stringify([
   {session_key:1,meeting_key:10,session_name:'Race',date_start:event.raceStart},
   {session_key:2,meeting_key:10,session_name:'Practice 1',date_start:'2026-02-28T10:00:00Z'},
   {session_key:3,meeting_key:10,session_name:'Practice 2',is_cancelled:true},
   {session_key:4,meeting_key:11,session_name:'Practice 3'},
  ]))
  if(input.includes('/session_result?'))return new Response(JSON.stringify([{session_key:2},{session_key:3},{session_key:4}]))
  throw new Error('F1 unavailable')
 }))
 expect(await loadCompletion(event)).toEqual({practice1:true})
})
