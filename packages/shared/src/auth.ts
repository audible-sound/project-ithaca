export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  message: string;
  token?: string;
  name?: string;
}
