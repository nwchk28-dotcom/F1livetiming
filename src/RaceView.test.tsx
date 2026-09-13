import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,act} from '@testing-library/react'
import {RaceView} from './App'
import {emptySession,mergeFeed} from './data/sources'

afterEach(()=>{cleanup();vi.useRealTimers()})
it('shows static colour and arrows without history, reserving space after expiry',()=>{
  vi.useFakeTimers()
  const session={...mergeFeed(emptySession(),'TimingData',{Lines:{'1':{Position:'2'},'2':{Position:'1'}}}),phase:'RACE' as const,status:'STARTED' as const}
  const changes={'1':{number:'1',name:'One',code:'ONE',from:1,to:2,at:Date.now()},'2':{number:'2',name:'Two',code:'TWO',from:2,to:1,at:Date.now()}}
  const {container,rerender}=render(<RaceView session={session} changes={changes}/>)
  expect(container.querySelector('.position-history')).toBeNull()
  expect(container.querySelector('.position-up .recent-position')?.textContent).toBe('▲1')
  expect(container.querySelector('.position-down .recent-position')?.textContent).toBe('▼1')
  expect(container.querySelectorAll('.recent-position')).toHaveLength(2)
  act(()=>vi.advanceTimersByTime(10000))
  expect(container.querySelector('.position-up')).toBeNull()
  expect(container.querySelector('.position-down')).toBeNull()
  expect(container.querySelectorAll('.recent-position')).toHaveLength(2)
  rerender(<RaceView session={{...session,status:'FINISHED'}} changes={changes}/>)
  expect(container.querySelector('.position-up')).toBeNull()
})
