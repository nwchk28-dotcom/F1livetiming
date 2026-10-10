import {afterEach,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react'
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
  expect(screen.getByRole('heading',{name:'レースウィーク日程'})).toBeTruthy()
  fireEvent.click(within(screen.getByRole('navigation',{name:'画面切り替え'})).getByRole('button',{name:'予選'}))
  expect([...container.querySelectorAll('tbody .position')].map(cell=>cell.textContent)).toEqual(['3','3'])
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000)})
  expect(grid).toHaveBeenCalledTimes(2)
  expect([...container.querySelectorAll('tbody .position')].map(cell=>cell.textContent)).toEqual(['3','6'])
  expect(container.querySelector('.grid-change')?.textContent).toContain('▼ 3')
})

it('starts on the schedule even during a sprint and highlights overtakes after selecting sprint timing',async()=>{
 vi.useFakeTimers()
 vi.setSystemTime(new Date('2026-10-10T09:10:00Z'))
 const sprintEvent={...event,round:17,meetingName:'Singapore Grand Prix',qualifyingStart:'2026-10-10T13:00:00Z',raceStart:'2026-10-11T12:00:00Z',sprintQualifyingStart:'2026-10-09T12:30:00Z',sprintStart:'2026-10-10T09:00:00Z'}
 vi.spyOn(JolpicaDataSource.prototype,'getSeasonSchedule').mockResolvedValue([sprintEvent])
 vi.spyOn(JolpicaDataSource.prototype,'getDriverStandings').mockResolvedValue([])
 vi.spyOn(JolpicaDataSource.prototype,'getConstructorStandings').mockResolvedValue([])
 const grid=vi.spyOn(F1ArchiveSource.prototype,'loadGrid').mockResolvedValue({'1':15})
 let publish:(s:ReturnType<typeof emptySession>)=>void=()=>{}
 let session=mergeFeed(emptySession(),'SessionInfo',{Name:'Sprint',Meeting:{Name:sprintEvent.meetingName},Path:'2026/singapore/sprint/'})
 session=mergeFeed(session,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'}}})
 session=mergeFeed(session,'TimingData',{Lines:{1:{Position:'1'},2:{Position:'2'}}})
 session=mergeFeed(session,'TimingAppData',{Lines:{1:{GridPos:'1'},2:{GridPos:'2'}}})
 vi.spyOn(F1SignalRSource.prototype,'connect').mockImplementation(async(onState)=>{publish=onState;onState(session);return()=>{}})
 const {container}=render(<App/>)
 await act(async()=>{await vi.advanceTimersByTimeAsync(350)})
 expect(screen.getByRole('heading',{name:'レースウィーク日程'})).toBeTruthy()
 expect(container.querySelector('.view-tabs > button.active')?.textContent).toBe('日程')
 fireEvent.click(within(screen.getByRole('navigation',{name:'画面切り替え'})).getByRole('button',{name:'スプリント決勝'}))
 expect(screen.getByRole('heading',{name:'スプリント決勝順位'})).toBeTruthy()
 expect(container.querySelector('tr[data-driver="1"]')?.children[1].textContent).toBe('1')
 session=mergeFeed(session,'TimingData',{Lines:{1:{Position:'2'},2:{Position:'1'}}})
 await act(async()=>{publish(session)})
 await act(async()=>{await vi.advanceTimersByTimeAsync(350)})
 expect(container.querySelector('tr[data-driver="2"]')?.className).toBe('position-up')
 expect(grid).not.toHaveBeenCalled()
})

it('projects sprint points for both championships and refreshes official standings after finish',async()=>{
 vi.useFakeTimers()
 vi.setSystemTime(new Date('2026-10-10T09:10:00Z'))
 const sprintEvent={...event,meetingName:'Singapore Grand Prix',qualifyingStart:'2026-10-10T13:00:00Z',raceStart:'2026-10-11T12:00:00Z',sprintStart:'2026-10-10T09:00:00Z'}
 const base=[{id:'a',name:'Driver A',code:'AAA',team:'Team X',points:100,wins:0,color:'#f00'},{id:'b',name:'Driver B',code:'BBB',team:'Team X',points:90,wins:0,color:'#f00'}]
 vi.spyOn(JolpicaDataSource.prototype,'getSeasonSchedule').mockResolvedValue([sprintEvent])
 const drivers=vi.spyOn(JolpicaDataSource.prototype,'getDriverStandings').mockResolvedValue(base)
 const teams=vi.spyOn(JolpicaDataSource.prototype,'getConstructorStandings').mockResolvedValue([{id:'x',name:'Team X',code:'TEX',team:'Team X',points:190,wins:0,color:'#f00'}])
 let publish:(s:ReturnType<typeof emptySession>)=>void=()=>{}
 let session=mergeFeed(emptySession(),'SessionInfo',{Name:'Sprint',Meeting:{Name:sprintEvent.meetingName}})
 session=mergeFeed(session,'DriverList',{1:{Tla:'AAA',TeamName:'Team X'},2:{Tla:'BBB',TeamName:'Team X'}})
 session=mergeFeed(session,'TimingData',{Lines:{1:{Position:'1'},2:{Position:'2'}}})
 session=mergeFeed(session,'SessionData',{StatusSeries:{0:{SessionStatus:'Started'}}})
 vi.spyOn(F1SignalRSource.prototype,'connect').mockImplementation(async(onState)=>{publish=onState;onState(session);return()=>{}})
 const {container}=render(<App/>)
 await act(async()=>{})
 fireEvent.click(within(screen.getByRole('navigation')).getByRole('button',{name:'チャンピオンシップ'}))
 expect(screen.getByRole('heading',{name:'暫定チャンピオンシップ'})).toBeTruthy()
 expect(container.querySelector('.provisional')?.textContent).toBe('暫定')
 expect([...container.querySelectorAll('.total-points')].map(e=>e.textContent)).toEqual(['108PTS','97PTS'])
 fireEvent.click(screen.getByRole('button',{name:'コンストラクター'}))
 expect(container.querySelector('.total-points')?.textContent).toBe('205PTS')
 expect(container.querySelector('.gain')?.textContent).toContain('+15')
 drivers.mockResolvedValue(base.map((d,i)=>({...d,points:d.points+(i===0?8:7)})))
 teams.mockResolvedValue([{id:'x',name:'Team X',code:'TEX',team:'Team X',points:205,wins:0,color:'#f00'}])
 await act(async()=>{publish(mergeFeed(session,'SessionData',{StatusSeries:{0:{SessionStatus:'Finished'}}}))})
 expect(container.querySelector('.provisional')).toBeNull()
 expect(container.querySelector('.total-points')?.textContent).toBe('205PTS')
 expect(drivers).toHaveBeenCalledTimes(2)
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000)})
 expect(drivers).toHaveBeenCalledTimes(3)
 expect(container.querySelector('.total-points')?.textContent).toBe('205PTS')
})
