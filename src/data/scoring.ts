import type { ChampionshipProjection, DriverTiming, StandingEntry } from '../types'

export const SCORING = {
  race: [25,18,15,12,10,8,6,4,2,1],
  sprint: [8,7,6,5,4,3,2,1],
} as const

export function projectDriverStandings(base: StandingEntry[], timing: DriverTiming[], sprint=false): ChampionshipProjection[] {
  const points = sprint ? SCORING.sprint : SCORING.race
  return base.map((entry, index) => {
    const live = timing.find(d=>d.code===entry.code)
    const gain = live && live.status !== 'OUT' ? (points[live.position-1] ?? 0) : 0
    return {...entry, position:0, previousPosition:index+1, projectedGain:gain, points:entry.points+gain}
  }).sort((a,b)=>b.points-a.points || b.wins-a.wins || a.previousPosition-b.previousPosition)
    .map((entry,index)=>({...entry,position:index+1}))
}

export function projectConstructors(base: StandingEntry[], projectedDrivers: ChampionshipProjection[]): ChampionshipProjection[] {
  return base.map((entry,index)=>{
    const gains=projectedDrivers.filter(d=>d.team===entry.name).reduce((sum,d)=>sum+d.projectedGain,0)
    return {...entry,position:0,previousPosition:index+1,projectedGain:gains,points:entry.points+gains}
  }).sort((a,b)=>b.points-a.points || b.wins-a.wins || a.previousPosition-b.previousPosition)
    .map((entry,index)=>({...entry,position:index+1}))
}
