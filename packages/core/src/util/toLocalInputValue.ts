type InputPrecision = "date" | "minute" | "second";

const pad = (value: number) => String(value).padStart(2, "0");

export function toLocalInputValue(value: Date | number, precision: InputPrecision = "minute") {
  const date = new Date(value);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (precision === "date") return day;
  const minute = `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return precision === "minute" ? minute : `${minute}:${pad(date.getSeconds())}`;
}
