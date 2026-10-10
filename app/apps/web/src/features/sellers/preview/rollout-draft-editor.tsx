"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import { validEditorDraft, type EditorDraft } from "./local-draft-model";
import { DraftDateFields } from "./draft-date-fields";
import {
  Action,
  Badge,
  Button,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Panel,
  s,
} from "./ui";
import styles from "./rollout-draft-editor.module.css";
type RolloutDraft = Extract<EditorDraft, { kind: "Rollout" }>;

export function RolloutDraftEditor({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "RolloutDraft",
  );
  const [title, setTitle] = useState(
    existing?.title ?? text("New rollout", "Ново пускане"),
  );
  const [draft, setDraft] = useState<RolloutDraft>(
    existing?.editorDraft?.kind === "Rollout"
      ? existing.editorDraft
      : {
          kind: "Rollout",
          rolloutType: "Launch",
          start: "",
          startTime: "",
          end: "",
          endTime: "",
          notes: "",
          allocation: 100,
        },
  );
  const [endEnabled, setEndEnabled] = useState(!!draft.end);
  const [dateKind, setDateKind] = useState<"start" | "end">("start");
  const [dateDraft, setDateDraft] = useState({ date: "", time: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [datePosition, setDatePosition] = useState({ left: 16, top: 16 });
  const [notePosition, setNotePosition] = useState({ left: 16, top: 16 });
  const [error, setError] = useState("");
  const datePopover = useRef<HTMLDivElement>(null);
  const notePopover = useRef<HTMLDivElement>(null);
  const patch = (values: Partial<RolloutDraft>) =>
    setDraft({ ...draft, ...values });
  const place = (
    event: React.MouseEvent<HTMLButtonElement>,
    popover: HTMLDivElement,
    alignRight = false,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { width, height } = popover.getBoundingClientRect();
    const below = rect.bottom + 6;
    const above = rect.top - height - 6;
    const preferAbove = alignRight && window.innerWidth < 768 && above >= 16;
    return {
      left: Math.max(
        16,
        Math.min(
          alignRight ? rect.right - width : rect.left,
          window.innerWidth - width - 16,
        ),
      ),
      top: Math.max(
        16,
        Math.min(
          !preferAbove && below + height <= window.innerHeight - 16
            ? below
            : above,
          window.innerHeight - height - 16,
        ),
      ),
    };
  };
  const openDate = (
    event: React.MouseEvent<HTMLButtonElement>,
    kind: "start" | "end",
  ) => {
    setDateKind(kind);
    setDateDraft(
      kind === "start"
        ? { date: draft.start, time: draft.startTime }
        : { date: draft.end, time: draft.endTime },
    );
    const popover = datePopover.current;
    if (!popover) return;
    popover.showPopover();
    setDatePosition(place(event, popover));
    popover
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
  };
  const planned = {
    ...draft,
    ...(dateKind === "start"
      ? { start: dateDraft.date, startTime: dateDraft.time }
      : { end: dateDraft.date, endTime: dateDraft.time }),
  };
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Rollout not found", "Пускането не е намерено")}
          back={href("rollouts")}
        />
      </main>
    );
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !validEditorDraft(draft)) {
      setError(
        text(
          "Add a name and valid dates. The end must follow the start.",
          "Добавете име и валидни дати. Краят трябва да е след началото.",
        ),
      );
      return;
    }
    const entry: Entry = {
      id: existing?.id ?? `rollout-${crypto.randomUUID()}`,
      type: "RolloutDraft",
      title: title.trim(),
      body: "",
      status: "Draft",
      tags: "",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, entry) });
    notify(
      text(
        "Rollout plan saved locally. No changes or traffic are scheduled.",
        "Планът за пускане е запазен локално. Няма планирани промени или трафик.",
      ),
    );
    router.push(href(`rollouts/${entry.id}`));
  };
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="rollout"
    >
      <div className={styles.heading} data-studio-part="rollout-heading">
        <EditorBreadcrumb
          href={href("rollouts")}
          title={text("Rollouts", "Пускания")}
          current={title || text("New rollout", "Ново пускане")}
          icon="markets"
        />
        <Badge>Draft</Badge>
      </div>
      <form onSubmit={save}>
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="editor-main">
            <Panel part="rollout-core">
              <div className={styles.nameRow}>
                <Field label={text("Rollout name", "Име на пускането")}>
                  <input
                    required
                    maxLength={160}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <div
                  className={styles.typeControl}
                  data-studio-part="rollout-type"
                >
                  <svg
                    className={styles.typeIcon}
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    {draft.rolloutType === "Launch" ? (
                      <path d="m7 12 5-5m-6 6-2 3 3-1m0-6L4 8l-2 4 4 1 1 4 4-2-1-3m-3 0c-1-4 3-9 10-9 0 7-5 11-9 10Zm6-5h.01" />
                    ) : (
                      <path d="M5 3v3m10-3v3M3 8h14M3 5h14v12H3V5Z" />
                    )}
                  </svg>
                  <select
                    aria-label={text("Rollout type", "Вид пускане")}
                    value={draft.rolloutType}
                    onChange={(event) =>
                      patch({
                        rolloutType: event.target
                          .value as RolloutDraft["rolloutType"],
                      })
                    }
                  >
                    <option value="Launch">{text("Launch", "Пускане")}</option>
                    <option value="Event">{text("Event", "Събитие")}</option>
                  </select>
                  <svg
                    className={styles.typeChevron}
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="m7 8 3-3 3 3m-6 4 3 3 3-3" />
                  </svg>
                </div>
              </div>
            </Panel>
            <EditorSection
              title={text("Scheduling", "Планиране")}
              part="rollout-scheduling"
            >
              <div className={styles.scheduleRow}>
                <span>{text("Changes publish", "Публикуване на промени")}</span>
                <div>
                  <Button
                    className={styles.dateTrigger}
                    aria-label={text("Start date", "Начална дата")}
                    onClick={(event) => openDate(event, "start")}
                  >
                    {draft.start
                      ? `${draft.start} ${draft.startTime}`
                      : text("Start date", "Начална дата")}
                  </Button>
                  <p className={s.help}>
                    {text(
                      "Local planned date only. No automatic publication.",
                      "Само локална планирана дата. Няма автоматично публикуване.",
                    )}
                  </p>
                  {endEnabled && (
                    <Button
                      className={styles.dateTrigger}
                      aria-label={text("End date", "Крайна дата")}
                      onClick={(event) => openDate(event, "end")}
                    >
                      {draft.end
                        ? `${draft.end} ${draft.endTime}`
                        : text("End date", "Крайна дата")}
                    </Button>
                  )}
                </div>
                <Button
                  plain
                  data-studio-part="rollout-end-toggle"
                  onClick={() => {
                    setEndEnabled(!endEnabled);
                    if (endEnabled) patch({ end: "", endTime: "" });
                  }}
                >
                  {endEnabled ? (
                    text("Remove end date", "Премахване на крайна дата")
                  ) : (
                    <>
                      <AdminIcon name="plus" />
                      {text("Set end date", "Задаване на крайна дата")}
                    </>
                  )}
                </Button>
              </div>
            </EditorSection>
            <EditorSection
              title={text("Changes", "Промени")}
              part="rollout-changes"
            >
              <div className={styles.changes}>
                <p>
                  {text(
                    "Prepare changes for a launch or sales event",
                    "Подгответе промени за пускане или търговско събитие",
                  )}
                </p>
                <Button
                  disabled
                  title={text(
                    "Publishing changes requires a connected rollout adapter.",
                    "Публикуването на промени изисква свързан адаптер за пускане.",
                  )}
                >
                  {text("Add changes", "Добавяне на промени")}
                </Button>
              </div>
            </EditorSection>
            <EditorSection
              title={text("Audience", "Аудитория")}
              part="rollout-audience"
            >
              <div className={styles.audience}>
                <div>
                  <Field label={text("Traffic split", "Разделяне на трафика")}>
                    <select
                      disabled
                      aria-label={text("Traffic split", "Разделяне на трафика")}
                    >
                      <option>{text("None", "Без")}</option>
                    </select>
                  </Field>
                  <Field
                    label={text(
                      "Traffic allocation",
                      "Разпределение на трафика",
                    )}
                  >
                    <div
                      className={styles.allocationChoice}
                      data-studio-part="rollout-allocation-choice"
                    >
                      <span aria-hidden="true">
                        {draft.allocation === 100
                          ? text(
                              "All eligible visitors",
                              "Всички допустими посетители",
                            )
                          : `${draft.allocation}%`}
                      </span>
                      <select
                        aria-label={text(
                          "Planned traffic allocation",
                          "Планирано разпределение на трафика",
                        )}
                        value={draft.allocation}
                        onChange={(event) =>
                          patch({ allocation: Number(event.target.value) })
                        }
                      >
                        {[100, 50, 25, 10].map((value) => (
                          <option key={value} value={value}>
                            {value === 100
                              ? text(
                                  "All eligible visitors",
                                  "Всички допустими посетители",
                                )
                              : `${value}%`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Field>
                  <Field label={text("Eligibility", "Допустимост")}>
                    <span>
                      {text("No connected markets", "Няма свързани пазари")}
                    </span>
                  </Field>
                </div>
                <div className={styles.allocation}>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle
                      cx="40"
                      cy="40"
                      r="28"
                      fill="none"
                      stroke="#eee"
                      strokeWidth="9"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="28"
                      fill="none"
                      stroke="#30a7d7"
                      strokeWidth="9"
                      strokeDasharray={`${draft.allocation * 1.76} 176`}
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <span>
                    {text("Planned", "Планирано")}: {draft.allocation}%
                  </span>
                </div>
              </div>
            </EditorSection>
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <section className={styles.notes} data-studio-part="rollout-notes">
              <h2>
                {text("Notes", "Бележки")}
                <Button
                  plain
                  aria-label={text(
                    "Edit rollout notes",
                    "Редактиране на бележките за пускане",
                  )}
                  onClick={(event) => {
                    setNoteDraft(draft.notes);
                    const popover = notePopover.current;
                    if (!popover) return;
                    popover.showPopover();
                    setNotePosition(place(event, popover, true));
                    popover
                      ?.querySelector<HTMLTextAreaElement>("textarea")
                      ?.focus({ preventScroll: true });
                  }}
                >
                  <AdminIcon name="edit" />
                </Button>
              </h2>
              <p>{draft.notes || text("No notes", "Няма бележки")}</p>
            </section>
          </aside>
        </div>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <p className={s.help}>
          {text(
            "This is a local plan. No deployment, publishing, eligibility or traffic allocation takes place.",
            "Това е локален план. Не се извършва внедряване, публикуване, промяна на допустимост или разпределение на трафик.",
          )}
        </p>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href("rollouts")}>{text("Cancel", "Отказ")}</Action>
          <Button primary type="submit">
            {text("Save draft", "Запази чернова")}
          </Button>
        </div>
      </form>
      <div
        ref={datePopover}
        popover="auto"
        role="dialog"
        aria-label={text("Planned rollout date", "Планирана дата на пускане")}
        className={styles.datePopover}
        data-studio-part="rollout-date-popover"
        style={{
          ...datePosition,
          maxHeight: `calc(100dvh - ${datePosition.top + 16}px)`,
        }}
      >
        <DraftDateFields
          date={dateDraft.date}
          time={dateDraft.time}
          onDate={(date) => setDateDraft({ ...dateDraft, date })}
          onTime={(time) => setDateDraft({ ...dateDraft, time })}
          months={1}
          presentation="expiry"
          weekStartsOn={0}
        />
        <footer>
          <Button
            plain
            onClick={() => {
              patch(
                dateKind === "start"
                  ? { start: "", startTime: "" }
                  : { end: "", endTime: "" },
              );
              datePopover.current?.hidePopover();
            }}
          >
            {text("Clear", "Изчистване")}
          </Button>
          <Button
            primary
            disabled={!dateDraft.date || !validEditorDraft(planned)}
            onClick={() => {
              setDraft(planned);
              datePopover.current?.hidePopover();
            }}
          >
            {text("Done", "Готово")}
          </Button>
        </footer>
      </div>
      <div
        ref={notePopover}
        popover="auto"
        role="dialog"
        aria-label={text(
          "Edit rollout notes",
          "Редактиране на бележките за пускане",
        )}
        className={styles.notePopover}
        data-studio-part="rollout-notes-popover"
        style={{
          ...notePosition,
          maxHeight: `calc(100dvh - ${notePosition.top + 16}px)`,
        }}
      >
        <Field label={text("Note", "Бележка")}>
          <textarea
            value={noteDraft}
            placeholder={text("Add a note…", "Добавете бележка…")}
            maxLength={2000}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </Field>
        <Button
          primary
          onClick={() => {
            patch({ notes: noteDraft });
            notePopover.current?.hidePopover();
          }}
        >
          {text("Apply", "Прилагане")}
        </Button>
      </div>
    </main>
  );
}
