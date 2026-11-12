import { supabase } from './supabaseClient.js';

export async function fetchPersonalState(userId) {
  if (!supabase) throw Error('Облачное сохранение не настроено');
  const { data, error } = await supabase.from('personal_state').select('data, revision').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Server-generated revision prevents lost writes between two devices.
export async function pushPersonalState(userId, local, merge) {
  for (let i = 0; i < 6; i++) {
    const row = await fetchPersonalState(userId);
    const next = row ? merge(local, row.data) : local;
    if (row && JSON.stringify(next) === JSON.stringify(row.data)) return next;
    const { data, error } = await supabase.rpc('save_personal_state', {
      p_user_id: userId, p_expected_revision: row?.revision ?? 0, p_data: next,
    });
    if (error) throw error;
    if (data === true) return next;
    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
  }
  throw Error('Данные изменились на другом устройстве. Повторим синхронизацию.');
}
