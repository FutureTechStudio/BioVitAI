export interface AccountPrincipal {
  id: string;
  email: string;
  emailVerified: true;
}
export interface Actor extends AccountPrincipal {
  sessionId: string;
}
export interface VerifiedAccounts {
  find(id: string): Promise<AccountPrincipal | null>;
}

export interface SessionReader {
  currentActor(
    headers: Record<string, string | undefined>,
  ): Promise<Actor | null>;
}

export interface IdentityEmail {
  kind: 'verification' | 'password-reset';
  recipient: string;
  url: string;
}

export interface IdentityMailer {
  deliver(message: IdentityEmail): Promise<void>;
}
