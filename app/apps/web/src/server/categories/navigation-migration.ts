import { createHash } from "node:crypto";
import {
  BROWSE_TAXONOMY_VERSION,
  CATEGORY_REGISTRY_VERSION,
  browseCategories,
  getBrowseAncestry,
} from "@treido/contracts/categories";

export function categoryNavigationSnapshot() {
  return {
    version: BROWSE_TAXONOMY_VERSION,
    registryVersion: CATEGORY_REGISTRY_VERSION,
    nodes: browseCategories.map((node) => {
      const path = getBrowseAncestry(node.id);
      const parent = path.at(-2);
      return {
        id: node.id,
        kind: node.kind,
        parentId: node.parentId,
        parentKind: parent?.kind ?? null,
        depth: path.length - 1,
        parentDepth: parent ? path.length - 2 : null,
        labels: node.labels,
        leafId: node.kind === "leaf" ? node.id : null,
        leafKind: node.kind === "leaf" ? "leaf" : null,
      };
    }),
  };
}

/** Additive browse tree; immutable publication categories and policies stay intact. */
export function buildCategoryNavigationMigration() {
  const seed = categoryNavigationSnapshot();
  const hash = createHash("sha256").update(JSON.stringify(seed)).digest("hex");
  const json = `'${JSON.stringify(seed.nodes).replaceAll("'", "''")}'::jsonb`;
  return `-- Browse taxonomy v${seed.version}; publication registry v${seed.registryVersion} is preserved.
-- Content SHA-256 ${hash}; this migration grants no publication approval.
CREATE TABLE treido.category_browse_versions (
  version integer PRIMARY KEY CHECK(version>0),
  registry_version integer NOT NULL REFERENCES treido.category_registry_versions(version),
  content_hash varchar(64) NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE(version,registry_version)
);
CREATE TABLE treido.category_browse_nodes (
  version integer NOT NULL, registry_version integer NOT NULL,
  id varchar(120) NOT NULL, kind text NOT NULL CHECK(kind IN ('root','group','leaf')),
  parent_id varchar(120), parent_kind text, depth integer NOT NULL, parent_depth integer,
  labels jsonb NOT NULL, leaf_id varchar(120), leaf_kind text,
  PRIMARY KEY(version,id), UNIQUE(version,id,kind,depth), UNIQUE(version,leaf_id),
  FOREIGN KEY(version,registry_version) REFERENCES treido.category_browse_versions(version,registry_version),
  FOREIGN KEY(version,parent_id,parent_kind,parent_depth) REFERENCES treido.category_browse_nodes(version,id,kind,depth),
  FOREIGN KEY(registry_version,leaf_id,leaf_kind) REFERENCES treido.categories(registry_version,id,kind),
  CHECK((parent_id IS NULL)=(parent_kind IS NULL) AND (parent_id IS NULL)=(parent_depth IS NULL)),
  CHECK((kind='leaf')=(leaf_id IS NOT NULL) AND (kind='leaf')=(leaf_kind IS NOT NULL)),
  CHECK((kind='root' AND depth=0 AND parent_id IS NULL AND parent_kind IS NULL AND parent_depth IS NULL AND leaf_id IS NULL AND leaf_kind IS NULL) OR
        (kind='group' AND depth=1 AND parent_id IS NOT NULL AND parent_kind='root' AND parent_depth=0 AND leaf_id IS NULL AND leaf_kind IS NULL) OR
        (kind='leaf' AND leaf_id=id AND leaf_kind='leaf' AND parent_id IS NOT NULL AND
          ((depth=1 AND parent_kind='root' AND parent_depth=0) OR (depth=2 AND parent_kind='group' AND parent_depth=1)))),
  CHECK(jsonb_typeof(labels)='object' AND labels ?& ARRAY['bg','en'] AND jsonb_typeof(labels->'bg')='string' AND jsonb_typeof(labels->'en')='string')
);
INSERT INTO treido.category_browse_versions(version,registry_version,content_hash) VALUES(${seed.version},${seed.registryVersion},'${hash}');
INSERT INTO treido.category_browse_nodes(version,registry_version,id,kind,parent_id,parent_kind,depth,parent_depth,labels,leaf_id,leaf_kind)
SELECT ${seed.version},${seed.registryVersion},item->>'id',item->>'kind',item->>'parentId',item->>'parentKind',
       (item->>'depth')::integer,(item->>'parentDepth')::integer,item->'labels',item->>'leafId',item->>'leafKind'
FROM jsonb_array_elements(${json}) item;
`;
}
