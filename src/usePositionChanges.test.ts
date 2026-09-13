import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,renderHook} from '@testing-library/react'
import {emptySession,mergeFeed} from './data/sources'
import {activePositionChanges,usePositionChanges} from './usePositionChanges'

const race=(a=1,b=2)=>({...mergeFeed(emptySession(),'TimingData',{Lines:{'1':{Position:String(a)},'2':{Position:String(b)}}}),phase:'RACE' as const,status:'STARTED' as const})
afterEach(()=>{cleanup();vi.useRealTimers()})
describe('position tracking hook',()=>{
  it('batches updates, retains recent changes across unrelated renders and resets on reconnect',()=>{
    vi.useFakeTimers()
    const {result,rerender}=renderHook(({session,epoch})=>usePositionChanges(session,epoch),{initialProps:{session:race(),epoch:0}})
    act(()=>vi.advanceTimersByTime(300))
    expect(Object.values(result.current)).toHaveLength(0)
    rerender({session:race(1,1),epoch:0})
    act(()=>vi.advanceTimersByTime(300))
    expect(Object.values(result.current)).toHaveLength(0)
    rerender({session:race(2,1),epoch:0})
    act(()=>vi.advanceTimersByTime(299))
    expect(Object.values(result.current)).toHaveLength(0)
    act(()=>vi.advanceTimersByTime(1))
    expect(Object.values(result.current)).toHaveLength(2)
    rerender({session:race(2,1),epoch:0})
    act(()=>vi.advanceTimersByTime(1000))
    expect(Object.values(result.current)).toHaveLength(2)
    rerender({session:race(),epoch:1})
    act(()=>vi.advanceTimersByTime(300))
    expect(Object.values(result.current)).toHaveLength(0)
  })
  it('keeps only the latest change per driver',()=>{
    vi.useFakeTimers()
    const {result,rerender}=renderHook(({session})=>usePositionChanges(session,0),{initialProps:{session:race()}})
    act(()=>vi.advanceTimersByTime(300))
    for(let i=0;i<7;i++){rerender({session:i%2?race():race(2,1)});act(()=>vi.advanceTimersByTime(300))}
    expect(Object.values(result.current)).toHaveLength(2)
    expect(result.current['1'].from).toBe(1)
    expect(result.current['1'].to).toBe(2)
    expect(activePositionChanges(result.current,Date.now()+9999,true)['1']).toBeDefined()
    expect(activePositionChanges(result.current,Date.now()+10000,true)).toEqual({})
    expect(activePositionChanges(result.current,Date.now(),false)).toEqual({})
  })
})
