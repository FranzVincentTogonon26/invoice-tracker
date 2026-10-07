import { expenseConfigFor } from "@/lib/expenseLedger";
import { ExpenseTransactionCard } from "./ExpenseTransactionCard";

export function ExpenseSectionMobileList({ groups, disabled, onOpen }) {
  return (
    <>
      {groups.map(({ label, transactions }) => (
        <div key={label} className="space-y-2.5">
          <h4 className="px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            {label}
          </h4>
          {transactions.map((tx) => (
            <ExpenseTransactionCard
              key={`${tx.kind}-${tx.id}`}
              tx={tx}
              meta={expenseConfigFor(tx.kind)}
              disabled={disabled}
              onOpen={() => onOpen(tx)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export default ExpenseSectionMobileList;
