type Language = "ru" | "en"

const translations = {
  ru: {
    total: (count: number) => `Всего задач: ${count}`,
    statuses: ["Открыто", "В работе", "Блокировано", "Закрыто"],
    epicsReady: (count: number) => `Эпики готовые к закрытию: ${count}`,
  },
  en: {
    total: (count: number) => `Total tasks: ${count}`,
    statuses: ["Open", "In progress", "Blocked", "Closed"],
    epicsReady: (count: number) => `Epics ready to close: ${count}`,
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
