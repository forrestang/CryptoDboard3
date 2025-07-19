const { initDatabase, insertToken, getAllTokens } = require('./src/lib/database.ts');
const { parseContractAddresses, validateContractAddress } = require('./src/lib/tokenManager.ts');


// Test 1: Database initialization
try {
  const db = initDatabase();
} catch (error) {
}

// Test 2: Contract address parsing
const testInput = `0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825,
0x123456789abcdef0123456789abcdef012345678
0xABCDEF0123456789ABCDEF0123456789ABCDEF01`;

const addresses = parseContractAddresses(testInput);

// Test 3: Address validation
const validBase = validateContractAddress('0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825', 'base');
const validSolana = validateContractAddress('11111111111111111111111111111112', 'solana');


