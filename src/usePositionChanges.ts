import {useEffect,useRef,useState} from 'react'
import type {SessionState} from './types'
import {PositionTracker} from './data/positionChanges'
import type {PositionChange} from './data/positionChanges'

export type RecentPositionChange=PositionChange & {at:number}
export function activePositionChanges(changes:Record<string,RecentPositionChange>,now:number,running:boolean){
  return running?Object.fromEntries(Object.entries(changes).filter(([,c])=>now-c.at<10000)):{}
}
export function usePositionChanges(session:SessionState,epoch:number){
  const tracker=useRef(new PositionTracker()),latest=useRef(session)
  const [recent,setRecent]=useState<Record<string,RecentPositionChange>>({})
  latest.current=session
  useEffect(()=>{tracker.current.reset();setRecent({})},[epoch,session.meetingName,session.path])
  useEffect(()=>{
    if(session.phase!=='RACE'||session.status!=='STARTED'){tracker.current.reset();setRecent({});return}
    const timer=window.setTimeout(()=>{
      const event=tracker.current.compare(latest.current)
      if(event)setRecent(previous=>({...activePositionChanges(previous,event.at,true),...Object.fromEntries(event.changes.map(c=>[c.number,{...c,at:event.at}]))}))
    },300)
    return()=>window.clearTimeout(timer)
  },[session.drivers.map(d=>`${d.number}:${d.position}`).sort().join('|'),session.phase,session.status,epoch])
  return recent
}
