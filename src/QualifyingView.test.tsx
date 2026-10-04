import {afterEach,expect,it} from 'vitest'
import {cleanup,render} from '@testing-library/react'
import {QualifyingView} from './App'
import {attachGrid} from './data/lifecycle'
import {emptySession,mergeFeed} from './data/sources'

afterEach(cleanup)

it('does not show an update mark beside a missing best lap',()=>{
  const state=mergeFeed(emptySession(),'TimingData',{SessionPart:3,Lines:{'81':{Position:'3'}}})
  const driver={...state.drivers[0],timingImprovedAt:Date.now()}
  const {container,rerender}=render(<QualifyingView session={{...state,drivers:[driver]}}/>)
  expect(container.querySelector('.timing-improved')).toBeNull()
  rerender(<QualifyingView session={{...state,drivers:[{...driver,bestLap:'1:19.500'}]}}/>)
  expect(container.querySelectorAll('.timing-improved')).toHaveLength(1)
})

it('preserves qualifying P3 while updating the penalty-adjusted grid',()=>{
  const session=mergeFeed(emptySession(),'TimingData',{SessionPart:3,Lines:{'6':{Position:'3',BestLapTime:{Value:'1:29.000'}}}})
  const {container,rerender}=render(<QualifyingView session={attachGrid(session,{})} gridMode confirmedGrid={false}/>)
  expect(container.querySelectorAll('tbody .position')[1].textContent).toBe('3')
  rerender(<QualifyingView session={attachGrid(session,{'6':6})} gridMode/>)
  expect([...container.querySelectorAll('tbody .position')].map(cell=>cell.textContent)).toEqual(['3','6'])
  expect(container.querySelector('.grid-change')?.textContent).toContain('▼ 3')
})
