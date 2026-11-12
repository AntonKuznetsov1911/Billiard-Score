import { describe, it, expect } from 'vitest';
import { workspaceStorage, workspaceId, preserveLegacyClub, restoreLegacyClub, purgeUserWorkspaces, DATA_KEY } from './workspaceStorage.js';
function memory() {
  const data = {};
  return new Proxy({}, {
    get: (_, key) => ({ getItem: k => data[k] ?? null, setItem: (k,v) => { data[k]=String(v); }, removeItem: k => { delete data[k]; } })[key],
    ownKeys: () => Object.keys(data), getOwnPropertyDescriptor: () => ({enumerable:true,configurable:true}),
  });
}
describe('workspace isolation and migration', () => {
  it('keeps haptics as a device preference without mixing game data',()=>{
    const s=memory();workspaceStorage(s,workspaceId('a')).setItem('billiards-haptics','off');
    expect(s.getItem('billiards-haptics')).toBe('off');expect(workspaceStorage(s,workspaceId('b')).getItem('billiards-haptics')).toBe('off');
  });
  it('purges one account including its preferences while preserving guest and another account',()=>{
    const s=memory();s.setItem(DATA_KEY,'guest');workspaceStorage(s,workspaceId('a')).setItem(DATA_KEY,'A');workspaceStorage(s,workspaceId('b')).setItem(DATA_KEY,'B');
    s.setItem('billiards-club-terms',JSON.stringify({a:'accepted',b:'accepted'}));purgeUserWorkspaces(s,'a');
    expect(s.getItem(DATA_KEY)).toBe('guest');expect(workspaceStorage(s,workspaceId('a')).getItem(DATA_KEY)).toBeNull();expect(workspaceStorage(s,workspaceId('b')).getItem(DATA_KEY)).toBe('B');
    expect(JSON.parse(s.getItem('billiards-club-terms'))).toEqual({b:'accepted'});
  });
  it('isolates guest, two accounts and two clubs, including safety copies and current game', () => {
    const storage=memory();
    const scopes=['guest',workspaceId('a'),workspaceId('b'),workspaceId('a','c1'),workspaceId('a','c2')];
    scopes.forEach((id,i)=>{const s=workspaceStorage(storage,id); s.setItem(DATA_KEY,String(i));s.setItem('billiards-safety-copies',String(i));s.setItem('billiards-current-game',String(i));});
    scopes.forEach((id,i)=>{const s=workspaceStorage(storage,id);expect(s.getItem(DATA_KEY)).toBe(String(i));expect(s.getItem('billiards-safety-copies')).toBe(String(i));expect(Object.keys(s)).toHaveLength(3);});
    workspaceStorage(storage,workspaceId('a')).clear();
    expect(workspaceStorage(storage,workspaceId('a')).getItem(DATA_KEY)).toBeNull();
    expect(workspaceStorage(storage,workspaceId('b')).getItem(DATA_KEY)).toBe('2');
  });
  it('keeps genuine legacy guest data in place without assigning it to an account', () => {
    const storage=memory();storage.setItem(DATA_KEY,'guest data');preserveLegacyClub(storage);
    expect(storage.getItem(DATA_KEY)).toBe('guest data');
    expect(workspaceStorage(storage,workspaceId('a')).getItem(DATA_KEY)).toBeNull();
  });
  it('archives old club data before clearing the guest slot and restores only the verified club', () => {
    const storage=memory();storage.setItem(DATA_KEY,'offline club data');storage.setItem('billiards-club-synced','c1');
    preserveLegacyClub(storage);preserveLegacyClub(storage);
    expect(storage.getItem(DATA_KEY)).toBeNull();
    restoreLegacyClub(storage,'a','c2');
    expect(workspaceStorage(storage,workspaceId('a','c2')).getItem(DATA_KEY)).toBeNull();
    restoreLegacyClub(storage,'a','c1');
    const s=workspaceStorage(storage,workspaceId('a','c1'));
    expect(s.getItem(DATA_KEY)).toBe('offline club data');s.setItem(DATA_KEY,'newer');restoreLegacyClub(storage,'a','c1');expect(s.getItem(DATA_KEY)).toBe('newer');
  });
});
