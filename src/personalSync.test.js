import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({read:vi.fn(),rpc:vi.fn(),eq:vi.fn()}));
vi.mock('./supabaseClient.js',()=>({supabase:{
  from:()=>({select:()=>({eq:(...args)=>{api.eq(...args);return {maybeSingle:api.read};}})}),rpc:api.rpc,
}}));
import { pushPersonalState } from './personalSync.js';
beforeEach(()=>{api.read.mockReset();api.rpc.mockReset();api.eq.mockReset();});
it('re-reads and merges another device after a revision conflict',async()=>{
  api.read.mockResolvedValueOnce({data:{data:['remote'],revision:1}}).mockResolvedValueOnce({data:{data:['remote','new-on-another-phone'],revision:2}});
  api.rpc.mockResolvedValueOnce({data:false}).mockResolvedValueOnce({data:true});
  const result=await pushPersonalState('owner',['local'],(a,b)=>[...new Set([...a,...b])]);
  expect(result).toEqual(['local','remote','new-on-another-phone']);
  expect(api.rpc.mock.calls[1][1]).toEqual({p_user_id:'owner',p_expected_revision:2,p_data:result});
  expect(api.eq).toHaveBeenCalledWith('user_id','owner');
});
it('does not create endless writes for an unchanged snapshot',async()=>{
  api.read.mockResolvedValue({data:{data:['same'],revision:5}});
  expect(await pushPersonalState('owner',['same'],a=>a)).toEqual(['same']);
  expect(api.rpc).not.toHaveBeenCalled();
});
it('propagates access and network errors instead of claiming a saved cloud copy',async()=>{
  api.read.mockResolvedValue({error:new Error('access denied')});
  await expect(pushPersonalState('owner',{},a=>a)).rejects.toThrow('access denied');
  expect(api.rpc).not.toHaveBeenCalled();
});
