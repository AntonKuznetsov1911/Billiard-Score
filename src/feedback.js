import { supabase } from "./supabaseClient.js";

export const FEEDBACK_KINDS = {
  bug: "🐞 Ошибка",
  idea: "💡 Предложение",
  other: "💬 Другое",
};

const REPO_ISSUES = "https://github.com/AntonKuznetsov1911/Billiard-Score/issues/new";

export function cleanFeedback({ kind, message, contact }) {
  return {
    kind: FEEDBACK_KINDS[kind] ? kind : "other",
    message: String(message || "").trim().slice(0, 2000),
    contact: String(contact || "").trim().slice(0, 100) || null,
  };
}

// Sent to the `feedback` table (supabase/feedback.sql): anyone can add a
// message, nobody can read them back through the API.
export async function sendFeedback(input) {
  const fb = cleanFeedback(input);
  if (fb.message.length < 3) throw new Error("Напишите хотя бы пару слов");
  if (!supabase) throw new Error("offline");
  const { error } = await supabase.from("feedback").insert({
    ...fb,
    app_version: (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "").slice(0, 40) || null,
    user_agent: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 300) || null,
  });
  if (error) {
    if (/feedback_rate_limited/.test(error.message || "")) throw new Error("Слишком много сообщений подряд — попробуйте через несколько минут");
    throw new Error("offline");
  }
}

// Fallback when the server can't be reached: a prefilled GitHub issue.
export function feedbackIssueUrl(input) {
  const fb = cleanFeedback(input);
  const title = `${FEEDBACK_KINDS[fb.kind]}: ${fb.message.split("\n")[0].slice(0, 60)}`;
  const body = `${fb.message}\n\n---\nКонтакт: ${fb.contact || "—"}`;
  return `${REPO_ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
