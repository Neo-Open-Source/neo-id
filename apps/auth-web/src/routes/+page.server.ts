import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const ssr = true;
export const prerender = false;

export const load: PageServerLoad = ({ url }) => {
  redirect(302, `/auth${url.search}`);
};
