type Language = "ru" | "en"

const ruEpicsReady = (count: number) => {
  const mod100 = count % 100
  const mod10 = count % 10
  const form = mod10 === 1 && mod100 !== 11
    ? "эпик"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "эпика"
      : "эпиков"
  return `${count} ${form} ${form === "эпик" ? "готов" : "готовы"} к закрытию`
}

const translations = {
  ru: {
    total: (count: number) => `Всего задач: ${count}`,
    statuses: ["Открыто", "В работе", "Блокировано", "Закрыто"],
    epicsReady: ruEpicsReady,
  },
  en: {
    total: (count: number) => `Total tasks: ${count}`,
    statuses: ["Open", "In progress", "Blocked", "Closed"],
    epicsReady: (count: number) => `${count} ${count === 1 ? "epic" : "epics"} ready to close`,
  },
}

export function resolveLanguage(locale: string): Language {
  return /^ru(?:[-_.@]|$)/i.test(locale) ? "ru" : "en"
}

export function systemLocale(env: { LC_ALL?: string; LC_MESSAGES?: string; LANG?: string } = process.env) {
  return env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
}

export function createI18n(locale = systemLocale()) {
  const language = resolveLanguage(locale)
  return { language, ...translations[language] }
}
