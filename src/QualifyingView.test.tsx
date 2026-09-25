import {afterEach,expect,it} from 'vitest'
import {cleanup,render} from '@testing-library/react'
import {QualifyingView} from './App'
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
