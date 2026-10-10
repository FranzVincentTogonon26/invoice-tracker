import { useMemo } from "react";
import { ErrorState } from "../../../ui/DataState";
import { TransactionsSectionAbono } from "../../employee/abono/TransactionsSectionAbono";
import { useEmployeeDetailsAbono } from "../../../../hooks/useEmployeeDetails";
import { abonoToTransaction } from "../../../../lib/employeeLedger";

/**
 * Admin → Employee Details → Abono tab.
 *
 * The selected employee's abono records — rendered by the same
 * `TransactionsSectionAbono` their own Abono page uses, in read-only mode:
 * the delete action and inline description editing stay hidden, while the
 * search, date filter, pagination and the detail sheet remain available.
 *
 * `totalBalance` rides along because the section uses it to mark an OPEN
 * abono whose amount was already consumed as spent (locked). It comes from
 * the same per-employee overview the employee page reads.
 *
 * `userId` comes from the route param; the server re-validates it against the
 * users table before returning anything.
 */
const EmployeeAbono = ({ userId, view }) => {
  const { abono, overview, isLoading, error, refetch } =
    useEmployeeDetailsAbono(userId, view);

  const transactions = useMemo(
    () => abono.map(abonoToTransaction),
    [abono],
  );

  if (error) {
    return (
      <ErrorState
        title="Couldn't load abono records"
        message={
          error?.message ||
          "Something went wrong while fetching this employee's abono records."
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <TransactionsSectionAbono
      transactions={transactions}
      isLoading={isLoading}
      totalBalance={overview?.totalBalance ?? null}
      readOnly
    />
  );
};

export default EmployeeAbono;

