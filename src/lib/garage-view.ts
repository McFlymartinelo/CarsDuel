export const GARAGE_VIEW_COOKIE = "carsduel_garage_view";

export type GarageView = "simple" | "detail";

export function parseGarageView(value: string | undefined): GarageView {
  return value === "detail" ? "detail" : "simple";
}
