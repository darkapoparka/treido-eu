const top = { type: "scroll", y: 0 };
const click = (name) => ({ type: "click", role: "button", name, exact: true });
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const fillName = (value) => ({
  type: "fill",
  role: "textbox",
  name: "Collection name",
  value,
});
const viewport = (height) => ({ type: "viewport", width: 393, height });
const detail = "/saved?collection=source-favs";
const owner = "apps/web/src/features/discovery/saved.tsx";
const options = () => [click("Collection options")];
const scrolled = () => ({
  state: "private-collection-scrolled",
  actions: [{ type: "anchorSelector", selector: ".saved-grid", y: 95 }],
});
const library = () => ({
  state: "multi-brand-saved-library",
  entry: { startUrl: "/saved", scenario: "saved-library" },
  notes:
    "The frozen sequence jumps to a larger saved history. This explicit entry is not an invented consequence of creating a two-item collection. The lower pink tube photograph and uncaptured commerce fields remain unresolved; no app-owned pixels are masked.",
  actions: [heading("Saved"), top],
});
// The keyboard begins at normalized source y=545, or content y=486. Only that
// native iOS region is excluded. App-owned editor, toolbar, visibility controls,
// thumbnails, backdrop and the gap above the keyboard remain compared.
const keyboard = [
  {
    x: 0,
    y: 486,
    width: 393,
    height: 307,
    reason:
      "Native iOS text keyboard in this frame; no app-owned editor controls are excluded",
  },
];

export const savedRecipes = {
  7: {
    family: "saved",
    owner,
    startUrl: "/",
    scenario: "saved-empty",
    frames: [
      { state: "home-before-saved", actions: [top] },
      {
        state: "saved-empty",
        actions: [
          { type: "click", role: "link", name: "Saved", exact: true },
          heading("You haven’t saved any items yet"),
          top,
        ],
      },
      {
        state: "saved-two-items",
        entry: { startUrl: "/saved", scenario: "saved-pair" },
        notes:
          "Source shows a later saved history; its intervening product visits are not captured.",
        actions: [heading("Saved"), top],
      },
      library(),
    ],
  },
  8: {
    family: "saved-create",
    owner,
    startUrl: "/saved",
    scenario: "saved-pair",
    frames: [
      { state: "saved-before-creation", actions: [heading("Saved"), top] },
      {
        state: "collection-name-empty-focused",
        overlay: "dialog",
        masks: keyboard,
        actions: [click("Create collection"), viewport(486)],
      },
      {
        state: "collection-name-entered-focused",
        overlay: "dialog",
        masks: keyboard,
        actions: [fillName("Favs")],
      },
      {
        state: "add-saved-unselected",
        actions: [viewport(793), click("Save"), heading("Add from saved"), top],
      },
      {
        state: "add-saved-two-selected",
        actions: [
          click("Add Shea Butter Exfoliating Body Wash"),
          click("Add Rice Water Shampoo & Conditioner Combo"),
          top,
        ],
      },
      {
        state: "created-collection-with-collaboration-callout",
        actions: [click("Done"), heading("Favs"), top],
      },
      library(),
    ],
  },
  9: {
    family: "saved-collection",
    owner,
    startUrl: "/saved",
    scenario: "saved-library",
    frames: [
      { ...library(), entry: undefined },
      {
        state: "private-two-item-collection",
        entry: { startUrl: "/saved", scenario: "saved-collection" },
        notes:
          "The source detail returns to the earlier two-item collection, rather than the larger library cover's membership.",
        actions: [click("Private Favs"), heading("Favs"), top],
      },
      scrolled(),
    ],
  },
  10: {
    family: "saved-ideas",
    owner,
    startUrl: detail,
    scenario: "saved-collection",
    frames: [
      scrolled(),
      {
        state: "six-collection-recommendations",
        actions: [click("Find more ideas"), heading("More ideas"), top],
      },
    ],
  },
  11: {
    family: "saved-edit",
    owner,
    startUrl: detail,
    scenario: "saved-collection",
    frames: [
      scrolled(),
      {
        state: "expanded-collection-options",
        entry: { startUrl: detail, scenario: "saved-collection-expanded" },
        notes:
          "The captured options background has an additional Argan product and a dismissed collaboration callout; this is a separate entry, not an invented scroll effect.",
        overlay: "dialog",
        actions: [...options(), top],
      },
      {
        state: "edit-name-focused",
        overlay: "dialog",
        masks: keyboard,
        actions: [click("Edit name"), viewport(486)],
      },
      {
        state: "edit-name-with-emoji",
        overlay: "dialog",
        masks: keyboard,
        actions: [fillName("Favs💕")],
      },
      {
        state: "renamed-three-item-collection",
        actions: [viewport(793), click("Save"), heading("Favs💕"), top],
      },
    ],
  },
  12: {
    family: "saved-visibility",
    owner,
    startUrl: detail,
    scenario: "saved-collection-expanded",
    frames: [
      {
        state: "private-collection-options",
        overlay: "dialog",
        actions: [...options(), top],
      },
      {
        state: "make-public-confirmation",
        entry: { startUrl: detail, scenario: "saved-collection-edited" },
        notes:
          "The collection name changes between source frames. Local visibility is simulated; sharing/invitation actions expose the disconnected service boundary.",
        overlay: "dialog",
        actions: [...options(), click("Make collection public"), top],
      },
      {
        state: "public-collection-with-confirmation-toast",
        actions: [click("Make public"), heading("Favs💕"), top],
      },
    ],
  },
  13: {
    family: "saved-delete",
    owner,
    startUrl: detail,
    scenario: "saved-collection-expanded",
    frames: [
      {
        state: "collection-options-before-delete",
        overlay: "dialog",
        actions: [...options(), top],
      },
      {
        state: "delete-collection-confirmation",
        entry: { startUrl: detail, scenario: "saved-collection-deletion" },
        notes:
          "The source confirmation background has two items, unlike its preceding three-item options state. Preserve both observed histories explicitly.",
        overlay: "dialog",
        actions: [...options(), click("Delete collection"), top],
      },
      {
        state: "saved-items-retained-after-deletion",
        entry: { startUrl: detail, scenario: "saved-collection" },
        notes:
          "The final capture has the original Shea/Rice saved pair, not the Argan history. Replay real deletion from that captured pair; interaction tests separately require retaining every saved product when deleting expanded collections.",
        actions: [
          ...options(),
          click("Delete collection"),
          click("Delete"),
          heading("Saved"),
          top,
        ],
      },
    ],
  },
};
