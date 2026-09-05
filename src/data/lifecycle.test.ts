import {describe,expect,it} from 'vitest'
import type {RaceWeekend,SessionState} from '../types'
import {attachGrid,competitionFromSession,selectNextEvent,sessionTimeRemaining} from './lifecycle'
import {emptySession} from './sources'

const event=(round:number,date:string):RaceWeekend=>({season:2026,round,meetingName:`Race ${round}`,circuit:'Circuit',locality:'City',country:'Japan',qualifyingStart:date,raceStart:date,timeZone:'Asia/Tokyo'})

describe('session lifecycle',()=>{
  it('shows started qualifying',()=>{const s={...emptySession(),sessionName:'Qualifying',status:'STARTED'} as SessionState;expect(competitionFromSession(s)).toBe('QUALIFYING')})
  it('keeps qualifying visible between Q1, Q2 and Q3',()=>{const s={...emptySession(),sessionName:'Qualifying',status:'FINISHED'} as SessionState,e={...event(13,'2026-09-05T14:00:00Z'),raceStart:'2026-09-06T13:00:00Z'};expect(competitionFromSession(s,e,new Date('2026-09-05T14:25:00Z'))).toBe('QUALIFYING');expect(competitionFromSession(s,e,new Date('2026-09-05T18:00:00Z'))).toBe('IDLE')})
  it('does not revive a finished qualifying session without its event window',()=>{const s={...emptySession(),sessionName:'Qualifying',status:'FINISHED'} as SessionState;expect(competitionFromSession(s)).toBe('IDLE')})
  it('excludes sprint sessions',()=>expect(competitionFromSession({...emptySession(),sessionName:'Sprint Qualifying',status:'STARTED'})).toBe('IDLE'))
  it('selects next qualifying',()=>expect(selectNextEvent([event(1,'2026-01-01T00:00:00Z'),event(2,'2026-03-01T00:00:00Z')],new Date('2026-02-01'))?.round).toBe(2))
  it('ticks an extrapolating session clock every second',()=>{const s={...emptySession(),timeRemaining:'00:10:00',clockUpdatedAt:'2026-09-05T14:00:00Z',clockRunning:true};expect(sessionTimeRemaining(s,Date.parse('2026-09-05T14:00:07Z'))).toBe('00:09:53')})
  it('freezes a non-extrapolating session clock',()=>{const s={...emptySession(),timeRemaining:'00:02:30',clockUpdatedAt:'2026-09-05T14:00:00Z',clockRunning:false};expect(sessionTimeRemaining(s,Date.parse('2026-09-05T14:01:00Z'))).toBe('00:02:30')})
  it('attaches grid changes',()=>{const q={...emptySession(),drivers:[{position:1,previousPosition:1,gridPosition:1,number:'1',code:'AAA',fullName:'A',team:'X',teamColor:'#f00',bestLap:'1:00',lastLap:'1:00',gap:'',interval:'',sectors:[],tyre:{compound:'SOFT' as const,laps:1},pitStops:0,status:'FINISHED' as const}]};expect(attachGrid(q,{'1':4}).drivers[0].gridChange).toBe(3)})
})
