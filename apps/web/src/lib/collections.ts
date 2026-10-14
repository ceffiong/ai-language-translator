import 'server-only';
import type { ObjectId } from 'mongodb';
import type { CardContext, DirectionKey, Explanation } from '@ai-translator/shared';
import { db } from './db';

export interface CardDoc {
  _id?: ObjectId;
  userId: string;
  text: string;
  /** Normalized key used to de-duplicate cards per user and direction. */
  textKey: string;
  translation: string;
  explanation: Explanation | null;
  direction: DirectionKey;
  /** Every sentence the learner saved this word from, newest first. */
  contexts: (CardContext & { savedAt: Date })[];
  /** FSRS scheduling state (shape owned by ts-fsrs; added in Phase 4). */
  fsrs: Record<string, unknown>;
  due: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewLogDoc {
  _id?: ObjectId;
  userId: string;
  cardId: ObjectId;
  rating: 'again' | 'hard' | 'good' | 'easy';
  reviewedAt: Date;
  log: Record<string, unknown>;
}

export interface UsageDoc {
  _id?: ObjectId;
  /** `anon:<installId>`, `user:<userId>` or `ip:<ip>`, plus the metered action. */
  key: string;
  /** UTC day, e.g. `2026-10-14`. */
  day: string;
  count: number;
  expiresAt: Date;
}

export interface CacheDoc<T> {
  _id?: ObjectId;
  hash: string;
  value: T;
  createdAt: Date;
  hits: number;
}

export interface WaitlistDoc {
  _id?: ObjectId;
  email: string;
  source: 'landing' | 'pro';
  note?: string;
  ref?: string;
  createdAt: Date;
}

export const collections = {
  cards: () => db().collection<CardDoc>('cards'),
  reviewLogs: () => db().collection<ReviewLogDoc>('reviewLogs'),
  usage: () => db().collection<UsageDoc>('usage'),
  explainCache: () => db().collection<CacheDoc<Explanation>>('explainCache'),
  translateCache: () =>
    db().collection<CacheDoc<{ translation: string; detectedSourceLang: string | null }>>(
      'translateCache',
    ),
  waitlist: () => db().collection<WaitlistDoc>('waitlist'),
};
