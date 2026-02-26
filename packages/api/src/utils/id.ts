import { customAlphabet } from 'nanoid';

const prefixes: Record<string, unknown> = {};

interface GenerateIdOptions {
  length?: number;
  separator?: string;
}
// Create a custom alphabet with digits 0-9
const alphabet = '0123456789';

// Create a function to generate a random numeric ID
const generateNumericId = customAlphabet(alphabet, 10); // You can change the length (10) as needed

// Example usage
export const randomId = generateNumericId();
console.log(randomId);

export function generateId(
  prefixOrOptions?: keyof typeof prefixes | GenerateIdOptions,
  inputOptions: GenerateIdOptions = {}
) {
  const finalOptions = typeof prefixOrOptions === 'object' ? prefixOrOptions : inputOptions;

  const prefix = typeof prefixOrOptions === 'object' ? undefined : prefixOrOptions;

  const { length = 12, separator = '_' } = finalOptions;
  const id = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', length)();

  return prefix ? `${prefixes[prefix]}${separator}${id}` : id;
}
