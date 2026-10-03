import { ErrorState } from "../../../ui/DataState";
import { TransactionsSection } from "../../employee/overview/TransactionsSection";
import { useEmployeeDetailsOverview } from "../../../../hooks/useEmployeeDetails";

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
