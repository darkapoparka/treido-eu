import { createHash } from "node:crypto";
import {
  CATEGORY_REGISTRY_VERSION,
  categoryRoots,
  categoryLeaves,
} from "@treido/contracts/categories";

/** Immutable migration snapshot of the owning registry, never an approval seed. */
export function categoryCatalogueSnapshot() {
  return {
    version: CATEGORY_REGISTRY_VERSION,
    categories: [...categoryRoots, ...categoryLeaves].map((category) => ({
      id: category.id,
      kind: category.kind,
      parentId: category.parentId,
      slug: category.slug,
      labels: category.labels,
      profile: category.kind === "leaf" ? category.profile : null,
    })),
    policies: categoryLeaves.map((category) => {
      const { reviewStatus, enabledForPublish, version, ...rules } =
        category.policy;
      return {
        categoryId: category.id,
        country: "BG",
        version,
        state: reviewStatus,
        enabled: enabledForPublish,
        rules,
      };
    }),
  };
}

export function buildCategoryCatalogueMigration() {
  const snapshot = categoryCatalogueSnapshot();
  const hash = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  const json = (value: unknown) =>
    `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  return `-- Version-one physical snapshot. Every leaf is pending and disabled.
-- Source: @treido/contracts/categories; content SHA-256 ${hash}
CREATE TABLE treido.category_registry_versions (
  version integer PRIMARY KEY CHECK(version > 0),
  content_hash varchar(64) NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE treido.categories (
  registry_version integer NOT NULL REFERENCES treido.category_registry_versions(version),
  id varchar(120) NOT NULL, kind text NOT NULL CHECK(kind IN ('root','leaf')),
  parent_id varchar(120), parent_kind text,
  slug varchar(100) NOT NULL, labels jsonb NOT NULL, profile jsonb,
  PRIMARY KEY(registry_version,id), UNIQUE(registry_version,id,kind),
  UNIQUE NULLS NOT DISTINCT(registry_version,parent_id,slug),
  FOREIGN KEY(registry_version,parent_id,parent_kind) REFERENCES treido.categories(registry_version,id,kind),
  CHECK((kind='root' AND parent_id IS NULL AND parent_kind IS NULL AND profile IS NULL) OR
        (kind='leaf' AND parent_id IS NOT NULL AND parent_kind='root' AND profile IS NOT NULL)),
  CHECK(jsonb_typeof(labels)='object' AND labels ?& ARRAY['bg','en'] AND jsonb_typeof(labels->'bg')='string' AND jsonb_typeof(labels->'en')='string')
);
CREATE TABLE treido.category_policies (
  registry_version integer NOT NULL, category_id varchar(120) NOT NULL,
  category_kind text NOT NULL DEFAULT 'leaf' CHECK(category_kind='leaf'),
  country varchar(2) NOT NULL CHECK(country ~ '^[A-Z]{2}$'), version integer NOT NULL CHECK(version > 0),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reviewed','withdrawn')),
  enabled_for_publish boolean NOT NULL DEFAULT false, rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object'),
  review_reference varchar(500), reviewed_at timestamptz,
  PRIMARY KEY(registry_version,category_id,country,version),
  FOREIGN KEY(registry_version,category_id,category_kind) REFERENCES treido.categories(registry_version,id,kind),
  CHECK(NOT enabled_for_publish OR (state='reviewed' AND review_reference IS NOT NULL AND btrim(review_reference)<>'' AND reviewed_at IS NOT NULL)),
  CHECK((state='pending' AND review_reference IS NULL AND reviewed_at IS NULL) OR
        (state IN ('reviewed','withdrawn') AND review_reference IS NOT NULL AND btrim(review_reference)<>'' AND reviewed_at IS NOT NULL))
);
INSERT INTO treido.category_registry_versions(version,content_hash) VALUES(${snapshot.version},'${hash}');
INSERT INTO treido.categories(registry_version,id,kind,parent_id,parent_kind,slug,labels,profile)
SELECT ${snapshot.version},item->>'id',item->>'kind',item->>'parentId',
       CASE WHEN item->>'kind'='leaf' THEN 'root' END,item->>'slug',item->'labels',NULLIF(item->'profile','null'::jsonb)
FROM jsonb_array_elements(${json(snapshot.categories)}) item;
INSERT INTO treido.category_policies(registry_version,category_id,country,version,state,enabled_for_publish,rules)
SELECT ${snapshot.version},item->>'categoryId',item->>'country',(item->>'version')::integer,
       item->>'state',(item->>'enabled')::boolean,item->'rules'
FROM jsonb_array_elements(${json(snapshot.policies)}) item;
`;
}
