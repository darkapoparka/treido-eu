// Clean source photographs and decorative fields only; private original hashes.
export const liveHomeMedia: Record<
  string,
  {
    file: string;
    sha256: string;
    rect?: readonly [number, number, number, number];
  }
> = {
  "live-home-living-room": {
    file: "live-home-living-room-original.jpg",
    sha256: "667f7b67ddef6a5cf452b2032c38dc1044d8a9b19f06aaafea4b472b61ee70c5",
  },
  "live-home-kitchen-icon": {
    file: "live-home-header-native-20260928.png",
    sha256: "cf4c141c4a601c37bce46a9175eceb9dd72573c45179f551dd0009ed012ad3df",
    rect: [60, 396, 96, 96],
  },
  "live-home-decor-icon": {
    file: "live-home-header-native-20260928.png",
    sha256: "cf4c141c4a601c37bce46a9175eceb9dd72573c45179f551dd0009ed012ad3df",
    rect: [569, 396, 96, 96],
  },
  "live-home-bedding-icon": {
    file: "live-home-header-native-20260928.png",
    sha256: "cf4c141c4a601c37bce46a9175eceb9dd72573c45179f551dd0009ed012ad3df",
    rect: [870, 396, 96, 96],
  },
  "live-home-towels-icon": {
    file: "live-home-home-pills-middle-20260928.png",
    sha256: "14e283af4a97c8a79f046a8196b46ca1ae0add3167a4ceff388307015b29ed1e",
    rect: [144, 396, 96, 96],
  },
  "live-home-appliances-icon": {
    file: "live-home-home-pills-middle-20260928.png",
    sha256: "14e283af4a97c8a79f046a8196b46ca1ae0add3167a4ceff388307015b29ed1e",
    rect: [464, 396, 96, 96],
  },
  "live-home-lighting-icon": {
    file: "live-home-pills-end-20260928.png",
    sha256: "6f6ec3b6cda14bddad95fd95bfd6a806b10f71e2b8e779643eff743e81556a40",
    rect: [552, 396, 96, 96],
  },
  "live-home-furniture-icon": {
    file: "live-home-pills-end-20260928.png",
    sha256: "6f6ec3b6cda14bddad95fd95bfd6a806b10f71e2b8e779643eff743e81556a40",
    rect: [894, 396, 96, 96],
  },
  "live-home-plants-icon": {
    file: "live-home-plants-20260928.png",
    sha256: "afbaa950bded9e9989c5fcc5614bfb19e3c771e388a57dff97bc2304500ce8b2",
    rect: [847, 396, 96, 96],
  },
  "live-home-silque-photo-1": {
    file: "live-home-silque-photo-1.bin",
    sha256: "114b883d238ee02e6e7847cd3bc765b8dac4138f347ead9cca2e0b00cf6f8bb9",
  },
  "live-home-silque-photo-3": {
    file: "live-home-silque-photo-3.bin",
    sha256: "90ba6c24af12a156cba90f468bf17d0415f83aa31d83b75b4e9c2527b8918af5",
  },
  "live-home-silque-photo-4": {
    file: "live-home-silque-photo-4.bin",
    sha256: "835e82efaf0e06d48f1ad3db497418bf2dac1a6abb069a745b9a55c625f690d3",
  },
  "live-home-silque-photo-2": {
    file: "live-home-silque-photo-2.bin",
    sha256: "452a8e8ae7b27c02299a6b34284768d07c26e579303810070d4c7fe0a530f9f2",
  },
  "live-home-silque-photo-8": {
    file: "live-home-silque-photo-8.bin",
    sha256: "0b231522c97193f64cccef21fb54389ab566485cfa27c8e29316d5d1fbaa4d21",
  },
  "live-home-silque-photo-7": {
    file: "live-home-silque-photo-7.bin",
    sha256: "8931c30b6f4d4dc52996a99e7acbca2b04166471b55ba5074dd51620cb038cb0",
  },
  "live-home-silque-photo-6": {
    file: "live-home-silque-photo-6.bin",
    sha256: "abf1af5edbd456c500c42382259abdcf4c26c1905055558ecae3dad314ca015e",
  },
  "live-home-silque-photo-5": {
    file: "live-home-silque-photo-5.bin",
    sha256: "84ebdf09bb641a570ea2ae90d641733f3c1c867f0702c8f1760645a259f97a3b",
  },
  "live-home-silque-photo-11": {
    file: "live-home-silque-photo-11.bin",
    sha256: "907264e3290a8be19edb3c2754e159a32092aef1096028d96e85fa286ae2bad6",
  },
  "live-home-silque-photo-10": {
    file: "live-home-silque-photo-10.bin",
    sha256: "3abbdf3dc7efb36912b60aacb5c6feafa80322ab7b21fc018c9cc72b0eb26fcf",
  },
  "live-home-silque-photo-9": {
    file: "live-home-silque-photo-9.bin",
    sha256: "7f003647cea5eed60522077f6ff8f6ce9c19c01e59063e7a24492c6a63a5b4c5",
  },
  "live-home-silque-photo-12": {
    file: "live-home-silque-photo-12.bin",
    sha256: "d1b9c6ae22b3041b2f17254892bb29cf0a2e735ee4f21c75a6af9cded2e43a67",
  },
  "live-home-silque-photo-13": {
    file: "live-home-silque-photo-13.bin",
    sha256: "2136e7d4b24eebb8677dc5dae7435a5a4928dc5253380a8aea445284a754688a",
  },
  "live-home-silque-photo-14": {
    file: "live-home-silque-photo-14.bin",
    sha256: "c90d647bc1e46aaf6cff6f7a7fa7d4695d433c82b66e1a645eef4e5ccd730ecd",
  },
  "live-home-silque-photo-15": {
    file: "live-home-silque-photo-15.bin",
    sha256: "7dd2e0ec09b041858a91fae944eede1996616b13e7e8c8d377bad93e3b0bcdb3",
  },
  "live-home-silque-photo-16": {
    file: "live-home-silque-photo-16.bin",
    sha256: "a9d57f9e7d0090a95472f6b9218413bce69790b6605e994110bec1811b1422aa",
  },
  "live-home-silque-photo-19": {
    file: "live-home-silque-photo-19.bin",
    sha256: "fb0d3fb9bd226d950d37be56211cd711ebbfa3febf8e30515d9ff6bc2d544925",
  },
  "live-home-silque-photo-17": {
    file: "live-home-silque-photo-17.bin",
    sha256: "d13297db6e322699c453d035df5831eb73b70ce99d06ef6dbdaa992a7e6e43b6",
  },
  "live-home-silque-photo-18": {
    file: "live-home-silque-photo-18.bin",
    sha256: "b424be0ad9045617c61fa56ca6e2f115d39c6fea75c9ffd331c780383f044384",
  },
  "live-home-silque-photo-20": {
    file: "live-home-silque-photo-20.bin",
    sha256: "951aca2315587002fd518bce318adfea365067c5db4d2225e3a44abf7d778b75",
  },
  "live-home-silque-photo-22": {
    file: "live-home-silque-photo-22.bin",
    sha256: "f675576a571a8e127dae6fb4d11f587964b12e30a431a1222b5a8ca4560c787e",
  },
  "live-home-silque-photo-24": {
    file: "live-home-silque-photo-24.bin",
    sha256: "82fa0b9bc289ddd3bc1e7e449587f115d7951e0ceeecbde4e93f13866a20b206",
  },
  "live-home-silque-photo-21": {
    file: "live-home-silque-photo-21.bin",
    sha256: "05dd09cf77959441984b5fc1deeb08595cae8a76689f7253489c6e80264a55b7",
  },
  "live-home-silque-photo-23": {
    file: "live-home-silque-photo-23.bin",
    sha256: "19da70ecb4ea87c80693bafcd909a66c108c289eece4c81a40c97dd4ebdbba1a",
  },
  "live-home-silque-photo-25": {
    file: "live-home-silque-photo-25.bin",
    sha256: "fba0218d29e33ef58525ee8072f9a0e7ad7a34a59779c4701283b9972d001904",
  },
  "live-home-silque-photo-27": {
    file: "live-home-silque-photo-27.bin",
    sha256: "aabfee18df4dd8b4e93a46f6972aadfafd22110bfc5be36f0aad2267ec09b372",
  },
  "live-home-silque-photo-28": {
    file: "live-home-silque-photo-28.bin",
    sha256: "4c6c40ea0c9e79fffe8854ca8d6c61106a860a1563d369471388cee3cf9d4790",
  },
  "live-home-silque-photo-26": {
    file: "live-home-silque-photo-26.bin",
    sha256: "bb26f39e2cd72b08bd1a401349cd327f5e4ba44fe3c8037fe0f523f98344426a",
  },
  "live-home-silque-photo-29": {
    file: "live-home-silque-photo-29.bin",
    sha256: "67c8821f40372bf1bd4e5a4f5e83b30ae70ff8d2467e86d7f6023d9dba82dcb5",
  },
  "live-home-barts-photo-3": {
    file: "live-home-barts-photo-3.bin",
    sha256: "1767643f0dfc95336373ce0f378ef1f5cda0a01670820614d9d1f9c620c5bc14",
  },
  "live-home-barts-photo-2": {
    file: "live-home-barts-photo-2.bin",
    sha256: "e69ccf9a24a2d6c025f5fe75510114f0a171013cd370db2d820f777c54bf6ef6",
  },
  "live-home-barts-photo-4": {
    file: "live-home-barts-photo-4.bin",
    sha256: "62cacfd2aabbbaee3470d6b32e21ec6d27ae18a5674e43a2c00c810dfc681620",
  },
  "live-home-barts-photo-1": {
    file: "live-home-barts-photo-1.bin",
    sha256: "ed87500a81f6245676096a19401bec612453934254a7481ecbba2d796ef39fe1",
  },
  "live-home-barts-photo-7": {
    file: "live-home-barts-photo-7.bin",
    sha256: "c8111b9e3b5b624aac9bbf17c01da7a09144343ffb137ba219c0719332fc0ee4",
  },
  "live-home-barts-photo-8": {
    file: "live-home-barts-photo-8.bin",
    sha256: "111799239fb7000668cb51e49e72e326c4def91f263c2be31463c9b980b807b3",
  },
  "live-home-barts-photo-5": {
    file: "live-home-barts-photo-5.bin",
    sha256: "e8fe81dd01f63d90f679aca635d13b232a5fd66fb9051186d4397d5eecfe116e",
  },
  "live-home-barts-photo-6": {
    file: "live-home-barts-photo-6.bin",
    sha256: "0b9ba34dde1afa53385658566dc74610bc2197bafab44b3ff6a8980a9d21e9fb",
  },
  "live-home-barts-photo-9": {
    file: "live-home-barts-photo-9.bin",
    sha256: "7f1333e258fec166bccc4768e3af96a84c280773e41f1d882d38c288a4bf3829",
  },
  "live-home-papasan-photo-1": {
    file: "live-home-papasan-photo-1.bin",
    sha256: "f1a549165bce1eadba52d67a56d2b9241555fa6352e11896d8a38ba60e5a3675",
  },
  "live-home-papasan-photo-4": {
    file: "live-home-papasan-photo-4.bin",
    sha256: "9c329883991e5218d8c72c95fb7609feecb1eedbfdaaeb23b9e9ff113c80333e",
  },
  "live-home-papasan-photo-2": {
    file: "live-home-papasan-photo-2.bin",
    sha256: "1f6d54a155a52ec4960d571fb0f7088a95e6105dfa4604b44890f591500e8d85",
  },
  "live-home-papasan-photo-3": {
    file: "live-home-papasan-photo-3.bin",
    sha256: "f764f39829003b166c8cdf47e0747d1eeebbeecd886419cb3ca1ee51f6b489c2",
  },
  "live-home-papasan-photo-5": {
    file: "live-home-papasan-photo-5.bin",
    sha256: "02fa52ce4328b8d26fa1fa2418ec61ee78bfd08985459e570d46ab9860c57e73",
  },
  "live-home-papasan-photo-6": {
    file: "live-home-papasan-photo-6.bin",
    sha256: "6997dd00b3a520f25919f22341921414e157d73f314109331a1c29260914f2fa",
  },
  "live-home-papasan-photo-8": {
    file: "live-home-papasan-photo-8.bin",
    sha256: "f630bbd8135ea82388ac530e51d2d41797b05e2b0c139c8d20ff7c4b8d3491b9",
  },
  "live-home-papasan-photo-7": {
    file: "live-home-papasan-photo-7.bin",
    sha256: "5eb4a1229427ae028540152ac6b6eeb088ffaaf29b030bac8ff1f30a3cb2b06c",
  },
  "live-home-papasan-photo-10": {
    file: "live-home-papasan-photo-10.bin",
    sha256: "68c9348ed9d1f89b3f9995240b6923e79187e7caa0bda51f3e0357ec1438f934",
  },
  "live-home-papasan-photo-9": {
    file: "live-home-papasan-photo-9.bin",
    sha256: "57d2668235c993176f864afab5758992dd8dcf65a22023ba7da886047663a2f9",
  },
  "live-home-papasan-photo-11": {
    file: "live-home-papasan-photo-11.bin",
    sha256: "61441691933fa605e92146507575b7747cec37bcf9adcba46fe44335245ee20a",
  },
  "live-home-papasan-photo-12": {
    file: "live-home-papasan-photo-12.bin",
    sha256: "faeef8ea718fc4b1d6becff6878521389664b0ccfc38104956f6d70fb1550f56",
  },
  "live-home-papasan-photo-13": {
    file: "live-home-papasan-photo-13.bin",
    sha256: "4793afe94660443d1a1e7df59fc88f7ebecd3866230211503f8fa1ae2c9b438c",
  },
  "live-home-papasan-photo-14": {
    file: "live-home-papasan-photo-14.bin",
    sha256: "1cd01b653b5c3941f41150267314e61295bef641d3a1d36248c725284b9bda27",
  },
  "live-home-papasan-photo-15": {
    file: "live-home-papasan-photo-15.bin",
    sha256: "f6f60e39d02ad6eb318a645fbb9ce33095eb8cbf893f4840dc0f214f34108482",
  },
  "live-home-papasan-photo-16": {
    file: "live-home-papasan-photo-16.bin",
    sha256: "540fdd73906ace9a4b47b21dad93d420ba4f5dd7f3edb8503f9e1c76020ba209",
  },
  "live-home-papasan-photo-18": {
    file: "live-home-papasan-photo-18.bin",
    sha256: "f895eac5e5ee0bc9bdf08495b2b24d48171592d1fef284ef4b5c4761ad464534",
  },
  "live-home-papasan-photo-19": {
    file: "live-home-papasan-photo-19.bin",
    sha256: "339006c0ef670b122f34e8e4af5a0a5d7848527910a51bae3f3f0387aaf7056c",
  },
  "live-home-papasan-photo-17": {
    file: "live-home-papasan-photo-17.bin",
    sha256: "0fa08b0b5b2ddc3dd541684c698391b8a0d18cf75042ad56bd3775d6c0109faf",
  },
  "live-home-papasan-photo-20": {
    file: "live-home-papasan-photo-20.bin",
    sha256: "5ef35e3332813de160e8c38384c0c6c38c135fd8a411274ae04f2ad6c8003539",
  },
  "live-home-papasan-photo-24": {
    file: "live-home-papasan-photo-24.bin",
    sha256: "ee6fc4b2236e9044571a8bda42a4f89d0938a5085d2835174cc9ff991b3a9830",
  },
  "live-home-papasan-photo-23": {
    file: "live-home-papasan-photo-23.bin",
    sha256: "d27d2dd81bf4309d626ed28e9ce29460caab8d947d5f13d4bf8717bea4d19c38",
  },
  "live-home-papasan-photo-22": {
    file: "live-home-papasan-photo-22.bin",
    sha256: "c3f78cf156ba2b5a1cd18dbba83377be225d5944f05d3b5a23a21c9b58ab84bb",
  },
  "live-home-papasan-photo-21": {
    file: "live-home-papasan-photo-21.bin",
    sha256: "6adc80667cfc7db50bd7cd5e4b534d935308d5c8d760d81017a03f9fa45b51d5",
  },
  "live-home-papasan-photo-25": {
    file: "live-home-papasan-photo-25.bin",
    sha256: "44ee1404ad7ae40ae52338832c1b842eaff17abf5f36663d1775319faf7f5dfe",
  },
  "live-home-papasan-photo-27": {
    file: "live-home-papasan-photo-27.bin",
    sha256: "823d0f81bc98d8ddc4270ca95131052f08bbc8f3cfef704532f8ffed92262138",
  },
  "live-home-papasan-photo-28": {
    file: "live-home-papasan-photo-28.bin",
    sha256: "25926ca225701f7a131b03f6e90a6bb5af37b2cea692056606e31587b9469eb5",
  },
  "live-home-papasan-photo-26": {
    file: "live-home-papasan-photo-26.bin",
    sha256: "557415349096947975619eb8930fecab18fe8d3777963ee3accd7fbe950977b3",
  },
  "live-home-papasan-photo-29": {
    file: "live-home-papasan-photo-29.bin",
    sha256: "cb100d622fe67009215f98717dd388cf07edc9a2a2ed11f6360d4e4b7605b84d",
  },
  "live-home-papasan-photo-31": {
    file: "live-home-papasan-photo-31.bin",
    sha256: "6c6e2a4546a608cddffe4ace4e6a288107bc885f11adf4e03146398f2846f8de",
  },
  "live-home-papasan-photo-32": {
    file: "live-home-papasan-photo-32.bin",
    sha256: "15939fd3a15af3724588e7ac269a7b70b9a5f1ed5f8e213cbdb51bf849751529",
  },
  "live-home-papasan-photo-30": {
    file: "live-home-papasan-photo-30.bin",
    sha256: "0765f19f8b070c9e4caed65a4cbe0ff24fb7265ad8778a50b8783cecc152c90c",
  },
  "live-home-papasan-photo-34": {
    file: "live-home-papasan-photo-34.bin",
    sha256: "8fc6d1ad2c47993f85d20d99c3f38170f38459a8a9e0dbc648804ec18fc72281",
  },
  "live-home-papasan-photo-36": {
    file: "live-home-papasan-photo-36.bin",
    sha256: "6d18b8ff00dd1a553dbfa86cf5c99099d2af92676f3554380a717fca03af0741",
  },
  "live-home-papasan-photo-33": {
    file: "live-home-papasan-photo-33.bin",
    sha256: "32be8e66dc1d9d0f24cfe9127b92856a97c44d436db96e0e1a08feb0576de223",
  },
  "live-home-papasan-photo-35": {
    file: "live-home-papasan-photo-35.bin",
    sha256: "a41939d1dab5c590dbe63d31614167f462a9dbacf80afe49381ce60009720fb3",
  },
  "live-home-papasan-photo-39": {
    file: "live-home-papasan-photo-39.bin",
    sha256: "2203202a9779580f1180535ddca85acb5075da2232ea713622c70a9165a1da7c",
  },
  "live-home-papasan-photo-40": {
    file: "live-home-papasan-photo-40.bin",
    sha256: "15b4e658a05b2869503106f6bb7960746894168ae11b7310de52d0ef5d12b5b2",
  },
  "live-home-papasan-photo-38": {
    file: "live-home-papasan-photo-38.bin",
    sha256: "4d62a8c0e6f1efcdb68fe8e8f899c6a46cf724defac652a827a1e00cbc7a7492",
  },
  "live-home-papasan-photo-37": {
    file: "live-home-papasan-photo-37.bin",
    sha256: "5b7429dda244c518d62b55b899c3a06f447858bb34c09df9b6fdc0b7181e0e9f",
  },
  "live-home-papasan-photo-41": {
    file: "live-home-papasan-photo-41.bin",
    sha256: "d00516b28a27b7e68f64087e0c9dc7daf99ebd89b106898148f1eb7906a9b886",
  },
  "live-home-papasan-photo-42": {
    file: "live-home-papasan-photo-42.bin",
    sha256: "d7c59d3f53ca38b032c97374125ffa6185034e55bc306b0b364626caa9f51ab8",
  },
  "live-home-papasan-photo-43": {
    file: "live-home-papasan-photo-43.bin",
    sha256: "684e43807c35d8238479dfa259f44cbcfbc1a5a21546cd70700fcfab2af96690",
  },
  "live-home-papasan-photo-44": {
    file: "live-home-papasan-photo-44.bin",
    sha256: "8dd59bc1e08764276fcc74eb9cce5e73ca0a72f311dcd904f1b57cce4ca6b48d",
  },
  "live-home-papasan-photo-48": {
    file: "live-home-papasan-photo-48.bin",
    sha256: "40e01a68c1cb1e981b5cf3d53c1deb55937b9cbe44d062c20f7b518c0ce8bd98",
  },
  "live-home-papasan-photo-45": {
    file: "live-home-papasan-photo-45.bin",
    sha256: "47b42857a5fd66e401af4fbd627d5d0f68b101f10cf9994fe10696b47af30d47",
  },
  "live-home-papasan-photo-46": {
    file: "live-home-papasan-photo-46.bin",
    sha256: "d3a2da627b92c34bf75c2dc2bceccd277d29850e4108326af1605188b429e485",
  },
  "live-home-papasan-photo-47": {
    file: "live-home-papasan-photo-47.bin",
    sha256: "1a2f05aee2bf2b746b6eb712a68c645aa2735cb2832ccb0518c756c0b86a861e",
  },
  "live-home-papasan-photo-50": {
    file: "live-home-papasan-photo-50.bin",
    sha256: "356358889d7fd9aa117dff5da00526d88bde169e7b1db9e9a77dcbda5ce8baf8",
  },
  "live-home-papasan-photo-51": {
    file: "live-home-papasan-photo-51.bin",
    sha256: "7de299458c9bf72b036454b7f7f82f773ad2166608b9128973180b31bfe2b6ee",
  },
  "live-home-papasan-photo-49": {
    file: "live-home-papasan-photo-49.bin",
    sha256: "5165b4b5b482b03550b3b438a427d4e707e1aa86e0e65bc4eaa20fecb395f89a",
  },
  "live-home-papasan-photo-52": {
    file: "live-home-papasan-photo-52.bin",
    sha256: "b853d95481544340409649aff7c45bb6893ae67c16a1df7e844c7313bf29f534",
  },
  "live-home-papasan-photo-54": {
    file: "live-home-papasan-photo-54.bin",
    sha256: "fc9881094cc785020ebd5129fa637df64031cf65c0be67fdddc087965aec7b64",
  },
  "live-home-papasan-photo-56": {
    file: "live-home-papasan-photo-56.bin",
    sha256: "574e70d30a31b785ee9bbac802a6649284253cc972fc24294fdfd388ea2785e4",
  },
  "live-home-papasan-photo-53": {
    file: "live-home-papasan-photo-53.bin",
    sha256: "a40bbd930832d7eac478d0f11bf9f2ed4cb69f2c8b1ef33d9ffaa103c8feca89",
  },
  "live-home-papasan-photo-55": {
    file: "live-home-papasan-photo-55.bin",
    sha256: "f52a9cb87440a45a37c21aff7ef69158d0d8ba35812712b8123e328b575f1395",
  },
  "live-home-papasan-photo-58": {
    file: "live-home-papasan-photo-58.bin",
    sha256: "07402936e25943b48fa73c3e7116bf5014cb89685ca0425d369683071e34de1f",
  },
  "live-home-papasan-photo-60": {
    file: "live-home-papasan-photo-60.bin",
    sha256: "63f392087b2854c753168588b5fa12627274b5bb3734c593e4db0947416d020b",
  },
  "live-home-papasan-photo-57": {
    file: "live-home-papasan-photo-57.bin",
    sha256: "a912681b1d398b930218637804859f6b5e2f59730af662f46cf37d613686fe99",
  },
  "live-home-papasan-photo-59": {
    file: "live-home-papasan-photo-59.bin",
    sha256: "830f469a832c21aab579386de3b3b0446b839d176fc958e48271f7ba141f664f",
  },
  "live-home-papasan-photo-61": {
    file: "live-home-papasan-photo-61.bin",
    sha256: "183591ecace1f734fc037b637b745cf528b0a3303c47bbd8075560dafc5d49a1",
  },
  "live-home-papasan-photo-63": {
    file: "live-home-papasan-photo-63.bin",
    sha256: "e34217f51df19029df17be75a49f005ff95da287fe080732347f37845b8f7be6",
  },
  "live-home-papasan-photo-62": {
    file: "live-home-papasan-photo-62.bin",
    sha256: "390fbc15476e941a6d60ccd158c492e853b261923aecdc9d822945ccc3fe186e",
  },
  "live-home-papasan-photo-64": {
    file: "live-home-papasan-photo-64.bin",
    sha256: "2569c7cbedc6a1ea4487920d4fc9f4fdc33753bf2d0865d58d1a4de47a78a352",
  },
  "live-home-papasan-photo-67": {
    file: "live-home-papasan-photo-67.bin",
    sha256: "69562d19370cd572f2450b5d1d59fd3f14c6f6fc35fdb70c4dfa6a7ca167d4bf",
  },
  "live-home-papasan-photo-66": {
    file: "live-home-papasan-photo-66.bin",
    sha256: "ea9f312e8e084a97a22aeeed3a104a4a7686b1ddd88328c01097c65ee70bc2ef",
  },
  "live-home-papasan-photo-68": {
    file: "live-home-papasan-photo-68.bin",
    sha256: "c0781d0f6824310ec5eb138df5a8f5f09a3260c3742d6f848fbb88bf3e61d880",
  },
  "live-home-papasan-photo-65": {
    file: "live-home-papasan-photo-65.bin",
    sha256: "7c310cd5f6432e162db31e1832f7387369b233b5dbb958ffa1600fddaa720d87",
  },
  "live-home-papasan-photo-69": {
    file: "live-home-papasan-photo-69.bin",
    sha256: "5d837e48a8ddda8e67874423f861e7ef39920eee4465758b38df17874ecf1d15",
  },
  "live-home-papasan-photo-70": {
    file: "live-home-papasan-photo-70.bin",
    sha256: "8008972c928346d77b65582006d4b59f60a64b42bc9831db90dfdb6008b871b9",
  },
  "live-home-papasan-photo-71": {
    file: "live-home-papasan-photo-71.bin",
    sha256: "525b87fdca6c65be3e89a703bfccebcd5ecfe9a1828eea7dea09933791cc9e21",
  },
  "live-home-papasan-photo-72": {
    file: "live-home-papasan-photo-72.bin",
    sha256: "9699dbe840f32484ebb7007495d9090980acb480cd04b842f595cfcfb686101d",
  },
  "live-home-papasan-photo-74": {
    file: "live-home-papasan-photo-74.bin",
    sha256: "0bdc589681e9adc3202f6e90ba52c62b26effb3630277e069b68bc50e25fb377",
  },
  "live-home-papasan-photo-75": {
    file: "live-home-papasan-photo-75.bin",
    sha256: "ddb485d7f3805fdf28cb3463b1790ec10f1730ece84f58c3b0dc7d76562fcb61",
  },
  "live-home-papasan-photo-73": {
    file: "live-home-papasan-photo-73.bin",
    sha256: "673a0baa43a146601568e1c18b7b90ed986a1880d6681d81987b7042d1b53a44",
  },
  "live-home-papasan-photo-76": {
    file: "live-home-papasan-photo-76.bin",
    sha256: "7c7460c9e1278faef6d11077842f735a6d191f40dc85d19015cab5c3d5d14c1e",
  },
  "live-home-papasan-photo-77": {
    file: "live-home-papasan-photo-77.bin",
    sha256: "9f13beba995900519f2148339c4372a755c9b95da41bcdc12deb5323ae9f0f38",
  },
  "live-home-papasan-photo-80": {
    file: "live-home-papasan-photo-80.bin",
    sha256: "05037af7eae6e65ce6356d7f0b5f60a07db12edb320297a0ab58c149cd24e3d1",
  },
  "live-home-papasan-photo-78": {
    file: "live-home-papasan-photo-78.bin",
    sha256: "c39295133bfed3a3f14c2c2f8386fd87fdaed465b9888ef9280dad74c69119c4",
  },
  "live-home-papasan-photo-79": {
    file: "live-home-papasan-photo-79.bin",
    sha256: "3345e3124b587b18bbb0a11397651d8d0c8bf8c48a073b1bbc18891b1fddde28",
  },
  "live-home-papasan-photo-84": {
    file: "live-home-papasan-photo-84.bin",
    sha256: "2756c2c3ed6997e67564ae0e7d95b4855c2374e0b3ac5112990ee9abc970e488",
  },
  "live-home-papasan-photo-82": {
    file: "live-home-papasan-photo-82.bin",
    sha256: "fdf17fb27c2d99cc259e399bf17af4557dfb4fc8ac15ca821b15333a7c8eff57",
  },
  "live-home-papasan-photo-81": {
    file: "live-home-papasan-photo-81.bin",
    sha256: "9de231efcae22036a7c1b1b0a842f16ee300061c3e23cc3e477c362255662b56",
  },
  "live-home-papasan-photo-83": {
    file: "live-home-papasan-photo-83.bin",
    sha256: "c23b6d53adeb6d07dba3df2ef849b81a593566926413e1dd9e6c40b8c4f02430",
  },
  "live-home-papasan-photo-87": {
    file: "live-home-papasan-photo-87.bin",
    sha256: "018cd9aba886f0d582ce0b0a98ecb966255d4f8ed574435079cf25ede0205b3b",
  },
  "live-home-papasan-photo-88": {
    file: "live-home-papasan-photo-88.bin",
    sha256: "a8dcd3e086e39b2ee46cea1d13750b75055693e1b7ced1db83d4aa903426476b",
  },
  "live-home-papasan-photo-86": {
    file: "live-home-papasan-photo-86.bin",
    sha256: "c011feec1b42b9b9d7c16cfe03462f49b47f231cd9e3431de18c80be7d709c0e",
  },
  "live-home-papasan-photo-85": {
    file: "live-home-papasan-photo-85.bin",
    sha256: "a66adf575a3f6f852a884ed2fb54162f48bb148cc642f269c7ec49b8a65c5d6c",
  },
  "live-home-papasan-photo-91": {
    file: "live-home-papasan-photo-91.bin",
    sha256: "b6bd17d0fcaf572fe58347597bc67ef88cc290fe237dd9c8efa0589b0e1714be",
  },
  "live-home-papasan-photo-92": {
    file: "live-home-papasan-photo-92.bin",
    sha256: "16894136532cdc3ca3d611ad8b17d416ce3d12a39a69feea510609ac16353575",
  },
  "live-home-papasan-photo-89": {
    file: "live-home-papasan-photo-89.bin",
    sha256: "e9e5b2b78f150a00aa7d4abae410f81fb91d857f45637b37554ed6b73a793a67",
  },
  "live-home-papasan-photo-90": {
    file: "live-home-papasan-photo-90.bin",
    sha256: "4ee205cb5d65cc43d455c6c3796d3c63bd6345d1bbba8f1a956643efbca3a136",
  },
  "live-home-papasan-photo-95": {
    file: "live-home-papasan-photo-95.bin",
    sha256: "86f58a74de5211581357c26260996324ce2ff8a2c8f856d56f5d3876a7dd03ce",
  },
  "live-home-papasan-photo-94": {
    file: "live-home-papasan-photo-94.bin",
    sha256: "a7fe9325ac4fb1109b4fc94a4d09970a3ae8df919a4488c1dc85d408ec366446",
  },
  "live-home-papasan-photo-93": {
    file: "live-home-papasan-photo-93.bin",
    sha256: "8c78f2438165ed684cd7075235fb7f93a7e294a9b9dd1abb17e1f6fd69349254",
  },
  "live-home-kobon-photo-4": {
    file: "live-home-kobon-photo-4.bin",
    sha256: "58170fc2e9f1f16e5e605b2b1d3cb22d5a1f736937cde9a4fbcd21c2c4c1bfd9",
  },
  "live-home-kobon-photo-1": {
    file: "live-home-kobon-photo-1.bin",
    sha256: "b835cb2ac6efe39a518b4b717cf632eec0495ff3d63f8da0626038e3144478f5",
  },
  "live-home-kobon-photo-3": {
    file: "live-home-kobon-photo-3.bin",
    sha256: "adebd98f191cb5b7f67ad2225619d9675f23f7ae140a8430163345a2b7922d74",
  },
  "live-home-kobon-photo-2": {
    file: "live-home-kobon-photo-2.bin",
    sha256: "dbf0b1c0dba2cea36c40be88e113c7c3f1e180ceed9017ba8046c4efe6d25200",
  },
  "live-home-kobon-photo-5": {
    file: "live-home-kobon-photo-5.bin",
    sha256: "13afbbfab64aef7eb628c74e0870f9c7a7d396535877ea8179cb346f4a743849",
  },
  "live-home-lexi-photo-4": {
    file: "live-home-lexi-photo-4.bin",
    sha256: "fe92020a75df57ed294f6972fe7ced03357a8274e3715af405553e1700a924c2",
  },
  "live-home-lexi-photo-2": {
    file: "live-home-lexi-photo-2.bin",
    sha256: "168c6a842d5e910821e8dc52733c37afa0b3aa442156f8f83bff1f1a4b59dfb7",
  },
  "live-home-lexi-photo-3": {
    file: "live-home-lexi-photo-3.bin",
    sha256: "89f2cd9b1b8b2a3bdc55543f2fa34bb37d72443b33e31b0340a86064f3a0ed86",
  },
  "live-home-lexi-photo-1": {
    file: "live-home-lexi-photo-1.bin",
    sha256: "e6d5199455f01ccb963754850aa80c17db65e0cb2d08045799bcdad22c6c819b",
  },
  "live-home-lexi-photo-6": {
    file: "live-home-lexi-photo-6.bin",
    sha256: "3973e4b96695063296eee7129a2e1a90ecc7c499adbed4fea9664b4f1191f60a",
  },
  "live-home-lexi-photo-5": {
    file: "live-home-lexi-photo-5.bin",
    sha256: "bfc6233a2ee4e977ed0bcd8c4d8e10858aab1635e2043d3b1c8818e17f848593",
  },
  "live-home-lexi-photo-7": {
    file: "live-home-lexi-photo-7.bin",
    sha256: "f860cc4cc3c678efdb843ce9092fdb1c0c8c601c179b8dc0ff25fe5fe5423995",
  },
  "live-home-lexi-photo-8": {
    file: "live-home-lexi-photo-8.bin",
    sha256: "6329b4ae26323b4c41d440855cd48a864966e6a0974ad67d80882ab8f3b07fd4",
  },
  "live-home-lexi-photo-11": {
    file: "live-home-lexi-photo-11.bin",
    sha256: "4a75356629e94cb15182c53a53e6e3e6bedb5db9b48348cfed2b76e9c307a038",
  },
  "live-home-lexi-photo-10": {
    file: "live-home-lexi-photo-10.bin",
    sha256: "faf1da39da184ed6c638748bcef6aa20c5e88bbaa299cb9b4fef57cb0c383379",
  },
  "live-home-lexi-photo-9": {
    file: "live-home-lexi-photo-9.bin",
    sha256: "f35afb5c9a72d198cff6d9edb22aafb671128f968810dab0656104ab9cdc118b",
  },
  "live-home-lexi-photo-12": {
    file: "live-home-lexi-photo-12.bin",
    sha256: "a2a85d2ba3faef82697fdfecc26ca9f8851a610aa0f78201dff95ca618573176",
  },
  "live-home-lexi-photo-15": {
    file: "live-home-lexi-photo-15.bin",
    sha256: "25e0aeedb042fd16774ca94c03f58ccf596dc0dc973b429f119b9005eeb2fa5e",
  },
  "live-home-lexi-photo-16": {
    file: "live-home-lexi-photo-16.bin",
    sha256: "63c78c7b247a2058c145f1ad1822e3d16046127ac2f2107c74de396eadfc269f",
  },
  "live-home-lexi-photo-13": {
    file: "live-home-lexi-photo-13.bin",
    sha256: "57bb03bee10a167b5b8f044b98aab73c86933cbd36f9452d26656364ad61c98c",
  },
  "live-home-lexi-photo-14": {
    file: "live-home-lexi-photo-14.bin",
    sha256: "c432df8b4454507cedaf11407418f262e69915b82a22ab1834523f1b95289255",
  },
  "live-home-lexi-photo-19": {
    file: "live-home-lexi-photo-19.bin",
    sha256: "dee65b6ccc55b974f5f194589328de5da8ce229bf9531f0e398043939042900f",
  },
  "live-home-lexi-photo-20": {
    file: "live-home-lexi-photo-20.bin",
    sha256: "ceb5a4b3cc68abc316fbdfeb10fefa546ac3f642b80f65debf29ff05d3d8da08",
  },
  "live-home-lexi-photo-18": {
    file: "live-home-lexi-photo-18.bin",
    sha256: "11e8737185bcb6e7b681a27f35288c39be0aae35a79b6ba36bbec15083ac2c0a",
  },
  "live-home-lexi-photo-17": {
    file: "live-home-lexi-photo-17.bin",
    sha256: "150ddbf64dd6a4f24159e8c874cd4bea87d48f4863a3b5d65c666a411869e07d",
  },
  "live-home-lexi-photo-21": {
    file: "live-home-lexi-photo-21.bin",
    sha256: "d5194a5d63c1aeb0b03f8591816aefbe33b0064974aafbd71c498900654b7f35",
  },
  "live-home-lexi-photo-23": {
    file: "live-home-lexi-photo-23.bin",
    sha256: "d659291dc8b2b1ef142b06830dcf80285d4fb73c8c19d05a7809b4a7622ca1df",
  },
  "live-home-lexi-photo-22": {
    file: "live-home-lexi-photo-22.bin",
    sha256: "6aedbc545ee853854bb9a87379e494311704dd3fabadf2bb3c067a8eb6914eff",
  },
  "live-home-lexi-photo-24": {
    file: "live-home-lexi-photo-24.bin",
    sha256: "403e5dec4bff4ea6edb428b6abc8599c555083593bf07d1f4e7d5f965bb773e4",
  },
  "live-home-lexi-photo-25": {
    file: "live-home-lexi-photo-25.bin",
    sha256: "71fd6b4bf7acd2ebe54b2e968c362c83a6258f20e4d0ad97165eb4e185141cae",
  },
  "live-home-tray-photo-1": {
    file: "live-home-tray-photo-1.bin",
    sha256: "baadf66a440f029125d7bc0517b4f52f5f37e359e3680b83f764266bbbb036bd",
  },
  "live-home-tray-photo-4": {
    file: "live-home-tray-photo-4.bin",
    sha256: "d911fa100c702bf5baf906580f1fd18959626ac8589b1017db7dac62b4bc398f",
  },
  "live-home-tray-photo-2": {
    file: "live-home-tray-photo-2.bin",
    sha256: "bf93b1bda96763c7f8ac281d5e4fe34557e8a763d2bd71e669ade4a6caa346b9",
  },
  "live-home-tray-photo-3": {
    file: "live-home-tray-photo-3.bin",
    sha256: "180279d04b7602e72ae7bb7a5ce198b39bdf173d8a4cb8e429f31c516970c7fc",
  },
  "live-home-tray-photo-6": {
    file: "live-home-tray-photo-6.bin",
    sha256: "8da62e4f41e2a44372541c55225f828aeb991bf264b6dc8f09a733d7d6fe9507",
  },
  "live-home-tray-photo-7": {
    file: "live-home-tray-photo-7.bin",
    sha256: "89a7d2ca79e65b7aacdbbce85ea9ab7b63c75f415439c7d722f98ef735cf57a6",
  },
  "live-home-tray-photo-5": {
    file: "live-home-tray-photo-5.bin",
    sha256: "ae448592ef3e19a6a9039bdb2f9e514859e7638320665fa16a853752c3594c7f",
  },
  "live-home-tray-photo-8": {
    file: "live-home-tray-photo-8.bin",
    sha256: "95686d697785481d4389e2b080176230aa4fed695b957f96013364d78daf7bb3",
  },
  "live-home-tray-photo-10": {
    file: "live-home-tray-photo-10.bin",
    sha256: "6053ca7109453534d031e945c9164b93dcc83bb54b5b39c7ef53c9fc255a9511",
  },
  "live-home-tray-photo-12": {
    file: "live-home-tray-photo-12.bin",
    sha256: "9e1738c38be4f0731d6540b3335fe784c381493102101378257340b3fc13f40f",
  },
  "live-home-tray-photo-9": {
    file: "live-home-tray-photo-9.bin",
    sha256: "cc907406b289246964636e9fc5d6b684d235618e35f2e8da2741282f46da3cd7",
  },
  "live-home-tray-photo-11": {
    file: "live-home-tray-photo-11.bin",
    sha256: "53ad0b52c228039d36e4c07856a63f70d945b50f477823596ea6a65ad1f53672",
  },
  "live-home-tray-photo-13": {
    file: "live-home-tray-photo-13.bin",
    sha256: "18b2f7149262ff9a40ef0e3bee04308a5607043e77730b6d74cb86d5ef05f278",
  },
  "live-home-tray-photo-15": {
    file: "live-home-tray-photo-15.bin",
    sha256: "d2997dae47ded3b34338f48e0581ec2c2683fa2d325ea4f56483607dfe3fa362",
  },
  "live-home-tray-photo-16": {
    file: "live-home-tray-photo-16.bin",
    sha256: "b139aec05f2c15a4856596cc6809459edc57eb7043b95ce9157205fd8a752b8b",
  },
  "live-home-tray-photo-14": {
    file: "live-home-tray-photo-14.bin",
    sha256: "59d9f481477b143fd692a4f4a75b6582e7842038550d337eff3e3a4a2bbc9df9",
  },
  "live-home-tray-photo-18": {
    file: "live-home-tray-photo-18.bin",
    sha256: "fa36c00648e7f9b6272c9b0199d54e5fecfa3ea78bb5582b1a2f2708630392e4",
  },
  "live-home-tray-photo-20": {
    file: "live-home-tray-photo-20.bin",
    sha256: "14ec601639e61d5ce9ccb0aa2ddac742cb642ab800b1f6094ee96f4ad1722729",
  },
  "live-home-tray-photo-19": {
    file: "live-home-tray-photo-19.bin",
    sha256: "cf9ac0e865d584015295984d2b7b9b496a8be4eb1598b71aa86962a003b1416a",
  },
  "live-home-tray-photo-17": {
    file: "live-home-tray-photo-17.bin",
    sha256: "18e0069ad7f0b6fff499387113c36633896a051e27371412170f8786add8d63e",
  },
  "live-home-tray-photo-21": {
    file: "live-home-tray-photo-21.bin",
    sha256: "525145f9ba9b507f8e10d91c85a1347e35b52a4705c196ca467ea013ce102292",
  },
  "live-home-tray-photo-23": {
    file: "live-home-tray-photo-23.bin",
    sha256: "24e48414cb6dea9f0de43f38383cb2e291a74863c1307a668b60f1ff092eaed8",
  },
  "live-home-tray-photo-24": {
    file: "live-home-tray-photo-24.bin",
    sha256: "6267a8b65d9a3f60712b8e92b4233bcbb61d8bf1bb7069cb110ca90d5ee95056",
  },
  "live-home-tray-photo-22": {
    file: "live-home-tray-photo-22.bin",
    sha256: "89dd9b39ceef62bfa55d9f957abdd927eff72f8a7c94a4d55a1327362d820e3a",
  },
  "live-home-tray-photo-26": {
    file: "live-home-tray-photo-26.bin",
    sha256: "1bb0770f589b4d6dbf28492003bd8c2b8f1e539d820059d5b132a8d57cd08106",
  },
  "live-home-tray-photo-27": {
    file: "live-home-tray-photo-27.bin",
    sha256: "ceaba26b73cd9a78ce2fca6db8421655b21819187d099ad97af3779ffbbb014f",
  },
  "live-home-tray-photo-25": {
    file: "live-home-tray-photo-25.bin",
    sha256: "d7d2528bbfae7019906695ff260738d9fbf90580740413c4038f64844bb567c6",
  },
  "live-home-tray-photo-28": {
    file: "live-home-tray-photo-28.bin",
    sha256: "269a3eccdc3c436925c501293dcab6264947ea23b88131f0da92aaa38a7b4512",
  },
  "live-home-tray-photo-31": {
    file: "live-home-tray-photo-31.bin",
    sha256: "e9b966e82ceb5dbd2047b8340c84bbec317cf785a6ea750aa13026641aba3e98",
  },
  "live-home-tray-photo-32": {
    file: "live-home-tray-photo-32.bin",
    sha256: "c8797cbc42be3eea028a8e760b655bc5120aa2e11c7f4494e86fbad19a042883",
  },
  "live-home-tray-photo-29": {
    file: "live-home-tray-photo-29.bin",
    sha256: "a04a8c615e7c5fc4c4605fafd8ec07ce89c7bb1fadb62afff4b32a85485b363b",
  },
  "live-home-tray-photo-30": {
    file: "live-home-tray-photo-30.bin",
    sha256: "c2c2144c34468d24baedadae07aa4863f1aa1fc2188919879dbd72be4336cc61",
  },
  "live-home-tray-photo-35": {
    file: "live-home-tray-photo-35.bin",
    sha256: "10c4d8599410c76ec5d3a8d0d4878d6a58e3c628b479a6d14d13b7cc21ff4459",
  },
  "live-home-tray-photo-33": {
    file: "live-home-tray-photo-33.bin",
    sha256: "a1b2fdb6298962af32f94fe98211dbd5f8eba230e4ac2cdf293bcb167dc63321",
  },
  "live-home-tray-photo-36": {
    file: "live-home-tray-photo-36.bin",
    sha256: "0d66f40b54cc8b5d39e12aa92de1510dfce44b5f65a1b4a475c4eeb22d38f1ee",
  },
  "live-home-tray-photo-34": {
    file: "live-home-tray-photo-34.bin",
    sha256: "c5f95f470b0ea87579026121f2e7d90d3ab5f7d5bab7bd0d778d99ed78301916",
  },
  "live-home-tray-photo-39": {
    file: "live-home-tray-photo-39.bin",
    sha256: "250363ca9ff0b8ecb48d6f075ffc1d2fea3f290caa4d77fb12ca506d3278b853",
  },
  "live-home-tray-photo-38": {
    file: "live-home-tray-photo-38.bin",
    sha256: "26ec26c532be96a1b224069850cc9ee169beef04ed4316bf3accdcf1d216aea6",
  },
  "live-home-tray-photo-40": {
    file: "live-home-tray-photo-40.bin",
    sha256: "17274a567ccd10ee6e131e928e0bfdbb65559d05cc7f6c1f118c517de2eb5a6e",
  },
  "live-home-tray-photo-37": {
    file: "live-home-tray-photo-37.bin",
    sha256: "d62eed7e68f77c871c7acb9f415bec755af29f9e8f8c0884a65570382bce931a",
  },
  "live-home-tray-photo-41": {
    file: "live-home-tray-photo-41.bin",
    sha256: "77bccdaa9c4f2976eb9cc8dcbdfc9f000735ea7b795a6b7b0dd3264ddf419703",
  },
  "live-home-cushion-photo-1": {
    file: "live-home-cushion-photo-1.bin",
    sha256: "b47e6af1932f4f687e723c8fbb0fde296463778793e5756055a3752ad0a3b627",
  },
  "live-home-cushion-photo-2": {
    file: "live-home-cushion-photo-2.bin",
    sha256: "a0dc7bf12cdfc6b333b49e5f002e93184cce123eac237b1eef57a7a5a1e7990a",
  },
  "live-home-cushion-photo-3": {
    file: "live-home-cushion-photo-3.bin",
    sha256: "77db1e8026882eecc63f6f51d0a4f8b8b461237c9d3d827a0d435c191c66a372",
  },
  "live-home-jupiter-photo-1": {
    file: "live-home-jupiter-photo-1.bin",
    sha256: "2a5d61e4a08380738e0d18110827d11672913db3b253d2257fbf567ee2153d70",
  },
  "live-home-jupiter-photo-4": {
    file: "live-home-jupiter-photo-4.bin",
    sha256: "ad865a563be44bab86f04fee9b6f0aff866d7b0a1d8179173ab54f49c25231db",
  },
  "live-home-jupiter-photo-3": {
    file: "live-home-jupiter-photo-3.bin",
    sha256: "6d4ba1aa352096d1cf95f2a1943313fa1523845c0b83daef601bf3a41bcdb527",
  },
  "live-home-jupiter-photo-2": {
    file: "live-home-jupiter-photo-2.bin",
    sha256: "7ca6b0e5245dd1537a6493ba94d1ef9329c1fff70aa1310b410ea5c5749354ca",
  },
  "live-home-jupiter-photo-5": {
    file: "live-home-jupiter-photo-5.bin",
    sha256: "0350e261c3cc5eba4f590930167752924e03973ec0f511adc6eefc09d8cef6a3",
  },
  "live-home-jupiter-photo-6": {
    file: "live-home-jupiter-photo-6.bin",
    sha256: "7788913a41a251d49bf03743555f0f268441b3275a74ee177e98c3529ed42502",
  },
  "live-home-bin-photo-1": {
    file: "live-home-bin-photo-1.bin",
    sha256: "78549aebe99d8487d33ead96d4ce53952629180861796fc1d2f58ad8f590739e",
  },
  "live-home-bin-photo-4": {
    file: "live-home-bin-photo-4.bin",
    sha256: "65837ba6c2e23eda783ee62f6739e005819656942dbcc1077f7e1415487c09cc",
  },
  "live-home-bin-photo-2": {
    file: "live-home-bin-photo-2.bin",
    sha256: "7b1a9f7aeca0dea2fd12fd347a7b535abc5e69da3734cf037ece613bdff06634",
  },
  "live-home-bin-photo-3": {
    file: "live-home-bin-photo-3.bin",
    sha256: "5522b84be611ed3b20d13375701685249a3014fb0554f135333aabaf2edb0bbb",
  },
  "live-home-bin-photo-5": {
    file: "live-home-bin-photo-5.bin",
    sha256: "def8d09acac0356dc51ac3f41f24616523cc254bd61c6b37c7c08a3ef84c1ec0",
  },
  "live-home-olive-native-1": {
    file: "live-home-olive-native-1-source.png",
    sha256: "72aef7f78a8d1f7efcb1854b3724f702bdfc37f2c915d1361088c70690f0a60c",
    rect: [48, 348, 1184, 1444],
  },
  "live-home-olive-logo": {
    file: "live-home-olive-native-1-source.png",
    sha256: "72aef7f78a8d1f7efcb1854b3724f702bdfc37f2c915d1361088c70690f0a60c",
    rect: [60, 192, 96, 96],
  },
  "live-home-kobon-native-1": {
    file: "live-home-kobon-native-1.png",
    sha256: "87ef5f64837da0be35a5137c9c3b066c6152cf5e4f003aa0ba3080146e0e322c",
  },
  "live-home-kobon-ocean-photo-1": {
    file: "live-home-kobon-ocean-photo-1.bin",
    sha256: "535508a4eda1247cb8bca9ddf83a2b8463083be3fa1798e9cc22d1f372d4ce14",
  },
  "live-home-kobon-ocean-photo-4": {
    file: "live-home-kobon-ocean-photo-4.bin",
    sha256: "58170fc2e9f1f16e5e605b2b1d3cb22d5a1f736937cde9a4fbcd21c2c4c1bfd9",
  },
  "live-home-kobon-ocean-photo-3": {
    file: "live-home-kobon-ocean-photo-3.bin",
    sha256: "65c654c89c99ba6b7528b11766b3793e915db934b0c29611e9eadb74f4361f25",
  },
  "live-home-kobon-ocean-photo-2": {
    file: "live-home-kobon-ocean-photo-2.bin",
    sha256: "8f5e0bf68dc9953ef558a5854950469eb88ad4a5481ab33de2dbb6f2f3c45340",
  },
  "live-home-kobon-ocean-photo-5": {
    file: "live-home-kobon-ocean-photo-5.bin",
    sha256: "e8586007c0fb5a1e79ecf4ca56bf36da6b7ed2983d922ebc599a3d840bd41364",
  },
  "live-home-silque-logo": {
    file: "live-home-silque-logo-source.png",
    sha256: "23732f22b21c102261b5686bb2c17544d84153bebd126673e3e345c87225663b",
    rect: [60, 192, 96, 96],
  },
  "live-home-barts-logo": {
    file: "live-home-barts-logo-source.png",
    sha256: "d103ff885fc034dfb7a16ee8a8e42cebbe688378b03b70f042ed688f974a6da0",
    rect: [60, 192, 96, 96],
  },
  "live-home-papasan-logo": {
    file: "live-home-papasan-logo-source.png",
    sha256: "f1e8dce41203ad49ba29f992395029aa431fc7b159db4f17ae3a9066223ee6f6",
    rect: [60, 192, 96, 96],
  },
  "live-home-kobon-logo": {
    file: "live-home-kobon-logo-source.png",
    sha256: "4a2141dec042f9ce8ed6936dd2058648205a1c502d05b72ceeea9c3a3f2c92b4",
    rect: [60, 192, 96, 96],
  },
  "live-home-lexi-logo": {
    file: "live-home-lexi-logo-source.png",
    sha256: "2f57a7839e4c59ed515f2079b4c5ce50118da807983c3c57b586540dfa05e268",
    rect: [60, 192, 96, 96],
  },
  "live-home-tray-logo": {
    file: "live-home-tray-logo-source.png",
    sha256: "3e5778f3b7c82304888d18cff980b440b43beaeeaf5fddb15659f9cd7d414372",
    rect: [60, 192, 96, 96],
  },
  "live-home-cushion-logo": {
    file: "live-home-cushion-logo-source.png",
    sha256: "7eb59aac58fd051c63e0f6a70be616e40c5cfe044d73b83407ac253335d913eb",
    rect: [60, 192, 96, 96],
  },
  "live-home-jupiter-logo": {
    file: "live-home-jupiter-logo-source.png",
    sha256: "0f1ef6ca7d10e6796037dc60432ecc21ca7b195f8d45b97d911413fd760677dc",
    rect: [60, 192, 96, 96],
  },
  "live-home-bin-logo": {
    file: "live-home-bin-logo-source.png",
    sha256: "13b04bdd6d9243bb7dfd595ac044450fbb41a68bc52b31329f16293967a079bf",
    rect: [60, 192, 96, 96],
  },
  "live-home-collection-category-icon": {
    file: "live-home-collection-category-icon-source.png",
    sha256: "35e7d1b2e3f4518b60e2c57c98961b068231f72928444842d804051c5128439f",
    rect: [48, 385, 72, 72],
  },
};
