# Categories, attributes and item policy

Version 1 registry, September 30, 2026. Owns `GLOBAL-TAXONOMY`; [PRD](../prd.md) owns product acceptance and [tasks](../tasks.md) owns implementation. The additive [catalogue migration](../app/apps/web/migrations/0005_category_catalogue.sql) persists its snapshot with all publication policies pending and disabled. No policy approval or live database application is implied. Derived from the Amazong taxonomy and older Treido category work, expanded for general physical goods. Food, property and service marketplace requirements do not carry into this product.

## Runtime contract

The shared [category module](../app/packages/contracts/src/categories/index.ts), exported as `@treido/contracts/categories`, implements version 1's 16 roots and 152 bilingual leaves. IDs are stored explicitly, separately from display slugs/labels, so a future reviewed rename need not create a new identity. Lookup, parent/child ancestry, BG/EN labels with BG fallback and bounded draft-category search use this single catalogue. The existing `@treido/contracts` locale export remains independent.

Nine attribute profiles supply localized field labels and leaf-specific requirements for all seven declared value types. `validateCategoryAttributes(categoryId, input)` validates complete category attributes; its explicit partial mode permits missing draft fields while still checking every supplied value. `validateListingCategory(input, "draft")` also checks the registry version, leaf ID, seller kind, condition and BG country policy. Unknown/private attributes, unsupported units, malformed decimal/date values, unsupported choices and inconsistent fitment/carrier declarations fail validation.

Draft writes require a persisted stable leaf but permit pending-policy drafts. Runtime cannot write catalogue/policy tables. Public category projections and new contact require the latest reviewed/enabled BG policy; a newer pending or withdrawn version suppresses the old one. The migration checksum protects replay from overwriting later review records. Actual review evidence is separate from the copied attribute definitions.

The default `validateListingCategory(input)` uses publication mode. Every current leaf has a pending policy and `enabledForPublish=false`; publication is denied until a reviewed policy and working selling path qualify it. Candidate handover/purchase modes in that pending policy do not claim an available carrier or checkout adapter. This module does not authenticate, create a seller, save a draft or seed a database. A server command derives seller kind from the currently authorized seller and separately enforces media, ownership, membership, moderation, quota and applicable expiry/refurbishment declarations. Those integrations remain with T04/T06/T23c; T23b consumes the field definitions in the category picker.

## Browse hierarchy and mobile names — October 7, 2026

The owner requests shorter consistent labels, Garden separate from Tools/DIY, and useful grouping for a broad marketplace. The single versioned [browse taxonomy](../app/packages/contracts/src/categories/navigation.ts) has **17 departments, 36 groups and the same 152 publication leaves**. Crowded departments use department → group → leaf; Garden and Gaming skip a redundant single group. Public category filters resolve a department or group to explicit descendant leaf IDs. Brand, condition and seller kind remain separate filters.

Publication registry v1 and migration 0005 stay immutable. The additive [browse migration 0053](../app/apps/web/migrations/0053_category_navigation.sql) persists this tree with existing-leaf, parent-kind and depth foreign keys/checks. Runtime roles can read it and cannot change it. Navigation never grants publication approval. Existing listing/order snapshots retain their category IDs and policy versions. The compiled browse definition and its migration must match; application to an intended shared database requires its own integration evidence.

Garden has the new browse ID cat:garden and the existing garden-tools, garden-furniture, barbecues-outdoor-living and pots-planters leaf IDs. The stable cat:garden-diy browse entry now contains the other seven leaves under Tools/DIY. Leaf IDs containing garden-diy remain valid; their strings do not determine their current browse parent. Use recorded ancestry, never split IDs. Intermediate groups use nav: IDs and cannot be publication categories.

Owner-requested filter-testing supply belongs only to an explicitly qualified isolated Preview database. Synthetic category policy/declaration records are labelled TEST ONLY and grant no shared-development or production approval. Seeded accepted snapshots exercise real public eligibility, browse descendants, attribute/condition/price/location/seller filters, pagination and media reads; they do not establish actual seller identity, publication-command/quota/processing or provider-commerce acceptance. The owning task records the exact target, dataset, preservation digests and readback evidence. The application never imports the seed or falls back to these fixtures when a database read fails.

| Department ID | BG display name | EN display name |
|---|---|---|
| cat:electronics | Електроника | Electronics |
| cat:fashion | Мода | Fashion |
| cat:home | Дом | Home |
| cat:appliances | Уреди | Appliances |
| cat:garden | Градина | Garden |
| cat:garden-diy | Инструменти и ремонт | Tools and DIY |
| cat:sports-outdoors | Спорт и туризъм | Sports and outdoors |
| cat:baby-kids | Бебе и дете | Baby and kids |
| cat:beauty-care | Красота | Beauty |
| cat:books-media | Книги и медии | Books and media |
| cat:hobbies-collectibles | Хоби и колекции | Hobbies and collectibles |
| cat:music | Музика | Music |
| cat:gaming | Гейминг | Gaming |
| cat:motors-parts | Авточасти | Auto parts |
| cat:pet-supplies | Домашни любимци | Pets |
| cat:business-equipment | Бизнес оборудване | Business equipment |
| cat:art-handmade | Изкуство и занаяти | Art and handmade |

These shorter browse labels are separate from full publication labels below. Each UI role has one consistent font/size. Explore headings, tile titles, category pills and filter-sheet titles stay on one line with ellipsis; complete text remains accessible, and tile labels also appear on hover. Do not shrink individual labels. “Домашни любимци” names the department and keeps the prohibition on live animals.

This organized v1 tree is **not an exhaustive eBay-scale taxonomy**. More precise leaves are still needed within clothing, computing accessories, furniture, collectibles and professional equipment. Add them through reviewed versioned catalogue/policy migrations with explicit old-ID compatibility and typed attributes. Do not invent an Other category or count empty navigation as available inventory. Retaining all 152 leaves is a measurable compatibility boundary, not a completeness claim.

## Seller category preparation

The [selling form](../app/apps/web/src/features/selling/selling-form.tsx) at `/sell` uses this registry for bilingual root/leaf navigation and search, allowed conditions and all seven attribute control types. Roots open subcategories; only a leaf proceeds to details. Changing language or going Back preserves entered values, and category switching keeps each category's separate in-page preparation. Review validates complete attributes, including conditional carrier/fitment fields and affirmative sealed/unworn requirements. Unknown boolean answers remain distinct from an explicit no. Profile has a “Sell an item” entry.

Details show required attributes first, with optional fields under “More details”. Entered optional values remain in the preparation when the section closes; returning to details opens it when values are present. Validation opens the section before focusing an invalid or conditionally required field. Numeric units stay visible in labels/controls; schema bounds appear as help for invalid values. Category navigation retains its search/root context on Back and returns keyboard focus when drilling into or leaving a root.

The copied Shop reference's “Start selling for free” entry links to Shopify rather than an item-listing wizard. Shopify's [Shop product management documentation](https://help.shopify.com/en/manual/online-sales-channels/shop/manage-shop-store/products-and-collections) describes managing products through Shopify admin. Treido therefore uses the existing Shop form vocabulary for its own marketplace selling flow; it does not claim a native Shop selling-screen match.

“Save on this device” stores one validated, versioned category preparation in this browser. Reload offers explicit restoration; stale, malformed, oversized or unsupported data is rejected. Browser storage failures show an error and retain the open form. This buffer has no user/seller identifier and grants no permissions; it is not an account draft, media upload, database write or published listing. Publication remains disabled while leaf policies are pending. T04/T06 supply identity, account drafts, photos/pricing and the authorized selling commands; T23c supplies reviewed publication policy.

## Taxonomy contract

The immutable publication registry v1 below contains sixteen physical-goods roots and 152 leaves. The browse hierarchy above supplies the current department/group parents and short labels. Each bullet is a publication leaf with an English slug and Bulgarian/English labels. Its immutable seed ID is `cat:<root>/<leaf>`; the publication root ID is `cat:<root>`. Slugs are URL vocabulary, not translated IDs. A listing selects one leaf; versioned browse ancestry supplies counts and navigation. Brand, audience, condition and seller type are attributes rather than duplicated category trees.

Seeded categories do not grant permission to expose every kind of item in them. Every leaf has a versioned policy: allowed seller kinds, condition, fulfilment and purchase modes; prohibited-item rules; required attribute profile; country availability; and `enabled_for_publish`. A leaf stays disabled until its policy is reviewed and its sell/search/detail path works. A parent can appear in navigation without presenting unavailable children as usable options. Never classify an unsafe item under Miscellaneous to bypass policy.

The publication registry v1 records root and leaf; browse v1 adds the useful intermediate groups documented above. Category IDs remain stable through a rename/reparent. Retired categories map to reviewed successors, preserve historical order snapshots and require revalidation before edited listings republish. Versioned migrations seed and validate the shared catalogue and browse tree; no manual competing frontend arrays.

## Catalogue

### electronics — Електроника / Electronics

- `phones` — Телефони / Phones
- `tablets` — Таблети / Tablets
- `laptops` — Лаптопи / Laptops
- `desktop-computers` — Настолни компютри / Desktop computers
- `computer-components` — Компютърни компоненти / Computer components
- `monitors` — Монитори / Monitors
- `computer-accessories` — Компютърни аксесоари / Computer accessories
- `televisions-projectors` — Телевизори и проектори / TVs and projectors
- `headphones` — Слушалки / Headphones
- `speakers-audio` — Тонколони и аудио / Speakers and audio
- `cameras-lenses` — Фотоапарати и обективи / Cameras and lenses
- `smartwatches-wearables` — Смарт часовници / Smartwatches and wearables
- `smart-home-networking` — Умен дом и мрежи / Smart home and networking
- `phone-accessories` — Аксесоари за телефони / Phone accessories

### fashion — Мода / Fashion

- `tops-shirts` — Блузи и ризи / Tops and shirts
- `trousers-jeans` — Панталони и дънки / Trousers and jeans
- `dresses` — Рокли / Dresses
- `skirts` — Поли / Skirts
- `knitwear` — Пуловери и жилетки / Knitwear
- `jackets-coats` — Якета и палта / Jackets and coats
- `suits-occasionwear` — Костюми и официално облекло / Suits and occasionwear
- `sportswear` — Спортно облекло / Sportswear
- `shoes` — Обувки / Shoes
- `bags` — Чанти / Bags
- `watches` — Часовници / Watches
- `jewellery` — Бижута / Jewellery
- `accessories` — Модни аксесоари / Fashion accessories
- `unworn-intimates-swimwear` — Неносено бельо и бански / Unworn intimates and swimwear

Audience is women/men/unisex; age, size system and size are typed fields. Children's clothing belongs to baby-kids rather than a second copy of the same listing.

### home — Дом и обзавеждане / Home and furniture

- `living-room-furniture` — Мебели за дневна / Living room furniture
- `bedroom-furniture` — Мебели за спалня / Bedroom furniture
- `tables-chairs` — Маси и столове / Tables and chairs
- `storage-shelving` — Шкафове и етажерки / Storage and shelving
- `lighting` — Осветление / Lighting
- `rugs-curtains` — Килими и завеси / Rugs and curtains
- `bedding-textiles` — Спално бельо и текстил / Bedding and textiles
- `cookware` — Съдове за готвене / Cookware
- `tableware` — Сервизи и прибори / Tableware
- `decor` — Декорация / Decor
- `bathroom-storage` — Аксесоари за баня / Bathroom accessories
- `household-organisation` — Организация на дома / Household organisation

### appliances — Домакински уреди / Appliances

- `washing-drying` — Перални и сушилни / Washing and drying
- `refrigeration` — Хладилници и фризери / Refrigeration
- `ovens-hobs` — Фурни и котлони / Ovens and hobs
- `dishwashers` — Съдомиялни / Dishwashers
- `small-kitchen-appliances` — Малки кухненски уреди / Small kitchen appliances
- `coffee-machines` — Кафемашини / Coffee machines
- `cleaning-appliances` — Прахосмукачки и почистващи уреди / Cleaning appliances
- `heating-cooling` — Отопление и охлаждане / Heating and cooling
- `sewing-machines` — Шевни машини / Sewing machines

### garden-diy — Градина, инструменти и ремонт / Garden, tools and DIY

- `hand-tools` — Ръчни инструменти / Hand tools
- `power-tools` — Електрически инструменти / Power tools
- `tool-accessories` — Аксесоари за инструменти / Tool accessories
- `garden-tools` — Градински инструменти / Garden tools
- `garden-furniture` — Градински мебели / Garden furniture
- `barbecues-outdoor-living` — Барбекюта и оборудване за двора / Outdoor living
- `pots-planters` — Саксии и кашпи / Pots and planters
- `building-materials` — Строителни материали / Building materials
- `plumbing-fittings` — ВиК части / Plumbing fittings
- `electrical-fittings` — Електрически части / Electrical fittings
- `workwear-safety-equipment` — Работно облекло и защитно оборудване / Workwear and safety equipment

### sports-outdoors — Спорт и туризъм / Sports and outdoors

- `fitness-equipment` — Фитнес оборудване / Fitness equipment
- `bicycles` — Велосипеди / Bicycles
- `cycling-parts` — Части и аксесоари за велосипеди / Cycling parts and accessories
- `camping-hiking` — Къмпинг и туризъм / Camping and hiking
- `team-sports` — Отборни спортове / Team sports
- `racket-sports` — Ракетни спортове / Racket sports
- `water-sports` — Водни спортове / Water sports
- `winter-sports` — Зимни спортове / Winter sports
- `fishing-equipment` — Риболовно оборудване / Fishing equipment
- `skating-scooters` — Ролери, скейтбордове и тротинетки / Skating and scooters
- `outdoor-clothing` — Облекло за туризъм / Outdoor clothing

### baby-kids — Бебе и дете / Baby and kids

- `baby-clothing` — Бебешки дрехи / Baby clothing
- `kids-clothing` — Детски дрехи / Kids clothing
- `kids-shoes` — Детски обувки / Kids shoes
- `toys` — Играчки / Toys
- `strollers` — Колички / Strollers
- `nursery-furniture` — Обзавеждане за детска стая / Nursery furniture
- `feeding-accessories` — Аксесоари за хранене / Feeding accessories
- `baby-carriers` — Раници и слингове / Baby carriers
- `school-supplies` — Ученически принадлежности / School supplies

Safety-critical or recalled child products require specific policy. Used child car seats are excluded from v1; a toy label does not override an age/safety restriction.

### beauty-care — Красота и лична грижа / Beauty and personal care

- `sealed-skincare` — Запечатана козметика за лице / Sealed skincare
- `sealed-makeup` — Запечатан грим / Sealed makeup
- `sealed-fragrance` — Запечатани парфюми / Sealed fragrance
- `hair-styling-appliances` — Уреди за коса / Hair styling appliances
- `grooming-appliances` — Уреди за лична грижа / Grooming appliances
- `beauty-tools` — Козметични инструменти / Beauty tools
- `sealed-bath-body` — Запечатана козметика за тяло / Sealed bath and body

No opened cosmetics, medicines, supplements, medical claims or diagnosis flows. Products must meet the leaf's hygiene, expiry and authenticity rules. Dangerous-goods shipping restrictions remain explicit for fragrance/batteries.

### books-media — Книги и медии / Books and media

- `fiction` — Художествена литература / Fiction
- `non-fiction` — Нехудожествена литература / Non-fiction
- `textbooks` — Учебници / Textbooks
- `children-books` — Детски книги / Children's books
- `comics-manga` — Комикси и манга / Comics and manga
- `magazines` — Списания / Magazines
- `vinyl-cds` — Плочи и дискове / Vinyl and CDs
- `films-disc-media` — Филми на физически носител / Films on physical media

### hobbies-collectibles — Хоби и колекционерство / Hobbies and collectibles

- `board-games` — Настолни игри / Board games
- `trading-cards` — Колекционерски карти / Trading cards
- `models-miniatures` — Модели и миниатюри / Models and miniatures
- `stamps-coins` — Марки и колекционерски монети / Stamps and collectible coins
- `collectible-figures` — Колекционерски фигури / Collectible figures
- `antiques` — Антики / Antiques
- `craft-supplies` — Материали за творчество / Craft supplies
- `sewing-knitting` — Шиене и плетене / Sewing and knitting
- `photography-accessories` — Фото аксесоари / Photography accessories
- `radio-controlled-hobby` — Радиоуправляеми модели / Radio-controlled hobbies

No currency exchange, financial assets or protected antiquities. Authenticity/provenance claims need supporting evidence; unknown history remains unknown.

### music — Музикални инструменти / Musical instruments

- `guitars-basses` — Китари и бас китари / Guitars and basses
- `keyboards-pianos` — Клавишни и пиана / Keyboards and pianos
- `drums-percussion` — Барабани и ударни / Drums and percussion
- `wind-instruments` — Духови инструменти / Wind instruments
- `string-instruments` — Струнни инструменти / String instruments
- `studio-recording` — Студио и запис / Studio and recording
- `dj-equipment` — DJ оборудване / DJ equipment
- `amplifiers-effects` — Усилватели и ефекти / Amplifiers and effects
- `instrument-accessories` — Аксесоари за инструменти / Instrument accessories

### gaming — Гейминг / Gaming

- `consoles` — Конзоли / Consoles
- `physical-games` — Игри на физически носител / Physical games
- `controllers` — Контролери / Controllers
- `gaming-peripherals` — Гейминг периферия / Gaming peripherals
- `vr-equipment` — VR оборудване / VR equipment
- `gaming-furniture` — Гейминг мебели / Gaming furniture
- `console-accessories` — Аксесоари за конзоли / Console accessories

Digital keys, accounts and licensed account transfers are outside physical-goods v1.

### motors-parts — Авточасти и аксесоари / Motors parts and accessories

- `car-parts` — Авточасти / Car parts
- `motorcycle-parts` — Части за мотоциклети / Motorcycle parts
- `tyres-wheels` — Гуми и джанти / Tyres and wheels
- `car-electronics` — Автомобилна електроника / Car electronics
- `interior-accessories` — Интериорни аксесоари / Interior accessories
- `roof-racks-carriers` — Багажници и стойки / Roof racks and carriers
- `garage-equipment` — Гаражно оборудване / Garage equipment
- `car-care-tools` — Инструменти за автомобилна грижа / Car care tools
- `motorcycle-accessories` — Аксесоари за мотоциклети / Motorcycle accessories

Fitment is structured by make/model/year/part reference where supported. Whole vehicles, vehicle finance, airbags and other safety-critical restricted components need distinct policy/tasks; the existing Cars product is a reference, not a shared backend.

### pet-supplies — Аксесоари за домашни любимци / Pet supplies

- `beds-furniture` — Легла и мебели / Beds and furniture
- `carriers-travel` — Транспортни чанти и клетки / Carriers and travel
- `leads-collars` — Поводи и нашийници / Leads and collars
- `toys` — Играчки / Toys
- `grooming-tools` — Инструменти за груминг / Grooming tools
- `aquarium-equipment` — Аквариумно оборудване / Aquarium equipment
- `bird-small-pet-equipment` — Оборудване за птици и малки животни / Bird and small pet equipment

No live animals, veterinary medicines or pet-food lane in this general-goods release.

### business-equipment — Офис и бизнес оборудване / Office and business equipment

- `office-furniture` — Офис мебели / Office furniture
- `printers-scanners` — Принтери и скенери / Printers and scanners
- `office-supplies` — Офис консумативи / Office supplies
- `retail-equipment` — Оборудване за магазини / Retail equipment
- `hospitality-equipment` — Оборудване за заведения / Hospitality equipment
- `packaging` — Опаковки / Packaging
- `workshop-equipment` — Оборудване за работилници / Workshop equipment
- `professional-tools` — Професионални инструменти / Professional tools

Commercial equipment may use contact/pickup when supported shipping is unavailable. Industrial hazards, medical equipment and controlled goods remain outside enabled policy.

### art-handmade — Изкуство и ръчна изработка / Art and handmade

- `original-art` — Авторско изкуство / Original art
- `prints-posters` — Принтове и плакати / Prints and posters
- `handmade-home` — Ръчно изработени изделия за дома / Handmade home goods
- `handmade-accessories` — Ръчно изработени аксесоари / Handmade accessories
- `ceramics` — Керамика / Ceramics
- `stationery-gifts` — Картички и подаръци / Stationery and gifts
- `seasonal-decor` — Сезонна декорация / Seasonal decor

Maker/origin statements are optional evidence-backed attributes. Do not restore the food/manufacturer product's mandatory Bulgarian-origin rule.

## Attributes, condition and search facets

Common required listing fields: leaf, title, description, item photos, seller, condition, known defects, amount/currency, inventory mode, public locality and supported handover. Refurbished status includes who refurbished it and the explicit warranty claim if any. Condition values are `new`, `new_other`, `like_new`, `good`, `fair`, `for_parts`, `refurbished`; each leaf exposes only applicable options. New condition never means verified; business never means new.

| Attribute profile    | Typed fields, required when the leaf depends on them                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Fashion              | audience, size system/value, brand, colour, material; footwear size; counterfeit/condition disclosures                            |
| Phones/computing     | brand/model, storage/RAM, carrier/lock status, functional defects; battery state if declared; private serial numbers never public |
| Cameras/audio        | brand/model, mount/connection, working status, included accessories                                                               |
| Furniture/appliances | dimensions/unit, material or model, working condition, collection/shipping constraints                                            |
| Sports/kids          | sport/age range, size, model, safety/recall declarations where applicable                                                         |
| Beauty               | sealed state, brand/product type, expiry/batch where necessary, compliant seller disclosures                                      |
| Books/media          | title, author/creator, language, format, ISBN when applicable; ISBN is not proof of condition                                     |
| Parts                | part number, supported fitment source, make/model/year; unsupported compatibility is not inferred                                 |
| Equipment/art        | dimensions, working status/material, provenance or maker claim where relevant                                                     |

Attributes use versioned definitions (`text`, `enum`, `multi_enum`, `integer`, `decimal`, `boolean`, `dimension`). Explicit units and value bounds; leaf overrides are controlled. Unknown differs from false. Facets derive from eligible records under the current seller scope and query. Audience/brand autocomplete never creates a new public taxonomy node automatically.

## Acceptance and migration

T23 seeds unique IDs/slugs, both labels, leaf-policy bindings and profiles; tests orphan/cycle/duplicate IDs, unsupported attributes, invalid units, disabled leaves, renamed paths and locale fallback. Publishing and import call the same validator. Search counts, AI tools and category navigation use the same registry. Existing Shop categories remain available only through the reference adapter for comparison. Orders retain their historical category/attribute snapshots.
