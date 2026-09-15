import test from 'node:test';
import {reviewDiagonalCatch} from './helpers/diagonal-catch-review.mjs';
test('182 starts at the opposite stage and preserves the complete finite-contact sequence',()=>reviewDiagonalCatch(182));
