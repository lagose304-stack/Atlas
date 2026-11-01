export function resolveImageLocation(input: string, publicDomain: string): {
  storage: boolean;
  legacy: boolean;
  key: string | null;
  url: string;
};
