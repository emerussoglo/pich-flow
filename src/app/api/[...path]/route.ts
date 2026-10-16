import { handleApiRequest } from '@/src/server/adapter';

export const runtime = 'nodejs';

export const GET = handleApiRequest;
export const HEAD = handleApiRequest;
export const POST = handleApiRequest;
export const PUT = handleApiRequest;
export const PATCH = handleApiRequest;
export const DELETE = handleApiRequest;
export const OPTIONS = handleApiRequest;
