const en = {
  titles: {
    text: "Describe what you need",
    photo: "Photo Match",
    voice: "Find by voice",
  },
  intro:
    "Review the suggested criteria before searching current listings. Your chosen filters stay in place.",
  guest: "Sign in to keep this input private.",
  signIn: "Sign in",
  unavailable:
    "This input is unavailable until processing and privacy settings are approved.",
  checkAgain: "Check again",
  compactUnavailable:
    "Suggestions are unavailable right now. You can still search by keyword or use filters.",
  consent: "Allow processing for this input",
  withdraw: "Withdraw processing consent",
  privacy: "Processing notice",
  selection: "Selected criteria",
  prompt: "What are you looking for?",
  photo: "Choose one photo",
  voice: "Record a short description",
  local: "Your selected file stays on this device until you confirm upload.",
  stage: "Review selected file",
  withdrawNote:
    "You can withdraw your recorded choice even after its expiry or a change to processing settings. This clears your current private input; uncertain processing charges stay pending.",
  upload: "Upload selected file",
  uploadAgain: "Retry this file upload",
  complete: "Validate uploaded file",
  ready: "Input is ready",
  prepare: "Review input",
  execute: "Start interpretation",
  accept: "Review search criteria",
  apply: "Apply reviewed criteria",
  search: "Use these criteria",
  cancel: "Cancel and clear input",
  stopRequest: "Stop this request",
  stopNote:
    "The result may be uncertain. Recover the original acknowledgement before clearing the input.",
  review: "Review this action",
  confirm: "I have reviewed this input and want to continue.",
  continue: "Continue",
  reserved: "Your input is reserved. Start interpretation when you are ready.",
  unknown:
    "This request has an uncertain outcome. It will not be sent again. You can clear its private input; the reserved charge remains pending.",
  failed: "Interpretation did not start. Clear this input to try a new one.",
  calling: "Interpreting your input…",
  proposed: "Suggested interpretation",
  accepted: "Reviewed criteria",
  costPending: "The processing charge is pending verification.",
  noGuess:
    "These are suggested search terms, not a claim about identity, authenticity or compatibility.",
  itemType: "Item type",
  colour: "Colour",
  style: "Style",
  transcript: "Review and edit the transcript",
  spokenSearch: "Review transcript as search text",
  recognition:
    "This transcript came from your recorded audio. Your edits become search text when you confirm.",
  cleanup: "Cleanup can start after the original write window ends",
  retention:
    "Private access ends at the input expiry. Cleanup waits for the original upload and write window to end; an uncertain cleanup remains pending.",
  capture: "Start recording",
  stopCapture: "Stop and review recording",
  discardCapture: "Discard recording",
  recording: "Recording",
  captureError:
    "Microphone recording is unavailable. Use typed search instead.",
  typed: "Open typed search",
  fileError:
    "Choose a supported file within the size limit. The selected file must match the reserved upload.",
  uploadError:
    "Upload outcome is uncertain. Keep this file and validate the existing upload, or retry the same file within its original expiry.",
  invalid:
    "Review the criteria; an existing selected filter cannot be removed or changed.",
  results: "Current matching listings",
  empty: "No current available listings match these criteria.",
  scope:
    "Up to 20 current listings. Price and stock are checked again when you open an action.",
  shipping:
    "Delivery cost and arrival date require the seller’s current terms.",
  seconds: "seconds maximum",
  expiry: "Private input expiry",
  operationNote:
    "This action processes only your current input. Saves, contact and cart actions have their own review.",
};
const bg: typeof en = {
  titles: {
    text: "Опишете какво търсите",
    photo: "Търсене по снимка",
    voice: "Търсене с глас",
  },
  intro:
    "Прегледайте предложените критерии, преди да търсите в актуалните обяви. Избраните ви филтри се запазват.",
  guest: "Влезте в профила си, за да запазите този вход личен.",
  signIn: "Вход",
  unavailable:
    "Този вход не е достъпен, докато настройките за обработка и поверителност не бъдат одобрени.",
  checkAgain: "Провери отново",
  compactUnavailable:
    "Предложенията не са достъпни в момента. Можеш да търсиш по ключови думи или да използваш филтрите.",
  consent: "Разрешавам обработката на този вход",
  withdraw: "Оттегляне на съгласието",
  privacy: "Информация за обработката",
  selection: "Избрани критерии",
  prompt: "Какво търсите?",
  photo: "Изберете една снимка",
  voice: "Запишете кратко описание",
  local:
    "Избраният файл остава на това устройство, докато не потвърдите качването.",
  stage: "Преглед на избрания файл",
  withdrawNote:
    "Можете да оттеглите записания си избор и след изтичането му или промяна в настройките за обработка. Това изчиства текущия личен вход; неясните разходи за обработка остават за проверка.",
  upload: "Качване на избрания файл",
  uploadAgain: "Повторно качване на същия файл",
  complete: "Проверка на качения файл",
  ready: "Входът е готов",
  prepare: "Преглед на входа",
  execute: "Начало на разпознаването",
  accept: "Преглед на критериите",
  apply: "Прилагане на прегледаните критерии",
  search: "Използване на тези критерии",
  cancel: "Отказ и изчистване на входа",
  stopRequest: "Спиране на заявката",
  stopNote:
    "Резултатът може да е неясен. Възстановете първоначалното потвърждение, преди да изчистите входа.",
  review: "Преглед на действието",
  confirm: "Прегледах този вход и искам да продължа.",
  continue: "Продължаване",
  reserved: "Входът е запазен. Започнете разпознаването, когато сте готови.",
  unknown:
    "Резултатът от тази заявка е неясен. Тя няма да бъде изпратена отново. Можете да изчистите личния вход; запазеният разход остава за проверка.",
  failed:
    "Разпознаването не е започнало. Изчистете този вход, за да опитате с нов.",
  calling: "Разпознаване на входа…",
  proposed: "Предложено разпознаване",
  accepted: "Прегледани критерии",
  costPending: "Разходът за обработка очаква проверка.",
  noGuess:
    "Това са предложени думи за търсене, а не твърдение за самоличност, автентичност или съвместимост.",
  itemType: "Вид на предмета",
  colour: "Цвят",
  style: "Стил",
  transcript: "Прегледайте и редактирайте транскрипцията",
  spokenSearch: "Преглед на транскрипцията като търсене",
  recognition:
    "Тази транскрипция е получена от вашия аудиозапис. Редакциите ви стават текст за търсене след потвърждение.",
  cleanup: "Изчистването може да започне след първоначалния срок за запис",
  retention:
    "Личният достъп приключва със срока на входа. Изчистването изчаква края на първоначалния срок за качване и запис; неясният резултат остава за проверка.",
  capture: "Начало на записа",
  stopCapture: "Спиране и преглед на записа",
  discardCapture: "Изтриване на записа",
  recording: "Запис",
  captureError:
    "Записът с микрофон не е достъпен. Използвайте търсене с текст.",
  typed: "Търсене с текст",
  fileError:
    "Изберете поддържан файл в ограниченията за размер. Той трябва да съвпада със запазеното качване.",
  uploadError:
    "Резултатът от качването е неясен. Запазете файла и проверете съществуващото качване или качете същия файл преди първоначалния му срок.",
  invalid:
    "Прегледайте критериите; вече избран филтър не може да бъде премахнат или променен.",
  results: "Актуални подходящи обяви",
  empty: "Няма актуални налични обяви, които отговарят на тези критерии.",
  scope:
    "До 20 актуални обяви. Цената и наличността се проверяват отново при отваряне на действие.",
  shipping:
    "Цената и датата за доставка зависят от актуалните условия на продавача.",
  seconds: "секунди максимум",
  expiry: "Срок за личния вход",
  operationNote:
    "Това действие обработва само текущия ви вход. Запазването, контактът и кошницата имат отделен преглед.",
};
export const inputCopy = { bg, en };
