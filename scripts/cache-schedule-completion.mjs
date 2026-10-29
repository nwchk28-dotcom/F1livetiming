import {mkdir,readFile,writeFile} from 'node:fs/promises'
const season=new Date().getUTCFullYear(),directory=`public/archives/${season}`
const get=async path=>{
 const response=await fetch(path,{headers:{'User-Agent':'BestHTTP'},signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw new Error(`HTTP ${response.status}`)
 return JSON.parse((await response.text()).replace(/^\uFEFF/,''))
}
const kind=name=>{
 const n=name.trim().toLowerCase(),practice=n.match(/^(?:free )?practice ([123])$/)
 return practice?`practice${practice[1]}`:({qualifying:'qualifying',race:'race','sprint qualifying':'sprintQualifying','sprint shootout':'sprintQualifying',sprint:'sprintRace','sprint race':'sprintRace'})[n]
}
try{
 const [schedule,sessions]=await Promise.all([get(`https://api.jolpi.ca/ergast/f1/${season}.json`),get(`https://api.openf1.org/v1/sessions?year=${season}`)])
 let completed={}
 try{completed=JSON.parse(await readFile(`${directory}/completion.json`,'utf8'))}catch{/* first snapshot */}
 for(const race of schedule.MRData.RaceTable.Races){
  const start=Date.parse(`${race.date}T${race.time??'12:00:00Z'}`)
  const main=sessions.find(s=>s.session_name==='Race'&&Math.abs(Date.parse(s.date_start)-start)<24*3600000)
  if(!main||start>Date.now()+4*86400000)continue
  const missing=sessions.filter(s=>s.meeting_key===main.meeting_key&&!s.is_cancelled&&kind(s.session_name)&&!completed[race.round]?.[kind(s.session_name)])
  if(!missing.length)continue
  try{
   const results=await get(`https://api.openf1.org/v1/session_result?meeting_key=${main.meeting_key}`)
   const keys=new Set(results.map(r=>r.session_key))
   for(const session of missing)if(keys.has(session.session_key))completed[race.round]={...completed[race.round],[kind(session.session_name)]:true}
  }catch(error){console.warn(`Status unavailable for round ${race.round}: ${error.message}`)}
  // Stay within OpenF1's free historical API request limits.
  await new Promise(resolve=>setTimeout(resolve,2100))
 }
 await mkdir(directory,{recursive:true})
 await writeFile(`${directory}/completion.json`,JSON.stringify(completed))
 console.log(`Saved confirmed session completion for ${Object.keys(completed).length} weekends`)
}catch(error){console.warn(`Schedule status refresh unavailable; keeping bundled status: ${error.message}`)}
