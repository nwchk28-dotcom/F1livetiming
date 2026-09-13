import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {SessionState} from './types'
import {PositionTracker} from './data/positionChanges'
import type {PositionChangeEvent} from './data/positionChanges'

export function usePositionChanges(session:SessionState,epoch:number){
  const tracker=useRef(new PositionTracker()),latest=useRef(session)
  const [history,setHistory]=useState<PositionChangeEvent[]>([])
  const [settled,setSettled]=useState(session)
  latest.current=session
  useEffect(()=>{tracker.current.reset();setHistory([]);setSettled(latest.current)},[epoch,session.meetingName,session.path])
  useEffect(()=>{
    if(session.phase!=='RACE'||session.status!=='STARTED'){tracker.current.reset();setSettled(session);return}
    const timer=window.setTimeout(()=>{
      const s=latest.current
      const valid=s.drivers.filter(d=>d.position>0&&d.position<99)
      if(!valid.length||new Set(valid.map(d=>d.position)).size!==valid.length)return
      const event=tracker.current.compare(s)
      setSettled(s)
      if(event)setHistory(h=>[event,...h].slice(0,5))
    },300)
    return()=>window.clearTimeout(timer)
  },[session.drivers.map(d=>`${d.number}:${d.position}`).sort().join('|'),session.phase,session.status,epoch])
  // Keep timing fields current while retaining the last coherent ordering.
  const drivers=settled.drivers.map(d=>({...session.drivers.find(n=>n.number===d.number)??d,position:d.position}))
  return {history,session:{...session,drivers:session.phase==='RACE'&&session.status==='STARTED'?drivers:session.drivers}}
}

export function useMovingRows(){
  const body=useRef<HTMLTableSectionElement>(null)
  const previous=useRef(new Map<string,number>())
  const animations=useRef(new Map<string,Animation>())
  useLayoutEffect(()=>{
    if(!body.current)return
    const rows=[...body.current.rows],next=new Map<string,number>()
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    for(const row of rows){
      const id=row.dataset.driver!,top=row.getBoundingClientRect().top
      const animation=animations.current.get(id)
      const old=animation?top:previous.current.get(id)
      animation?.cancel()
      const target=row.getBoundingClientRect().top
      next.set(id,target)
      if(!reduced&&old!==undefined&&Math.abs(old-target)>1&&row.animate){
        const moving=row.animate([{transform:`translateY(${old-target}px)`},{transform:'translateY(0)'}],{duration:500,easing:'ease-out'})
        animations.current.set(id,moving)
        moving.onfinish=()=>{if(animations.current.get(id)===moving)animations.current.delete(id)}
      }else animations.current.delete(id)
    }
    previous.current=next
  })
  useEffect(()=>()=>{for(const a of animations.current.values())a.cancel()},[])
  return body
}
