export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: AuthUser;
  access_token: string;
  token_type: 'Bearer';
}

export interface LoginPayload {
  email: string;
  password: string;
}
