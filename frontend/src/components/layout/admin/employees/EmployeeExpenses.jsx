import { useMemo } from "react";
import { ErrorState } from "../../../ui/DataState";
import { TransactionsSectionExpenses } from "../../employee/expenses/TransactionsSectionExpenses";
import { useEmployeeDetailsExpenses } from "../../../../hooks/useEmployeeDetails";
import { expenseToTransaction } from "../../../../lib/employeeLedger";

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
