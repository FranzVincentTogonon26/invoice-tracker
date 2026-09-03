import { mock } from "../mock/dummyApi";

export const authApi = {
  me: () => mock.auth.me(),
  login: (payload) => mock.auth.login(payload),
};
