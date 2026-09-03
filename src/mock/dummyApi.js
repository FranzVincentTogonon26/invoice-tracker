import { data } from "./dummyData";

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

export const mock = {
  // Auth
  auth: {
    async me() {
      await delay();
      return Promise.reject({ status: 401, message: "Not Authenticated" });
    },
    async login() {
      await delay();
      return { user: clone(data.user) };
    },
    async register() {},
    async logout() {},
    async updateProfile() {},
    async changePassword() {
      await delay();
      return { ok: true };
    },
  },
};
