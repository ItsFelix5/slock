export const DEFAULT_WIDTH = 340;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 480;
export const blurOnEnter = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    (event.currentTarget as HTMLElement).blur();
  }
};
