export class AuthApi {
  async login(username: string, password: string) {
    if (username === "guest") {
      return password === "secret";
    } else {
      throw new Error("Not found");
    }
  }
}

export const api = {
  auth: AuthApi,
};
