declare namespace App {
  interface Locals {
		user?: { id: number } | null;
		// simple flag indicating whether kolown_sso cookie was present on the request
		ssoPresent?: boolean;
  }
}

export {};
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
