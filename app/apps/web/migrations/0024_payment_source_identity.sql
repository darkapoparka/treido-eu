-- One immutable quote per cart revision/seller or accepted offer. Changing a
-- request UUID cannot renew the original hold or allocate the same source twice.
ALTER TABLE treido.payable_quotes ADD CONSTRAINT payable_quote_source_shape CHECK((
  (source->>'kind'='cart' AND source->>'sellerId'=seller_id::text AND source->>'cartRevision' ~ '^[1-9][0-9]{0,9}$')
  OR (source->>'kind'='offer' AND source->>'threadId' ~ '^[0-9a-f-]{36}$' AND source->>'offerId' ~ '^[0-9a-f-]{36}$')
) IS TRUE);
CREATE UNIQUE INDEX payable_quote_cart_source ON treido.payable_quotes(buyer_id,seller_id,(source->>'cartRevision')) WHERE source->>'kind'='cart';
CREATE UNIQUE INDEX payable_quote_offer_source ON treido.payable_quotes(buyer_id,(source->>'offerId')) WHERE source->>'kind'='offer';
-- Row locks need UPDATE privileges in PostgreSQL. Narrow owner-defined readers
-- retain revocation locks without granting runtime any policy-writing authority.
CREATE FUNCTION treido.lock_payment_policy(uuid,text,boolean,text,text) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT id FROM treido.payment_policies WHERE id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE
$$;
CREATE FUNCTION treido.lock_seller_payment_binding(uuid,text,boolean) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT id FROM treido.seller_payment_bindings WHERE seller_id=$1 AND platform_account=$2 AND livemode=$3 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE
$$;
CREATE FUNCTION treido.lock_payable_listing_terms(uuid,uuid,integer,uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT policy_id FROM treido.payable_listing_terms WHERE seller_id=$1 AND listing_id=$2 AND publication_revision=$3 AND policy_id=$4 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE
$$;
REVOKE ALL ON FUNCTION treido.lock_payment_policy(uuid,text,boolean,text,text),treido.lock_seller_payment_binding(uuid,text,boolean),treido.lock_payable_listing_terms(uuid,uuid,integer,uuid) FROM PUBLIC;
