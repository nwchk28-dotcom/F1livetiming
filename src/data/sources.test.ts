import {afterEach,describe,expect,it,vi} from 'vitest'
import {emptySession,mergeFeed,F1ArchiveSource,mergeSignalRCoreFrame,mergeSignalRPacket} from './sources'

describe('SignalR packets',()=>{
  it('records actual race finish time and retains it through finalisation and reload snapshots',()=>{
    let s=mergeFeed(emptySession(),'SessionInfo',{Name:'Race',EndDate:'2026-09-13T16:00:00Z'})
    s=mergeFeed(s,'SessionData',{StatusSeries:{'0':{SessionStatus:'Finished',Utc:'2026-09-13T14:30:00Z'}}})
    expect(s.sessionFinishedAt).toBe('2026-09-13T14:30:00.000Z')
    s=mergeFeed(s,'SessionData',{StatusSeries:{'1':{SessionStatus:'Finalised',Utc:'2026-09-13T14:35:00Z'}}})
    expect(s.status).toBe('FINISHED')
    expect(s.sessionFinishedAt).toBe('2026-09-13T14:30:00.000Z')
    const restored=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{SessionInfo:{Name:'Race'},SessionData:{StatusSeries:[{SessionStatus:'Finished',Utc:'2026-09-13T14:30:00Z'},{SessionStatus:'Finalised',Utc:'2026-09-13T14:35:00Z'}]}}})+'\x1e')
    expect(restored.status).toBe('FINISHED')
    expect(restored.sessionFinishedAt).toBe('2026-09-13T14:30:00.000Z')
  })
  it('does not highlight initial snapshots but highlights subsequent improvements',()=>{let s=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{TimingData:{Lines:{'1':{Position:'1',BestLapTime:{Value:'1:33.000'}}}}}})+'\x1e');expect(s.drivers[0].timingImprovedAt).toBeUndefined();s=mergeSignalRCoreFrame(s,JSON.stringify({type:1,target:'feed',arguments:['TimingData',{Lines:{'1':{BestLapTime:{Value:'1:32.000'}}}}]})+'\x1e');expect(s.drivers[0].timingImprovedAt).toBeGreaterThan(0)})
  it('does not mark a driver with no lap time when only the position changes',()=>{
    let state=mergeFeed(emptySession(),'TimingData',{SessionPart:1,Lines:{'1':{Position:'2'},'2':{Position:'1'}}})
    state=mergeFeed(state,'TimingData',{Lines:{'1':{Position:'1'},'2':{Position:'2'}}})
    expect(state.drivers.map(d=>d.bestLap)).toEqual(['—','—'])
    expect(state.drivers.every(d=>d.sectors.every(sector=>sector.value==='—'))).toBe(true)
    expect(state.drivers.every(d=>d.timingImprovedAt===undefined)).toBe(true)
  })
  it('clears the previous part highlight until a new best lap is recorded',()=>{
    let state=mergeFeed(emptySession(),'TimingData',{SessionPart:2,Lines:{'1':{Position:'1',BestLapTime:{Value:'1:20.000'}}}})
    expect(state.drivers[0].timingImprovedAt).toBeGreaterThan(0)
    state=mergeFeed(state,'SessionData',{Series:{'2':{QualifyingPart:3}}})
    expect(state.drivers[0].bestLap).toBe('—')
    expect(state.drivers[0].timingImprovedAt).toBeUndefined()
    state=mergeFeed(state,'TimingData',{SessionPart:3,Lines:{'1':{Position:'2'}}})
    expect(state.drivers[0].timingImprovedAt).toBeUndefined()
    state=mergeFeed(state,'TimingData',{Lines:{'1':{BestLapTime:{Value:'1:19.500'}}}})
    expect(state.drivers[0].timingImprovedAt).toBeGreaterThan(0)
  })
  it('removes the update mark when a best lap is cleared or corrected slower',()=>{
    let state=mergeFeed(emptySession(),'TimingData',{SessionPart:3,Lines:{'81':{Position:'3',BestLapTime:{Value:'1:19.500'}}}})
    expect(state.drivers[0].timingImprovedAt).toBeGreaterThan(0)
    state=mergeFeed(state,'TimingData',{Lines:{'81':{BestLapTime:{Value:''}}}})
    expect(state.drivers[0]).toMatchObject({bestLap:'—',timingImprovedAt:undefined})
    state=mergeFeed(state,'TimingData',{Lines:{'81':{BestLapTime:{Value:'1:19.400'}}}})
    expect(state.drivers[0].timingImprovedAt).toBeGreaterThan(0)
    state=mergeFeed(state,'TimingData',{Lines:{'81':{BestLapTime:{Value:'1:19.900'}}}})
    expect(state.drivers[0].timingImprovedAt).toBeUndefined()
  })
  it('clears downstream sectors and suppresses colours on unmeasured times',()=>{let s=mergeFeed(emptySession(),'TimingData',{Lines:{'1':{Position:'2',BestLapTime:{Value:'',PersonalFastest:true},Stats:{'0':{TimeDiffToPositionAhead:'+0.250'}},Sectors:{'0':{Value:'28.000'},'1':{Value:'33.000',PersonalFastest:true},'2':{Value:'31.000',OverallFastest:true}}}}});expect(s.drivers[0].bestLapStatus).toBe('normal');expect(s.drivers[0].gap).toBe('+0.250');s=mergeFeed(s,'TimingData',{Lines:{'1':{Sectors:{'0':{Value:'27.900',PersonalFastest:true}}}}});expect(s.drivers[0].sectors.slice(1)).toEqual([{value:'—',status:'normal'},{value:'—',status:'normal'}])})
  it('clears previous qualifying segment times when Q2 starts',()=>{let s=mergeFeed(emptySession(),'TimingData',{SessionPart:1,Lines:{'12':{Position:'1',BestLapTime:{Value:'1:33.000'},Sectors:{'0':{Value:'28.000',OverallFastest:true}}}}});s=mergeFeed(s,'SessionData',{Series:{'2':{QualifyingPart:2}}});expect(s.phase).toBe('Q2');expect(s.drivers[0].bestLap).toBe('—');expect(s.drivers[0].sectors[0]).toEqual({value:'—',status:'normal'});s=mergeFeed(s,'TimingData',{SessionPart:2,Lines:{'12':{BestLapTime:{Value:'1:32.000'}}}});expect(s.drivers[0].bestLap).toBe('1:32.000')})
  it('does not treat the previous part finish as a Q3 finish',()=>{
    let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Qualifying'})
    state=mergeFeed(state,'SessionData',{Series:{'0':{QualifyingPart:2}},StatusSeries:{'0':{SessionStatus:'Started'}}})
    expect(state.qualifyingPartStarted).toBe(true)
    state=mergeFeed(state,'SessionData',{StatusSeries:{'1':{SessionStatus:'Finished'}}})
    state=mergeFeed(state,'SessionData',{Series:{'1':{QualifyingPart:3}},StatusSeries:{'1':{SessionStatus:'Finished'}}})
    expect(state).toMatchObject({phase:'Q3',status:'FINISHED',qualifyingPartStarted:false})
    state=mergeFeed(state,'SessionData',{StatusSeries:{'2':{SessionStatus:'Started'}}})
    expect(state).toMatchObject({phase:'Q3',status:'STARTED',qualifyingPartStarted:true})
    state=mergeFeed(state,'SessionData',{StatusSeries:{'3':{SessionStatus:'Finished'}}})
    expect(state).toMatchObject({phase:'Q3',status:'FINISHED',qualifyingPartStarted:true})
  })
  it('restores the correct part from a qualifying subscription snapshot',()=>{
    const base={SessionInfo:{Name:'Qualifying'},TimingData:{SessionPart:3,Lines:{}}}
    const status=(items:string[])=>({type:3,result:{...base,SessionData:{Series:[{QualifyingPart:1},{QualifyingPart:2},{QualifyingPart:3}],StatusSeries:items.map(SessionStatus=>({SessionStatus}))}}})
    const between=mergeSignalRCoreFrame(emptySession(),JSON.stringify(status(['Started','Finished','Started','Finished']))+'\x1e')
    expect(between).toMatchObject({phase:'Q3',status:'FINISHED',qualifyingPartStarted:false})
    const complete=mergeSignalRCoreFrame(emptySession(),JSON.stringify(status(['Started','Finished','Started','Finished','Started','Finished']))+'\x1e')
    expect(complete).toMatchObject({phase:'Q3',status:'FINISHED',qualifyingPartStarted:true})
  })
  it('clears the previous qualifying part chequered flag when Q3 starts',()=>{
    let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Qualifying'})
    state=mergeFeed(state,'SessionData',{Series:{'0':{QualifyingPart:2}},StatusSeries:{'0':{SessionStatus:'Started'}}})
    state=mergeFeed(state,'RaceControlMessages',{Messages:{'1':{Category:'Flag',Flag:'CHEQUERED',Scope:'Track'}}})
    state=mergeFeed(state,'SessionData',{StatusSeries:{'1':{SessionStatus:'Finished'}}})
    state=mergeFeed(state,'SessionData',{Series:{'1':{QualifyingPart:3}}})
    expect(state.flag).toBe('CHEQUERED')
    state=mergeFeed(state,'SessionData',{StatusSeries:{'2':{SessionStatus:'Started'}}})
    expect(state.flag).toBe('GREEN')
  })
  it('ignores an earlier part chequered message while Q3 still has time remaining',()=>{
    let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Qualifying'})
    state=mergeFeed(state,'SessionData',{Series:{'2':{QualifyingPart:3}},StatusSeries:{'2':{SessionStatus:'Started'}}})
    state=mergeFeed(state,'TrackStatus',{Status:'2'})
    state=mergeFeed(state,'ExtrapolatedClock',{Remaining:'00:09:39'})
    const chequered={Messages:{'8':{Category:'Flag',Flag:'CHEQUERED',Scope:'Track'}}}
    state=mergeFeed(state,'RaceControlMessages',chequered)
    expect(state.flag).toBe('YELLOW')
    state=mergeFeed(state,'ExtrapolatedClock',{Remaining:'00:00:00'})
    state=mergeFeed(state,'RaceControlMessages',chequered)
    expect(state.flag).toBe('CHEQUERED')
  })
  it('restores the track flag when a qualifying clock arrives after a stale chequered message',()=>{
    let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Qualifying'})
    state=mergeFeed(state,'SessionData',{Series:{'2':{QualifyingPart:3}},StatusSeries:{'2':{SessionStatus:'Started'}}})
    state=mergeFeed(state,'TrackStatus',{Status:'2'})
    state=mergeFeed(state,'RaceControlMessages',{Messages:{'8':{Flag:'CHEQUERED',Scope:'Track'}}})
    expect(state.flag).toBe('CHEQUERED')
    state=mergeFeed(state,'ExtrapolatedClock',{Remaining:'00:09:39'})
    expect(state.flag).toBe('YELLOW')
  })
  it('recalculates qualifying gaps whenever best laps or positions change',()=>{
    let state=mergeFeed(emptySession(),'TimingData',{SessionPart:1,Lines:{'1':{Position:'1',BestLapTime:{Value:'1:20.000'}},'2':{Position:'2',BestLapTime:{Value:'1:20.400'}},'3':{Position:'3',BestLapTime:{Value:'1:21.100'}}}})
    expect(state.drivers.map(d=>d.gap)).toEqual(['—','+0.400','+0.700'])
    state=mergeFeed(state,'TimingData',{Lines:{'1':{BestLapTime:{Value:'1:19.800'}}}})
    expect(state.drivers.map(d=>d.gap)).toEqual(['—','+0.600','+0.700'])
    state=mergeFeed(state,'TimingData',{Lines:{'2':{Position:'1',BestLapTime:{Value:'1:19.700'}},'1':{Position:'2'}}})
    expect(state.drivers.map(d=>d.gap)).toEqual(['—','+0.100','+1.300'])
    state=mergeFeed(state,'TimingData',{Lines:{'1':{BestLapTime:{Value:''}}}})
    expect(state.drivers.map(d=>d.gap)).toEqual(['—','—','—'])
  })
  it('keeps race gaps from the live feed',()=>{let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Race'});state=mergeFeed(state,'TimingData',{Lines:{'1':{Position:'1',BestLapTime:{Value:'1:20.000'}},'2':{Position:'2',BestLapTime:{Value:'1:20.400'},GapToLeader:'+4.012'}}});expect(state.drivers[1].gap).toBe('+4.012')})
  it('preserves pit and out status across partial timing updates until an explicit exit',()=>{
    let state=mergeFeed(emptySession(),'TimingData',{Lines:{'1':{Position:'1',InPit:true},'2':{Position:'2',Retired:true},'3':{Position:'3',InPit:true,Retired:true}}})
    expect(state.drivers.map(d=>d.status)).toEqual(['PIT','OUT','OUT'])
    state=mergeFeed(state,'TimingData',{Lines:{'1':{LastLapTime:{Value:'1:25.000'}},'2':{Position:'2'},'3':{Position:'3'}}})
    expect(state.drivers.map(d=>d.status)).toEqual(['PIT','OUT','OUT'])
    state=mergeFeed(state,'TimingData',{Lines:{'1':{InPit:false}}})
    expect(state.drivers[0].status).toBe('RUNNING')
    state=mergeFeed(state,'TimingData',{Lines:{'1':{InPit:true}}})
    state=mergeFeed(state,'TimingData',{Lines:{'1':{PitOut:true}}})
    expect(state.drivers[0].status).toBe('RUNNING')
  })
  it('shows the chequered flag and final driver status without reviving running cars',()=>{
    let state=mergeFeed(emptySession(),'SessionInfo',{Name:'Race'})
    state=mergeFeed(state,'TimingData',{Lines:{'1':{Position:'1',InPit:true},'2':{Position:'2',Retired:true},'3':{Position:'3'}}})
    state=mergeFeed(state,'RaceControlMessages',{Messages:{'4':{Category:'Flag',Flag:'CHEQUERED',Scope:'Track'}}})
    expect(state.flag).toBe('CHEQUERED')
    state=mergeFeed(state,'SessionData',{StatusSeries:{'1':{SessionStatus:'Finished'}}})
    expect(state.drivers.map(d=>d.status)).toEqual(['FINISHED','OUT','FINISHED'])
    state=mergeFeed(state,'TimingData',{Lines:{'1':{InPit:true},'3':{Position:'3'}}})
    state=mergeFeed(state,'TrackStatus',{Status:'1'})
    expect(state.drivers.map(d=>d.status)).toEqual(['FINISHED','OUT','FINISHED'])
    expect(state.flag).toBe('CHEQUERED')
  })
  it('demotes the previous overall sector best when a faster overall best arrives',()=>{let state=mergeFeed(emptySession(),'TimingData',{Lines:{'12':{Sectors:{'0':{Value:'28.785',OverallFastest:true}}}}});state=mergeFeed(state,'TimingData',{Lines:{'3':{Sectors:{'0':{Value:'28.737',OverallFastest:true}}}}});expect(state.drivers.find(d=>d.number==='12')?.sectors[0]).toEqual({value:'28.785',status:'personal'});expect(state.drivers.find(d=>d.number==='3')?.sectors[0].status).toBe('overall');state=mergeFeed(state,'TimingData',{Lines:{'3':{Sectors:{'0':{OverallFastest:false}}}}});expect(state.drivers.filter(d=>d.sectors[0].status==='overall')).toHaveLength(1)})
  it('retains fastest colours until the displayed time changes',()=>{let state=mergeFeed(emptySession(),'TimingData',{Lines:{'1':{BestLapTime:{Value:'1:20.000',PersonalFastest:true},Sectors:{'0':{Value:'25.000',OverallFastest:true}}}}});state=mergeFeed(state,'TimingData',{Lines:{'1':{BestLapTime:{PersonalFastest:false},Sectors:{'0':{OverallFastest:false}}}}});expect(state.drivers[0].bestLapStatus).toBe('personal');expect(state.drivers[0].sectors[0].status).toBe('overall');state=mergeFeed(state,'TimingData',{Lines:{'1':{BestLapTime:{Value:'1:21.000'},Sectors:{'0':{Value:'26.000'}}}}});expect(state.drivers[0].bestLapStatus).toBe('normal');expect(state.drivers[0].sectors[0].status).toBe('normal')})
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
  it('keeps tyre and grid data when TimingAppData arrives before DriverList',()=>{const rs='\x1e',state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{TimingAppData:{Lines:{'12':{GridPos:'19',Stints:[{Compound:'HARD',TotalLaps:3},{Compound:'MEDIUM',TotalLaps:16}]}}},DriverList:{'12':{Tla:'ANT',FullName:'Kimi ANTONELLI'}}}})+rs);expect(state.drivers[0]).toMatchObject({number:'12',code:'ANT',gridPosition:19,tyre:{compound:'MEDIUM',laps:16}})})
  it('uses the latest session status instead of a later track-only update',()=>{const rs='\x1e',state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{SessionInfo:{Name:'Race'},SessionData:{StatusSeries:[{SessionStatus:'Started'},{TrackStatus:'Yellow'}]}}})+rs);expect(state.status).toBe('STARTED')})
  it('normalises live session dates with their GMT offset',()=>{const rs='\x1e',state=mergeSignalRCoreFrame(emptySession(),JSON.stringify({type:3,result:{SessionInfo:{Name:'Qualifying',StartDate:'2026-09-05T16:00:00',EndDate:'2026-09-05T17:00:00',GmtOffset:'02:00:00'}}})+rs);expect(state).toMatchObject({sessionStart:'2026-09-05T16:00:00+02:00',sessionEnd:'2026-09-05T17:00:00+02:00'})})
})

describe('completed qualifying results',()=>{
  const event={season:2026,round:14,meetingName:'Spanish Grand Prix',circuit:'Madrid',locality:'Madrid',country:'Spain',qualifyingStart:'',raceStart:'',timeZone:'Europe/Madrid'}
  afterEach(()=>{vi.unstubAllGlobals();localStorage.clear()})

  it('marks every archived driver finished and preserves timing data on reload',async()=>{
    localStorage.clear()
    const timing={Lines:{'1':{Position:'1',BestLapTime:{Value:'1:32.000',OverallFastest:true},Sectors:{'0':{Value:'28.000',PersonalFastest:true}}},'12':{Position:'2',InPit:true},'44':{Position:'3',Retired:true}}}
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
      if(input.endsWith('Index.json'))return new Response(JSON.stringify({Meetings:[{Name:event.meetingName,Sessions:[{Name:'Qualifying',Path:'qualifying/'}]}]}))
      return new Response(input.endsWith('TimingData.jsonStream')?JSON.stringify(timing):'')
    }))
    for(let reload=0;reload<2;reload++){
      const result=await new F1ArchiveSource().loadQualifying(event)
      expect(result?.status).toBe('FINISHED')
      expect(result?.drivers.map(d=>d.status)).toEqual(['FINISHED','FINISHED','FINISHED'])
      expect(result?.drivers[0]).toMatchObject({position:1,bestLap:'1:32.000',bestLapStatus:'overall'})
      expect(result?.drivers[0].sectors[0]).toEqual({value:'28.000',status:'personal'})
    }
  })

  it('marks fallback API qualifying results finished',async()=>{
    localStorage.clear()
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>input.endsWith('Index.json')?new Response('',{status:503}):new Response(JSON.stringify({MRData:{RaceTable:{Races:[{QualifyingResults:[{number:'44',position:'2',Q3:'1:32.079',Driver:{code:'HAM',givenName:'Lewis',familyName:'Hamilton'},Constructor:{name:'Ferrari'}}]}]}}}))))
    const result=await new F1ArchiveSource().loadQualifying(event)
    expect(result?.drivers[0]).toMatchObject({status:'FINISHED',position:2,gridPosition:2,bestLap:'1:32.079'})
  })

  it('keeps live and inter-segment driver statuses unchanged',()=>{
    for(const phase of [1,2,3]){
      let state=mergeFeed(emptySession(),'TimingData',{SessionPart:phase,Lines:{'1':{Position:'1'},'12':{Position:'2',InPit:true},'44':{Position:'3',Retired:true}}})
      state=mergeFeed(state,'SessionData',{StatusSeries:{'0':{SessionStatus:'Finished'}}})
      expect(state.drivers.map(d=>d.status)).toEqual(['RUNNING','PIT','OUT'])
    }
  })
})

describe('official starting grid',()=>{
  it('includes Italian GP grid penalties',async()=>{const grid=await new F1ArchiveSource().loadGrid({season:2026,round:13,meetingName:'Italian Grand Prix',circuit:'Monza',locality:'Monza',country:'Italy',qualifyingStart:'',raceStart:'',timeZone:'Europe/Rome'});expect(grid['12']).toBe(19);expect(grid['81']).toBe(6)})
})
