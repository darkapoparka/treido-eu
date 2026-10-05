"use client";
import {
  getCategory,
  categoryLeaves,
  type AttributeDefinition,
} from "@treido/contracts/categories";
import type { RawFields, RawValue } from "../selling/form-model";
import { optionLabel } from "../selling/copy";
import { assistantCopy, type AssistantLocale } from "./copy";
import type { Requirement } from "./compatibility-model";
import s from "./assistant-tools.module.css";
function ValueControl({
  field,
  value,
  locale,
  onChange,
}: {
  field: AttributeDefinition;
  value?: RawValue;
  locale: AssistantLocale;
  onChange: (value: RawValue) => void;
}) {
  const t = assistantCopy[locale],
    id = "requirement-" + field.id,
    label = field.labels[locale],
    text = typeof value === "string" ? value : "",
    object =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (field.type === "dimension" || field.type === "decimal")
    return (
      <fieldset className={s.field}>
        <legend>{label}</legend>
        <div className={s.dimension}>
          {(field.type === "dimension"
            ? ["width", "height", "depth"]
            : ["value"]
          ).map((axis) => (
            <label className={s.field} key={axis} htmlFor={id + "-" + axis}>
              {axis === "value"
                ? label
                : t[axis as "width" | "height" | "depth"]}
              <input
                id={id + "-" + axis}
                inputMode="decimal"
                maxLength={30}
                value={object[axis] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...object,
                    [axis]: event.target.value,
                    unit:
                      object.unit ??
                      (field.type === "dimension" ? "cm" : field.unit),
                  })
                }
              />
            </label>
          ))}
          <label className={s.field} htmlFor={id + "-unit"}>
            {t.unit}
            <select
              id={id + "-unit"}
              value={
                object.unit ?? (field.type === "dimension" ? "cm" : field.unit)
              }
              onChange={(event) =>
                onChange({ ...object, unit: event.target.value })
              }
            >
              {(field.type === "dimension" ? field.units : [field.unit]).map(
                (unit) => (
                  <option key={unit}>{unit}</option>
                ),
              )}
            </select>
          </label>
        </div>
      </fieldset>
    );
  if (field.type === "enum" || field.type === "boolean")
    return (
      <label className={s.field} htmlFor={id}>
        {label}
        <select
          id={id}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {field.type === "boolean" ? (
            <>
              <option value="yes">{t.yes}</option>
              <option value="no">{t.no}</option>
            </>
          ) : (
            field.values.map((v) => (
              <option value={v} key={v}>
                {optionLabel(v, locale)}
              </option>
            ))
          )}
        </select>
      </label>
    );
  if (field.type === "multi_enum")
    return (
      <label className={s.field} htmlFor={id}>
        {label}
        <select
          id={id}
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={(event) =>
            onChange(
              Array.from(
                event.target.selectedOptions,
                (option) => option.value,
              ),
            )
          }
        >
          {field.values.map((v) => (
            <option value={v} key={v}>
              {optionLabel(v, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <label className={s.field} htmlFor={id}>
      {label}
      {field.type === "integer" && field.unit ? " (" + field.unit + ")" : ""}
      <input
        id={id}
        value={text}
        inputMode={field.type === "integer" ? "numeric" : undefined}
        type={
          field.type === "text" && field.format === "date" ? "date" : "text"
        }
        maxLength={field.type === "text" ? field.maxLength : 30}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function RequirementFields({
  locale,
  categoryId,
  fields,
  operators,
  onCategory,
  onField,
  onOperator,
  disabled,
}: {
  locale: AssistantLocale;
  categoryId: string;
  fields: RawFields;
  operators: Record<string, Requirement["operator"]>;
  onCategory: (id: string) => void;
  onField: (id: string, value: RawValue) => void;
  onOperator: (id: string, value: Requirement["operator"] | null) => void;
  disabled: boolean;
}) {
  const t = assistantCopy[locale],
    category = getCategory(categoryId);
  return (
    <fieldset disabled={disabled} className={s.panel}>
      <legend>{t.requirements}</legend>
      <label className={s.field} htmlFor="compatibility-category">
        {t.category}
        <select
          id="compatibility-category"
          value={categoryId}
          onChange={(event) => onCategory(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {categoryLeaves.map((leaf) => (
            <option value={leaf.id} key={leaf.id}>
              {leaf.labels[locale]}
            </option>
          ))}
        </select>
      </label>
      {category?.kind === "leaf" &&
        category.profile.fields.map((field) => (
          <div className={s.row} key={field.id}>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={Object.hasOwn(operators, field.id)}
                onChange={(event) =>
                  onOperator(field.id, event.target.checked ? "equal" : null)
                }
              />
              {t.use} · {field.labels[locale]}
            </label>
            {Object.hasOwn(operators, field.id) && (
              <div className={s.fields}>
                <ValueControl
                  field={field}
                  value={fields[field.id]}
                  locale={locale}
                  onChange={(value) => onField(field.id, value)}
                />
                <label className={s.field} htmlFor={"operator-" + field.id}>
                  {t.required}
                  <select
                    id={"operator-" + field.id}
                    value={operators[field.id]}
                    onChange={(event) =>
                      onOperator(
                        field.id,
                        event.target.value as Requirement["operator"],
                      )
                    }
                  >
                    <option value="equal">{t.equal}</option>
                    {["integer", "decimal", "dimension"].includes(
                      field.type,
                    ) && (
                      <>
                        <option value="at_least">{t.at_least}</option>
                        <option value="at_most">{t.at_most}</option>
                      </>
                    )}
                  </select>
                </label>
              </div>
            )}
          </div>
        ))}
    </fieldset>
  );
}
