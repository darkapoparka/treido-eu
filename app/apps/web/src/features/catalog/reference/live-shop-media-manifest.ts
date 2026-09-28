// Private emulator-5560 photograph and decorative artwork crops.
// Interface text, prices and controls are rendered by React.
type PhotoSource = {
  file: string;
  sha256: string;
  rect: readonly [number, number, number, number];
};
export const liveShopPhotos: Record<
  string,
  PhotoSource & {
    displayWidth?: number;
    thumbnail?: PhotoSource & { inset?: number };
  }
> = {
  "live-belle-monthly": {
    file: "belle-monthly.png",
    sha256: "2873f7d8423dd77da28f64aedd5741d075b5dd324d60711f20d0e564d8689599",
    rect: [48, 348, 1184, 1444],
    thumbnail: {
      file: "android-belle-grid.png",
      sha256:
        "81c3e1e5f66c77b5513d6b1ce6d99fb7561894799656a46fdf916123b9dd3cc8",
      rect: [48, 1104, 574, 574],
      inset: 3,
    },
  },
  "live-belle-11": {
    file: "belle-11.png",
    sha256: "7450d41bcf5f4095fc735ddcc3927f6368e1416c29094694e57f7654f42bb5eb",
    rect: [48, 348, 1184, 1444],
    thumbnail: {
      file: "android-belle-grid.png",
      sha256:
        "81c3e1e5f66c77b5513d6b1ce6d99fb7561894799656a46fdf916123b9dd3cc8",
      rect: [658, 1104, 574, 574],
      inset: 3,
    },
  },
  "live-belle-12": {
    file: "belle-12.png",
    sha256: "cff8bc8c76a3a31dc56d0b1cac415c1fa1e10d5a2cdfcc98feadac3ac68690c6",
    rect: [48, 348, 1184, 1444],
    thumbnail: {
      file: "android-belle-grid.png",
      sha256:
        "81c3e1e5f66c77b5513d6b1ce6d99fb7561894799656a46fdf916123b9dd3cc8",
      rect: [48, 1910, 574, 574],
      inset: 3,
    },
  },
  "live-testo-up": {
    file: "testo-up.png",
    sha256: "78df587cd1f012079c9552275b21a971fda404a61f3de0997b8d6d1dfca32716",
    rect: [48, 348, 1184, 1184],
  },
  "live-freet": {
    file: "freet.png",
    sha256: "8dafb0ffc762bbae151190fb534d6ea9f1b62ad8702daaae9b2ac26ca8931aaf",
    rect: [48, 348, 1184, 1184],
  },
  "live-creatine": {
    file: "creatine.png",
    sha256: "68fd31a16e296659e67767d166430c09af1a1f12bb31affd0d8108077a18ce97",
    rect: [48, 348, 1184, 1184],
  },
  "live-zlatna-1": {
    file: "zlatna-1.png",
    sha256: "30a0fd82e05ea2b01c2cc5ba67b20f4b43d76df213c847ef677b9b95f71a2a18",
    rect: [48, 378, 1184, 1184],
  },
  "live-zlatna-2": {
    file: "zlatna-2.png",
    sha256: "ef665fa04301c409e1a4773f514b9477c4a084b9ede8fb05eee0eacf931b4df4",
    rect: [48, 378, 1184, 1184],
  },
  "live-zlatna-3": {
    file: "zlatna-3.png",
    sha256: "ff1dcdadb51751ab856c3e351acbe26fe3be4fa76895ece3367a6653f444a284",
    rect: [48, 378, 1184, 1184],
  },
  "live-freebubbles-1": {
    file: "freebubbles-1.png",
    sha256: "13c48246255ac85f1c8d9ce75f0f1d0c6c4fd2210f99f01467509d9ddda442de",
    rect: [48, 348, 1184, 1184],
  },
  "live-freebubbles-2": {
    file: "freebubbles-2.png",
    sha256: "5032a95ec54c506d3bc0b9aa39ac6077ffb00b26bf4211e53a69b7dfee52471a",
    rect: [48, 348, 1184, 1184],
  },
  "live-freebubbles-3": {
    file: "freebubbles-3.png",
    sha256: "193f771cf4f87a08cdf5e91ca69931a90259b3bd7af6a2e336d11de1c470e9cb",
    rect: [48, 348, 1184, 1184],
  },
  "live-belle-logo": {
    file: "android-home.png",
    sha256: "6a3e665a622be9b77d560ddb088e23d6f8bb284778877214a7bbcbc4d947ca32",
    rect: [96, 374, 132, 132],
  },
  "live-zlatna-logo": {
    file: "android-home-scroll.png",
    sha256: "9255ac609386e05ebcdb1bbf3be969939056e0a420d69a81613c1abca24216f4",
    rect: [96, 374, 132, 132],
  },
  "live-empty-saved-mug": {
    file: "android-guest-saved.png",
    sha256: "40c7c064f375f4c3f2ff3dc55795ab2b6be7ea8fc07fcace332bf337447d612c",
    rect: [432, 588, 414, 258],
    displayWidth: 138,
  },
  "live-empty-orders-art": {
    file: "android-guest-orders.png",
    sha256: "fe8d8ba6988beb288dd0f74998fbaf508b551bae30fb68381a14ca9d0ca5ef42",
    rect: [360, 456, 570, 828],
    displayWidth: 190,
  },
  "live-following-zlatna-1": {
    file: "following-zlatna-1.png",
    sha256: "0f00cd7c5550dc21324aeca98744d80c23ed77ba1086dbffe006739c45ebed56",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-guest-following-settled.png",
      sha256:
        "e8a95b7c848f897978ccf9f473dc6be0c053b2604a3fa401a313146961b2ff04",
      rect: [50, 1009, 576, 576],
    },
  },
  "live-following-zlatna-2": {
    file: "following-zlatna-2.png",
    sha256: "8fcda73482549af75fa90c35a5bb237bfcbe315e9c3d4cdfed2a8d876c08d3fe",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-guest-following-settled.png",
      sha256:
        "e8a95b7c848f897978ccf9f473dc6be0c053b2604a3fa401a313146961b2ff04",
      rect: [654, 1009, 576, 576],
    },
  },
  "live-following-zlatna-3": {
    file: "following-zlatna-3.png",
    sha256: "1b12daa6d9cad3e82ebd18a5a359076f274278b73ff342c75f91ef3560fceade",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-guest-following-settled.png",
      sha256:
        "e8a95b7c848f897978ccf9f473dc6be0c053b2604a3fa401a313146961b2ff04",
      rect: [50, 1756, 576, 576],
    },
  },
  "live-following-zlatna-4": {
    file: "following-zlatna-4.png",
    sha256: "401d2d60c7a2988ae89c6776fe729cacbccec2baf47a73458d85f1403264e18e",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-guest-following-settled.png",
      sha256:
        "e8a95b7c848f897978ccf9f473dc6be0c053b2604a3fa401a313146961b2ff04",
      rect: [654, 1756, 576, 576],
    },
  },
  "live-following-zlatna-5": {
    file: "following-zlatna-5.png",
    sha256: "25a3ca7d5d9004615ebf7bbe6cf81c3f9472d928448d0988824d15e72ed96ceb",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-following-lower.png",
      sha256:
        "866470f8288a464f17693efc5e60ad74ab25ce8b86a6408f79c8ab230e82a8cd",
      rect: [50, 1230, 576, 576],
    },
  },
  "live-following-zlatna-6": {
    file: "following-zlatna-6.png",
    sha256: "11a5b560c45020007aa648da0a8bb7b4d875f481015c96b04c3176596cbd4212",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-following-lower.png",
      sha256:
        "866470f8288a464f17693efc5e60ad74ab25ce8b86a6408f79c8ab230e82a8cd",
      rect: [654, 1230, 576, 576],
    },
  },
  "live-following-zlatna-7": {
    file: "following-zlatna-7.png",
    sha256: "023f8b7576b1b16c477f63d0578466b758d1821d8e0d84c1330999364edbf396",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-following-lower.png",
      sha256:
        "866470f8288a464f17693efc5e60ad74ab25ce8b86a6408f79c8ab230e82a8cd",
      rect: [50, 1977, 576, 576],
    },
  },
  "live-following-zlatna-8": {
    file: "following-zlatna-8.png",
    sha256: "bc8393496d99d41552c852d0306ea934bfb77a9ae990740f688c678e8a9398bb",
    rect: [48, 378, 1184, 1184],
    thumbnail: {
      file: "android-following-lower.png",
      sha256:
        "866470f8288a464f17693efc5e60ad74ab25ce8b86a6408f79c8ab230e82a8cd",
      rect: [654, 1977, 576, 576],
    },
  },
  "live-following-zlatna-9": {
    file: "following-zlatna-9.png",
    sha256: "d5899887ad2fe6a4ea04556e0967930ba37401bd37270a497c947e3f1e76ba7e",
    rect: [48, 378, 1184, 1184],
  },
  "live-guest-signin-mark": {
    file: "android-guest-profile-settled.png",
    sha256: "78ea749867d256eaf5468c0676531072f1977973692aa314589f5087575aa6c6",
    rect: [598, 267, 84, 93],
    displayWidth: 28,
  },
  "live-guest-order-package": {
    file: "android-guest-profile-settled.png",
    sha256: "78ea749867d256eaf5468c0676531072f1977973692aa314589f5087575aa6c6",
    rect: [96, 2052, 192, 192],
    displayWidth: 64,
  },
};
