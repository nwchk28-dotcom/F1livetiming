import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import {scheduleSessionStatus} from './data/scheduleStatus'
import type { RaceWeekend,SessionState,View,WeekendSession } from './types'
export function ScheduleView({schedule,currentEvent,session,onSelectSession}:{schedule:RaceWeekend[];currentEvent?:RaceWeekend;session:SessionState;onSelectSession:(view:View)=>void}) {
  const [selected,setSelected]=useState<string>(),[now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[])
  const key=(event:RaceWeekend)=>`${event.season}-${event.round}`
  const pickerRef=useRef<HTMLDivElement>(null)
  const selectedButtonRef=useRef<HTMLButtonElement>(null)
  // Choose the next race even while the previous GP is retained by the live view.
  const upcoming=[...schedule].sort((a,b)=>Date.parse(a.raceStart)-Date.parse(b.raceStart)).find(e=>Date.parse(e.raceStart)>=now)
  const ongoing=currentEvent&&session.status==='STARTED'&&session.sessionName.toLowerCase()==='race'&&now<Date.parse(currentEvent.raceStart)+5*3600000?currentEvent:undefined
  const event=schedule.find(e=>key(e)===selected)??ongoing??upcoming??currentEvent??schedule.at(-1)
  const selectedKey=event?key(event):undefined
  useLayoutEffect(()=>{
    const picker=pickerRef.current,button=selectedButtonRef.current
    if(!picker||!button)return
    const center=()=>{
      const container=picker.getBoundingClientRect(),target=button.getBoundingClientRect()
      const left=picker.scrollLeft+target.left-container.left+target.width/2-picker.clientWidth/2
      if(typeof picker.scrollTo==='function')picker.scrollTo({left:Math.max(0,left),behavior:'auto'})
      else picker.scrollLeft=Math.max(0,left)
    }
    center()
    if(typeof ResizeObserver==='undefined')return
    const observer=new ResizeObserver(center)
    observer.observe(picker)
    return()=>observer.disconnect()
  },[selectedKey])
  const rows:WeekendSession[]=event?.sessions??(event?[{name:'予選',start:event.qualifyingStart,kind:'qualifying'},{name:'決勝',start:event.raceStart,kind:'race'}]:[])
  const sameEvent=event&&session.meetingName.toLowerCase().replace(/grand prix|[^a-z0-9]/g,'')===event.meetingName.toLowerCase().replace(/grand prix|[^a-z0-9]/g,'')
  return <section className="page-view schedule-view"><div className="section-head"><div><small>RACE WEEKEND SCHEDULE · JST</small><h1>レースウィーク日程</h1></div><span>日本時間（Asia/Tokyo）</span></div><div ref={pickerRef} className="weekend-picker" aria-label="グランプリを選択">{schedule.map(e=><button ref={selectedKey===key(e)?selectedButtonRef:undefined} key={key(e)} aria-pressed={event&&key(event)===key(e)} onClick={()=>{setSelected(key(e));setNow(Date.now())}}><small>第{e.round}戦 {Date.parse(e.raceStart)>now?'開催予定':'開催済み'}</small><strong>{e.meetingName}</strong></button>)}</div>{event?<><h2>第{event.round}戦 {event.meetingName}</h2><p>{event.circuit} · {event.country}</p><div className="table-wrap"><table className="timing-table schedule-table"><thead><tr><th scope="col">日時（日本時間）</th><th scope="col">内容</th></tr></thead><tbody>{[...rows].sort((a,b)=>Date.parse(a.start??event.raceStart)-Date.parse(b.start??event.raceStart)).map(row=>{const status=scheduleSessionStatus(row,session,Boolean(sameEvent),now);return <tr key={row.kind+row.name}><td>{row.start?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(row.start)):'未発表'}</td><td><span className="driver-status">{status}</span> {row.kind==='practice'?<strong>{row.name}</strong>:<button className="schedule-session" onClick={()=>onSelectSession(row.kind as View)}>{row.name}</button>}</td></tr>})}</tbody></table></div></>:<p>日程を取得しています。</p>}</section>
}
