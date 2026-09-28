"use client";
import type { ReferencePolicy } from "../catalog/types";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav } from "./components";
import "./merchant-policy.css";

export function MerchantPolicy({ policy }: { policy: ReferencePolicy }) {
  return (
    <ShopSurface className="shop-page android-live native-merchant-policy">
      <header>
        <h1>{policy.title}</h1>
      </header>
      <article aria-label={policy.title}>
        {policy.blocks.map((block, index) =>
          block.kind === "heading" ? (
            <h2 key={index}>{block.text}</h2>
          ) : block.kind === "list" ? (
            <ul key={index}>
              {block.items?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : block.kind === "table" ? (
            <div
              className="policy-table"
              key={index}
              tabIndex={0}
              role="region"
              aria-label="Captured merchant shipping rates"
            >
              <table>
                <thead>
                  <tr>
                    {block.rows?.[0]?.map((cell) => (
                      <th scope="col" key={cell}>
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows?.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p key={index}>{block.text}</p>
          ),
        )}
      </article>
      <FloatingNav android back fade />
    </ShopSurface>
  );
}
