"use client";
import Link from "next/link";
import { usePreview } from "./context";
import {
  Action,
  Badge,
  Empty,
  Header,
  TableFooter,
  Toolbar,
  s,
  useList,
} from "./ui";

export function ProcurementPages({
  section,
}: {
  section: "purchase-orders" | "transfers" | "gift-cards";
}) {
  const { store, href, text } = usePreview();
  const list = useList();
  const gift = section === "gift-cards",
    transfer = section === "transfers";
  const kind = gift
    ? "GiftCardDraft"
    : transfer
      ? "TransferDraft"
      : "PurchaseOrderDraft";
  const title = gift
    ? text("Gift cards", "Подаръчни карти")
    : transfer
      ? text("Transfers", "Трансфери")
      : text("Purchase orders", "Поръчки към доставчици");
  const action = gift
    ? text("Create gift card", "Създаване на подаръчна карта")
    : transfer
      ? text("Create transfer", "Създаване на трансфер")
      : text("Create purchase order", "Създаване на поръчка");
  const records = store.entries.filter(
    (entry) =>
      entry.type === kind || (gift && entry.type === "GiftCardProductDraft"),
  );
  const rows = records.filter((entry) =>
    `${entry.title} ${entry.tags}`
      .toLocaleLowerCase()
      .includes(list.query.trim().toLocaleLowerCase()),
  );
  return (
    <main
      className={s.page}
      data-studio-part="page"
      data-studio-builder={section}
    >
      <Header
        title={title}
        icon={gift ? "discount" : "orders"}
        actions={
          records.length ? (
            <Action primary href={href(`${section}/new`)}>
              {action}
            </Action>
          ) : undefined
        }
      />
      {!gift && !transfer && <Toolbar {...list} tabs={["All"]} />}
      {!records.length ? (
        <Empty
          kind={gift ? "discount" : "orders"}
          title={
            gift
              ? text(
                  "Start selling gift cards",
                  "Започнете да продавате подаръчни карти",
                )
              : transfer
                ? text(
                    "Move inventory between locations",
                    "Преместване на наличности между локации",
                  )
                : text(
                    "Manage your purchase orders",
                    "Управление на поръчките към доставчици",
                  )
          }
          body={
            gift
              ? text(
                  "Prepare a local card draft. Issuing, funding, and sending gift cards require a verified stored-value adapter.",
                  "Подгответе локална чернова. Издаването, финансирането и изпращането изискват потвърден адаптер за парична стойност.",
                )
              : transfer
                ? text(
                    "Prepare local inventory movement plans. Actual allocation and movement require authorized locations.",
                    "Подгответе локални планове за движение. Реалното разпределение изисква разрешени локации.",
                  )
                : text(
                    "Prepare local supplier order drafts. Procurement and supplier payments require connected adapters.",
                    "Подгответе локални чернови на поръчки. Снабдяването и плащанията изискват свързани адаптери.",
                  )
          }
        >
          <Action primary href={href(`${section}/new`)}>
            {action}
          </Action>
          {gift && (
            <Action href={href("gift-cards/product-new")}>
              {text(
                "Add gift card product",
                "Добавяне на продукт за подаръчна карта",
              )}
            </Action>
          )}
        </Empty>
      ) : (
        <div className={s.tablePanel} data-studio-part="table-panel">
          <table className={s.table}>
            <thead>
              <tr>
                <th>{text("Name", "Име")}</th>
                <th>{text("Status", "Статус")}</th>
                <th>{text("Tags", "Тагове")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <Link href={href(`${section}/${entry.id}`)}>
                      {entry.title}
                    </Link>
                  </td>
                  <td>
                    <Badge>{text("Local draft", "Локална чернова")}</Badge>
                  </td>
                  <td>{entry.tags || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TableFooter count={rows.length} />
        </div>
      )}
    </main>
  );
}
