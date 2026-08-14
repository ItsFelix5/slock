export const blurOnEnter = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    (event.currentTarget as HTMLElement).blur();
  }
};
