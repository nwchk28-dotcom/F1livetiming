import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {ScheduleView} from './ScheduleView'
import {emptySession} from './data/sources'
import type {RaceWeekend} from './types'
afterEach(()=>cleanup())
it('selects future weekends and displays sprint sessions in Japan time',()=>{
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
