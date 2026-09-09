import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";

const EmployeeBudget = () => {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Employee Budget</CardTitle>
          <CardDescription>Manage employee budget allocations.</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
};

export default EmployeeBudget;
