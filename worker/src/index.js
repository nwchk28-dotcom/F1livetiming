const ALLOWED_ORIGINS=new Set(['https://nwchk28-dotcom.github.io','http://localhost:5173','http://127.0.0.1:5173'])
const NEGOTIATE='https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1'
const UPSTREAM='https://livetiming.formula1.com/signalrcore'
const RS='\x1e'
const TOPICS=['Heartbeat','ExtrapolatedClock','TimingStats','TimingAppData','TrackStatus','DriverList','RaceControlMessages','SessionInfo','SessionData','LapCount','TimingData']

export default {
  async fetch(request){
    const url=new URL(request.url)
    if(url.pathname==='/health')return Response.json({ok:true,service:'pitwall-live-proxy'})
    if(url.pathname!=='/live'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426})
    const origin=request.headers.get('Origin')??''
    if(!ALLOWED_ORIGINS.has(origin))return new Response('Origin not allowed',{status:403})
    try{return await connect()}
    catch(error){console.error(JSON.stringify({event:'upstream_connect_failed',message:error instanceof Error?error.message:String(error)}));return new Response('Live timing upstream unavailable',{status:502})}
  }
}

async function connect(){
  const baseHeaders={'User-Agent':'BestHTTP','Accept-Encoding':'gzip, identity'}
  const warmup=await fetch(NEGOTIATE,{method:'OPTIONS',headers:baseHeaders})
  const warmupCookie=cookieFrom(warmup.headers.get('Set-Cookie'))
  const negotiation=await fetch(NEGOTIATE,{method:'POST',headers:{...baseHeaders,...(warmupCookie?{Cookie:warmupCookie}:{})}})
  if(!negotiation.ok)throw new Error(`negotiate ${negotiation.status}`)
  const {connectionToken}=await negotiation.json()
  if(typeof connectionToken!=='string'||!connectionToken)throw new Error('missing connection token')
  const sessionCookie=cookieFrom(negotiation.headers.get('Set-Cookie'))||warmupCookie
  const upstreamResponse=await fetch(`${UPSTREAM}?id=${encodeURIComponent(connectionToken)}`,{headers:{Upgrade:'websocket',...baseHeaders,...(sessionCookie?{Cookie:sessionCookie}:{})}})
  const upstream=upstreamResponse.webSocket
  if(!upstream)throw new Error(`websocket ${upstreamResponse.status}`)
  upstream.accept()
  upstream.send(JSON.stringify({protocol:'json',version:1})+RS)

  const pair=new WebSocketPair()
  const [client,downstream]=Object.values(pair)
  downstream.accept()
  let subscribed=false
  upstream.addEventListener('message',event=>{
    const data=event.data
    if(!subscribed&&typeof data==='string'&&data.includes('{}'+RS)){
      subscribed=true
      upstream.send(JSON.stringify({type:1,invocationId:'0',target:'Subscribe',arguments:[TOPICS]})+RS)
    }
    if(subscribed&&downstream.readyState===WebSocket.OPEN)downstream.send(data)
  })
  upstream.addEventListener('close',event=>{if(downstream.readyState===WebSocket.OPEN)downstream.close(event.code||1011,event.reason||'F1 feed closed')})
  upstream.addEventListener('error',()=>{if(downstream.readyState===WebSocket.OPEN)downstream.close(1011,'F1 feed error')})
  downstream.addEventListener('close',()=>{if(upstream.readyState===WebSocket.OPEN)upstream.close(1000,'Client closed')})
  return new Response(null,{status:101,webSocket:client})
}

function cookieFrom(value){
  if(!value)return''
  const match=value.match(/AWSALBCORS=([^;]+)/)
  return match?`AWSALBCORS=${match[1]}`:''
}
