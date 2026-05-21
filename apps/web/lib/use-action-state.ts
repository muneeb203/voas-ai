'use client';

import { useTransition } from 'react';
import { useFormState } from 'react-dom';

/**
 * React 18 polyfill for React 19's `useActionState`.
 *
 * React 19: `const [state, action, isPending] = useActionState(fn, initial);`
 * React 18: `const [state, action] = useFormState(fn, initial);` + `useFormStatus()` for pending.
 *
 * This hook combines `useFormState` with `useTransition` so we get the 3-tuple
 * shape with `isPending` tracking — drop-in replacement for the React 19 hook.
 * When we upgrade React to 19+ later, swap this for `import { useActionState } from 'react'`.
 */
export function useActionState<State, Payload>(
  action: (prev: State, payload: Payload) => Promise<State>,
  initialState: State,
): [State, (payload: Payload) => void, boolean] {
  // useFormState is technically typed as `(prev, FormData) => ...` in some
  // older type defs; we accept the broader signature at the boundary.
  const [state, formAction] = useFormState(
    action as never,
    initialState as never,
  ) as unknown as [State, (payload: Payload) => void];
  const [isPending, startTransition] = useTransition();

  function wrappedAction(payload: Payload) {
    startTransition(() => {
      formAction(payload);
    });
  }

  return [state, wrappedAction, isPending];
}
