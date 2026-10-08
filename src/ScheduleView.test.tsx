import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {ScheduleView} from './ScheduleView'
import {emptySession} from './data/sources'
import type {RaceWeekend} from './types'
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
it('selects future weekends and displays sprint sessions in Japan time',()=>{
 vi.useFakeTimers()
 vi.setSystemTime(new Date('2026-10-09T00:00:00Z'))
 const first:RaceWeekend={season:2026,round:1,meetingName:'First GP',circuit:'Track',locality:'City',country:'Country',qualifyingStart:'2026-10-10T13:00:00Z',raceStart:'2026-10-11T12:00:00Z',timeZone:'UTC'}
 const future:RaceWeekend={...first,round:2,meetingName:'Future GP',sessions:[{name:'フリー走行1',kind:'practice',start:'2026-10-16T08:30:00Z'},{name:'スプリント予選',kind:'sprintQualifying',start:'2026-10-16T12:30:00Z'},{name:'スプリント決勝',kind:'sprintRace',start:'2026-10-17T09:00:00Z'}]}
 const select=vi.fn()
 render(<ScheduleView schedule={[first,future]} currentEvent={first} session={emptySession()} onSelectSession={select}/>)
 fireEvent.click(screen.getByRole('button',{name:/Future GP/}))
 expect(screen.getByRole('heading',{name:'第2戦 Future GP'})).toBeTruthy()
 expect(screen.getByText(/21:30/)).toBeTruthy()
 expect(screen.getByText(/18:00/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'スプリント予選'}))
 expect(select).toHaveBeenCalledWith('sprintQualifying')
 expect(screen.getByText('フリー走行1')).toBeTruthy()
})

const scheduledEvent=(round:number,raceStart:string):RaceWeekend=>({season:2026,round,meetingName:`GP ${round}`,circuit:'Track',locality:'City',country:'Country',qualifyingStart:raceStart,raceStart,timeZone:'UTC'})
it('centers this week’s upcoming GP and skips a retained previous event',()=>{
 vi.useFakeTimers()
 vi.setSystemTime(new Date('2026-10-09T00:00:00Z'))
 const previous=scheduledEvent(16,'2026-10-04T12:00:00Z'),thisWeek=scheduledEvent(17,'2026-10-11T12:00:00Z'),nextWeek=scheduledEvent(18,'2026-10-18T12:00:00Z')
 const scrollTo=vi.fn()
 Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:scrollTo})
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {left:this.tagName==='BUTTON'?700:100,width:this.tagName==='BUTTON'?190:390} as DOMRect})
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390)
 render(<ScheduleView schedule={[previous,thisWeek,nextWeek]} currentEvent={previous} session={emptySession()} onSelectSession={()=>{}}/>)
 expect(screen.getByRole('button',{name:/GP 17/}).getAttribute('aria-pressed')).toBe('true')
 expect(scrollTo).toHaveBeenLastCalledWith({left:500,behavior:'auto'})
 fireEvent.click(screen.getByRole('button',{name:/GP 18/}))
 expect(screen.getByRole('button',{name:/GP 18/}).getAttribute('aria-pressed')).toBe('true')
 expect(scrollTo).toHaveBeenCalledTimes(2)
})
it('selects the next GP when this week has no remaining race, including after reopening',()=>{
 vi.useFakeTimers()
 vi.setSystemTime(new Date('2026-10-12T00:00:00Z'))
 const previous=scheduledEvent(17,'2026-10-11T12:00:00Z'),next=scheduledEvent(18,'2026-10-25T12:00:00Z')
 const props={schedule:[next,previous],currentEvent:previous,session:emptySession(),onSelectSession:()=>{}}
 const {unmount}=render(<ScheduleView {...props}/>)
 expect(screen.getByRole('button',{name:/GP 18/}).getAttribute('aria-pressed')).toBe('true')
 fireEvent.click(screen.getByRole('button',{name:/GP 17/}))
 unmount()
 render(<ScheduleView {...props}/>)
 expect(screen.getByRole('button',{name:/GP 18/}).getAttribute('aria-pressed')).toBe('true')
})
