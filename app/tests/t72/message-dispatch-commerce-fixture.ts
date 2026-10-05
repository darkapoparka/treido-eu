import { randomUUID } from "node:crypto";
import type { imageLifecycleFixture } from "./message-lifecycle-fixture";

/** Synthetic prior commerce records only, in the owned native cluster. Real
 * schema constraints remain enabled; no provider/payment action is performed. */
export async function prepareImageCommerce(
  f: Awaited<ReturnType<typeof imageLifecycleFixture>>,
) {
  const admin = f.context.admin;
  const sku = randomUUID(),
    offer = randomUUID(),
    allocation = randomUUID();
  const revision = (
    await admin.query(
      "SELECT current_publication_revision FROM treido.listings WHERE id=$1",
      [f.listingId],
    )
  ).rows[0].current_publication_revision;
  await admin.query(
    "INSERT INTO treido.inventory_catalogues(seller_id,listing_id,seller_kind,mode) VALUES($1,$2,'business','stocked')",
    [f.sellerId, f.listingId],
  );
  await admin.query(
    "INSERT INTO treido.inventory_skus(id,seller_id,listing_id,mode,option_key,price_minor,on_hand) VALUES($1,$2,$3,'stocked',$4,100,1)",
    [sku, f.sellerId, f.listingId, "c".repeat(64)],
  );
  await admin.query(
    "INSERT INTO treido.inventory_publications(seller_id,listing_id,publication_revision,mode,inventory_revision) VALUES($1,$2,$3,'stocked',1)",
    [f.sellerId, f.listingId, revision],
  );
  await admin.query(
    "INSERT INTO treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id,options,price_minor,currency) VALUES($1,$2,$3,$4,'{}',100,'EUR')",
    [f.sellerId, f.listingId, revision, sku],
  );
  await admin.query(
    "INSERT INTO treido.inventory_allocations(id,seller_id,buyer_id,purpose,source_id,input_hash,state,expires_at) VALUES($1,$2,$3,'offer',$4,$5,'released',clock_timestamp()+interval '1 hour')",
    [allocation, f.sellerId, f.buyer.userId, offer, "d".repeat(64)],
  );
  await admin.query(
    "INSERT INTO treido.listing_offers(id,thread_id,seller_id,listing_id,buyer_id,proposer_id,proposer_side,publication_revision,sku_id,quantity,unit_price_minor,expires_at,state,sequence,allocation_id) VALUES($1,$2,$3,$4,$5,$5,'buyer',$6,$7,1,100,clock_timestamp()+interval '1 hour','cancelled',1,$8)",
    [
      offer,
      f.threadId,
      f.sellerId,
      f.listingId,
      f.buyer.userId,
      revision,
      sku,
      allocation,
    ],
  );
  await admin.query(
    "INSERT INTO treido.inventory_allocation_lines(allocation_id,seller_id,listing_id,sku_id,publication_revision,quantity,unit_price_minor,currency) VALUES($1,$2,$3,$4,$5,1,100,'EUR')",
    [allocation, f.sellerId, f.listingId, sku, revision],
  );
  const policy = randomUUID(),
    binding = randomUUID(),
    quote = randomUUID();
  await admin.query(
    "INSERT INTO treido.payment_policies(id,platform_account,livemode,environment,application_id,currency,fee_bps,fee_fixed_minor,tax_policy,handover,settlement_merchant,refund_policy,buyer_terms,approval_reference,approved_at) VALUES($1,'acct_DispatchPlatform',false,'test','dispatch-native','EUR',0,0,'inclusive','pickup','seller','full_fee_and_transfer_reversal',$2::jsonb,'SYNTHETIC OWNED DISPATCH TEST',clock_timestamp())",
    [policy, JSON.stringify({ bg: "Синтетично", en: "Synthetic" })],
  );
  await admin.query(
    "INSERT INTO treido.seller_payment_bindings(id,seller_id,platform_account,livemode,connected_account,approval_reference,approved_at) VALUES($1,$2,'acct_DispatchPlatform',false,$3,'SYNTHETIC OWNED DISPATCH TEST',clock_timestamp())",
    [binding, f.sellerId, "acct_D" + randomUUID().replaceAll("-", "")],
  );
  const client = await admin.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO treido.payable_quotes(id,buyer_id,seller_id,request_id,input_hash,allocation_id,policy_id,binding_id,platform_account,livemode,connected_account,currency,total_minor,application_fee_minor,terms_snapshot,seller_name,language,source,expires_at) SELECT $1,$2,$3,$4,$5,a.id,$6,b.id,b.platform_account,b.livemode,b.connected_account,'EUR',100,0,$8::jsonb,'Synthetic','en',$9::jsonb,a.expires_at FROM treido.inventory_allocations a JOIN treido.seller_payment_bindings b ON b.id=$7 WHERE a.id=$10",
      [
        quote,
        f.buyer.userId,
        f.sellerId,
        randomUUID(),
        "e".repeat(64),
        policy,
        binding,
        JSON.stringify({
          settlementMerchant: "seller",
          buyerTerms: "Synthetic",
          handover: "pickup",
        }),
        JSON.stringify({ kind: "offer", threadId: f.threadId, offerId: offer }),
        allocation,
      ],
    );
    await client.query(
      "INSERT INTO treido.payable_quote_lines(quote_id,seller_id,listing_id,sku_id,publication_revision,position,title,options,quantity,unit_price_minor,delivery_details) VALUES($1,$2,$3,$4,$5,0,'Synthetic','{}',1,100,'Synthetic pickup')",
      [quote, f.sellerId, f.listingId, sku, revision],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const attempt = () =>
    admin.query(
      "INSERT INTO treido.payment_attempts(id,quote_id,seller_id,platform_account,livemode,operation_key,api_version,parameters,parameter_hash,cancel_key) VALUES($1,$2,$3,'acct_DispatchPlatform',false,$4,'synthetic','{}',$5,$6)",
      [
        randomUUID(),
        quote,
        f.sellerId,
        "dispatch:" + randomUUID(),
        "f".repeat(64),
        "cancel:" + randomUUID(),
      ],
    );
  const acceptedEvent = () =>
    admin.query(
      "INSERT INTO treido.offer_events(id,thread_id,offer_id,actor_id,kind) VALUES($1,$2,$3,$4,'accepted')",
      [randomUUID(), f.threadId, offer, f.counterpart.userId],
    );
  const acceptedOffer = () =>
    admin.query(
      "UPDATE treido.listing_offers SET state='accepted',revision=revision+1 WHERE id=$1",
      [offer],
    );
  return { quote, offer, attempt, acceptedEvent, acceptedOffer };
}
