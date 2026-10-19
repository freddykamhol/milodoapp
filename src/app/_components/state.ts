"use client";
import * as React from "react";
const subscribe = () => () => {};
export function useHydrated() { return React.useSyncExternalStore(subscribe, () => true, () => false); }
/** Local edits persist until their source prop changes; no extra effect render is needed. */
export function usePropState<S, T = S>(source: S, project: (source: S) => T = value => value as unknown as T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [previous, setPrevious] = React.useState(() => source);
  const [value, setValue] = React.useState(() => project(source));
  if (source !== previous) { setPrevious(source); setValue(project(source)); }
  return [value, setValue];
}
