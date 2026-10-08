import React from "react";
import { createRoot } from "react-dom/client";
import { DeclarationReviewForm } from "../../apps/web/src/features/seller-declarations/review-form";
import { declarationMessages } from "../../apps/web/src/features/seller-declarations/copy";
import { Workspace } from "../../apps/web/src/features/sellers/workspace";
import "../../apps/web/src/app/globals.css";
import { actorKey, fixture, useFixtureState, viewFor } from "./fixture-runtime";
import controls from "./fixture-controls.module.css";

function Fixture() {
  const state = useFixtureState();
  const requests = fixture.requests();
  const text = declarationMessages[state.language];
  return (
    <>
      <aside
        className={controls.tools}
        data-fixture-controls
        aria-label="Synthetic test controls"
      >
        <h1>SYNTHETIC component fixture — declaration review</h1>
        <p>
          Source component/CSS are real. Auth, operator authority, contacts,
          responses and receipt model are synthetic. This is not a Clerk,
          database, provider or production review.
        </p>
        <p>
          Fixture auth:{" "}
          <strong data-fixture-auth>{state.subject ?? "signed out"}</strong>.
          Mounted server-prop actor: {state.binding}. Synthetic commits:{" "}
          <output data-fixture-committed>{state.committed}</output>.
        </p>
        <div className={controls.buttons}>
          <button onClick={() => fixture.setAuth("operator-A")}>
            Auth A only
          </button>
          <button onClick={() => fixture.setAuth("operator-B")}>
            Auth B only
          </button>
          <button onClick={() => fixture.setAuth(null)}>Log out fixture</button>
          <button onClick={() => fixture.setAuth(state.subject, false)}>
            Defer auth discovery
          </button>
          <button onClick={() => fixture.open("operator-A")}>
            Open A review
          </button>
          <button onClick={() => fixture.open("operator-B")}>
            Open B review
          </button>
          <button onClick={() => fixture.remount()}>Remount same review</button>
          <button onClick={() => fixture.changeSetup()}>
            Advance setup revision
          </button>
          <button onClick={() => window.dispatchEvent(new Event("online"))}>
            Trigger online refresh
          </button>
          <button onClick={() => fixture.corruptRecovery()}>
            Corrupt stored input
          </button>
        </div>
        <div className={controls.settings}>
          <label>
            Language
            <select
              value={state.language}
              onChange={(event) =>
                fixture.configure({
                  language: event.target.value as "bg" | "en",
                })
              }
            >
              <option value="en">English</option>
              <option value="bg">Български</option>
            </select>
          </label>
          <label>
            Read transport
            <select
              value={state.readMode}
              onChange={(event) =>
                fixture.configure({ readMode: event.target.value })
              }
            >
              <option value="automatic">Automatic synthetic success</option>
              <option value="deferred">Deferred — use request controls</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.long}
              onChange={(event) =>
                fixture.configure({ long: event.target.checked })
              }
            />
            Long synthetic facts
          </label>
          <label>
            <input
              type="checkbox"
              checked={!state.reviewAllowed}
              onChange={(event) =>
                fixture.configure({ reviewAllowed: !event.target.checked })
              }
            />
            Synthetic read-only operator
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.failSessionStorage}
              onChange={(event) =>
                fixture.configure({ failSessionStorage: event.target.checked })
              }
            />
            Fail sessionStorage (form recovery)
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.failLocalStorage}
              onChange={(event) =>
                fixture.configure({ failLocalStorage: event.target.checked })
              }
            />
            Fail localStorage (unrelated to this form)
          </label>
        </div>
        <details open>
          <summary>
            Deferred synthetic requests (
            {requests.filter((request) => !request.done).length} pending)
          </summary>
          <ol className={controls.requests}>
            {requests.map((request) => (
              <li key={request.id}>
                <strong>
                  #{request.id} {request.kind} —{" "}
                  {request.subject ?? "signed out"}
                  {request.done ? " — settled" : " — pending"}
                </strong>
                {!request.done && (
                  <div className={controls.buttons}>
                    <button
                      onClick={() => fixture.settle(request.id, "success")}
                    >
                      Resolve #{request.id} success
                    </button>
                    {request.kind === "read" && (
                      <button
                        onClick={() => fixture.settle(request.id, "stale")}
                      >
                        Resolve #{request.id} stale/read-only
                      </button>
                    )}
                    <button
                      onClick={() =>
                        fixture.settle(request.id, "NOT_AVAILABLE")
                      }
                    >
                      Resolve #{request.id} unavailable
                    </button>
                    <button
                      onClick={() => fixture.settle(request.id, "FORBIDDEN")}
                    >
                      Resolve #{request.id} revoked
                    </button>
                    {request.kind === "write" && (
                      <>
                        <button
                          onClick={() => fixture.settle(request.id, "CONFLICT")}
                        >
                          Resolve #{request.id} conflict
                        </button>
                        <button
                          onClick={() =>
                            fixture.settle(request.id, "committed-unconfirmed")
                          }
                        >
                          Commit #{request.id}, lose response
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        fixture.settle(request.id, "transport-failed")
                      }
                    >
                      Reject #{request.id} transport
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </details>
      </aside>
      <div data-rendered-component>
        <Workspace
          title={text.detail}
          language={state.language}
          back="/?fixture=declarations"
        >
          <DeclarationReviewForm
            key={state.binding + ":" + state.remount}
            initial={viewFor(state.binding)}
            language={state.language}
            actorSubject={state.binding}
            actorKey={actorKey(state.binding)}
          />
        </Workspace>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
