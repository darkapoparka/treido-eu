"use client";
import { useLayoutEffect, useRef } from "react";
import type {
  AttributeDefinition,
  CategoryLeaf,
} from "@treido/contracts/categories";
import { optionLabel, sellingCopy, type SellingLocale } from "./copy";
import { fieldHasValue, type RawFields, type RawValue } from "./form-model";
import styles from "./selling.module.css";

function fieldHint(
  field: AttributeDefinition,
  locale: SellingLocale,
  error?: "required" | "invalid",
): string | undefined {
  const copy = sellingCopy[locale];
  if (field.id === "carrier") return copy.carrierHint;
  if (field.id === "fitmentSource") return copy.fitmentHint;
  if (field.type === "boolean" && field.mustBeTrue) return copy.sealedHint;
  if (error !== "invalid") return undefined;
  switch (field.type) {
    case "text":
      return field.format === "date"
        ? undefined
        : `${copy.characterLimit} ${field.maxLength}`;
    case "integer":
      return `${copy.wholeNumber} ${field.min} ${copy.to} ${field.max}${field.unit ? ` ${field.unit}` : ""}.`;
    case "dimension":
      return copy.positiveDimensions;
    case "decimal":
      return copy.decimalHint;
    case "multi_enum":
      return `${copy.maxChoices} ${field.maxItems}`;
    case "boolean":
      return field.mustBeTrue ? copy.sealedHint : undefined;
    default:
      return undefined;
  }
}

function AttributeField({
  field,
  value,
  locale,
  error,
  onChange,
}: {
  field: AttributeDefinition;
  value?: RawValue;
  locale: SellingLocale;
  error?: "required" | "invalid";
  onChange: (value: RawValue) => void;
}) {
  const copy = sellingCopy[locale];
  const id = `selling-${field.id}`;
  const hint = fieldHint(field, locale, error);
  const unit = field.type === "integer" && field.unit ? ` (${field.unit})` : "";
  const title = `${field.labels[locale]}${unit} · ${field.required ? copy.required : copy.optional}`;
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  const common = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  } as const;
  const text = typeof value === "string" ? value : "";
  const object =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const choices = Array.isArray(value) ? value : [];
  let control;
  if (field.type === "dimension") {
    control = (
      <fieldset className={`form-field ${styles.composite}`}>
        <legend>{title}</legend>
        <div className={styles.dimensions}>
          {(["width", "height", "depth"] as const).map((axis) => (
            <label key={axis} htmlFor={`${id}-${axis}`}>
              {copy[axis]}
              <input
                {...common}
                id={`${id}-${axis}`}
                type="text"
                inputMode="decimal"
                maxLength={30}
                value={object[axis] ?? ""}
                onChange={(event) =>
                  onChange({ ...object, [axis]: event.target.value })
                }
              />
            </label>
          ))}
        </div>
        <label htmlFor={`${id}-unit`}>
          {copy.unit}
          <select
            {...common}
            id={`${id}-unit`}
            value={object.unit ?? "cm"}
            onChange={(event) =>
              onChange({ ...object, unit: event.target.value })
            }
          >
            {field.units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    );
  } else if (field.type === "multi_enum") {
    control = (
      <fieldset className={`form-field ${styles.composite}`}>
        <legend>{title}</legend>
        <div className={styles.choices}>
          {field.values.map((option) => (
            <label key={option} className={styles.checkChoice}>
              <input
                {...common}
                type="checkbox"
                checked={choices.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...choices, option]
                      : choices.filter((value) => value !== option),
                  )
                }
              />
              {optionLabel(option, locale)}
            </label>
          ))}
        </div>
      </fieldset>
    );
  } else {
    control = (
      <label className="form-field" htmlFor={id}>
        {title}
        {field.type === "enum" || field.type === "boolean" ? (
          <select
            {...common}
            id={id}
            value={text}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{copy.choose}</option>
            {field.type === "enum" ? (
              field.values.map((option) => (
                <option key={option} value={option}>
                  {optionLabel(option, locale)}
                </option>
              ))
            ) : (
              <>
                <option value="yes">{copy.yes}</option>
                <option value="no">{copy.no}</option>
              </>
            )}
          </select>
        ) : field.type === "decimal" ? (
          <div className={styles.measure}>
            <input
              {...common}
              id={id}
              type="text"
              inputMode="decimal"
              maxLength={30}
              value={object.value ?? ""}
              onChange={(event) =>
                onChange({ value: event.target.value, unit: field.unit })
              }
            />
            <span aria-label={copy.unit}>{field.unit}</span>
          </div>
        ) : (
          <input
            {...common}
            id={id}
            type={
              field.type === "text" && field.format === "date" ? "date" : "text"
            }
            inputMode={field.type === "integer" ? "numeric" : undefined}
            maxLength={field.type === "text" ? field.maxLength : 30}
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </label>
    );
  }
  return (
    <div className={styles.fieldGroup}>
      {control}
      {hint && (
        <p id={`${id}-hint`} className="form-note">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="form-error">
          {error === "required" ? copy.requiredError : copy.fieldError}
        </p>
      )}
    </div>
  );
}

export function AttributeFields({
  category,
  fields,
  errors,
  locale,
  onChange,
}: {
  category: CategoryLeaf;
  fields: RawFields;
  errors: Record<string, "required" | "invalid">;
  locale: SellingLocale;
  onChange: (id: string, value: RawValue) => void;
}) {
  const optionalDetails = useRef<HTMLDetailsElement>(null);
  const initialized = useRef(false);
  const required = category.profile.fields.filter((field) => field.required);
  const optional = category.profile.fields.filter((field) => !field.required);
  const hasOptionalValues = optional.some((field) =>
    fieldHasValue(fields[field.id]),
  );
  const hasOptionalError = optional.some((field) => errors[field.id]);
  useLayoutEffect(() => {
    // The native disclosure owns toggling; reveal validation errors before form focus.
    if ((!initialized.current && hasOptionalValues) || hasOptionalError) {
      if (optionalDetails.current) optionalDetails.current.open = true;
    }
    initialized.current = true;
  }, [hasOptionalValues, hasOptionalError, errors]);

  function renderField(field: AttributeDefinition) {
    const conditional =
      (field.id === "carrier" && fields.carrierLocked === "yes") ||
      (field.id === "fitmentSource" &&
        (fieldHasValue(fields.vehicleMake) ||
          fieldHasValue(fields.vehicleModel)));
    return (
      <AttributeField
        key={field.id}
        field={conditional ? { ...field, required: true } : field}
        value={fields[field.id]}
        error={errors[field.id]}
        locale={locale}
        onChange={(value) => onChange(field.id, value)}
      />
    );
  }
  const copy = sellingCopy[locale];
  return (
    <>
      {required.map(renderField)}
      {optional.length > 0 && (
        <details
          ref={optionalDetails}
          className={`account-panel ${styles.additional}`}
        >
          <summary>
            <span>{copy.moreDetails}</span>
            <span aria-hidden="true" className={styles.disclosureArrow}>
              ›
            </span>
          </summary>
          <p className="form-note">{copy.moreDetailsHint}</p>
          <div className={styles.optionalFields}>
            {optional.map(renderField)}
          </div>
        </details>
      )}
    </>
  );
}
