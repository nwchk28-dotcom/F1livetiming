import {mkdtemp,readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {stripTypeScriptTypes} from 'node:module'
const temporary=await mkdtemp(join(tmpdir(),'pitwall-archives-'))
const get=async url=>{
 const response=await fetch(url,{headers:{'User-Agent':'BestHTTP'},signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw new Error(`HTTP ${response.status}`)
 return (await response.text()).replace(/^\uFEFF/,'')
}
try{
 // Reuse the app's feed decoder so archived and live classifications agree.
 for(const name of await readdir('src/data'))if(name.endsWith('.ts')&&!name.endsWith('.test.ts')){
  const code=stripTypeScriptTypes(await readFile(`src/data/${name}`,'utf8'),{mode:'transform'}).replace(/(['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>`${quote}${path}.mjs${quote}`)
  await writeFile(join(temporary,name.replace(/\.ts$/,'.mjs')),code)
 }
 const {emptySession,mergeFeed}=await import(pathToFileURL(join(temporary,'sources.mjs')))
 const {hasQualifyingEnded}=await import(pathToFileURL(join(temporary,'lifecycle.mjs')))
 const {resultKind}=await import(pathToFileURL(join(temporary,'weekendResults.mjs')))
 const season=new Date().getUTCFullYear(),now=Date.now()
 const schedule=JSON.parse(await get(`https://api.jolpi.ca/ergast/f1/${season}.json`)).MRData.RaceTable.Races
 const index=JSON.parse(await get(`https://livetiming.formula1.com/static/${season}/Index.json`))
 const normal=value=>value.toLowerCase().replace(/grand prix|[^a-z0-9]/g,'')
 const topics=['SessionInfo','DriverList','SessionData','ExtrapolatedClock','TimingData','TimingAppData','LapCount','TrackStatus']
 for(const race of schedule){
  const start=Date.parse(`${race.date}T${race.time??'12:00:00Z'}`)
  if(now<start-4*86400000||now>start+5*3600000+48*3600000)continue
  const meeting=index.Meetings?.find(m=>normal(m.Name??'')===normal(race.raceName))
  for(const entry of meeting?.Sessions??[]){
   const kind=resultKind({...emptySession(),sessionName:entry.Name??''})
   if(!kind||!entry.Path)continue
   try{
    const info=JSON.parse(await get(`https://livetiming.formula1.com/static/${entry.Path}SessionInfo.json`))
    if(!/finalised|finalized|ends/i.test(info.SessionStatus??''))continue
    let state=mergeFeed(emptySession(),'SessionInfo',info)
    const responses=await Promise.allSettled(topics.map(async topic=>({topic,raw:await get(`https://livetiming.formula1.com/static/${entry.Path}${topic}.jsonStream`)})))
    for(const result of responses)if(result.status==='fulfilled')for(const line of result.value.raw.split('\n')){
      const offset=line.indexOf('{');if(offset<0)continue
      try{state=mergeFeed(state,result.value.topic,JSON.parse(line.slice(offset)))}catch{/* incomplete line */}
    }
    const qualifying=kind==='qualifying'||kind==='sprintQualifying'
    if(qualifying&&state.qualifyingFinalised)state={...state,qualifyingPartStarted:true}
    if(!state.drivers.length||(qualifying?!hasQualifyingEnded(state):state.status!=='FINISHED'))continue
    state={...state,status:'FINISHED',flag:'CHEQUERED',drivers:state.drivers.filter(d=>d.position<99).map(d=>({...d,status:d.status==='OUT'?'OUT':'FINISHED',timingImprovedAt:undefined}))}
    const directory=`public/archives/${season}/${race.round}`
    await mkdir(directory,{recursive:true})
    await writeFile(`${directory}/${kind}.json`,JSON.stringify(state))
    console.log(`Archived round ${race.round}: ${entry.Name} (${state.drivers.length} drivers)`)
   }catch(error){console.warn(`Archive unavailable for ${entry.Name}: ${error.message}`)}
  }
 }
}finally{await rm(temporary,{recursive:true,force:true})}
