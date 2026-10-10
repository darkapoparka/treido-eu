import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { authorizeOperator } from "../trust/reports.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { parseSupportCommand, supportTransition, type SupportReceipt, type SupportTicket, type SupportEntry, type SupportView } from "./model";

/** Restricted humans retain this narrow own-support path, not marketplace writes. */
async function supportHuman(tx: SellerTransaction, identity: VerifiedIdentity, write: boolean, create = false) {
  if (!/^user_[A-Za-z0-9_-]{1,120}$/.test(identity.subject)) throw new SellerError("UNAUTHENTICATED");
  let user = (await tx.client.query<{id: string; status: string}>(
    `SELECT id,status FROM treido.users WHERE clerk_subject=$1 FOR ${write ? "UPDATE" : "SHARE"}`, [identity.subject],
  )).rows[0];
  if (!user && create) user = await authorizeHuman(tx, identity, true);
  if (!user) throw new SellerError("NOT_FOUND");
  if (!["active", "restricted"].includes(user.status)) throw new SellerError("FORBIDDEN");
  return user;
}
async function actor(tx: SellerTransaction, identity: VerifiedIdentity, operator: boolean, write: boolean, create = false) {
  if (!operator) return supportHuman(tx, identity, write, create);
  const user = await authorizeOperator(tx, identity, write ? "moderation.write" : "reports.read");
  if (write) await tx.client.query("SELECT id FROM treido.users WHERE id=$1 FOR UPDATE", [user.id]);
  return user;
}
function matchActor(identity: VerifiedIdentity, actorKey: string) {
  if (actorKey !== libraryActorKey(identity)) throw new SellerError("FORBIDDEN");
}
export async function changeSupport(db: SellerDatabase, identity: VerifiedIdentity, raw: unknown, operator = false): Promise<SupportReceipt> {
  const command = parseSupportCommand(raw);
  matchActor(identity, command.actorKey);
  if (operator && command.kind === "create") throw new SellerError("FORBIDDEN");
  if (!operator && command.kind === "note") throw new SellerError("FORBIDDEN");
  return inTransaction(db, async tx => {
    const user = await actor(tx, identity, operator, true, command.kind === "create");
    const hash = inputHash({ ...command, operator });
    const previous = (await tx.client.query<{ticketId: string; hash: string; result: SupportReceipt}>(
      'SELECT ticket_id AS "ticketId",input_hash AS hash,result FROM treido.support_command_receipts WHERE actor_id=$1 AND request_id=$2',
      [user.id, command.requestId],
    )).rows[0];
    const ticketId = command.ticketId ?? previous?.ticketId ?? randomUUID();
    const ticket = (await tx.client.query<{requesterId: string; state: SupportTicket["state"]; revision: number; sequence: number}>(
      `SELECT requester_id AS "requesterId",state,revision,last_sequence AS sequence FROM treido.support_tickets WHERE id=$1 AND ($2::boolean OR requester_id=$3) FOR UPDATE`,
      [ticketId, operator, user.id],
    )).rows[0];
    if (command.kind !== "create" && !ticket) throw new SellerError("NOT_FOUND");
    // Receipt recovery does not depend on an old revision, but still needs current ownership/grants.
    if (previous) {
      if (!ticket || previous.hash !== hash) throw new SellerError("CONFLICT");
      return previous.result;
    }
    if (ticket && command.kind === "create") throw new SellerError("CONFLICT");
    if (ticket && ticket.revision !== command.expectedRevision) throw new SellerError("CONFLICT");
    const rate = (await tx.client.query<{count: number}>(
      command.kind === "create"
        ? "SELECT count(*)::int AS count FROM treido.support_tickets WHERE requester_id=$1 AND created_at>clock_timestamp()-interval '1 day'"
        : "SELECT count(*)::int AS count FROM treido.support_entries WHERE author_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
      [user.id],
    )).rows[0].count;
    if (rate >= (command.kind === "create" ? 5 : 20)) throw new SellerError("QUOTA_EXCEEDED");
    const state = command.kind === "create" ? "open" : supportTransition(ticket!.state, command.kind, operator);
    const sequence = ticket ? ticket.sequence + 1 : 1;
    const revision = ticket ? ticket.revision + 1 : 1;
    const internal = command.kind === "note";
    if (!ticket) await tx.client.query(
      "INSERT INTO treido.support_tickets(id,requester_id,topic,title) VALUES($1,$2,$3,$4)",
      [ticketId, user.id, command.topic, command.title],
    );
    else await tx.client.query(
      "UPDATE treido.support_tickets SET state=$2,revision=revision+1,last_sequence=$3,public_sequence=CASE WHEN $4 THEN public_sequence ELSE $3 END,updated_at=clock_timestamp() WHERE id=$1",
      [ticketId, state, sequence, internal],
    );
    await tx.client.query(
      "INSERT INTO treido.support_entries(ticket_id,sequence,author_id,author_side,kind,audience,body) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [ticketId, sequence, user.id, operator ? "operator" : "requester", command.kind, internal ? "operator" : "requester", command.body],
    );
    if (operator && !internal) await tx.client.query(
      "INSERT INTO treido.support_notifications(ticket_id,sequence,user_id) VALUES($1,$2,$3)", [ticketId, sequence, ticket!.requesterId],
    );
    const result = { id: ticketId, revision, sequence, state };
    await tx.client.query(
      "INSERT INTO treido.support_command_receipts(actor_id,request_id,ticket_id,input_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)",
      [user.id, command.requestId, ticketId, hash, JSON.stringify(result)],
    );
    return result;
  });
}
const ticketColumns = `t.id,t.title,t.topic,t.state,t.revision,t.last_sequence AS "lastSequence",t.public_sequence AS "publicSequence",
 to_char(t.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
 to_char(t.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
 EXISTS(SELECT 1 FROM treido.support_notifications n WHERE n.ticket_id=t.id AND n.user_id=$1 AND n.sequence>coalesce((SELECT sequence FROM treido.support_read_cursors c WHERE c.ticket_id=t.id AND c.user_id=$1),0)) AS unread`;
export async function readSupport(db: SellerDatabase, identity: VerifiedIdentity, raw: {ticketId?: string | null; before?: string | null; beforeSequence?: number | null; state?: string | null}, operator = false): Promise<SupportView> {
  const ticketId = raw.ticketId ?? null, before = raw.before ?? null, beforeSequence = raw.beforeSequence ?? null, state = raw.state ?? "all";
  if ((ticketId !== null && !validId(ticketId)) || (before !== null && !validId(before)) || (beforeSequence !== null && (!Number.isSafeInteger(beforeSequence) || beforeSequence < 1)) || !["all", "open", "waiting", "resolved"].includes(state)) throw new SellerError("INVALID_INPUT");
  return inTransaction(db, async tx => {
    const empty: SupportView = { actorKey: libraryActorKey(identity), operator, canWrite: !operator, tickets: [], nextBefore: null, ticket: null, entries: [], olderSequence: null };
    let user;
    try { user = await actor(tx, identity, operator, false); }
    catch (error) {
      if (!operator && !ticketId && error instanceof SellerError && error.code === "NOT_FOUND") return empty;
      throw error;
    }
    const canWrite = !operator || (await tx.client.query<{allowed: boolean}>("SELECT treido.lock_operator_grant($1,'moderation.write') AS allowed", [user.id])).rows[0]?.allowed === true;
    if (before && !(await tx.client.query("SELECT id FROM treido.support_tickets WHERE id=$1 AND ($2::boolean OR requester_id=$3)", [before, operator, user.id])).rowCount) throw new SellerError("NOT_FOUND");
    const tickets = (await tx.client.query<SupportTicket>(
      `SELECT ${ticketColumns} FROM treido.support_tickets t WHERE ($2::boolean OR t.requester_id=$1)
       AND ($3::uuid IS NULL OR t.id=$3) AND ($4='all' OR t.state=$4)
       AND ($5::uuid IS NULL OR (t.created_at,t.id)<(SELECT created_at,id FROM treido.support_tickets WHERE id=$5))
       ORDER BY t.created_at DESC,t.id DESC LIMIT 21`, [user.id, operator, ticketId, ticketId ? "all" : state, ticketId ? null : before],
    )).rows;
    if (ticketId && !tickets.length) throw new SellerError("NOT_FOUND");
    const entries = ticketId ? (await tx.client.query<SupportEntry>(
      `SELECT sequence,author_side AS side,kind,body,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
       FROM treido.support_entries WHERE ticket_id=$1 AND ($2::boolean OR audience='requester') AND ($3::integer IS NULL OR sequence<$3)
       ORDER BY sequence DESC LIMIT 41`, [ticketId, operator, beforeSequence],
    )).rows : [];
    return { ...empty, canWrite, tickets: ticketId ? [] : tickets.slice(0,20), nextBefore: !ticketId && tickets.length>20 ? tickets[19].id : null,
      ticket: ticketId ? tickets[0] : null, entries: entries.slice(0,40).reverse(), olderSequence: entries.length>40 ? entries[39].sequence : null };
  });
}
export async function markSupportRead(db: SellerDatabase, identity: VerifiedIdentity, raw: {actorKey: string; ticketId: string; sequence: number}) {
  if (!raw || !validId(raw.ticketId) || !Number.isSafeInteger(raw.sequence) || raw.sequence<1) throw new SellerError("INVALID_INPUT");
  matchActor(identity, raw.actorKey);
  return inTransaction(db, async tx => {
    const user = await supportHuman(tx, identity, false);
    const exists = await tx.client.query(
      "SELECT e.sequence FROM treido.support_entries e JOIN treido.support_tickets t ON t.id=e.ticket_id WHERE t.id=$1 AND t.requester_id=$2 AND e.sequence=$3 AND e.audience='requester' FOR SHARE OF t", [raw.ticketId,user.id,raw.sequence],
    );
    if (!exists.rowCount) throw new SellerError("NOT_FOUND");
    await tx.client.query(
      "INSERT INTO treido.support_read_cursors(ticket_id,user_id,sequence) VALUES($1,$2,$3) ON CONFLICT(ticket_id,user_id) DO UPDATE SET sequence=greatest(treido.support_read_cursors.sequence,excluded.sequence)", [raw.ticketId,user.id,raw.sequence],
    );
    return {sequence: raw.sequence};
  });
}
