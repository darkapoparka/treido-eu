import "server-only";
/** Fixed canonical publication aliases l/p/s. Binding placeholders $2-$5 are identical in display and metric queries. */
export const promotionPaidJoins = `JOIN treido.promotion_campaigns pc ON pc.seller_id=l.seller_id AND pc.listing_id=l.id
 JOIN treido.promotion_purchases pu ON pu.campaign_id=pc.id
 JOIN treido.promotion_reviews pr ON pr.id=pu.review_id
 JOIN treido.promotion_products pp ON pp.id=pr.product_policy_id
 JOIN treido.promotion_attempts pa ON pa.id=pu.attempt_id
 JOIN treido.promotion_checkout_intents ci ON ci.attempt_id=pa.id
 JOIN treido.promotion_payment_bindings pb ON pb.id=ci.payment_binding_id AND pb.product_policy_id=pp.id
 JOIN treido.promotion_customer_bindings cb ON cb.id=ci.customer_binding_id AND cb.seller_id=s.id
 JOIN treido.promotion_intervals pi ON pi.campaign_id=pc.id
 LEFT JOIN treido.promotion_bump_signals bs ON bs.campaign_id=pc.id
 JOIN treido.promotion_reservations r ON r.campaign_id=pc.id
 JOIN treido.promotion_capacity cap ON cap.id=r.capacity_id AND cap.product_policy_id=pp.id`;
export const promotionPaidEligibility = `pa.state='paid' AND pp.product_id=pc.product_id
 AND ci.checkout_session_id=pa.checkout_session_id
 AND pb.purpose='promotion' AND cb.purpose='promotion'
 AND pb.platform_account=pp.platform_account AND cb.platform_account=pp.platform_account
 AND pb.livemode=pp.livemode AND cb.livemode=pp.livemode
 AND pb.environment=pp.environment AND cb.environment=pp.environment
 AND pb.application_id=pp.application_id AND cb.application_id=pp.application_id
 AND pb.approved_at<=clock_timestamp() AND cb.approved_at<=clock_timestamp()
 AND pb.revoked_at IS NULL AND cb.revoked_at IS NULL
 AND pa.platform_account=pp.platform_account AND pa.livemode=pp.livemode
 AND pa.intent->>'environment'=pp.environment AND pa.intent->>'applicationId'=pp.application_id
 AND pa.intent->>'sellerId'=s.id::text AND pa.intent->>'productId'=pc.product_id
 AND pr.listing_revision=p.revision AND pr.category_id=p.category_id AND pr.country=p.country
 AND pp.platform_account=$2 AND pp.environment=$3 AND pp.application_id=$4 AND pp.livemode=$5
 AND pp.revoked_at IS NULL AND pp.approved_at<=clock_timestamp()
 AND pp.version=(SELECT max(latest.version) FROM treido.promotion_products latest WHERE latest.product_id=pp.product_id AND latest.platform_account=pp.platform_account AND latest.environment=pp.environment AND latest.application_id=pp.application_id AND latest.livemode=pp.livemode)
 AND cap.revoked_at IS NULL AND cap.approved_at<=clock_timestamp() AND cap.country=p.country AND cap.category_id=p.category_id AND cap.seller_kind=s.kind
 AND (SELECT count(*) FROM treido.promotion_reservations allocated WHERE allocated.capacity_id=cap.id AND allocated.status IN ('reserved','serving') AND (allocated.expires_at>clock_timestamp() OR EXISTS(SELECT 1 FROM treido.promotion_attempts risking WHERE risking.campaign_id=allocated.campaign_id AND risking.state NOT IN ('prepared','cancelled'))))<=cap.slots
 AND ((pc.product_id='bump_once_v1' AND pc.state='completed' AND pc.reason IS NULL AND bs.seller_id=s.id AND bs.listing_id=l.id AND bs.publication_revision=p.revision AND r.status='released')
 OR (pc.product_id<>'bump_once_v1' AND pc.state='active' AND pi.starts_at<=clock_timestamp() AND pi.ends_at>clock_timestamp() AND r.status='serving'))`;
