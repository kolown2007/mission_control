// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface User {
			id: string | number;
			name?: string;
			email?: string;
			// add other fields returned by the SSO validate endpoint as optional
			[key: string]: unknown;
		}

		interface Locals {
			user: User | null;
			// simple flag indicating whether kolown_sso cookie was present on the request
			ssoPresent?: boolean;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
