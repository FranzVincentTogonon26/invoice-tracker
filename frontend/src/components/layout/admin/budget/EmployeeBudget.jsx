import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";

const EmployeeBudget = () => {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Employee Budget</CardTitle>
          <CardDescription>
            View and manage budgets assigned to employees.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
};

export default EmployeeBudget;
