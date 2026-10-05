import {
  messageImageNotice,
  type MessageImageSummary,
} from "./message-image-summary";
export function MessageImageNotice({
  locale,
  review,
}: {
  locale: "bg" | "en";
  review?: MessageImageSummary | null;
}) {
  return (
    <div>
      <p>{messageImageNotice[locale]}</p>
      {review && (
        <>
          <p>{review.description[locale]}</p>
          <p>
            {locale === "en"
              ? "Registered objects to remove / retain"
              : "Регистрирани обекти за премахване / запазване"}
            : {review.removedObjects} / {review.retainedObjects}
          </p>
          {review.handling === "remove" && (
            <p>
              {locale === "en"
                ? "Reviewed delay after acceptance (seconds)"
                : "Прегледано отлагане след приемане (секунди)"}
              : {review.delaySeconds}
            </p>
          )}
        </>
      )}
    </div>
  );
}
