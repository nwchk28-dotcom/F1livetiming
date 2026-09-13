import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,renderHook} from '@testing-library/react'
import {emptySession,mergeFeed} from './data/sources'
import {usePositionChanges} from './usePositionChanges'

const race=(a=1,b=2)=>({...mergeFeed(emptySession(),'TimingData',{Lines:{'1':{Position:String(a)},'2':{Position:String(b)}}}),phase:'RACE' as const,status:'STARTED' as const})
afterEach(()=>{cleanup();vi.useRealTimers()})
describe('position tracking hook',()=>{
  it('batches updates, retains history across unrelated renders and resets on reconnect',()=>{
    vi.useFakeTimers()
    const {result,rerender}=renderHook(({session,epoch})=>usePositionChanges(session,epoch),{initialProps:{session:race(),epoch:0}})
    act(()=>vi.advanceTimersByTime(300))
    expect(result.current.history).toHaveLength(0)
    rerender({session:race(1,1),epoch:0})
    act(()=>vi.advanceTimersByTime(300))
    expect(result.current.history).toHaveLength(0)
    rerender({session:race(2,1),epoch:0})
    act(()=>vi.advanceTimersByTime(299))
    expect(result.current.history).toHaveLength(0)
    act(()=>vi.advanceTimersByTime(1))
    expect(result.current.history).toHaveLength(1)
    rerender({session:race(2,1),epoch:0})
    act(()=>vi.advanceTimersByTime(1000))
    expect(result.current.history).toHaveLength(1)
    rerender({session:race(),epoch:1})
    act(()=>vi.advanceTimersByTime(300))
    expect(result.current.history).toHaveLength(0)
  })
  it('limits history to five batches',()=>{
    vi.useFakeTimers()
    const {result,rerender}=renderHook(({session})=>usePositionChanges(session,0),{initialProps:{session:race()}})
    act(()=>vi.advanceTimersByTime(300))
    for(let i=0;i<7;i++){rerender({session:i%2?race():race(2,1)});act(()=>vi.advanceTimersByTime(300))}
    expect(result.current.history).toHaveLength(5)
  })
})
