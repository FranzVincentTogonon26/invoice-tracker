# Transaction Logs

Every **create / update / delete** that moves money — or changes an account —
is appended here automatically by `backend/src/utils/transactionLogger.js`
(via `realtime/emitTransaction`, called from every money controller).

- One file per day: `YYYY-MM-DD-transactions.md`
- Table columns: Timestamp (UTC) | Action | Entity | Actor (role) | Amount | Details
- Actions: `CREATE` · `UPDATE` · `DELETE` · `STATUS` · `SETTLE` · `TRANSFER`
- Entities: `budget` · `issued-budget` · `budget-reference` · `expense` ·
  `abono` · `transfer` · `employee` · `category`
- The same (sanitized) payload is broadcast over socket.io
  (`transactions:changed` → admin ledger room, `balance:changed` → personal
  `user:<id>` rooms, `employee:activity` → admins) so the admin Transaction
  page and every employee ledger update in realtime without leaking other
  employees' amounts.

Security note: daily `*-transactions.md` files contain real names and amounts
and are LOCAL-ONLY (git-ignored). They survive on the server, never in version
control. Only this README and `.gitkeep` are committed.
