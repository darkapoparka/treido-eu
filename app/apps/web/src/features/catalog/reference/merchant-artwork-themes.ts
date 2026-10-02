import type { MerchantPresentation } from "../merchant-types";
// Explicit fallback palettes sampled from each brand's existing artwork; not native approval.
export const merchantArtworkThemes: Readonly<
  Record<
    string,
    Pick<MerchantPresentation, "background" | "foreground" | "panel">
  >
> = {
  langehair: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  hanacure: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  bubbleskincare: {
    background: "#c0ad60",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  bareminerals: {
    background: "#ad9a86",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  buffy: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  thecitizenry: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  trueclassic: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  kickscrew: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  carpe: {
    background: "#c0ad9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  princesspolly: {
    background: "#9a9a86",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  drmtlgy: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  mountaingoatsoapco: {
    background: "#9a9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  theloadedteashop: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  cityjeans: {
    background: "#4d6060",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  fentybeauty: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  juviasplace: {
    background: "#c04d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  chemicalguys: {
    background: "#60869a",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  jeanswarehouse: {
    background: "#adadc0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  forkeyewear: {
    background: "#3a3a4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  akira: {
    background: "#c0c0ad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  lusoophy: {
    background: "#73609a",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  givenchy: {
    background: "#9a9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  kitsch: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  vehla: {
    background: "#737373",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  pura: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  fashionnova: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  origin: {
    background: "#606060",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  belleboxbg: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  testograph: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  zlatnaribkaлидерътвлуксознатакозметиказакоса: {
    background: "#9a9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  freebubbles: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  talaus: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  luluandgeorgia: {
    background: "#606060",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  hawkinsnewyork: {
    background: "#adad9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  goodee: {
    background: "#ad9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  rangerstation: {
    background: "#3a3232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  sophieloujacobsen: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  woojdesign: {
    background: "#9a9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  ruggable: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  sundaycitizen: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  houseofleon: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  flamingoestate: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  underwaterweavingstudio: {
    background: "#737373",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  brooklinen: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  bollbranch: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  toast: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  hudsongrace: {
    background: "#ad9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  estellecoloredglass: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  ourplace: {
    background: "#737373",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  cozyearth: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  naadam: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  ekster: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  beautyofjoseon: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  saie: {
    background: "#9a9aad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  docos: {
    background: "#adc0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  roughlinen: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  pier1: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  graflantz: {
    background: "#adc0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  bedthreads: {
    background: "#9a9a9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  cedarmoss: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  oakywood: {
    background: "#adadad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  linentales: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  insightcordlesslighting: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  shoppeamberinteriors: {
    background: "#868686",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  momadesignstore: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  mcgeeco: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  mujiusa: {
    background: "#733232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  brumate: {
    background: "#868686",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  "2modernfurniturelighting": {
    background: "#c0c0ad",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  parachutehome: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  jonathanadler: {
    background: "#adc0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  bludot: {
    background: "#3a7386",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  businesspleasureco: {
    background: "#323a3a",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  grovecollaborative: {
    background: "#323a4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  greenpanus: {
    background: "#608632",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  sajenaturalwellness: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  riflepaperco: {
    background: "#c0ad9a",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  venusetfleur: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  nestnewyork: {
    background: "#4d4d4d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  hexcladcookware: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  hedleybennett: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  stanley1913: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  magnolia: {
    background: "#868686",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  maxandlily: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  coyuchi: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  pstrstudio: {
    background: "#60604d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  abccarpethome: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  revivalrugs: {
    background: "#c0c0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  drift: {
    background: "#323232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
  staud: {
    background: "#adc0c0",
    foreground: "#171717",
    panel: "#ffffff40",
  },
  madeincookware: {
    background: "#9a3232",
    foreground: "#ffffff",
    panel: "#ffffff1a",
  },
};
