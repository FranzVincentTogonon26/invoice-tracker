import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sourceOfFundsApi } from "../api/source-of-funds";

export const sourceOfFundsKey = (params) => ["source-of-funds", params || {}];

export function useSourceOfFunds() {


  return {

  };
}