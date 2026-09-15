import test from 'node:test';
import {reviewDiagonalCatch} from './helpers/diagonal-catch-review.mjs';
test('181 fits both source stages and keeps the finite tappet clear through drive and return',()=>reviewDiagonalCatch(181));
