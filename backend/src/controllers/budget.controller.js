import Budget from "../models/budget.model.js";
import { validate } from "../utils/validate.js";
import { budgetSchema } from "../validations/budget.validation.js";

export const createBudget = async (req, res, next) => {
  try {
    const { description, amount, method } = validate(budgetSchema, req.body);

    // zod guarantees `amount` is a positive number; normalize just in case
    const parsedAmount = Number(amount);

    // user_id comes from the verified JWT (req.user), never from the client
    const newBudget = await Budget.createBudget({
      amount: parsedAmount,
      description: String(description).trim(),
      method,
      approved_by: req.user.name,
    });

    res.status(201).json({ budget: newBudget });
  } catch (err) {
    next(err);
  }
};

export const employeesWithBudget = async (req, res, next) => {
  try {
    const employeesWithBudget = await Budget.employeesWithBudget();
    res.status(200).json(employeesWithBudget);
  } catch (err) {
    next(err);
  }
};
