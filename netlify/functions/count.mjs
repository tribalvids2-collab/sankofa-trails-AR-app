import { getStore } from '@netlify/blobs';
import { recordEvent } from '../lib/counter.mjs';

// The app calls this when a trail is opened and when an AR point is triggered (POST /api/count).
export default async (req) => recordEvent(req, getStore('counts'));
export const config = { path: '/api/count' };
