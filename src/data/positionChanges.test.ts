import {describe,it,expect} from 'vitest'
import {emptySession,mergeFeed} from './sources'
import {PositionTracker} from './positionChanges'

function race(positions:number[]){return {...mergeFeed(emptySession(),'TimingData',{Lines:Object.fromEntries(positions.map((p,i)=>[String(i+1),{Position:String(p)}]))}),phase:'RACE' as const,status:'STARTED' as const,lap:12}}
describe('race position changes',()=>{
  it('ignores initial state and groups a swap',()=>{const tracker=new PositionTracker();expect(tracker.compare(race([1,2]))).toBeUndefined();expect(tracker.compare(race([2,1]),100)).toMatchObject({at:100,lap:12,changes:[{number:'2',from:2,to:1},{number:'1',from:1,to:2}]});expect(tracker.compare(race([2,1]))).toBeUndefined()})
  it('ignores incomplete duplicate updates until the table is coherent',()=>{const tracker=new PositionTracker();tracker.compare(race([1,2,3]));expect(tracker.compare(race([1,1,3]))).toBeUndefined();expect(tracker.compare(race([2,1,3]))?.changes).toHaveLength(2)})
  it('tracks multiple and repeated changes including pit and retired drivers',()=>{const tracker=new PositionTracker();tracker.compare(race([1,2,3]));const next=race([3,1,2]);next.drivers[0].status='PIT';next.drivers[1].status='OUT';expect(tracker.compare(next)?.changes).toHaveLength(3);expect(tracker.compare(race([1,2,3]))?.changes).toHaveLength(3)})
  it('resets on reconnect, membership changes, and finished sessions',()=>{const tracker=new PositionTracker();tracker.compare(race([1,2]));tracker.reset();expect(tracker.compare(race([2,1]))).toBeUndefined();expect(tracker.compare(race([2,1,3]))).toBeUndefined();expect(tracker.compare({...race([1,2,3]),status:'FINISHED'})).toBeUndefined();expect(tracker.compare(race([1,2,3]))).toBeUndefined()})
})
