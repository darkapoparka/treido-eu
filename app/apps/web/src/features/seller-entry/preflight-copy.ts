export const preflightCopy = {
  en: {
    title: "Check your catalogue file",
    intro:
      "Check a CSV before signing in. Its contents stay on this device and are not uploaded or saved.",
    choose: "Choose a UTF-8 CSV",
    limits:
      "Up to 10 MiB and 1,000 rows. Your actual import and draft limits are checked in your business workspace.",
    checking: "Checking your file…",
    clear: "Clear file",
    report: "Download issue report",
    next: "Next rows",
    previous: "Previous rows",
    row: "Row",
    titleColumn: "Item",
    issues: "What to fix",
    valid: "Ready for account checks",
    missing: "Untitled item",
    continue: "Open my selling workspace",
    note: "This check does not create listings. Existing imported IDs, permissions, plan limits and current category publication rules are checked again after sign-in. Photos must be added to the created drafts; imports never publish automatically.",
    summary: (total: number, valid: number) =>
      valid + " of " + total + " rows pass file validation.",
    page: (from: number, to: number, total: number) =>
      "Rows " + from + "–" + to + " of " + total,
    errors: {
      empty_file: "Add at least one item below the template header.",
      too_many_rows: "Split the file into batches of at most 1,000 rows.",
      invalid_csv:
        "Check quoted cells and ensure every row has the same number of columns.",
      invalid_columns:
        "Use the downloaded template headers, without repeated or unknown columns.",
      cell_too_long: "A cell is too long. Shorten its contents and try again.",
      invalid_encoding: "Save the file as UTF-8 CSV and try again.",
      file_too_large: "Choose a file no larger than 10 MiB.",
      unavailable: "This file could not be read. Choose it again.",
    },
    codes: {
      required: "Required",
      invalid: "Check the value",
      duplicate_external_id: "This ID appears more than once",
      already_imported: "Already imported",
      quota_exceeded: "Account limit reached",
      unavailable: "Not available",
    },
  },
  bg: {
    title: "Провери файла с каталога",
    intro:
      "Провери CSV файл преди вход. Съдържанието остава на това устройство и не се качва или запазва.",
    choose: "Избери CSV файл с UTF-8",
    limits:
      "До 10 MiB и 1 000 реда. Реалните лимити за импорт и чернови се проверяват в работното място на бизнеса.",
    checking: "Проверка на файла…",
    clear: "Изчисти файла",
    report: "Изтегли отчет за грешките",
    next: "Следващи редове",
    previous: "Предишни редове",
    row: "Ред",
    titleColumn: "Артикул",
    issues: "Какво да поправиш",
    valid: "Готов за проверките на акаунта",
    missing: "Артикул без заглавие",
    continue: "Отвори моите продажби",
    note: "Тази проверка не създава обяви. Вече импортирани идентификатори, права, лимити на плана и актуални правила за публикуване се проверяват отново след вход. Добави снимки към създадените чернови; импортът никога не публикува автоматично.",
    summary: (total: number, valid: number) =>
      valid + " от " + total + " реда преминават проверката на файла.",
    page: (from: number, to: number, total: number) =>
      "Редове " + from + "–" + to + " от " + total,
    errors: {
      empty_file: "Добави поне един артикул под заглавния ред на шаблона.",
      too_many_rows: "Раздели файла на части с най-много 1 000 реда.",
      invalid_csv:
        "Провери кавичките и дали всеки ред има еднакъв брой колони.",
      invalid_columns:
        "Използвай колоните от шаблона без повторени или непознати имена.",
      cell_too_long:
        "Една от клетките е твърде дълга. Съкрати я и опитай отново.",
      invalid_encoding:
        "Запази файла като CSV с кодиране UTF-8 и опитай отново.",
      file_too_large: "Избери файл с размер до 10 MiB.",
      unavailable: "Файлът не може да бъде прочетен. Избери го отново.",
    },
    codes: {
      required: "Задължително",
      invalid: "Провери стойността",
      duplicate_external_id: "Този идентификатор се повтаря",
      already_imported: "Вече импортирано",
      quota_exceeded: "Достигнат лимит на акаунта",
      unavailable: "Недостъпно",
    },
  },
} as const;
