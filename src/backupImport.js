export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function validateBackupFile(file) {
  if (!/\.json$/i.test(file.name) || (file.type && !["application/json", "text/json", "text/plain", "application/octet-stream"].includes(file.type))) {
    throw new Error("Выберите резервную копию в формате JSON");
  }
  if (!file.size || file.size > MAX_BACKUP_BYTES) throw new Error("Размер резервной копии должен быть от 1 байта до 20 МБ");
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.players) || !Array.isArray(data.matches)) {
    throw new Error("Файл не содержит резервную копию приложения");
  }
  return data;
}
