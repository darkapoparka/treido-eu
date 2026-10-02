import "server-only";
/** Fixed aliases l=listing, s=seller, p=accepted snapshot, c=current policy. No request SQL. */
export const publishedJoins = `FROM treido.listings l
 JOIN treido.seller_accounts s ON s.id=l.seller_id
 JOIN treido.listing_publications p ON p.seller_id=l.seller_id AND p.listing_id=l.id AND p.revision=l.current_publication_revision
 JOIN treido.category_policies c ON c.registry_version=p.registry_version AND c.category_id=p.category_id AND c.country=p.country AND c.version=p.category_policy_version`;
export const publishedEligibility = `l.publication='published' AND l.moderation_state='clear' AND s.status='active' AND s.kind=p.seller_kind
 AND c.registry_version=1 AND c.country='BG' AND c.state='reviewed' AND c.enabled_for_publish
 AND c.review_reference IS NOT NULL AND btrim(c.review_reference)<>''
 AND c.version=(SELECT max(latest.version) FROM treido.category_policies latest WHERE latest.registry_version=c.registry_version AND latest.category_id=c.category_id AND latest.country=c.country)
 AND c.rules->'sellerKinds' ? s.kind AND c.rules->'conditions' ? (p.payload->>'condition')
 AND c.rules->'countries' ? p.country AND c.rules->'purchaseModes' ? 'contact'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.terms->'handover') AS modes(value) WHERE NOT(c.rules->'handoverModes' ? modes.value))
 AND ((s.kind='personal' AND p.terms->>'personalSale'='true') OR (s.kind='business' AND EXISTS(
   SELECT 1 FROM treido.seller_declarations d WHERE d.seller_id=s.id AND d.revision=p.declaration_revision
   AND d.status='accepted' AND d.country=p.country AND d.requirement_version=1
   AND d.revision=(SELECT max(latest.revision) FROM treido.seller_declarations latest WHERE latest.seller_id=s.id))))
 AND EXISTS(SELECT 1 FROM treido.listing_publication_media pm WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision)
 AND NOT EXISTS(SELECT 1 FROM treido.listing_publication_media pm JOIN treido.media_assets a ON a.id=pm.asset_id
   WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision
   AND (a.seller_id<>l.seller_id OR a.listing_id<>l.id OR a.state<>'ready' OR a.revision<>pm.asset_revision
      OR a.derivative_checksum IS DISTINCT FROM pm.checksum OR a.width IS DISTINCT FROM pm.width OR a.height IS DISTINCT FROM pm.height))`;
