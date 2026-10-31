export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  message: string;
  token?: string;
  name?: string;
  /** User id from the users table. Present after a successful sign-in. */
  userId?: string;
}
