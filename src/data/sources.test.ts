import {describe,expect,it} from 'vitest'
import {emptySession,F1ArchiveSource,mergeSignalRCoreFrame,mergeSignalRPacket} from './sources'

describe('SignalR packets',()=>{
  it('hydrates the current qualifying session from the subscription snapshot',()=>{
    const state=mergeSignalRPacket(emptySession(),{R:{
      SessionInfo:{Name:'Qualifying',Meeting:{Name:'Italian Grand Prix',Circuit:{ShortName:'Monza'}}},
      SessionData:{StatusSeries:{'0':{SessionStatus:'Started'}}},
      ExtrapolatedClock:{Remaining:'00:17:42'},
      DriverList:{'16':{Tla:'LEC',FullName:'Charles Leclerc',TeamName:'Ferrari',TeamColour:'E8002D'}},
      TimingData:{Lines:{'16':{Position:'1',BestLapTime:{Value:'1:19.876'}}}}
    }})

    expect(state).toMatchObject({sessionName:'Qualifying',meetingName:'Italian Grand Prix',status:'STARTED',timeRemaining:'00:17:42'})
    expect(state.drivers[0]).toMatchObject({number:'16',code:'LEC',position:1,bestLap:'1:19.876'})
  })

  it('continues to apply incremental feed messages',()=>{
    const state=mergeSignalRPacket(emptySession(),{M:[{M:'feed',A:['SessionInfo',{Name:'Race'}]},{M:'feed',A:['SessionData',{StatusSeries:{'1':{SessionStatus:'Started'}}}]}]})
    expect(state).toMatchObject({sessionName:'Race',phase:'RACE',status:'STARTED'})
  })

  it('hydrates and updates from SignalR Core records',()=>{
    const rs='\x1e'
    const state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,invocationId:'0',result:{SessionInfo:{Name:'Qualifying',Meeting:{Name:'Italian Grand Prix'}},SessionData:{StatusSeries:{'0':{SessionStatus:'Started'}}}}})+rs+JSON.stringify({type:1,target:'feed',arguments:['ExtrapolatedClock',{Remaining:'00:09:54'}]})+rs)
    expect(state).toMatchObject({sessionName:'Qualifying',meetingName:'Italian Grand Prix',status:'STARTED',timeRemaining:'00:09:54'})
  })
  it('uses the latest session status instead of a later track-only update',()=>{const rs='\x1e',state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{SessionInfo:{Name:'Race'},SessionData:{StatusSeries:[{SessionStatus:'Started'},{TrackStatus:'Yellow'}]}}})+rs);expect(state.status).toBe('STARTED')})
  it('normalises live session dates with their GMT offset',()=>{const rs='\x1e',state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{SessionInfo:{Name:'Qualifying',StartDate:'2026-09-05T16:00:00',EndDate:'2026-09-05T17:00:00',GmtOffset:'02:00:00'}}})+rs);expect(state).toMatchObject({sessionStart:'2026-09-05T16:00:00+02:00',sessionEnd:'2026-09-05T17:00:00+02:00'})})
})

describe('official starting grid',()=>{
  it('includes Italian GP grid penalties',async()=>{const grid=await new F1ArchiveSource().loadGrid({season:2026,round:13,meetingName:'Italian Grand Prix',circuit:'Monza',locality:'Monza',country:'Italy',qualifyingStart:'',raceStart:'',timeZone:'Europe/Rome'});expect(grid['12']).toBe(19);expect(grid['81']).toBe(6)})
})
