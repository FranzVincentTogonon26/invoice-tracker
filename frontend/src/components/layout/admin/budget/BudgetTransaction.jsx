import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";

const BudgetTransaction = () => {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Budget Transaction</CardTitle>
          <CardDescription>Track all budget activity.</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
};

export default BudgetTransaction;
