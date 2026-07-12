/**
 * Temporary JSX/React typings until `npm install` provides @types/react.
 * Safe to delete once node_modules includes @types/react (Next.js scaffold).
 */
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}

declare module "react" {
  export type ChangeEvent<T = Element> = {
    target: T;
    currentTarget: T;
  };

  export type RefObject<T> = { readonly current: T | null };

  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useState<T>(
    initialState: T | (() => T),
  ): [T, (value: T | ((prevState: T) => T)) => void];
  export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void;
}
