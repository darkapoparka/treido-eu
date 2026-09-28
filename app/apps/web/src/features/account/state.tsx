"use client";
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
export type Address = {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  street: string;
  apartment: string;
  company: string;
  phone: string;
  city: string;
  region: string;
  postalCode: string;
  isDefault: boolean;
};
export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  birthday: string;
  shoeSize: string;
  shirtSize: string;
  pantsSize: string;
  skin: string;
  avatar: string;
};
export type Person = {
  id: string;
  avatar?: string;
  name: string;
  relation: string;
  birthday: string;
  gender: string;
};
export type ReferenceOrder = {
  id: string;
  productId: string;
  name: string;
  carrier: string;
  tracking: string;
  status: "Ordered" | "In transit" | "Delivered";
  // A real local status action takes precedence over captured URL variants,
  // including older detail entries reached through browser history.
  statusChangedLocally?: boolean;
  archived: boolean;
  rating: number;
  review: string;
};
const initialProfile: Profile = {
  firstName: "",
  lastName: "",
  email: "alexsmith.mobbin+3@gmail.com",
  phone: "",
  gender: "",
  birthday: "",
  shoeSize: "",
  shirtSize: "",
  pantsSize: "",
  skin: "",
  avatar: "",
};
const initialAddresses: Address[] = [
  {
    id: "address-source-alex",
    firstName: "Alex",
    lastName: "Smith",
    country: "United States",
    street: "1226 University Dr",
    apartment: "",
    company: "",
    phone: "+16502137552",
    city: "Menlo Park",
    region: "CA",
    postalCode: "94025",
    isDefault: true,
  },
  {
    id: "address-source-sam",
    firstName: "Sam",
    lastName: "Lee",
    country: "Singapore",
    street: "75 Ayer Rajah Crescent",
    apartment: "",
    company: "ASMOBBIN",
    phone: "",
    city: "Singapore",
    region: "SG",
    postalCode: "139953",
    isDefault: false,
  },
];
const initialOrders: ReferenceOrder[] = [
  {
    id: "REF-1001",
    productId: "shampoo-bag",
    name: "Shampoo Bar Bag",
    carrier: "Amazon Logistics",
    tracking: "TBA333200762603",
    status: "In transit",
    archived: false,
    rating: 0,
    review: "",
  },
  {
    id: "REF-1002",
    productId: "shea-butter",
    name: "Shea Butter Exfoliating Body Wash",
    carrier: "USPS",
    tracking: "REFERENCE-0200",
    status: "Delivered",
    archived: true,
    rating: 0,
    review: "",
  },
];
export type ReferencePaymentCard = {
  id: string;
  last4: string;
  expiry: string;
  billingAddressId?: string;
};
export type SupportConversation = {
  draft: string;
  attempt: string;
  phase: "idle" | "thinking" | "captured" | "unavailable";
  scrollTop: number;
  query: string;
};
const emptySupportConversation: SupportConversation = {
  draft: "",
  attempt: "",
  phase: "idle",
  scrollTop: 0,
  query: "",
};
type AccountState = {
  profile: Profile;
  updateProfile: (value: Partial<Profile>) => void;
  addresses: Address[];
  saveAddress: (value: Address) => void;
  deleteAddress: (id: string) => void;
  orders: ReferenceOrder[];
  saveOrder: (value: ReferenceOrder) => void;
  deleteOrder: (id: string) => void;
  deletedOrder: ReferenceOrder | null;
  restoreOrder: () => void;
  people: Person[];
  savePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  preferences: Record<string, string[]>;
  setPreferences: (value: Record<string, string[]>) => void;
  paymentCards: ReferencePaymentCard[];
  paymentAvailable: boolean;
  receiptPreferences: Record<string, boolean>;
  setReceiptPreference: (id: string, enabled: boolean) => void;
  hasPaymentProfile: boolean;
  savePayment: (value: ReferencePaymentCard) => void;
  removePayment: (id?: string) => void;
  notifications: Record<string, boolean>;
  toggleNotification: (name: string) => void;
  supportConversation: SupportConversation;
  setSupportConversation: Dispatch<SetStateAction<SupportConversation>>;
  reset: () => void;
};
export type AccountSeed = {
  guest?: boolean;
  hasPaymentProfile?: boolean;
  profile?: Partial<Profile>;
  addresses?: Address[];
  orders?: ReferenceOrder[];
  people?: Person[];
  preferences?: Record<string, string[]>;
  paymentCards?: ReferencePaymentCard[];
  notifications?: Record<string, boolean>;
};
const Context = createContext<AccountState | null>(null);
// Memory-only fixture state: no personal entries or payment fields are persisted.
export function AccountProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: AccountSeed;
}) {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    ...initial?.profile,
  }));
  const [addresses, setAddresses] = useState<Address[]>(
    () => initial?.addresses ?? initialAddresses,
  );
  const [orders, setOrders] = useState<ReferenceOrder[]>(
    () => initial?.orders ?? initialOrders,
  );
  const [deletedOrder, setDeletedOrder] = useState<ReferenceOrder | null>(null);
  const [people, setPeople] = useState<Person[]>(() => initial?.people ?? []);
  const [preferences, setPreferences] = useState<Record<string, string[]>>(
    () => initial?.preferences ?? {},
  );
  const [paymentCards, setPaymentCards] = useState(
    () =>
      initial?.paymentCards ?? [
        {
          id: "card-source-4263",
          last4: "4263",
          expiry: "\u2022\u2022/\u2022\u2022",
        },
      ],
  );
  const [hasPaymentProfile, setHasPaymentProfile] = useState(
    initial?.hasPaymentProfile ?? true,
  );
  const [receiptPreferences, setReceiptPreferences] = useState<
    Record<string, boolean>
  >({});
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    () => initial?.notifications ?? {},
  );
  const [supportConversation, setSupportConversation] =
    useState<SupportConversation>(emptySupportConversation);
  return (
    <Context
      value={{
        profile,
        updateProfile: (v) => setProfile((p) => ({ ...p, ...v })),
        addresses,
        saveAddress: (v) =>
          setAddresses((a) => [
            ...a
              .filter((x) => x.id !== v.id)
              .map((x) => (v.isDefault ? { ...x, isDefault: false } : x)),
            v,
          ]),
        deleteAddress: (id) =>
          setAddresses((a) => {
            const remaining = a.filter((x) => x.id !== id);
            return remaining.some((x) => x.isDefault)
              ? remaining
              : remaining.map((x, i) => ({ ...x, isDefault: i === 0 }));
          }),
        orders,
        saveOrder: (v) =>
          setOrders((a) => [...a.filter((x) => x.id !== v.id), v]),
        deletedOrder,
        deleteOrder: (id) => {
          const order = orders.find((value) => value.id === id);
          if (!order) return;
          setDeletedOrder(order);
          setOrders((current) => current.filter((value) => value.id !== id));
        },
        restoreOrder: () => {
          if (!deletedOrder) return;
          setOrders((current) => [
            ...current.filter((value) => value.id !== deletedOrder.id),
            deletedOrder,
          ]);
          setDeletedOrder(null);
        },
        people,
        savePerson: (person) =>
          setPeople((p) => [...p.filter((x) => x.id !== person.id), person]),
        deletePerson: (id) => setPeople((p) => p.filter((x) => x.id !== id)),
        preferences,
        setPreferences,
        paymentCards,
        paymentAvailable: paymentCards.length > 0,
        receiptPreferences,
        setReceiptPreference: (id, enabled) =>
          setReceiptPreferences((previous) => ({ ...previous, [id]: enabled })),
        hasPaymentProfile,
        savePayment: (value) => {
          setHasPaymentProfile(true);
          setPaymentCards((cards) => [
            ...cards.filter((card) => card.id !== value.id),
            value,
          ]);
        },
        removePayment: (id) =>
          setPaymentCards((cards) =>
            cards.filter((card) => card.id !== (id ?? cards[0]?.id)),
          ),
        notifications,
        toggleNotification: (name) =>
          setNotifications((n) => ({ ...n, [name]: !(n[name] ?? true) })),
        supportConversation,
        setSupportConversation,
        reset: () => {
          setHasPaymentProfile(!initial?.guest);
          setProfile(
            initial?.guest ? { ...initialProfile, email: "" } : initialProfile,
          );
          setAddresses(initial?.guest ? [] : initialAddresses);
          setOrders(initial?.guest ? [] : initialOrders);
          setPeople([]);
          setPreferences({});
          setPaymentCards(
            initial?.guest
              ? []
              : [
                  {
                    id: "card-source-4263",
                    last4: "4263",
                    expiry: "\u2022\u2022/\u2022\u2022",
                  },
                ],
          );
          setNotifications({});
          setReceiptPreferences({});
          setSupportConversation(emptySupportConversation);
        },
      }}
    >
      {children}
    </Context>
  );
}
export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountProvider missing");
  return value;
}
export const blankAddress = (): Address => ({
  id: crypto.randomUUID(),
  firstName: "",
  lastName: "",
  country: "United States",
  street: "",
  apartment: "",
  company: "",
  phone: "",
  city: "",
  region: "",
  postalCode: "",
  isDefault: false,
});
