import { useMemo } from "react";
import { ErrorState } from "../../../ui/DataState";
import { TransactionsSectionExpenses } from "../../employee/expenses/TransactionsSectionExpenses";
import { useEmployeeDetailsExpenses } from "../../../../hooks/useEmployeeDetails";
import { expenseToTransaction } from "../../../../lib/employeeLedger";

/**
 * Admin → Employee Details → Expenses tab.
 *
 * The selected employee's expense ledger — rendered by the same
 * `TransactionsSectionExpenses` their own Expenses page uses, in read-only
 * mode: the delete/soft-delete action and inline description editing stay
 * hidden, while search, filters, pagination and the View expense modal
 * (receipt image + scanned lines) remain fully available.
 *
 * Rows are mapped with the shared `expenseToTransaction` helper so the admin
 * view and the employee view can never drift apart.
 *
 * `userId` comes from the route param; the server re-validates it against the
 * users table before returning anything.
 */
const EmployeeExpenses = ({ userId }) => {
  const { expenses, isLoading, error, refetch } =
    useEmployeeDetailsExpenses(userId);

  const transactions = useMemo(
    () => expenses.map(expenseToTransaction),
    [expenses],
  );

  if (error) {
    return (
      <ErrorState
        title="Couldn't load expenses"
        message={
          error?.message ||
          "Something went wrong while fetching this employee's expenses."
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <TransactionsSectionExpenses
      transactions={transactions}
      isLoading={isLoading}
      readOnly
    />
  );
};

export default EmployeeExpenses;

