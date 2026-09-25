import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {RaceWeekend} from '../types'
import {emptySession} from './sources'
import {bestAvailableQualifying,pruneFinalQualifying,readFinalQualifying,saveArchivedQualifying,saveFinalQualifying} from './qualifyingResult'

const event:RaceWeekend={season:2026,round:18,meetingName:'Singapore Grand Prix',circuit:'Marina Bay',locality:'Singapore',country:'Singapore',qualifyingStart:'2026-09-25T13:00:00Z',raceStart:'2026-09-26T12:00:00Z',timeZone:'Asia/Singapore'}
const driver=(number:string,position:number,bestLap:string)=>({position,previousPosition:position,gridPosition:99,number,code:number,fullName:`Driver ${number}`,team:'Team',teamColor:'#fff',bestLap,lastLap:bestLap,gap:'—',interval:'—',sectors:[{value:'28.000',status:'normal' as const},{value:'—',status:'normal' as const},{value:'—',status:'normal' as const}],tyre:{compound:'SOFT' as const,laps:3},pitStops:0,status:'RUNNING' as const,timingImprovedAt:Date.now()})
const result=()=>({...emptySession(),meetingName:event.meetingName,sessionName:'Qualifying',phase:'Q3' as const,status:'FINISHED' as const,qualifyingPartStarted:true,qualifyingFinalised:true,drivers:[driver('1',1,'1:19.000'),driver('2',2,'1:19.100')]})

describe('completed qualifying snapshot',()=>{
  beforeEach(()=>{localStorage.clear();vi.useFakeTimers();vi.setSystemTime('2026-09-25T14:00:00Z')})
  afterEach(()=>{vi.useRealTimers();localStorage.clear()})

  it('saves only a finalised result and restores it after reload',()=>{
    expect(saveFinalQualifying(event,{...result(),qualifyingFinalised:false})).toBeUndefined()
    expect(readFinalQualifying(event)).toBeUndefined()
    const saved=saveFinalQualifying(event,result())
    expect(saved?.drivers.map(d=>d.status)).toEqual(['FINISHED','FINISHED'])
    expect(saved?.drivers.every(d=>d.timingImprovedAt===undefined)).toBe(true)
    expect(readFinalQualifying(event)?.drivers.map(d=>d.bestLap)).toEqual(['1:19.000','1:19.100'])
    expect(readFinalQualifying({...event,round:19})).toBeUndefined()
  })

  it('keeps the complete snapshot when a later feed update contains fewer drivers',()=>{
    saveFinalQualifying(event,result())
    saveFinalQualifying(event,{...result(),drivers:[driver('1',1,'1:18.900')]})
    expect(readFinalQualifying(event)?.drivers.map(d=>d.number)).toEqual(['1','2'])
    saveFinalQualifying(event,{...result(),drivers:[driver('1',1,'1:18.900'),driver('2',2,'1:19.100')]})
    expect(readFinalQualifying(event)?.drivers[0].bestLap).toBe('1:18.900')
  })

  it('saves an archive result when the browser missed the live finish',()=>{
    const archive={...result(),meetingName:'',qualifyingFinalised:false,drivers:result().drivers.map(d=>({...d,status:'PIT' as const}))}
    expect(saveArchivedQualifying(event,archive)?.drivers.map(d=>d.status)).toEqual(['FINISHED','FINISHED'])
    expect(readFinalQualifying(event)?.meetingName).toBe(event.meetingName)
  })

  it('expires the saved result 48 hours after scheduled race start',()=>{
    saveFinalQualifying(event,result())
    const end=Date.parse(event.raceStart)+48*60*60*1000
    expect(readFinalQualifying(event,end-1)).toBeDefined()
    pruneFinalQualifying(end)
    expect(readFinalQualifying(event,end)).toBeUndefined()
  })

  it('uses the live result until an archive has as many ranked drivers and enough timing detail',()=>{
    const live=result()
    expect(bestAvailableQualifying(live,{...live,drivers:[live.drivers[0]]})).toBe(live)
    const sparse={...live,drivers:live.drivers.map(d=>({...d,sectors:d.sectors.map(s=>({...s,value:'—'}))}))}
    expect(bestAvailableQualifying(live,sparse)).toBe(live)
    const corrected={...live,drivers:live.drivers.map(d=>({...d,bestLap:'1:18.000'}))}
    expect(bestAvailableQualifying(live,corrected)).toBe(corrected)
  })
})
