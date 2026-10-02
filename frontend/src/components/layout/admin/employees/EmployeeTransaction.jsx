import { ErrorState } from "../../../ui/DataState";
import { TransactionsSection } from "../../employee/overview/TransactionsSection";
import { useEmployeeDetailsOverview } from "../../../../hooks/useEmployeeDetails";

/**
 * Admin → Employee Details → Overview tab.
 *
 * The selected employee's ENTIRE merged ledger — issued budget, expenses,
 * abono and budget transfers — rendered by the exact same
 * `TransactionsSection` the employee's own Overview page uses (search, date
 * window, pagination and the mobile detail sheet all come with it). The card
 * is read-only: the section only ever opens a preview, never a mutation.
 *
 * `userId` comes from the route param; the server re-validates it against the
 * users table before returning anything.
 */
const EmployeeTransaction = ({ userId }) => {
  const { data, isLoading, error, refetch } =
    useEmployeeDetailsOverview(userId);

  if (error) {
    return (
      <ErrorState
        title="Couldn't load transactions"
        message={
          error?.message ||
          "Something went wrong while fetching this employee's transactions."
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <TransactionsSection
      transactions={data?.transactions ?? []}
      isLoading={isLoading}
    />
  );
};

export default EmployeeTransaction;

