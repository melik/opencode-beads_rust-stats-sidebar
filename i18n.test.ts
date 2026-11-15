import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createI18n, resolveLanguage, systemLocale } from "./i18n.ts"

describe("Beads sidebar localization", () => {
  test("selects Russian only for Russian locales", () => {
    for (const locale of ["ru", "ru-RU", "ru-KZ", "RU-ru", "ru_RU.UTF-8"]) {
      assert.equal(resolveLanguage(locale), "ru")
    }
    for (const locale of ["en", "en-US", "de-DE", "zh-CN", "", "russian"]) {
      assert.equal(resolveLanguage(locale), "en")
    }
  })

  test("uses POSIX locale precedence and falls back to Intl", () => {
    assert.equal(systemLocale({ LC_ALL: "de_DE.UTF-8", LC_MESSAGES: "ru_RU.UTF-8", LANG: "en_US.UTF-8" }), "de_DE.UTF-8")
    assert.equal(systemLocale({ LC_MESSAGES: "ru_RU.UTF-8", LANG: "en_US.UTF-8" }), "ru_RU.UTF-8")
    assert.equal(systemLocale({ LANG: "ru_RU.UTF-8" }), "ru_RU.UTF-8")
    assert.equal(systemLocale({}), Intl.DateTimeFormat().resolvedOptions().locale)
  })

  test("translates all interface labels", () => {
    const ru = createI18n("ru-RU")
    assert.equal(ru.total(12), "Всего задач: 12")
    assert.deepEqual(ru.statuses, ["Открыто", "В работе", "Блокировано", "Закрыто"])

    for (const locale of ["en-US", "de-DE"]) {
      const en = createI18n(locale)
      assert.equal(en.total(12), "Total tasks: 12")
      assert.deepEqual(en.statuses, ["Open", "In progress", "Blocked", "Closed"])
      assert.equal(en.epicsReady(1), "Epics ready to close: 1")
      assert.equal(en.epicsReady(2), "Epics ready to close: 2")
      assert.equal(en.epicsReady(5), "Epics ready to close: 5")
    }
  })

  test("formats the ready-to-close epics line for Russian", () => {
    const ru = createI18n("ru-RU")
    assert.equal(ru.epicsReady(1), "Эпики готовые к закрытию: 1")
    assert.equal(ru.epicsReady(2), "Эпики готовые к закрытию: 2")
    assert.equal(ru.epicsReady(5), "Эпики готовые к закрытию: 5")
    assert.equal(ru.epicsReady(11), "Эпики готовые к закрытию: 11")
  })
})
