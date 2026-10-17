import { startTransition, type FormEvent } from "react";

/**
 * 폼 제출 — `<form action>` 대신 onSubmit 으로 서버 액션을 부른다. React 19 는 form action 이 끝나면 (오류를 돌려줘도)
 * 입력칸을 처음 값으로 되돌려서, 틀린 칸 하나 때문에 적은 걸 전부 다시 적어야 한다. 이렇게 하면 적은 값이 남는다.
 */
export function keepForm(dispatch: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };
}
