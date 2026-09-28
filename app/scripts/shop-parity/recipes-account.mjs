const click = (role, name) => ({
  type: "click",
  role,
  name,
  exact: typeof name === "string",
});
const fill = (name, value) => ({
  type: "fill",
  role: "textbox",
  name,
  value,
  exact: true,
});
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const top = { type: "scroll", y: 0 };
const anchor = (selector, y) => ({ type: "anchorSelector", selector, y });
const entry = (scenario, startUrl = "/account") => ({ scenario, startUrl });
const state = (name, actions = [], initial) => ({
  state: name,
  actions,
  ...(initial ? { entry: initial } : {}),
});
const keyboard = { type: "viewport", width: 393, height: 485 };
const keyboardMask = [{ x: 0, y: 485, width: 393, height: 308 }];
const birthday = [fill("Month", "02"), fill("Day", "18"), fill("Year", "1995")];
const emailIdentity = click("link", /alexsmith\.mobbin\+3@gmail\.com/);
const save = click("button", "Save");
const back = click("button", "Go back");

// Entry checkpoints are explicit where the capture omits earlier profile edits.
// Every subsequent click/edit uses the ordinary feature's state owner.
export const accountRecipes = {
  69: {
    family: "account-profile",
    startUrl: "/",
    scenario: "home-welcome",
    frames: [
      state("home-kitsch-before-profile", [anchor(".campaign-kitsch", 56)]),
      state("starter-profile", [
        click("link", "Profile"),
        { type: "waitUrl", url: "**/profile" },
        top,
      ]),
      state(
        "complete-profile-overview",
        [top],
        entry("profile-complete", "/profile"),
      ),
      state(
        "recent-products-before-wallet",
        [anchor(".profile-recent-heading", 22)],
        entry("profile-before-payment", "/profile"),
      ),
      state(
        "recent-minis-and-wallet",
        [anchor(".profile-recent-heading", 22)],
        entry("profile-minis", "/profile"),
      ),
      state("profile-payment-methods", [
        anchor(".profile-payment-heading h2", 27),
      ]),
      state("profile-signout-footer", [anchor(".profile-settings-panel", 102)]),
    ],
  },
  70: {
    family: "account-profile",
    startUrl: "/profile",
    scenario: "home-welcome",
    frames: [
      state("starter-profile", [top]),
      state("account-empty", [
        emailIdentity,
        { type: "waitUrl", url: "**/account" },
        top,
      ]),
    ],
  },
  71: {
    family: "account-profile",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state("profile-photo-menu", [click("button", "Edit profile picture")]),
      state(
        "profile-photo-selected",
        [
          click("button", "Edit profile picture"),
          {
            type: "uploadAsset",
            label: "Choose profile photo",
            key: "auth-reference-avatar",
          },
          {
            type: "waitVisible",
            role: "img",
            name: "Selected profile picture",
          },
          top,
        ],
        entry("profile-details"),
      ),
    ],
  },
  72: {
    family: "account-profile",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state(
        "public-profile-hidden",
        [
          click("link", "View public profile"),
          { type: "waitUrl", url: "**/account/public" },
          top,
        ],
        entry("profile-complete"),
      ),
      state(
        "public-profile-collection",
        [top],
        entry("profile-public", "/account/public"),
      ),
    ],
  },
  73: {
    family: "account-profile",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state("account-name-editing", [
        click("button", "First name"),
        fill("First name", "Alex"),
        fill("Last name", "Smith"),
        { type: "blur", role: "textbox", name: "Last name" },
        top,
      ]),
      state("account-name-saved", [save, top]),
    ],
  },
  74: {
    family: "account-profile",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state(
        "account-gender-menu",
        [click("button", "Select gender")],
        entry("profile-named"),
      ),
      state("account-gender-female", [click("radio", "Female"), top]),
    ],
  },
  75: {
    family: "account-profile",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state(
        "account-birthday-editing",
        [
          click("button", "MM/DD/YYYY"),
          ...birthday,
          { type: "blur", role: "textbox", name: "Year" },
          top,
        ],
        entry("profile-gender"),
      ),
      state("account-birthday-saved", [save, top]),
    ],
  },
  76: {
    family: "account-preferences",
    startUrl: "/account",
    frames: [
      state("account-empty", [top]),
      state(
        "shoe-size-open",
        [click("button", /^Shoe size/)],
        entry("profile-preferences-base"),
      ),
      state("shoe-size-selected", [click("button", "8.5")]),
    ],
  },
  77: {
    family: "account-preferences",
    startUrl: "/account",
    scenario: "profile-shoe-selected",
    frames: [
      state("shoe-size-selected", [click("button", /^Shoe size/)]),
      state(
        "skin-type-open",
        [click("button", "+ Skin care")],
        entry("profile-preference-sizes"),
      ),
      state("skin-types-selected", [
        click("button", "Combination"),
        click("button", "With redness"),
        click("button", "Sensitive"),
      ]),
      state("skin-undertone-open", [click("button", /^Skin undertone/)]),
      state("skin-tone-open", [
        click("button", "Pink/Yellow"),
        click("button", /^Skin tone/),
      ]),
      state("skin-preferences-collapsed", [
        click("button", "Fair skin"),
        click("button", /^Skin tone/),
        anchor(".profile-contact-fields + .field-panel", 37),
      ]),
    ],
  },
  78: {
    family: "account-people",
    startUrl: "/account",
    scenario: "profile-skin",
    frames: [
      state("account-before-person", [
        anchor(".profile-contact-fields + .field-panel", 37),
      ]),
      {
        ...state(
          "nickname-empty",
          [
            keyboard,
            click("link", /Add someone/),
            {
              type: "waitVisible",
              role: "dialog",
              name: "Add a nickname",
              exact: true,
            },
            anchor(
              "main.profile-editor > .field-panel:has(.preference-section)",
              151,
            ),
          ],
          entry("profile-skin-hair"),
        ),
        masks: keyboardMask,
        notes:
          "iOS keyboard owns y485–793; browser app viewport is reduced to the visible 485px, never scaled.",
      },
      {
        ...state("nickname-sam", [fill("Nickname", "Sam")]),
        masks: keyboardMask,
      },
      {
        ...state("nickname-friend", [click("button", "Friend")]),
        masks: keyboardMask,
      },
      {
        ...state("person-birthday-empty", [
          save,
          heading("Add Sam's birthday"),
        ]),
        masks: keyboardMask,
      },
      { ...state("person-birthday-entered", birthday), masks: keyboardMask },
      state("person-profile-saved", [
        save,
        { type: "viewport", width: 393, height: 793 },
        { type: "waitVisible", role: "textbox", name: "Nickname", exact: true },
        top,
      ]),
      state("account-with-person", [
        back,
        { type: "waitUrl", url: "**/account" },
        anchor(
          "main.profile-editor > .field-panel:has(.preference-section)",
          108,
        ),
      ]),
    ],
  },
};
