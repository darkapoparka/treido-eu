import type { Dataset, InsightBasis } from "./model";
export type InsightLanguage = "bg" | "en";
const enLabels = {
  all: "All",
  unknown: "Unknown",
  published: "Published",
  withdrawn: "Withdrawn",
  draft: "Draft",
  clear: "Clear",
  restricted: "Restricted",
  removed: "Removed",
  available: "Available",
  reserved: "Held",
  out_of_stock: "Out of stock",
  unique: "Unique item",
  stocked: "Stocked",
  buyer: "Buyer proposal",
  seller: "Seller proposal",
  created: "Created",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
  hold_expired: "Hold expired",
  open: "Open",
  closed: "Closed",
  new: "New",
  in_progress: "In progress",
  waiting_buyer: "Waiting for buyer",
  resolved: "Resolved",
  status: "Status change",
  reply: "Reply",
  uploading: "Uploading",
  review: "Under review",
  queued: "Queued",
  processing: "Processing",
  paused: "Paused",
  completed: "Completed",
  with_failed_rows: "Has failed rows",
  with_invalid_rows: "Invalid rows; no failed rows",
  without_row_errors: "No recorded row errors",
  listing: "Listing",
  message: "Message",
  message_report: "Message report",
  appeal: "Appeal",
  unsafe: "Unsafe",
  counterfeit: "Counterfeit",
  misleading: "Misleading",
  abuse: "Abuse",
  other: "Other",
  no_violation: "No violation",
  violation_recorded: "Violation recorded",
  message_hidden: "Message hidden",
  upheld: "Upheld",
  revised: "Revised",
  dismissed: "Dismissed",
  lt1: "Under 1 day",
  d1_7: "1 to under 7 days",
  d7_30: "7 to under 30 days",
  d30_90: "30 to under 90 days",
  gte90: "90 days or more",
  onHand: "Physical units",
  held: "Held units",
  totalRows: "Declared import rows",
  createdRows: "Drafts created",
  failedRows: "Failed rows",
  invalidRows: "Invalid rows",
  readyRows: "Ready rows",
};
const bgLabels: Record<keyof typeof enLabels, string> = {
  all: "Всички",
  unknown: "Неизвестно",
  published: "Публикувани",
  withdrawn: "Оттеглени",
  draft: "Чернова",
  clear: "Без ограничение",
  restricted: "Ограничени",
  removed: "Премахнати",
  available: "Налични",
  reserved: "Задържани",
  out_of_stock: "Изчерпани",
  unique: "Единичен артикул",
  stocked: "Складови наличности",
  buyer: "Предложение от купувач",
  seller: "Предложение от продавач",
  created: "Създадени",
  countered: "Насрещни предложения",
  accepted: "Приети",
  rejected: "Отхвърлени",
  cancelled: "Отказани",
  expired: "Изтекли",
  hold_expired: "Изтекло задържане",
  open: "Отворени",
  closed: "Затворени",
  new: "Нови",
  in_progress: "В обработка",
  waiting_buyer: "Изчакват купувача",
  resolved: "Приключени",
  status: "Промяна на статус",
  reply: "Отговор",
  uploading: "Качване",
  review: "За преглед",
  queued: "На опашка",
  processing: "Обработка",
  paused: "Спрени",
  completed: "Завършени",
  with_failed_rows: "Има неуспешни редове",
  with_invalid_rows: "Невалидни, без неуспешни редове",
  without_row_errors: "Без записани грешки по редове",
  listing: "Обява",
  message: "Съобщение",
  message_report: "Сигнал за съобщение",
  appeal: "Обжалване",
  unsafe: "Опасно",
  counterfeit: "Фалшификат",
  misleading: "Подвеждащо",
  abuse: "Злоупотреба",
  other: "Друго",
  no_violation: "Без нарушение",
  violation_recorded: "Записано нарушение",
  message_hidden: "Скрито съобщение",
  upheld: "Потвърдено",
  revised: "Преразгледано",
  dismissed: "Оставено без уважение",
  lt1: "Под 1 ден",
  d1_7: "От 1 до под 7 дни",
  d7_30: "От 7 до под 30 дни",
  d30_90: "От 30 до под 90 дни",
  gte90: "90 или повече дни",
  onHand: "Физически бройки",
  held: "Задържани бройки",
  totalRows: "Заявени редове за импорт",
  createdRows: "Създадени чернови",
  failedRows: "Неуспешни редове",
  invalidRows: "Невалидни редове",
  readyRows: "Готови редове",
};
const enTitles: Record<Dataset, string> = {
  publications: "Publication activity",
  listing_status: "Current listings",
  stock: "Current inventory",
  offers: "Offer activity",
  conversations: "New conversations",
  inquiries: "Sent inquiries",
  inquiry_activity: "Inquiry workflow",
  imports: "Import results",
  report_backlog: "Report backlog",
  reports: "Submitted reports",
  appeal_backlog: "Appeal backlog",
  appeals: "Submitted appeals",
  case_outcomes: "Formal case outcomes",
  listing_decisions: "Listing decisions",
};
const bgTitles: Record<Dataset, string> = {
  publications: "Публикуване и оттегляне",
  listing_status: "Текущи обяви",
  stock: "Текущи наличности",
  offers: "Действия по оферти",
  conversations: "Нови разговори",
  inquiries: "Изпратени запитвания",
  inquiry_activity: "Обработка на запитвания",
  imports: "Резултати от импорт",
  report_backlog: "Чакащи сигнали",
  reports: "Подадени сигнали",
  appeal_backlog: "Чакащи обжалвания",
  appeals: "Подадени обжалвания",
  case_outcomes: "Официални решения",
  listing_decisions: "Решения за обяви",
};
const enDefinitions: Record<Dataset, string> = {
  publications:
    "Accepted publication versions and first withdrawal transitions recorded in the selected UTC days. Repeated withdrawal receipts are not additional withdrawals. Republication is another publication version, not another item or sale. History opens the current listing review.",
  listing_status:
    "Current listings by publication and moderation state, regardless of the date range. Published does not mean publicly eligible: media, policy and seller eligibility are checked separately. This is not a historical reconstruction.",
  stock:
    "Current quantities across this seller's catalogue, regardless of the date range. Each row is an active SKU, or a listing with unknown availability when it has no active SKU. Unconfigured listings remain unknown, not zero. Available units equal physical units minus active protected holds, floored at zero. The existing inventory boundary also protects uncertain provider effects after a hold deadline. These are stock facts, not paid sales; availability here does not establish publication eligibility.",
  offers:
    "Immutable offer events recorded in the selected UTC days, including recorded expiry and hold-expiry events. The group identifies the side that proposed this offer, not the event actor. One offer can contribute several events. Acceptance and stock holds are not payment or completed sales; unprocessed expiry is not invented as an event.",
  conversations:
    "Conversations created in the selected UTC days, grouped by their current recorded state. This is a creation cohort, not messages sent, unique customers, conversion, or evidence of a reply.",
  inquiries:
    "Actually sent contact inquiries in the selected UTC days, grouped by current workflow state. Sends are checked against the original generated message hash; unsent purchase reviews and private buyer notes are excluded. Search matches a sent line title or inquiry reference. A resolved inquiry is not a sale.",
  inquiry_activity:
    "Durable inquiry reply/status receipts recorded in the selected UTC days. State is the recorded resulting workflow status. Retries do not create additional receipts for the same command. This is workflow activity, not response-time or service-quality measurement.",
  imports:
    "Imports created in the selected UTC days, with their current job state and row results. There is no immutable completion/failure timestamp, so these are cohort results, not completions during the interval. Failed rows take precedence over invalid-only grouping. No row errors does not imply that processing is complete; imports create drafts, not publications or sales.",
  report_backlog:
    "Current report state across all submission dates; the date range is not applied. Age buckets cover currently open reports only, measured from submission to the database observation time. Resolved means the stored report was reviewed, not necessarily that a formal decision exists. These are backlog facts, not response times or an SLA.",
  reports:
    "Reports submitted in the selected UTC days, grouped by current stored open/reviewed state and resource kind. Resolved means reviewed; it does not imply a formal disposition, successful appeal or a particular reviewer. Reason breakdowns use the submitted category, not evidence text.",
  appeal_backlog:
    "Appeals without a formal recorded decision are open; a later listing change does not resolve an appeal. The date range is not applied. Open-age buckets use submission time and end at 90 days or more; no reviewer or service-performance claim is made. Requires installed formal decision storage.",
  appeals:
    "Appeals submitted in the selected UTC days, grouped by current formal resolution. The group is the originally appealed listing state. If formal storage is unavailable, resolution remains unknown rather than zero or presumed resolved.",
  case_outcomes:
    "Immutable message-report and appeal decisions recorded in the selected UTC days, by formal outcome and case kind. Ordinary listing moderation actions are separate. No reviewer identity, internal reason, reporter evidence or other private case text is included.",
  listing_decisions:
    "Immutable listing moderation changes recorded in the selected UTC days. State is the resulting listing state; group is its prior state. This does not count formal appeal outcomes. The linked history retains the original decision trail.",
};
const bgDefinitions: Record<Dataset, string> = {
  publications:
    "Приети версии на публикации и първи оттегляния, записани през избраните дни по UTC. Повторните разписки не са нови оттегляния. Повторното публикуване е нова версия, не нов артикул или продажба. Историята отваря текущия преглед на обявата.",
  listing_status:
    "Текущи обяви по публикация и модерация, независимо от периода. Публикувана обява не означава непременно публично достъпна: медията, правилата и допустимостта на продавача се проверяват отделно. Това не е възстановка на минало състояние.",
  stock:
    "Текущи количества за този продавач, независимо от периода. Всеки ред е активна складова позиция или обява с неизвестна наличност, когато няма активна позиция. Обявите без настроена наличност остават неизвестни, а не нулеви. Наличните бройки са физическите минус защитените задържания, не по-малко от нула. Съществуващата логика пази и неуточнени ефекти при доставчика след изтичане на срока. Това са складови данни, не платени продажби; наличността не удостоверява публична допустимост.",
  offers:
    "Неизменяеми събития по оферти през избраните дни по UTC, включително записано изтичане на оферта или задържане. Групата е страната, предложила тази оферта, а не извършителят на събитието. Една оферта може да има няколко събития. Приемането и задържането не са плащане или завършена продажба; незаписано изтичане не се добавя като събитие.",
  conversations:
    "Разговори, създадени през избраните дни по UTC, по текущ записан статус. Това е група по дата на създаване, не изпратени съобщения, уникални клиенти, конверсия или доказателство за отговор.",
  inquiries:
    "Действително изпратени запитвания през избраните дни по UTC, по текущ статус на обработка. Изпращането се проверява спрямо хеша на оригиналното съобщение; неизпратени прегледи и лични бележки на купувача не се включват. Търсенето е по заглавие на изпратен артикул или номер на запитването. Приключено запитване не означава продажба.",
  inquiry_activity:
    "Трайни разписки за отговори и промени на статус през избраните дни по UTC. Показан е записаният краен статус. Повторението на същата команда не добавя нова разписка. Това е обработка на запитвания, не измерване на време за отговор или качество на обслужването.",
  imports:
    "Импорти, създадени през избраните дни по UTC, с текущия им статус и резултати по редове. Няма неизменяем момент на завършване или неуспех, затова това не са завършвания през периода. Неуспешните редове имат предимство пред групата само с невалидни редове. Липсата на грешки не доказва завършена обработка; импортът създава чернови, не публикации или продажби.",
  report_backlog:
    "Текущ статус на сигнали от всички дати; избраният период не се прилага. Възрастта е само за отворените сигнали, от подаването до момента на наблюдение в базата. Приключен означава записан преглед, не непременно официално решение. Това са данни за чакащи сигнали, не срокове за отговор или обещано обслужване.",
  reports:
    "Сигнали, подадени през избраните дни по UTC, по текущ статус и вид ресурс. Приключен означава прегледан; не предполага официално решение, уважено обжалване или конкретен проверяващ. Причините са подадените категории, не текстът на доказателствата.",
  appeal_backlog:
    "Обжалванията без официално записано решение са отворени; последваща промяна на обявата не ги приключва. Избраният период не се прилага. Възрастта е от подаването, с последна група 90 или повече дни; не се посочват проверяващи или показатели за обслужване. Изисква инсталирано хранилище за официални решения.",
  appeals:
    "Обжалвания, подадени през избраните дни по UTC, по текущо официално приключване. Групата е първоначално обжалваният статус на обявата. Без хранилище за официални решения резултатът остава неизвестен, а не нулев или предполагаемо приключен.",
  case_outcomes:
    "Неизменяеми официални решения по сигнали за съобщения и обжалвания през избраните дни по UTC, по резултат и вид случай. Обикновените действия по модерация на обяви са отделни. Не се включват проверяващи, вътрешни мотиви, доказателства на подателя или друг личен текст по случая.",
  listing_decisions:
    "Неизменяеми промени в модерацията на обяви през избраните дни по UTC. Статусът е крайният, а групата е предходният статус. Това не са официални резултати от обжалване. Връзката води към оригиналната история на решенията.",
};
const enUi = {
  pageEmpty:
    "This page no longer contains records. Open the first page to continue.",
  exportPending: "CSV downloads are not available on this instance yet.",
  title: "Insights",
  operatorTitle: "Operational insights",
  report: "Report",
  choose: "Open report",
  from: "From (UTC)",
  to: "Through (UTC)",
  apply: "Apply filters",
  reset: "Reset filters",
  search: "Title or reference",
  state: "State / outcome",
  group: "Group",
  reason: "Reason category",
  age: "Open backlog age",
  records: "Matching records",
  definition: "Measurement definition",
  observed: "Observed at (UTC)",
  basis: "Measurement basis",
  activity: "Recorded interval activity",
  cohort: "Created/sent in range; current result",
  snapshot: "Current snapshot; dates not applied",
  period: "Inclusive UTC days; up to 92 days. Snapshots ignore these dates.",
  noMoney:
    "Contact activity, reservations and holds are not revenue, GMV, paid orders or completed sales. Payment metrics are not included.",
  scope: "Current seller",
  operatorScope: "Existing operator access",
  availableOnly:
    "Reports shown are limited to your current capabilities. This screen grants no additional access.",
  exact:
    "Counts cover all matching records, not just this page. Scopes over 2,000 records are refused; refine filters. Each navigation reads current data again.",
  empty: "No records match these applied filters.",
  details: "Matching records and history",
  reference: "Reference",
  recordTime: "Event / cohort time (UTC)",
  snapshotTime: "Snapshot time (UTC)",
  history: "Open source",
  underlying: "Open underlying queue or history",
  newest: "First page",
  previous: "Previous",
  next: "Next",
  page: "Page",
  of: "of",
  statusBreakdown: "By state or outcome",
  groupBreakdown: "By group",
  reasonBreakdown: "By reason category",
  daily: "Recorded dates (UTC)",
  dailyNote:
    "Only days containing matching records are shown. This is not a view, sales or response-time chart.",
  count: "Records",
  stockUnknown:
    "Unknown rows are excluded from quantity totals; they are not treated as zero.",
  known: "Known rows",
  unknownRows: "Unknown rows",
  export: "Export applied filters (CSV)",
  exporting: "Preparing current export…",
  exportHint:
    "Exports recheck your current access and re-read all matching rows, up to 1,000 records and 2 MiB. The on-screen page is not the export limit.",
  exportSafe:
    "CSV contains a labelled measurement row and record rows. Free-form labels and applied filter values are prefixed with text:; control characters are flattened. This is a report, not an import template.",
  exported: "Download prepared from current authorized data.",
  failed:
    "Insights are temporarily unavailable. Retry without changing your filters.",
  denied:
    "Your current session or access no longer matches this view. Reload before exporting.",
  invalid:
    "The filters are invalid. Use real UTC dates, at most 92 days, and one supported value per filter.",
  limit:
    "This scope exceeds 2,000 matching candidates. No partial totals are shown. Narrow the dates, state, group or search.",
  exportLimit:
    "The current scope exceeds 1,000 export records or 2 MiB. Narrow the filters; no partial CSV was downloaded.",
  storage:
    "Formal decision reporting is unavailable until the reviewed trust migration and runtime grants are installed. Existing report and submission records remain separate; no zero outcomes are assumed.",
  retry: "Retry",
  loading: "Loading current authorized insights…",
  return: "Return to workspace",
  exportUnavailable: "Refresh this report before exporting.",
  measurement: "Measurement",
  record: "Record",
  rowType: "Row type",
  datasetCode: "Dataset code",
  version: "Definition version",
  scopeId: "Scope reference",
  until: "Until, exclusive (UTC)",
  filters: "Applied filters",
  label: "Record label",
  recordId: "Record identity",
  resourceId: "Resource identity",
  dataNotice:
    "No buyer notes, reporter evidence, message bodies or reviewer identities are exported.",
  backlogNote:
    "Age is time since submission for currently open cases, capped into a 90+ day bucket. It is not handling time, review duration, or an SLA.",
};
const bgUi: Record<keyof typeof enUi, string> = {
  pageEmpty:
    "На тази страница вече няма записи. Отворете първата страница, за да продължите.",
  exportPending: "Изтеглянето на CSV все още не е достъпно в тази инсталация.",
  title: "Анализи",
  operatorTitle: "Оперативни анализи",
  report: "Справка",
  choose: "Отвори справката",
  from: "От (UTC)",
  to: "До включително (UTC)",
  apply: "Приложи филтрите",
  reset: "Изчисти филтрите",
  search: "Заглавие или номер",
  state: "Статус / резултат",
  group: "Група",
  reason: "Категория на причината",
  age: "Възраст на отворените случаи",
  records: "Съвпадащи записи",
  definition: "Определение на измерването",
  observed: "Наблюдение към (UTC)",
  basis: "Основа на измерването",
  activity: "Записана дейност през периода",
  cohort: "Създадени/изпратени през периода; текущ резултат",
  snapshot: "Текущо състояние; датите не се прилагат",
  period:
    "Дни по UTC, включително крайната дата; до 92 дни. Текущото състояние не се ограничава по дати.",
  noMoney:
    "Контактите, резервациите и задържанията не са приходи, оборот, платени поръчки или завършени продажби. Показатели за плащания не се включват.",
  scope: "Текущ продавач",
  operatorScope: "Съществуващ операторски достъп",
  availableOnly:
    "Справките са ограничени до текущите ви права. Този екран не предоставя допълнителен достъп.",
  exact:
    "Броят обхваща всички съвпадащи записи, не само тази страница. Над 2000 записа справката се отказва; уточнете филтрите. Всяко отваряне чете данните отново.",
  empty: "Няма записи по приложените филтри.",
  details: "Съвпадащи записи и история",
  reference: "Номер",
  recordTime: "Момент на събитието / създаването (UTC)",
  snapshotTime: "Момент на наблюдението (UTC)",
  history: "Отвори източника",
  underlying: "Отвори съответната опашка или история",
  newest: "Първа страница",
  previous: "Предишна",
  next: "Следваща",
  page: "Страница",
  of: "от",
  statusBreakdown: "По статус или резултат",
  groupBreakdown: "По група",
  reasonBreakdown: "По категория на причината",
  daily: "Дати със записи (UTC)",
  dailyNote:
    "Показват се само дните със съвпадащи записи. Това не е графика за посещения, продажби или време за отговор.",
  count: "Записи",
  stockUnknown:
    "Редовете с неизвестни количества не участват в сборовете; те не се считат за нулеви.",
  known: "Редове с известни стойности",
  unknownRows: "Редове с неизвестни стойности",
  export: "Изтегли приложените филтри (CSV)",
  exporting: "Подготовка на актуална справка…",
  exportHint:
    "Изтеглянето проверява текущия достъп и прочита всички съвпадащи редове отново, до 1000 записа и 2 MiB. Екранната страница не ограничава изтеглянето.",
  exportSafe:
    "CSV съдържа обозначен ред за измерването и редове със записи. Свободният текст в описанията и приложените филтри получава представка text:, а контролните знаци се заменят. Това е справка, не шаблон за импорт.",
  exported: "Изтеглянето е подготвено от актуални разрешени данни.",
  failed:
    "Анализите временно не са достъпни. Опитайте отново със същите филтри.",
  denied:
    "Текущата сесия или достъп вече не съответства на този екран. Презаредете преди изтегляне.",
  invalid:
    "Филтрите са невалидни. Използвайте реални дати по UTC, до 92 дни, и по една поддържана стойност за всеки филтър.",
  limit:
    "Обхватът надвишава 2000 съвпадащи кандидата. Частични сборове не се показват. Ограничете датите, статуса, групата или търсенето.",
  exportLimit:
    "Обхватът надвишава 1000 записа или 2 MiB за изтегляне. Ограничете филтрите; частичен CSV не е изтеглен.",
  storage:
    "Справката за официални решения не е достъпна, докато прегледаната миграция и правата за изпълнение не са инсталирани. Сигналите и подаванията са отделни; не се предполага нулев брой решения.",
  retry: "Опитай отново",
  loading: "Зареждане на актуални разрешени анализи…",
  return: "Към работното пространство",
  exportUnavailable: "Обновете справката преди изтегляне.",
  measurement: "Измерване",
  record: "Запис",
  rowType: "Вид на реда",
  datasetCode: "Код на справката",
  version: "Версия на определението",
  scopeId: "Номер на обхвата",
  until: "До, без крайната граница (UTC)",
  filters: "Приложени филтри",
  label: "Описание на записа",
  recordId: "Идентификатор на записа",
  resourceId: "Идентификатор на ресурса",
  dataNotice:
    "Не се изтеглят бележки на купувачи, доказателства на податели, текстове на съобщения или самоличности на проверяващи.",
  backlogNote:
    "Възрастта е времето от подаване за текущо отворени случаи, с последна група 90+ дни. Това не е време за обработка, преглед или обещан срок.",
};
export function insightCopy(language: InsightLanguage) {
  return {
    ui: language === "bg" ? bgUi : enUi,
    titles: language === "bg" ? bgTitles : enTitles,
    definitions: language === "bg" ? bgDefinitions : enDefinitions,
  };
}
export function insightLabel(language: InsightLanguage, key: string) {
  const labels = language === "bg" ? bgLabels : enLabels;
  return Object.hasOwn(labels, key)
    ? labels[key as keyof typeof enLabels]
    : labels.unknown;
}
export function basisLabel(language: InsightLanguage, basis: InsightBasis) {
  return insightCopy(language).ui[basis];
}
