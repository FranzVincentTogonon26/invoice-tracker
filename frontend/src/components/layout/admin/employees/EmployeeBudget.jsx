import { ErrorState } from "../../../ui/DataState";
import { TransactionsSectionBudget } from "../../employee/budget/TransactionsSectionBudget";
import { useEmployeeDetailsBudget } from "../../../../hooks/useEmployeeDetails";

/**
 * Admin → Employee Details → Budget tab.
 *
 * Every issuance and budget transfer the selected employee holds — rendered
 * by the same `TransactionsSectionBudget` their own Budget page uses, in
 * read-only mode: the cancel-transfer action and the confirm dialog stay
 * hidden (cancelling is the employee's own action), while search, filters and
 * the detail sheet remain fully available.
 *
 * `userId` comes from the route param; the server re-validates it against the
 * users table before returning anything.
 */
const EmployeeBudget = ({ userId }) => {
  const { transactions, isLoading, error, refetch } =
    useEmployeeDetailsBudget(userId);

  if (error) {
    return (
      <ErrorState
        title="Couldn't load budget records"
        message={
          error?.message ||
          "Something went wrong while fetching this employee's budget records."
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <TransactionsSectionBudget
      transactions={transactions}
      isLoading={isLoading}
      readOnly
    />
  );
};

export default EmployeeBudget;

