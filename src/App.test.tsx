import {afterEach,expect,it,vi} from 'vitest'
import {act,cleanup,render} from '@testing-library/react'
import App from './App'
import {emptySession,F1ArchiveSource,F1SignalRSource,JolpicaDataSource,mergeFeed} from './data/sources'

const event={season:2026,round:4,meetingName:'Bahrain Grand Prix',circuit:'Sakhir',locality:'Sakhir',country:'Bahrain',qualifyingStart:'2026-04-11T16:00:00Z',raceStart:'2026-04-12T15:00:00Z',timeZone:'Asia/Bahrain'}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();localStorage.clear()})

it('automatically updates a published penalty grid while qualifying retrieval is pending',async()=>{
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-12T10:00:00Z'))
  const qualifying={...mergeFeed(emptySession(),'TimingData',{SessionPart:3,Lines:{'6':{Position:'3',BestLapTime:{Value:'1:29.000'}}}}),meetingName:event.meetingName,sessionName:'Qualifying',status:'FINISHED' as const,qualifyingPartStarted:true,qualifyingFinalised:true}
  vi.spyOn(JolpicaDataSource.prototype,'getSeasonSchedule').mockResolvedValue([event])
  vi.spyOn(JolpicaDataSource.prototype,'getDriverStandings').mockResolvedValue([])
  vi.spyOn(JolpicaDataSource.prototype,'getConstructorStandings').mockResolvedValue([])
  vi.spyOn(F1SignalRSource.prototype,'connect').mockImplementation(async(onState)=>{onState(qualifying);return()=>{}})
  vi.spyOn(F1ArchiveSource.prototype,'loadQualifying').mockReturnValue(new Promise(()=>{}))
  vi.spyOn(F1ArchiveSource.prototype,'loadRaceResults').mockResolvedValue([])
  const grid=vi.spyOn(F1ArchiveSource.prototype,'loadGrid').mockResolvedValueOnce({}).mockResolvedValue({'6':6})
  const {container}=render(<App/> )
  await act(async()=>{})
  expect([...container.querySelectorAll('tbody .position')].map(cell=>cell.textContent)).toEqual(['3','3'])
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000)})
  expect(grid).toHaveBeenCalledTimes(2)
  expect([...container.querySelectorAll('tbody .position')].map(cell=>cell.textContent)).toEqual(['3','6'])
  expect(container.querySelector('.grid-change')?.textContent).toContain('▼ 3')
})
