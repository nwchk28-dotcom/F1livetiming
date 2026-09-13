import type { SessionState } from '../types'

export interface PositionChange { number:string; name:string; code:string; from:number; to:number }
export interface PositionChangeEvent { id:number; at:number; lap:number; changes:PositionChange[] }
export class PositionTracker {
  private baseline?:Map<string,number>
  private sequence=0
  reset(){this.baseline=undefined}
  compare(session:SessionState,at=Date.now()):PositionChangeEvent|undefined {
    if(session.phase!=='RACE'||session.status!=='STARTED'){this.reset();return}
    const drivers=session.drivers.filter(d=>Number.isInteger(d.position)&&d.position>0&&d.position<99)
    const positions=new Map(drivers.map(d=>[d.number,d.position]))
    if(!drivers.length||positions.size!==drivers.length||new Set(positions.values()).size!==drivers.length)return
    const previous=this.baseline
    this.baseline=positions
    if(!previous||previous.size!==positions.size||[...positions.keys()].some(n=>!previous.has(n)))return
    const changes=drivers.filter(d=>previous.get(d.number)!==d.position).map(d=>({number:d.number,name:d.fullName,code:d.code,from:previous.get(d.number)!,to:d.position}))
    return changes.length?{id:++this.sequence,at,lap:session.lap,changes}:undefined
  }
}
