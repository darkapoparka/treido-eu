-- UNNUMBERED additive source proposal. Original kinds/authority remain unchanged.
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund','buyer.saved-search','billing.reconcile','promotion.reconcile','payment.aftercare'));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT aftercare_service_only CHECK(kind<>'payment.aftercare' OR (authority='service' AND actor_id IS NULL AND buyer_id IS NULL AND seller_id IS NOT NULL));
