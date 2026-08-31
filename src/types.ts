export type View = 'qualifying' | 'race' | 'championship'
export type FeedMode = 'LIVE' | 'REPLAY' | 'OFFLINE' | 'CONNECTING'
export type SessionPhase = 'Q1' | 'Q2' | 'Q3' | 'RACE' | 'FINISHED'
export type CompetitionState = 'IDLE' | 'QUALIFYING' | 'RACE'
export type SessionStatus = 'INACTIVE' | 'STARTED' | 'FINISHED' | 'ABORTED'

export interface SectorTime { value: string; status: 'normal' | 'personal' | 'overall' }
export interface TyreStint { compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'; laps: number }
export interface DriverTiming {
  position: number; previousPosition: number; gridPosition: number; number: string
  code: string; fullName: string; team: string; teamColor: string; bestLap: string
  lastLap: string; gap: string; interval: string; sectors: SectorTime[]; tyre: TyreStint
  pitStops: number; status: 'RUNNING' | 'PIT' | 'OUT' | 'FINISHED'; points?: number
  qualifyingPosition?: number; gridChange?: number; penaltyReason?: string
}
export interface SessionState {
  meetingName: string; circuit: string; sessionName: string; phase: SessionPhase
  timeRemaining: string; lap: number; totalLaps: number; flag: 'GREEN' | 'YELLOW' | 'RED' | 'SC' | 'VSC' | 'CHEQUERED'
  updatedAt: string; drivers: DriverTiming[]; status: SessionStatus; path?: string
}
export interface RaceWeekend {
  season: number; round: number; meetingName: string; circuit: string; locality: string; country: string
  qualifyingStart: string; raceStart: string; timeZone: string
}
export interface WeekendState {
  competition: CompetitionState; event?: RaceWeekend; nextEvent?: RaceWeekend
  liveSession?: SessionState; qualifyingArchive?: SessionState; confirmedGrid: Record<string, number>
  scheduleStatus: 'LOADING' | 'READY' | 'ERROR'
}
export interface RaceControlEvent { id: string; time: string; category: string; message: string }
export interface ConnectionState { mode: FeedMode; attempt: number; message: string; lastUpdate?: string }
export interface StandingEntry { id: string; name: string; code: string; team: string; points: number; wins: number; color: string }
export interface ChampionshipProjection extends StandingEntry { position: number; previousPosition: number; projectedGain: number }
export interface LiveTimingSource { connect(onState: (state: SessionState) => void, onConnection: (state: ConnectionState) => void): Promise<() => void> }
export interface StandingsSource { getDriverStandings(season?: number): Promise<StandingEntry[]>; getConstructorStandings(season?: number): Promise<StandingEntry[]> }
export interface ScheduleSource { getSeasonSchedule(season?: number): Promise<RaceWeekend[]> }
export interface ArchiveSource { loadQualifying(event: RaceWeekend): Promise<SessionState | undefined>; loadGrid(event: RaceWeekend): Promise<Record<string, number>> }
