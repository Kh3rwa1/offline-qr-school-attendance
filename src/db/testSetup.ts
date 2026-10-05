import { registerTestDriver } from './index';
import { createTestDb } from './testDriver';

registerTestDriver(createTestDb);
