"use client";
import { navigateAccountStage } from "./stage-history";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ProfileFooter } from "./profile-footer";
import { SourceLink } from "../discovery/return-navigation";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDiscovery } from "../discovery/state";
import { Icon } from "../discovery/icons";
import { AccountIcon } from "./icons";
import { Preferences } from "./preferences";
import { ProfileRecent } from "./profile-recent";
import { GuestProfile } from "./guest-profile";
import {
  ProfileAvatar,
  ProfileChoice,
  ProfilePhotoMenu,
} from "./profile-media";
import {
  compactProfileEmail,
  displayBirthday,
  profileTextPatch,
} from "./profile-model";
import type { Catalog } from "../catalog/types";
import { resolveSavedListing } from "../catalog/types";
import { CollectionEditor } from "../discovery/collection-editor";
import { Sheet, consumeSheetHistory } from "../discovery/components";
import {
  AccountPage,
  Row,
  Boundary,
  AddressEditor,
  PhoneEditor,
  PaymentEditor,
  DateFields,
  validBirthday,
} from "./forms";
import {
  useAccount,
  blankAddress,
  type Address,
  type Profile,
  type Person,
} from "./state";
export function ProfilePage({ catalog }: { catalog: Catalog }) {
  const {
    profile,
    paymentAvailable,
    paymentCards,
    hasPaymentProfile,
    orders,
    reset,
  } = useAccount();
  const discovery = useDiscovery();
  const [logout, setLogout] = useState(false);
  const activeOrders = orders.filter((order) => !order.archived);
  const hasOrders = orders.length > 0;
  const starterProfile =
    !profile.firstName &&
    !profile.lastName &&
    !profile.avatar &&
    !profile.phone;
  if (catalog.liveHomeStoreIds && !profile.email)
    return <GuestProfile catalog={catalog} />;
  return (
    <AccountPage
      dockFade
      className={`profile-overview ${starterProfile ? "starter-profile" : "active-profile"}`}
    >
      <SourceLink
        className="account-panel identity-row"
        href="/account"
        sourceKey="profile-identity"
      >
        <ProfileAvatar src={profile.avatar} name={profile.firstName} />
        <span>
          {starterProfile ? (
            <strong>{profile.email}</strong>
          ) : (
            <>
              <strong>{profile.firstName}</strong>
              <small>{profile.email}</small>
            </>
          )}
        </span>
        <b>›</b>
      </SourceLink>
      {starterProfile ? (
        <div className="account-panel checkout-faster-card">
          <strong>Check out faster</strong>
          <p>
            Enter and verify a phone number for faster checkout at millions of
            stores
          </p>
          <img
            className="checkout-faster-art"
            src="/api/reference-media/auth-phone"
            alt=""
          />
          <Link className="primary" href="/account?edit=phone">
            Add phone
          </Link>
        </div>
      ) : (
        <SourceLink
          className="account-panel passkey-row"
          href="/account/security"
        >
          <span className="profile-passkey-mark" aria-hidden="true">
            <AccountIcon name="passkey" />
          </span>
          <strong>
            Add a passkey for fast and secure sign-in on millions of stores
          </strong>
          <b>›</b>
        </SourceLink>
      )}
      <div className="profile-tiles">
        <SourceLink
          className="account-panel"
          href="/saved"
          sourceKey="profile-saved"
        >
          <div className="tile-images">
            {starterProfile ? (
              <span className="starter-saved-icon" aria-hidden="true">
                <Icon name="heart" />
              </span>
            ) : (
              catalog.products
                .filter((p) => discovery.saved.includes(p.id))
                .slice(0, 3)
                .map((p) => <img key={p.id} src={p.images[0]} alt="" />)
            )}
          </div>
          <strong>Saved</strong>
        </SourceLink>
        <SourceLink
          className="account-panel"
          href="/following"
          sourceKey="profile-following"
        >
          <div className="tile-images">
            {starterProfile ? (
              <span className="starter-following-logos" aria-hidden="true">
                <img src="/api/reference-media/kitsch-logo" alt="" />
                <img src="/api/reference-media/pura-logo" alt="" />
              </span>
            ) : (
              catalog.stores
                .filter((store) => discovery.followed.includes(store.id))
                .slice(0, 3)
                .map((store) =>
                  store.logo ? (
                    <img key={store.id} src={store.logo} alt="" />
                  ) : (
                    <span key={store.id} className="store-logo-fallback">
                      {store.name[0]}
                    </span>
                  ),
                )
            )}
          </div>
          <strong>Following</strong>
        </SourceLink>
      </div>
      <h2 className="profile-order-heading">
        {!hasOrders ? (
          "Order history"
        ) : (
          <SourceLink href="/orders/history" aria-label="Order history ›">
            Order history
            <span aria-hidden="true">
              <Icon name="back" />
            </span>
          </SourceLink>
        )}
      </h2>
      <div className="account-panel profile-order-panel">
        {!hasOrders ? (
          <div className="profile-empty-orders">
            <img
              className="profile-empty-package"
              src="/api/reference-media/profile-empty-package"
              alt=""
            />
            <span>
              <strong>No orders yet</strong>
              <small>
                Orders you place in Shop or sync from your emails will show up
                here
              </small>
            </span>
            <SourceLink className="pill" href="/account/connections">
              Connect accounts
            </SourceLink>
          </div>
        ) : (
          <>
            {activeOrders.slice(0, 2).map((order) => {
              const product = catalog.products.find(
                (p) => p.id === order.productId,
              );
              const seller = catalog.stores.find(
                (store) => store.id === product?.storeId,
              );
              return (
                <SourceLink
                  className="profile-order-row"
                  key={order.id}
                  href={`/orders/${order.id}`}
                >
                  <span className="profile-order-logo">
                    {seller?.logo ? (
                      <img src={seller.logo} alt="" />
                    ) : (
                      (seller?.name[0] ?? order.name[0])
                    )}
                  </span>
                  <span>
                    <strong>
                      {product ? (seller?.name ?? order.name) : order.name}
                    </strong>
                    <small>
                      {order.status === "In transit"
                        ? "On the way"
                        : order.status === "Ordered"
                          ? "Order placed"
                          : "Delivered"}
                    </small>
                  </span>
                  {!product ? (
                    <time>Jul 27</time>
                  ) : (
                    product && (
                      <img
                        className="profile-order-thumb"
                        src={product.images[0]}
                        alt=""
                      />
                    )
                  )}
                </SourceLink>
              );
            })}
            <EmailConnection />
          </>
        )}
      </div>
      {starterProfile ? (
        <h2 className="starter-family-heading">Family</h2>
      ) : (
        <>
          <ProfileRecent catalog={catalog} />
          {hasPaymentProfile && (
            <>
              <div className="profile-payment-heading">
                <h2>Payment methods</h2>
                <Link
                  className="pill"
                  href="/account/payments?view=add&return=profile"
                  scroll={false}
                >
                  Add card
                </Link>
              </div>
              {paymentAvailable && (
                <div
                  className={`payment-card-stack ${paymentCards.length > 1 ? "multiple" : ""}`}
                >
                  {paymentCards.map((card) => (
                    <Link
                      className="payment-card-button"
                      key={card.id}
                      href={`/account/payments?view=detail&id=${card.id}&return=profile`}
                      scroll={false}
                    >
                      <PaymentCard
                        last4={card.last4}
                        masked={card.id.startsWith("card-preview-")}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="account-panel profile-settings-panel">
            {hasPaymentProfile && (
              <Row label="Addresses" href="/account/addresses" />
            )}
            <Row label="Sign in & security" href="/account/security" />
            <Row label="Notifications" href="/account/notifications" />
            <Row label="Connections" href="/account/connections" />
            <Row label="Data & privacy" href="/account/privacy" />
            <Row label="Support" href="/support" />
          </div>
          <button
            className="form-cancel profile-signout"
            onClick={() => setLogout(true)}
          >
            <AccountIcon name="logout" /> Sign out
          </button>
          <ProfileFooter />
        </>
      )}
      <Sheet
        open={logout}
        title="Sign out?"
        className="signout-confirm"
        onClose={() => setLogout(false)}
      >
        <p className="form-note">
          You’ll have to enter your email to access your delivery information
          again.
        </p>
        <div className="editor-actions">
          <button className="form-cancel" onClick={() => setLogout(false)}>
            Cancel
          </button>
          <Link
            href="/onboarding?step=signout"
            onClick={reset}
            className="danger-button form-submit"
          >
            Sign out
          </Link>
        </div>
      </Sheet>
    </AccountPage>
  );
}
export function EmailConnection() {
  const [dismissed, setDismissed] = useState(false);
  return (
    !dismissed && (
      <div className="email-connect">
        <strong>Connect email to see more deliveries</strong>
        <p>Track more of your packages with Shop</p>
        <div>
          <button className="pill" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
          <SourceLink className="black-button" href="/account/connections">
            Connect
          </SourceLink>
        </div>
      </div>
    )
  );
}
export function AccountDetails() {
  const { profile, updateProfile, people } = useAccount();
  const requestedEdit = useSearchParams().get("edit");
  const [field, setField] = useState<keyof Profile | null>(() =>
    requestedEdit === "phone" ? "phone" : null,
  );
  const [draft, setDraft] = useState(profile);
  const editingName = field === "firstName" || field === "lastName";
  const [draftError, setDraftError] = useState("");
  const [photo, setPhoto] = useState(false);
  const [phoneStage, setPhoneStage] = useState<"phone" | "code">("phone");
  const [phoneSession, setPhoneSession] = useState(0);
  const contactFields = useRef<HTMLDivElement>(null);
  const pendingFieldReturn = useRef<keyof Profile | null>(null);
  useLayoutEffect(() => {
    if (field === "birthday") {
      contactFields.current
        ?.querySelector<HTMLInputElement>(
          '[data-account-field="birthday"] input',
        )
        ?.focus({ preventScroll: true });
    } else if (field === null && pendingFieldReturn.current) {
      contactFields.current
        ?.querySelector<HTMLButtonElement>(
          `[data-account-field="${pendingFieldReturn.current}"] > button`,
        )
        ?.focus({ preventScroll: true });
      pendingFieldReturn.current = null;
    }
  }, [field]);
  const fields = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["gender", "Gender"],
    ["birthday", "Birthday"],
  ] as const;
  const edit = (key: keyof Profile) => {
    if (key === "phone") {
      setPhoneStage("phone");
      setPhoneSession((session) => session + 1);
    }
    setField(key);
  };
  return (
    <AccountPage
      className="profile-editor"
      dockFade
      action={
        field && field !== "phone" && field !== "gender" ? (
          <button
            className="profile-save"
            onClick={() => {
              if (field === "birthday" && !validBirthday(draft.birthday)) {
                setDraftError(
                  "Enter a valid birthday that is not in the future.",
                );
                return;
              }
              setDraftError("");
              if (field === "firstName" || field === "lastName") {
                updateProfile(profileTextPatch(draft));
              } else if (field === "birthday") {
                updateProfile({ birthday: draft.birthday });
              }
              pendingFieldReturn.current = field;
              setField(null);
            }}
          >
            Save
          </button>
        ) : undefined
      }
    >
      <div className="account-avatar">
        <ProfileAvatar
          src={profile.avatar}
          name={draft.firstName || draft.lastName}
          large
        />
        <button
          className="avatar-edit"
          aria-label="Edit profile picture"
          onClick={() => setPhoto(true)}
        >
          <Icon name="edit" />
        </button>
        <SourceLink className="pill" href="/account/public">
          View public profile
        </SourceLink>
      </div>
      <div
        ref={contactFields}
        className="account-panel field-panel profile-contact-fields"
      >
        {fields.map(([key, label]) => (
          <div className="profile-field" data-account-field={key} key={key}>
            <span>{label}</span>
            {((editingName && (key === "firstName" || key === "lastName")) ||
              field === key) &&
            key !== "phone" ? (
              key === "gender" ? (
                <button type="button" onClick={() => setField("gender")}>
                  {draft.gender || "Select gender"}
                </button>
              ) : key === "birthday" ? (
                <DateFields
                  value={draft.birthday}
                  onChange={(birthday) => setDraft({ ...draft, birthday })}
                />
              ) : (
                <input
                  autoFocus={field === key}
                  aria-label={label}
                  type="text"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              )
            ) : (
              <button
                className={!draft[key] ? "profile-placeholder" : undefined}
                disabled={key === "email"}
                onClick={() => edit(key)}
              >
                {(key === "email"
                  ? compactProfileEmail(draft.email)
                  : key === "birthday" &&
                      validBirthday(draft.birthday) &&
                      draft.birthday
                    ? displayBirthday(draft.birthday)
                    : draft[key]) ||
                  (key === "gender"
                    ? "Select gender"
                    : key === "birthday"
                      ? "MM/DD/YYYY"
                      : key === "firstName" || key === "lastName"
                        ? label
                        : `Add ${label.toLowerCase()}`)}
              </button>
            )}
            {key === "email" ? (
              <Icon name="lock" />
            ) : key === "phone" ? (
              <span aria-hidden="true">›</span>
            ) : key === "gender" ? (
              <svg
                data-select-arrows
                aria-hidden="true"
                viewBox="0 0 12 14"
                fill="none"
                stroke="currentColor"
              >
                <path d="m3 5 3-3 3 3M3 9l3 3 3-3" />
              </svg>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      {draftError && (
        <p className="form-error" role="alert">
          {draftError}
        </p>
      )}
      <Preferences />
      <div className="account-panel people-preview">
        <h2>Others you shop for</h2>
        {people.map((p) => (
          <SourceLink
            className="person-chip"
            href={`/account/people?view=profile&id=${p.id}&return=account`}
            key={p.id}
            sourceKey={`account-person-${p.id}`}
          >
            <ProfileAvatar src={p.avatar} name={p.name} initial />
            {p.name}
          </SourceLink>
        ))}
        <SourceLink
          className="add-person-tile"
          href="/account/people?view=nickname&new=1&return=account"
          scroll={false}
          sourceKey="account-add-person"
        >
          <span>+</span>
          {people.length ? "Add someone new" : "Add someone"}
        </SourceLink>
      </div>
      <Sheet
        open={field === "phone"}
        title={phoneStage === "code" ? "Confirm it’s you" : "Add phone number"}
        onClose={() => setField(null)}
      >
        <PhoneEditor
          key={phoneSession}
          initialPhone={profile.phone}
          controlledStage={phoneStage}
          onStageChange={setPhoneStage}
          onDone={(phone) => {
            updateProfile({ phone });
            setDraft((current) => ({ ...current, phone }));
            setPhoneStage("phone");
            setField(null);
          }}
        />
      </Sheet>
      <ProfileChoice
        open={field === "gender"}
        title="Select gender"
        top={259}
        value={draft.gender}
        options={[
          { value: "", label: "Select gender" },
          { value: "Female", label: "Female" },
          { value: "Male", label: "Male" },
          { value: "Other", label: "Other" },
        ]}
        onSelect={(gender) => {
          setDraft({ ...draft, gender });
          updateProfile({ gender });
        }}
        onClose={() => setField(null)}
      />
      <ProfilePhotoMenu
        open={photo}
        onClose={() => setPhoto(false)}
        onSelect={(avatar) => updateProfile({ avatar })}
      />
    </AccountPage>
  );
}
export function PublicProfile({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const { profile } = useAccount();
  const { collections, createCollection, updateCollection } = useDiscovery();
  const publicCollections = collections.filter(
    (c) => c.visibility === "Public",
  );
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [visibility, setVisibility] = useState<"Private" | "Public">("Public");
  const submitting = useRef(false);
  const [sharing, setSharing] = useState(false);
  return (
    <AccountPage className="public-profile-page">
      {!!publicCollections.length && (
        <button
          className="icon-button public-profile-share"
          aria-label="Share profile"
          onClick={() => setSharing(true)}
        >
          <Icon name="share" />
        </button>
      )}
      <div className="public-profile">
        <ProfileAvatar src={profile.avatar} name={profile.firstName} large />
        {!!publicCollections.length && <h1>{profile.firstName}</h1>}
        <SourceLink
          className="pill"
          href="/account"
          sourceKey="public-edit-profile"
        >
          Edit profile
        </SourceLink>
        {!publicCollections.length && (
          <div className="public-hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
            >
              <path d="m3 3 18 18M9 5c6-1 10 4 12 7l-3 4M6 6l-5 6c4 6 8 9 15 6M9 9l6 6" />
            </svg>
            <p>
              Your profile is hidden until you create your first public
              collection.
            </p>
            <button
              className="primary"
              onClick={() => {
                setName("");
                setVisibility("Public");
                submitting.current = false;
                setCreating(true);
              }}
            >
              Create public collection
            </button>
            <SourceLink href="/support/help">Learn more</SourceLink>
          </div>
        )}
      </div>
      <div className="public-collections">
        {publicCollections.map((c) => (
          <SourceLink
            className="account-panel"
            href={`/saved?collection=${c.id}`}
            key={c.id}
            sourceKey={`public-collection-${c.id}`}
          >
            <div className="collection-cover">
              {c.productIds.slice(0, 4).map((id) => {
                const product = resolveSavedListing(catalog, id);
                return product ? (
                  <img key={id} src={product.images[0]} alt="" />
                ) : null;
              })}
            </div>
            <strong>{c.name}</strong>
          </SourceLink>
        ))}
      </div>
      <Boundary
        open={sharing}
        onClose={() => setSharing(false)}
        kind="Public profile sharing"
      />
      <Sheet
        open={creating}
        title="Create collection"
        headerless
        initialFocus=".collection-name-input"
        className="saved-sheet collection-editor"
        onClose={() => setCreating(false)}
      >
        <CollectionEditor
          name={name}
          visibility={visibility}
          onNameChange={setName}
          onVisibilityChange={setVisibility}
          onCancel={() => setCreating(false)}
          onSave={() => {
            if (!name.trim() || submitting.current) return;
            submitting.current = true;
            const id = createCollection(name.trim());
            updateCollection(id, { visibility });
            consumeSheetHistory();
            setCreating(false);
            router.replace(`/saved?collection=${id}&view=add`);
          }}
        />
      </Sheet>
    </AccountPage>
  );
}
export function PeoplePage() {
  const { people, savePerson, deletePerson } = useAccount();
  const route = useAccountStage();
  const params = useSearchParams();
  const returnToAccount = params.get("return") === "account";
  const [person, setPerson] = useState<Person | null>(() => {
    const existing = people.find((p) => p.id === route.id);
    if (existing) return existing;
    if (route.view === "nickname" && params.get("new") === "1") {
      return {
        id: crypto.randomUUID(),
        name: "",
        relation: "",
        birthday: "",
        gender: "",
      };
    }
    return null;
  });
  const stage = ["profile", "nickname", "birthday"].includes(route.view ?? "")
    ? route.view
    : "list";
  const [personPhoto, setPersonPhoto] = useState(false);
  const editingPerson = stage === "nickname" || stage === "birthday";
  const showAccountBackground = returnToAccount && editingPerson;
  const wasEditingPerson = useRef(editingPerson);
  const profileNickname = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const enteringProfile = wasEditingPerson.current && stage === "profile";
    wasEditingPerson.current = editingPerson;
    if (!enteringProfile) return;
    // Completion replaces the sheet's opener. After it restores/unlocks the
    // document, position and focus the new profile rather than its dock.
    // Closing the profile's own menus must keep their existing return owner.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      profileNickname.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingPerson, stage]);
  const [personChoice, setPersonChoice] = useState<
    "relation" | "gender" | null
  >(null);
  const setStage = (next: "list" | "nickname" | "birthday" | "profile") => {
    if (next === "list") {
      if (returnToAccount) route.exit();
      else route.back();
    } else {
      consumeSheetHistory();
      if (returnToAccount) route.replace(next, person?.id);
      else route.go(next, person?.id);
    }
  };
  const [birthdayError, setBirthdayError] = useState("");
  const relations = [
    "Partner",
    "Child",
    "Friend",
    "Parent",
    "Sibling",
    "Other",
  ];
  const save = (skipBirthday = false) => {
    if (person) {
      const next = { ...person, birthday: skipBirthday ? "" : person.birthday };
      if (!validBirthday(next.birthday)) {
        setBirthdayError("Enter a valid birthday that is not in the future.");
        return;
      }
      setBirthdayError("");
      setPerson(next);
      savePerson(next);
      setStage("profile");
    }
  };

  const personPage = (
    <AccountPage
      className={stage === "profile" ? "person-profile-page" : ""}
      onBack={stage !== "list" ? () => setStage("list") : undefined}
      title={stage === "profile" ? undefined : "Others you shop for"}
    >
      {stage === "profile" && person ? (
        <>
          <div className="person-profile">
            <div className="person-avatar-wrap">
              <ProfileAvatar
                src={person.avatar}
                name={person.name}
                large
                initial
              />
              <button
                type="button"
                className="avatar-edit"
                aria-label="Edit person profile picture"
                onClick={() => setPersonPhoto(true)}
              >
                <Icon name="edit" />
              </button>
            </div>
            <input
              ref={profileNickname}
              aria-label="Nickname"
              value={person.name}
              onChange={(e) => {
                const next = { ...person, name: e.target.value };
                setPerson(next);
                savePerson(next);
              }}
            />
          </div>
          <div className="account-panel field-panel person-core-fields">
            <button
              className="profile-field"
              onClick={() => setPersonChoice("relation")}
            >
              <span>Relation</span>
              <span>{person.relation || "Select relation"}</span>
              <svg
                data-select-arrows
                aria-hidden="true"
                viewBox="0 0 12 14"
                fill="none"
                stroke="currentColor"
              >
                <path d="m3 5 3-3 3 3M3 9l3 3 3-3" />
              </svg>
            </button>
            <button
              className="profile-field"
              onClick={() => setPersonChoice("gender")}
            >
              <span>Gender</span>
              <span
                className={!person.gender ? "profile-placeholder" : undefined}
              >
                {person.gender || "Select gender"}
              </span>
              <svg
                data-select-arrows
                aria-hidden="true"
                viewBox="0 0 12 14"
                fill="none"
                stroke="currentColor"
              >
                <path d="m3 5 3-3 3 3M3 9l3 3 3-3" />
              </svg>
            </button>
            <div className="profile-field person-birthday-row">
              <span>Birthday</span>
              <span
                className={!person.birthday ? "profile-placeholder" : undefined}
              >
                {person.birthday
                  ? displayBirthday(person.birthday)
                  : "MM/DD/YYYY"}
              </span>
              <span aria-hidden="true" />
            </div>
          </div>
          {birthdayError && (
            <p className="form-error" role="alert">
              {birthdayError}
            </p>
          )}
          <Preferences personId={person.id} />
          <button
            className="danger-text form-submit"
            onClick={() => {
              deletePerson(person.id);
              setStage("list");
            }}
          >
            <Icon name="trash" /> Delete {person.name}
          </button>
        </>
      ) : (
        <div className="account-panel">
          {people.map((p) => (
            <button
              className="account-row"
              key={p.id}
              onClick={() => {
                setPerson(p);
                route.go("profile", p.id);
              }}
            >
              <ProfileAvatar name={p.name} initial />
              <strong>{p.name}</strong>
              <span>›</span>
            </button>
          ))}
          <button
            className="account-row"
            onClick={() => {
              setPerson({
                id: crypto.randomUUID(),
                name: "",
                relation: "",
                birthday: "",
                gender: "",
              });
              setStage("nickname");
            }}
          >
            + Add someone new
          </button>
        </div>
      )}
      {person && (
        <>
          <ProfilePhotoMenu
            open={personPhoto}
            onClose={() => setPersonPhoto(false)}
            onSelect={(avatar) => {
              const next = { ...person, avatar };
              setPerson(next);
              savePerson(next);
            }}
          />
          <ProfileChoice
            open={personChoice === "relation"}
            title="Select relation"
            top={304}
            value={person.relation}
            options={relations.map((value) => ({ value, label: value }))}
            onSelect={(relation) => {
              const next = { ...person, relation };
              setPerson(next);
              savePerson(next);
            }}
            onClose={() => setPersonChoice(null)}
          />
          <ProfileChoice
            open={personChoice === "gender"}
            title="Select gender"
            top={356}
            value={person.gender}
            options={[
              { value: "", label: "Select gender" },
              { value: "Female", label: "Female" },
              { value: "Male", label: "Male" },
              { value: "Other", label: "Other" },
            ]}
            onSelect={(gender) => {
              const next = { ...person, gender };
              setPerson(next);
              savePerson(next);
            }}
            onClose={() => setPersonChoice(null)}
          />
        </>
      )}
    </AccountPage>
  );

  return (
    <>
      {showAccountBackground ? <AccountDetails /> : personPage}
      <Sheet
        open={editingPerson}
        manageHistory={false}
        headerless={stage === "nickname"}
        className={`person-editor-sheet person-editor-${stage}`}
        initialFocus={
          stage === "nickname" ? ".nickname-input" : '[aria-label="Month"]'
        }
        title={
          stage === "birthday"
            ? `Add ${person?.name ?? ""}'s birthday`
            : "Add a nickname"
        }
        onClose={() => setStage("list")}
      >
        {person && (
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (stage === "nickname") setStage("birthday");
              else save();
            }}
          >
            {stage === "nickname" ? (
              <>
                <input
                  className="nickname-input"
                  aria-label="Nickname"
                  placeholder="Add a nickname"
                  required
                  value={person.name}
                  onChange={(e) =>
                    setPerson({ ...person, name: e.target.value })
                  }
                />
                <div className="relationship-chips">
                  {relations.map((r) => (
                    <button
                      type="button"
                      className={person.relation === r ? "selected" : ""}
                      aria-pressed={person.relation === r}
                      key={r}
                      onClick={() => setPerson({ ...person, relation: r })}
                    >
                      <span className="account-control-text">{r}</span>
                    </button>
                  ))}
                </div>
                <p className="form-note">
                  Shop will remember sizing and other preferences when you
                  mention their name.
                </p>
              </>
            ) : (
              <div className="person-birthday-editor">
                <DateFields
                  value={person.birthday}
                  onChange={(birthday) => setPerson({ ...person, birthday })}
                />
              </div>
            )}
            {birthdayError && (
              <p role="alert" className="form-error">
                {birthdayError}
              </p>
            )}
            <div className="editor-actions">
              <button
                type="button"
                className="form-cancel"
                onClick={() =>
                  stage === "birthday" ? save(true) : setStage("list")
                }
              >
                <span className="account-control-text">
                  {stage === "birthday" ? "Skip" : "Cancel"}
                </span>
              </button>
              <button
                className="primary form-submit"
                disabled={
                  !person.name.trim() ||
                  (stage === "birthday" &&
                    (!person.birthday || !validBirthday(person.birthday)))
                }
              >
                <span className="account-control-text">Save</span>
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
export function AddressesPage() {
  const { addresses, saveAddress, deleteAddress } = useAccount();
  const route = useAccountStage();
  const [addressDraft, setAddressDraft] = useState<Address>(
    () => addresses.find((a) => a.id === route.id) ?? blankAddress(),
  );
  const editing = route.view === "edit" ? addressDraft : null;
  const setEditing = (next: Address | null) => {
    if (next) {
      setAddressDraft(next);
      route.go("edit", next.id);
    } else route.back();
  };
  const [deleting, setDeleting] = useState(false);
  return (
    <AccountPage
      className={editing ? "address-detail-page" : "addresses-overview"}
      title={editing ? "Shipping address" : "Manage addresses"}
      onBack={editing ? () => setEditing(null) : undefined}
      action={
        editing && addresses.some((address) => address.id === editing.id) ? (
          <button
            className="address-delete-action"
            aria-label="Delete address"
            onClick={() => setDeleting(true)}
          >
            <Icon name="trash" />
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <AddressEditor
          key={editing.id}
          initialValue={editing}
          onChange={setAddressDraft}
          onSave={(v) => {
            saveAddress(v);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="address-list">
            {addresses.map((a) => (
              <button key={a.id} onClick={() => setEditing(a)}>
                <span>
                  <strong>
                    {a.firstName} {a.lastName}
                  </strong>
                  <span>{a.street}</span>
                  <span>
                    {a.country === "United States"
                      ? `${a.city}, ${a.region}, US`
                      : a.country === "Singapore"
                        ? `${a.city}, ${a.region}`
                        : `${a.city}, ${a.region}, ${a.country}`}
                  </span>
                </span>
                {a.isDefault && <small>Default</small>}
                <b>›</b>
              </button>
            ))}
          </div>
          <p className="address-help">
            Your default address determines the currency and products you see in
            the app
          </p>
          <div className="account-bottom-action">
            <button
              className="primary"
              onClick={() => setEditing(blankAddress())}
            >
              Add address
            </button>
          </div>
        </>
      )}
      <Sheet
        open={deleting}
        title="Delete address"
        className="delete-address-confirm"
        onClose={() => setDeleting(false)}
      >
        <p>
          Are you sure you want to remove this address from your Shop Pay
          account?
        </p>
        <div className="editor-actions">
          <button className="form-cancel" onClick={() => setDeleting(false)}>
            Cancel
          </button>
          <button
            className="danger-button form-submit"
            onClick={() => {
              if (editing) deleteAddress(editing.id);
              consumeSheetHistory();
              setDeleting(false);
              route.overview();
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>
    </AccountPage>
  );
}
export function PaymentsPage() {
  const route = useAccountStage();
  const router = useRouter();
  const returnToProfile = useSearchParams().get("return") === "profile";
  const {
    paymentAvailable,
    removePayment,
    addresses,
    paymentCards,
    receiptPreferences: receipts,
    setReceiptPreference,
  } = useAccount();
  const [cardId, setCardId] = useState(() => paymentCards[0]?.id ?? "");
  const card = paymentCards.find((c) => c.id === (route.id ?? cardId));
  const billing = card?.billingAddressId
    ? addresses.find((address) => address.id === card.billingAddressId)
    : (addresses.find((address) => address.isDefault) ?? addresses[0]);
  const view =
    route.view === "detail" || route.view === "add" ? route.view : "list";
  const finish = () =>
    returnToProfile
      ? router.replace("/profile", { scroll: false })
      : route.overview();
  const backFromSubpage = () =>
    returnToProfile
      ? router.replace("/profile", { scroll: false })
      : route.back();
  const setView = (next: "list" | "detail" | "add") =>
    next === "list" ? backFromSubpage() : route.go(next, cardId);
  const [remove, setRemove] = useState(false);
  return (
    <AccountPage
      className={`${
        view === "list"
          ? "payment-overview"
          : view === "add"
            ? "payment-detail-page payment-add-page"
            : "payment-detail-page payment-card-detail-page"
      } ${remove ? "delete-confirm-open" : ""}`}
      onBack={view !== "list" ? backFromSubpage : undefined}
      dockFade={view === "add"}
      title={
        view === "add"
          ? "Add card"
          : view === "detail"
            ? `Visa •••• ${card?.last4 ?? ""}`
            : "Payment methods"
      }
    >
      {view === "list" && (
        <button className="payment-add-action" onClick={() => setView("add")}>
          Add card
        </button>
      )}
      {view === "add" ? (
        <>
          <PaymentEditor onSaved={finish} />
        </>
      ) : (
        <>
          {paymentAvailable && view === "list" && (
            <div
              className={`payment-card-stack ${paymentCards.length > 1 ? "multiple" : ""}`}
            >
              {paymentCards.map((c) => (
                <button
                  className="payment-card-button"
                  key={c.id}
                  onClick={() => {
                    setCardId(c.id);
                    route.go("detail", c.id);
                  }}
                >
                  <PaymentCard
                    last4={c.last4}
                    masked={c.id.startsWith("card-preview-")}
                  />
                </button>
              ))}
            </div>
          )}
          {view === "detail" && card ? (
            <>
              <PaymentCard last4={card?.last4} />
              <h2>Card details</h2>
              <div className="account-row">
                <span>Expiry date</span>
                <strong>{card?.expiry}</strong>
              </div>
              <div className="billing-details">
                <h3>Billing address</h3>
                {billing ? (
                  <p>
                    {billing.firstName} {billing.lastName}
                    <br />
                    {billing.street}
                    <br />
                    {billing.city},{" "}
                    {billing.region === "CA" ? "California" : billing.region}{" "}
                    {billing.postalCode}
                    <br />
                    {billing.country}
                    {billing.phone && (
                      <>
                        <br />
                        {billing.phone}
                      </>
                    )}
                  </p>
                ) : (
                  <Link href="/account/addresses">Add billing address</Link>
                )}
              </div>
              <label className="account-row">
                <span>
                  In-store receipts
                  <small>
                    Get receipts in the Shop app when shopping in store using
                    this card.
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={receipts[card?.id ?? ""] ?? true}
                  onChange={(e) =>
                    setReceiptPreference(card.id, e.target.checked)
                  }
                />
              </label>
              <button
                className="danger-text form-cancel"
                onClick={() => setRemove(true)}
              >
                Delete
              </button>
            </>
          ) : null}
        </>
      )}
      <Sheet
        open={remove}
        title="Are you sure you want to delete this card?"
        className="delete-card-confirm"
        onClose={() => setRemove(false)}
      >
        <p>This card will be removed from your Shop account.</p>
        <div className="editor-actions">
          <button className="form-cancel" onClick={() => setRemove(false)}>
            Cancel
          </button>
          <button
            className="danger-button form-submit"
            onClick={() => {
              if (!card) return;
              removePayment(card.id);
              consumeSheetHistory();
              setRemove(false);
              finish();
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>
    </AccountPage>
  );
}
export function SecurityPage() {
  const { profile } = useAccount();
  const [open, setOpen] = useState(false);
  const route = useAccountStage();
  const account = route.view === "login";
  const setAccount = (next: boolean) =>
    next ? route.go("login") : route.back();
  const [signout, setSignout] = useState(false);
  return (
    <AccountPage
      className={`account-settings-page ${account ? "account-login-page" : "account-security-page"}`}
      title={account ? "Account & login" : "Sign in & security"}
      onBack={account ? () => setAccount(false) : undefined}
    >
      {account ? (
        <div className="account-panel">
          <div className="security-email">
            <small>Email</small>
            <strong>{profile.email}</strong>
          </div>
          <Link className="security-detail-row" href="/account?edit=phone">
            <span>
              <small>Phone</small>
              <strong>{profile.phone || "Add phone"}</strong>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          <SourceLink
            className="security-detail-row"
            href="/account"
            sourceKey="security-profile-name"
          >
            <span>
              <small>Name</small>
              <strong>
                {profile.firstName} {profile.lastName}
              </strong>
            </span>
            <span aria-hidden="true">›</span>
          </SourceLink>
        </div>
      ) : (
        <>
          <div className="account-panel">
            <h3>How you sign in</h3>
            <button className="account-row" onClick={() => setAccount(true)}>
              <span>Text me a code</span>
              <small>{profile.phone || "+1 (650) 213-7552"}</small>
            </button>
            <button className="account-row" onClick={() => setAccount(true)}>
              <span>Email me a code</span>
              <small>{profile.email}</small>
            </button>
          </div>
          <div className="account-panel passkey-panel">
            <h3>Sign in faster with a passkey</h3>
            <p>
              <AccountIcon name="bolt" />
              Fast and secure sign-in on millions of stores
            </p>
            <p>
              <AccountIcon name="cloud" />
              Syncs seamlessly on compatible devices
            </p>
            <button className="form-cancel" onClick={() => setOpen(true)}>
              <AccountIcon name="passkey" /> Add passkey
            </button>
          </div>
          <button
            className="danger-text form-submit"
            onClick={() => setSignout(true)}
          >
            <AccountIcon name="logout" /> Sign out of all devices
          </button>
        </>
      )}
      <Boundary open={open} onClose={() => setOpen(false)} kind="Passkey" />
      <Boundary
        open={signout}
        onClose={() => setSignout(false)}
        kind="Sign out of all devices"
      />
    </AccountPage>
  );
}
const notificationOptions = [
  [
    "Order tracking",
    "Stay updated on your order’s journey from shipment to delivery, including delays and exceptions",
  ],
  [
    "Account connections",
    "Notifications to ensure your accounts stay connected",
  ],
  ["Shop Pay", "Get notified about new orders and refunds"],
  [
    "Installments",
    "Notifications for upcoming payments, successful transactions, and payment issues",
  ],
  ["Price drop", "Know when your saved items drop in price"],
  ["Back in stock", "Know when your saved items are back in stock"],
  [
    "Collection activity",
    "Get notified when updates are made to a collection you own or collaborate on",
  ],
];
export function NotificationSettings() {
  const { notifications, toggleNotification } = useAccount();
  return (
    <AccountPage
      title="Notifications"
      dockFade
      className="account-settings-page notification-settings-page"
    >
      {notificationOptions.map(([title, copy]) => (
        <label className="notification-setting" key={title}>
          <span>
            {title}
            <small>{copy}</small>
          </span>
          <input
            role="switch"
            type="checkbox"
            checked={notifications[title] ?? true}
            onChange={() => toggleNotification(title)}
          />
        </label>
      ))}
    </AccountPage>
  );
}
export { ConnectionsPage, DeleteAccount } from "./privacy";
function PaymentCard({
  last4 = "4242",
  masked = false,
}: {
  last4?: string;
  masked?: boolean;
}) {
  return (
    <div className={`source-payment-card ${masked ? "masked-last4" : ""}`}>
      <div>
        <b>VISA</b>
        <span>•••• {last4}</span>
      </div>
      <strong>VISA</strong>
    </div>
  );
}

function useAccountStage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const entered = useRef(false);
  const go = (view: string, id?: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("view", view);
    if (id) query.set("id", id);
    entered.current = true;
    navigateAccountStage(`${pathname}?${query}`);
  };
  const replace = (view: string, id?: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("view", view);
    query.delete("new");
    if (id) query.set("id", id);
    navigateAccountStage(`${pathname}?${query}`, true);
  };
  const back = () => {
    if (entered.current) {
      entered.current = false;
      router.back();
    } else navigateAccountStage(pathname, true);
  };
  return {
    view: params.get("view"),
    id: params.get("id"),
    go,
    replace,
    exit: () => router.back(),
    back,
    overview: () => navigateAccountStage(pathname, true),
  };
}
